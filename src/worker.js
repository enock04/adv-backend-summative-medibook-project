const config = require('./config');
const pool = require('./config/db');
const { redis, createRedis } = require('./config/redis');
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

// A failed job goes to the back of its queue with a higher attempt count, and
// is parked in a failed list (not dropped) once it runs out of attempts.
const handleFailure = async (queue, raw, job, err) => {
  const attempts = (job.attempts || 0) + 1;
  console.error(`Job on ${queue} failed (attempt ${attempts}):`, err.message);

  if (attempts >= config.worker.maxAttempts) {
    await reliableQueue.moveToFailed(redis, failedOf(queue), processingOf(queue), raw, err.message);
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
        console.error(`Worker loop error on ${queue}:`, err.message);
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

const main = async () => {
  await recoverAfterCrash();
  console.log('MediBook worker started');

  const stop = () => {
    console.log('Worker shutting down...');
    running = false;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  await Promise.all([consume(promotionJobs), consume(notificationJobs)]);
  await redis.quit();
  await pool.end();
};

main().catch((err) => {
  console.error('Worker crashed:', err);
  process.exit(1);
});
