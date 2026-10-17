// Real ragdolls. When a passenger gets thrown, knocked flying or sucked toward a hole, their body turns into
// 13 points (head, shoulders, elbows, hands, hips, knees, feet) joined by sticks the length of their bones, and
// gets simulated for real: gravity, momentum, tumbling, bouncing off the floor and the walls, sliding to a stop.
// Nothing is animated by hand. Every frame the points are turned back into the rig's joint angles (and so the
// Blender model's bones), so whatever crumpled heap they land in is exactly how they lie there.
// It's "Verlet" physics: each point remembers where it was last step, and the gap is its speed.
'use strict';
// 0 head · 1/2 shoulders · 3/4 elbows · 5/6 hands · 7/8 hips · 9/10 knees · 11/12 feet (left first)
const RAG_STICKS = [[1, 2], [7, 8], [1, 7], [2, 8], [1, 8], [2, 7],   // the torso: a stiff box
  [0, 1], [0, 2], [0, 7], [0, 8],                                      // the head, held on by the neck
  [1, 3], [3, 5], [2, 4], [4, 6], [7, 9], [9, 11], [8, 10], [10, 12]]; // arms and legs
const RAG_BEND = [[1, 3, 5], [2, 4, 6], [7, 9, 11], [8, 10, 12]];     // elbows and knees can't fold flat
const RAG_R = [0.16, 0.09, 0.09, 0.07, 0.07, 0.07, 0.07, 0.1, 0.1, 0.08, 0.08, 0.08, 0.08];
const RAG_H = 1 / 120, RAG_G = 18;

// where the rig's joints are right now (in the plane's frame, like everything else)
function ragPoints(p) {
  const r = p.rig;
  p.g.updateMatrixWorld(true);
  const at = (o, y = 0) => plane.worldToLocal(o.localToWorld(new THREE.Vector3(0, y, 0)));
  return [at(r.head), at(r.arm[0]), at(r.arm[1]), at(r.fore[0]), at(r.fore[1]), at(r.fore[0], -0.22), at(r.fore[1], -0.22),
    at(r.thigh[0]), at(r.thigh[1]), at(r.shin[0]), at(r.shin[1]), at(r.shin[0], -0.36), at(r.shin[1], -0.36)];
}
const ragMid = (pts, a, b) => pts[a].clone().add(pts[b]).multiplyScalar(0.5);

// go floppy, flying off at (vx, vy, vz) and tumbling
function startRag(p, vx, vy, vz) {
  const pos = ragPoints(p), c = ragMid(pos, 7, 8);
  const spin = new THREE.Vector3(rand(-5, 5), rand(-2, 2), rand(-5, 5)), v = new THREE.Vector3(), d = new THREE.Vector3();
  const prev = pos.map((q, i) => {
    v.set(vx, vy, vz).add(d.copy(spin).cross(q.clone().sub(c)));
    if (i >= 3 && i !== 7 && i !== 8) v.add(d.set(rand(-3.5, 3.5), rand(-1, 3.5), rand(-3.5, 3.5)));   // arms and legs fling about
    return q.clone().addScaledVector(v, -RAG_H);
  });
  const len = RAG_STICKS.map(([a, b]) => pos[a].distanceTo(pos[b]));
  const bend = RAG_BEND.map(([a, b, e]) => 0.45 * (pos[a].distanceTo(pos[b]) + pos[b].distanceTo(pos[e])));
  p.rag = { pos, prev, len, bend, yaw: p.g.rotation.y, acc: 0, t: 0, still: 0 };
}

function ragSubstep(Rg, fx, fz) {
  const { pos, prev } = Rg, h2 = RAG_H * RAG_H;
  // move: keep going the way you were going, plus gravity and the wind
  // (and when getting up, springs pulling every point toward where it would be standing)
  const T = Rg.targets, k = Rg.k || 0, c = Rg.damp || 0;
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i], q = prev[i];
    const vx = (p.x - q.x) * 0.998, vy = (p.y - q.y) * 0.998, vz = (p.z - q.z) * 0.998;
    let ax = fx, ay = -RAG_G, az = fz;
    if (T) {
      ax += k * (T[i].x - p.x) - c * vx / RAG_H;
      ay += k * (T[i].y - p.y) - c * vy / RAG_H + RAG_G * Rg.lift;
      az += k * (T[i].z - p.z) - c * vz / RAG_H;
    }
    q.copy(p);
    p.x += vx + ax * h2; p.y += vy + ay * h2; p.z += vz + az * h2;
  }
  // bones keep their length (a few passes, so they settle together)
  for (let it = 0; it < 5; it++) {
    for (let k = 0; k < RAG_STICKS.length; k++) ragStick(pos[RAG_STICKS[k][0]], pos[RAG_STICKS[k][1]], Rg.len[k], false);
    for (let k = 0; k < RAG_BEND.length; k++) ragStick(pos[RAG_BEND[k][0]], pos[RAG_BEND[k][2]], Rg.bend[k], true);
  }
  ragLimits(pos, prev, Rg);
  // bump into the world: floors, walls (and doorways), the cabin ceiling
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i], q = prev[i], r = RAG_R[i];
    if ((p.x !== q.x || p.z !== q.z) && !ragCanGo(q, p)) {
      // a wall: stop sideways and bounce back a little
      const bx = q.x - (p.x - q.x) * 0.3, bz = q.z - (p.z - q.z) * 0.3;
      p.x = q.x; p.z = q.z; q.x = p.x - (bx - q.x); q.z = p.z - (bz - q.z);
    }
    const g = groundAt(p.x, p.z);
    if (g !== null && p.y < g + r && p.y > g - 0.6) {
      const vyIn = p.y - q.y;
      p.y = g + r; q.y = p.y + vyIn * 0.3;                              // a small bounce
      const fr = T ? 0.97 : 0.75;                                        // friction (slippier while getting up)
      q.x = p.x - (p.x - q.x) * fr; q.z = p.z - (p.z - q.z) * fr;
    }
    if (insideHull(p.x, p.z)) {
      const top = CY + Math.sqrt(Math.max(0, R * R - p.x * p.x)) - r - 0.1;
      if (p.y > top) { p.y = top; q.y = Math.max(q.y, p.y); }
    }
  }
  // the floor may have shoved a hand or foot the wrong way: put the joints right again
  for (let k = 0; k < RAG_STICKS.length; k++) ragStick(pos[RAG_STICKS[k][0]], pos[RAG_STICKS[k][1]], Rg.len[k], false);
  for (let i = 0; i < pos.length; i++) { const g = groundAt(pos[i].x, pos[i].z); if (g !== null && pos[i].y < g + RAG_R[i] && pos[i].y > g - 0.6) { prev[i].y += g + RAG_R[i] - pos[i].y; pos[i].y = g + RAG_R[i]; } }
}
// can a body point move from q to p? (high up in the cabin it sails over the seats; only the hull stops it)
const ragCanGo = (q, p) => (p.y > 1.15 && insideHull(q.x, q.z) && insideHull(p.x, p.z)) || canGo(q.x, q.z, p.y, p.x, p.z);
// Joints that only bend the way real ones do, so nobody ends up in a bone-breaking pose:
// knees only bend backwards and elbows only forwards (no bending the wrong way), legs can't swing up behind
// the back or cross through each other, and arms can't go through the body.
const _ja = new THREE.Vector3(), _jf = new THREE.Vector3(), _jx = new THREE.Vector3(), _jr = new THREE.Vector3(), _ju = new THREE.Vector3(), _jb = new THREE.Vector3(), _jd = new THREE.Vector3(), _je = new THREE.Vector3(), _jc = new THREE.Vector3();
function ragLimits(pos, prev, Rg) {
  if (Rg.targets) return;   // (while getting up, the springs already pull toward a natural pose)
  // the torso's own directions: right, up and back
  _ju.addVectors(pos[1], pos[2]).sub(pos[7]).sub(pos[8]).normalize();
  _jr.subVectors(pos[2], pos[1]).add(_jd.subVectors(pos[8], pos[7]));
  _jr.addScaledVector(_ju, -_jr.dot(_ju)).normalize();
  _jb.crossVectors(_jr, _ju);
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    // hip: the thigh stays in front of / below the body, and doesn't cross far over the other leg
    limitCone(pos[7 + i], pos[9 + i], prev[9 + i], Rg.len[14 + i * 2], LEG_RANGE[i]);
    // shoulder: arms are loose, but can't go far behind the back or across through the chest
    limitCone(pos[1 + i], pos[3 + i], prev[3 + i], Rg.len[10 + i * 2], ARM_RANGE[i]);
    // knee bends backwards only, elbow forwards only
    hinge(pos[7 + i], pos[9 + i], pos[11 + i], prev[11 + i], -1, _jr);
    // the elbow's hinge turns with the upper arm: it always folds the hand toward the front of the body
    _ja.subVectors(pos[3 + i], pos[1 + i]).normalize();
    _jf.copy(_jb).negate().addScaledVector(_ju, 0.3);
    _jx.crossVectors(_ja, _jf);
    if (_jx.lengthSq() > 0.09) hinge(pos[1 + i], pos[3 + i], pos[5 + i], prev[5 + i], 1, _jx.normalize());
  }
}
const LEG_RANGE = [-1, 1].map(side => ({ side, maxIn: 0.25, maxOut: 0.8, maxBack: 0.35, maxUp: 0.75 }));
const ARM_RANGE = [-1, 1].map(side => ({ side, maxIn: 0.35, maxOut: 1, maxBack: 0.6, maxUp: 1 }));
// Each fix-up nudges the joint gently, and moves its "last position" by the same amount, so straightening a
// joint never counts as speed (otherwise the limits and the bones fight and the body shakes itself to bits).
function nudge(p, q, target, k) {
  _jc.subVectors(target, p).multiplyScalar(k);
  p.add(_jc); q.add(_jc);
}
// keep the bone from joint a to b inside a comfortable range (in the torso's directions), keeping its length
function limitCone(a, b, bPrev, len, L) {
  _jd.subVectors(b, a);
  let x = _jd.dot(_jr) * L.side, y = _jd.dot(_ju), z = _jd.dot(_jb);   // x: outwards, y: up, z: backwards
  const n = Math.hypot(x, y, z) || 1; x /= n; y /= n; z /= n;
  let bad = false;
  if (x < -L.maxIn) { x = -L.maxIn; bad = true; }
  if (x > L.maxOut) { x = L.maxOut; bad = true; }
  if (z > L.maxBack) { z = L.maxBack; bad = true; }
  if (y > L.maxUp) { y = L.maxUp; bad = true; }
  if (!bad) return;
  _jd.set(0, 0, 0).addScaledVector(_jr, x * L.side).addScaledVector(_ju, y).addScaledVector(_jb, z).normalize();
  nudge(b, bPrev, _je.copy(a).addScaledVector(_jd, len), 0.35);
}
// a hinge (knee or elbow): the lower bone may only fold one way; if it's bent backwards, straighten it out
function hinge(a, j, e, ePrev, dir, axis) {
  _jd.subVectors(j, a); _je.subVectors(e, j);
  const lenE = _je.length(), bend = _jc.crossVectors(_jd, _je).dot(axis) * dir / (_jd.length() * lenE || 1);
  if (bend > -0.15) return;                                   // (nearly straight is fine either way)
  nudge(e, ePrev, _jx.copy(j).addScaledVector(_jd.normalize(), lenE), 0.35);
}
// push two points to exactly len apart (or, for a "bend", only apart if they're closer than len)
const _rd = new THREE.Vector3();
function ragStick(a, b, len, minOnly) {
  _rd.subVectors(b, a);
  const d = _rd.length() || 1e-6;
  if (minOnly && d >= len) return;
  _rd.multiplyScalar((d - len) / d * 0.5);
  a.add(_rd); b.sub(_rd);
}

// one frame of ragdoll; returns true once they've come to rest
function stepRag(p, dt, fx, fz) {
  const Rg = p.rag;
  Rg.acc += Math.min(dt, 0.05); Rg.t += dt;
  while (Rg.acc >= RAG_H) { Rg.acc -= RAG_H; ragSubstep(Rg, fx, fz); }
  let fast = 0;
  for (let i = 0; i < Rg.pos.length; i++) fast = Math.max(fast, Rg.pos[i].distanceTo(Rg.prev[i]) / RAG_H);
  Rg.still = fast < 0.5 ? Rg.still + dt : 0;
  return Rg.still > 0.4 || Rg.t > 7;
}

// turn the points back into the rig: where the body is, which way the torso points, and every limb's angle
const _rm = new THREE.Matrix4(), _rq = new THREE.Quaternion(), _rqi = new THREE.Quaternion(), _ry = new THREE.Quaternion(), _rl = new THREE.Quaternion();
const _ru = new THREE.Vector3(), _rr = new THREE.Vector3(), _rb = new THREE.Vector3(), _rv = new THREE.Vector3(), RAG_DOWN = new THREE.Vector3(0, -1, 0), RAG_Y = new THREE.Vector3(0, 1, 0);
function mapRag(p, pts, yaw) {
  const r = p.rig, pel = ragMid(pts, 7, 8), sh = ragMid(pts, 1, 2);
  _ru.subVectors(sh, pel).normalize();
  _rr.subVectors(pts[2], pts[1]).add(_rv.subVectors(pts[8], pts[7]));
  _rr.addScaledVector(_ru, -_rr.dot(_ru)).normalize();
  _rb.crossVectors(_rr, _ru);
  _rm.makeBasis(_rr, _ru, _rb); _rq.setFromRotationMatrix(_rm);          // the torso's tilt in the plane's frame
  p.g.rotation.set(0, yaw, 0);
  _ry.setFromAxisAngle(RAG_Y, yaw);
  r.core.quaternion.copy(_ry).invert().multiply(_rq);
  r.core.position.y = 0.85; r.hips.position.y = -0.12;
  // put the body where the hips are
  const sy = p.g.scale.y, c = _rv.set(0, 0.12 * sy, 0).applyQuaternion(_rq).add(pel);
  p.g.position.set(c.x, c.y - 0.85 * sy, c.z);
  // limbs: each bone points from one point to the next
  _rqi.copy(_rq).invert();
  for (let i = 0; i < 2; i++) for (const [up, low, a, b, e] of [['arm', 'fore', 1, 3, 5], ['thigh', 'shin', 7, 9, 11]]) {
    _rv.subVectors(pts[b + i], pts[a + i]).normalize().applyQuaternion(_rqi);
    r[up][i].quaternion.setFromUnitVectors(RAG_DOWN, _rv);
    _rl.copy(r[up][i].quaternion).invert();
    _rv.subVectors(pts[e + i], pts[b + i]).normalize().applyQuaternion(_rqi).applyQuaternion(_rl);
    r[low][i].quaternion.setFromUnitVectors(RAG_DOWN, _rv);
  }
}

// a ragdoll in the air or sliding about: simulate it, show it, and work out where it's ended up
function updateRagdoll(p, dt) {
  cabinForces(p, force);
  const done = stepRag(p, dt, force.x, force.z);
  mapRag(p, p.rag.pos, p.rag.yaw);
  const pel = ragMid(p.rag.pos, 7, 8);
  p.x = pel.x; p.z = pel.z;
  const g = groundAt(p.x, p.z);
  p.y = g !== null && pel.y < g + 1 ? g : pel.y - 0.7;
  return done;
}
// Getting back up, with physics too. Springs pull each body point toward where it would be if the person were
// standing right there; they start weak and get stronger, so the heap heaves itself up, overshoots, bounces
// and wobbles like a bouncy toy until it's standing still. Then the ragdoll hands back to the normal animation
// (and since the body is already in the standing shape by then, there's no jump).
const LIMB_KEYS = ['arm', 'fore', 'thigh', 'shin'];
const captureLimbs = p => LIMB_KEYS.map(k => p.rig[k].map(j => j.quaternion.clone()));
// where each body point would be if they stood at (x, y, z) facing yaw
function standPoints(p, x, y, z, yaw) {
  const r = p.rig, save = { pos: p.g.position.clone(), yaw: p.g.rotation.y, q: r.core.quaternion.clone(), limbs: captureLimbs(p), pose: p.pose };
  p.g.position.set(x, y, z); p.g.rotation.set(0, yaw, 0); r.core.quaternion.identity();
  p.pose = 'stand'; animatePax(p);
  const pts = ragPoints(p);
  p.g.position.copy(save.pos); p.g.rotation.set(0, save.yaw, 0); r.core.quaternion.copy(save.q); p.pose = save.pose;
  LIMB_KEYS.forEach((k, n) => r[k].forEach((j, i) => j.quaternion.copy(save.limbs[n][i])));
  return pts;
}
function startGetUp(p) {
  const Rg = p.rag, pel = ragMid(Rg.pos, 7, 8), g = groundAt(pel.x, pel.z);
  // stand up facing whichever way is least twisting for the body as it's lying (try 12 directions)
  let best = null, bestErr = 1e9, bestYaw = Rg.yaw;
  for (let k = 0; k < 12; k++) {
    const yaw = Rg.yaw + k * Math.PI / 6, t = standPoints(p, pel.x, g === null ? p.y : g, pel.z, yaw);
    let e = 0; for (let i = 0; i < t.length; i++) { const dx = t[i].x - Rg.pos[i].x, dz = t[i].z - Rg.pos[i].z; e += dx * dx + dz * dz; }
    if (e < bestErr) { bestErr = e; best = t; bestYaw = yaw; }
  }
  Rg.targets = best; Rg.yaw = bestYaw;
  Rg.upT = 0; Rg.done = 0;
}
// one frame of springing up; returns true once they're standing steady
function stepGetUp(p, dt) {
  const Rg = p.rag;
  Rg.upT += dt;
  const ramp = clamp(Rg.upT / 0.8, 0, 1);
  Rg.k = 45 * ramp * ramp; Rg.damp = 2.2 * ramp; Rg.lift = ramp;   // springy, so it bounces
  stepRag(p, dt, 0, 0);
  mapRag(p, Rg.pos, Rg.yaw);
  // standing steady? (on average close to the standing shape, nothing wildly off, and not still bouncing)
  let err = 0, worst = 0, fast = 0;
  for (let i = 0; i < Rg.pos.length; i++) { const e = Rg.pos[i].distanceTo(Rg.targets[i]); err += e / Rg.pos.length; worst = Math.max(worst, e); fast = Math.max(fast, Rg.pos[i].distanceTo(Rg.prev[i]) / RAG_H); }
  Rg.done = err < 0.1 && worst < 0.5 && fast < 0.5 ? Rg.done + dt : 0;
  return Rg.done > 0.12 || Rg.upT > 4;
}
