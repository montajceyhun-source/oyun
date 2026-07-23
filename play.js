const app = document.getElementById('app');
const urlCode = new URLSearchParams(location.search).get('code') || '';
let state = {
  code: sessionStorage.getItem('play_code') || urlCode,
  participantId: sessionStorage.getItem('play_pid') || null,
  game: null,
  pollTimer: null,
  tickTimer: null,
  prevLeaderId: undefined, // undefined = hələ bilinmir (ilk yükləmədə səs çalınmasın)
  error: null
};

function render() {
  if (!isConfigured()) {
    app.innerHTML = `<div class="card error-box">Aparıcı hələ tətbiqi qurmayıb (APPS_SCRIPT_URL boşdur).</div>`;
    return;
  }
  if (!state.participantId) { renderJoinScreen(); return; }
  if (!state.game) { app.innerHTML = `<div class="card center muted">Yüklənir...</div>`; return; }

  const g = state.game;
  const me = g.participants.find(p => p.id === state.participantId);
  if (!me) { renderJoinScreen('Otaq sıfırlanıb, yenidən qoşulun.'); return; }

  if (g.status === 'finished') { renderResultsScreen(g, me); return; }
  if (g.status === 'active') { renderActiveLot(g, me); return; }
  renderWaiting(g, me);
}

function renderJoinScreen(forceMsg) {
  app.innerHTML = `
    <div class="card">
      <h2>Otağa qoşul</h2>
      <input class="field" id="codeField" placeholder="Otaq kodu (4 rəqəm)" value="${state.code || ''}" maxlength="4" inputmode="numeric"/>
      <input class="field" id="nameField" placeholder="Adınız" maxlength="24"/>
      <button class="btn btn-gold" id="joinBtn" style="width:100%">Qoşul</button>
      ${(forceMsg || state.error) ? `<div class="error-box" style="margin-top:12px">${forceMsg || state.error}</div>` : ''}
    </div>`;
  document.getElementById('joinBtn').onclick = async () => {
    const code = document.getElementById('codeField').value.trim();
    const name = document.getElementById('nameField').value.trim();
    if (!code || !name) { state.error = 'Kod və ad daxil edin'; render(); return; }
    document.getElementById('joinBtn').disabled = true;
    const res = await apiPost({ action: 'joinGame', code, name });
    if (res.error) { state.error = res.error; render(); return; }
    state.code = code;
    state.participantId = res.participantId;
    state.game = res.game;
    state.prevLeaderId = res.game.currentLeaderId;
    sessionStorage.setItem('play_code', code);
    sessionStorage.setItem('play_pid', res.participantId);
    startPolling();
    render();
  };
}

function renderWaiting(g, me) {
  const lastLot = g.currentLotIndex >= 0 ? g.lots[g.currentLotIndex] : null;
  app.innerHTML = `
    ${renderWalletCard(me)}
    <div class="card center">
      ${lastLot
        ? `<h2>Lot satıldı: ${lastLot.title}</h2><p class="muted">${lastLot.soldTo ? lastLot.soldTo + ' aldı — ' + fmtMoney(lastLot.soldPrice) : 'Alıcısız qaldı'}</p><p>Növbəti lot gözlənilir...</p>`
        : `<h2>Auksion tezliklə başlayacaq</h2><p>Aparıcı ilk lotu elan edəndə burda görünəcək. Hazır olun!</p>`}
    </div>
    <div class="card">
      <h2>İştirakçılar</h2>
      <table><tr><th>Ad</th><th>Büdcə</th></tr>
      ${g.participants.map(p => `<tr><td>${p.name}${p.id===me.id?' <span class="badge you">siz</span>':''}</td><td>${fmtMoney(p.budget)}</td></tr>`).join('')}
      </table>
    </div>`;
}

function renderActiveLot(g, me) {
  const leader = g.participants.find(p => p.id === g.currentLeaderId);
  const isLeader = leader && leader.id === me.id;
  const minBid = g.currentPrice + 10;
  const quickAmounts = [10, 50, 100].map(step => g.currentPrice + step);
  const affordable = amt => amt <= me.budget;
  const lot = g.lots[g.currentLotIndex];

  app.innerHTML = `
    ${renderWalletCard(me)}
    <div class="card lot-card">
      <span class="lot-index">LOT ${g.currentLotIndex + 1} / ${g.lots.length}</span>
      <div><span class="category-badge">${CATEGORY_META[lot.category].label}</span></div>
      <h2>${lot.title}</h2>
      ${lot.note ? `<p>${lot.note}</p>` : ''}
      <div class="ticker">
        <div class="label">Hazırkı qiymət &middot; <span id="timerText" class="timer">--</span></div>
        <div class="amount">${fmtMoney(g.currentPrice)}</div>
        <div class="label">${leader ? (isLeader ? 'Siz liderisiniz! 🏆' : leader.name + ' öndədir') : 'Hələ təklif yoxdur — ilk siz olun'}</div>
      </div>

      <div class="btn-row" style="margin-top:16px">
        ${quickAmounts.map(amt => `<button class="btn" data-amt="${amt}" ${affordable(amt) ? '' : 'disabled'}>+${amt - g.currentPrice} (${fmtMoney(amt)})</button>`).join('')}
      </div>
      <div class="row" style="margin-top:12px">
        <input class="field col" style="margin:0" type="number" id="customAmt" placeholder="Öz məbləğiniz (min ${minBid})" min="${minBid}" max="${me.budget}"/>
        <button class="btn btn-gold" id="customBtn">Təklif et</button>
      </div>
      ${me.budget < minBid ? '<p class="error-box">Büdcəniz bu lot üçün minimum artırıma çatmır.</p>' : ''}
    </div>`;

  app.querySelectorAll('[data-amt]').forEach(btn => {
    btn.onclick = () => bid(Number(btn.dataset.amt));
  });
  document.getElementById('customBtn').onclick = () => {
    const val = Number(document.getElementById('customAmt').value);
    if (!val) return;
    bid(val);
  };

  startTicker(g);
}

function renderWalletCard(me) {
  const pct = Math.max(0, Math.round((me.budget / 1000) * 100));
  return `
    <div class="card">
      <div class="muted">SİZİN BÜDCƏNİZ — ${me.name}</div>
      <div class="ticker" style="margin-top:8px">
        <div class="amount" style="font-size:32px">${fmtMoney(me.budget)}</div>
        <div class="wallet-bar"><div class="wallet-fill" style="width:${pct}%"></div></div>
        <div class="label">${me.purchases.length} lot alınıb</div>
      </div>
    </div>`;
}

function renderResultsScreen(g, me) {
  const profile = computeProfile(me);
  app.innerHTML = `
    <div class="card center">
      <span class="eyebrow">Yekun</span>
      <h2>Auksion bitdi</h2>
    </div>
    <div class="card">
      <h2>${me.name}</h2>
      <p class="muted">Qalan büdcə: <strong style="color:var(--money-bright)">${fmtMoney(me.budget)}</strong></p>
      ${me.purchases.length
        ? `<table><tr><th>Xüsusiyyət</th><th>Qiymət</th></tr>${me.purchases.map(pr => `<tr><td>${pr.title}</td><td>${fmtMoney(pr.price)}</td></tr>`).join('')}</table>`
        : '<p class="muted">Heç nə almadınız.</p>'}
      ${renderProfileBars(profile)}
    </div>
    <div class="card">
      <h2>Hamının nəticəsi</h2>
      ${g.participants.map(p => `
        <div style="margin-bottom:10px">
          <strong>${p.name}</strong> — ${fmtMoney(p.budget)} qaldı
          ${p.purchases.length ? '<div class="muted">' + p.purchases.map(pr=>pr.title).join(', ') + '</div>' : ''}
        </div>`).join('')}
    </div>`;
}

async function bid(amount) {
  const res = await apiPost({ action: 'placeBid', code: state.code, participantId: state.participantId, amount });
  if (res.error) { alert(res.error); return; }
  state.game = res.game;
  state.prevLeaderId = res.game.currentLeaderId;
  if (res.game.currentLeaderId === state.participantId) playLeaderSound(); else playBidSound();
  render();
}

function startPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (!state.code) return;
    const res = await apiGet({ action: 'state', code: state.code });
    if (!res.game) return;

    // Bizdən başqası öndə oldusa (əvvəl biz lider idiksə) — "outbid" səsi
    if (res.game.status === 'active' && state.prevLeaderId === state.participantId
        && res.game.currentLeaderId && res.game.currentLeaderId !== state.participantId) {
      playOutbidSound();
    }
    state.prevLeaderId = res.game.currentLeaderId;
    state.game = res.game;
    render();
  }, 1500);
}

// Lokal saniyə göstəricisi
function startTicker(g) {
  if (state.tickTimer) clearInterval(state.tickTimer);
  if (g.status !== 'active' || !g.lotEndsAt) return;
  const el = () => document.getElementById('timerText');
  let urgentPlayed = false;
  const tick = () => {
    const target = el();
    if (!target) { clearInterval(state.tickTimer); return; }
    const secsLeft = Math.max(0, Math.ceil((g.lotEndsAt - Date.now()) / 1000));
    target.textContent = secsLeft + 's';
    const urgent = secsLeft <= 5;
    target.classList.toggle('urgent', urgent);
    if (urgent && secsLeft > 0 && !urgentPlayed) { urgentPlayed = true; playUrgentSound(); }
    if (secsLeft <= 0) clearInterval(state.tickTimer);
  };
  tick();
  state.tickTimer = setInterval(tick, 250);
}

(async function init() {
  if (isConfigured() && state.code && state.participantId) {
    const res = await apiGet({ action: 'state', code: state.code });
    if (res.game) { state.game = res.game; state.prevLeaderId = res.game.currentLeaderId; startPolling(); }
    else { state.participantId = null; sessionStorage.removeItem('play_pid'); }
  }
  render();
})();
