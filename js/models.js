// Custom characters made in Blender (models/passenger.glb). If the file loads, every passenger wears it,
// colored with their own random skin/shirt/pants/shoes/hair; if it can't load (e.g. opened straight from
// a file instead of a web server) they keep the built-in round look.
// Also from Blender: curly hair (hair.glb), a backpack (backpack.glb), luggage (luggage.glb) and the trolley.
//
// The game still animates the built-in rig (now invisible, it's what you click on), and poseModel()
// copies those joint angles onto the model's bones every frame.
'use strict';
const MODEL = { url: 'models/passenger.glb', proto: null, joints: null, curls: null, backpack: null };
const normName = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
// bone names we understand, for each joint of the game's rig (with l/r or left/right on the end)
const JOINT_NAMES = {
  arm: ['shoulder', 'arm', 'upperarm'], fore: ['elbow', 'fore', 'forearm', 'lowerarm'],
  thigh: ['thigh', 'upperleg', 'leg'], shin: ['knee', 'shin', 'lowerleg', 'calf'], neck: ['neck', 'head'],
};
const MAT_SLOTS = { skin: 'skin', shirt: 'shirt', pants: 'pants', shoe: 'shoes', shoes: 'shoes', hair: 'hair' };
const ARM_SPREAD = 0;   // extra outward angle for the arms, on top of the game's own small one

function findBone(root, names, side) {
  const ends = side === undefined ? [''] : side ? ['r', 'right'] : ['l', 'left'];
  let hit = null;
  root.traverse(o => {
    if (hit || !o.isBone) return;
    const n = normName(o.name);
    for (const b of names) for (const e of ends) if (n === b + e || n === e + b) hit = o;
  });
  return hit;
}
const qInv = q => q.clone().invert();
const restQ = o => { const q = new THREE.Quaternion(); o.getWorldQuaternion(q); return q; };
const DOWN = new THREE.Vector3(0, -1, 0);

// work out, once, how each bone sits in the model's rest pose (T-pose, A-pose, whatever)
function prepareModel(scene) {
  scene.updateMatrixWorld(true);
  const joints = {};
  for (const [part, names] of Object.entries(JOINT_NAMES)) {
    const list = part === 'neck' ? [findBone(scene, names)] : [findBone(scene, names, 0), findBone(scene, names, 1)];
    joints[part] = list.map((bone, i) => {
      if (!bone) return null;
      const rest = restQ(bone), dir = new THREE.Vector3(0, 1, 0).applyQuaternion(rest);
      let hang = rest;   // legs keep the stance they were modelled in
      if (part === 'arm') {
        // arms swing down from however they were modelled, to hang by the sides
        const s = i ? 1 : -1, target = DOWN.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), s * ARM_SPREAD);
        hang = new THREE.Quaternion().setFromUnitVectors(dir, target).multiply(rest);
      }
      return { name: bone.name, rest, hang, parentRest: restQ(bone.parent) };
    });
  }
  // the forearm lines up with the lowered upper arm (the shins already point down in the model's stance)
  for (const [up, low] of [['arm', 'fore']]) for (let i = 0; i < 2; i++) {
    const U = joints[up][i], L = joints[low][i];
    if (!U || !L) continue;
    const udir = new THREE.Vector3(0, 1, 0).applyQuaternion(U.hang), ldir = new THREE.Vector3(0, 1, 0).applyQuaternion(L.rest);
    L.hang = new THREE.Quaternion().setFromUnitVectors(ldir, udir).multiply(L.rest);
  }
  // where the hips are, so the model's feet land on the floor
  const box = new THREE.Box3().setFromObject(scene);
  const hipBone = joints.thigh[0] ? scene.getObjectByName(joints.thigh[0].name) : null;
  const hip = new THREE.Vector3(); if (hipBone) hipBone.getWorldPosition(hip); else hip.set(0, (box.max.y - box.min.y) * 0.35, 0);
  MODEL.footY = box.min.y; MODEL.hipY = hip.y - box.min.y; MODEL.centerZ = hip.z;
  // every bone's rest position, so things like a pilot's hat can be pinned onto them
  MODEL.restMat = {};
  scene.traverse(o => { if (o.isBone) MODEL.restMat[o.name] = o.matrixWorld.clone(); });
  // the torso: between the hips and the neck, inside the shoulders (for backpacks and other accessories)
  const shoulder = joints.arm[1] && scene.getObjectByName(joints.arm[1].name);
  const shX = shoulder ? Math.abs(new THREE.Vector3().setFromMatrixPosition(shoulder.matrixWorld).x) + 0.1 : 0.35;
  const torso = new THREE.Box3(), tv = new THREE.Vector3();
  const neckY0 = joints.neck[0] ? new THREE.Vector3().setFromMatrixPosition(scene.getObjectByName(joints.neck[0].name).matrixWorld).y : box.max.y * 0.65;
  scene.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { tv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (tv.y > hip.y && tv.y < neckY0 && Math.abs(tv.x) < shX) torso.expandByPoint(tv); }
  });
  const T = torso.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.3, hip.y, hip.z - 0.3), new THREE.Vector3(0.3, neckY0, hip.z + 0.3)) : torso;
  MODEL.body = { cx: 0, cz: (T.min.z + T.max.z) / 2, r: (T.max.x - T.min.x) / 2, rz: (T.max.z - T.min.z) / 2,
    yMid: T.min.y + (T.max.y - T.min.y) * 0.55, yWaist: T.min.y + (T.max.y - T.min.y) * 0.2, yNeck: neckY0, neckR: 0.14, s: 1.15 };
  // the model's own hair, so other hairdos can be lined up with it
  MODEL.hairBox = new THREE.Box3();
  scene.traverse(o => { if (o.isMesh && normName(o.material.name).startsWith('hair')) MODEL.hairBox.expandByObject(o); });
  // the head: everything above the neck joint
  const neck = joints.neck[0] && scene.getObjectByName(joints.neck[0].name), neckY = neck ? new THREE.Vector3().setFromMatrixPosition(neck.matrixWorld).y : box.max.y - 0.5;
  MODEL.head = new THREE.Box3();
  const v = new THREE.Vector3();
  scene.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y > neckY + 0.02) MODEL.head.expandByPoint(v); }
  });
  return joints;
}

function applyModel(p) {
  if (p.model) return;
  const m = THREE.SkeletonUtils.clone(MODEL.proto);
  const bones = {};
  for (const part in MODEL.joints) bones[part] = MODEL.joints[part].map(j => j && m.getObjectByName(j.name));
  m.traverse(o => {
    if (!o.isMesh) return;
    o.frustumCulled = false;   // skinned meshes move away from their rest-pose bounds
    const slot = MAT_SLOTS[normName(o.material.name).replace(/\d+$/, '')];
    const src = slot && p.mats[slot];
    o.material = o.material.clone();
    o.material.skinning = true;
    if (src) o.material.color.copy(src.color);
  });
  // the built-in body stays (invisible) as the thing you click on and the anchor for speech bubbles
  p.rig.hips.traverse(o => { if (o.isMesh) o.visible = false; });
  p.rig.core.add(m);
  p.model = { root: m, bones };
  if (p.pilot) pilotOutfit(p);
  // some people get the curly hairdo instead
  if (MODEL.curls && bones.neck[0] && ['afro', 'mohawk', 'bun'].includes(p.hairStyle)) {
    m.traverse(o => { if (o.isMesh && normName(o.material.name).startsWith('hair')) o.visible = false; });
    pinToBone(bones.neck[0], restClone(MODEL.curls, p.mats.hair.color), 0, 0, 0);
  }
  // backpacks and friends ride on the body bone (the balloon is tied to the body already)
  const bodyBone = MODEL.joints.neck[0] && m.getObjectByName(MODEL.proto.getObjectByName(MODEL.joints.neck[0].name).parent.name);
  if (bodyBone && p.acc && p.acc.length) {
    const accRoot = new THREE.Group();
    pinToBone(bodyBone, accRoot, 0, 0, 0);
    const own = MODEL.backpack && p.acc.includes('backpack');   // the Blender backpack
    if (own) accRoot.add(restClone(MODEL.backpack, p.accCol));
    buildAccessories(accRoot, p.acc.filter(a => a !== 'balloon' && !(own && a === 'backpack')), MODEL.body, p.accCol);
  }
  poseModel(p);
}
// a copy of something modelled in place on the character (its rest pose), with its colour parts tinted
function restClone(proto, color) {
  const c = proto.clone();
  c.traverse(o => { if (o.isMesh && o.userData.tint && color) { o.material = o.material.clone(); o.material.color.copy(color); } });
  return c;
}
// pin something onto a bone, given where it should sit on the model in its rest pose
function pinToBone(bone, obj, x, y, z) {
  if (!bone) return;
  const inv = MODEL.restMat[bone.name].clone().invert();
  obj.position.set(x, y, z).applyMatrix4(inv);
  obj.quaternion.setFromRotationMatrix(inv);
  bone.add(obj);
}
// other players: a captain's hat, gold-striped shoulders and a tie
function pilotOutfit(p) {
  const { bones } = p.model, h = MODEL.head;
  const cx = (h.min.x + h.max.x) / 2, cz = (h.min.z + h.max.z) / 2, r = Math.max(h.max.x - h.min.x, h.max.z - h.min.z) / 2 * 0.9;
  const gold = mat(0xffd34a, { metalness: .8, roughness: .3 }), navy = mat(0x1d2a4a), white = mat(0xf7f8fb);
  const hat = new THREE.Group();
  cyl(r * 0.8, r * 0.78, 0.07, M.dark, 0, 0.035, 0, hat);                       // black band
  cyl(r * 0.82, r * 0.8, 0.12, white, 0, 0.13, 0, hat);                          // white crown
  cyl(r * 0.95, r * 0.86, 0.06, white, 0, 0.21, 0, hat);                         // wide flat top
  cyl(r * 0.81, r * 0.81, 0.02, gold, 0, 0.075, 0, hat);                         // gold trim
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.75, 0.025, 20, 1, false, Math.PI / 2, Math.PI), M.dark);
  visor.position.set(0, 0.01, -r * 0.35); visor.rotation.x = -0.12; visor.scale.z = 0.8; hat.add(visor);
  box(0.13, 0.08, 0.02, gold, 0, 0.12, -r * 0.82, hat);                          // badge
  pinToBone(bones.neck[0], hat, cx, h.max.y - r * 0.2, cz);
  // epaulettes lie flat on top of the shoulders (on the body, so they stay put when the arms swing)
  const bodyB = bones.neck[0] && bones.neck[0].parent;
  for (let i = 0; i < 2; i++) {
    const b = bones.arm[i]; if (!b || !bodyB) continue;
    const head = new THREE.Vector3().setFromMatrixPosition(MODEL.restMat[b.name]);
    const ep = new THREE.Group(), s = i ? 1 : -1;
    box(0.2, 0.03, 0.17, navy, 0, 0, 0, ep);
    for (let k = 0; k < 3; k++) box(0.025, 0.035, 0.175, gold, -0.06 + k * 0.05, 0.002, 0, ep);
    pinToBone(bodyB, ep, head.x - s * 0.06, MODEL.body.yNeck + 0.01, MODEL.body.cz);
  }
  // a tie down the front of the tummy
  const body = p.model.root.getObjectByName(MODEL.joints.neck[0] ? MODEL.proto.getObjectByName(MODEL.joints.neck[0].name).parent.name : '');
  if (body) {
    const tie = new THREE.Group(), red = mat(0xb3202a);
    box(0.07, 0.06, 0.03, red, 0, 0, 0, tie);
    const blade = box(0.09, 0.26, 0.025, red, 0, -0.16, 0, tie); blade.rotation.x = 0.25;
    pinToBone(body, tie, 0, h.min.y - 0.05, MODEL.centerZ - 0.3);
  }
}

const _R = new THREE.Quaternion(), _R2 = new THREE.Quaternion(), _W1 = new THREE.Quaternion(), _W2 = new THREE.Quaternion(), _E = new THREE.Euler();
const _Z = new THREE.Vector3(0, 0, 1);
// copy the game rig's joint angles onto the model's bones
function poseModel(p) {
  const r = p.rig, { root, bones } = p.model, J = MODEL.joints;
  // the game rig's hips sit at 0.73m standing; line the model's hips up with that, a bit higher when seated
  const hy = r.hips.position.y + 0.12 + (p.pose === 'sit' ? 0.11 : 0);
  root.position.set(0, -r.core.position.y - MODEL.footY + hy, -MODEL.centerZ);
  for (let i = 0; i < 2; i++) for (const [up, low] of [['arm', 'fore'], ['thigh', 'shin']]) {
    const U = J[up][i], L = J[low][i];
    if (!U) continue;
    _R.setFromEuler(_E.copy(r[up][i].rotation));
    _W1.copy(_R).multiply(U.hang);
    bones[up][i].quaternion.copy(qInv(U.parentRest)).multiply(_W1);
    if (!L) continue;
    _R2.setFromEuler(_E.copy(r[low][i].rotation));
    _W2.copy(_R).multiply(_R2).multiply(L.hang);
    bones[low][i].quaternion.copy(_W1).invert().multiply(_W2);
  }
  const N = J.neck[0];
  if (N) {
    _R.setFromAxisAngle(_Z, r.head.rotation.z);
    bones.neck[0].quaternion.copy(qInv(N.parentRest)).multiply(_R).multiply(N.rest);
  }
}

// ---------------------------------------------------------------- loading
const loadGLB = url => new Promise(ok => new THREE.GLTFLoader().load(url, g => ok(g.scene), undefined, () => ok(null)));
// the parts of a material that take a colour: anything called "... color" (but not straps)
const tintable = m => /colou?r|^bag/.test(normName(m.name)) && !/strap/.test(normName(m.name));
// pull the meshes out of a file, keeping where they were modelled; tag the tintable ones
function grabMeshes(scene, test) {
  scene.updateMatrixWorld(true);
  const g = new THREE.Group();
  scene.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh || !test(o)) return;
    const c = o.clone(); c.matrixAutoUpdate = true;
    o.matrixWorld.decompose(c.position, c.quaternion, c.scale);
    c.userData.tint = tintable(o.material);
    g.add(c);
  });
  return g.children.length ? g : null;
}
// the curly hair: if it was modelled off to the side (or floating), sit it on the head where the model's own hair is
function fitCurls(g) {
  const nb = new THREE.Box3().setFromObject(g), old = MODEL.hairBox;
  if (old.isEmpty()) return g;
  const nc = nb.getCenter(new THREE.Vector3()), oc = old.getCenter(new THREE.Vector3());
  // centre it side to side by the middle of all its points (a stray curl sticking out shouldn't push it over)
  let sx = 0, n = 0; const v = new THREE.Vector3();
  g.updateMatrixWorld(true);
  g.traverse(o => { if (!o.isMesh) return; const pos = o.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { sx += v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld).x; n++; } });
  if (n) nc.x = sx / n;
  const inPlace = Math.abs(nc.x - oc.x) < 0.15 && nb.min.y < old.max.y - 0.1;
  if (!inPlace) for (const o of g.children) o.position.add(new THREE.Vector3(oc.x - nc.x, old.min.y - 0.03 - nb.min.y, oc.z - 0.045 - nc.z));
  for (const o of g.children) o.userData.tint = true;   // it takes each person's hair colour
  return g;
}
// luggage: one file, several bags. Each is recognised by its name or its material
const LUGGAGE = {};
const BAG_KEYS = [['backpack', /backpack/], ['briefcase', /briefcase/], ['suitcase', /suitcase/]];
function prepareLuggage(scene) {
  scene.updateMatrixWorld(true);
  const found = [];
  scene.traverse(o => { if (o.isMesh && !found.some(f => f.node === (o.parent === scene ? o : o.parent))) found.push({ node: o.parent === scene ? o : o.parent }); });
  for (const { node } of found) {
    const names = [normName(node.name)];
    node.traverse(o => { if (o.isMesh) names.push(normName(o.material.name)); });
    const key = (BAG_KEYS.find(([, re]) => names.some(n => re.test(n))) || [])[0];
    if (!key || LUGGAGE[key]) continue;
    const g = grabMeshes(node, () => true);
    // sit it on the ground, centred
    const bb = new THREE.Box3().setFromObject(g), c = bb.getCenter(new THREE.Vector3());
    for (const o of g.children) o.position.sub(new THREE.Vector3(c.x, bb.min.y, c.z));
    const size = bb.getSize(new THREE.Vector3());
    g.userData.h = size.y; g.userData.hw = size.x / 2; g.userData.hd = size.z / 2; g.userData.r = clamp(Math.max(size.x, size.z) * 0.35, 0.2, 0.55);
    LUGGAGE[key] = g;
  }
  items.forEach(reskinBag);
}
function reskinBag(it) {
  const proto = LUGGAGE[it.type.model];
  if (!proto || it.reskinned) return;
  const g = it.g, tint = g.userData.tint;
  for (const o of [...g.children]) { g.remove(o); o.traverse(m => { const i = targets.indexOf(m); if (i >= 0) targets.splice(i, 1); }); }
  const m = restClone(proto, tint);
  m.traverse(o => { if (o.isMesh) { o.userData.item = it; targets.push(o); } });
  g.add(m);
  it.h = proto.userData.h; it.hw = proto.userData.hw; it.hd = proto.userData.hd; it.r = proto.userData.r; it.reskinned = true;
}
// the luggage trolley: scaled to fit the game, its colour parts painted, and swapped in for the stand-in boxes
function prepareTrolley(src) {
  const copies = trolleys.map((v, i) => i ? src.clone() : src);   // copy before fitting, so each starts fresh
  trolleys.forEach((v, i) => fitTrolley(v, copies[i]));
}
function fitTrolley(v, scene) {
  const s = TROLLEY.scale;
  scene.scale.setScalar(s);
  scene.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(scene), c = bb.getCenter(new THREE.Vector3());
  scene.position.set(-c.x, GROUND - bb.min.y, -c.z);
  const wheels = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    if (/cylinder|wheel/.test(normName(o.name))) { o.material = M.dark; wheels.push(o); }
    else if (tintable(o.material) || !o.material.name) o.material = v.paint || TROLLEY.color;
  });
  v.g.add(scene);
  v.standIn.visible = false;
  if (wheels.length) v.wheels = wheels;
}

// (started once every script has run, since a quick download could otherwise land before net.js exists)
if (THREE.GLTFLoader && THREE.SkeletonUtils) window.addEventListener('DOMContentLoaded', () => {
  loadGLB('models/plane.glb').then(s => { try { dressPlane(s); } catch (e) { console.warn('Plane model failed:', e); dressPlane(null); } });
  loadGLB(TROLLEY.url).then(s => { if (s) try { prepareTrolley(s); } catch (e) { console.warn('Trolley model failed:', e); } });
  loadGLB('models/luggage.glb').then(s => { if (s) try { prepareLuggage(s); } catch (e) { console.warn('Luggage models failed:', e); } });
  Promise.all([MODEL.url, 'models/hair.glb', 'models/backpack.glb'].map(loadGLB)).then(([scene, hair, pack]) => {
    if (!scene) return console.info('No custom passenger model (needs a web server); using the built-in people.');
    try {
      // drop stray empties that came along from the Blender file
      for (const o of [...scene.children]) if (!o.children.length && !o.isMesh && !o.isBone) scene.remove(o);
      MODEL.joints = prepareModel(scene);
      MODEL.proto = scene;
      const curls = hair && grabMeshes(hair, () => true);
      if (curls) MODEL.curls = fitCurls(curls);
      if (pack) MODEL.backpack = grabMeshes(pack, o => /back ?pack|bag/.test(o.material.name.toLowerCase()));
      passengers.forEach(applyModel);
      // other players (anyone already in the room)
      for (const id in avatars) applyModel(avatars[id]);
      NET.remotes.forEach(r => applyModel(r.avatar));
    } catch (e) { console.warn('Custom passenger model failed, using the built-in people:', e); }
  });
});
else window.addEventListener('DOMContentLoaded', () => dressPlane(null));
