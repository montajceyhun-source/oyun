// Web Audio API ilə sintez olunan qısa səslər — xarici fayl lazım deyil.
function beep(freq, duration, type, vol) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = window.__auksionCtx || (window.__auksionCtx = new Ctx());
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq || 440;
    g.gain.value = vol || 0.25;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (duration || 100) / 1000);
    o.stop(ctx.currentTime + (duration || 100) / 1000 + 0.03);
  } catch (e) { /* audio dəstəklənmirsə səssizcə keç */ }
}

function vibrate(pattern) {
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
}

function playBidSound() { beep(660, 90, 'triangle', 0.22); vibrate(15); }
function playLeaderSound() { beep(784, 110, 'triangle', 0.28); setTimeout(() => beep(988, 140, 'triangle', 0.28), 100); vibrate([10, 30, 15]); }
function playOutbidSound() { beep(220, 160, 'sawtooth', 0.18); vibrate(40); }
function playSoldSound() {
  beep(523, 100, 'square', 0.3);
  setTimeout(() => beep(392, 100, 'square', 0.3), 110);
  setTimeout(() => beep(659, 260, 'square', 0.34), 220);
  vibrate([30, 40, 30, 40, 90]);
}
function playUrgentSound() { beep(300, 90, 'square', 0.2); vibrate(20); }
