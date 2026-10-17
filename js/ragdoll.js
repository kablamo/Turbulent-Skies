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
  for (let i = 0; i < pos.length; i++) {
    const p = pos[i], q = prev[i];
    const vx = (p.x - q.x) * 0.998, vy = (p.y - q.y) * 0.998, vz = (p.z - q.z) * 0.998;
    q.copy(p);
    p.x += vx + fx * h2; p.y += vy - RAG_G * h2; p.z += vz + fz * h2;
  }
  // bones keep their length (a few passes, so they settle together)
  for (let it = 0; it < 5; it++) {
    for (let k = 0; k < RAG_STICKS.length; k++) ragStick(pos[RAG_STICKS[k][0]], pos[RAG_STICKS[k][1]], Rg.len[k], false);
    for (let k = 0; k < RAG_BEND.length; k++) ragStick(pos[RAG_BEND[k][0]], pos[RAG_BEND[k][2]], Rg.bend[k], true);
  }
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
      q.x = p.x - (p.x - q.x) * 0.75; q.z = p.z - (p.z - q.z) * 0.75;   // and friction
    }
    if (insideHull(p.x, p.z)) {
      const top = CY + Math.sqrt(Math.max(0, R * R - p.x * p.x)) - r - 0.1;
      if (p.y > top) { p.y = top; q.y = Math.max(q.y, p.y); }
    }
  }
}
// can a body point move from q to p? (high up in the cabin it sails over the seats; only the hull stops it)
const ragCanGo = (q, p) => (p.y > 1.15 && insideHull(q.x, q.z) && insideHull(p.x, p.z)) || canGo(q.x, q.z, p.y, p.x, p.z);
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
// Getting up out of a heap, like a person would: first the arms and legs untwist and gather in, then the
// knees bend and the arms push forward as the body rises, and finally they straighten up to standing.
const GETUP_T = 1.3, LIMB_KEYS = ['arm', 'fore', 'thigh', 'shin'];
const captureLimbs = p => LIMB_KEYS.map(k => p.rig[k].map(j => j.quaternion.clone()));
const _se = new THREE.Euler(), _sq = new THREE.Quaternion(), _sx = new THREE.Quaternion(), RAG_X = new THREE.Vector3(1, 0, 0);
function getupLimbs(p, from, t) {
  const kl = smooth01(clamp(t / 0.8, 0, 1));                 // limbs untwist toward standing
  const kb = smooth01(clamp((t - 0.3) / (GETUP_T - 0.3), 0, 1));   // the body rises
  const push = Math.sin(Math.PI * kb);                        // a crouch-and-push in the middle of standing up
  LIMB_KEYS.forEach((key, n) => p.rig[key].forEach((j, i) => {
    const s = i ? 1 : -1;
    if (key === 'arm') _se.set(0, 0, s * 0.12); else if (key === 'fore') _se.set(0.1, 0, 0); else if (key === 'thigh') _se.set(0, 0, s * 0.04); else _se.set(0, 0, 0);
    _sq.setFromEuler(_se);
    j.quaternion.copy(from[n][i]).slerp(_sq, kl);
    const bend = { arm: 0.7, fore: 0.6, thigh: 1.2, shin: -1.6 }[key] * push;
    j.quaternion.premultiply(_sx.setFromAxisAngle(RAG_X, bend));
  }));
  return kb;
}
// the body rights itself and moves from where it lay to standing on its feet
function ragGetUp(p, k) {
  const u = p.ragUp;
  p.rig.core.quaternion.copy(u.q).slerp(_rq.identity(), k);
  p.g.position.lerpVectors(u.from, u.to, k);
  p.g.position.y -= Math.sin(Math.PI * k) * 0.22 * p.g.scale.y;   // hips low while crouching on the way up
}
