// ============================================================
// Google Apps Script Web App URL-nizi bura yapışdırın.
// (Apps Script > Yayımla > Yeni yayım > Veb tətbiq sonrası aldığınız link)
// ============================================================
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzyy5Ms188UfNJcdgrTEkD6uohUtVdV3pUNucToHHkI4DAAbu3reDLBAfrRB5r9s4TF/exec'
};

async function apiGet(params) {
  const url = new URL(CONFIG.APPS_SCRIPT_URL);
  Object.keys(params || {}).forEach(k => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  return res.json();
}

async function apiPost(body) {
  // Qeyd: Content-Type başlığını qəsdən qoymuruq (default text/plain qalır),
  // çünki bu, brauzerin "preflight" OPTIONS sorğusu göndərməsinin qarşısını
  // alır — Google Apps Script bunu düzgün emal edə bilmir.
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return res.json();
}

function isConfigured() {
  return CONFIG.APPS_SCRIPT_URL && !CONFIG.APPS_SCRIPT_URL.startsWith('PASTE_');
}

function fmtMoney(n) {
  return Number(n).toLocaleString('az-AZ') + ' ₼';
}
