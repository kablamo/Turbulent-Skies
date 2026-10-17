// The fun cargo, and what it does (what it looks like is in people.js, in BAGS). Grab any of it with the left
// mouse; press E on the ones that do something:
//   🏖 beach ball: walk into it to kick it; it bounces and rolls          📻 boombox: E plays a tune; people near cheer up
//   🎈 balloons: hold them and you go floaty; let go and they float away  🍕 pizza: E shares a slice with everyone near
//   🐱 cat: squeezes out of its carrier eventually; E to pet it (calming) 🎁 mystery box: E to open… who knows?
//   🎉 party popper crate: throw it (hard) for confetti                    ☢ nuke: E presses the button. Five seconds. Run.
// The host decides what happens; the looks and sounds (music, confetti, the boom) play on everyone's screen.
'use strict';
const CONFETTI = [0xff3b3b, 0xffd400, 0x2f7bff, 0x2fd16b, 0xff66cc, 0xffffff];
function burstConfetti(x, y, z, n = 70) {
  for (let i = 0; i < n; i++) emitLocal(smokeFx, x, y, z, rand(-3.5, 3.5), rand(2, 7), rand(-3.5, 3.5), pick(CONFETTI), rand(0.08, 0.16), rand(1.2, 2.2), 0, 1);
  sweep(500, 1500, 0.3, 'square', 0.05);
}
// people near a spot cheer (and a cheerful cabin is a less bored cabin)
function cheer(x, z, rad, lines) {
  for (const p of passengers) if (p.state !== 'gone' && Math.hypot(p.x - x, p.z - z) < rad && Math.random() < 0.7) shout(p, pick(lines || ['WOOO!', 'Yay!', 'Party!', '🎉🎉🎉']), 2.5);
  if (inAir()) S.needs.bored = Math.min(100, S.needs.bored + 12);
}
function confetti(x, y, z, n) { netEvent('confetti', r2(x), r2(y), r2(z)); burstConfetti(x, y, z, n); cheer(x, z, 6); }

// ---- E on cargo: what it does (or null if it doesn't do anything)
function cargoUse(it) {
  const k = it.type;
  if (k === BAGS.boombox) return { label: it.on ? 'switch the boombox off' : 'switch the boombox on', done: () => {
    it.on = !it.on; beep(it.on ? 660 : 330, .08, 'square', .05);
    if (it.on) cheer(it.x, it.z, 8, ['Tunes!', 'I love this song!', '🎶', 'Turn it up!']);
  } };
  if (k === BAGS.pizza && (it.slices ?? 3) > 0) return { label: 'share a slice of pizza', done: () => sharePizza(it) };
  if (k === BAGS.mystery && !it.opened) return { label: 'open the mystery box', done: () => openMystery(it) };
  if (k === BAGS.cat && !it.caged) return { label: 'pet the cat', done: () => petCat(it) };
  if (k === BAGS.nuke && !it.armed) return { label: 'press the big red button', done: () => armNuke(it) };
  return null;
}
function sharePizza(it) {
  it.slices = (it.slices ?? 3) - 1;
  const fed = passengers.filter(p => p.state !== 'gone' && Math.hypot(p.x - it.x, p.z - it.z) < 4.5);
  fed.forEach(p => shout(p, pick(['Yum!', 'PIZZA!', 'Is there pineapple on this?', 'Best flight ever.', 'Nom nom nom']), 2.5));
  if (inAir()) S.needs.hunger = Math.min(100, S.needs.hunger + 20);
  it.g.userData.slices.forEach((b, n) => { b.visible = n < it.slices; });
  beep(520, .1, 'triangle', .05);
  say(it.slices ? `🍕 Pizza for ${fed.length || 'nobody'}! (${it.slices} slice${it.slices > 1 ? 's' : ''} left)` : '🍕 That was the last slice. Just an empty box now.', 'good');
}
function openMystery(it) {
  it.opened = true; it.outcome = Math.floor(Math.random() * 4);
  const ud = it.g.userData; ud.lid.visible = false;
  const x = it.x, y = it.y + 0.4, z = it.z;
  if (it.outcome === 0) { confetti(x, y, z); say('🎁 It was full of confetti!', 'good'); }
  else if (it.outcome === 1) {
    ud.snake.visible = true; boing();
    say('🎁 A SPRING SNAKE! Classic.');
    for (const p of passengers) if (p.state !== 'gone' && Math.hypot(p.x - x, p.z - z) < 4) shout(p, pick(['AAAH! SNAKE!', 'Not again!', 'Who packed THAT?']), 2.5);
  }
  else if (it.outcome === 2) { quack(); setTimeout(quack, 250); say('🎁 A rubber chicken. It squeaks. That\'s all it does.'); }
  else say('🎁 It\'s empty. Of course it is.');
}
function petCat(it) {
  sweep(700, 480, 0.35, 'sine', 0.05);
  say(pick(['🐱 Purrrrr.', '🐱 The cat allows it. Briefly.', '🐱 Mrrrow.']), 'good');
  if (inAir()) S.needs.calm = Math.min(100, S.needs.calm + 8);
  cheer(it.x, it.z, 4, ['Awww!', 'KITTY!', 'Can I hold it?']);
}

// ---- the nuke
function armNuke(it) {
  if (it.armed) return;
  it.armed = S.t;
  say('☢ The nuke is ARMED! 5… 4… RUN!', 'bad');
  for (const p of passengers) if (p.state !== 'gone' && Math.hypot(p.x - it.x, p.z - it.z) < 22) shout(p, pick(['WHY WOULD YOU DO THAT?!', 'RUUUUN!', 'I KNEW this flight was cursed!', 'MOMMY!']), 3);
}
// the boom itself, as everyone sees it
function nukeLooks(x, y, z) {
  S.flash = 1.2; S.shake = 3;
  for (let i = 0; i < 220; i++) emitLocal(fireFx, x, y, z, rand(-24, 24), rand(-2, 24), rand(-24, 24), pick([0xffffff, 0xffee88, 0xffaa22, 0xff5511]), rand(1.5, 3.5), rand(0.5, 1.4), 2.5);
  // a mushroom cloud: a stalk going up, and a big round top
  for (let i = 0; i < 70; i++) emitLocal(smokeFx, x + rand(-0.8, 0.8), y + rand(0, 2), z + rand(-0.8, 0.8), rand(-0.6, 0.6), rand(5, 9), rand(-0.6, 0.6), pick([0x777777, 0x555555, 0x997755]), rand(2, 3.5), rand(2.5, 4), 2, 0.9);
  for (let i = 0; i < 70; i++) { const a = rand(0, 6.3); emitLocal(smokeFx, x, y + 10, z, Math.cos(a) * rand(2, 6), rand(4, 7), Math.sin(a) * rand(2, 6), pick([0x888888, 0x666666, 0xaa8866]), rand(3, 5), rand(3, 5), 2.5, 0.85); }
  beep(38, 2.8, 'sawtooth', 0.25); setTimeout(() => sweep(120, 30, 2.0, 'square', 0.12), 120);
}
function nukeBoom(it) {
  const holder = it.holder || null;
  const x = it.x, y = it.y + 0.4, z = it.z;
  netEvent('nuke', r2(x), r2(y), r2(z));
  nukeLooks(x, y, z);
  it.state = 'gone'; it.g.visible = false; it.armed = 0;
  if (holder) { holder.held = null; it.holder = null; }
  const away = (px, pz, power) => { const dx = px - x, dz = pz - z, d = Math.hypot(dx, dz) || 1, k = power * Math.max(0, 1 - d / 22); return { vx: dx / d * k, vz: dz / d * k, up: k * 0.7, k }; };
  // everyone nearby goes flying (seatbelts or not)
  for (const p of passengers) {
    if (p.state === 'gone' || Math.hypot(p.x - x, p.z - z) > 22) continue;
    if (p.seat) { p.seat.occupant = null; p.seat = null; }
    if (p.busSeat) { p.busSeat.p = null; p.busSeat = null; }
    if (p.state === 'held' && p.holder) { p.holder.held = null; p.holder = null; }
    p.calling = null; p.next = null;
    const a = away(p.x, p.z, 16); ragdoll(p, a.vx, a.up + 3, a.vz);
  }
  // luggage everywhere
  for (const o of items) {
    if (o === it || o.state === 'gone' || o.state === 'queue' || Math.hypot(o.x - x, o.z - z) > 22) continue;
    if (o.state === 'ride') freeSlot(o);
    if (o.state === 'held' && o.holder) { o.holder.held = null; o.holder = null; }
    const a = away(o.x, o.z, 14); o.state = 'free'; o.vx = a.vx; o.vz = a.vz; o.vy = a.up + 2;
  }
  // vehicles skid away; players get launched
  if (S.phase === 'airport') for (const v of vehicles) { const a = away(v.x, v.z, 2.5); if (a.k > 0) for (let n = 0; n < 6; n++) shoveVehicle(v, a.vx / 6, a.vz / 6); }
  for (const w of [LOCAL, ...NET.remotes]) {
    const pz = w.isLocal ? P : w.pose; if (Math.hypot(pz.x - x, pz.z - z) > 22) continue;
    const a = away(pz.x, pz.z, 14), v = { x: a.vx, y: a.up + 4, z: a.vz };
    if (w.isLocal) launchMe(v); else if (w.conn && w.conn.open) w.conn.send({ t: 'launch', x: v.x, y: v.y, z: v.z });
  }
  // and inside the plane in mid-air… that's going to leave a mark
  if (inAir() && insideHull(x, z)) { S.integrity -= 40; S.needs.calm -= 40; jerk(3); say('☢ KABOOM! The plane is… mostly still here. (−40% hull)', 'bad'); }
  else say('☢ KABOOM!!! (Everybody\'s fine. Somehow.)', 'bad');
}

// ---- every frame, on everyone's screen: music, the nuke's beeping, and the cat's tail
const TUNE = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 988, 784, 659, 587];
function cargoTick(dt) {
  for (const it of items) {
    if (it.state === 'gone') continue;
    const near = Math.max(0, 1 - Math.hypot(it.x - P.x, it.z - P.z) / 18);
    if (it.type === BAGS.boombox && it.on && near > 0 && (it.noteT = (it.noteT || 0) - dt) <= 0) {
      it.noteT = 0.2; it.note = ((it.note || 0) + 1) % TUNE.length;
      beep(TUNE[it.note], 0.17, 'square', 0.03 * near);
      if (it.note % 4 === 0) beep(TUNE[it.note] / 4, 0.3, 'triangle', 0.04 * near);   // a bit of bass
    }
    if (it.type === BAGS.nuke && it.armed) {
      const left = 5 - (S.t - it.armed);
      if ((it.beepT = (it.beepT || 0) - dt) <= 0) { it.beepT = Math.max(0.07, 0.55 * left / 5); beep(1200, 0.06, 'square', 0.06); }
      const flash = Math.sin(S.t * 30) > 0 ? 0xff0000 : 0x330000;
      it.g.userData.button.material.emissive.setHex(flash); if (nukeTrolley.button) nukeTrolley.button.material.emissive.setHex(flash);
    }
    if (it.type === BAGS.cat && !it.caged && it.g.userData.tail) it.g.userData.tail.rotation.y = Math.sin(S.t * 4 + it.phase) * 0.6;
  }
}
// ---- the host's side: bouncing, floating off, the countdown, and what people make of it all
function cargoHost(dt) {
  for (const it of items) {
    if (it.state === 'gone') continue;
    const k = it.type;
    // the beach ball bounces (and the others land with a thud)
    if (k.bouncy && it.state === 'free') { if (it.vy === 0 && (it.prevVy || 0) < -1.5) { it.vy = -it.prevVy * 0.75; it.y += 0.01; } it.prevVy = it.vy; }
    // let go of the balloons and up they go
    if (it.state === 'float') {
      it.floatT = (it.floatT || 0) + dt; it.y += dt * 1.4; it.x += Math.sin(S.t + it.phase) * dt * 0.4;
      it.g.position.set(it.x, it.y, it.z);
      if (it.floatT > 12) { it.state = 'gone'; it.g.visible = false; }
    }
    if (k === BAGS.nuke && it.armed && S.t - it.armed >= 5) nukeBoom(it);
    if (it.state === 'auto') autoLoadFly(it, dt);
    if (k === BAGS.boombox && it.on) {
      if (inAir()) S.needs.bored = Math.min(100, S.needs.bored + dt * 1.5);
      if (Math.random() < dt * 0.3) cheer(it.x, it.z, 7, ['🎶 Dance break!', 'This slaps!', '*dances*', 'Turn it UP!']);
    }
    if (k === BAGS.cat && !it.caged && it.state === 'free') {
      if (inAir()) S.needs.calm = Math.min(100, S.needs.calm + dt * 0.4);
      if (Math.random() < dt * 0.25) { const p = passengers.find(p => p.state !== 'gone' && Math.hypot(p.x - it.x, p.z - it.z) < 3); if (p) shout(p, pick(['Kitty!', 'Here, kitty kitty!', 'Is that the captain\'s cat?']), 2.5); }
      if (Math.random() < dt * 0.15) sweep(700, 450, 0.3, 'sine', 0.03);
    }
  }
}
// when a held thing is let go (grab.js): balloons drift off; the party crate, thrown, pops; a thrown nuke arms itself
function cargoLetGo(it) {
  const speed = Math.hypot(it.vx || 0, it.vz || 0, it.vy || 0);
  if (it.type.floaty) { it.state = 'float'; it.floatT = 0; say('🎈 The balloons float away. Bye, balloons!'); }
  if (it.type.popper && speed > 3.2 && S.t - (it.popT || -9) > 2) { it.popT = S.t; confetti(it.x, it.y + 0.4, it.z); }
  if (it.type === BAGS.nuke && speed > 4 && !it.armed) { armNuke(it); say('☢ You THREW the nuke?! It\'s armed now!', 'bad'); }
}
// for the other players: the bits of state they need to see (and hear) it right
const cargoFlags = it => (it.on ? 1 : 0) | (it.opened ? 2 : 0) | ((it.slices ?? 3) << 2) | ((it.outcome || 0) << 4) | (it.armed ? 64 : 0);
function applyCargoFlags(it, f) {
  if (f === undefined) return;
  it.on = !!(f & 1);
  if (it.type === BAGS.mystery && (f & 2) && !it.opened) { it.opened = true; it.outcome = (f >> 4) & 3; it.g.userData.lid.visible = false; if (it.outcome === 1) it.g.userData.snake.visible = true; }
  if (it.type === BAGS.pizza) { it.slices = (f >> 2) & 3; it.g.userData.slices.forEach((b, k) => { b.visible = k < it.slices; }); }
  if (it.type === BAGS.nuke) { if (f & 64) it.armed = it.armed || S.t; else it.armed = 0; }
}

// ---------------------------------------------------------------- the AUTO LOAD button (in the terminal)
// One press and the bags the flight still needs fly in a big arc from the pile into the plane's cargo bay.
// (It won't touch the nuke, and it leaves animals in their carriers alone.)
(function autoLoadKiosk() {
  const k = new THREE.Group(); k.position.set(3.6, GROUND, TERM.z0 + 2.4); airport.add(k);
  box(0.7, 1.0, 0.5, std(0x2c4a63), 0, 0.5, 0, k);
  box(0.6, 0.05, 0.4, M.dark, 0, 1.02, 0, k);
  const btn = cyl(0.13, 0.15, 0.08, std(0x22dd55, { emissive: 0x0a4418 }), 0, 1.08, 0, k);
  textPlane(1.3, 0.34, '🧳 AUTO LOAD ➜ ✈', '#2c4a63', '#ffd34a', k, 0, 1.6, -0.26, Math.PI, 'bold 44px sans-serif');
  box(0.06, 0.5, 0.06, M.steel, 0, 1.3, 0.2, k);
  const hit = box(0.8, 1.4, 0.7, M.hit, 0, 0.8, 0, k); hit.userData.autoload = true; targets.push(hit);
  BLOCKS.push([3.6 - 0.4, 3.6 + 0.4, TERM.z0 + 2.4 - 0.3, TERM.z0 + 2.4 + 0.3]);
  window.autoLoadButton = btn;
})();
function autoLoad() {
  const b = boarding(), need = BAGS_NEEDED - b.loaded;
  if (need <= 0) return say('🧳 The cargo bay already has all the bags it needs!', 'good');
  // free spots on the cargo bay floor
  const spots = [];
  for (const z of [8.0, 9.3, 10.6]) for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) if (!items.some(i => i.state !== 'gone' && Math.hypot(i.x - x, i.z - z) < 0.5)) spots.push([x, z]);
  const pc = { x: BELT_X - 1.6, z: BELT_END - 2.2 };
  const pool = items.filter(i => !i.extra && !i.type.cage && i.type !== BAGS.nuke && !i.type.floaty && ['pile', 'free', 'ride'].includes(i.state) && !insideHull(i.x, i.z))
    .sort((a, b) => Math.hypot(a.x - pc.x, a.z - pc.z) - Math.hypot(b.x - pc.x, b.z - pc.z));
  const n = Math.min(need, pool.length, spots.length);
  if (!n) return say('🧳 AUTO LOAD: no bags left to load (or no room in the cargo bay).', 'bad');
  for (let k = 0; k < n; k++) {
    const it = pool[k], [x, z] = spots[k];
    if (it.state === 'ride') freeSlot(it);
    it.state = 'auto'; it.auto = { fx: it.x, fy: it.y, fz: it.z, tx: x, tz: z, t: -k * 0.18, dur: 1.8 };
  }
  autoLoadButton.position.y = 1.04; setTimeout(() => { autoLoadButton.position.y = 1.08; }, 300);
  beep(440, .1, 'square', .05); setTimeout(() => sweep(300, 900, 0.6, 'triangle', 0.04), 120);
  say(`🤖 AUTO LOAD: ${n} bag${n > 1 ? 's' : ''} flying into the cargo bay!`, 'good');
}
// (host) bags on their way: up, over, and down into the plane
function autoLoadFly(it, dt) {
  const a = it.auto; a.t += dt;
  if (a.t < 0) return;
  const k = Math.min(1, a.t / a.dur), e = k * k * (3 - 2 * k);
  it.x = a.fx + (a.tx - a.fx) * e; it.z = a.fz + (a.tz - a.fz) * e;
  it.y = a.fy + (0 - a.fy) * e + Math.sin(Math.PI * k) * 9;
  it.spinY += dt * 6; it.g.position.set(it.x, it.y, it.z); it.g.rotation.set(0, it.spinY, 0);
  if (k >= 1) { it.state = 'free'; it.y = 0; it.vx = it.vy = it.vz = 0; it.auto = null; beep(260, .06, 'triangle', .04); }
}
