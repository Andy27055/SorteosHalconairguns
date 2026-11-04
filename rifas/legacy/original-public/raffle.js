// ── Estado global ─────────────────────────────────────
let currentUser     = null;
let isAdmin         = false;
let raffleId        = null;
let raffle          = null;
let tickets         = {};
let countdownTimers = {};

// ── INIT ──────────────────────────────────────────────
async function init() {
  // Obtener raffle ID de la URL
  const params = new URLSearchParams(window.location.search);
  raffleId = params.get('id');
  if (!raffleId) { window.location.href = '/'; return; }

  // Verificar sesión y cargar rifa en paralelo
  const [meRes, raffleRes] = await Promise.all([
    fetch('/api/me'),
    fetch(`/api/raffles/${raffleId}`)
  ]);

  if (!raffleRes.ok) { window.location.href = '/'; return; }

  const meData = await meRes.json();
  raffle = await raffleRes.json();

  if (!meData.user) { window.location.href = '/'; return; }

  currentUser = meData.user;
  isAdmin     = meData.isAdmin || false;

  // Actualizar UI con datos de la rifa
  document.title = `${raffle.title} — Halcón Airguns`;
  document.getElementById('raffle-header-title').textContent = raffle.title.toUpperCase();
  document.getElementById('prize-title-text').textContent    = raffle.prize;
  document.getElementById('prize-sub-text').textContent      = raffle.prizeDescription || '';
  document.getElementById('welcome-msg').innerHTML = `Hola, <strong>${currentUser}</strong>`;

  const adminLink = document.getElementById('admin-link');
  if (adminLink) adminLink.classList.toggle('hidden', !isAdmin);

  await loadTickets();
}

// ── TICKETS ───────────────────────────────────────────
async function loadTickets() {
  const res = await fetch(`/api/raffles/${raffleId}/tickets`);
  tickets = await res.json();
  checkActiveReservations();
  renderGrid();
  renderMyTickets();
  renderStats();
}

// ── RESERVAS ACTIVAS ──────────────────────────────────
function checkActiveReservations() {
  const myPending = Object.entries(tickets)
    .filter(([, t]) => t.owner === currentUser && t.status === 'pending');

  for (const numStr of Object.keys(countdownTimers)) {
    if (!myPending.find(([n]) => n === numStr)) {
      clearInterval(countdownTimers[numStr]);
      delete countdownTimers[numStr];
    }
  }

  if (myPending.length > 0) {
    renderReservationBar(myPending);
    document.getElementById('reservation-bar').classList.remove('hidden');
    for (const [numStr, t] of myPending) startCountdown(parseInt(numStr), t.expiresAt);
  } else {
    hideReservationBar();
  }
}

function renderReservationBar(pendingEntries) {
  const list = document.getElementById('res-list');
  list.innerHTML = pendingEntries.map(([numStr]) => {
    const num = parseInt(numStr);
    return `
      <div class="res-row" id="res-row-${num}">
        <div class="res-badge">${num}</div>
        <div class="res-info"><div class="res-title">NÚMERO ${num}</div></div>
        <div class="res-timer-block">
          <div class="res-timer-label">vence en</div>
          <div class="res-timer-value" id="res-countdown-${num}">05:00</div>
        </div>
        <div class="res-actions">
          <button class="btn-release" onclick="releaseReservation(${num})">Liberar</button>
        </div>
      </div>`;
  }).join('');

  const total = pendingEntries.length * raffle.ticketPrice;
  document.getElementById('res-total').textContent = total.toLocaleString('es-AR');
}

function hideReservationBar() {
  document.getElementById('reservation-bar').classList.add('hidden');
  document.getElementById('res-list').innerHTML = '';
  clearAllCountdowns();
}

// ── CUENTA REGRESIVA ──────────────────────────────────
function startCountdown(num, expiresAt) {
  if (countdownTimers[num]) return;
  const endTime = new Date(expiresAt).getTime();

  function tick() {
    const remaining = Math.max(0, endTime - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    const row  = document.getElementById(`res-row-${num}`);
    const el   = document.getElementById(`res-countdown-${num}`);
    if (el) el.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    if (remaining < 60_000 && remaining > 0) row?.classList.add('urgent');
    else row?.classList.remove('urgent');

    if (remaining <= 0) {
      clearInterval(countdownTimers[num]);
      delete countdownTimers[num];
      row?.remove();
      showToast(`⏰ Reserva del número ${num} venció — fue liberado.`, 'error');
      if (document.getElementById('res-list').children.length === 0)
        document.getElementById('reservation-bar').classList.add('hidden');
      loadTickets();
    }
  }
  tick();
  countdownTimers[num] = setInterval(tick, 1000);
}

function clearAllCountdowns() {
  for (const id of Object.values(countdownTimers)) clearInterval(id);
  countdownTimers = {};
}

// ── GRILLA ────────────────────────────────────────────
function renderGrid() {
  const grid = document.getElementById('ticket-grid');
  grid.innerHTML = '';

  for (let i = 1; i <= raffle.totalTickets; i++) {
    const t   = tickets[i];
    const div = document.createElement('div');
    div.className   = 'ticket';
    div.textContent = i;

    if (t?.status === 'pending' && t.owner === currentUser) {
      div.classList.add('pending-mine');
      div.title   = `Número ${i} — reservado para vos`;
      div.onclick = () => flashRow(i);

    } else if (t?.status === 'paid' && t.owner === currentUser) {
      div.classList.add('mine');
      div.title   = `Número ${i} — tuyo ✓`;
      div.onclick = () => showToast(`¡El número ${i} es tuyo! 🎟️`, 'success');

    } else if (t) {
      div.classList.add('taken');
      div.title = `Número ${i} — no disponible`;

    } else {
      div.classList.add('available');
      div.title   = `Número ${i} — $${raffle.ticketPrice.toLocaleString('es-AR')} ARS · Click para reservar`;
      div.onclick = () => reserveNumber(i);
    }

    grid.appendChild(div);
  }
}

function flashRow(num) {
  const row = document.getElementById(`res-row-${num}`);
  if (!row) return;
  row.style.outline = '2px solid var(--gold-lt)';
  setTimeout(() => { row.style.outline = ''; }, 600);
}

// ── RESERVAR ──────────────────────────────────────────
async function reserveNumber(num) {
  if (tickets[num]?.owner === currentUser && tickets[num]?.status === 'pending') {
    document.getElementById(`res-row-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    flashRow(num);
    return;
  }

  const res  = await fetch(`/api/reserve/${raffleId}/${num}`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) { showToast(data.error, 'error'); return; }

  showToast(`Número ${num} reservado 🎟️ — tenés 5 minutos para pagar`, 'success');
  await loadTickets();
  document.getElementById('reservation-bar').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── PAGAR ─────────────────────────────────────────────
async function goToPayment() {
  const payBtn = document.getElementById('btn-pay-all');
  if (payBtn) { payBtn.textContent = 'Creando pago...'; payBtn.disabled = true; }

  try {
    const res  = await fetch('/api/payment/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raffleId })
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.error, 'error');
      if (payBtn) {
        payBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> PAGAR TODO — $<span id="res-total">${document.getElementById('res-total')?.textContent || ''}</span>`;
        payBtn.disabled = false;
      }
      return;
    }
    window.location.href = data.checkout_url;

  } catch (err) {
    showToast('Error de conexión. Intentá de nuevo.', 'error');
    if (payBtn) payBtn.disabled = false;
  }
}

// ── LIBERAR ───────────────────────────────────────────
async function releaseReservation(num) {
  const res = await fetch(`/api/cancel/${raffleId}/${num}`, { method: 'DELETE' });
  if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }

  if (countdownTimers[num]) { clearInterval(countdownTimers[num]); delete countdownTimers[num]; }
  document.getElementById(`res-row-${num}`)?.remove();
  const remaining = document.getElementById('res-list').children.length;
  if (remaining === 0) {
    document.getElementById('reservation-bar').classList.add('hidden');
  } else {
    const el = document.getElementById('res-total');
    if (el) el.textContent = (remaining * raffle.ticketPrice).toLocaleString('es-AR');
  }
  showToast(`Número ${num} liberado.`, '');
  await loadTickets();
}

// ── STATS ─────────────────────────────────────────────
function renderStats() {
  const paid    = Object.values(tickets).filter(t => t.status === 'paid').length;
  const pending = Object.values(tickets).filter(t => t.status === 'pending').length;
  const mine    = Object.values(tickets).filter(t => t.owner === currentUser && t.status === 'paid').length;
  document.getElementById('stat-avail-num').textContent = raffle.totalTickets - paid - pending;
  document.getElementById('stat-sold-num').textContent  = paid;
  document.getElementById('stat-mine-num').textContent  = mine;
}

// ── MIS RIFAS ─────────────────────────────────────────
function renderMyTickets() {
  const section = document.getElementById('my-tickets-section');
  const list    = document.getElementById('my-tickets-list');
  const mine    = Object.entries(tickets)
    .filter(([, t]) => t.owner === currentUser)
    .sort(([a], [b]) => a - b);

  if (mine.length === 0) { section.classList.add('hidden'); return; }
  section.classList.remove('hidden');

  list.innerHTML = mine.map(([num, t]) => {
    const isPaid  = t.status === 'paid';
    const dateStr = new Date(isPaid ? t.boughtAt : t.reservedAt)
      .toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const badge     = isPaid ? `<span class="badge badge-paid">Confirmado ✓</span>` : `<span class="badge badge-pending">Reservado ⏳</span>`;
    const cancelBtn = !isPaid ? `<button class="btn-cancel" onclick="releaseReservation(${num})">Liberar</button>` : '';
    return `
      <div class="my-ticket-item ${!isPaid ? 'is-pending' : ''}">
        <span class="my-ticket-num">${num}</span>
        <div class="my-ticket-info">
          <div class="my-ticket-label">Número ${num} ${badge}</div>
          <div class="my-ticket-date">${dateStr}</div>
        </div>
        ${cancelBtn}
      </div>`;
  }).join('');
}

// ── LOGOUT ────────────────────────────────────────────
async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
}

// ── MODAL ─────────────────────────────────────────────
function openModal(title, body, onConfirm, icon = '🎟️') {
  document.getElementById('modal-icon').textContent  = icon;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = body.replace(/\n/g, '<br>');
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
}
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3500);
}

// ── START ─────────────────────────────────────────────
init();
