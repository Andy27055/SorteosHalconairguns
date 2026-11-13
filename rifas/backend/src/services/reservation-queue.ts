import { AppError } from '../errors.js';

// Share the queue between signed-in buyers and guests using the same DB client.
// PostgreSQL remains authoritative, including when there are multiple processes.
const queues = new WeakMap<object, Map<string, { tail: Promise<void>; pending: number }>>();
export async function reserveInOrder<T>(db: object, raffleId: string, run: () => Promise<T>): Promise<T> {
  let raffles = queues.get(db);
  if (!raffles) { raffles = new Map(); queues.set(db, raffles); }
  let queue = raffles.get(raffleId);
  if (!queue) { queue = { tail: Promise.resolve(), pending: 0 }; raffles.set(raffleId, queue); }
  if (queue.pending >= 1000) throw new AppError(503, 'Hay muchas reservas en curso. Esperá unos segundos y volvé a intentarlo.');
  queue.pending++;
  const previous = queue.tail;
  let release!: () => void;
  queue.tail = new Promise<void>(resolve => { release = resolve; });
  try { await previous; return await run(); }
  finally { queue.pending--; release(); if (!queue.pending) raffles.delete(raffleId); }
}
