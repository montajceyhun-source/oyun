/**
 * SEVGİ BÜDCƏSİ AUKSIONU — Backend (Google Apps Script)
 * ------------------------------------------------------
 * Bu fayl bütün oyun məntiqini idarə edir və Google-un öz serverlərində
 * "Web App" kimi işə düşür. Frontend (Vercel-dəki sayt) bu URL-ə fetch
 * sorğuları göndərir.
 *
 * QURULUŞ:
 * 1) script.google.com üzərində yeni layihə yaradın, bu faylın içini
 *    ora yapışdırın (Code.gs faylının məzmununu tam əvəz edin).
 * 2) "Yayımla" > "Yeni yayım" > Tip: "Veb tətbiq"
 *      - İcra edən: Mən (siz)
 *      - Girişi olanlar: Hər kəs (Anyone)
 * 3) Alınan URL-i frontend-dəki api.js faylında APPS_SCRIPT_URL
 *    dəyişəninə yapışdırın.
 * 4) (İstəyə bağlı) Nəticələrin daimi qeydi üçün aşağıdakı SHEET_ID
 *    sahəsinə öz Google Sheet ID-nizi yazın. Boş saxlasanız, sadəcə
 *    o funksiya keçilir, oyun yenə də işləyir.
 */

const SHEET_ID = '1A77EPRfXTjXatUDtgx0EMOeWXb_seryBO1rsvnIAPW0'; // İstəyə bağlı: nəticələri yazmaq üçün Google Sheet ID-si

const START_BUDGET = 1000;
const BID_STEP_MIN = 10;
const LOT_DURATION_MS = 40000;      // hər lot üçün vaxt limiti (40 saniyə)
const ANTI_SNIPE_WINDOW_MS = 5000;  // son N saniyədə təklif gəlsə...
const ANTI_SNIPE_EXTEND_MS = 8000;  // ...vaxtı bu qədərə uzat

// ----- Sabit lot siyahısı (təlim materialındakı 10 xüsusiyyət) -----
// category: maddi / vizual / xarakter / temel / romantika — nəticə profilində istifadə olunur
const LOTS = [
  { title: 'Aylıq 5000+ AZN stabil gəlir', note: 'Maddi güvən!', category: 'maddi' },
  { title: 'Super yaraşıq və fit bədən quruluşu', note: 'Hər kəsin həsədlə baxacağı!', category: 'vizual' },
  { title: 'Eyni yumor hissinə sahib olmaq', note: 'Birlikdə qarın ağrıyana qədər gülmək!', category: 'xarakter' },
  { title: 'Səhvlərini qəbul edib səmimi üzr istəmə bacarığı', note: '', category: 'xarakter' },
  { title: 'Şəxsi ev və maşına sahib olmaq', note: 'Kredit yox, kirayə yox!', category: 'maddi' },
  { title: 'Çətin anlarda şərtsiz dəstək (xəstəlik, işsizlik, depressiya)', note: '', category: 'temel' },
  { title: 'Çox romantik olması', note: 'Tez-tez sürprizlər, çiçəklər, unudulmaz görüşlər', category: 'romantika' },
  { title: 'Sədaqət və dürüstlük', note: 'Heç vaxt xəyanət etməmək və yalan danışmamaq', category: 'temel' },
  { title: 'Ailənizlə və dostlarınızla mükəmməl yola getməsi', note: '', category: 'xarakter' },
  { title: 'Yüksək emosional zəka (EQ) və empatiya', note: 'Sizi dinləyib, duyğularınızı anlamaq', category: 'temel' }
].map((l, i) => ({ index: i, title: l.title, note: l.note, category: l.category, startPrice: 50, sold: false, soldTo: null, soldPrice: null }));

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'state') {
      return jsonOut(getStateForClient(e.parameter.code));
    }
    if (action === 'ping') {
      return jsonOut({ ok: true, time: new Date().toISOString() });
    }
    return jsonOut({ error: 'Naməlum action: ' + action });
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const body = JSON.parse(e.postData.contents);
    switch (body.action) {
      case 'createGame': return jsonOut(createGame(body));
      case 'joinGame': return jsonOut(joinGame(body));
      case 'startLot': return jsonOut(startLot(body));
      case 'placeBid': return jsonOut(placeBid(body));
      case 'sellLot': return jsonOut(sellLot(body));
      case 'markUnsold': return jsonOut(markUnsold(body));
      case 'finishGame': return jsonOut(finishGame(body));
      case 'resetGame': return jsonOut(resetGame(body));
      default: return jsonOut({ error: 'Naməlum action: ' + body.action });
    }
  } catch (err) {
    return jsonOut({ error: err.message });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- Storage helpers ----------------

function loadGame(code) {
  const raw = PropertiesService.getScriptProperties().getProperty('game_' + code);
  return raw ? JSON.parse(raw) : null;
}

function saveGame(game) {
  game.updatedAt = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty('game_' + game.code, JSON.stringify(game));
  return game;
}

function getStateForClient(code) {
  const game = loadGame(code);
  if (!game) return { error: 'Bu kodla oyun tapılmadı' };
  return { game: publicGame(game) };
}

// hostPassword-u iştirakçılara ötürmə (o yalnız serverdə saxlanmalıdır)
function publicGame(game) {
  const copy = JSON.parse(JSON.stringify(game));
  delete copy.hostPassword;
  return copy;
}

function checkAuth(game, body) {
  if (!game.hostPassword) return true; // PIN qoyulmayıbsa, sərbəst
  return body.hostPassword && body.hostPassword === game.hostPassword;
}

// ---------------- Game actions ----------------

function generateCode() {
  let code;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (loadGame(code));
  return code;
}

// İştirakçı ad girmir — hər kəsə avtomatik unikal random nömrə verilir
function generateParticipantName(game) {
  let name;
  do {
    name = 'İştirakçı-' + Math.floor(1000 + Math.random() * 9000);
  } while (game.participants.some(p => p.name === name));
  return name;
}

function createGame(body) {
  const code = generateCode();
  const game = {
    code: code,
    hostPassword: (body.hostPassword || '').trim() || null,
    status: 'lobby', // lobby -> active -> (lobby again between lots) -> finished
    maxParticipants: body.maxParticipants || 10,
    participants: [],
    lots: JSON.parse(JSON.stringify(LOTS)),
    currentLotIndex: -1,
    currentPrice: 0,
    currentLeaderId: null,
    lotEndsAt: null,
    bidHistory: [],
    createdAt: new Date().toISOString()
  };
  saveGame(game);
  return { game: publicGame(game) };
}

function joinGame(body) {
  const game = loadGame(body.code);
  if (!game) return { error: 'Bu kodla oyun tapılmadı' };
  if (game.participants.length >= game.maxParticipants) {
    return { error: 'Otaq doludur (maksimum ' + game.maxParticipants + ' iştirakçı)' };
  }
  const participant = {
    id: Utilities.getUuid(),
    name: generateParticipantName(game),
    budget: START_BUDGET,
    purchases: []
  };
  game.participants.push(participant);
  saveGame(game);
  return { game: publicGame(game), participantId: participant.id };
}

function startLot(body) {
  const game = loadGame(body.code);
  if (!game) return { error: 'Oyun tapılmadı' };
  if (!checkAuth(game, body)) return { error: 'Yanlış Admin PIN' };
  const next = game.currentLotIndex + 1;
  if (next >= game.lots.length) return { error: 'Bütün lotlar bitib' };
  game.currentLotIndex = next;
  game.currentPrice = game.lots[next].startPrice;
  game.currentLeaderId = null;
  game.bidHistory = [];
  game.status = 'active';
  game.lotEndsAt = Date.now() + LOT_DURATION_MS;
  saveGame(game);
  return { game: publicGame(game) };
}

function placeBid(body) {
  const game = loadGame(body.code);
  if (!game) return { error: 'Oyun tapılmadı' };
  if (game.status !== 'active') return { error: 'Hazırda aktiv lot yoxdur' };
  if (game.lotEndsAt && Date.now() > game.lotEndsAt) return { error: 'Vaxt bitib! Bu lot üçün artıq təklif qəbul olunmur.' };
  const participant = game.participants.find(p => p.id === body.participantId);
  if (!participant) return { error: 'İştirakçı tapılmadı' };
  const amount = Number(body.amount);
  if (!amount || amount < game.currentPrice + BID_STEP_MIN) {
    return { error: 'Təklif ən azı ' + (game.currentPrice + BID_STEP_MIN) + ' AZN olmalıdır' };
  }
  if (amount > participant.budget) {
    return { error: 'Büdcəniz kifayət etmir (qalıq: ' + participant.budget + ' AZN)' };
  }
  game.currentPrice = amount;
  game.currentLeaderId = participant.id;
  game.bidHistory.push({ participantId: participant.id, name: participant.name, amount: amount, time: new Date().toISOString() });

  // Anti-sniping: son anlarda təklif gəlsə, vaxtı bir az uzat
  const remaining = game.lotEndsAt - Date.now();
  if (remaining < ANTI_SNIPE_WINDOW_MS) {
    game.lotEndsAt = Date.now() + ANTI_SNIPE_EXTEND_MS;
  }

  saveGame(game);
  return { game: publicGame(game) };
}

function sellLot(body) {
  const game = loadGame(body.code);
  if (!game) return { error: 'Oyun tapılmadı' };
  if (!checkAuth(game, body)) return { error: 'Yanlış Admin PIN' };
  if (game.status !== 'active') return { error: 'Aktiv lot yoxdur' };
  const lot = game.lots[game.currentLotIndex];
  if (!game.currentLeaderId) return { error: 'Heç kim təklif verməyib. "Alıcısız qaldı" düyməsini istifadə edin.' };
  const winner = game.participants.find(p => p.id === game.currentLeaderId);
  winner.budget -= game.currentPrice;
  winner.purchases.push({ lotIndex: lot.index, title: lot.title, price: game.currentPrice, category: lot.category });
  lot.sold = true;
  lot.soldTo = winner.name;
  lot.soldPrice = game.currentPrice;
  game.status = 'lobby';
  game.lotEndsAt = null;
  saveGame(game);
  return { game: publicGame(game) };
}

function markUnsold(body) {
  const game = loadGame(body.code);
  if (!game) return { error: 'Oyun tapılmadı' };
  if (!checkAuth(game, body)) return { error: 'Yanlış Admin PIN' };
  const lot = game.lots[game.currentLotIndex];
  lot.sold = true;
  lot.soldTo = null;
  lot.soldPrice = null;
  game.status = 'lobby';
  game.lotEndsAt = null;
  saveGame(game);
  return { game: publicGame(game) };
}

function finishGame(body) {
  const game = loadGame(body.code);
  if (!game) return { error: 'Oyun tapılmadı' };
  if (!checkAuth(game, body)) return { error: 'Yanlış Admin PIN' };
  game.status = 'finished';
  saveGame(game);
  try { logResultsToSheet(game); } catch (err) { /* Sheet qoşulmayıbsa səssizcə keç */ }
  return { game: publicGame(game) };
}

function resetGame(body) {
  const game = loadGame(body.code);
  if (!game) return { error: 'Oyun tapılmadı' };
  if (!checkAuth(game, body)) return { error: 'Yanlış Admin PIN' };
  game.participants.forEach(p => { p.budget = START_BUDGET; p.purchases = []; });
  game.lots = JSON.parse(JSON.stringify(LOTS));
  game.currentLotIndex = -1;
  game.currentPrice = 0;
  game.currentLeaderId = null;
  game.lotEndsAt = null;
  game.bidHistory = [];
  game.status = 'lobby';
  saveGame(game);
  return { game: publicGame(game) };
}

// ---------------- Optional: Sheet-ə qeyd ----------------

function logResultsToSheet(game) {
  if (!SHEET_ID) return;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('Nəticələr');
  if (!sheet) {
    sheet = ss.insertSheet('Nəticələr');
    sheet.appendRow(['Tarix', 'Oyun kodu', 'İştirakçı', 'Qalan büdcə', 'Aldığı lotlar']);
  }
  game.participants.forEach(p => {
    const lotsText = p.purchases.map(pr => pr.title + ' (' + pr.price + ' AZN)').join('; ');
    sheet.appendRow([new Date(), game.code, p.name, p.budget, lotsText]);
  });
}
