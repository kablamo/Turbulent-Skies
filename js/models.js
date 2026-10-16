// Custom characters made in Blender (models/passenger.glb). If the file loads, every passenger wears it,
// colored with their own random skin/shirt/pants/shoes/hair; if it can't load (e.g. opened straight from
// a file instead of a web server) they keep the built-in round look.
//
// The game still animates the built-in rig (now invisible, it's what you click on), and poseModel()
// copies those joint angles onto the model's bones every frame.
'use strict';
const MODEL = { url: 'models/passenger.glb', proto: null, joints: null };
const normName = s => (s || '').toLowerCase().replace(/[^a-z]/g, '');
// bone names we understand, for each joint of the game's rig (with l/r or left/right on the end)
const JOINT_NAMES = {
  arm: ['shoulder', 'arm', 'upperarm'], fore: ['elbow', 'fore', 'forearm', 'lowerarm'],
  thigh: ['thigh', 'upperleg', 'leg'], shin: ['knee', 'shin', 'lowerleg', 'calf'], neck: ['neck', 'head'],
};
const MAT_SLOTS = { skin: 'skin', shirt: 'shirt', pants: 'pants', shoe: 'shoes', shoes: 'shoes', hair: 'hair' };
const ARM_SPREAD = 0.3;   // the arms hang slightly out from the body so they don't sink into a round tummy

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
  // the lower arm and leg line up with the upper one, so a bent rest pose comes out straight
  for (const [up, low] of [['arm', 'fore'], ['thigh', 'shin']]) for (let i = 0; i < 2; i++) {
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
  return joints;
}

function applyModel(p) {
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
  poseModel(p);
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

if (THREE.GLTFLoader && THREE.SkeletonUtils) {
  new THREE.GLTFLoader().load(MODEL.url, gltf => {
    try {
      const scene = gltf.scene;
      // drop stray empties that came along from the Blender file
      for (const o of [...scene.children]) if (!o.children.length && !o.isMesh && !o.isBone) scene.remove(o);
      MODEL.joints = prepareModel(scene);
      MODEL.proto = scene;
      passengers.forEach(applyModel);
    } catch (e) { console.warn('Custom passenger model failed, using the built-in people:', e); }
  }, undefined, () => console.info('No custom passenger model (needs a web server); using the built-in people.'));
}
