// Grabbing, Human Fall Flat style. Hold G (or the right mouse button) and both arms reach out where you're
// looking. Whatever a hand touches, it holds on to:
//   · a bag dangles from your hand, and flies off with the swing of your arm when you let go
//   · a passenger goes floppy and gets dragged along by a wrist or an ankle
//   · anything solid (a wall, a seat, the plane…) is something to hang on to: the wind can't blow you away
// The host does the moving of bags and passengers for everyone; each player only says what their hands hold.
'use strict';
const GRAB = { hands: [null, null], reach: [null, null] };   // your hands: null, { k: 'item', i }, { k: 'pax', i, pt } or { k: 'wall', at: [x, y, z] }
let rightMouse = false;
canvas.addEventListener('mousedown', e => { if (e.button === 2) rightMouse = true; });
addEventListener('mouseup', e => { if (e.button === 2) rightMouse = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { rightMouse = false; });

const grabbing = () => S.running && !S.paused && (keys.g || rightMouse) && !S.held && !carryingName() && !S.driving && !S.flying && !P.sitV
  && ME && ME.rag && !ME.rag.limp;
const holdingWall = () => GRAB.hands.some(h => h && h.k === 'wall');
const _gr = new THREE.Vector3(), _gl = new THREE.Vector3();

// arms: reach out where you're looking (or stay on whatever wall they're holding)
const KW_GRAB = [0.6, 0.8, 0.8, 0.5, 0.5, 0.65, 0.65, 1, 1, 0.55, 0.55, 0.6, 0.6];   // arms pull harder when reaching
const _gq = new THREE.Quaternion(), _gax = new THREE.Vector3(), _gp = new THREE.Vector3();
function reachHands(goal) {
  if (!grabbing()) { ME.kwOverride = null; return; }
  ME.kwOverride = KW_GRAB;
  const d = lookDir(P), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  // reaching down: bend forward at the hips and dip the knees, so your hands can get to the floor
  const down = clamp(-P.pitch, 0, 1.3);
  if (down > 0.05) {
    _gp.addVectors(goal[7], goal[8]).multiplyScalar(0.5);
    _gq.setFromAxisAngle(_gax.set(rx, 0, rz), -down * 0.95);
    for (const k of [0, 1, 2, 3, 4, 5, 6]) goal[k].sub(_gp).applyQuaternion(_gq).add(_gp);
    for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8]) goal[k].y -= down * 0.12;
  }
  for (let i = 0; i < 2; i++) {
    const h = GRAB.hands[i], s = i ? 1 : -1;
    if (h && h.k === 'wall') _gr.fromArray(h.at);
    else _gr.copy(goal[1 + i]).addScaledVector(d, 0.62).add(_gl.set(rx * s * 0.08, -0.05, rz * s * 0.08));
    goal[5 + i].copy(_gr);
    GRAB.reach[i] = (GRAB.reach[i] || new THREE.Vector3()).copy(_gr);
    goal[3 + i].lerpVectors(goal[1 + i], _gr, 0.5).y -= 0.06;   // elbow about halfway, a touch low
  }
}

// after the physics: what are the hands touching? (your own screen decides; the host does the moving)
function updateGrab() {
  if (!grabbing()) { GRAB.hands = [null, null]; if (ME && ME.rag) ME.rag.pins = null; return; }
  const Rg = ME.rag;
  for (let i = 0; i < 2; i++) {
    if (GRAB.hands[i]) continue;
    const hp = Rg.pos[5 + i];
    let got = null;
    // a bag?
    for (let j = 0; j < items.length && !got; j++) {
      const it = items[j];
      if (!['free', 'ride', 'belt'].includes(it.state) || !it.g.visible) continue;
      _gr.copy(it.g.position); _gr.y += (it.h || 0.4) * 0.5;
      if (_gr.distanceTo(hp) < (it.r || 0.3) + 0.2) got = { k: 'item', i: j };
    }
    // a passenger? (grab the nearest bit of them: wrist, ankle, head…)
    for (let j = 0; j < passengers.length && !got; j++) {
      const p = passengers[j];
      if (['gone', 'held', 'bus', 'inBus', 'outBus'].includes(p.state) || p.g.position.distanceTo(hp) > 2) continue;
      const pts = p.rag ? p.rag.pos : (p.netRag ? p.cliRag : ragPoints(p));
      if (!pts) continue;
      let best = -1, bd = 0.3;
      pts.forEach((v, k) => { const dd = v.distanceTo(hp); if (dd < bd) { bd = dd; best = k; } });
      if (best >= 0) got = { k: 'pax', i: j, pt: best };
    }
    // something solid? (the hand's pushed into a wall, a seat, a vehicle…)
    // (the hand stops at the surface, so: is the spot it's reaching for inside something?)
    const t = GRAB.reach[i];
    if (!got && t && hp.distanceTo(t) < 0.6 && (!canGo(P.x, P.z, hp.y, hp.x, hp.z) || !canGo(P.x, P.z, t.y, t.x, t.z))) got = { k: 'wall', at: hp.toArray().map(v => Math.round(v * 100) / 100) };
    if (got) { GRAB.hands[i] = got; beep(got.k === 'wall' ? 260 : 420, .06, 'triangle', .04); }
  }
  // hands on a wall stay put there
  Rg.pins = GRAB.hands.map((h, i) => h && h.k === 'wall' ? { i: 5 + i, pos: new THREE.Vector3().fromArray(h.at) } : null).filter(Boolean);
}

// host: move whatever each player is holding to their hands; let things go (with a fling) when they let go
function hostGrabs(dt) {
  for (const who of [LOCAL, ...NET.remotes]) {
    const grabs = who.isLocal ? GRAB.hands : (who.grab || [null, null]);
    const flat = who.isLocal ? null : who.rg;
    const hand = h => who.isLocal ? (ME && ME.rag ? ME.rag.pos[5 + h] : null) : flat ? new THREE.Vector3(flat[(5 + h) * 3], flat[(5 + h) * 3 + 1], flat[(5 + h) * 3 + 2]) : null;
    who.gPrev = who.gPrev || [null, null];
    for (let h = 0; h < 2; h++) {
      const cur = grabs[h], was = who.gPrev[h], hp = hand(h);
      const same = cur && was && cur.k === was.k && cur.i === was.i;
      if (was && !same) letGo(was);
      who.gPrev[h] = cur && cur.k !== 'wall' ? cur : null;
      if (!cur || cur.k === 'wall' || !hp) continue;
      if (cur.k === 'item') holdItem(items[cur.i], hp, dt);
      else holdPassenger(passengers[cur.i], cur.pt, hp, `${idOf(who)}${h}`);
    }
  }
}
function holdItem(it, hp, dt) {
  if (!it || it.state === 'gone') return;
  if (it.state === 'ride') freeSlot(it);
  if (it.state !== 'grabbed') { it.state = 'grabbed'; it.g.visible = true; }
  const x = hp.x, y = hp.y - (it.h || 0.4) * 0.6, z = hp.z;
  it.vx = (x - it.x) / Math.max(dt, 1e-3); it.vy = (y - it.y) / Math.max(dt, 1e-3); it.vz = (z - it.z) / Math.max(dt, 1e-3);
  it.x = x; it.y = y; it.z = z;
  it.g.position.set(x, y, z);
}
function holdPassenger(p, pt, hp, key) {
  if (!p || p.state === 'gone') return;
  if (!p.rag || p.state === 'down' || p.state === 'getup') {
    // grabbed: out of their seat (or wherever they were) and floppy
    if (p.seat) { p.seat.occupant = null; p.seat = null; }
    if (p.busSeat) { p.busSeat.p = null; p.busSeat = null; }
    p.calling = null; p.next = null; p.rageT = 0;
    if (!p.rag) { ragdoll(p, 0, 0, 0); shout(p, pick(YELLS.picked)); }
    p.state = 'air'; p.rag.targets = null; p.rag.k = 0;
  }
  p.rag.pins = (p.rag.pins || []).filter(q => q.key !== key);
  p.rag.pins.push({ key, i: pt, pos: hp.clone() });
}
function letGo(g) {
  if (g.k === 'item') { const it = items[g.i]; if (it && it.state === 'grabbed') it.state = 'free'; }
  else if (g.k === 'pax') { const p = passengers[g.i]; if (p && p.rag && p.rag.pins) p.rag.pins = []; }
}
