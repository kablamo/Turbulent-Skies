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
  { name: 'bbq', from: [-BBQ_X - 5, 2.8, 12], to: [-BBQ_X + 3, 1.9, 8], look: [-BBQ_X, 1, 2.6],
    lines: ['New this season: a barbecue. On the wing. At 3,000 metres.', 'The airline calls this "premium outdoor dining".', 'Health and safety said no. We did it anyway.'] },
  { name: 'runway', from: [3, G_ + 0.4, -40], to: [-2, G_ + 2.2, -17], look: [0, 1.2, -6], fov: 55,
    lines: ['The runway is long. The checklist is short.', 'Pre-flight inspection: complete. (We looked at it.)', 'Nothing could possibly go wrong. Nothing at all.'] },
  { name: 'ramp', from: [5, 3.2, 34], to: [-1, 1.6, 21], look: [0, 0.6, 8],
    lines: ['The cargo ramp: for luggage, crocodiles and the occasional passenger.', 'Please keep your hands inside the plane. And your moose.', 'The back door works most of the time.'] },
  { name: 'tower', from: [-41, G_ + 31, 74], to: [-40, G_ + 30.5, 72], look: [0, 0, 10], look2: [2, 0, 4], fov: 42,
    lines: ['Air traffic control has gone home early.', 'Tower to Flight 404: good luck. You\'ll need it.', 'The tower has one rule: don\'t look at Flight 404.'] },
  { name: 'belt', from: [BELT_X, G_ + 1.5, BELT_START - 1], to: [BELT_X, G_ + 1.5, BELT_END + 4], look: [BELT_X, G_ + 0.6, BELT_END - 6],
    lines: ['Your luggage is on its way. All of it. Including the tuba.', 'Baggage handling is self-service today. You\'re the self.', 'Something in that suitcase just moved.'] },
  { name: 'engine', from: [ENG_X + 3, 1.8, -6], to: [ENG_X - 2.5, 1.5, -5], look: [ENG_X, 1.2, -1.6], fov: 58,
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
  sayLocal('Welcome to Gate 404! Your passengers are waiting in here, and their bags are coming out on the conveyor.', 'good');
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
