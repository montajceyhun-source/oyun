// İştirakçının hansı kateqoriyalara nə qədər xərclədiyini hesablayır
// və ona uyğun bir "profil" etiketi çıxarır.

const CATEGORY_META = {
  maddi:     { label: 'Maddi / Status',   color: 'var(--gold-bright)' },
  vizual:    { label: 'Zahiri Görünüş',   color: 'var(--rose)' },
  xarakter:  { label: 'Xarakter',         color: 'var(--money-bright)' },
  temel:     { label: 'Təməl Dəyərlər',   color: '#7fa8d9' },
  romantika: { label: 'Romantika',        color: '#e08fb0' }
};

const PROFILE_LABELS = {
  maddi: 'Status yönümlü — maddi təminata önəm verdi',
  vizual: 'Zahiri görünüşə önəm verdi',
  xarakter: 'Xarakterə və şəxsiyyətə önəm verdi',
  temel: 'Təməl dəyərlərə sadiq qaldı (sədaqət, dəstək, empatiya)',
  romantika: 'Romantikaya önəm verdi'
};

function computeProfile(participant) {
  const spend = {};
  let total = 0;
  (participant.purchases || []).forEach(p => {
    const cat = p.category || 'xarakter';
    spend[cat] = (spend[cat] || 0) + p.price;
    total += p.price;
  });
  const entries = Object.keys(spend).map(cat => ({ cat, amount: spend[cat], pct: total ? Math.round((spend[cat] / total) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);
  const dominant = entries.length ? entries[0].cat : null;
  return {
    entries: entries,
    total: total,
    dominant: dominant,
    label: dominant ? PROFILE_LABELS[dominant] : 'Büdcəsinin çoxunu xərcləmədi'
  };
}

function renderProfileBars(profile) {
  if (!profile.entries.length) return '<p class="muted">Heç nə almadığı üçün profil çıxarıla bilmir.</p>';
  return `
    <div class="profile-bars">
      ${profile.entries.map(e => `
        <div class="profile-row">
          <div class="profile-row-label">${CATEGORY_META[e.cat].label}<span class="muted"> — ${e.pct}%</span></div>
          <div class="profile-bar-track"><div class="profile-bar-fill" style="width:${e.pct}%; background:${CATEGORY_META[e.cat].color}"></div></div>
        </div>`).join('')}
    </div>
    <p class="profile-tag">🏷️ ${profile.label}</p>`;
}
