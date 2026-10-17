// iPad / phone controls: a stick on the left, drag anywhere else to look, and buttons for the keys.
'use strict';
const touchUI = document.createElement('div');
touchUI.id = 'touchUI';
touchUI.innerHTML = `
  <div id="stick"><div id="knob"></div></div>
  <div id="tbtns">
    <button class="tb" data-k="c">C<small>camera</small></button>
    <button class="tb" data-k="f">F<small>vehicle</small></button>
    <button class="tb" data-k="q">Q<small>put down</small></button>
    <button class="tb" data-k="g">✊<small>grab</small></button>
    <button class="tb" data-k="r">🫠<small>flop</small></button>
    <button class="tb" data-k=" ">⤒<small>jump</small></button>
    <button class="tb main" data-k="e">E<small>use</small></button>
  </div>
  <div id="tmenu"><button class="tb sm" data-k="p">II</button><button class="tb sm" data-k="h">?</button></div>`;
document.body.appendChild(touchUI);
const tbtn = k => touchUI.querySelector(`[data-k="${k}"]`);

// buttons act like holding the key down
for (const b of touchUI.querySelectorAll('.tb')) {
  const k = b.dataset.k;
  b.addEventListener('touchstart', e => { e.preventDefault(); b.classList.add('on'); keyDown(k); }, { passive: false });
  const up = e => { e.preventDefault(); b.classList.remove('on'); keyUp(k); };
  b.addEventListener('touchend', up, { passive: false });
  b.addEventListener('touchcancel', up, { passive: false });
}

// the stick presses W/A/S/D (and Shift when pushed all the way), so it drives and flies too
const stick = $('stick'), knob = $('knob');
let stickId = null, stickC = null;
function setStick(dx, dy) {
  const R = stick.offsetWidth / 2, len = Math.hypot(dx, dy), m = Math.min(1, len / R);
  const nx = len ? dx / len * m : 0, ny = len ? dy / len * m : 0;
  knob.style.transform = `translate(${nx * R}px, ${ny * R}px)`;
  keys.w = ny < -0.35; keys.s = ny > 0.35; keys.a = nx < -0.35; keys.d = nx > 0.35;
  keys.shift = m > 0.92;
}
stick.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0], r = stick.getBoundingClientRect();
  stickId = t.identifier; stickC = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  setStick(t.clientX - stickC.x, t.clientY - stickC.y);
}, { passive: false });

// dragging on the game itself looks around
let lookId = null, lookX = 0, lookY = 0;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (lookId === null) { const t = e.changedTouches[0]; lookId = t.identifier; lookX = t.clientX; lookY = t.clientY; }
}, { passive: false });

addEventListener('touchmove', e => {
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) setStick(t.clientX - stickC.x, t.clientY - stickC.y);
    else if (t.identifier === lookId) {
      if (S.running && !S.paused) {
        P.yaw -= (t.clientX - lookX) * 0.006;
        P.pitch = clamp(P.pitch - (t.clientY - lookY) * 0.006, -1.45, 1.45);
      }
      lookX = t.clientX; lookY = t.clientY;
    }
  }
  if (S.running && e.target.closest && !e.target.closest('#overlay')) e.preventDefault();
}, { passive: false });
function touchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === stickId) { stickId = null; setStick(0, 0); keys.shift = false; }
    if (t.identifier === lookId) lookId = null;
  }
}
addEventListener('touchend', touchEnd);
addEventListener('touchcancel', touchEnd);
addEventListener('gesturestart', e => e.preventDefault());   // no pinch-zooming the page on iPads

// iPads keep sound muted until a touch, and a touch laptop may only reveal itself by being touched
addEventListener('touchstart', () => {
  if (AC && AC.state === 'suspended') AC.resume();
  if (!TOUCH) { TOUCH = true; document.documentElement.classList.add('touch'); unlock(); }
  if (CUT.on && S.running) skipCutscene();
}, { passive: true });

// only show the buttons you can use right now
setInterval(() => {
  const on = TOUCH && S.running && !S.over && !S.paused && !CUT.on;
  touchUI.style.display = on ? 'block' : 'none';
  if (!on) return;
  const walking = !S.driving && !S.flying;
  tbtn('c').style.display = walking ? 'none' : '';
  tbtn('f').style.display = S.driving && S.driving.kind === 'bus' ? '' : 'none';
  const carrying = carryingName();
  tbtn('q').style.display = S.held || carrying || (S.driving && S.driving.kind === 'bus') ? '' : 'none';
  tbtn(' ').style.display = walking ? '' : 'none';
  tbtn('r').style.display = walking && !S.held ? '' : 'none';
  tbtn('g').style.display = walking && !S.held ? '' : 'none';
  tbtn(' ').querySelector('small').textContent = carriedByName() ? 'wriggle' : 'jump';
  tbtn('q').querySelector('small').textContent = S.driving ? 'door' : 'put down';
  tbtn('e').querySelector('small').textContent = S.driving && S.driving.push ? 'let go' : S.driving || S.flying ? 'get up' : S.held || carrying ? 'throw' : 'use';
}, 150);

// try for a full screen game on touch devices (iPads allow it; it's fine if it's refused)
function goFullscreen() {
  if (!TOUCH) return;
  const el = document.documentElement, fs = el.requestFullscreen || el.webkitRequestFullscreen;
  try { const r = fs && fs.call(el); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}
