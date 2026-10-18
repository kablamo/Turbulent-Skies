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
  updateDarts(dt); bananaSlips();
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
// Hold the button down and the bags the flight still needs fly in a big arc from the pile into the plane's cargo bay.
// (It won't touch the nuke, and it leaves animals in their carriers alone.)
(function autoLoadKiosk() {
  const k = new THREE.Group(); k.position.set(3.6, GROUND, TERM.z0 + 2.4); airport.add(k);
  box(0.7, 1.0, 0.5, std(0x2c4a63), 0, 0.5, 0, k);
  box(0.6, 0.05, 0.4, M.dark, 0, 1.02, 0, k);
  const btn = cyl(0.13, 0.15, 0.08, std(0x22dd55, { emissive: 0x0a4418 }), 0, 1.08, 0, k);
  textPlane(1.3, 0.34, '🧳 AUTO LOAD ➜ ✈', '#2c4a63', '#ffd34a', k, 0, 1.6, -0.26, Math.PI, 'bold 44px sans-serif');
  box(0.06, 0.5, 0.06, M.steel, 0, 1.3, 0.2, k);
  const hit = box(0.8, 0.6, 0.7, M.hit, 0, 1.1, 0, k); hit.userData.autoload = true; targets.push(hit);   // (just the top with the button: aiming past the kiosk at a bag or someone behind it doesn't count)
  BLOCKS.push([3.6 - 0.4, 3.6 + 0.4, TERM.z0 + 2.4 - 0.3, TERM.z0 + 2.4 + 0.3]);
  window.autoLoadButton = btn;
})();
function autoLoad() {
  const people = autoBoard();
  const b = boarding(), need = BAGS_NEEDED - b.loaded;
  if (need <= 0) return say(people ? `🤖 AUTO LOAD: ${people} passenger${people > 1 ? 's' : ''} flying to their seats! (The bags are all aboard already.)` : '🧳 The bags and passengers are all aboard already!', 'good');
  // free spots on the cargo bay floor
  const spots = [];
  for (const z of [7.4, 8.4, 9.4, 10.4]) for (const x of [-1.3, -0.45, 0.45, 1.3]) if (!items.some(i => i.state !== 'gone' && Math.hypot(i.x - x, i.z - z) < 0.5)) spots.push([x, z]);
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
  say(`🤖 AUTO LOAD: ${n} bag${n > 1 ? 's' : ''} into the cargo bay${people ? ` and ${people} passenger${people > 1 ? 's' : ''} to their seats` : ''}!`, 'good');
}
// …and the passengers the flight still needs fly (screaming happily) through the air into empty seats
function autoBoard() {
  const need = PAX_NEEDED - passengers.filter(p => p.state === 'seated').length;
  if (need <= 0) return 0;
  const free = seats.filter(s => !s.occupant);
  const pool = passengers.filter(p => ['terminal', 'wait', 'toBus', 'walk', 'bus', 'inBus', 'outBus', 'down', 'getup'].includes(p.state) && !insideHull(p.x, p.z));
  const n = Math.min(need, free.length, pool.length);
  for (let k = 0; k < n; k++) {
    const p = pool[k], s = free[k];
    if (p.busSeat) { p.busSeat.p = null; p.busSeat = null; }
    if (p.rag) { p.rag = null; p.rig.core.quaternion.identity(); }
    p.seat = s; s.occupant = p; p.calling = null; p.next = null; p.path = [];
    p.state = 'autofly'; p.pose = 'flail'; p.fly = { fx: p.x, fy: p.y, fz: p.z, t: -k * 0.25, dur: 2.2 };
    shout(p, pick(['WHEEEE!', 'I\'M FLYING!', 'Is this the express boarding?', 'AAAAH!', 'Window seat please!']), 2.5);
  }
  return n;
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

// ---------------------------------------------------------------- silly weapons
// Hold one (left mouse), then right-click (or E): 🐔 the rubber chicken whacks people over, 🎯 the blaster fires
// foam darts that knock people (and bags) flying, 🍌 the launcher lobs banana peels that people slip on.
// The host does the knocking-over; everyone sees the darts and bananas fly.
const heldWeapon = () => { const h = GRAB.hands.find(h => h && h.k === 'item' && items[h.i] && items[h.i].type.weapon); return h ? items[h.i] : null; };
let weaponT = 0;
function useHeldWeapon() {
  const it = heldWeapon(); if (!it || S.t - weaponT < 0.35) return;
  weaponT = S.t;
  if (isClient()) netSend({ t: 'fire', i: items.indexOf(it) }); else weaponFire(LOCAL, it);
  if (it.type.weapon === 'whack') { quack(); } else beep(it.type.weapon === 'dart' ? 900 : 300, .08, 'square', .05);
}
// knock someone over from a hit (even out of their seat: they'll find their way back once they get up)
function weaponHit(p, vx, vy, vz) {
  if (!p || ['gone', 'held', 'bus', 'inBus', 'outBus', 'autofly'].includes(p.state)) return;
  if (p.seat) { p.seat.occupant = null; p.seat = null; }
  p.calling = null; p.next = null;
  if (p.rag) { p.state = 'air'; p.rag.targets = null; p.rag.k = 0; p.rag.prev.forEach((q, i) => q.copy(p.rag.pos[i]).sub(new THREE.Vector3(vx, vy, vz).multiplyScalar(RAG_H))); }
  else ragdoll(p, vx, vy, vz);
  shout(p, pick(['OW!', 'HEY!', 'Was that a CHICKEN?!', 'I\'m telling the captain!', 'Not the face!']), 2.5);
}
// (host) what a weapon does when used by `who`
function weaponFire(who, it) {
  const pz = who.isLocal ? P : who.pose, d = lookDir({ yaw: pz.yaw, pitch: pz.pitch || 0 });
  const ox = it.g.position.x, oy = it.g.position.y + 0.25, oz = it.g.position.z;
  if (it.type.weapon === 'whack') {
    // a swing: anyone just in front of you goes flying
    for (const p of passengers) {
      const dx = p.x - pz.x, dz = p.z - pz.z, dd = Math.hypot(dx, dz);
      if (dd < 2.0 && dd > 0.05 && (dx * d.x + dz * d.z) / dd > 0.3) weaponHit(p, d.x * 8, 3.5, d.z * 8);
    }
    for (const o of items) if (o !== it && (o.state === 'free' || o.state === 'pile') && Math.hypot(o.x - ox, o.z - oz) < 1.4) { o.state = 'free'; o.vx = d.x * 7; o.vz = d.z * 7; o.vy = 2.5; }
    netEvent('whack', r2(ox), r2(oy), r2(oz)); burstConfetti(ox, oy, oz, 12);
  } else if (it.type.weapon === 'dart') {
    const v = [d.x * 26, d.y * 26 + 1, d.z * 26];
    netEvent('dart', r2(ox), r2(oy), r2(oz), ...v.map(r2)); spawnDart(ox, oy, oz, ...v, true);
  } else if (it.type.weapon === 'banana') {
    const b = spawnBag(BAGS.banana); Object.assign(b, { state: 'free', x: ox + d.x * 0.5, y: oy, z: oz + d.z * 0.5, vx: d.x * 9, vy: 3 + d.y * 6, vz: d.z * 9 }); b.g.visible = true;
  }
}
// foam darts: little orange things that fly fast and drop a bit (the host's ones knock things over)
const darts = [], dartMat = std(0xff8a1a);
function spawnDart(x, y, z, vx, vy, vz, real) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 6), dartMat); m.position.set(x, y, z); plane.add(m);
  darts.push({ m, x, y, z, vx, vy, vz, t: 0, real });
}
function updateDarts(dt) {
  for (let i = darts.length - 1; i >= 0; i--) {
    const d = darts[i]; d.t += dt; d.vy -= 6 * dt;
    const nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
    let hit = d.t > 2.5 || !canGo(d.x, d.z, ny, nx, nz) || ny < (groundAt(nx, nz) ?? -99);
    if (d.real && !hit) {
      for (const p of passengers) if (p.state !== 'gone' && Math.hypot(p.x - nx, p.z - nz) < 0.45 && ny > p.y && ny < p.y + 1.6) { weaponHit(p, d.vx * 0.3, 3, d.vz * 0.3); hit = true; break; }
      if (!hit) for (const o of items) if ((o.state === 'free' || o.state === 'pile') && !o.extra && Math.hypot(o.x - nx, o.z - nz) < (o.r || 0.3) && ny < o.y + (o.h || 0.4)) { o.state = 'free'; o.vx = d.vx * 0.25; o.vz = d.vz * 0.25; o.vy = 2; hit = true; break; }
    }
    d.x = nx; d.y = ny; d.z = nz; d.m.position.set(nx, ny, nz);
    d.m.lookAt(plane.localToWorld(new THREE.Vector3(nx + d.vx, ny + d.vy, nz + d.vz))); d.m.rotateX(Math.PI / 2);
    if (hit) { plane.remove(d.m); darts.splice(i, 1); }
  }
}
// banana peels on the floor: walk onto one and down you go (host: passengers; everyone: their own player)
function bananaSlips() {
  for (const b of items) {
    if (b.type !== BAGS.banana || b.state !== 'free' || Math.abs(b.vy) > 0.1) continue;
    if (!isClient()) for (const p of passengers) if (ON_FOOT.has(p.state) && Math.hypot(p.x - b.x, p.z - b.z) < 0.35) {
      ragdoll(p, -Math.sin(p.g.rotation.y) * 3, 2.5, -Math.cos(p.g.rotation.y) * 3); shout(p, pick(['WHOOOA!', 'BANANA!', 'Who left THAT there?!']), 2.5); slideWhistle(true);
    }
    if (ME && ME.rag && !ME.rag.limp && Math.hypot(P.x - b.x, P.z - b.z) < 0.35 && Math.hypot(P.mvx, P.mvz) > 1) {
      goLimp(ME, P.mvx * 1.6, 2.5, P.mvz * 1.6); sayLocal('🍌 You slipped on a banana peel!'); slideWhistle(true);
    }
  }
}
