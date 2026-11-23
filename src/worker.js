const config = require('./config');
const pool = require('./config/db');
const { redis, createRedis, describeError } = require('./config/redis');
const reliableQueue = require('./queue/reliableQueue');
const waitlistService = require('./services/waitlistService');
const { logEvent } = require('./utils/auditLogger');

const { promotionJobs, notificationJobs } = config.queues;
const processingOf = (queue) => `${queue}:processing`;
const failedOf = (queue) => `${queue}:failed`;

const handlers = {
  [promotionJobs]: (job) => waitlistService.promoteNext(job),
  // No real sending: the "message" is written to the audit log.
  [notificationJobs]: (job) =>
    logEvent('NOTIFICATION_SENT', {
      type: job.type,
      appointment_id: job.appointment_id,
      to: job.to,
      message: job.message,
    }),
};

let running = true;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pauses the worker until Redis answers, so an outage never crashes it.
const waitForRedis = async () => {
  let announced = false;
  while (running) {
    try {
      await redis.ping();
      if (announced) console.log('Redis is back');
      return;
    } catch (err) {
      if (!announced) console.error('Waiting for Redis to come back...');
      announced = true;
      await sleep(config.worker.retryDelayMs);
    }
  }
};

// A failed job goes to the back of its queue with a higher attempt count, and
// is parked in a failed list (not dropped) once it runs out of attempts.
const handleFailure = async (queue, raw, job, err) => {
  const attempts = (job.attempts || 0) + 1;
  console.error(`Job on ${queue} failed (attempt ${attempts}):`, describeError(err));

  if (attempts >= config.worker.maxAttempts) {
    await reliableQueue.moveToFailed(redis, failedOf(queue), processingOf(queue), raw, describeError(err));
    return;
  }
  await reliableQueue.requeueBack(
    redis,
    queue,
    processingOf(queue),
    raw,
    JSON.stringify({ ...job, attempts })
  );
  await sleep(config.worker.retryDelayMs);
};

const processOne = async (queue, raw) => {
  let job;
  try {
    job = JSON.parse(raw);
  } catch (err) {
    await reliableQueue.moveToFailed(redis, failedOf(queue), processingOf(queue), raw, 'Unparseable job');
    return;
  }

  try {
    const outcome = await handlers[queue](job);
    await reliableQueue.ack(redis, processingOf(queue), raw);
    if (outcome && outcome.status) console.log(`${queue}: ${outcome.status}`);
  } catch (err) {
    await handleFailure(queue, raw, job, err);
  }
};

// Each queue gets its own connection because a blocking pop occupies it.
// A loop error (for example Redis going away) pauses the loop until Redis answers again.
const consume = async (queue) => {
  const connection = createRedis({ maxRetriesPerRequest: null });
  try {
    while (running) {
      try {
        const raw = await reliableQueue.reserve(
          connection,
          queue,
          processingOf(queue),
          config.worker.blockSeconds
        );
        if (raw) await processOne(queue, raw);
      } catch (err) {
        console.error(`Worker loop error on ${queue}:`, describeError(err));
        await waitForRedis();
        await sleep(config.worker.retryDelayMs);
      }
    }
  } finally {
    connection.disconnect();
  }
};

const recoverAfterCrash = async () => {
  for (const queue of [promotionJobs, notificationJobs]) {
    const moved = await reliableQueue.recoverStuck(redis, queue, processingOf(queue));
    if (moved) console.log(`Recovered ${moved} unfinished job(s) on ${queue}`);
  }
  const restored = await waitlistService.recoverStuckEntries();
  if (restored) console.log(`Returned ${restored} waitlisted patient(s) to their queues`);
};

// Waits for Redis, then recovers anything a previous worker left unfinished.
// Retries if Redis drops again part-way through.
const start = async () => {
  while (running) {
    try {
      await waitForRedis();
      await recoverAfterCrash();
      return;
    } catch (err) {
      console.error('Startup recovery failed, retrying:', describeError(err));
      await sleep(config.worker.retryDelayMs);
    }
  }
};

const shutdown = async () => {
  try {
    await redis.quit();
  } catch (err) {
    redis.disconnect();
  }
  await pool.end();
};

const main = async () => {
  const stop = () => {
    console.log('Worker shutting down...');
    running = false;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await start();
  if (running) console.log('MediBook worker started');

  await Promise.all([consume(promotionJobs), consume(notificationJobs)]);
  await shutdown();
};

main().catch((err) => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
