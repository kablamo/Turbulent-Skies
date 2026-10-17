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
  const T = Rg.k > 0 ? Rg.targets : null, k = Rg.k || 0, c = Rg.damp || 0, kw = Rg.kw, tv = Rg.tv;
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i], q = prev[i];
    const vx = (p.x - q.x) * 0.998, vy = (p.y - q.y) * 0.998, vz = (p.z - q.z) * 0.998;
    let ax = fx, ay = -RAG_G, az = fz;
    if (T) {
      // each point is pulled toward its target (some parts stiffer than others), and its speed toward the
      // target's speed, so a body that's walking along doesn't drag behind
      const w = kw ? kw[i] : 1, tx = tv ? tv[i].x : 0, ty = tv ? tv[i].y : 0, tz = tv ? tv[i].z : 0;
      ax += k * w * (T[i].x - p.x) + c * w * (tx - vx / RAG_H);
      ay += k * w * (T[i].y - p.y) + c * w * (ty - vy / RAG_H) + RAG_G * Rg.lift;   // (the muscles hold the body's whole weight up)
      az += k * w * (T[i].z - p.z) + c * w * (tz - vz / RAG_H);
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
    S.ignoreVeh = i >= 3 && i <= 6 ? Rg.ignoreVeh : null;   // (your hands can be on the trolley you're holding)
    const blocked = (p.x !== q.x || p.z !== q.z) && !ragCanGo(q, p);
    S.ignoreVeh = null;
    if (blocked) {
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
  // your body parts don't go through bags: pushed out onto the surface (so hands touch, not sink in)
  if (Rg.solidBags) {
    const pel = pos[7];
    for (const it of items) {
      if (!(it.state === 'pile' || it.state === 'ride' || it.state === 'free') || !it.g.visible || it.extra) continue;
      const c = it.g.position;
      if (Math.abs(c.x - pel.x) > 2.5 || Math.abs(c.z - pel.z) > 2.5) continue;
      for (let i = 0; i < pos.length; i++) {
        const p = pos[i], b = bagPush(it, p.x, p.y, p.z, RAG_R[i] * 0.8);
        if (!b) continue;
        // out of the box: through the top if it's only just in from above, otherwise out the nearest side
        const top = it.y + (it.h || 0.4) + RAG_R[i] * 0.8 - p.y;
        if (top < b.depth) { p.y += top; prev[i].y += top; }
        else { p.x += b.dx * b.depth; p.z += b.dz * b.depth; prev[i].x += b.dx * b.depth; prev[i].z += b.dz * b.depth; }
      }
    }
  }
  // pinned points (a hand gripping something, or a wrist someone else is holding) go exactly where they're held
  if (Rg.pins) for (const pin of Rg.pins) pos[pin.i].copy(pin.pos);
}
// can a body point move from q to p? (high up in the cabin it sails over the seats; only the hull stops it)
const ragCanGo = (q, p) => (p.y > 1.15 && insideHull(q.x, q.z) && insideHull(p.x, p.z)) || canGo(q.x, q.z, p.y, p.x, p.z);
// Joints that only bend the way real ones do, so nobody ends up in a bone-breaking pose:
// knees only bend backwards and elbows only forwards (no bending the wrong way), legs can't swing up behind
// the back or cross through each other, and arms can't go through the body.
const _ja = new THREE.Vector3(), _jf = new THREE.Vector3(), _jx = new THREE.Vector3(), _jr = new THREE.Vector3(), _ju = new THREE.Vector3(), _jb = new THREE.Vector3(), _jd = new THREE.Vector3(), _je = new THREE.Vector3(), _jc = new THREE.Vector3();
function ragLimits(pos, prev, Rg) {
  if (Rg.targets && Rg.k > 1) return;   // (while the springs are on they already pull toward a natural pose)
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

// ---------------------------------------------------------------- your character: an active ragdoll
// Your body is a ragdoll all the time. Each frame the normal animation (walking, carrying, pushing…) says where
// every body point *should* be, and springs pull the ragdoll's points toward those spots: stiff in the hips and
// chest so you stay upright, looser in the arms and legs so they swing and flop. So you wobble, lag and sway,
// and bumping into things knocks you about. Get thrown (or hold R) and the springs switch off: you go limp
// and tumble for real. Let go / come to rest and the springs come back on, and you heave yourself back up.
//   0 head · 1/2 shoulders · 3/4 elbows · 5/6 hands · 7/8 hips · 9/10 knees · 11/12 feet
const ACTIVE_KW = [0.55, 0.8, 0.8, 0.3, 0.3, 0.22, 0.22, 1, 1, 0.55, 0.55, 0.6, 0.6];
const ACTIVE_K = 170, ACTIVE_DAMP = 9;
const _zero = () => new THREE.Vector3();
function activeRag(a, dt, yaw, adjust) {
  dt = Math.max(dt, 1e-3);
  const goal = ragPoints(a);                                 // where the animation has put each point this frame
  let Rg = a.rag;
  const far = Rg && goal.some((t, i) => t.distanceTo(Rg.pos[i]) > 1.6);
  if (!Rg || (far && !Rg.limp)) {
    // first time, or we've been teleported: start (again) exactly in the animated pose, standing still
    startRag(a, 0, 0, 0); Rg = a.rag;
    Rg.pos.forEach((v, i) => { v.copy(goal[i]); Rg.prev[i].copy(goal[i]); });
    Rg.tv = goal.map(_zero); Rg.targets = goal; Rg.ramp = 1;
    a.feet = null; a.comPrev = null; a.comV = null;   // (and the feet start fresh under you)
  }
  if (adjust) adjust(goal);                                  // stepping feet, reaching hands…
  // how fast each target is moving (so the springs don't make you trail behind when walking)
  Rg.tv = goal.map((t, i) => Rg.targets ? t.clone().sub(Rg.targets[i]).divideScalar(dt) : _zero());
  if (Rg.tv.some(v => v.lengthSq() > 400)) Rg.tv = goal.map(_zero);
  Rg.targets = goal; Rg.kw = a.kwOverride || ACTIVE_KW;
  // springs: off while limp, then fading back in as you get up
  if (Rg.limp) Rg.ramp = 0; else Rg.ramp = Math.min(1, (Rg.ramp || 0) + dt / 0.9);
  const r = Rg.ramp * Rg.ramp;
  Rg.k = ACTIVE_K * r; Rg.damp = ACTIVE_DAMP * r; Rg.lift = r;
  stepRag(a, dt, 0, 0);
  mapRag(a, Rg.pos, yaw);
}
// go limp (thrown, or holding R), flying off at velocity v
function goLimp(a, vx = 0, vy = 0, vz = 0) {
  const Rg = a.rag; if (!Rg) return;
  if (!Rg.limp && (vx || vy || vz)) Rg.prev.forEach((q, i) => q.copy(Rg.pos[i]).sub(new THREE.Vector3(vx, vy, vz).multiplyScalar(RAG_H)));
  Rg.limp = true; Rg.limpT = 0; Rg.still = 0;
}

// ---------------------------------------------------------------- stepping to keep your balance
// The feet aren't animated: each one stays planted where it is. Every frame we work out where the body's
// weight is heading (the "capture point": the centre of mass plus a bit of its speed). If that drifts too
// far from between the feet, one foot swings out to catch you, landing a little ahead of where you're falling.
// Walking falls out of this by itself: you lean into moving, start to topple, and your feet keep catching you.
// Get shoved by someone and the same thing makes you stumble.
const _bc = new THREE.Vector3(), _bv = new THREE.Vector3();
function footHeight(a) { if (a.footH === undefined) a.footH = standPoints(a, 0, 0, 0, 0)[11].y; return a.footH; }
function balanceFeet(a, goal, dt, yaw, onGround) {
  const Rg = a.rag, sc = a.g.scale.y, fh = footHeight(a);
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  // where each foot would be standing comfortably: under its hip (the real one, where the body actually is)
  const spot = (i, x, z) => { const g = groundAt(x, z); return new THREE.Vector3(x, (g === null ? P.y : g) + fh, z); };
  const home = i => { const h = Rg.pos[7 + i], s = i ? 1 : -1; return spot(i, h.x + rx * s * 0.03, h.z + rz * s * 0.03); };
  const lost = a.feet && a.feet.some((f, i) => Math.hypot(f.pos.x - Rg.pos[7 + i].x, f.pos.z - Rg.pos[7 + i].z) > 2);
  if (!a.feet || lost || Rg.limp || !onGround) {
    // limp or in the air: the legs just do what they do; once back down, the feet start from where they are
    a.feet = [0, 1].map(i => ({ pos: spot(i, Rg.pos[11 + i].x, Rg.pos[11 + i].z), swing: null }));
    a.balT = 0;
    if (Rg.limp || !onGround) return;
  }
  // centre of mass (mostly the hips and chest) and how fast it's moving
  _bc.copy(Rg.pos[7]).add(Rg.pos[8]).multiplyScalar(0.25).addScaledVector(Rg.pos[1], 0.17).addScaledVector(Rg.pos[2], 0.17).addScaledVector(Rg.pos[0], 0.16);
  if (a.comPrev) _bv.subVectors(_bc, a.comPrev).divideScalar(dt); else _bv.set(0, 0, 0);
  a.comV = a.comV ? a.comV.lerp(_bv, Math.min(1, dt * 12)) : _bv.clone();
  a.comPrev = (a.comPrev || new THREE.Vector3()).copy(_bc);
  const speed = Math.hypot(a.comV.x, a.comV.z);
  const cpx = _bc.x + a.comV.x * 0.28, cpz = _bc.z + a.comV.z * 0.28;   // where the weight is going
  const F = a.feet, supX = (F[0].pos.x + F[1].pos.x) / 2, supZ = (F[0].pos.z + F[1].pos.z) / 2;
  const offX = cpx - supX, offZ = cpz - supZ, off = Math.hypot(offX, offZ);
  const swinging = F.some(f => f.swing);
  a.balT = (a.balT || 0) + dt;
  const dur = clamp(0.26 - speed * 0.035, 0.11, 0.26);   // quicker steps the faster you go
  if (!swinging && speed > 0.35) {
    // on the move: walk in a rhythm. Each foot wants to be a little ahead of its hip (where the body's going);
    // the one that's fallen furthest behind that spot steps next, landing ahead so it stays useful for a while
    const want = i => { const h = home(i); h.x += a.comV.x * 0.16; h.z += a.comV.z * 0.16; return h; };
    const behind = F.map((f, i) => { const w = want(i); return Math.hypot(f.pos.x - w.x, f.pos.z - w.z); });
    let i = behind[0] >= behind[1] ? 0 : 1;
    if (a.lastFoot === i && behind[1 - i] > behind[i] * 0.5) i = 1 - i;   // take turns
    const half = clamp(speed * 0.16, 0.08, 0.45) * sc;
    if (behind[i] > half || (a.balT > 0.45 && behind[i] > 0.06)) {
      const w = want(i); let tx = w.x + a.comV.x * dur * 0.6, tz = w.z + a.comV.z * dur * 0.6;
      const fp = F[i].pos, len = Math.hypot(tx - fp.x, tz - fp.z), max = 1.8 * sc;
      if (len > max) { tx = fp.x + (tx - fp.x) * max / len; tz = fp.z + (tz - fp.z) * max / len; }
      F[i].swing = { from: fp.clone(), to: spot(i, tx, tz), t: 0, dur };
      a.lastFoot = i; a.balT = 0;
    }
  } else if (!swinging) {
    const fromHome = F.map((f, i) => { const h = home(i); return Math.hypot(f.pos.x - h.x, f.pos.z - h.z); });
    const fall = off > 0.14 * sc, stray = Math.max(...fromHome) > 0.42 * sc, tidy = speed < 0.25 && Math.max(...fromHome) > 0.09 * sc && a.balT > 0.35;
    if (fall || stray || tidy) {
      // step with the foot that's furthest behind the way you're falling (or furthest out of place)
      let i;
      if (fall) { const d0 = (F[0].pos.x - supX) * offX + (F[0].pos.z - supZ) * offZ, d1 = (F[1].pos.x - supX) * offX + (F[1].pos.z - supZ) * offZ; i = d0 <= d1 ? 0 : 1; }
      else i = fromHome[0] >= fromHome[1] ? 0 : 1;
      if (a.lastFoot === i && !fall && fromHome[1 - i] > 0.09 * sc) i = 1 - i;   // take turns
      const h = home(i), lead = 0.3;
      let tx = h.x + a.comV.x * lead, tz = h.z + a.comV.z * lead;
      const fp = F[i].pos, len = Math.hypot(tx - fp.x, tz - fp.z), max = 1.5 * sc;
      if (len > max) { tx = fp.x + (tx - fp.x) * max / len; tz = fp.z + (tz - fp.z) * max / len; }
      F[i].swing = { from: fp.clone(), to: spot(i, tx, tz), t: 0, dur };
      a.lastFoot = i; a.balT = 0;
    }
  }
  for (let i = 0; i < 2; i++) {
    const f = F[i];
    if (f.swing) {
      const w = f.swing; w.t += dt;
      const k = Math.min(1, w.t / w.dur);
      f.pos.lerpVectors(w.from, w.to, k); f.pos.y += Math.sin(Math.PI * k) * 0.13 * sc;   // lift the foot as it swings
      if (k >= 1) { f.pos.copy(w.to); f.swing = null; }
    }
    goal[11 + i].copy(f.pos);
    // the knee: straight above the foot, so the lower leg stays upright and the shoe sits flat on the ground
    // (the model has no ankle: its shoe turns with the lower leg). Only if that can't work, bend it forwards.
    const H = goal[7 + i], L1 = Rg.len[14 + i * 2], L2 = Rg.len[15 + i * 2];
    const kx = f.pos.x, ky = f.pos.y + L2, kz = f.pos.z, toHip = Math.hypot(H.x - kx, H.y - ky, H.z - kz);
    if (toHip < L1 * 1.15 && ky < H.y) { goal[9 + i].set(kx, ky, kz); continue; }
    _bv.subVectors(f.pos, H); let d = _bv.length() || 1e-3; _bv.divideScalar(d); d = Math.min(d, L1 + L2 - 1e-3);
    const along = (L1 * L1 - L2 * L2 + d * d) / (2 * d), up = Math.sqrt(Math.max(0, L1 * L1 - along * along));
    const bx = fx - _bv.x * (fx * _bv.x + fz * _bv.z), by = -_bv.y * (fx * _bv.x + fz * _bv.z), bz = fz - _bv.z * (fx * _bv.x + fz * _bv.z);
    const bl = Math.hypot(bx, by, bz) || 1;
    goal[9 + i].set(H.x + _bv.x * along + bx / bl * up, H.y + _bv.y * along + by / bl * up, H.z + _bv.z * along + bz / bl * up);
  }
}
