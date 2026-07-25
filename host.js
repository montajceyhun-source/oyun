const app = document.getElementById('app');
let state = {
  code: sessionStorage.getItem('host_code') || null,
  hostPassword: sessionStorage.getItem('host_pin') || '',
  game: null,
  pollTimer: null,
  actInFlight: false,
  error: null
};

// ---------------- Aparıcının otaq siyahısı (bu brauzerdə yaratdığı bütün otaqlar) ----------------
// localStorage istifadə olunur (sessionStorage yox), ona görə fərqli tab/pəncərələrdən də görünür
// və eyni anda bir neçə otağı paralel idarə etmək mümkündür.
const ROOMS_KEY = 'auksion_host_rooms';

function getRooms() {
  try { return JSON.parse(localStorage.getItem(ROOMS_KEY) || '[]'); } catch (e) { return []; }
}
function saveRooms(rooms) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}
function addRoom(code, hostPassword) {
  const rooms = getRooms().filter(r => r.code !== code);
  rooms.unshift({ code, hostPassword, createdAt: Date.now() });
  saveRooms(rooms);
}
function removeRoom(code) {
  saveRooms(getRooms().filter(r => r.code !== code));
}

function render() {
  if (!isConfigured()) {
    app.innerHTML = `
      <div class="card">
        <div class="error-box">
          <strong>Qurulum tamamlanmayıb.</strong><br/>
          <code>js/api.js</code> faylında <code>APPS_SCRIPT_URL</code> dəyərini öz Google Apps Script
          Veb Tətbiq linkinizlə əvəz edin.
        </div>
      </div>`;
    return;
  }

  if (!state.code) { renderCreateScreen(); return; }
  if (!state.game) { app.innerHTML = `<div class="card center muted">Yüklənir...</div>`; return; }

  const g = state.game;
  if (g.status === 'finished') { renderResultsScreen(g); return; }
  renderGameScreen(g);
}

function renderRoomsList() {
  const rooms = getRooms();
  if (!rooms.length) return '';
  const rows = rooms.map(r => `
    <div class="row" style="align-items:center; margin-bottom:10px">
      <div class="col" style="min-width:0">
        <strong style="font-family: var(--font-mono)">${r.code}</strong>
        ${r.hostPassword ? '<span class="badge" style="margin-left:6px">PIN qoyulub</span>' : ''}
      </div>
      <button class="btn" data-open-room="${r.code}" data-pin="${r.hostPassword || ''}">Aç</button>
      <button class="btn btn-danger" data-delete-room="${r.code}" data-pin="${r.hostPassword || ''}">Sil</button>
    </div>`).join('');
  return `
    <div class="card">
      <h2>Mövcud otaqlarınız</h2>
      ${rows}
    </div>`;
}

function renderCreateScreen() {
  app.innerHTML = `
    ${renderRoomsList()}
    <div class="card">
      <h2>Yeni otaq yarat</h2>
      <p>İştirakçı sayını seçin (6–15 nəfər/qrup dəstəklənir). İstəsəniz eyni anda bir neçə otaq paralel aça bilərsiniz.</p>
      <select id="maxP" class="field">
        <option value="6">6 iştirakçı</option>
        <option value="8">8 iştirakçı</option>
        <option value="10" selected>10 iştirakçı</option>
        <option value="12">12 iştirakçı</option>
        <option value="15">15 iştirakçı</option>
      </select>
      <input class="field" id="pinField" placeholder="Admin PIN (istəyə bağlı, otağı qorumaq üçün)" maxlength="8"/>
      <p class="muted" style="margin-top:-8px">PIN qoysanız, yalnız onu bilən şəxs auksionu idarə edə bilər. Boş buraxsanız qorunma olmayacaq.</p>
      <button class="btn btn-gold" id="createBtn" style="width:100%">Otaq yarat</button>
      ${state.error ? `<div class="error-box" style="margin-top:12px">${state.error}</div>` : ''}
    </div>`;

  document.getElementById('createBtn').onclick = async () => {
    const maxParticipants = Number(document.getElementById('maxP').value);
    const hostPassword = document.getElementById('pinField').value.trim();
    document.getElementById('createBtn').disabled = true;
    const res = await apiPost({ action: 'createGame', maxParticipants, hostPassword });
    if (res.error) { state.error = res.error; render(); return; }
    openRoom(res.game.code, hostPassword);
    addRoom(res.game.code, hostPassword);
    state.game = res.game;
    render();
  };

  app.querySelectorAll('[data-open-room]').forEach(btn => {
    btn.onclick = () => openRoom(btn.dataset.openRoom, btn.dataset.pin);
  });
  app.querySelectorAll('[data-delete-room]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Bu otaq tamamilə silinəcək (bərpa olunmayacaq). Əminsiniz?')) return;
      const code = btn.dataset.deleteRoom;
      const hostPassword = btn.dataset.pin;
      const res = await apiPost({ action: 'deleteGame', code, hostPassword });
      if (res.error) { alert(res.error); return; }
      removeRoom(code);
      render();
    };
  });
}

function openRoom(code, hostPassword) {
  state.code = code;
  state.hostPassword = hostPassword || '';
  state.error = null;
  sessionStorage.setItem('host_code', state.code);
  sessionStorage.setItem('host_pin', state.hostPassword);
  startPolling();
  render();
}

function closeRoomView() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.code = null;
  state.game = null;
  sessionStorage.removeItem('host_code');
  sessionStorage.removeItem('host_pin');
  render();
}

function renderGameScreen(g) {
  const joinLink = `${location.origin}${location.pathname.replace('host.html', 'play.html')}?code=${g.code}`;
  const lotIdx = g.currentLotIndex;
  const lot = lotIdx >= 0 ? g.lots[lotIdx] : null;
  const nextLotAvailable = lotIdx + 1 < g.lots.length;

  let lotSection = '';
  if (g.status === 'active' && lot) {
    const leader = g.participants.find(p => p.id === g.currentLeaderId);
    lotSection = `
      <div class="card lot-card">
        <span class="lot-index">LOT ${lot.index + 1} / ${g.lots.length}</span>
        <div><span class="category-badge">${CATEGORY_META[lot.category].label}</span></div>
        <h2>${lot.title}</h2>
        ${lot.note ? `<p>${lot.note}</p>` : ''}
        <div class="ticker">
          <div class="label">Hazırkı qiymət</div>
          <div class="amount">${fmtMoney(g.currentPrice)}</div>
          <div class="label">${leader ? 'Lider: ' + leader.name : 'Hələ təklif yoxdur'}</div>
        </div>
        <div class="btn-row" style="margin-top:16px">
          <button class="btn btn-gold" id="sellBtn" ${leader ? '' : 'disabled'}>✅ Satıldı! (${leader ? leader.name : '—'})</button>
          <button class="btn btn-danger" id="unsoldBtn">Alıcısız qaldı</button>
        </div>
        ${renderBidHistory(g)}
      </div>`;
  } else if (g.status === 'lobby') {
    lotSection = `
      <div class="card center">
        <h2>${lotIdx === -1 ? 'Auksiona başlamağa hazırsınız' : 'Lot ' + (lotIdx + 1) + ' satıldı'}</h2>
        <p>${nextLotAvailable ? 'Növbəti lotu başlatmaq üçün düyməyə basın.' : 'Bütün lotlar satıldı — oyunu bitirə bilərsiniz.'}</p>
        ${nextLotAvailable
          ? `<button class="btn btn-gold" id="startLotBtn">▶ ${lotIdx === -1 ? 'Auksionu başlat' : 'Növbəti lot'}</button>`
          : `<button class="btn btn-gold" id="finishBtn">🏁 Oyunu bitir və nəticələri göstər</button>`}
      </div>`;
  }

  app.innerHTML = `
    <div class="card center">
      <button class="btn" id="backToRoomsBtn" style="margin-bottom:14px">← Otaqlar siyahısına qayıt</button>
      <div class="muted">OTAQ KODU</div>
      <div class="code-display">${g.code}</div>
      <div class="muted" style="margin-top:6px">Qoşulma linki:</div>
      <div style="display:flex; gap:8px; margin-top:8px">
        <input class="field" style="margin:0" readonly value="${joinLink}" id="linkField"/>
        <button class="btn" id="copyBtn">Kopyala</button>
      </div>
    </div>

    ${lotSection}

    <div class="card">
      <h2>İştirakçılar (${g.participants.length}/${g.maxParticipants})</h2>
      ${g.participants.length === 0 ? '<p class="muted">Hələ heç kim qoşulmayıb.</p>' : renderParticipantsTable(g)}
    </div>

    <div class="card center">
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-danger" id="resetBtn">↺ Oyunu sıfırla</button>
        <button class="btn btn-danger" id="deleteBtn">🗑 Otağı ləğv et</button>
      </div>
    </div>
  `;

  document.getElementById('backToRoomsBtn').onclick = () => closeRoomView();
  document.getElementById('copyBtn').onclick = () => {
    navigator.clipboard.writeText(joinLink);
    document.getElementById('copyBtn').textContent = 'Kopyalandı ✓';
    setTimeout(() => { document.getElementById('copyBtn').textContent = 'Kopyala'; }, 1500);
  };
  const startLotBtn = document.getElementById('startLotBtn');
  if (startLotBtn) startLotBtn.onclick = () => act({ action: 'startLot', code: g.code });
  const sellBtn = document.getElementById('sellBtn');
  if (sellBtn) sellBtn.onclick = async () => { await act({ action: 'sellLot', code: g.code }); playSoldSound(); };
  const unsoldBtn = document.getElementById('unsoldBtn');
  if (unsoldBtn) unsoldBtn.onclick = () => act({ action: 'markUnsold', code: g.code });
  const finishBtn = document.getElementById('finishBtn');
  if (finishBtn) finishBtn.onclick = () => act({ action: 'finishGame', code: g.code });
  document.getElementById('resetBtn').onclick = () => {
    if (confirm('Bütün irəliləyiş silinəcək. Əminsiniz?')) act({ action: 'resetGame', code: g.code });
  };
  document.getElementById('deleteBtn').onclick = async () => {
    if (!confirm('Bu otaq tamamilə silinəcək (bərpa olunmayacaq). Əminsiniz?')) return;
    const res = await apiPost({ action: 'deleteGame', code: g.code, hostPassword: state.hostPassword });
    if (res.error) { alert(res.error); return; }
    removeRoom(g.code);
    closeRoomView();
  };
}

function renderBidHistory(g) {
  if (!g.bidHistory.length) return '<p class="muted" style="margin-top:10px">Hələ təklif yoxdur.</p>';
  const rows = [...g.bidHistory].reverse().slice(0, 6)
    .map(b => `<div class="muted">💰 <strong style="color:var(--gold-bright)">${b.name}</strong> — ${fmtMoney(b.amount)}</div>`)
    .join('');
  return `<div style="margin-top:14px">${rows}</div>`;
}

function renderParticipantsTable(g) {
  const rows = g.participants.map(p => {
    const pct = Math.max(0, Math.round((p.budget / 1000) * 100));
    return `<tr>
      <td>${p.name} ${p.id === g.currentLeaderId ? '<span class="badge leader">lider</span>' : ''}</td>
      <td>
        ${fmtMoney(p.budget)}
        <div class="wallet-bar"><div class="wallet-fill" style="width:${pct}%"></div></div>
      </td>
      <td>${p.purchases.length}</td>
    </tr>`;
  }).join('');
  return `<table>
    <tr><th>Nömrə</th><th>Qalan büdcə</th><th>Aldığı lot</th></tr>
    ${rows}
  </table>`;
}

function renderResultsScreen(g) {
  const rows = g.participants.map(p => {
    const profile = computeProfile(p);
    return `
    <div class="card">
      <h2>${p.name}</h2>
      <div class="muted">Qalan büdcə: <strong style="color:var(--money-bright)">${fmtMoney(p.budget)}</strong></div>
      ${p.purchases.length
        ? `<table><tr><th>Xüsusiyyət</th><th>Qiymət</th></tr>${p.purchases.map(pr => `<tr><td>${pr.title}</td><td>${fmtMoney(pr.price)}</td></tr>`).join('')}</table>`
        : '<p class="muted">Heç nə almadı.</p>'}
      ${renderProfileBars(profile)}
    </div>`;
  }).join('');

  app.innerHTML = `
    <div class="card center">
      <button class="btn" id="backToRoomsBtn2" style="margin-bottom:14px">← Otaqlar siyahısına qayıt</button>
      <span class="eyebrow">Yekun</span>
      <h2>Auksion bitdi</h2>
      <p>Aşağıda hər iştirakçının aldığı xüsusiyyətlər, qalan büdcəsi və xərcləmə profili var. Müzakirəyə başlaya bilərsiniz.</p>
    </div>
    ${rows}
    <div class="card center">
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-gold" id="resetBtn2">↺ Yeni oyun üçün sıfırla</button>
        <button class="btn btn-danger" id="deleteBtn2">🗑 Otağı ləğv et</button>
      </div>
    </div>
  `;
  document.getElementById('backToRoomsBtn2').onclick = () => closeRoomView();
  document.getElementById('resetBtn2').onclick = () => act({ action: 'resetGame', code: g.code });
  document.getElementById('deleteBtn2').onclick = async () => {
    if (!confirm('Bu otaq tamamilə silinəcək (bərpa olunmayacaq). Əminsiniz?')) return;
    const res = await apiPost({ action: 'deleteGame', code: g.code, hostPassword: state.hostPassword });
    if (res.error) { alert(res.error); return; }
    removeRoom(g.code);
    closeRoomView();
  };
}

async function act(payload) {
  if (state.actInFlight) return;
  state.actInFlight = true;
  const res = await apiPost({ ...payload, hostPassword: state.hostPassword });
  state.actInFlight = false;
  if (res.error) { alert(res.error); return; }
  state.game = res.game;
  render();
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (!state.code || state.actInFlight) return;
    const res = await apiGet({ action: 'state', code: state.code });
    if (res.game) { state.game = res.game; render(); }
  }, 1500);
}

(async function init() {
  if (isConfigured() && state.code) {
    const res = await apiGet({ action: 'state', code: state.code });
    if (res.game) { state.game = res.game; addRoom(state.code, state.hostPassword); startPolling(); }
    else { state.code = null; sessionStorage.removeItem('host_code'); }
  }
  render();
})();
