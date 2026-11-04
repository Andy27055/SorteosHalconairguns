require('dotenv').config();

const express  = require('express');
const session  = require('express-session');
const bcrypt   = require('bcryptjs');
const fs       = require('fs');
const path     = require('path');
const crypto   = require('crypto');

// ── MercadoPago ──────────────────────────────────────────────────────────────
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN || 'CONFIGURE_TU_ACCESS_TOKEN',
  options: { timeout: 5000 }
});
const mpPreference = new Preference(mpClient);
const mpPayment    = new Payment(mpClient);
const IS_SANDBOX   = (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-');

// ── Config ───────────────────────────────────────────────────────────────────
const app            = express();
const PORT           = process.env.PORT           || 3001;
const DB_PATH        = path.join(__dirname, 'data', 'db.json');
const BASE_URL       = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const SESSION_SECRET = process.env.SESSION_SECRET || 'halcon-dev-secret-cambiar';
const ADMIN_USER     = process.env.ADMIN_USER     || 'admin';

const SELECTION_EXPIRY_MS = 5  * 60 * 1000;
const PAYMENT_EXPIRY_MS   = 30 * 60 * 1000;

// ── DB helpers ───────────────────────────────────────────────────────────────
function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = { users: [], raffles: {}, tickets: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // Migración: db.config viejo → primera rifa
  if (db.config && !db.raffles) {
    const id = 'rifa-' + Date.now();
    db.raffles = {};
    db.raffles[id] = {
      id,
      title:            db.config.prize || 'Rifa Halcón Airguns',
      prize:            db.config.prize || 'Premio',
      prizeDescription: db.config.prizeDescription || '',
      ticketPrice:      db.config.ticketPrice || 5000,
      totalTickets:     db.config.totalTickets || 100,
      status:           'active',
      createdAt:        new Date().toISOString()
    };
    // Mover tickets al nuevo formato
    const oldTickets = db.tickets || {};
    db.tickets = { [id]: oldTickets };
    delete db.config;
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  }
  if (!db.raffles) db.raffles = {};
  if (!db.tickets) db.tickets = {};
  return db;
}
function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getRaffleTickets(db, raffleId) {
  if (!db.tickets[raffleId]) db.tickets[raffleId] = {};
  return db.tickets[raffleId];
}

function cleanExpiredPending(db) {
  const now = Date.now();
  let changed = false;
  for (const [raffleId, rt] of Object.entries(db.tickets)) {
    for (const [num, t] of Object.entries(rt)) {
      if (t.status === 'pending' && t.expiresAt && now > new Date(t.expiresAt).getTime()) {
        delete db.tickets[raffleId][num];
        changed = true;
        console.log(`[cleanup] Rifa ${raffleId} / Nº${num} liberado (${t.owner})`);
      }
    }
  }
  return changed;
}

// Cleanup periódico
setInterval(() => {
  const db = loadDB();
  if (cleanExpiredPending(db)) saveDB(db);
}, 30_000);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'No autenticado' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user)               return res.status(401).json({ error: 'No autenticado' });
  if (req.session.user !== ADMIN_USER) return res.status(403).json({ error: 'Acceso restringido' });
  next();
}

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)   return res.status(400).json({ error: 'Faltan datos' });
  if (username.length < 3)      return res.status(400).json({ error: 'Usuario muy corto (mínimo 3 caracteres)' });
  if (password.length < 4)      return res.status(400).json({ error: 'Contraseña muy corta (mínimo 4 caracteres)' });

  const db = loadDB();
  if (db.users.find(u => u.username === username))
    return res.status(400).json({ error: 'El usuario ya existe' });

  const hash = await bcrypt.hash(password, 10);
  db.users.push({ username, password: hash, createdAt: new Date().toISOString() });
  saveDB(db);
  req.session.user = username;
  res.json({ ok: true, username, isAdmin: username === ADMIN_USER });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const db   = loadDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  req.session.user = username;
  res.json({ ok: true, username, isAdmin: username === ADMIN_USER });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  res.json({ user: req.session.user, isAdmin: req.session.user === ADMIN_USER });
});

// ── Rifas (público) ──────────────────────────────────────────────────────────
app.get('/api/raffles', (req, res) => {
  const db = loadDB();
  cleanExpiredPending(db);
  const list = Object.values(db.raffles)
    .filter(r => r.status !== 'draft' || req.session.user === ADMIN_USER)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(r => {
      const rt      = db.tickets[r.id] || {};
      const sold    = Object.values(rt).filter(t => t.status === 'paid').length;
      const pending = Object.values(rt).filter(t => t.status === 'pending').length;
      return { ...r, sold, pending, available: r.totalTickets - sold - pending };
    });
  res.json(list);
});

app.get('/api/raffles/:id', (req, res) => {
  const db = loadDB();
  const r  = db.raffles[req.params.id];
  if (!r) return res.status(404).json({ error: 'Rifa no encontrada' });
  res.json(r);
});

app.get('/api/raffles/:id/tickets', (req, res) => {
  const db = loadDB();
  if (!db.raffles[req.params.id]) return res.status(404).json({ error: 'Rifa no encontrada' });
  cleanExpiredPending(db);
  res.json(db.tickets[req.params.id] || {});
});

// ── Reservar número ──────────────────────────────────────────────────────────
app.post('/api/reserve/:raffleId/:number', requireAuth, (req, res) => {
  const { raffleId } = req.params;
  const num          = parseInt(req.params.number);
  const username     = req.session.user;

  const db     = loadDB();
  const raffle = db.raffles[raffleId];
  if (!raffle)              return res.status(404).json({ error: 'Rifa no encontrada' });
  if (raffle.status !== 'active') return res.status(400).json({ error: 'Esta rifa no está activa' });
  if (!num || num < 1 || num > raffle.totalTickets)
    return res.status(400).json({ error: 'Número inválido' });

  if (cleanExpiredPending(db)) saveDB(db);

  const rt       = getRaffleTickets(db, raffleId);
  const existing = rt[num];

  if (existing?.status === 'paid')
    return res.status(409).json({ error: 'Ese número ya fue vendido.' });

  if (existing?.status === 'pending' && existing.owner !== username) {
    const secsLeft = Math.max(0, Math.ceil((new Date(existing.expiresAt) - Date.now()) / 1000));
    const minsLeft = Math.ceil(secsLeft / 60);
    return res.status(409).json({
      error: `Ese número está siendo reservado. Intentá en ${minsLeft} minuto${minsLeft !== 1 ? 's' : ''}.`
    });
  }

  const now       = Date.now();
  const expiresAt = new Date(now + SELECTION_EXPIRY_MS);
  rt[num] = { owner: username, status: 'pending', reservedAt: new Date(now).toISOString(), expiresAt: expiresAt.toISOString() };
  db.tickets[raffleId] = rt;
  saveDB(db);

  console.log(`[reserve] Rifa ${raffleId} / Nº${num} → "${username}"`);
  res.json({ ok: true, number: num, expiresAt: expiresAt.toISOString() });
});

// ── Crear pago ───────────────────────────────────────────────────────────────
app.post('/api/payment/create', requireAuth, async (req, res) => {
  const { raffleId } = req.body;
  const username     = req.session.user;

  if (!raffleId) return res.status(400).json({ error: 'Falta raffleId' });

  const db     = loadDB();
  const raffle = db.raffles[raffleId];
  if (!raffle) return res.status(404).json({ error: 'Rifa no encontrada' });

  if (cleanExpiredPending(db)) saveDB(db);

  const rt             = getRaffleTickets(db, raffleId);
  const pendingEntries = Object.entries(rt)
    .filter(([, t]) => t.owner === username && t.status === 'pending');

  if (pendingEntries.length === 0)
    return res.status(400).json({ error: 'No tenés números reservados en esta rifa.' });

  const nums        = pendingEntries.map(([n]) => parseInt(n)).sort((a, b) => a - b);
  const externalRef = `${username}|${raffleId}|${nums.join('-')}|${Date.now()}`;
  const total       = nums.length * raffle.ticketPrice;

  try {
    const pref = await mpPreference.create({
      body: {
        items: nums.map(num => ({
          title:       `${raffle.title} — Número ${num}`,
          description: `${raffle.prize}. Número ${num} de ${raffle.totalTickets}.`,
          quantity:    1,
          unit_price:  raffle.ticketPrice,
          currency_id: 'ARS'
        })),
        payer: { name: username },
        back_urls: {
          success: `${BASE_URL}/success.html`,
          failure: `${BASE_URL}/failure.html`,
          pending: `${BASE_URL}/pending.html`
        },
        auto_return:        'approved',
        notification_url:   `${BASE_URL}/api/webhook`,
        external_reference: externalRef,
        expires:              true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to:   new Date(Date.now() + PAYMENT_EXPIRY_MS).toISOString()
      }
    });

    const newExpiry = new Date(Date.now() + PAYMENT_EXPIRY_MS);
    for (const [numStr] of pendingEntries) {
      rt[numStr] = { ...rt[numStr], preferenceId: pref.id, externalRef, expiresAt: newExpiry.toISOString() };
    }
    db.tickets[raffleId] = rt;
    saveDB(db);

    console.log(`[payment] "${username}" rifa ${raffleId} — nums: ${nums.join(',')} — $${total}`);
    const checkout_url = IS_SANDBOX ? pref.sandbox_init_point : pref.init_point;
    res.json({ ok: true, checkout_url, total, nums });

  } catch (err) {
    console.error('[payment/create]', err?.message || err);
    res.status(500).json({ error: 'Error al crear el pago. Intentá nuevamente.' });
  }
});

// ── Webhook ───────────────────────────────────────────────────────────────────
app.post('/api/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    let paymentId = null;
    if (body?.type === 'payment' && body?.data?.id) paymentId = body.data.id;
    else if (req.query.topic === 'payment' && req.query.id) paymentId = req.query.id;
    if (!paymentId) return;

    const payment     = await mpPayment.get({ id: paymentId });
    const status      = payment.status;
    const externalRef = payment.external_reference;
    if (!externalRef) return;

    // Formato: username|raffleId|nums|timestamp
    const parts    = externalRef.split('|');
    const raffleId = parts[1];
    if (!raffleId) return;

    const db = loadDB();
    const rt = db.tickets[raffleId];
    if (!rt) { console.log(`[webhook] Rifa no encontrada: ${raffleId}`); return; }

    const entries = Object.entries(rt).filter(([, t]) => t.externalRef === externalRef);
    if (entries.length === 0) { console.log(`[webhook] Ref no encontrada: ${externalRef}`); return; }

    const username = entries[0][1].owner;
    const nums     = entries.map(([n]) => n);

    if (status === 'approved') {
      let changed = false;
      for (const [numStr, td] of entries) {
        if (rt[numStr]?.status === 'paid') continue;
        rt[numStr] = { owner: td.owner, status: 'paid', paymentId: String(paymentId), externalRef, boughtAt: new Date().toISOString() };
        changed = true;
      }
      if (changed) { db.tickets[raffleId] = rt; saveDB(db); console.log(`[webhook] ✅ Rifa ${raffleId} / Nº${nums.join(',')} → "${username}"`); }

    } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) {
      let changed = false;
      for (const [numStr] of entries) {
        if (rt[numStr]?.externalRef === externalRef) { delete rt[numStr]; changed = true; }
      }
      if (changed) { db.tickets[raffleId] = rt; saveDB(db); console.log(`[webhook] ❌ Rifa ${raffleId} / Nº${nums.join(',')} liberados (${status})`); }
    }
  } catch (err) { console.error('[webhook] Error:', err?.message || err); }
});

// ── Cancelar reserva propia ───────────────────────────────────────────────────
app.delete('/api/cancel/:raffleId/:number', requireAuth, (req, res) => {
  const { raffleId } = req.params;
  const num          = parseInt(req.params.number);
  const db           = loadDB();
  const rt           = db.tickets[raffleId] || {};
  const ticket       = rt[num];

  if (!ticket)                           return res.status(404).json({ error: 'Número no reservado' });
  if (ticket.owner !== req.session.user) return res.status(403).json({ error: 'No es tu reserva' });
  if (ticket.status === 'paid')          return res.status(400).json({ error: 'No se puede cancelar un pago confirmado' });

  delete rt[num];
  db.tickets[raffleId] = rt;
  saveDB(db);
  res.json({ ok: true });
});

// ── Config pública (legado) ───────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({ isSandbox: IS_SANDBOX, selectionExpiryMs: SELECTION_EXPIRY_MS });
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ ok: true, user: req.session.user }));

// CRUD Rifas
app.get('/api/admin/raffles', requireAdmin, (req, res) => {
  const db = loadDB();
  cleanExpiredPending(db);
  const list = Object.values(db.raffles)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(r => {
      const rt      = db.tickets[r.id] || {};
      const sold    = Object.values(rt).filter(t => t.status === 'paid').length;
      const pending = Object.values(rt).filter(t => t.status === 'pending').length;
      return { ...r, sold, pending, available: r.totalTickets - sold - pending, revenue: sold * r.ticketPrice };
    });
  res.json(list);
});

app.post('/api/admin/raffles', requireAdmin, (req, res) => {
  const { title, prize, prizeDescription, ticketPrice, totalTickets, status } = req.body;
  if (!title || !prize || !ticketPrice || !totalTickets)
    return res.status(400).json({ error: 'Faltan campos obligatorios' });

  const db = loadDB();
  const id = 'rifa-' + crypto.randomBytes(4).toString('hex');
  db.raffles[id] = {
    id,
    title:            String(title).trim(),
    prize:            String(prize).trim(),
    prizeDescription: String(prizeDescription || '').trim(),
    ticketPrice:      parseFloat(ticketPrice),
    totalTickets:     Math.max(1, parseInt(totalTickets)),
    status:           ['active','draft','finished'].includes(status) ? status : 'draft',
    createdAt:        new Date().toISOString()
  };
  db.tickets[id] = {};
  saveDB(db);
  console.log(`[admin] Rifa creada: ${id} — "${title}"`);
  res.json({ ok: true, raffle: db.raffles[id] });
});

app.put('/api/admin/raffles/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const r  = db.raffles[req.params.id];
  if (!r) return res.status(404).json({ error: 'Rifa no encontrada' });

  const { title, prize, prizeDescription, ticketPrice, totalTickets, status } = req.body;

  // Validar totalTickets ≥ max vendido
  const rt      = db.tickets[r.id] || {};
  const maxSold = Math.max(0, ...Object.keys(rt).map(Number));
  const newTotal = Math.max(1, parseInt(totalTickets) || r.totalTickets);
  if (newTotal < maxSold)
    return res.status(400).json({ error: `No podés reducir a menos de ${maxSold} — ya hay tickets hasta ese número.` });

  db.raffles[r.id] = {
    ...r,
    title:            String(title || r.title).trim(),
    prize:            String(prize || r.prize).trim(),
    prizeDescription: String(prizeDescription !== undefined ? prizeDescription : r.prizeDescription).trim(),
    ticketPrice:      parseFloat(ticketPrice) > 0 ? parseFloat(ticketPrice) : r.ticketPrice,
    totalTickets:     newTotal,
    status:           ['active','draft','finished'].includes(status) ? status : r.status
  };
  saveDB(db);
  res.json({ ok: true, raffle: db.raffles[r.id] });
});

app.delete('/api/admin/raffles/:id', requireAdmin, (req, res) => {
  const db = loadDB();
  const r  = db.raffles[req.params.id];
  if (!r) return res.status(404).json({ error: 'Rifa no encontrada' });

  const hasPaid = Object.values(db.tickets[r.id] || {}).some(t => t.status === 'paid');
  if (hasPaid) return res.status(400).json({ error: 'No se puede eliminar una rifa con tickets pagados.' });

  delete db.raffles[r.id];
  delete db.tickets[r.id];
  saveDB(db);
  res.json({ ok: true });
});

// Stats globales admin
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const db = loadDB();
  cleanExpiredPending(db);
  let totalSold = 0, totalRevenue = 0, totalPending = 0;
  for (const r of Object.values(db.raffles)) {
    const rt = db.tickets[r.id] || {};
    const paid    = Object.values(rt).filter(t => t.status === 'paid').length;
    const pending = Object.values(rt).filter(t => t.status === 'pending').length;
    totalSold    += paid;
    totalRevenue += paid * r.ticketPrice;
    totalPending += pending;
  }
  res.json({
    raffles: Object.keys(db.raffles).length,
    activeRaffles: Object.values(db.raffles).filter(r => r.status === 'active').length,
    totalSold,
    totalPending,
    totalRevenue,
    users: db.users.length
  });
});

// Tickets de admin (por rifa)
app.get('/api/admin/raffles/:id/tickets', requireAdmin, (req, res) => {
  const db = loadDB();
  cleanExpiredPending(db);
  res.json(db.tickets[req.params.id] || {});
});

app.delete('/api/admin/ticket/:raffleId/:number', requireAdmin, (req, res) => {
  const { raffleId } = req.params;
  const num          = parseInt(req.params.number);
  const db           = loadDB();
  const rt           = db.tickets[raffleId];
  if (!rt || !rt[num]) return res.status(404).json({ error: 'Ticket no encontrado' });
  const wasStatus = rt[num].status;
  delete rt[num];
  db.tickets[raffleId] = rt;
  saveDB(db);
  console.log(`[admin] Ticket ${raffleId}/${num} cancelado (era: ${wasStatus})`);
  res.json({ ok: true });
});

app.get('/api/admin/users', requireAdmin, (req, res) => {
  const db = loadDB();
  res.json(db.users.map(u => ({ username: u.username, createdAt: u.createdAt, isAdmin: u.username === ADMIN_USER })));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  const db = loadDB();
  if (cleanExpiredPending(db)) saveDB(db);
  const activeRaffles = Object.values(db.raffles).filter(r => r.status === 'active').length;
  console.log(`
╔══════════════════════════════════════════════════╗
║   🦅  Halcón Airguns — Sistema de Rifas          ║
╠══════════════════════════════════════════════════╣
║  URL local:   http://localhost:${PORT}               ║
║  URL pública: ${BASE_URL.slice(0, 34).padEnd(34)}║
║  Rifas activas: ${String(activeRaffles).padEnd(32)}║
║  Admin user:  ${ADMIN_USER.padEnd(34)}║
║  MP Modo:     ${IS_SANDBOX ? '🧪 SANDBOX (testing)' : '🚀 PRODUCCIÓN       '}              ║
╚══════════════════════════════════════════════════╝`);
});
