// Local, disposable schema. Never starts index.ts, mail workers or real payment gateways.
import '../src/config.js';
import { config } from '../src/config.js';
import { createApp } from '../src/app.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';
import { Agent, request as httpRequest } from 'node:http';

const connectionString = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw Error('Definí TEST_DATABASE_URL o DATABASE_URL.');
// The test creates/drops its own schema; refuse a remote DB by default.
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname)) {
  throw Error('Esta prueba sólo admite PostgreSQL local. Medí el hosting en un entorno de pruebas separado.');
}
const schema = `halcon_load_${randomUUID().replaceAll('-', '')}`;
const receiptDir = path.join(os.tmpdir(), schema);
const pool = new pg.Pool({ connectionString, max: 1 });
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString, max: config.dbPoolMax, connectionTimeoutMillis: 5000 }, { schema }), log: [{ emit: 'event', level: 'query' }] });
let queries = 0; db.$on('query', () => { queries++; });
let server: Server | undefined;
let created = false;
const report: Record<string, unknown> = { date: new Date().toISOString(), environment: 'local PostgreSQL, isolated schema; no SMTP or external payments', clients: 809, poolMax: config.dbPoolMax };
let base = '';
const connections = Number(process.env.LOAD_CONNECTIONS || 128);
if (!Number.isInteger(connections) || connections < 1 || connections > 2500) throw Error('LOAD_CONNECTIONS debe estar entre 1 y 2500.');
const agent = new Agent({ keepAlive: true, maxSockets: connections });
report.generatorMaxConnections = connections;
type Result = { status: number; ms: number; error?: string };
async function hit(url: string, init?: RequestInit): Promise<Result> {
  const started = performance.now();
  return new Promise(resolve => {
    const req = httpRequest(`${base}/api${url}`, { method: init?.method || 'GET', headers: init?.headers as Record<string, string>, agent, signal: AbortSignal.timeout(30000) }, res => {
      const chunks: Buffer[] = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          resolve({ status: res.statusCode || 0, ms: performance.now() - started, ...(body.error ? { error: body.error } : {}) });
        } catch { resolve({ status: 0, ms: performance.now() - started, error: 'invalid-response' }); }
      });
      res.on('error', () => resolve({ status: 0, ms: performance.now() - started, error: 'response-error' }));
    });
    req.on('error', error => resolve({ status: 0, ms: performance.now() - started, error: (error as NodeJS.ErrnoException).code || 'network/timeout' }));
    req.end(init?.body as string | undefined);
  });
}
function summarize(results: Result[]) {
  const times = results.map(r => r.ms).sort((a, b) => a - b);
  const percentile = (p: number) => Math.round(times[Math.min(times.length - 1, Math.ceil(times.length * p) - 1)] || 0);
  return { requests: results.length, statuses: results.reduce<Record<string, number>>((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {}), p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), errors: [...new Set(results.filter(r => r.error).map(r => r.error))] };
}
async function phase(name: string, run: () => Promise<Result[]>) {
  const before = queries, started = performance.now();
  const results = await run();
  const summary = { ...summarize(results), databaseQueries: queries - before, durationMs: Math.round(performance.now() - started) };
  report[name] = summary; console.log(name, JSON.stringify(summary));
  return results;
}

try {
  await pool.query(`CREATE SCHEMA "${schema}"`); created = true;
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);
    for (const folder of (await fs.readdir('prisma/migrations')).sort()) {
      const sql = await fs.readFile(path.join('prisma/migrations', folder, 'migration.sql'), 'utf8').catch(() => null);
      if (sql) await client.query(sql);
    }
  } finally { client.release(); }
  await db.user.createMany({ data: Array.from({ length: 809 }, (_, i) => ({ id: `load-user-${i}`, username: `load-${i}`, email: `load-${i}@example.invalid`, fullName: `Usuario prueba ${i}`, passwordHash: 'no-login' })) });
  const prize = await db.prize.create({ data: { name: 'Premio ficticio' } });
  const raffle = await db.raffle.create({ data: { title: 'Carga aislada', prizeId: prize.id, status: 'ACTIVE', totalTickets: 1000, lotteryDigits: 3, ticketPriceCents: 100 } });
  const cfg = { ...config, production: false, smtpEnabled: false, mpToken: '', mpWebhookSecret: '', receiptDir, jwtSecret: randomUUID() + randomUUID() };
  const gateway = { createPreference: async () => { throw Error('Disabled'); }, findPreference: async () => null, getPayment: async () => { throw Error('Disabled'); }, findPayments: async () => [] };
  server = createApp(db, cfg, gateway).listen({ port: 0, host: '127.0.0.1', backlog: 4096 });
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('No port');
  base = `http://127.0.0.1:${address.port}`;
  const users = Array.from({ length: 809 }, (_, i) => jwt.sign({ sub: `load-user-${i}`, version: 0 }, cfg.jwtSecret, { issuer: 'halcon-airguns', audience: 'halcon-web', algorithm: 'HS256', expiresIn: '1h' }));
  const postOrder = (i: number, number: number) => hit('/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${users[i]}` }, body: JSON.stringify({ raffleId: raffle.id, numbers: [number] }) });

  const read = await phase('burst809', async () => (await Promise.all(users.map(async () => Promise.all([hit('/raffles'), hit(`/raffles/${raffle.id}`), hit(`/raffles/${raffle.id}/availability`)])))).flat());
  const polling = await phase('polling809', async () => (await Promise.all(users.map(async () => {
    const results: Result[] = [];
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, i === 0 ? Math.random() * 1000 : 5000));
      results.push(await hit(`/raffles/${raffle.id}/availability`));
    }
    return results;
  }))).flat());
  const same = await phase('sameNumber809', () => Promise.all(users.map((_, i) => postOrder(i, 0))));
  const distinct = await phase('distinctNumbers100', () => Promise.all(users.slice(0, 100).map((_, i) => postOrder(i, i + 1))));
  const owners = await db.allocation.count({ where: { raffleId: raffle.id, number: 0 } });
  const orders = await db.order.count({ where: { raffleId: raffle.id, status: 'RESERVED' } });
  const confirmedEmails = await db.purchaseEmail.count();
  report.invariants = { sameNumberOwners: owners, reservedOrders: orders, purchaseEmails: confirmedEmails };
  const passed = [...read, ...polling].every(r => r.status === 200) && same.filter(r => r.status === 201).length === 1 && same.every(r => [201, 409].includes(r.status)) && owners === 1 && distinct.every(r => r.status === 201) && orders === 101 && confirmedEmails === 0;
  report.passed = passed;
  console.log('invariants', JSON.stringify(report.invariants));
  if (!passed) process.exitCode = 1;
} catch (error) {
  console.error('Prueba interrumpida:', { type: error instanceof Error ? error.name : 'Error', code: (error as { code?: string }).code || 'UNEXPECTED' });
  report.passed = false; process.exitCode = 1;
} finally {
  agent.destroy();
  if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
  await db.$disconnect();
  if (created) {
    if (!/^halcon_load_[a-f0-9]{32}$/.test(schema)) throw Error('Esquema inválido.');
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
  await pool.end();
  if (path.dirname(path.resolve(receiptDir)) !== path.resolve(os.tmpdir()) || path.basename(receiptDir) !== schema) throw Error('Ruta inválida.');
  await fs.rm(receiptDir, { recursive: true, force: true });
  const output = path.resolve('..', `load-test-results-${connections}.json`);
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`Informe: load-test-results-${connections}.json (prueba local; repetir medición en el alojamiento antes de abrir al público).`);
}
