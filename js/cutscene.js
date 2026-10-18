// The opening cutscene: three random camera shots around the airport with silly captions, then a title card.
// It's different every time: it rolls its own dice (not the room's seeded Math.random, which has to stay in
// step between players) and it only plays on your own screen. Space / Enter / click / tap skips it.
'use strict';
const cutRand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const cutPick = a => a[Math.floor(cutRand() * a.length)];
const cutShuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(cutRand() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const SHOT_T = 3.6, TITLE_T = 3.2;
const G_ = GROUND;

// each shot: the camera glides from `from` to `to`, looking at `look` (or from `look` to `look2`)
const SHOTS = [
  { name: 'aerial', from: [-75, 34, -55], to: [60, 24, -38], look: [0, 0, 8], fov: 60,
    lines: ['Gate 404. Where flights go to be found… eventually.', 'Behold: the pride of the fleet. The fleet is one plane.', 'This plane is older than the pilot. And the pilot\'s parents.'] },
  { name: 'terminal', from: [9, G_ + 3.2, TERM.z1 - 1.5], to: [-8, G_ + 2.4, TERM.z1 - 1.8], look: [0, G_ + 1, TERM.z0 + 5],
    lines: ['The passengers have no idea what they signed up for.', 'Somebody packed a crocodile. Nobody will admit it.', 'Eight brave souls. Ten suspicious bags.'] },
  { name: 'bbq', from: [-BBQ_X - 5, 3.8, 9], to: [-BBQ_X + 3, 2.8, 6], look: [-BBQ_X, 1.6, 0.2],
    lines: ['New this season: a barbecue. On the wing. At 3,000 metres.', 'The airline calls this "premium outdoor dining".', 'Health and safety said no. We did it anyway.'] },
  { name: 'runway', from: [3, G_ + 0.4, -40], to: [-2, G_ + 2.2, -19], look: [0, 1.2, -6], fov: 55,
    lines: ['The runway is long. The checklist is short.', 'Pre-flight inspection: complete. (We looked at it.)', 'Nothing could possibly go wrong. Nothing at all.'] },
  { name: 'ramp', from: [5, 2.2, 36], to: [-1, 0.6, 25], look: [0, -0.4, 12],
    lines: ['The cargo ramp: for luggage, crocodiles and the occasional passenger.', 'Please keep your hands inside the plane. And your moose.', 'The back door works most of the time.'] },
  { name: 'tower', from: [-41, G_ + 31, 74], to: [-40, G_ + 30.5, 72], look: [0, 0, 10], look2: [2, 0, 4], fov: 42,
    lines: ['Air traffic control has gone home early.', 'Tower to Flight 404: good luck. You\'ll need it.', 'The tower has one rule: don\'t look at Flight 404.'] },
  { name: 'belt', from: [BELT_X, G_ + 1.5, BELT_START - 1], to: [BELT_X, G_ + 1.5, BELT_END + 4], look: [BELT_X, G_ + 0.6, BELT_END - 6],
    lines: ['Your luggage is on its way. All of it. Including the tuba.', 'Baggage handling is self-service today. You\'re the self.', 'Something in that suitcase just moved.'] },
  { name: 'engine', from: [ENG_X + 4.5, 0.8, -15], to: [ENG_X - 3, 0.2, -13.5], look: [ENG_X, ENG_Y, PROP_Z], fov: 58,
    lines: ['Engine check: it spins. Mostly.', 'Two propellers. One of them is held on with tape.', 'The mechanic says it\'s fine. The mechanic is a dog.'] },
  { name: 'duck', orbit: { c: [5, G_ + 1.6, TERM.z0 + 10.5], r: 4, y: G_ + 2.2, a0: 0.5, a1: 2.2 },
    lines: ['Gary the duck has seen things. Terrible things.', 'The airport mascot, Gary, wishes you a pleasant flight.', 'All flights must be approved by Gary.'] },
];
const OPENERS = ['Somewhere, a very old propeller plane is about to make a very bad decision.', 'Today\'s forecast: sunny, with a 90% chance of things falling off.',
  'Flight 404 to Gate 808. Probability of arriving in one piece: lol.', 'It was a beautiful day for flying. That was about to change.'];
const EPISODES = ['The One With The Duck', 'Wings & Things', 'Snakes On A Plane (It\'s A Crocodile)', 'Fasten Your Seatbelts (Seriously)', 'Mile High Barbecue',
  'The Moose Is Loose', 'Please Stop Throwing The Passengers', 'Turbulence: The Musical', 'Delayed Again', 'Captain\'s Log: Everything Is Fine', 'Baggage Claim Of Doom', 'Who Let The Chicken Fly'];

// a seagull that sometimes wanders into shot
const gull = new THREE.Group(); gull.visible = false; scene.add(gull);
(() => {
  const w = std(0xf4f4f4), body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), w); body.scale.set(0.8, 0.7, 1.6); gull.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), w); head.position.set(0, 0.12, -0.38); gull.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.18, 6), std(0xffa31a)); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.1, -0.55); gull.add(beak);
  gull.wings = [-1, 1].map(s => { const h = new THREE.Group(); h.position.x = s * 0.15; gull.add(h); box(0.9, 0.03, 0.35, std(0xbfc6cc), s * 0.45, 0, 0, h); return h; });
})();

const CUT = { on: false, t: 0, shots: [], gullShot: -1, roll: 0 };
const cutUI = document.createElement('div');
cutUI.id = 'cut';
cutUI.innerHTML = '<div class="bar top"></div><div class="bar bot"></div><div id="cutCap"></div><div id="cutTitle"></div><div id="cutSkip">Space / click / tap to skip ▸</div>';
document.body.appendChild(cutUI);

function startCutscene() {
  const picks = cutShuffle(SHOTS).slice(0, 3);
  CUT.shots = picks.map((sh, i) => ({ ...sh, line: i === 0 && cutRand() < 0.6 ? cutPick(OPENERS) : cutPick(sh.lines), roll: cutRand() < 0.3 ? (cutRand() < 0.5 ? -1 : 1) * 0.1 : 0, speed: 0.7 + cutRand() * 0.6 }));
  CUT.gullShot = cutRand() < 0.6 ? Math.floor(cutRand() * 3) : -1;
  CUT.episode = cutPick(EPISODES);
  CUT.on = true; CUT.t = 0; CUT.shown = -1;
  cutUI.style.display = 'block'; $('cutTitle').style.opacity = 0;
  $('hud').style.display = 'none';
}
function skipCutscene() { if (CUT.on) endCutscene(); }
function endCutscene() {
  CUT.on = false; gull.visible = false;
  cutUI.style.display = 'none';
  camera.fov = 72; camera.updateProjectionMatrix();
  $('hud').style.display = '';
  sayLocal('Welcome to Gate 404! Your passengers are waiting in here, and their bags are piled up by the conveyor. Grab them (left mouse) and get 12 into the cargo bay!', 'good');
}
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3();
// runs after the normal update each frame and takes over the camera
function updateCutscene(dt) {
  CUT.t += dt;
  const n = CUT.shots.length, i = Math.min(n - 1, Math.floor(CUT.t / SHOT_T));
  if (CUT.t > n * SHOT_T + TITLE_T) return endCutscene();
  const inTitle = CUT.t > n * SHOT_T;
  const sh = CUT.shots[i], k = inTitle ? 1 : ease(clamp((CUT.t - i * SHOT_T) / SHOT_T * sh.speed + (1 - sh.speed) / 2, 0, 1));
  if (!inTitle && CUT.shown !== i) {
    CUT.shown = i;
    const cap = $('cutCap'); cap.textContent = sh.line; cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
    sweep(220 + i * 80, 520 + i * 80, 0.35, 'sine', 0.025);
    gull.visible = false;
  }
  // camera
  if (sh.orbit) {
    const o = sh.orbit, a = o.a0 + (o.a1 - o.a0) * k;
    camera.position.set(o.c[0] + Math.cos(a) * o.r, o.y, o.c[2] + Math.sin(a) * o.r);
    camera.lookAt(o.c[0], o.c[1], o.c[2]);
  } else {
    camera.position.set(...sh.from).lerp(_a.set(...sh.to), k);
    const L = sh.look2 ? _b.set(...sh.look).lerp(_a.set(...sh.look2), k) : _b.set(...sh.look);
    camera.lookAt(L);
  }
  camera.rotateZ(sh.roll);
  const fov = sh.fov || 70;
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  // a seagull flaps across the frame
  if (i === CUT.gullShot) {
    if (!gull.visible) {
      camera.updateMatrixWorld(true);
      camera.getWorldDirection(_fw); _rt.crossVectors(_fw, camera.up).normalize();
      const c = camera.getWorldPosition(_a).clone();
      gull.from = c.clone().addScaledVector(_fw, 7).addScaledVector(_rt, -9).add(new THREE.Vector3(0, 0.8, 0));
      gull.to = c.clone().addScaledVector(_fw, 6).addScaledVector(_rt, 9).add(new THREE.Vector3(0, 2.2, 0));
      gull.visible = true; gull.t0 = CUT.t; quack();
    }
    const f = clamp((CUT.t - gull.t0) / (SHOT_T * 0.8), 0, 1);
    gull.position.copy(gull.from).lerp(gull.to, f);
    gull.lookAt(_b.copy(gull.position).add(_a.copy(gull.to).sub(gull.from)));
    gull.rotateY(Math.PI);
    gull.wings.forEach((w, j) => { w.rotation.z = (j ? -1 : 1) * Math.sin(CUT.t * 18) * 0.6; });
  }
  // title card at the end
  if (inTitle && CUT.shown !== 'title') {
    CUT.shown = 'title';
    $('cutCap').classList.remove('in');
    $('cutTitle').innerHTML = `<div class="big">✈ TURBULENT SKIES</div><div class="ep">Episode: “${CUT.episode}”</div><div class="who">Starring Captain ${NET.name.replace(/[<>&]/g, '')}</div>`;
    $('cutTitle').style.opacity = 1;
    chime();
  }
}

// ---------------------------------------------------------------- the ending cutscenes
// After the last landing or the last disaster, before the score: a short film of how it went.
//   crash: the plane shudders and smokes, noses over into a spinning dive, and hits the sea (or the runway) in
//          a fireball; then a title card.
//   survive: the camera circles the plane at Gate 808, the cargo ramp drops, fireworks; then a title card.
// It plays on everyone's screen (from the host's 'over' event). Space / click / tap skips to the score.
const END = { on: false };
const cutFlash = document.createElement('div');
cutFlash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none';
cutUI.appendChild(cutFlash);
const CRASH_LINES = {
  apart: ['Flight 404 is shedding parts faster than it can lose them.', 'The plane is now more of a suggestion than a plane.', 'Somewhere, a bolt lets go. Then all the other bolts.'],
  empty: ['With nobody left on board, Flight 404 loses the will to fly.', 'An empty plane. A lonely captain. A very long way down.', 'The last passenger waves from their parachute.'],
  mutiny: ['The passengers have taken over. Nobody knows how to fly.', 'From inside the lavatory, the captain hears the engines stop.', '"Does anyone know what this button does?"'],
};
const IMPACT_LINES = ['The airline would like to remind you that this was a simulation.', 'Flight 404 has arrived. Just not at Gate 808.', 'Good news: the barbecue survived.', 'The black box only recorded screaming. And a duck.'];
const LAND_LINES = { smooth: ['Butter. Smooth. Landing.', 'Not a single cup of coffee spilled.'], bumpy: ['A bit bumpy, but everyone\'s still in one piece.', 'The wheels are fine. Mostly.'], off: ['Technically, the grass counts as a runway.', 'The airport would like its fence back.'] };
const CHEER_LINES = ['The passengers applaud. A few of them are crying.', 'Somebody kisses the tarmac. Then the pilot.', 'Gary the duck approves.', 'The crocodile leaves a five-star review.'];

function playEnding(end, done) {
  if (END.on) return;
  plane.updateMatrixWorld(true);
  scene.attach(camera);                                    // (the camera stays put while the plane goes)
  Object.assign(END, { on: true, t: 0, end, done, shown: -1, boom: false, next: 0, debris: [], ramp0: ramp.pivot.rotation.x,
    p0: plane.position.clone(), r0: plane.rotation.clone(), cam0: camera.position.clone() });
  CUT.on = false; gull.visible = false;
  $('hud').style.display = 'none'; $('overlay').style.display = 'none';
  cutUI.style.display = 'block'; $('cutTitle').style.opacity = 0; $('cutCap').classList.remove('in');
  camera.fov = 60; camera.updateProjectionMatrix();
  if (!end.won) {
    // where it comes down: the destination's runway if it's in sight, otherwise the sea, not far below
    if (airport2.visible) END.gy = airport2.position.y + GROUND;
    else if (airport.visible && airport.position.y + GROUND > END.p0.y - 80) END.gy = airport.position.y + GROUND;
    else { END.gy = END.p0.y - 70; ocean.position.y = END.gy; ocean.visible = true; END.sea = true; }
    END.fall = Math.max(6, END.p0.y - END.gy - 2);
    END.T1 = 1.8; END.T2 = 4.6;
    END.camA = new THREE.Vector3(END.p0.x + 30, END.p0.y + 6, END.p0.z - 8);
  }
}
function endCaption(text) { const cap = $('cutCap'); cap.textContent = text; cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in'); }
function endTitle(big, ep) {
  $('cutCap').classList.remove('in');
  $('cutTitle').innerHTML = `<div class="big">${big}</div><div class="ep">${ep}</div><div class="who">Starring Captain ${NET.name.replace(/[<>&]/g, '')}</div>`;
  $('cutTitle').style.opacity = 1;
}
function finishEnding() {
  if (!END.on || END.t < 0.4) return;
  END.on = false;
  cutUI.style.display = 'none'; $('cutTitle').style.opacity = 0; cutFlash.style.opacity = 0;
  for (const d of END.debris) scene.remove(d.m);
  END.done();
}
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();
function updateEnding(dt) {
  END.t += dt;
  const t = END.t;
  cutFlash.style.opacity = Math.max(0, (parseFloat(cutFlash.style.opacity) || 0) - dt * 1.5);
  if (END.end.won) endSurvive(t, dt); else endCrash(t, dt);
}
// --- crash
function endCrash(t, dt) {
  const E = END, kind = CRASH_LINES[E.end.kind] ? E.end.kind : 'apart';
  if (E.shown < 0) { E.shown = 0; endCaption(cutPick(CRASH_LINES[kind])); beep(300, .4, 'sawtooth', .06); setTimeout(() => beep(240, .5, 'sawtooth', .06), 350); }
  const smoke = (n, fire) => {
    for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
      emitLocal(smokeFx, s * ENG_X, ENG_Y + 0.6, ENG_Z, cutRand() * 4 - 2, 2 + cutRand() * 3, 18 + cutRand() * 10, 0x333333, 2, 1.6, 3, 0.7);
      if (fire) emitLocal(fireFx, s * ENG_X, ENG_Y + 0.6, ENG_Z, cutRand() * 4 - 2, cutRand() * 3, 12 + cutRand() * 8, cutPick([0xffaa22, 0xff5511]), 1.4, 0.5, 2);
    }
  };
  if (t < E.T1) {
    // trouble: shuddering, smoke pouring from both engines
    const k = t / E.T1;
    plane.position.set(E.p0.x + (cutRand() - 0.5) * 0.3 * k, E.p0.y + (cutRand() - 0.5) * 0.3 * k, E.p0.z);
    plane.rotation.set(E.r0.x, E.r0.y, E.r0.z + Math.sin(t * 9) * 0.06 * k);
    plane.updateMatrixWorld(true);
    smoke(1, t > E.T1 * 0.5);
    camera.position.copy(E.camA);
  } else if (t < E.T2) {
    // over she goes: nose down, spinning, faster and faster
    const u = (t - E.T1) / (E.T2 - E.T1);
    plane.position.set(E.p0.x + 6 * u, E.p0.y - E.fall * u * u, E.p0.z - 55 * u);
    plane.rotation.set(E.r0.x - 0.95 * ease(Math.min(1, u * 1.4)), E.r0.y, E.r0.z + 3.2 * u * u);
    plane.updateMatrixWorld(true);
    smoke(2, true);
    if (!E.whistle) { E.whistle = true; sweep(900, 200, E.T2 - E.T1, 'sine', 0.05); }
    camera.position.lerpVectors(E.camA, _e1.set(E.p0.x + 34, E.gy + 14, E.p0.z - 40), ease(u));
  } else {
    if (!E.boom) {
      // impact
      E.boom = true; plane.visible = false;
      const I = E.I = plane.position.clone(); I.y = E.gy + 1;
      for (let i = 0; i < 160; i++) fireFx.emit(I, _e1.set(cutRand() * 30 - 15, 4 + cutRand() * 22, cutRand() * 30 - 15), cutPick([0xffaa22, 0xff5511, 0xffee88, 0xff3300]), 2 + cutRand() * 3, 0.8 + cutRand() * 1.2, 3);
      for (let i = 0; i < 120; i++) smokeFx.emit(I, _e1.set(cutRand() * 14 - 7, 3 + cutRand() * 10, cutRand() * 14 - 7), 0x2a2a2a, 3, 3 + cutRand() * 2, 4, 0.85);
      if (E.sea) for (let i = 0; i < 120; i++) smokeFx.emit(I, _e1.set(cutRand() * 20 - 10, 10 + cutRand() * 22, cutRand() * 20 - 10), 0xeaf6ff, 1.8, 1.6 + cutRand(), 2.5, 0.9);
      // bits of plane flying everywhere
      for (let i = 0; i < 22; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.3 + cutRand() * 1.4, 0.1 + cutRand() * 0.4, 0.3 + cutRand() * 1.6), cutPick([M.white || M.grey, M.grey, M.dark, M.red]));
        m.position.copy(I); scene.add(m);
        E.debris.push({ m, v: new THREE.Vector3(cutRand() * 36 - 18, 8 + cutRand() * 24, cutRand() * 36 - 18), s: new THREE.Vector3(cutRand() * 10, cutRand() * 10, cutRand() * 10) });
      }
      cutFlash.style.opacity = 1;
      beep(55, 1.6, 'sawtooth', 0.2); sweep(260, 40, 1.4, 'square', 0.12);
      setTimeout(() => beep(80, 0.8, 'sawtooth', 0.12), 250);
      E.camB = camera.position.clone();
      setTimeout(() => { if (END.on) endCaption(cutPick(IMPACT_LINES)); }, 600);
    }
    const a = t - E.T2, I = E.I;
    // smoke keeps rising; the fire dies down
    if (cutRand() < Math.max(0.15, 1 - a * 0.25)) smokeFx.emit(I, _e1.set(cutRand() * 4 - 2, 5 + cutRand() * 4, cutRand() * 4 - 2), 0x333333, 3, 3, 4, 0.7);
    if (cutRand() < Math.max(0, 0.8 - a * 0.2)) fireFx.emit(I, _e1.set(cutRand() * 6 - 3, 2 + cutRand() * 5, cutRand() * 6 - 3), cutPick([0xff7722, 0xffaa22]), 2, 0.7, 2);
    for (const d of E.debris) {
      d.v.y -= 18 * dt; d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < E.gy) { d.m.position.y = E.gy; d.v.multiplyScalar(E.sea ? 0 : 0.4); d.v.y = Math.abs(d.v.y) * 0.3; }
      d.m.rotation.x += d.s.x * dt; d.m.rotation.y += d.s.y * dt; d.m.rotation.z += d.s.z * dt;
    }
    // the camera drifts in for a look (with a shake right after the bang)
    const sh = Math.max(0, 1 - a * 1.5) * 1.2;
    camera.position.lerpVectors(E.camB, _e1.set(I.x + 22, E.gy + 9, I.z + 26), ease(Math.min(1, a / 4)));
    camera.position.x += (cutRand() - 0.5) * sh; camera.position.y += (cutRand() - 0.5) * sh;
    if (a > 2.6 && E.shown < 2) { E.shown = 2; endTitle('💥 THE END', 'Flight 404 never made it to Gate 808'); }
    if (a > 6) finishEnding();
  }
  camera.lookAt(E.boom ? _e2.copy(E.I).setY(E.gy + 3) : plane.position);
}
// --- survive
function endSurvive(t, dt) {
  const E = END;
  if (E.shown < 0) { E.shown = 0; endCaption(cutPick(LAND_LINES[E.end.q] || LAND_LINES.bumpy)); chime(); }
  const c = plane.localToWorld(_e2.set(0, 1, 2));
  const a = 2.4 + t * 0.21;   // (from in front, round the right-hand side)
  camera.position.set(c.x + Math.sin(a) * 34, c.y + 5, c.z + Math.cos(a) * 34);
  camera.lookAt(_e1.set(c.x, c.y + 5, c.z));
  // the cargo ramp drops
  if (t > 1) ramp.pivot.rotation.x = E.ramp0 + (RAMP_OPEN - E.ramp0) * ease(Math.min(1, (t - 1) / 2));
  // fireworks
  if (t > 1.4 && t > E.next && t < 9) {
    E.next = t + 0.45 + cutRand() * 0.35;
    const p = _e1.set(c.x + cutRand() * 44 - 22, c.y + 9 + cutRand() * 9, c.z + cutRand() * 36 - 24), col = cutPick([0xff4466, 0xffd34a, 0x44ddff, 0x66ff66, 0xcc66ff, 0xffffff]);
    for (let i = 0; i < 55; i++) {
      const th = cutRand() * Math.PI * 2, ph = Math.acos(cutRand() * 2 - 1), sp = 9 + cutRand() * 4;
      fireFx.emit(p, _e2.set(Math.sin(ph) * Math.cos(th) * sp, Math.cos(ph) * sp, Math.sin(ph) * Math.sin(th) * sp), col, 1.1, 1.1 + cutRand() * 0.5, 0.5);
    }
    beep(120 + cutRand() * 80, 0.25, 'triangle', 0.07); setTimeout(() => beep(1400 + cutRand() * 600, 0.05, 'square', 0.03), 90);
  }
  if (t > 3.3 && E.shown < 1) { E.shown = 1; endCaption(cutPick(CHEER_LINES)); }
  if (t > 6.4 && E.shown < 2) { E.shown = 2; endTitle('🛬 YOU SURVIVED!', 'Flight 404 has landed at Gate 808'); chime(); }
  if (t > 10.5) finishEnding();
}
