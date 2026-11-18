// Reliable-queue helpers over Redis lists. An item is never deleted when it is
// taken: it moves to a "processing" list and is only removed on ack. If the
// worker dies, the item is still in processing and can be recovered.

const push = (redis, queue, item) => redis.rpush(queue, JSON.stringify(item));

// FIFO reserve: takes the head of the queue. Blocks up to blockSeconds if given.
const reserve = (redis, queue, processing, blockSeconds = 0) =>
  blockSeconds > 0
    ? redis.blmove(queue, processing, 'LEFT', 'RIGHT', blockSeconds)
    : redis.lmove(queue, processing, 'LEFT', 'RIGHT');

// Reserves the first item (in queue order) whose parsed value satisfies `predicate`.
const reserveMatching = async (redis, queue, processing, predicate) => {
  const items = await redis.lrange(queue, 0, -1);
  const raw = items.find((item) => predicate(JSON.parse(item)));
  if (!raw) return null;

  const [[, removed]] = await redis.multi().lrem(queue, 1, raw).rpush(processing, raw).exec();
  return removed === 1 ? raw : reserveMatching(redis, queue, processing, predicate);
};

const ack = (redis, processing, raw) => redis.lrem(processing, 1, raw);

// Puts a reserved item back at the head of its queue, keeping its place in line.
const requeueFront = (redis, queue, processing, raw, replacement = raw) =>
  redis.multi().lrem(processing, 1, raw).lpush(queue, replacement).exec();

const requeueBack = (redis, queue, processing, raw, replacement = raw) =>
  redis.multi().lrem(processing, 1, raw).rpush(queue, replacement).exec();

// Parks an item in a failed list (kept for inspection) instead of dropping it.
const moveToFailed = (redis, failedQueue, processing, raw, reason) => {
  let item = raw;
  try {
    item = JSON.parse(raw);
  } catch (err) {
    // keep the unparseable text as-is so nothing is lost
  }
  return redis
    .multi()
    .lrem(processing, 1, raw)
    .rpush(failedQueue, JSON.stringify({ item, reason, failed_at: new Date().toISOString() }))
    .exec();
};

// After a crash: moves everything left in processing back to the head of the queue.
const recoverStuck = async (redis, queue, processing) => {
  let moved = 0;
  while (await redis.lmove(processing, queue, 'RIGHT', 'LEFT')) moved += 1;
  return moved;
};

module.exports = {
  push,
  reserve,
  reserveMatching,
  ack,
  requeueFront,
  requeueBack,
  moveToFailed,
  recoverStuck,
};
