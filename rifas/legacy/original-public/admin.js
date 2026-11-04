let allRaffles = [];
let modalConfirmCb = null;

// ── INIT ──────────────────────────────────────────────
async function init() {
  const res = await fetch('/api/admin/me');
  if (!res.ok) { window.location.href = '/'; return; }
  const { user } = await res.json();
  document.getElementById('admin-welcome').innerHTML = `<strong>${user}</strong>`;
  await Promise.all([loadStats(), loadRaffles(), loadUsers()]);
}

// ── STATS ─────────────────────────────────────────────
async function loadStats() {
  const res  = await fetch('/api/admin/stats');
  const data = await res.json();
  document.getElementById('st-raffles').textContent = data.raffles;
  document.getElementById('st-active').textContent  = data.activeRaffles;
  document.getElementById('st-sold').textContent    = data.totalSold;
  document.getElementById('st-pending').textContent = data.totalPending;
  document.getElementById('st-revenue').textContent = `$${data.totalRevenue.toLocaleString('es-AR')}`;
  document.getElementById('st-users').textContent   = data.users;
}

// ── RIFAS ─────────────────────────────────────────────
async function loadRaffles() {
  const res = await fetch('/api/admin/raffles');
  allRaffles = await res.json();
  renderRafflesList();
  updateRaffleSelect();
}

function renderRafflesList() {
  const container = document.getElementById('raffles-list');
  if (allRaffles.length === 0) {
    container.innerHTML = '<div class="loading-row">No hay rifas creadas. Creá la primera con el botón de arriba.</div>';
    return;
  }
  container.innerHTML = allRaffles.map(r => {
    const statusLabel = { active: 'Activa', draft: 'Borrador', finished: 'Finalizada' }[r.status] || r.status;
    const statusClass = { active: 'badge-active', draft: 'badge-draft', finished: 'badge-finished' }[r.status] || '';
    const pct = r.totalTickets > 0 ? Math.round((r.sold / r.totalTickets) * 100) : 0;
    return `
      <div class="raffle-admin-row">
        <div class="raffle-admin-main">
          <div class="raffle-admin-info">
            <span class="raffle-admin-title">${r.title}</span>
            <span class="raffle-badge ${statusClass}" style="margin-left:.5rem">${statusLabel}</span>
          </div>
          <div class="raffle-admin-meta">
            <span>🎁 ${r.prize}</span>
            <span>💰 $${r.ticketPrice.toLocaleString('es-AR')}/nº</span>
            <span>🎟️ ${r.sold}/${r.totalTickets} vendidos</span>
            <span>💵 $${r.revenue.toLocaleString('es-AR')}</span>
          </div>
          <div class="raffle-progress-bar" style="margin-top:.5rem;height:4px">
            <div class="raffle-progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="raffle-admin-actions">
          <a href="/raffle.html?id=${r.id}" target="_blank" class="btn-table-view" title="Ver rifa">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
          <button class="btn-table-edit" onclick="openRaffleModal('${r.id}')" title="Editar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn-table-del" onclick="confirmDeleteRaffle('${r.id}', '${r.title.replace(/'/g,'\\\'')}')" title="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function updateRaffleSelect() {
  const sel = document.getElementById('ticket-raffle-select');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Seleccioná una rifa —</option>' +
    allRaffles.map(r => `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${r.title}</option>`).join('');
  if (cur) loadTicketsForRaffle(cur);
}

// ── MODAL RIFA ─────────────────────────────────────────
function openRaffleModal(id) {
  const isEdit = !!id;
  document.getElementById('raffle-modal-title').textContent = isEdit ? 'EDITAR RIFA' : 'NUEVA RIFA';
  document.getElementById('rf-submit').textContent = isEdit ? 'Guardar cambios' : 'Crear rifa';
  document.getElementById('rf-id').value = id || '';

  if (isEdit) {
    const r = allRaffles.find(x => x.id === id);
    if (!r) return;
    document.getElementById('rf-title').value  = r.title;
    document.getElementById('rf-prize').value  = r.prize;
    document.getElementById('rf-desc').value   = r.prizeDescription || '';
    document.getElementById('rf-price').value  = r.ticketPrice;
    document.getElementById('rf-total').value  = r.totalTickets;
    document.getElementById('rf-status').value = r.status;
  } else {
    document.getElementById('raffle-form').reset();
    document.getElementById('rf-status').value = 'draft';
  }
  document.getElementById('raffle-modal').classList.remove('hidden');
}
function closeRaffleModal() {
  document.getElementById('raffle-modal').classList.add('hidden');
}
document.getElementById('raffle-modal').addEventListener('click', e => {
  if (e.target === document.getElementById('raffle-modal')) closeRaffleModal();
});

async function saveRaffle(e) {
  e.preventDefault();
  const id  = document.getElementById('rf-id').value;
  const btn = document.getElementById('rf-submit');
  btn.disabled = true; btn.textContent = 'Guardando...';

  const body = {
    title:            document.getElementById('rf-title').value,
    prize:            document.getElementById('rf-prize').value,
    prizeDescription: document.getElementById('rf-desc').value,
    ticketPrice:      document.getElementById('rf-price').value,
    totalTickets:     document.getElementById('rf-total').value,
    status:           document.getElementById('rf-status').value
  };

  const url    = id ? `/api/admin/raffles/${id}` : '/api/admin/raffles';
  const method = id ? 'PUT' : 'POST';

  const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();

  btn.disabled = false;
  btn.textContent = id ? 'Guardar cambios' : 'Crear rifa';

  if (!res.ok) { showToast(data.error, 'error'); return; }

  closeRaffleModal();
  showToast(id ? 'Rifa actualizada ✓' : 'Rifa creada ✓', 'success');
  await Promise.all([loadStats(), loadRaffles()]);
}

function confirmDeleteRaffle(id, title) {
  openModal(`Eliminar rifa`, `¿Eliminar la rifa "<strong>${title}</strong>"?<br>Solo se pueden eliminar rifas sin tickets pagados.`, async () => {
    const res = await fetch(`/api/admin/raffles/${id}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    showToast('Rifa eliminada.', '');
    await Promise.all([loadStats(), loadRaffles()]);
  });
}

// ── TICKETS POR RIFA ─────────────────────────────────
async function loadTicketsForRaffle(raffleId) {
  if (!raffleId) {
    document.getElementById('tickets-mini-list').innerHTML = '<div class="loading-row">Seleccioná una rifa.</div>';
    return;
  }
  const res     = await fetch(`/api/admin/raffles/${raffleId}/tickets`);
  const tickets = await res.json();
  const entries = Object.entries(tickets).sort(([a], [b]) => parseInt(a) - parseInt(b));
  const list    = document.getElementById('tickets-mini-list');

  if (entries.length === 0) {
    list.innerHTML = '<div class="loading-row">Esta rifa no tiene tickets aún.</div>';
    return;
  }

  list.innerHTML = entries.map(([num, t]) => {
    const isPaid  = t.status === 'paid';
    const dateStr = new Date(isPaid ? t.boughtAt : t.reservedAt)
      .toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    const badge = isPaid
      ? `<span class="badge badge-paid">Pagado ✓</span>`
      : `<span class="badge badge-pending">Reservado ⏳</span>`;
    return `
      <div class="user-row" style="justify-content:space-between">
        <span style="font-family:var(--font-display);font-size:1.1rem;color:var(--gold-lt);min-width:2rem">${num}</span>
        <span style="flex:1;padding:0 .6rem">${t.owner} ${badge}</span>
        <span class="user-date" style="margin-right:.6rem">${dateStr}</span>
        <button class="btn-table-del" onclick="confirmCancelTicket('${raffleId}', ${num}, '${t.owner}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </div>`;
  }).join('');
}

function confirmCancelTicket(raffleId, num, owner) {
  openModal(`Cancelar ticket`, `¿Cancelar el número <strong>${num}</strong> de <strong>${owner}</strong>?`, async () => {
    const res = await fetch(`/api/admin/ticket/${raffleId}/${num}`, { method: 'DELETE' });
    if (!res.ok) { const d = await res.json(); showToast(d.error, 'error'); return; }
    showToast(`Número ${num} cancelado.`, '');
    await Promise.all([loadStats(), loadTicketsForRaffle(raffleId)]);
  });
}

// ── USUARIOS ──────────────────────────────────────────
async function loadUsers() {
  const res   = await fetch('/api/admin/users');
  const users = await res.json();
  const list  = document.getElementById('users-list');
  if (users.length === 0) { list.innerHTML = '<div class="loading-row">No hay usuarios.</div>'; return; }
  list.innerHTML = users.map(u => {
    const date = new Date(u.createdAt).toLocaleDateString('es-AR');
    const adminBadge = u.isAdmin ? `<span class="badge-admin">Admin</span>` : '';
    return `
      <div class="user-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M20 21c0-4-3.6-7-8-7s-8 3-8 7"/></svg>
        <span class="user-name">${u.username} ${adminBadge}</span>
        <span class="user-date">${date}</span>
      </div>`;
  }).join('');
}

// ── MODAL CONFIRMACIÓN ────────────────────────────────
function openModal(title, body, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML    = body;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').onclick = () => { closeModal(); if (onConfirm) onConfirm(); };
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
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

init();
