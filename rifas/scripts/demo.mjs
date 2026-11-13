import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('..', import.meta.url));
const demo = path.join(root, '.demo');
const binary = process.env.CLOUDFLARED_PATH || path.join(demo, process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const port = Number(process.env.DEMO_PORT || 3012);
const accessCode = process.env.DEMO_REQUIRE_CODE === 'true' ? randomBytes(18).toString('base64url') : '';
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('DEMO_PORT inválido.');
await fs.access(binary).catch(() => { throw Error('Falta cloudflared en .demo. Consultá Documentacion/17-DEMO-DESDE-PC.md.'); });
await fs.access(path.join(root, 'backend', 'dist', 'index.js'));
await fs.access(path.join(root, 'frontend', 'dist', 'index.html'));
await fs.mkdir(demo, { recursive: true });
await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', () => reject(Error(`El puerto ${port} está ocupado. Cerrá la otra demostración.`)));
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
const loadEnv = async name => dotenv.parse(await fs.readFile(name).catch(error => {
  if (error.code === 'ENOENT') return Buffer.alloc(0);
  throw error;
}));
const localEnv = { ...await loadEnv(path.join(root, '.env')), ...await loadEnv(path.join(root, 'backend', '.env')), ...process.env };
if (!localEnv.DATABASE_URL) throw Error('Falta DATABASE_URL en backend/.env.');
const children = [];
const logPath = path.join(demo, 'tunnel.log');
await fs.writeFile(logPath, '');
let closing = false;
async function stop(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) if (child.exitCode === null) child.kill();
  await fs.rm(path.join(demo, 'session.json'), { force: true });
  await fs.rm(path.join(demo, 'acceso.txt'), { force: true });
  console.log('Demostración cerrada. El enlace público dejó de funcionar. PostgreSQL conserva los datos.');
  process.exit(code);
}
process.once('SIGINT', () => { void stop(); });
process.once('SIGTERM', () => { void stop(); });
try {
  console.log('Creando enlace HTTPS temporal…');
  const tunnel = spawn(binary, ['tunnel', '--url', `http://127.0.0.1:${port}`, '--protocol', 'http2', '--no-autoupdate'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(tunnel);
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(Error('Cloudflare no entregó un enlace. Revisá .demo/tunnel.log.')), 60000);
    const inspect = chunk => {
      const text = chunk.toString();
      void fs.appendFile(logPath, text).catch(() => {});
      output = (output + text).slice(-20000);
      const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    };
    tunnel.stdout.on('data', inspect); tunnel.stderr.on('data', inspect);
    tunnel.once('error', () => { clearTimeout(timer); reject(Error('No se pudo iniciar cloudflared.')); });
    tunnel.once('exit', () => { clearTimeout(timer); reject(Error('El túnel terminó antes de crear el enlace. Revisá .demo/tunnel.log.')); });
  });
  tunnel.on('exit', () => { if (!closing) { console.error('Se cerró el túnel.'); void stop(1); } });
  const api = spawn(process.execPath, [path.join(root, 'backend', 'dist', 'index.js')], {
    cwd: path.join(root, 'backend'), windowsHide: true, stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...localEnv, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port), FRONTEND_URL: url, PUBLIC_API_URL: url, JWT_SECRET: randomBytes(48).toString('hex'), DEMO_ACCESS_CODE: accessCode, MP_ACCESS_TOKEN: '', MP_WEBHOOK_SECRET: '', ADMIN_PASSWORD: '' },
  });
  children.push(api);
  api.on('error', () => { console.error('No se pudo iniciar la página.'); void stop(1); });
  api.on('exit', () => { if (!closing) { console.error('Se cerró la página.'); void stop(1); } });
  let healthy = false;
  for (let i = 0; i < 30 && !closing; i++) {
    try { healthy = (await fetch(`http://127.0.0.1:${port}/api/health`, { headers: { 'x-demo-access-code': accessCode }, signal: AbortSignal.timeout(2000) })).ok; } catch {}
    if (healthy) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!healthy) throw Error('La API no respondió. Revisá que PostgreSQL esté iniciado.');
  if (accessCode) await fs.writeFile(path.join(demo, 'acceso.txt'), accessCode + '\n', { mode: 0o600 });
  else await fs.rm(path.join(demo, 'acceso.txt'), { force: true });
  await fs.writeFile(path.join(demo, 'session.json'), JSON.stringify({ url, protection: accessCode ? 'private-code-gate' : 'application-auth', pid: process.pid, apiPid: api.pid, tunnelPid: tunnel.pid, port, startedAt: new Date().toISOString() }, null, 2) + '\n');
  console.log(`\nENLACE PARA LOS TELÉFONOS: ${url}\n`);
  console.log('Mantené esta terminal y la PC encendidas. Ctrl+C cierra página y túnel.');
  if (accessCode) console.log('Demo privada: la clave está en .demo/acceso.txt. Compartila sólo con Osvaldo y José. Dura cuatro horas en cada navegador.');
  else console.log('Acceso directo al sitio. Para administrar, ingresá con tu cuenta habitual; no hay clave adicional de demostración.');
  console.log('Se usa la base local y el SMTP de backend/.env. Mercado Pago queda deshabilitado en esta demostración.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo iniciar la demostración.');
  await stop(1);
}
