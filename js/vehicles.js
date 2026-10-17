// Drivable airport vehicles. Each has a walk-in interior: climb in through the door,
// sit at the steering wheel (E) and drive. Vehicles live in the airport group, whose frame
// lines up exactly with the plane's while it's parked at the gate.
'use strict';
const vehicles = [];
function vehPoint(v, lx, lz) { const c = Math.cos(v.h), s = Math.sin(v.h); return { x: v.x + lx * c + lz * s, z: v.z - lx * s + lz * c }; }
function vehLocal(v, x, z) { const dx = x - v.x, dz = z - v.z, c = Math.cos(v.h), s = Math.sin(v.h); return { x: dx * c - dz * s, z: dx * s + dz * c }; }
const VFLOOR = GROUND + 0.4;
const TROLLEY = { url: 'models/trolley.glb', scale: 0.55, color: std(0xffc21a, { roughness: .45, metalness: .3 }) };

function steeringWheel(v, g, x, y, z) {
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 20), M.dark);
  wheel.position.set(x, y, z); wheel.rotation.x = -0.9; g.add(wheel);
  box(0.04, 0.04, 0.4, M.dark, x, y - 0.1, z - 0.18, g).rotation.x = -0.9;
  const hit = box(0.5, 0.45, 0.4, M.hit, x, y, z, g);
  wheel.userData.drive = hit.userData.drive = v;
  targets.push(wheel, hit);
}
function driverSeat(g, x, z, mat) {
  box(0.5, 0.12, 0.5, mat, x, VFLOOR + 0.45, z, g);
  box(0.5, 0.7, 0.1, mat, x, VFLOOR + 0.85, z + 0.25, g);
  box(0.12, 0.45, 0.12, M.steel, x, VFLOOR + 0.2, z, g);
}

function makeVehicle(kind, x, z) {
  const g = new THREE.Group(); airport.add(g);
  const v = { kind, g, x, z, h: 0, v: 0, slots: [], seats: [], wheels: [], floor: VFLOOR };
  const wheel = (wx, wz, r) => { const w = cyl(r, r, 0.3, M.dark, wx, GROUND + r, wz, g); w.rotation.z = Math.PI / 2; v.wheels.push(w); };
  if (kind === 'trolley') {
    // a luggage trolley you push by hand: a low flat bed with a handle frame at the back (+z).
    // These sizes match models/trolley.glb at TROLLEY.scale; the boxes below are only a stand-in until it loads.
    Object.assign(v, { name: 'luggage trolley', w: 0.58, l: 1.1, max: 5.5, floor: GROUND, bedTop: GROUND + 0.29, push: true,
      eye: { x: 0, y: GROUND + EYE, z: 1.55 }, stand: { x: 0, z: 1.6 },
      zones: [[-0.55, 0.55, -1.1, 0.68, 'bed']],                              // hop onto the bed to ride along
      bed: { x0: -0.55, x1: 0.55, z0: -1.05, z1: 0.7 },
      solidTop: l => l.z > 0.68 ? GROUND + 1.25 : v.bedTop });
    const col = TROLLEY.color, stand = new THREE.Group(); g.add(stand); v.standIn = stand;
    box(1.15, 0.08, 1.8, col, 0, GROUND + 0.25, -0.2, stand);
    for (const s of [-1, 1]) box(0.05, 0.08, 1.8, col, s * 0.55, GROUND + 0.32, -0.2, stand);
    for (const s of [-1, 1]) box(0.08, 1.0, 0.08, col, s * 0.52, GROUND + 0.75, 0.9, stand);
    box(1.12, 0.08, 0.08, col, 0, GROUND + 1.22, 0.9, stand);
    box(1.12, 0.06, 0.06, col, 0, GROUND + 0.75, 0.9, stand);
    for (const [wx, wz] of [[-0.5, -0.85], [0.5, -0.85], [-0.5, 0.6], [0.5, 0.6]]) { const w = cyl(0.1, 0.1, 0.08, M.dark, wx, GROUND + 0.1, wz, stand); w.rotation.z = Math.PI / 2; v.wheels.push(w); }
    // grab the handle (E) to push it
    const hit = box(1.2, 0.5, 0.5, M.hit, 0, GROUND + 1.05, 0.95, g);
    hit.userData.drive = v; targets.push(hit);
    // room for just three bags, loaded and unloaded by hand
    for (const [lx, lz] of [[-0.27, -0.55], [0.27, -0.55], [0, 0.2]]) v.slots.push({ x: lx, z: lz, k: 0, item: null, v });
    v.whole = { x: 0, z: -0.15, k: 0, item: null, v };                       // big things (the caged crocodile…) take the lot
  } else {
    // the shuttle bus: door at the front right, driver front left, a row of seats either side of the aisle
    const white = std(0xf4f4f0, { roughness: .4 }), glass = std(0x223344, { transparent: true, opacity: .4, roughness: .1 });
    const L = 8.4, H = 2.55;
    Object.assign(v, { name: 'shuttle bus', w: 1.3, l: 4.2, max: 7,
      eye: { x: -0.7, y: VFLOOR + 1.35, z: -3.2 }, stand: { x: 0, z: -2.7 },
      zones: [[-1.05, 1.05, -3.9, -2.1], [-0.4, 0.4, -2.1, 3.95], [0.95, 1.5, -3.5, -2.75, 'door']],
      solidTop: () => GROUND + 3.1 });
    box(2.5, 0.3, 8.2, M.dark, 0, GROUND + 0.2, 0, g);
    box(2.6, 0.08, L, M.carpet, 0, VFLOOR, 0, g);
    box(2.7, 0.12, L + 0.1, white, 0, VFLOOR + H + 0.06, 0, g);
    box(2.0, 0.03, L - 0.6, M.lamp, 0, VFLOOR + H - 0.02, 0, g);
    // walls: solid lower panel, window band, top strip; the right side has a doorway at z -3.5..-2.7
    const side = (sx, z0, z1) => {
      const len = z1 - z0, mz = (z0 + z1) / 2;
      box(0.08, 1.0, len, white, sx, VFLOOR + 0.5, mz, g);
      box(0.04, 1.0, len, glass, sx, VFLOOR + 1.5, mz, g);
      box(0.08, 0.55, len, white, sx, VFLOOR + 2.27, mz, g);
      box(0.02, 0.25, len, M.stripe, sx + Math.sign(sx) * 0.05, VFLOOR + 0.75, mz, g);
    };
    side(-1.3, -L / 2, L / 2); side(1.3, -L / 2, -3.55); side(1.3, -2.7, L / 2);
    box(0.08, 0.5, 0.85, white, 1.3, VFLOOR + 2.3, -3.12, g);              // above the doorway
    // a sliding glass door that runs back along the outside of the bus when it opens
    const dm = new THREE.Group(); dm.position.set(1.36, 0, -3.12); g.add(dm);
    box(0.04, 1.9, 0.82, glass, 0, VFLOOR + 0.98, 0, dm);
    for (const y of [0.04, 1.93]) box(0.06, 0.06, 0.86, M.dark, 0, VFLOOR + y, 0, dm);
    for (const s of [-1, 1]) box(0.06, 1.95, 0.05, M.dark, 0, VFLOOR + 0.98, s * 0.41, dm);
    box(0.08, 0.04, 0.2, M.steel, 0.03, VFLOOR + 1.0, -0.25, dm);
    const dh = box(0.4, 1.9, 0.86, M.hit, 0, VFLOOR + 0.98, 0, dm);
    dh.userData.busDoor = v; targets.push(dh);
    v.door = { mesh: dm, open: 0, target: 0 };
    for (const s of [-1, 1]) textPlane(3.2, 0.42, '✈ AIRPORT SHUTTLE', '#1f4fa8', '#fff', g, s * 1.36, VFLOOR + 2.27, 0.8, s * Math.PI / 2, 'bold 48px sans-serif');
    box(2.6, 1.0, 0.1, white, 0, VFLOOR + 0.5, -L / 2, g);
    box(2.5, 1.3, 0.04, glass, 0, VFLOOR + 1.65, -L / 2, g);               // windshield
    box(2.6, 2.55, 0.1, white, 0, VFLOOR + 1.27, L / 2, g);                // back wall
    box(0.5, 0.2, 0.6, M.steel, 1.55, GROUND + 0.2, -3.1, g);              // step up into the door
    box(2.5, 0.35, 0.4, M.panel, 0, VFLOOR + 0.9, -3.9, g);                // dashboard
    driverSeat(g, -0.7, -3.2, M.dark);
    steeringWheel(v, g, -0.7, VFLOOR + 1.2, -3.65);
    for (let i = 0; i < 5; i++) for (const lx of [-0.75, 0.75]) {
      const lz = -1.6 + i * 1.25;
      v.seats.push({ x: lx, z: lz, p: null });
      box(0.6, 0.12, 0.5, M.seat, lx, VFLOOR + 0.45, lz, g);
      box(0.6, 0.65, 0.1, M.seat, lx, VFLOOR + 0.8, lz + 0.27, g);
      box(0.08, 0.4, 0.08, M.steel, lx, VFLOOR + 0.2, lz, g);
    }
    box(0.04, 2.5, 0.04, M.steel, 0.42, VFLOOR + 1.25, -2.1, g);          // grab pole
    for (const [wx, wz] of [[-1.25, -2.8], [1.25, -2.8], [-1.25, 2.8], [1.25, 2.8]]) wheel(wx, wz, 0.45);
  }
  // players can sit in any seat (E) and ride along while someone else drives
  for (const s of v.seats) { const hit = box(0.55, 0.5, 0.45, M.hit, s.x, VFLOOR + 0.55, s.z, g); hit.userData.vehSeat = { v, s }; targets.push(hit); }
  vehicles.push(v);
  syncVehicle(v);
  return v;
}
function syncVehicle(v) { v.g.position.set(v.x, 0, v.z); v.g.rotation.y = v.h; }
// a few trolleys, so everybody in a multiplayer game can push one
const trolleys = [makeVehicle('trolley', 5, 76), makeVehicle('trolley', 6.8, 76), makeVehicle('trolley', 8.6, 76)];
const trolleyLoad = v => [...v.slots, v.whole].filter(s => s.item).length;
const bus = makeVehicle('bus', -7, 76);
function toggleBusDoor(v) { v.door.target = v.door.target ? 0 : 1; beep(v.door.target ? 520 : 380, .25, 'triangle', .06); }
const busDoorOpen = () => bus.door.open > 0.9;
function updateVehicles(dt) {
  const d = bus.door;
  d.open += clamp(d.target - d.open, -dt * 1.8, dt * 1.8);
  d.mesh.position.set(1.36 + Math.min(1, d.open * 4) * 0.1, 0, -3.12 + d.open * 0.92);
}

const nearRamp = (x, z, d) => Math.hypot(x - RAMP_FOOT.x, z - RAMP_FOOT.z) < d;
function vehicleSpotOK(x, z) {
  if (!inAirport(x, z) || airportBlocked(x, z)) return false;
  if (Math.abs(x) < W + 0.6 && z > NOSE - 4 && z < REAR + RAMP_RUN + 0.3) return false;   // the fuselage and ramp
  if (Math.abs(x) > ROOT - 0.2 && Math.abs(x) < WING_OUT + 0.5 && z > le(Math.abs(x)) - 0.5 && z < te(Math.abs(x)) + 0.5) return false;
  return true;
}
function inVehicle(v, x, z, pad = 0) { const l = vehLocal(v, x, z); return Math.abs(l.x) < v.w + pad && Math.abs(l.z) < v.l + pad; }
function vehicleFits(v, x, z, h) {
  const probe = { x, z, h, w: v.w, l: v.l };
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const p = vehPoint(probe, a * v.w, b > 0 ? v.l + (v.tail || 0) : b * v.l);   // (the trolley's tail is you, walking behind it)
    if (!vehicleSpotOK(p.x, p.z)) return false;
    for (const o of vehicles) if (o !== v && inVehicle(o, p.x, p.z)) return false;
  }
  for (const o of vehicles) if (o !== v) for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = vehPoint(o, a * o.w, b * o.l), l = vehLocal(probe, p.x, p.z);
    if (Math.abs(l.x) < v.w && Math.abs(l.z) < v.l) return false;
  }
  return true;
}

// ---- bumping into things
// which other vehicle this one would run into at (x, z, h), if any
function vehicleBumped(v, x, z, h) {
  const probe = { x, z, h, w: v.w, l: v.l };
  for (const o of vehicles) {
    if (o === v) continue;
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) { const p = vehPoint(probe, a * v.w, b * v.l); if (inVehicle(o, p.x, p.z)) return o; }
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = vehPoint(o, a * o.w, b * o.l), l = vehLocal(probe, p.x, p.z); if (Math.abs(l.x) < v.w && Math.abs(l.z) < v.l) return o; }
  }
  return null;
}
// shove a vehicle along: a trolley rolls away, the bus barely budges (the host moves things for everyone)
function shoveVehicle(o, dx, dz) {
  if (!o || S.phase !== 'airport') return;
  if (isClient()) { netSend({ t: 'vpush', i: vehicles.indexOf(o), dx: Math.round(dx * 1000) / 1000, dz: Math.round(dz * 1000) / 1000 }); return; }
  if (S.driving === o || NET.remotes.some(r => r.driving === o)) return;
  const k = o.kind === 'bus' ? 0.12 : 0.9, nx = o.x + dx * k, nz = o.z + dz * k;
  if (vehicleFits(o, nx, nz, o.h)) { o.x = nx; o.z = nz; for (const w of o.wheels) w.rotation.x += Math.hypot(dx, dz) * 4; syncVehicle(o); }
}
// knock someone flying (they ragdoll)
function knockOver(p, vx, vz) {
  if (!p || !ON_FOOT.has(p.state)) return;
  if (isClient()) { netSend({ t: 'knock', i: passengers.indexOf(p), vx: Math.round(vx * 100) / 100, vz: Math.round(vz * 100) / 100 }); return; }
  ragdoll(p, vx, 2.4, vz);
}
// anyone standing where a vehicle is going gets bowled over
function bowlOver(v, x, z, h, vx, vz) {
  for (const p of passengers) {
    if (!ON_FOOT.has(p.state)) continue;
    const l = vehLocal({ x, z, h }, p.x, p.z);
    if (Math.abs(l.x) < v.w + 0.25 && Math.abs(l.z) < v.l + 0.25) knockOver(p, vx, vz);
  }
}

function enterVehicle(v, who = LOCAL) {
  if (vehicles.some(o => o === v && (o === S.driving || NET.remotes.some(r => r.driving === o)))) return say(`Someone is already driving the ${v.name}.`);
  if (!who.isLocal) { who.driving = v; v.v = 0; return; }
  S.driving = v; v.v = 0; S.chase = false;
  P.yaw = v.h; P.pitch = -0.08;
  if (v.push) { say(`You grab the ${v.name}. W/S push · A/D turn · C camera · E let go`); beep(320, .12, 'triangle', .05); return; }
  say(`You take the wheel of the ${v.name}. W/S drive · A/D steer · ${v.kind === 'bus' ? 'F board / unload passengers · Q door · ' : ''}C camera · E get up`);
  beep(200, .3, 'sawtooth', .05);
}
function exitVehicle(who = LOCAL) {
  const v = who.isLocal ? S.driving : who.driving, p = vehPoint(v, v.stand.x, v.stand.z);
  v.v = 0;
  if (!who.isLocal) { who.driving = null; netTeleport(who, p.x, v.floor, p.z, v.h); return; }
  Object.assign(P, { x: p.x, z: p.z, y: v.floor, vy: 0 });
  S.driving = null;
}
function driveVehicle(v, dt, k = keys) {
  const thr = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0);
  const steer = (k.a || k.arrowleft ? 1 : 0) - (k.d || k.arrowright ? 1 : 0);
  if (thr) v.v += thr * (thr * v.v < 0 ? 14 : 5) * dt; else v.v *= Math.max(0, 1 - 1.8 * dt);
  v.v = clamp(v.v, -3.5, v.max);
  const nh = v.h + steer * dt * (v.push ? 1.5 : 0.9 * clamp(v.v / 3, -1, 1));   // a trolley turns on the spot
  if (vehicleFits(v, v.x, v.z, nh)) { if (v === S.driving) P.yaw += nh - v.h; v.h = nh; }   // your view turns with the vehicle
  const nx = v.x - Math.sin(v.h) * v.v * dt, nz = v.z - Math.cos(v.h) * v.v * dt;
  if (Math.abs(v.v) > 1.2) bowlOver(v, nx, nz, v.h, -Math.sin(v.h) * v.v * 1.2, -Math.cos(v.h) * v.v * 1.2);
  if (!vehicleFits(v, nx, nz, v.h)) { const o = vehicleBumped(v, nx, nz, v.h); if (o && o.kind !== 'bus') shoveVehicle(o, nx - v.x, nz - v.z); }
  if (vehicleFits(v, nx, nz, v.h)) { v.x = nx; v.z = nz; }
  else { if (Math.abs(v.v) > 2) { beep(90, .2, 'square', .06); S.shake = 0.6; } v.v = -v.v * 0.2; }
  for (const w of v.wheels) w.rotation.x += v.v * dt * 2.5;
  syncVehicle(v);
}
// how high a bag sits on the trolley: on the bed, or on top of the bags under it in the same stack
function slotY(v, slot) {
  let y = v.bedTop;
  for (const s of v.slots) if (s.x === slot.x && s.z === slot.z && s.k < slot.k && s.item) y += s.item.h;
  return y;
}
// the next free spot: the lowest stack first, and never piled above head height
function freeTrolleySlot(v) {
  let best = null, by = 1e9;
  for (const s of v.slots) {
    if (s.item) continue;
    const y = slotY(v, s);
    if (y < by && y < v.bedTop + 1.3) { best = s; by = y; }
  }
  return best;
}
// where a bag can go on this trolley (or null): the big things need the whole trolley to themselves
function trolleySpot(v, it) {
  if (it.type.whole) return trolleyLoad(v) ? null : v.whole;
  return v.whole.item ? null : freeTrolleySlot(v);
}
const trolleyFullMsg = (v, it) => v.whole.item ? `The ${v.whole.item.name} is taking up the whole trolley! Use another one.`
  : it.type.whole ? `The ${it.name} needs a whole trolley to itself. Empty this one or grab another.` : `This trolley is full (${v.slots.length} bags)! Take this lot to the plane first, or use another trolley.`;
// the trolley nearest to a spot, if it's close enough to put things on (in its own coordinates, with some slack)
function trolleyNear(x, z, slack = 0.6) {
  let best = null, bd = 1e9;
  for (const v of trolleys) {
    const l = vehLocal(v, x, z), b = v.bed;
    if (l.x > b.x0 - slack && l.x < b.x1 + slack && l.z > b.z0 - slack && l.z < b.z1 + slack * 0.7) { const d = Math.hypot(l.x, l.z); if (d < bd) { bd = d; best = v; } }
  }
  return best;
}
function busDoor(v, out = 0.5) { return vehPoint(v, v.w + out, -3.1); }
// sitting in a vehicle as a passenger (only on your own screen; others see you sit)
function sitInVehicle(v, s) {
  if (s.p || s.player) return;
  P.sitV = v; P.sitSeat = s; s.player = true; P.yaw = v.h; P.pitch = -0.05;
  beep(300, .1, 'sine', .05);
}
function standFromSeat() {
  const v = P.sitV, s = P.sitSeat; if (!v) return;
  s.player = false; P.sitV = P.sitSeat = null;
  const pt = vehPoint(v, v.kind === 'bus' ? 0 : s.x, v.kind === 'bus' ? s.z : s.z - 0.45);
  Object.assign(P, { x: pt.x, z: pt.z, y: v.floor, vy: 0 });
}
// anyone standing in (or sitting in, or on the back of) a vehicle moves with it
function rideVehicles() {
  if (S.phase !== 'airport') return;
  for (const v of vehicles) {
    const pv = v.prev;
    v.prev = { x: v.x, z: v.z, h: v.h, w: v.w, l: v.l };
    if (!pv || (pv.x === v.x && pv.z === v.z && pv.h === v.h) || S.driving === v) continue;
    const riding = P.sitV === v || (!P.falling && P.y > GROUND + 0.2 && inVehicle(pv, P.x, P.z));
    if (!riding) continue;
    const l = vehLocal(pv, P.x, P.z), w = vehPoint(v, l.x, l.z);
    P.x = w.x; P.z = w.z; P.yaw += v.h - pv.h;
  }
}
function vehicleAction(v) {
  if (v.push) {
    // no automatic unloading: push it to the cargo ramp, let go, and carry the bags in yourself
    const bags = trolleyLoad(v);
    if (!bags) return say(`The trolley is empty. Push it to the conveyor, pick bags off the belt (E) and put them on it (Q). It holds ${v.slots.length}.`);
    return say(`${bags} bag${bags > 1 ? 's' : ''} on the trolley. Push it to the cargo ramp, let go (E), and carry them up the ramp into the cargo bay.`);
  }
  const door = busDoor(v);
  const atTerminal = Math.hypot(door.x - TERM_DOOR.x, door.z - TERM_DOOR.z) < 10, atPlane = nearRamp(door.x, door.z, 13);
  if ((atTerminal || atPlane) && !busDoorOpen()) return say('Open the bus door first (Q).');
  if (atTerminal) {
    const waiting = passengers.filter(p => p.state === 'terminal');
    if (!waiting.length) return say('Nobody is waiting in the terminal.');
    say(`"Flight 404 now boarding!" ${waiting.length} passenger${waiting.length > 1 ? 's' : ''} head for the bus.`, 'good');
    waiting.forEach((p, i) => {
      p.state = 'wait'; p.waitT = i * 0.5;
      p.next = () => { p.state = 'toBus'; p.path = inTerminal(p.x, p.z) ? [{ x: 0, z: TERM.z0 + 2 }, { x: 0, z: TERM.z0 - 1.5 }] : []; };
    });
    return;
  }
  if (atPlane) {
    const riders = passengers.filter(p => p.state === 'bus');
    if (!riders.length) return say('The bus is empty.');
    if (ramp.open < 0.99) return say('Lower the cargo ramp so they can walk aboard!');
    // front seats first: each gets up, walks down the aisle and out of the door
    riders.sort((a, b) => a.busSeat.z - b.busSeat.z).forEach((p, i) => {
      p.state = 'wait'; p.waitT = i * 1.2;
      p.next = () => {
        const s = p.busSeat; p.busSeat = null; s.p = null;
        p.state = 'outBus'; p.lx = s.x; p.lz = s.z;
        p.path = [{ x: 0, z: s.z }, { x: 0, z: -2.6 }, { x: 0.9, z: -3.1 }, { x: v.w + 0.7, z: -3.1 }];
      };
    });
    say('Everybody off! Passengers walk up the ramp to find their seats.', 'good');
    return;
  }
  say('Park the bus with its door next to the terminal entrance to board passengers, or next to the plane\'s cargo ramp to let them off.');
}
