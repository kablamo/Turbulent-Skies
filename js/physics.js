// Collision world (walls, floors, wings, ramp, tarmac), body movement, and the player.
'use strict';
// Inside the hull you can only stand on walkable floor; the walls can only be crossed through
// an open exit door, an open cargo ramp, or a hole ripped in the side.
const ROOMS = [
  [-1.4, 1.4, NOSE + 0.4, BULK - 0.2],           // cockpit
  [-0.5, 0.5, BULK - 0.4, BULK + 0.4],           // cockpit door
  [-1.15, 2.75, BULK + 0.2, -6.4],               // front galley
  [-2.95, -1.4, BULK + 0.25, -6.72],             // front lavatory
  [-(W - 0.35), W - 0.35, -6.5, CARGO + 0.2],    // cabin
  [-(W - 0.2), W - 0.2, -1.0, 1.0],              // exit row
  [-(W - 0.5), 1.1, CARGO, REAR + 0.01],         // cargo bay (left of the rear lav)
  [1.1, W - 0.5, CARGO, 8.75],                   // cargo bay (in front of the rear lav)
  [1.1, W - 0.5, 10.85, REAR + 0.01],            // cargo bay (behind the rear lav)
  [1.4, 2.95, 8.97, 10.63],                      // rear lavatory
];
const inSeat = (x, z) => seats.some(s => Math.abs(x - s.x) < 0.34 && z > s.z - 0.32 && z < s.z + 0.38);
function sideOpen(x, z) {
  const side = x < 0 ? 'L' : 'R';
  if (Math.abs(z) < 1.0 && doors[side].open > 0.9) return true;
  return !!hole.seg && hole.side === side && z > hole.seg.z0 + 0.1 && z < hole.seg.z1 - 0.1;
}
const inThreshold = (x, z) => Math.abs(x) >= W - 0.6 && Math.abs(x) <= W + 0.2 && sideOpen(x, z);
function inLavDoorway(x, z) {
  for (const k in lavDoors) { const d = lavDoors[k]; if (d.open > 0.9 && Math.abs(x - d.x) < 0.3 && z > d.z0 + 0.05 && z < d.z1 - 0.05) return true; }
  return false;
}
const walkable = (x, z) => (ROOMS.some(r => x >= r[0] && x <= r[1] && z >= r[2] && z <= r[3]) && !inSeat(x, z)) || inThreshold(x, z) || inLavDoorway(x, z);
const insideHull = (x, z) => Math.abs(x) < W && z > NOSE - 3.5 && z < REAR;
function onWing(x, z) {
  const ax = Math.abs(x), max = wings[x < 0 ? 'L' : 'R'].attached ? WING_OUT : WING_IN;
  return ax >= ROOT && ax <= max && z >= le(ax) && z <= te(ax);
}
const inEngine = (x, z) => { const ax = Math.abs(x); return ax > ENG_X - 0.75 && ax < ENG_X + 0.75 && z > -1.0 && z < 2.4; };
const onRamp = (x, z) => ramp.open > 0.99 && Math.abs(x) < RAMP_HW && z >= REAR - 0.1 && z <= REAR + RAMP_RUN;
// floor height outside the hull (thresholds, wings, ramp, tarmac), or null over thin air
function surfaceY(x, z) {
  if (inEngine(x, z)) return null;
  if (inThreshold(x, z) || onWing(x, z)) return 0;
  if (onRamp(x, z)) return -Math.max(0, z - REAR) * RAMP_SLOPE;
  if (S.phase === 'airport' && inAirport(x, z)) {
    for (const v of vehicles) { const zone = vehicleZoneAt(v, x, z); if (zone) return v.floor; }
    return GROUND;
  }
  return null;
}
// vehicles are solid except for their walk-in zones (doorway + interior)
function vehicleZoneAt(v, x, z) {
  const l = vehLocal(v, x, z);
  return v.zones.find(r => (r[4] !== 'door' || v.door.open > 0.9) && l.x >= r[0] && l.x <= r[1] && l.z >= r[2] && l.z <= r[3]);
}
function vehicleBlocks(x, z, y) {
  for (const v of vehicles) {
    const l = vehLocal(v, x, z);
    if (Math.abs(l.x) > v.w + 0.05 || Math.abs(l.z) > v.l + 0.05) continue;
    if (vehicleZoneAt(v, x, z)) continue;
    if (y < v.solidTop(l)) return true;
  }
  return false;
}
const groundAt = (x, z) => insideHull(x, z) ? 0 : surfaceY(x, z);
function canGo(ax, az, y, bx, bz) {
  const aIn = insideHull(ax, az), bIn = insideHull(bx, bz);
  if (aIn !== bIn) {
    if ((Math.abs(ax) < W) !== (Math.abs(bx) < W)) { if (!sideOpen(bx, (az + bz) / 2)) return false; }
    else if ((az < REAR) !== (bz < REAR)) { if (!(ramp.open > 0.99 && Math.abs(bx) < RAMP_HW)) return false; }
    else return false;
  }
  if (bIn) return walkable(bx, bz) && y > -0.6;
  if (S.phase === 'airport') {
    if (!inAirport(bx, bz) || airportBlocked(bx, bz)) return false;
    if (vehicleBlocks(bx, bz, y)) return false;
  }
  if (inEngine(bx, bz)) return false;
  const g = surfaceY(bx, bz);
  return g === null || g - y < 0.45;
}
// move a body (player, bag, passenger) in small steps so nothing tunnels through walls
function moveBody(b, dx, dz) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
  let hitX = false, hitZ = false;
  for (let i = 0; i < n; i++) {
    const sx = dx / n, sz = dz / n;
    if (canGo(b.x, b.z, b.y, b.x + sx, b.z + sz)) { b.x += sx; b.z += sz; }
    else if (canGo(b.x, b.z, b.y, b.x + sx, b.z)) { b.x += sx; hitZ = true; }
    else if (canGo(b.x, b.z, b.y, b.x, b.z + sz)) { b.z += sz; hitX = true; }
    else { hitX = hitZ = true; break; }
  }
  return [hitX, hitZ];
}
// gravity; returns true when standing on something
function fallBody(b, dt) {
  const g = groundAt(b.x, b.z);
  if (g !== null && b.y <= g + 0.03 && b.y > g - 0.5 && b.vy <= 0) { b.y = g; b.vy = 0; return true; }
  b.vy -= 18 * dt; b.y += b.vy * dt;
  if (g !== null && b.y < g && b.y > g - 0.5) { b.y = g; b.vy = b.vy < -5 ? -b.vy * 0.2 : 0; return b.vy === 0; }
  return false;
}
// how the plane's tilt and any openings push loose things around (plane-local acceleration)
const force = { x: 0, z: 0 };
function cabinForces(b, out) {
  out.x = 0; out.z = 0;
  if (S.phase === 'airport') return out;
  out.x = -(S.roll + plane.rotation.z * 0.6) * 9;
  out.z = plane.rotation.x * 8;
  if (insideHull(b.x, b.z) || onRamp(b.x, b.z)) {
    if (ramp.open > 0.5 && b.z > BULK) out.z += 3.5 * ramp.open;
    if (hole.seg) {
      const hx = (hole.side === 'L' ? -1 : 1) * W, dx = hx - b.x, dz = hole.seg.z - b.z, d = Math.hypot(dx, dz) || 1;
      const k = 7 / (1 + d * 0.6);
      out.x += dx / d * k; out.z += dz / d * k;
    }
  }
  return out;
}

function areaName(x, z) {
  if (S.driving) return 'Driving the ' + S.driving.name;
  if (S.phase === 'airport') for (const v of vehicles) if (vehicleZoneAt(v, x, z)) return 'Inside the ' + v.name;
  if (S.phase === 'airport' && !insideHull(x, z) && !onWing(x, z) && !onRamp(x, z)) return inTerminal(x, z) ? 'Terminal · Gate 404' : 'Airport apron';
  if (Math.abs(x) > W) return x < 0 ? 'Left wing' : 'Right wing';
  if (z < BULK) return S.flying ? 'Cockpit · flying' : 'Cockpit';
  if (x < -1.3 && z < -6.6) return 'Front lavatory';
  if (z < -6.5) return 'Front galley';
  if (z > REAR) return 'Cargo ramp';
  if (x > 1.3 && z > 8.85 && z < 10.75) return 'Rear lavatory';
  if (z > CARGO) return 'Cargo bay';
  if (Math.abs(z) < 1.2) return 'Exit row';
  const s = seats.reduce((a, b) => Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a);
  return 'Cabin · row ' + s.row;
}

// ---------------------------------------------------------------- the player
function respawn() {
  Object.assign(P, { x: 0, y: 0, z: -7.4, vy: 0, vz: 0, vx: 0, yaw: Math.PI, pitch: 0, falling: false });
  if (isClient()) { netSend({ t: 'fell' }); return; }   // the host applies the penalty
  S.integrity -= 5; S.needs.calm -= 25; S.falls++;
  say(pick(['You fell off the plane! Luckily you packed a parachute... and a grappling hook.', 'You fell off! A passing seagull carried you back. Passengers are rattled.', 'Somehow you climbed back in through the landing gear. The passengers saw everything.']), 'bad');
}
function startFalling(vx, vz, msg) {
  if (S.held) throwHeld(1);
  P.falling = true; P.fallT = 0; P.vx = vx; P.vz = vz;
  say(msg || 'AAAAAAAAAAAAHHHH!', 'bad');
  beep(800, 1.2, 'sine', .06);
}
function updatePlayer(dt) {
  if (P.falling) {
    P.fallT += dt; P.vy -= 20 * dt; P.vz += 40 * dt;
    P.x += P.vx * dt; P.y += P.vy * dt; P.z += P.vz * dt;
    $('fade').style.opacity = clamp((P.fallT - 1) / 1.2, 0, 1);
    if (P.fallT > 2.3) { respawn(); $('fade').style.opacity = 0; }
    return;
  }
  if (S.flying) { P.x = -0.75; P.z = -10.6; P.y = 0; return; }
  if (S.driving) { const v = S.driving, e = vehPoint(v, v.eye.x, v.eye.z); P.x = e.x; P.z = e.z; P.y = v.floor; return; }
  // on foot the arrow keys look around, so you can play without a mouse (in vehicles they steer)
  P.yaw += ((keys.arrowleft ? 1 : 0) - (keys.arrowright ? 1 : 0)) * 2.2 * dt;
  P.pitch = clamp(P.pitch + ((keys.arrowup ? 1 : 0) - (keys.arrowdown ? 1 : 0)) * 1.6 * dt, -1.45, 1.45);
  const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);
  const r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
  const sp = (keys.shift ? 6.0 : 3.4) * (S.held ? 0.85 : 1);
  let mx = -Math.sin(P.yaw) * f + Math.cos(P.yaw) * r;
  let mz = -Math.cos(P.yaw) * f - Math.sin(P.yaw) * r;
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx = mx / len * sp; mz = mz / len * sp; P.walkT += dt * sp; }
  if (S.phase !== 'airport') {
    // the wind wants you off the plane; standing still lets you brace against it
    if (!insideHull(P.x, P.z)) { mz += (len > 0 ? 1.3 : 0.2) + S.turb * 2.5; mx += S.gust * (len > 0 ? 1 : 0.4); }
    else mx += S.gust * 0.3;
    cabinForces(P, force);
    mx += force.x * 0.6; mz += force.z * 0.45;
  }
  moveBody(P, mx * dt, mz * dt);

  // shove any luggage you walk into
  for (const it of items) {
    if (it.state !== 'free' || Math.abs(it.y - P.y) > 0.8) continue;
    const dx = it.x - P.x, dz = it.z - P.z, d = Math.hypot(dx, dz);
    if (d < it.r + 0.3 && d > 0.001) { it.vx += dx / d * 40 * dt; it.vz += dz / d * 40 * dt; }
  }

  // propeller wash knocks you right off the wing
  const ax = Math.abs(P.x), e = engines[P.x < 0 ? 'L' : 'R'];
  if (S.phase !== 'airport' && onWing(P.x, P.z) && ax > ENG_X - 1.4 && ax < ENG_X + 1.4 && P.z < -0.9 && e.spin > 8) {
    startFalling(Math.sign(P.x) * 6, 8, 'The propeller blast blew you clean off the wing!');
    return;
  }
  const g = groundAt(P.x, P.z);
  if (S.jump && g !== null && P.y <= g + 0.03) P.vy = 4.2;
  S.jump = false;
  fallBody(P, dt);
  if (g === null && P.y < -2.5) startFalling(mx * 0.5, mz);
}
