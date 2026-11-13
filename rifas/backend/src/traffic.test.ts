import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { PublicCache } from './services/public-cache.js';
import { authLimit, receiptCapacity } from './traffic.js';
import { createApp } from './app.js';
import { config } from './config.js';
import { atomic } from './db.js';
import { reserveInOrder } from './services/reservation-queue.js';
import type { PrismaClient } from './generated/prisma/client.js';

describe('lecturas públicas compartidas', () => {
  it('809 consultas concurrentes comparten una sola lectura y expira al segundo', async () => {
    const cache = new PublicCache();
    const load = vi.fn(async () => [37]);
    await Promise.all(Array.from({ length: 809 }, () => cache.get('numbers', load)));
    expect(load).toHaveBeenCalledOnce();
    const time = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 1001);
    try { await cache.get('numbers', load); expect(load).toHaveBeenCalledTimes(2); }
    finally { time.mockRestore(); }
  });

  it('un fallo no se conserva y una lectura antigua no repuebla tras invalidar', async () => {
    const cache = new PublicCache();
    await expect(cache.get('x', async () => { throw Error('offline'); })).rejects.toThrow();
    expect(await cache.get('x', async () => 2)).toBe(2);
    let resolve!: (value: number) => void;
    const old = cache.get('pending', () => new Promise<number>(done => { resolve = done; }));
    await Promise.resolve(); cache.clear();
    expect(await cache.get('pending', async () => 3)).toBe(3);
    resolve(1); await old;
    expect(await cache.get('pending', async () => 4)).toBe(3);
  });

  it('limita el tamaño y no mezcla rifas', async () => {
    const cache = new PublicCache(1000, 2);
    await cache.get('a', async () => 1); await cache.get('b', async () => 2);
    await cache.get('c', async () => 3);
    expect(await cache.get('a', async () => 4)).toBe(4);
  });

  it('HTTP comparte consultas, omite vencidas sin escribir y devuelve sólo números y estado', async () => {
    const findFirst = vi.fn(async () => ({ id: 'rifa' }));
    const findMany = vi.fn(async () => [{ number: 37, order: { status: 'PAID' } }]);
    const transaction = vi.fn();
    const db = { raffle: { findFirst }, allocation: { findMany }, $transaction: transaction } as unknown as PrismaClient;
    const app = createApp(db, config);
    const responses = await Promise.all(Array.from({ length: 30 }, () => request(app).get('/api/raffles/rifa/availability')));
    expect(responses.every(r => r.status === 200)).toBe(true);
    expect(responses[0].body).toEqual([{ number: 37, status: 'PAID' }]);
    expect(findFirst).toHaveBeenCalledOnce(); expect(findMany).toHaveBeenCalledOnce();
    expect(transaction).not.toHaveBeenCalled();
    expect(findMany.mock.calls[0]).toEqual([expect.objectContaining({ where: expect.objectContaining({ order: { NOT: { status: { in: ['RESERVED', 'PAYMENT_PENDING', 'AWAITING_RECEIPT'] }, expiresAt: { lt: expect.any(Date) } } } }) })]);
  });
});

describe('límites sin bloquear personas que comparten IP', () => {
  it('ordena reservas de una rifa, deja avanzar otras y libera la cola tras un error', async () => {
    const db = {}, events: number[] = [];
    let release!: () => void;
    const first = reserveInOrder(db, 'a', async () => { await new Promise<void>(done => { release = done; }); events.push(1); });
    const second = reserveInOrder(db, 'a', async () => { events.push(2); throw Error('ocupado'); }).catch(() => undefined);
    const third = reserveInOrder(db, 'a', async () => { events.push(3); });
    await reserveInOrder(db, 'b', async () => { events.push(0); });
    expect(events).toEqual([0]); release();
    await Promise.all([first, second, third]); expect(events).toEqual([0, 1, 2, 3]);
  });
  it('reintenta conflictos del adaptador al confirmar, sin repetir errores ajenos', async () => {
    const conflict = Object.assign(new Error('commit'), { cause: { kind: 'TransactionWriteConflict' } });
    const transaction = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce(7);
    expect(await atomic({ $transaction: transaction } as unknown as PrismaClient, async () => 7)).toBe(7);
    expect(transaction).toHaveBeenCalledTimes(2);
    transaction.mockReset().mockRejectedValue(new Error('offline'));
    await expect(atomic({ $transaction: transaction } as unknown as PrismaClient, async () => 7)).rejects.toThrow('offline');
    expect(transaction).toHaveBeenCalledOnce();
  });
  it('mantiene 30 intentos por identidad sin bloquear otra cuenta en la misma red', async () => {
    const app = express(); app.use(express.json(), authLimit()); app.post('/', (_req, res) => res.sendStatus(204));
    for (let i = 0; i < 30; i++) expect((await request(app).post('/').send({ login: 'uno' })).status).toBe(204);
    expect((await request(app).post('/').send({ login: ' UNO ' })).status).toBe(429);
    expect((await request(app).post('/').send({ login: 'dos' })).status).toBe(204);
  });

  it('dos navegadores de una misma IP tienen cupos independientes y cookie privada', async () => {
    const create = vi.fn(async () => ({ id: 'order', expiresAt: new Date(Date.now() + 600000) }));
    const fakeTx = { order: { findMany: vi.fn(async () => []), findUnique: vi.fn(async () => null), create }, raffle: { findUnique: vi.fn(async () => ({ status: 'ACTIVE', numberStart: 0, totalTickets: 100, ticketPriceCents: 100, drawAt: null })) }, allocation: { count: vi.fn(async () => 0) }, auditLog: { create: vi.fn(async () => ({})) } };
    const db = { $transaction: async (fn: (tx: unknown) => unknown) => fn(fakeTx) } as unknown as PrismaClient;
    const app = createApp(db, config);
    const first = request.agent(app), second = request.agent(app);
    const a = await first.post('/api/guest-reservations').send({ raffleId: 'rifa', numbers: [1] });
    const b = await second.post('/api/guest-reservations').send({ raffleId: 'rifa', numbers: [2] });
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect(a.headers['set-cookie'].join('')).toContain('HttpOnly');
    expect(create.mock.calls[0][0].data.guestClientHash).not.toBe(create.mock.calls[1][0].data.guestClientHash);
  });

  it('rechaza sobrecarga de archivos antes de leerlos y recupera el cupo tras terminar', async () => {
    const app = express(); const release: (() => void)[] = [];
    app.use(cookieParser(), receiptCapacity(1));
    app.post('/', (_req, res) => { release.push(() => res.sendStatus(204)); });
    const first = request(app).post('/').then(r => r);
    await vi.waitFor(() => expect(release).toHaveLength(1));
    const busy = await request(app).post('/');
    expect(busy.status).toBe(503); expect(busy.headers['retry-after']).toBe('3');
    release[0](); expect((await first).status).toBe(204);
    const next = request(app).post('/').then(r => r);
    await vi.waitFor(() => expect(release).toHaveLength(2));
    release[1](); expect((await next).status).toBe(204);
  });
});
