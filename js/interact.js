// Looking at things and pressing E: stations, luggage, passengers, vehicles. Also input and markers.
'use strict';
const raycaster = new THREE.Raycaster();
raycaster.far = 2.7;
const CENTER = new THREE.Vector2(0, 0);
const keys = {};
let mouseDown = false;

function boarding() {
  const pax = passengers.filter(p => p.state !== 'gone'), bags = items.filter(i => i.state !== 'gone' && !i.extra);
  return {
    seated: pax.filter(p => p.state === 'seated').length, pax: pax.length,
    loaded: bags.filter(i => i.state === 'free' && insideHull(i.x, i.z) && i.z > CARGO - 0.3).length, bags: bags.length,
    rampUp: ramp.target === 0 && ramp.open < 0.01, doorsShut: doors.L.open < 0.01 && doors.R.open < 0.01,
  };
}
// put someone (you or a remote player) in the captain's seat
function takeSeat(who) {
  if (who.isLocal) { S.flying = true; P.yaw = 0; P.pitch = 0.02; }
  else S.pilotRP = who;
}
function takeOff(who = LOCAL) {
  takeSeat(who);
  S.phase = 'takeoff'; S.toT = 0; S.toSpeed = 0; S.liftoff = false; S.alt = 0;
  // nobody gets left behind on the tarmac
  if (!who.isLocal && !insideHull(P.x, P.z)) { S.driving = null; Object.assign(P, { x: 0, y: 0, z: 3, vy: 0 }); }
  NET.remotes.forEach((r, i) => { if (r !== who && (r.driving || !insideHull(r.pose.x, r.pose.z))) { r.driving = null; netTeleport(r, i % 2 ? 0.3 : -0.3, 0, 2 + i * 0.6, 0); } });
  say('Throttle up! Hold W to pull up once you have enough speed.', 'good');
}

// what pressing E does on whatever the crosshair is over (null = nothing, look past it)
function actionFor(ud, who = LOCAL) {
  if (ud.busDoor) return S.phase === 'airport' ? { key: 'busdoor', type: 'press', ready: true, label: `${ud.busDoor.door.target ? 'Close' : 'Open'} the bus door`, done: () => toggleBusDoor(ud.busDoor) } : null;
  if (ud.drive) return S.phase === 'airport' ? { key: 'drive', type: 'press', ready: true, label: `Sit down and drive the ${ud.drive.name}`, done: () => enterVehicle(ud.drive, who) } : null;
  if (ud.item) {
    const it = ud.item;
    if (it.state === 'gone' || it.state === 'queue' || it.state === 'held') return null;
    return { key: 'pick', type: 'press', ready: true, label: `Pick up the ${it.name}`, done: () => pickUp(it, who) };
  }
  if (ud.passenger) {
    const p = ud.passenger;
    if (p.state === 'gone' || p.state === 'bus') return null;
    if (p.calling) return { key: 'call' + p.seat.label, type: 'press', ready: true, label: `Help ${p.name} (${p.seat.label}), who ${p.calling.text}`, done: () => resolveCall(p) };
    return { key: 'pick', type: 'press', ready: true, label: `Pick up ${p.name} ${p.face}`, done: () => pickUp(p, who) };
  }
  const st = STATIONS[ud.station];
  for (const f of S.faults) {
    const step = f.def.steps[f.step];
    if (stepAt(f, step) !== st.id) continue;
    const type = step.type || 'press';
    return {
      key: f.uid + ':' + f.step, type, dur: step.dur, ready: true, spray: step.spray,
      label: stepLabel(f, step) + (type === 'mash' ? ` (${f.mash}/${step.n})` : ''),
      mashProg: type === 'mash' ? f.mash / step.n : 0,
      done: () => advance(f),
      mash: () => { f.mash++; beep(380 + f.mash * 25, .05, 'square', .04); S.shake = Math.max(S.shake, .15); if (f.mash >= step.n) advance(f); },
    };
  }
  if (st.door) {
    const d = doors[st.door];
    return { key: 'door' + st.door, type: 'press', ready: true, label: `${d.target ? 'Close' : 'Open'} the ${sideWord(st.door)} exit door`,
      done: () => { d.target = d.target ? 0 : 1; beep(d.target ? 300 : 200, .25, 'triangle', .08); } };
  }
  if (st.lavDoor) {
    const d = lavDoors[st.lavDoor];
    return { key: 'lav' + st.lavDoor, type: 'press', ready: true, label: `${d.target ? 'Close' : 'Open'} the lavatory door`,
      done: () => { d.target = d.target ? 0 : 1; beep(d.target ? 420 : 320, .12, 'triangle', .06); } };
  }
  if (st.id === 'ramp') {
    if (S.faults.some(f => f.id === 'decomp')) return { type: 'info', label: 'Ramp controls jammed! Follow the checklist.' };
    return { key: 'ramp', type: 'press', ready: true, label: ramp.target ? 'Raise the cargo ramp' : 'Lower the cargo ramp',
      done: () => { ramp.target = ramp.target ? 0 : 1; beep(160, .6, 'sawtooth', .06); if (ramp.target && inAir()) say('The cargo ramp grinds open. Passengers scream.', 'bad'); } };
  }
  if (st.id === 'yoke') {
    if (piloted()) return { type: 'info', label: 'Someone is already flying!' };
    if (S.phase === 'airport') {
      const b = boarding(), missing = [];
      if (b.seated < b.pax) missing.push(`seat the passengers (${b.seated}/${b.pax})`);
      if (b.loaded < b.bags) missing.push(`load the bags into the cargo bay (${b.loaded}/${b.bags})`);
      if (!b.rampUp) missing.push('raise the cargo ramp');
      if (!b.doorsShut) missing.push('close the exit doors');
      if (missing.length) return { type: 'info', label: 'Not ready yet: ' + missing.join(', ') };
      return { key: 'takeoff', type: 'press', ready: true, label: '🛫 Take off!', done: () => takeOff(who) };
    }
    return { key: 'fly', type: 'press', ready: true, label: 'Take the controls', done: () => { takeSeat(who); say(`${who.name} has the controls.`); } };
  }
  if (st.id === 'hole') return null;
  if (st.service) {
    if (!inAir()) return { type: 'info', label: st.name + ' (once we\'re in the air)' };
    const sv = SERVICES[st.service], cd = S.cd[st.service];
    const why = sv.check && sv.check();
    return {
      key: 'svc' + st.service, type: sv.hold ? 'hold' : 'press', dur: sv.hold, label: sv.label(),
      ready: cd <= 0 && !why, why: why || (cd > 0 ? `${sv.name} ready in ${Math.ceil(cd)}s` : null),
      done: () => { sv.fn(); S.cd[st.service] = sv.cd; beep(880, .08, 'sine', .06); },
    };
  }
  return { type: 'info', label: st.name };
}

let lastPrompt = '';
function setPrompt(html, dim) {
  if (html !== lastPrompt) { $('prompt').innerHTML = html; lastPrompt = html; }
  $('prompt').classList.toggle('dim', !!dim);
}
function interact(dt) {
  $('holdbar').style.display = 'none';
  if (S.driving) {
    if (isClient()) { if (S.press) netSend({ t: 'exit' }); else if (S.act) netSend({ t: 'vehAct' }); else if (S.drop) netSend({ t: 'busDoor' }); }
    else if (S.press) exitVehicle();
    else if (S.act) vehicleAction(S.driving);
    else if (S.drop && S.driving.kind === 'bus') toggleBusDoor(S.driving);
    S.press = S.drop = S.act = false;
    if (!S.driving) return;
    const v = S.driving, extra = v.kind === 'truck' ? ` · ${v.slots.filter(s => s.item).length}/12 bags` : ` · ${passengers.filter(p => p.state === 'bus').length}/10 aboard`;
    setPrompt(`<kbd>W</kbd><kbd>S</kbd> drive <kbd>A</kbd><kbd>D</kbd> steer ${v.kind === 'bus' ? '<kbd>F</kbd>board / unload <kbd>Q</kbd>door ' : ''}<kbd>C</kbd>camera <kbd>E</kbd>get up${extra}`, true);
    return;
  }
  if (S.flying) {
    if (S.press && isClient()) netSend({ t: 'stand' });
    else if (S.press) { S.flying = false; S.chase = false; P.z = -10.0; P.yaw = Math.PI; say(inAir() ? 'Autopilot holding course.' : 'Autopilot is handling the takeoff.'); }
    S.press = S.drop = S.act = false;
    if (S.phase === 'takeoff' && !S.liftoff) setPrompt(S.toSpeed > 0.75 ? '<kbd>Hold W</kbd> PULL UP!' : `Speed ${Math.round(S.toSpeed * 160)} km/h… keep it straight`, S.toSpeed <= 0.75);
    else if (S.phase === 'landing') setPrompt(S.touched ? 'Braking…' : '<kbd>A</kbd><kbd>D</kbd> line up with the runway <kbd>C</kbd> camera', true);
    else setPrompt('<kbd>A</kbd><kbd>D</kbd> steer <kbd>W</kbd><kbd>S</kbd> climb/dive <kbd>C</kbd> camera <kbd>E</kbd> get up', true);
    return;
  }
  if (S.held) {
    if (isClient()) { if (S.press || S.drop) netSend({ t: 'throw', strength: S.press ? 9 : 1.2, yaw: P.yaw, pitch: P.pitch }); }
    else if (S.press) throwHeld(9);
    else if (S.drop) throwHeld(1.2);
    S.press = S.drop = S.act = false;
    if (S.held) setPrompt(`<kbd>E</kbd>throw ${S.held.kind === 'pax' ? S.held.name : 'the ' + S.held.name} <kbd>Q</kbd>put down`, true);
    return;
  }
  raycaster.setFromCamera(CENTER, camera);
  const hits = P.falling ? [] : raycaster.intersectObjects(targets, false);
  let act = null, ref = null;
  for (const h of hits) { act = actionFor(h.object.userData); if (act) { ref = h.object.userData; break; } }
  // on a client the host does the real work; here we only show the prompt and send what you did
  if (act && isClient() && act.type !== 'info') { const r = netRef(ref); act.done = () => netSend({ t: 'act', ref: r }); act.mash = () => netSend({ t: 'act', ref: r, how: 'mash' }); }
  const held = keys.e || mouseDown;
  if (!held) S.holdLock = false;
  let prog = -1;
  if (act && act.type === 'hold' && act.ready && held && !S.holdLock) {
    if (S.holdKey !== act.key) { S.holdKey = act.key; S.holdT = 0; }
    S.holdT += dt; prog = S.holdT / act.dur;
    if (act.spray) {
      camera.getWorldPosition(tmpV); camera.getWorldDirection(tmpV2);
      tmpV.addScaledVector(tmpV2, 0.5).y -= 0.3;
      smokeFx.emit(tmpV, tmpV2.multiplyScalar(7).add(new THREE.Vector3(rand(-.5, .5), rand(-.5, .5), 3)), 0xffffff, 0.25, 0.7, 4, 0.8);
    }
    if (S.holdT >= act.dur) { act.done(); S.holdKey = null; S.holdT = 0; S.holdLock = true; }
  } else { S.holdKey = null; S.holdT = 0; }
  if (S.press && act) {
    if (!act.ready && act.why) { say(act.why); beep(200, .1); }
    else if (act.type === 'press') { act.done(); S.holdLock = true; }
    else if (act.type === 'mash') act.mash();
  }
  S.press = S.drop = S.act = false;
  if (act && act.type === 'mash') prog = act.mashProg;

  let html = '', dim = false;
  if (act) {
    if (act.type === 'info') { html = act.label; dim = true; }
    else if (!act.ready) { html = act.why || act.label; dim = true; }
    else html = `<kbd>${act.type === 'hold' ? 'Hold E' : act.type === 'mash' ? 'Mash E' : 'E'}</kbd>${act.label}`;
  }
  setPrompt(html, dim);
  if (prog >= 0) { $('holdbar').style.display = 'block'; $('holdbar').firstChild.style.width = clamp(prog, 0, 1) * 100 + '%'; }
}

// ---------------------------------------------------------------- objective markers (❗ visible through walls)
const markers = [];
for (let i = 0; i < 10; i++) {
  const s = new THREE.Sprite(emojiMat('❗', true));
  s.renderOrder = 999; s.visible = false; plane.add(s); markers.push(s);
}
function updateMarkers() {
  const spots = S.faults.map(f => STATIONS[stepAt(f, f.def.steps[f.step])].mesh);
  if (crocLoose()) spots.push(items.find(i => i.alive && i.alive.kind === 'croc').g);
  if (S.phase === 'airport' && !S.driving) {
    const b = boarding();
    if (b.seated === b.pax && b.loaded === b.bags) spots.push(b.rampUp ? STATIONS.yoke.mesh : STATIONS.ramp.mesh);
  }
  let i = 0;
  for (const mesh of spots) {
    if (!mesh || i >= markers.length) continue;
    const m = markers[i++];
    mesh.getWorldPosition(tmpV); plane.worldToLocal(tmpV);
    m.position.set(tmpV.x, tmpV.y + 0.75 + Math.sin(S.t * 4) * 0.08, tmpV.z);
    const sc = 0.35 + m.position.distanceTo(camera.position) * 0.025;
    m.scale.set(sc, sc, 1); m.visible = true;
  }
  for (; i < markers.length; i++) markers[i].visible = false;
}

// ---------------------------------------------------------------- hand-held tools, attached to the camera
const handItems = {};
(function () {
  const ext = new THREE.Group();
  ext.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), M.red));
  box(0.03, 0.03, 0.15, M.dark, 0, 0.17, -0.07, ext);
  ext.rotation.x = 0.4;
  const gun = new THREE.Group();
  box(0.08, 0.1, 0.3, M.yellow, 0, 0, 0, gun); box(0.05, 0.14, 0.05, M.dark, 0, -0.1, 0.08, gun);
  for (const [k, g] of [['🧯', ext], ['🔫', gun]]) {
    g.position.set(0.34, -0.3, -0.7); g.scale.setScalar(0.6);
    g.visible = false; camera.add(g); handItems[k] = g;
  }
})();

// ---------------------------------------------------------------- input
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
  keys[k] = true;
  if (e.repeat) return;
  if (k === 'enter' && S.running && !S.over && S.paused) resume();
  if (k === 'p' && S.running && !S.over) { if (S.paused) resume(); else { showPause(); document.exitPointerLock(); } }
  if (k === 'e') S.press = true;
  if (k === 'q') S.drop = true;
  if (k === 'f') S.act = true;
  if (k === 'c' && (S.driving || S.flying)) S.chase = !S.chase;
  if (k === ' ') S.jump = true;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
// switching to another window pauses; just losing the mouse (Esc, a stray click) doesn't
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; if (S.running && !S.over) showPause(); });
const locked = () => document.pointerLockElement === canvas;
const lock = () => { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} };
canvas.addEventListener('mousedown', e => {
  if (!S.running || S.over) return;
  if (!locked()) { lock(); return; }
  if (e.button === 0) { mouseDown = true; S.press = true; }
});
addEventListener('mouseup', () => { mouseDown = false; });
addEventListener('mousemove', e => {
  if (!locked() || S.paused) return;
  P.yaw -= e.movementX * 0.0022;
  P.pitch = clamp(P.pitch - e.movementY * 0.0022, -1.45, 1.45);
});
const lockHint = document.createElement('div');
lockHint.id = 'lockHint'; lockHint.textContent = '🖱 Click to look around · P to pause';
document.body.appendChild(lockHint);
function showPause() {
  if (S.paused) return;
  S.paused = true;
  if (locked()) document.exitPointerLock();
  $('ovBox').innerHTML = '<h1>⏸ Paused</h1><p>The plane will wait for you. Probably.</p><button class="big" id="resumeBtn">Resume</button><p style="opacity:.7;font-size:13px">or press Enter / P</p>';
  $('resumeBtn').onclick = resume;
  $('overlay').style.display = 'flex';
}
function resume() { S.paused = false; $('overlay').style.display = 'none'; lock(); }
document.addEventListener('pointerlockchange', () => {
  if (locked()) { S.paused = false; $('overlay').style.display = 'none'; }
  else if (S.running && !S.over && !document.hasFocus()) showPause();
});
setInterval(() => { lockHint.style.display = S.running && !S.over && !S.paused && !locked() ? 'block' : 'none'; }, 200);
