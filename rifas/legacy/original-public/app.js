let currentUser = null;
let isAdmin     = false;

// ── INIT ──────────────────────────────────────────────
async function init() {
  const res    = await fetch('/api/me');
  const meData = await res.json();

  if (meData.user) {
    currentUser = meData.user;
    isAdmin     = meData.isAdmin || false;
    showApp();
  } else {
    showAuth();
  }
}

// ── TABS ──────────────────────────────────────────────
function showTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('login-error').textContent = '';
  document.getElementById('register-error').textContent = '';
}

// ── AUTH ──────────────────────────────────────────────
async function login(e) {
  e.preventDefault();
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const res  = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) { document.getElementById('login-error').textContent = data.error; return; }
  currentUser = data.username;
  isAdmin     = data.isAdmin || false;
  showApp();
}

async function register(e) {
  e.preventDefault();
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const res  = await fetch('/api/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (!res.ok) { document.getElementById('register-error').textContent = data.error; return; }
  currentUser = data.username;
  isAdmin     = data.isAdmin || false;
  showApp();
}

async function logout() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  isAdmin     = false;
  showAuth();
}

// ── SCREENS ───────────────────────────────────────────
function showAuth() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
  document.getElementById('login-user').value = '';
  document.getElementById('login-pass').value = '';
  showTab('login');
}

async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  document.getElementById('welcome-msg').innerHTML = `Hola, <strong>${currentUser}</strong>`;
  const adminLink = document.getElementById('admin-link');
  if (adminLink) adminLink.classList.toggle('hidden', !isAdmin);
  await loadRaffles();
}

// ── RIFAS ─────────────────────────────────────────────
async function loadRaffles() {
  const res     = await fetch('/api/raffles');
  const raffles = await res.json();

  const grid  = document.getElementById('raffles-grid');
  const empty = document.getElementById('raffles-empty');

  const visible = raffles.filter(r => r.status !== 'finished' || isAdmin);

  if (visible.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  grid.innerHTML = visible.map(r => renderRaffleCard(r)).join('');
}

function renderRaffleCard(r) {
  const pct     = Math.round((r.sold / r.totalTickets) * 100);
  const isActive = r.status === 'active';
  const isDraft  = r.status === 'draft';
  const isFinished = r.status === 'finished';

  const statusBadge = isDraft
    ? `<span class="raffle-badge badge-draft">Próximamente</span>`
    : isFinished
    ? `<span class="raffle-badge badge-finished">Finalizada</span>`
    : `<span class="raffle-badge badge-active">Activa</span>`;

  const action = (isActive)
    ? `<a href="/raffle.html?id=${r.id}" class="btn-raffle-enter">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        PARTICIPAR
       </a>`
    : `<button class="btn-raffle-enter btn-raffle-disabled" disabled>${isFinished ? 'Finalizada' : 'Próximamente'}</button>`;

  return `
    <div class="raffle-card ${isDraft ? 'raffle-draft' : ''} ${isFinished ? 'raffle-finished' : ''}">
      <div class="raffle-card-header">
        ${statusBadge}
        <div class="raffle-price">$${r.ticketPrice.toLocaleString('es-AR')}<span>/número</span></div>
      </div>
      <div class="raffle-card-body">
        <div class="raffle-title">${r.title}</div>
        <div class="raffle-prize">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          ${r.prize}
        </div>
        ${r.prizeDescription ? `<p class="raffle-desc">${r.prizeDescription}</p>` : ''}
      </div>
      <div class="raffle-card-footer">
        <div class="raffle-progress-wrap">
          <div class="raffle-progress-bar">
            <div class="raffle-progress-fill" style="width:${pct}%"></div>
          </div>
          <div class="raffle-progress-labels">
            <span>${r.sold} vendidos</span>
            <span>${r.available} disponibles de ${r.totalTickets}</span>
          </div>
        </div>
        ${action}
      </div>
    </div>`;
}

// ── START ─────────────────────────────────────────────
init();
