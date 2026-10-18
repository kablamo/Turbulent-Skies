// Grabbing, Human Fall Flat style. Hold the left mouse button (✊ on a touch screen) and both arms reach out
// where you're looking. Whatever a hand touches, it holds on to:
//   · a luggage trolley: drag it about (or shove it) by wherever you're holding it
//   · a bag dangles from your hand, and flies off with the swing of your arm when you let go
//   · a passenger goes floppy and gets dragged along by a wrist or an ankle
//   · anything solid (a wall, a seat, the plane…) is something to hang on to: the wind can't blow you away
// The host does the moving of bags and passengers for everyone; each player only says what their hands hold.
'use strict';
const GRAB = { hands: [null, null], reach: [null, null], mode: null };   // mode: 'act' (using something) or 'grab'   // your hands: null, { k: 'item', i }, { k: 'pax', i, pt } or { k: 'wall', at: [x, y, z] }
let interactMouse = false;
canvas.addEventListener('mousedown', e => { if (e.button === 0) interactMouse = true; });   // left click is Interact
addEventListener('mouseup', e => { if (e.button === 0) interactMouse = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e => { if (e.button === 2) useHeldWeapon(); });   // right-click: use the weapon you're holding
addEventListener('blur', () => { interactMouse = false; });

const grabbing = () => S.running && !S.paused && (interactMouse || keys.grab) && GRAB.mode === 'grab' && !S.held && !carryingName() && !S.driving && !S.flying && !P.sitV
  && ME && ME.rag && !ME.rag.limp;
const holdingWall = () => GRAB.hands.some(h => h && h.k === 'wall');
const heldVehicle = () => { const h = GRAB.hands.find(h => h && h.k === 'veh'); return h ? vehicles[h.i] : null; };
const _gr = new THREE.Vector3(), _gl = new THREE.Vector3();
// turn (x, z) round the vertical axis by angle a, the same way three.js turns things (rotation.y)
const r2g = v => Math.round(v * 100) / 100;

// arms: reach out where you're looking (or stay on whatever wall they're holding)
const KW_GRAB = [0.6, 0.8, 0.8, 0.7, 0.7, 1.1, 1.1, 1, 1, 0.55, 0.55, 0.6, 0.6];   // arms pull harder when reaching and holding
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
    else if (h && h.k === 'veh') { const v = vehicles[h.i], q = vehPoint(v, h.lx, h.lz); _gr.set(q.x, h.y, q.z); }   // on the spot you grabbed
    else if (h && h.k === 'item' && items[h.i]) {
      // a bag: held out in front of your chest (clear of your body), each hand on the spot where it took hold
      const it = items[h.i], depth = h.d ?? (it.r || 0.3), fx = -Math.sin(P.face), fz = -Math.cos(P.face);
      _gl.addVectors(goal[1], goal[2]).multiplyScalar(0.5);
      const cx = _gl.x + fx * (0.32 + depth), cz = _gl.z + fz * (0.32 + depth), cy = _gl.y - 0.2;
      const [ox, oz] = turnY(h.o[0], h.o[2], P.face + h.yr);
      _gr.set(cx + ox, cy + h.o[1], cz + oz);
    }
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
      if (!['free', 'ride', 'belt', 'pile'].includes(it.state) || !it.g.visible) continue;
      _gr.copy(it.g.position); _gr.y += (it.h || 0.4) * 0.5;
      if (bagPush(it, hp.x, hp.y, hp.z, 0.2)) {   // the hand's on (or right by) any part of it
        // got it: both hands take hold, one each side. Turn it so its long side goes across in front of you
        // (a crocodile cage is carried sideways, not poking into your tummy), keeping the turn small
        const hw = it.hw || 0.25, hd = it.hd || 0.25, cur = it.g.rotation.y - P.face;
        const opts = hd > hw * 1.15 ? [Math.PI / 2, -Math.PI / 2] : [0, Math.PI];
        const yr = opts.reduce((a, b) => Math.abs(Math.atan2(Math.sin(b - cur), Math.cos(b - cur))) < Math.abs(Math.atan2(Math.sin(a - cur), Math.cos(a - cur))) ? b : a);
        const across = hd > hw * 1.15 ? hd : hw, depth = hd > hw * 1.15 ? hw : hd;   // half-sizes across you / toward you
        GRAB.hands = [-1, 1].map(s => {
          // each hand: on the side of the bag nearest you, toward its ends (as far apart as arms comfortably go)
          const wx = s * Math.min(across * 0.85, 0.32), wz = depth * 0.9;   // in your frame: x = to your right, z = toward you
          const [ox, oz] = turnY(wx, wz, -yr);                               // …in the bag's own frame
          return { k: 'item', i: j, o: [r2g(ox), 0, r2g(oz)], yr: r2g(yr), d: r2g(depth) };
        });
        break;
      }
    }
    if (GRAB.hands[i] && GRAB.hands[i].k === 'item') break;   // (both hands are on a bag now)
    // a passenger? (grab the nearest bit of them: wrist, ankle, head…)
    for (let j = 0; j < passengers.length && !got; j++) {
      const p = passengers[j];
      if (['gone', 'held', 'bus', 'inBus', 'outBus'].includes(p.state) || p.g.position.distanceTo(hp) > 2) continue;
      const pts = p.rag ? p.rag.pos : (p.netRag ? p.cliRag : ragPoints(p));
      if (!pts) continue;
      let best = -1, bd = 0.36;
      pts.forEach((v, k) => { const dd = v.distanceTo(hp); if (dd < bd) { bd = dd; best = k; } });
      if (best >= 0) got = { k: 'pax', i: j, pt: best };
    }
    // a luggage trolley? (anywhere on it: the handle, the sides, the bed; the hand stops at its edge, so it
    // counts if the hand's right by it, or it's what the hand was reaching into)
    const t0 = GRAB.reach[i];
    for (const v of trolleys) {
      if (got || S.phase !== 'airport') break;
      const l = vehLocal(v, hp.x, hp.z), lt = t0 ? vehLocal(v, t0.x, t0.z) : l;
      const near = (q, pad) => Math.abs(q.x) < v.w + pad && Math.abs(q.z) < v.l + pad;
      if ((near(l, 0.3) || near(lt, 0.05)) && hp.y > v.bedTop - 0.4 && hp.y < GROUND + 1.5)
      {
        const other = GRAB.hands[1 - i], [rx2, rz2] = turnY(v.x - P.x, v.z - P.z, -P.face);
        got = { k: 'veh', i: vehicles.indexOf(v), lx: r2g(l.x), lz: r2g(l.z), y: r2g(hp.y),   // (exactly where the hand touched it)
          rel: other && other.k === 'veh' && other.i === vehicles.indexOf(v) ? other.rel : [r2g(rx2), r2g(rz2), r2g(v.h - P.face)] };
      }
    }
    // something solid? (the hand's pushed into a wall, a seat, a vehicle…; the floor doesn't count)
    // (the hand stops at the surface, so: is the spot it's reaching for inside something?)
    const t = GRAB.reach[i], wy = P.y + 0.6;
    if (!got && t && hp.distanceTo(t) < 0.6 && (!canGo(P.x, P.z, wy, hp.x, hp.z) || !canGo(P.x, P.z, wy, t.x, t.z))) got = { k: 'wall', at: hp.toArray().map(v => Math.round(v * 100) / 100) };
    if (got) { GRAB.hands[i] = got; beep(got.k === 'wall' ? 260 : 420, .06, 'triangle', .04); }
    if (GRAB.hands[i] && GRAB.hands[i].k === 'item' && GRAB.hands[1 - i] && GRAB.hands[1 - i].k === 'item') { beep(420, .06, 'triangle', .04); break; }
  }
  // hands on a wall stay put there
  Rg.ignoreVeh = heldVehicle();
  Rg.pins = GRAB.hands.map((h, i) => h && h.k === 'wall' ? { i: 5 + i, pos: new THREE.Vector3().fromArray(h.at) } : null).filter(Boolean);
}

// host: move whatever each player is holding to their hands; let things go (with a fling) when they let go
function hostGrabs(dt) {
  for (const who of [LOCAL, ...NET.remotes]) {
    const grabs = who.isLocal ? GRAB.hands : (who.grab || [null, null]);
    const flat = who.isLocal ? null : who.rg;
    const hand = h => who.isLocal ? (ME && ME.rag ? ME.rag.pos[5 + h].clone() : null) : flat ? new THREE.Vector3(flat[(5 + h) * 3], flat[(5 + h) * 3 + 1], flat[(5 + h) * 3 + 2]) : null;
    who.gPrev = who.gPrev || [null, null];
    // their body's points (so whoever they're holding doesn't go through them)
    let body = null;
    if (who.isLocal) body = ME && ME.rag ? ME.rag.pos : null;
    else if (flat && flat.length >= 39) {
      body = who.bodyPts = who.bodyPts || Array.from({ length: 13 }, () => new THREE.Vector3());
      body.forEach((v, k) => v.set(flat[k * 3], flat[k * 3 + 1], flat[k * 3 + 2]));
    }
    for (let h = 0; h < 2; h++) {
      const cur = grabs[h], was = who.gPrev[h], hp = hand(h);
      const same = cur && was && cur.k === was.k && cur.i === was.i;
      if (was && !same) letGo(was);
      who.gPrev[h] = cur && cur.k !== 'wall' ? cur : null;
      if (!cur || cur.k === 'wall' || !hp) continue;
      if (cur.k === 'item') {
        const o = grabs[1 - h], two = o && o.k === 'item' && o.i === cur.i;
        if (two && h === 1) continue;
        holdItem(items[cur.i], two ? [[hp, cur], [hand(1 - h), o]] : [[hp, cur]], bodyYaw(who), dt);
      }
      else if (cur.k === 'veh') {
        const o = grabs[1 - h]; if (o && o.k === 'veh' && o.i === cur.i && h === 1) continue;
        const v = vehicles[cur.i], pz = who.isLocal ? P : who.pose, pose = carriedVehiclePose(cur, pz.x, pz.z, bodyYaw(who));
        if (v && vehicleFits(v, pose.x, pose.z, pose.h)) { v.x = pose.x; v.z = pose.z; v.h = pose.h; syncVehicle(v); }
      }
      else holdPassenger(passengers[cur.i], cur.pt, hp, `${idOf(who)}${h}`, body);
    }
  }
}
// where a held trolley goes: wherever it was relative to you when you took hold of it
function carriedVehiclePose(g, x, z, face) {
  const [dx, dz] = turnY(g.rel[0], g.rel[1], face);
  return { x: x + dx, z: z + dz, h: face + g.rel[2] };
}
// a held bag goes wherever puts the spots you're holding it by right in your hands
function holdItem(it, held, face, dt) {
  if (!it || it.state === 'gone') return;
  if (it.state === 'ride') freeSlot(it);
  if (it.state !== 'grabbed') { it.state = 'grabbed'; it.g.visible = true; }
  // it turns with you (so a big thing never swings round into you), held by the spots your hands are on
  let cx = 0, cy = 0, cz = 0;
  const yaw = face + held[0][1].yr;
  for (const [hp, g] of held) { if (!hp) continue; const [ox, oz] = turnY(g.o[0], g.o[2], yaw); cx += hp.x - ox; cy += hp.y - g.o[1]; cz += hp.z - oz; }
  const n = held.filter(h => h[0]).length || 1;
  const x = cx / n, y = cy / n - (it.h || 0.4) * 0.5, z = cz / n;
  it.g.rotation.set(0, yaw, 0); it.spinY = yaw;
  it.vx = (x - it.x) / Math.max(dt, 1e-3); it.vy = (y - it.y) / Math.max(dt, 1e-3); it.vz = (z - it.z) / Math.max(dt, 1e-3);
  it.x = x; it.y = y; it.z = z;
  it.g.position.set(x, y, z);
}
function holdPassenger(p, pt, hp, key, body) {
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
  p.rag.pins.push({ key, i: pt, pos: hp.clone(), body });
}
function letGo(g) {
  if (g.k === 'item') {
    const it = items[g.i]; if (!it || it.state !== 'grabbed') return;
    it.state = 'free';
    cargoLetGo(it); if (it.state !== 'free') return;   // (balloons float off, popper crates pop, nukes arm…)
    // let go of a bag over a luggage trolley (gently): it goes on the trolley
    const v = S.phase === 'airport' && Math.hypot(it.vx, it.vz) < 3 && trolleyNear(it.x, it.z, 0.35);
    if (v) { const slot = trolleySpot(v, it); if (slot) { slot.item = it; it.slot = slot; it.state = 'ride'; beep(380, .08, 'triangle', .05); } else say(trolleyFullMsg(v, it), 'bad'); }
  }
  else if (g.k === 'pax') { const p = passengers[g.i]; if (p && p.rag && p.rag.pins) p.rag.pins = []; }
}
