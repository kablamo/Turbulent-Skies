// Luggage and passengers: what they look like, how they move, and carrying/throwing them.
'use strict';
const mat = (c, o) => std(c, Object.assign({ roughness: .7 }, o));
function sph(r, m, x, y, z, parent, scale) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m);
  s.position.set(x, y, z); if (scale) s.scale.set(...scale); parent.add(s); return s;
}

// ---------------------------------------------------------------- cargo
// Each type builds its model into g (facing -z). `alive` cargo wanders about on its own once it's loose.
const BAGS = {
  // suitcase, backpack and briefcase swap to the Blender ones in models/luggage.glb once it loads (models.js), keeping their colour
  suitcase: { name: 'suitcase', r: 0.32, model: 'suitcase', build: g => { const c = mat(new THREE.Color().setHSL(Math.random(), .6, .45)); g.userData.tint = c.color; box(0.45, 0.6, 0.25, c, 0, 0.3, 0, g); box(0.2, 0.06, 0.04, M.dark, 0, 0.63, 0, g); for (const s of [-1, 1]) box(0.47, 0.04, 0.27, mat(0xffcc33), 0, 0.3 + s * 0.15, 0, g); } },
  backpack: { name: 'backpack', r: 0.3, model: 'backpack', build: g => {
    const c = mat(new THREE.Color().setHSL(Math.random(), .65, .45)); g.userData.tint = c.color;
    box(0.45, 0.3, 0.7, c, 0, 0.15, 0, g); box(0.34, 0.1, 0.3, mat(c.color.clone().multiplyScalar(0.6)), 0, 0.33, 0.12, g);
  } },
  briefcase: { name: 'briefcase', r: 0.3, model: 'briefcase', build: g => {
    const c = mat(pick([0x5a3a22, 0x222222, 0x8a5a2b, 0xb03030, 0x2f4f8f])); g.userData.tint = c.color;
    box(0.6, 0.16, 0.62, c, 0, 0.08, 0, g); box(0.2, 0.05, 0.04, M.dark, 0, 0.18, -0.25, g);
  } },
  duck: { name: 'giant rubber duck', r: 0.42, whole: true, build: g => {
    const y = mat(0xffd21a, { roughness: .3 });
    sph(0.38, y, 0, 0.36, 0.05, g, [1, 0.8, 1.2]); sph(0.22, y, 0, 0.78, -0.2, g);
    box(0.18, 0.06, 0.18, mat(0xff7a1a), 0, 0.74, -0.42, g);
    for (const s of [-1, 1]) { sph(0.045, M.white, s * 0.1, 0.84, -0.38, g); sph(0.022, M.dark, s * 0.1, 0.84, -0.42, g); }
    sph(0.12, y, 0, 0.5, 0.48, g, [1, 0.6, 1]);
  } },
  gnome: { name: 'garden gnome', r: 0.25, build: g => {
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 14), mat(0x2f5fb3)); body.position.y = 0.2; g.add(body);
    sph(0.12, mat(0xffd0a8), 0, 0.46, 0, g);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 12), M.white); beard.position.set(0, 0.34, -0.06); beard.rotation.x = Math.PI; g.add(beard);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.34, 14), mat(0xd8342c)); hat.position.y = 0.68; hat.rotation.z = 0.25; g.add(hat);
    sph(0.03, mat(0xff8080), 0, 0.46, -0.12, g);
  } },
  tuba: { name: 'tuba', r: 0.35, build: g => {
    const gold = mat(0xe8b830, { metalness: .9, roughness: .25 });
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 10, 20), gold); coil.position.y = 0.35; g.add(coil);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.07, 0.4, 18, 1, true), mat(0xe8b830, { metalness: .9, roughness: .25, side: THREE.DoubleSide }));
    bell.position.set(0, 0.75, 0); g.add(bell);
  } },
  cactus: { name: 'potted cactus', r: 0.25, build: g => {
    cyl(0.2, 0.15, 0.3, mat(0xc0603a), 0, 0.15, 0, g);
    const green = mat(0x3f9a45);
    cyl(0.1, 0.1, 0.65, green, 0, 0.62, 0, g); sph(0.1, green, 0, 0.95, 0, g);
    for (const s of [-1, 1]) { cyl(0.06, 0.06, 0.25, green, s * 0.16, 0.7 + s * 0.05, 0, g); box(0.12, 0.06, 0.08, green, s * 0.1, 0.6 + s * 0.05, 0, g); }
    sph(0.04, mat(0xff5fa0), 0, 1.06, 0, g);
  } },
  toilet: { name: 'spare toilet', r: 0.35, build: g => {
    box(0.4, 0.4, 0.5, M.porcelain, 0, 0.2, 0, g); box(0.44, 0.05, 0.52, M.white, 0, 0.43, 0, g);
    box(0.42, 0.45, 0.16, M.porcelain, 0, 0.6, 0.25, g); box(0.1, 0.03, 0.05, M.steel, 0.12, 0.82, 0.22, g);
  } },
  moose: { name: 'stuffed moose head', r: 0.4, whole: true, build: g => {
    box(0.5, 0.6, 0.06, M.wood, 0, 0.45, 0.2, g);
    const brown = mat(0x6b4423);
    box(0.28, 0.32, 0.4, brown, 0, 0.45, -0.05, g); box(0.2, 0.18, 0.25, brown, 0, 0.36, -0.3, g);
    for (const s of [-1, 1]) {
      box(0.35, 0.05, 0.18, mat(0xd9c39a), s * 0.32, 0.72, 0, g);
      for (let i = 0; i < 3; i++) box(0.04, 0.14, 0.04, mat(0xd9c39a), s * (0.2 + i * 0.1), 0.8, 0, g);
      sph(0.03, M.dark, s * 0.09, 0.52, -0.25, g);
    }
  } },
  fishtank: { name: 'fish tank', r: 0.35, build: g => {
    box(0.6, 0.45, 0.35, std(0x9fd4ff, { transparent: true, opacity: .35, roughness: .1 }), 0, 0.23, 0, g);
    box(0.56, 0.3, 0.31, std(0x3a8fd8, { transparent: true, opacity: .5 }), 0, 0.17, 0, g);
    const f = new THREE.Sprite(emojiMat('🐠')); f.scale.set(0.2, 0.2, 1); f.position.set(0, 0.2, 0); g.add(f); g.userData.fish = f;
  } },
  croc: { name: 'crocodile', r: 0.6, whole: true, cage: true, alive: { speed: 0.5, kind: 'croc' }, build: g => {
    const green = mat(0x3f7a35), belly = mat(0x9ab35a);
    box(0.45, 0.2, 1.0, green, 0, 0.16, 0, g); box(0.38, 0.06, 0.9, belly, 0, 0.06, 0, g);
    box(0.3, 0.13, 0.45, green, 0, 0.17, -0.68, g);                     // head + upper jaw
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) box(0.025, 0.05, 0.025, M.white, s * 0.13, 0.09, -0.5 - i * 0.08, g);
    const jaw = new THREE.Group(); jaw.position.set(0, 0.1, -0.48); g.add(jaw);
    box(0.28, 0.05, 0.42, belly, 0, -0.02, -0.2, jaw);
    for (const s of [-1, 1]) { sph(0.05, mat(0xffdd33), s * 0.09, 0.26, -0.55, g); sph(0.025, M.dark, s * 0.09, 0.28, -0.59, g); }
    const tail = new THREE.Group(); tail.position.set(0, 0.15, 0.5); g.add(tail);
    box(0.28, 0.14, 0.6, green, 0, 0, 0.3, tail); box(0.14, 0.08, 0.45, green, 0, 0, 0.8, tail);
    for (let i = 0; i < 6; i++) box(0.06, 0.06, 0.06, green, 0, 0.29, -0.4 + i * 0.16, g);   // spiky back
    for (const [x, z] of [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]]) box(0.1, 0.1, 0.12, green, x, 0.05, z, g);
    g.userData.jaw = jaw; g.userData.tail = tail;
    // a travel cage (he will get out of it eventually)
    const cage = new THREE.Group(); g.add(cage); g.userData.cage = cage;
    const bar = M.steel, base = mat(0x6b5a3a);
    box(0.78, 0.05, 2.1, base, 0, 0.025, 0, cage);
    for (const y of [0.05, 0.62]) for (const s of [-1, 1]) box(0.04, 0.04, 2.1, bar, s * 0.37, y, 0, cage);
    for (let i = 0; i <= 8; i++) { const z = -1.03 + i * 2.06 / 8; for (const s of [-1, 1]) box(0.03, 0.6, 0.03, bar, s * 0.37, 0.34, z, cage); box(0.74, 0.03, 0.03, bar, 0, 0.62, z, cage); }
    for (const z of [-1.03, 1.03]) for (let k = 0; k < 5; k++) box(0.03, 0.6, 0.03, bar, -0.3 + k * 0.15, 0.34, z, cage);
    textPlane(0.5, 0.16, 'DO NOT OPEN', '#ffdd33', '#222', cage, 0.39, 0.42, 0, Math.PI / 2, 'bold 40px sans-serif');
  } },
  chicken: { name: 'chicken', r: 0.2, alive: { speed: 1.2, kind: 'chicken' }, build: g => {
    sph(0.16, M.white, 0, 0.26, 0, g, [1, 0.9, 1.25]);
    sph(0.09, M.white, 0, 0.45, -0.13, g);
    box(0.03, 0.07, 0.08, mat(0xe02020), 0, 0.55, -0.13, g);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 8), mat(0xffa020)); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.44, -0.24); g.add(beak);
    for (const s of [-1, 1]) {
      sph(0.018, M.dark, s * 0.05, 0.47, -0.2, g);
      cyl(0.012, 0.012, 0.14, mat(0xffa020), s * 0.06, 0.07, 0, g);
    }
    const wings = [-1, 1].map(s => { const w = new THREE.Group(); w.position.set(s * 0.14, 0.3, 0); g.add(w); sph(0.08, M.white, s * 0.04, -0.03, 0.02, w, [0.4, 0.8, 1.4]); return w; });
    g.userData.wings = wings;
  } },
  // ---- cargo you can do things with (cargo.js has what they do). `loose` ones sit round the edge of the pile.
  beachball: { name: 'beach ball', r: 0.3, bouncy: true, loose: true, build: g => {
    const tex = canvasTex(128, 64, (c, w, h) => { ['#ff3b3b', '#ffffff', '#2f7bff', '#ffd400', '#ffffff', '#2fd16b'].forEach((col, i) => { c.fillStyle = col; c.fillRect(i * w / 6, 0, w / 6 + 1, h); }); });
    sph(0.3, new THREE.MeshStandardMaterial({ map: tex, roughness: .35 }), 0, 0.3, 0, g);
  } },
  boombox: { name: 'boombox', r: 0.32, loose: true, build: g => {
    box(0.62, 0.34, 0.2, mat(0x2a2a33), 0, 0.17, 0, g);
    for (const s of [-1, 1]) { const sp = cyl(0.11, 0.11, 0.04, mat(0x111111), s * 0.17, 0.17, -0.1, g); sp.rotation.x = Math.PI / 2; const c = cyl(0.04, 0.04, 0.05, M.steel, s * 0.17, 0.17, -0.11, g); c.rotation.x = Math.PI / 2; }
    box(0.14, 0.06, 0.03, mat(0x55ffaa, { emissive: 0x115533 }), 0, 0.27, -0.105, g);
    box(0.5, 0.04, 0.04, M.steel, 0, 0.4, 0, g); for (const s of [-1, 1]) box(0.04, 0.08, 0.04, M.steel, s * 0.23, 0.36, 0, g);
  } },
  balloons: { name: 'bunch of balloons', r: 0.25, floaty: true, loose: true, build: g => {
    box(0.16, 0.12, 0.16, mat(0x777777), 0, 0.06, 0, g);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, x = Math.cos(a) * 0.16, z = Math.sin(a) * 0.16, y = 1.25 + (i % 3) * 0.12;
      sph(0.16, mat(new THREE.Color().setHSL(i / 6, 0.85, 0.55), { roughness: .25 }), x, y, z, g, [1, 1.2, 1]);
      const st = cyl(0.004, 0.004, y - 0.1, M.white, x / 2, (y + 0.1) / 2, z / 2, g); st.rotation.set(z * 0.3, 0, -x * 0.3);
    }
  } },
  pizza: { name: 'pizza boxes', r: 0.3, loose: true, build: g => {
    g.userData.slices = [0, 1, 2].map(k => { const b = box(0.5, 0.055, 0.5, mat(0xc8a26a), 0, 0.03 + k * 0.06, 0, g); return b; });
    textPlane(0.36, 0.12, '🍕 PIZZA', '#c8a26a', '#b3202a', g, 0, 0.185, 0, 0, 'bold 44px sans-serif').rotation.x = -Math.PI / 2;
  } },
  cat: { name: 'cat', r: 0.3, cage: true, loose: true, alive: { speed: 1.1, kind: 'cat' }, build: g => {
    const fur = mat(0xf2a33a);
    sph(0.15, fur, 0, 0.16, 0.05, g, [1, 0.9, 1.5]); sph(0.11, fur, 0, 0.26, -0.17, g);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), fur); e.position.set(s * 0.06, 0.37, -0.17); g.add(e); sph(0.022, mat(0x2a8a2a), s * 0.04, 0.28, -0.27, g); }
    const tail = new THREE.Group(); tail.position.set(0, 0.2, 0.25); g.add(tail); const tl = cyl(0.025, 0.02, 0.32, fur, 0, 0.14, 0.04, tail); tl.rotation.x = -0.4; g.userData.tail = tail;
    // its travel carrier (it'll squeeze out sooner or later)
    const cage = new THREE.Group(); g.add(cage); g.userData.cage = cage;
    const shell = mat(0xff8fc8);
    box(0.44, 0.04, 0.66, shell, 0, 0.02, 0, cage); box(0.44, 0.04, 0.66, shell, 0, 0.44, 0, cage);
    for (const s of [-1, 1]) box(0.04, 0.44, 0.66, shell, s * 0.22, 0.22, 0, cage);
    box(0.44, 0.44, 0.04, shell, 0, 0.22, 0.33, cage);
    for (let k = 0; k < 5; k++) box(0.025, 0.4, 0.025, M.steel, -0.16 + k * 0.08, 0.22, -0.33, cage);
    box(0.2, 0.04, 0.04, shell, 0, 0.5, 0, cage);
  } },
  mystery: { name: 'mystery box', r: 0.28, loose: true, build: g => {
    box(0.44, 0.38, 0.44, mat(0xd8342c), 0, 0.19, 0, g);
    for (const r of [0, Math.PI / 2]) box(0.46, 0.4, 0.07, mat(0xffd34a), 0, 0.2, 0, g).rotation.y = r;
    const lid = new THREE.Group(); lid.position.y = 0.38; g.add(lid); g.userData.lid = lid;
    box(0.48, 0.07, 0.48, mat(0xd8342c), 0, 0.035, 0, lid); sph(0.07, mat(0xffd34a), -0.05, 0.1, 0, lid, [1.4, 0.7, 0.7]); sph(0.07, mat(0xffd34a), 0.05, 0.1, 0, lid, [1.4, 0.7, 0.7]);
    // a spring snake, hidden inside until someone opens it…
    const snake = new THREE.Group(); snake.visible = false; snake.position.y = 0.3; g.add(snake); g.userData.snake = snake;
    for (let k = 0; k < 7; k++) cyl(0.09, 0.09, 0.07, mat(k % 2 ? 0x2fd16b : 0xffd400), 0, k * 0.08, 0, snake);
    sph(0.1, mat(0x2fd16b), 0, 0.6, 0, snake); for (const s of [-1, 1]) sph(0.025, M.dark, s * 0.04, 0.64, -0.08, snake);
  } },
  popper: { name: 'party popper crate', r: 0.3, loose: true, popper: true, build: g => {
    box(0.5, 0.36, 0.4, M.wood, 0, 0.18, 0, g);
    textPlane(0.44, 0.14, 'PARTY! 🎉', '#8a5a2b', '#ffe066', g, 0, 0.2, -0.205, Math.PI, 'bold 40px sans-serif');
    for (let k = 0; k < 4; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 10), mat(new THREE.Color().setHSL(k / 4, 0.8, 0.55))); c.position.set(-0.15 + k * 0.1, 0.42, 0); c.rotation.x = Math.PI; g.add(c); }
  } },
  // a cartoon nuke. Don't press the button. (Someone will press the button.)
  nuke: { name: 'nuke', r: 0.45, loose: true, build: g => {
    const body = mat(0x4a5a3a, { metalness: .4, roughness: .5 });
    sph(0.36, body, 0, 0.4, 0, g, [1, 1, 1.35]);
    const nose = sph(0.2, body, 0, 0.4, -0.42, g);
    for (const r of [0, Math.PI / 2]) box(0.04, 0.4, 0.3, body, 0, 0.4, 0.55, g).rotation.z = r;   // tail fins
    for (let k = 0; k < 8; k++) box(0.1, 0.1, 0.06, mat(k % 2 ? 0x111111 : 0xffd400), Math.cos(k / 8 * Math.PI * 2) * 0.34, 0.4 + Math.sin(k / 8 * Math.PI * 2) * 0.34, 0.1, g);
    for (const s of [-1, 1]) textPlane(0.5, 0.16, 'NUKE ☢ DO NOT DROP', '#4a5a3a', '#ffd400', g, s * 0.365, 0.45, -0.05, s * Math.PI / 2, 'bold 34px sans-serif');
    const btn = cyl(0.06, 0.07, 0.05, mat(0xff1a1a, { emissive: 0x440000 }), 0, 0.78, -0.05, g); g.userData.button = btn;
  } },
  egg: { name: 'egg', r: 0.08, extra: true, build: g => { sph(0.06, mat(0xfff4dc, { roughness: .3 }), 0, 0.08, 0, g, [1, 1.3, 1]); } },
};
// a point (x, y, z) against a bag's box: how far it pokes in, and which way to push it out (null if outside)
function bagPush(it, x, y, z, pad) {
  const [lx, lz] = turnY(x - it.x, z - it.z, -(it.g.rotation.y || 0)), hw = (it.hw || it.r || 0.3) + pad, hd = (it.hd || it.r || 0.3) + pad;
  if (Math.abs(lx) >= hw || Math.abs(lz) >= hd || y < it.y - pad || y > it.y + (it.h || 0.4) + pad) return null;
  // out through the nearest side
  const ex = hw - Math.abs(lx), ez = hd - Math.abs(lz);
  const [wx, wz] = ex < ez ? turnY(Math.sign(lx) || 1, 0, it.g.rotation.y || 0) : turnY(0, Math.sign(lz) || 1, it.g.rotation.y || 0);
  return { depth: Math.min(ex, ez), dx: wx, dz: wz };
}
const turnY = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
const bagBox = g => { g.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(g); return b.isEmpty() ? new THREE.Box3(new THREE.Vector3(-0.2, 0, -0.2), new THREE.Vector3(0.2, 0.4, 0.2)) : b; };
// the luggage for this flight
// mostly the Blender bags (suitcases, backpacks, briefcases), plus a few silly things
const MANIFEST = ['suitcase', 'croc', 'backpack', 'suitcase', 'duck', 'briefcase', 'suitcase', 'chicken', 'backpack', 'briefcase', 'tuba', 'moose'];
// bag states: queue (waiting inside the terminal) → belt → ride (on the trolley) → free (physics) / held / gone
const items = [];
function spawnBag(type) {
  const g = new THREE.Group();
  type.build(g); plane.add(g); g.visible = false;
  const it = { kind: 'bag', type, name: type.name, alive: type.alive, extra: type.extra, g, x: BELT_X, y: BELT_Y, z: BELT_START, vx: 0, vy: 0, vz: 0, r: type.r,
    state: 'queue', spinY: rand(0, 6), heading: rand(0, 6), wanderT: 0, eggT: rand(15, 30), slot: null, phase: rand(0, 10), caged: !!type.cage, h: bagBox(g).max.y, hw: (bagBox(g).max.x - bagBox(g).min.x) / 2, hd: (bagBox(g).max.z - bagBox(g).min.z) / 2 };
  g.traverse(o => { if (o.isMesh) { o.userData.item = it; targets.push(o); } });
  items.push(it);
  return it;
}

// ---------------------------------------------------------------- passengers
const FIRST = ['Gary', 'Big Steve', 'Dolores', 'Sir Reginald', 'Gertrude', 'Tiny Tim', 'Bartholomew', 'Mei', 'Doris', 'Kofi', 'Priya', 'Captain Kevin', 'Yuki', 'Nana Joan', 'Carlos', 'Ivan',
  'Brenda', 'Uncle Fergus', 'Olu', 'Madame Fifi', 'Sven', 'Agnes', 'Hamish', 'Lola'];
// passenger states: terminal (wandering) → toBus → inBus → bus → walk/wait → seated, plus held / air / down / gone
const passengers = [];
// a limb hanging down from a joint; rotate the returned pivot to move it
function limb(len, r0, r1, mat, parent, x, y, z) {
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 12), mat); m.position.y = -len / 2; pivot.add(m);
  sph(r1, mat, 0, -len, 0, pivot);   // rounded joint
  return pivot;
}
// A round, jointed, slightly ridiculous person. g sits at their feet and holds their facing;
// `core` is a pivot in the middle of the body so they can tumble and lie down.
function makePassenger(name, plain) {
  const skin = mat(pick([0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac]));
  const shirt = mat(new THREE.Color().setHSL(Math.random(), 0.7, 0.55));
  const pants = mat(new THREE.Color().setHSL(Math.random(), 0.45, 0.35));
  const shoes = mat(pick([0x222222, 0x5a3a22, 0xeeeeee, 0xff3366]));
  const hairMat = mat(pick([0x2a1a10, 0x6b4423, 0xd9b26f, 0x111111, 0xcccccc, 0x8a3b12, 0x3399ff, 0xff66cc]), { roughness: .9 });
  const g = new THREE.Group(); plane.add(g);
  const core = new THREE.Group(); core.position.y = 0.85; g.add(core);
  const hips = new THREE.Group(); core.add(hips);
  sph(0.27, shirt, 0, 0.3, 0, hips, [1, 1.05, 0.9]);                  // a big round tummy
  sph(0.21, pants, 0, 0.04, 0, hips, [1.1, 0.6, 0.85]);
  sph(0.05, mat(new THREE.Color().setHSL(Math.random(), 0.7, 0.6)), 0, 0.38, -0.24, hips);   // a button
  const head = new THREE.Group(); head.position.y = 0.78; hips.add(head);
  sph(0.2, skin, 0, 0, 0, head, [1, 0.95, 0.95]);
  // googly eyes, rosy cheeks, a round nose and a mouth that smiles or frowns
  const pupils = [];
  for (const s of [-1, 1]) {
    const white = sph(0.062, M.white, s * 0.075, 0.045, -0.165, head);
    pupils.push(sph(0.03, M.dark, 0, 0, -0.045, white));
    sph(0.035, mat(0xff8f9a), s * 0.125, -0.045, -0.145, head);
  }
  sph(0.045, Math.random() < 0.15 ? mat(0xff2a2a, { roughness: .3 }) : skin, 0, -0.01, -0.2, head);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 14, Math.PI), M.dark);
  mouth.position.set(0, -0.095, -0.17); mouth.rotation.z = Math.PI; head.add(mouth);
  // hair
  const style = pick(['cap', 'cap', 'afro', 'mohawk', 'bald', 'bun']);
  if (style === 'cap' || style === 'bun') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.205, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    cap.position.y = 0.02; cap.rotation.x = 0.35; head.add(cap);
    if (style === 'bun') sph(0.08, hairMat, 0, 0.17, 0.14, head);
  } else if (style === 'afro') sph(0.27, hairMat, 0, 0.08, 0.06, head, [1, 0.95, 0.9]);
  else if (style === 'mohawk') for (let i = 0; i < 5; i++) box(0.04, 0.1, 0.07, hairMat, 0, 0.2 - Math.abs(i - 2) * 0.015, -0.12 + i * 0.07, head);
  // hats, glasses and mustaches
  let prop = null;
  const hat = Math.random() < 0.55 ? pick(['top', 'party', 'propeller', 'cowboy', 'chef']) : null;
  const top = style === 'afro' ? 0.3 : 0.18;
  if (hat === 'top') { cyl(0.13, 0.13, 0.25, M.dark, 0, top + 0.12, 0, head); cyl(0.22, 0.22, 0.02, M.dark, 0, top, 0, head); cyl(0.135, 0.135, 0.04, mat(0xd8342c), 0, top + 0.03, 0, head); }
  else if (hat === 'party') { const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 14), mat(new THREE.Color().setHSL(Math.random(), 0.8, 0.6))); c.position.set(0.03, top + 0.13, 0); c.rotation.z = -0.2; head.add(c); sph(0.03, mat(0xffee55), 0.06, top + 0.29, 0, head); }
  else if (hat === 'propeller') {
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.205, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45), mat(0x3366ff)); beanie.position.y = 0.02; head.add(beanie);
    cyl(0.01, 0.01, 0.08, M.dark, 0, top + 0.05, 0, head);
    prop = new THREE.Group(); prop.position.y = top + 0.09; head.add(prop);
    box(0.3, 0.01, 0.05, mat(0xff3333), 0, 0, 0, prop); box(0.05, 0.01, 0.3, mat(0xffee33), 0, 0, 0, prop);
  }
  else if (hat === 'cowboy') { cyl(0.3, 0.3, 0.03, mat(0x8a5a2b), 0, top, 0, head); cyl(0.13, 0.15, 0.17, mat(0x8a5a2b), 0, top + 0.09, 0, head); }
  else if (hat === 'chef') { cyl(0.14, 0.14, 0.2, M.white, 0, top + 0.08, 0, head); sph(0.17, M.white, 0, top + 0.22, 0, head, [1, 0.6, 1]); }
  if (Math.random() < 0.3) {
    const shades = Math.random() < 0.4;
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.01, 6, 16), M.dark); ring.position.set(s * 0.075, 0.045, -0.225); head.add(ring);
      if (shades) { const lens = new THREE.Mesh(new THREE.CircleGeometry(0.066, 16), M.dark); lens.position.set(s * 0.075, 0.045, -0.228); lens.rotation.y = Math.PI; head.add(lens); }
    }
    box(0.04, 0.012, 0.012, M.dark, 0, 0.05, -0.225, head);
  }
  if (Math.random() < 0.25) for (const s of [-1, 1]) { const m = sph(0.05, hairMat, s * 0.045, -0.055, -0.2, head, [1.3, 0.45, 0.6]); m.rotation.z = s * 0.3; }
  // stubby arms and legs
  const rig = { core, hips, head, pupils, mouth, prop, arm: [], fore: [], thigh: [], shin: [] };
  for (const s of [-1, 1]) {
    const arm = limb(0.24, 0.075, 0.07, shirt, hips, s * 0.3, 0.45, 0);
    const fore = limb(0.2, 0.065, 0.06, skin, arm, 0, -0.24, 0);
    sph(0.07, skin, 0, -0.22, 0, fore);
    const thigh = limb(0.34, 0.11, 0.1, pants, hips, s * 0.12, 0, 0);
    const shin = limb(0.33, 0.09, 0.085, pants, thigh, 0, -0.34, 0);
    sph(0.1, shoes, 0, -0.35, -0.05, shin, [1, 0.6, 1.5]);
    rig.arm.push(arm); rig.fore.push(fore); rig.thigh.push(thigh); rig.shin.push(shin);
  }
  // stuff people bring on holiday
  const acc = [];
  if (Math.random() < 0.8) acc.push(pick(ACCESSORIES));
  if (Math.random() < 0.35) { const b = pick(ACCESSORIES); if (!acc.includes(b) && !(ON_BACK.includes(b) && acc.some(a => ON_BACK.includes(a)))) acc.push(b); }
  if (plain) acc.length = 0;   // pilots travel light
  const accCol = new THREE.Color().setHSL(Math.random(), 0.75, 0.5);
  buildAccessories(hips, acc, PROC_BODY, accCol);
  if (acc.includes('balloon')) buildBalloon(core, accCol);
  const wide = rand(0.9, 1.3);
  g.scale.set(wide, rand(0.88, 1.06), wide).multiplyScalar(CHAR);       // everyone's a different shape
  const sprite = new THREE.Sprite(emojiMat('🙂')); sprite.scale.set(0.24, 0.24, 1); sprite.position.y = 0.5; head.add(sprite);
  const p = { kind: 'pax', name, g, rig, sprite, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.3, spin: { x: 0, z: 0 }, phase: rand(0, 10), pose: 'stand', mood: 70,
    state: 'terminal', seat: null, path: [], then: null, next: null, waitT: 0, downT: 0, off: rand(-22, 18), face: '', calling: null, angry: 0, walkT: 0, tx: 0, tz: 0, wanderT: 0, busSeat: null, bubble: null, bubbleT: 0 };
  p.mats = { skin, shirt, pants, shoes, hair: hairMat };   // a custom Blender model (models.js) borrows these colors
  p.acc = acc; p.accCol = accCol; p.hairStyle = style;
  g.traverse(o => { if (o.isMesh) { o.userData.passenger = p; targets.push(o); } });
  return p;
}
function setPose(p, pose) { p.pose = pose; }

// ---------------------------------------------------------------- accessories
const ACCESSORIES = ['backpack', 'backpack', 'pillow', 'balloon', 'fanny', 'guitar'];
const ON_BACK = ['backpack', 'guitar'];
// where things go on the built-in round body (in the hips' space; people face -z)
const PROC_BODY = { cx: 0, cz: 0, r: 0.27, rz: 0.24, yMid: 0.32, yWaist: 0.1, yNeck: 0.6, neckR: 0.13, s: 1 };
// build accessories onto `parent`, using body measurements `d` (shared by the built-in body and Blender models)
function buildAccessories(parent, acc, d, col) {
  const s = d.s, back = d.cz + d.rz, front = d.cz - d.rz;
  const c = mat(col), dark = mat(col.clone().multiplyScalar(0.55)), strap = M.dark;
  for (const a of acc) {
    if (a === 'backpack') {
      box(0.42 * s, 0.5 * s, 0.2 * s, c, d.cx, d.yMid, back + 0.08 * s, parent);
      box(0.32 * s, 0.22 * s, 0.07 * s, dark, d.cx, d.yMid - 0.1 * s, back + 0.2 * s, parent);    // front pocket
      for (const sx of [-1, 1]) box(0.05 * s, 0.05 * s, (d.rz * 2 + 0.1) * s, strap, d.cx + sx * 0.14 * s, d.yMid + 0.24 * s, d.cz + 0.02, parent);   // straps over the shoulders
    } else if (a === 'guitar') {
      const gt = new THREE.Group(); gt.position.set(d.cx, d.yMid, back + 0.09 * s); gt.rotation.z = 0.5; parent.add(gt);
      const wood = mat(0xb5651d);
      sph(0.2 * s, wood, 0, -0.12 * s, 0, gt, [1, 1.2, 0.35]); sph(0.15 * s, wood, 0, 0.14 * s, 0, gt, [1, 1, 0.35]);
      cyl(0.05 * s, 0.05 * s, 0.012, M.dark, 0, 0.0, 0.075 * s, gt).rotation.x = Math.PI / 2;
      box(0.06 * s, 0.6 * s, 0.04 * s, mat(0x3a2410), 0, 0.55 * s, 0, gt); box(0.1 * s, 0.14 * s, 0.05 * s, mat(0x3a2410), 0, 0.9 * s, 0, gt);
      box(0.04 * s, 0.04 * s, (d.rz * 2 + 0.1) * s, strap, d.cx - 0.12 * s, d.yMid + 0.2 * s, d.cz, parent);
    } else if (a === 'pillow') {
      const t = new THREE.Mesh(new THREE.TorusGeometry(d.neckR + 0.05 * s, 0.07 * s, 8, 16, Math.PI * 1.6), c);
      t.position.set(d.cx, d.yNeck, d.cz); t.rotation.set(Math.PI / 2, 0, Math.PI * 0.7); parent.add(t);
    } else if (a === 'camera') {
      box(0.18 * s, 0.12 * s, 0.08 * s, M.dark, d.cx, d.yMid + 0.05 * s, front - 0.04 * s, parent);
      cyl(0.045 * s, 0.045 * s, 0.07 * s, mat(0x333333), d.cx, d.yMid + 0.05 * s, front - 0.1 * s, parent).rotation.x = Math.PI / 2;
      box(0.03 * s, 0.03 * s, 0.03 * s, M.red, d.cx + 0.06 * s, d.yMid + 0.12 * s, front - 0.05 * s, parent);
    } else if (a === 'fanny') {
      sph(0.12 * s, c, d.cx, d.yWaist, front - 0.02 * s, parent, [1.4, 0.7, 0.6]);
      const belt = new THREE.Mesh(new THREE.TorusGeometry(d.r * 1.02, 0.02 * s, 6, 24), strap);
      belt.position.set(d.cx, d.yWaist, d.cz); belt.rotation.x = Math.PI / 2; belt.scale.y = d.rz / d.r; parent.add(belt);
    } else if (a === 'floatie') {
      // a rubber-duck pool ring around the waist
      const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r * 1.15, 0.1 * s, 10, 24), M.yellow);
      ring.position.set(d.cx, d.yWaist + 0.05 * s, d.cz); ring.rotation.x = Math.PI / 2; ring.scale.y = d.rz / d.r; parent.add(ring);
      sph(0.1 * s, M.yellow, d.cx, d.yWaist + 0.18 * s, front - 0.14 * s, parent);
      box(0.08 * s, 0.03 * s, 0.07 * s, mat(0xff8a1a), d.cx, d.yWaist + 0.17 * s, front - 0.25 * s, parent);
      for (const sx of [-1, 1]) sph(0.018 * s, M.dark, d.cx + sx * 0.04 * s, d.yWaist + 0.22 * s, front - 0.22 * s, parent);
    }
  }
}
// a balloon on a string, tied to the body (it floats above them wherever they go)
function buildBalloon(core, col) {
  const b = sph(0.25, mat(col, { roughness: .25 }), 0.45, 1.75, 0, core, [1, 1.2, 1]);
  cyl(0.004, 0.004, 1.5, M.white, 0.45, 0.8, 0, core);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 8), b.material); knot.position.set(0.45, 1.46, 0); knot.rotation.x = Math.PI; core.add(knot);
}
// Walking legs. Each leg swings forward and back; the knee bends as the leg swings through (lifting the
// foot) and straightens as it lands, then the foot stays put while the body goes over it.
function gait(t, A) {
  const th = [0, 0], sh = [0, 0];
  for (let i = 0; i < 2; i++) {
    const q = t * 8 + i * Math.PI;
    th[i] = Math.sin(q) * 0.55 * A;
    sh[i] = -(0.05 + 0.95 * Math.max(0, Math.cos(q))) * A;
  }
  return [th, sh];
}
// move the walk cycle along by a distance walked: bigger strides when going faster, and the cycle is timed
// so the planted foot moves backwards exactly as fast as the body moves forwards (no skating)
const LEG = 0.72;
function stepGait(p, dist, speed) {
  const A = clamp(0.3 + speed * 0.13, 0.3, 1.0);
  p.stride = A;
  p.walkT += dist / (LEG * 2.8 * A);
}
const SIT_LIFT = 0.6 * (1 - CHAR) / CHAR;
// put the limbs (and the googly eyes) where the current pose wants them
function animatePax(p) {
  const r = p.rig, t = S.t + p.phase;
  if (p.pose === 'frozen') { if (p.model) poseModel(p); return; }   // a ragdoll stays the way it landed
  let hy = -0.12, th = [0, 0], sh = [0, 0], ar = [0, 0], fo = [0.1, 0.1], az = [0.12, 0.12], tz = [0.04, 0.04];
  switch (p.pose) {
    case 'sit': hy = -0.33; th = [1.45, 1.45]; sh = [-1.45, -1.45]; ar = [0.35, 0.35]; fo = [0.9, 0.9]; tz = [0.1, 0.1]; break;
    case 'walk': {
      const A = p.stride ?? 0.6, s = Math.sin(p.walkT * 8);
      [th, sh] = gait(p.walkT, A);
      ar = [-s * 0.6 * A, s * 0.6 * A]; fo = [0.25 + 0.3 * A, 0.25 + 0.3 * A]; az = [0.15, 0.15];
      hy += (0.5 - Math.abs(s)) * 0.06 * A;                               // up as each leg passes under, down as it lands
      break;
    }
    case 'push': case 'carry': {
      // arms out in front (both hands on the trolley handle, or holding something), legs walking when moving
      const A = p.moving ? (p.stride ?? 0.6) : 0;
      [th, sh] = gait(p.walkT, A * 0.85);
      if (p.pose === 'push') { ar = [1.75, 1.75]; fo = [0.1, 0.1]; az = [0.05, 0.05]; }   // up and forward onto the handle bar
      else { ar = [1.05, 1.05]; fo = [0.5, 0.5]; az = [0.3, 0.3]; hy += (0.5 - Math.abs(Math.sin(p.walkT * 8))) * 0.05 * A; }
      break;
    }
    case 'pickup': {
      // squat, reach down to the floor and stand back up (pickK goes 0 → 1 → 0)
      const k = p.pickK || 0;
      hy = -0.12 - 0.28 * k; th = [1.3 * k, 1.3 * k]; sh = [-1.7 * k, -1.7 * k]; ar = [0.4 + 0.8 * k, 0.4 + 0.8 * k]; fo = [0.2, 0.2]; az = [0.25, 0.25];
      break;
    }
    case 'throw': {
      // a big two-handed fling up and forward
      const k = p.pickK || 0;
      ar = [1.0 + 1.6 * k, 1.0 + 1.6 * k]; fo = [0.3 - 0.2 * k, 0.3 - 0.2 * k]; az = [0.25, 0.25]; th = [-0.3 * k, 0.4 * k]; sh = [0, -0.5 * k];
      break;
    }
    case 'flail':
      th = [Math.sin(t * 13) * 1.1, Math.sin(t * 11 + 1) * 1.1]; sh = [-0.3 - Math.abs(Math.sin(t * 9)) * 0.9, -0.3 - Math.abs(Math.cos(t * 8)) * 0.9];
      ar = [Math.sin(t * 15) * 1.6, Math.cos(t * 14) * 1.6]; az = [1.1 + Math.sin(t * 17) * 0.7, 1.1 + Math.cos(t * 16) * 0.7]; fo = [0.5 + Math.sin(t * 12) * 0.5, 0.5 + Math.cos(t * 12) * 0.5]; tz = [0.4, 0.4];
      break;
    case 'down': th = [0.15, -0.1]; sh = [-0.25, -0.1]; ar = [0.2, -0.4]; az = [1.35, 0.9]; fo = [0.3, 0.7]; tz = [0.35, 0.45]; break;
    case 'held': th = [0.3 + Math.sin(t * 3) * 0.25, 0.2 + Math.cos(t * 3) * 0.25]; sh = [-0.5, -0.4]; ar = [Math.sin(t * 3) * 0.5, Math.cos(t * 3) * 0.5]; az = [0.4, 0.4]; fo = [0.2, 0.2]; break;
    case 'chute': th = [Math.sin(t * 1.5) * 0.3, -Math.sin(t * 1.5) * 0.3]; sh = [-0.3, -0.3]; az = [2.6, 2.6]; fo = [0.4, 0.4]; break;
    default: ar = [Math.sin(t * 1.3) * 0.05, -Math.sin(t * 1.3) * 0.05];   // standing, breathing
  }
  r.hips.position.y = hy;
  r.core.position.y = 0.85 + (p.pose === 'sit' ? SIT_LIFT : 0);   // (smaller people sit up a bit to reach the seat cushion)
  const fl = p.pose === 'walk' || p.pose === 'stand' ? (p.flop || 0) : 0, flS = p.flopS || 0;   // wobbly arms
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    r.thigh[i].rotation.set(th[i], 0, s * tz[i]);
    r.shin[i].rotation.set(sh[i], 0, 0);           // (set every axis, so nothing's left twisted from a ragdoll)
    r.arm[i].rotation.set(ar[i] + fl, 0, s * az[i] + flS);
    r.fore[i].rotation.set(fo[i], 0, 0);
  }
  const wild = p.pose === 'flail' || p.pose === 'held' ? 0.026 : 0.01;
  r.pupils.forEach((e, i) => e.position.set(Math.sin(t * 7 + i * 2) * wild, Math.cos(t * 5.3 + i) * wild, -0.045));
  const shocked = p.pose === 'flail' || p.pose === 'held' || p.pose === 'chute';
  r.mouth.rotation.z = shocked || p.mood > 45 ? Math.PI : 0;
  r.mouth.scale.set(1, shocked ? 2.4 : 1, 1);
  if (r.prop) r.prop.rotation.y = t * (p.pose === 'flail' ? 40 : 12);
  // just stopped being a ragdoll: melt from the ragdoll's pose into this one instead of snapping
  const bl = p.blend;
  if (bl) {
    const k = smooth01(clamp((S.t - bl.t0) / 0.6, 0, 1));
    LIMB_KEYS.forEach((key, n) => r[key].forEach((j, i) => j.quaternion.copy(bl.limbs[n][i]).slerp(_blq.copy(j.quaternion), k)));
    // (the body may have turned to walk off, so start from the old tilt as seen from the new heading)
    _blq2.setFromAxisAngle(RAG_Y, bl.yaw - p.g.rotation.y).multiply(bl.core);
    r.core.quaternion.copy(_blq2).slerp(_blq.identity(), k);
    p.g.position.addScaledVector(bl.off, 1 - k);
    if (k >= 1) p.blend = null;
  }
  if (p.model) poseModel(p);
}
const _blq = new THREE.Quaternion(), _blq2 = new THREE.Quaternion();
// remember the pose right now, so the next half second can blend away from it
function startPoseBlend(p, oldPos) {
  p.blend = { t0: S.t, limbs: captureLimbs(p), core: p.rig.core.quaternion.clone(), yaw: p.g.rotation.y, off: oldPos.clone().sub(p.g.position) };
}
// speech bubbles over people's heads
const bubbleCache = {};
function bubbleMat(text) {
  if (!bubbleCache[text]) {
    const tex = canvasTex(1024, 128, (g, w, h) => {
      g.font = 'bold 44px "Comic Sans MS", "Segoe UI", sans-serif';
      const tw = Math.min(w - 20, g.measureText(text).width + 40), x0 = (w - tw) / 2;
      g.fillStyle = '#fff'; g.strokeStyle = '#222'; g.lineWidth = 5;
      g.beginPath(); g.roundRect ? g.roundRect(x0, 8, tw, 84, 30) : g.rect(x0, 8, tw, 84); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(w / 2 - 14, 90); g.lineTo(w / 2, 120); g.lineTo(w / 2 + 14, 90); g.fill();
      g.fillStyle = '#222'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 52);
    });
    bubbleCache[text] = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  }
  return bubbleCache[text];
}
function shout(p, text, dur = 2.4) {
  if (!p.bubble) { p.bubble = new THREE.Sprite(); p.bubble.scale.set(3.6, 0.45, 1); p.bubble.position.y = 0.85; p.bubble.renderOrder = 997; p.rig.head.add(p.bubble); }
  p.bubble.material = bubbleMat(text); p.bubble.visible = true; p.bubbleT = dur; p.bubbleText = text;
}
const YELLS = {
  thrown: ['WHEEEEE!', 'AAAAAAAH!', 'I WANT A REFUND!', 'NOT THE FACE!', 'I CAN FLY!', 'MY HAIR!', 'THIS IS IN THE CONTRACT?!'],
  landed: ['Ow.', 'I\'m OK!', 'Again! Again!', 'My dignity…', '10/10 would fly again', 'I saw my life flash by'],
  picked: ['Put me down!', 'Ooh, a lift!', 'Unhand me!', 'Is this included in the ticket?', 'Careful, I bruise like a peach'],
  chute: ['Worth it.', 'See you at baggage claim!', 'Best. Flight. Ever.', 'Tell my cat I love her'],
  airport: ['Is that our plane? It looks… used.', 'I packed my emotional support crocodile.', 'Is the pilot ALSO the bus driver?', 'I hope they serve snacks.', 'Has anyone seen my chicken?', 'Gate 404… the gate not found?'],
  flight: ['I can see my house!', 'Was that engine always on fire?', 'Who ordered the fish?', 'I think I left the oven on.', 'This is better than a rollercoaster!', 'The captain waved at me from the wing!', 'Is it normal to hear quacking?'],
  scary: ['IT\'S FINE. EVERYTHING IS FINE.', 'Should the wing be doing that?', 'I\'d like to speak to the manager of the sky.', 'Hold me, Gary!', 'MY DRINK! MY DRINK!'],
  croc: ['CROCODILE!!', 'IT\'S EATING MY SHOE!', 'Nice crocodile… nice…', 'Is the crocodile in first class?'],
};
// limp: the body goes flying, tumbling end over end with its arms and legs flailing
// go flying as a real, physics-driven ragdoll (ragdoll.js)
function ragdoll(p, vx, vy, vz) {
  p.state = 'air'; p.pose = 'frozen';                       // the physics moves the limbs now, not an animation
  p.vx = vx; p.vy = vy; p.vz = vz;
  p.spin = { x: rand(-7, 7), z: rand(-7, 7) };
  p.blend = null;
  startRag(p, vx, vy, vz);
  shout(p, pick(YELLS.thrown));
  slideWhistle(true);
}
// far more people than the flight needs: pick who you want to take (at least PAX_NEEDED); the rest stay behind
const PAX_COUNT = 20, PAX_NEEDED = 8;
(function populate() {
  const names = [...FIRST].sort(() => Math.random() - 0.5);
  for (let i = 0; i < PAX_COUNT; i++) {
    const p = makePassenger(names[i]);
    do { p.x = rand(-17, 8); p.z = rand(TERM.z0 + 1.5, TERM.z1 - 1); } while (airportBlocked(p.x, p.z));
    p.y = GROUND; p.tx = p.x; p.tz = p.z;
    passengers.push(p);
  }
  // the luggage waits in a big heap at the end of the conveyor: far more than the flight needs, so there's
  // always one in reach. Any BAGS_NEEDED of them in the cargo bay will do.
  const spare = ['suitcase', 'backpack', 'briefcase', 'suitcase', 'backpack', 'briefcase', 'suitcase', 'backpack', 'briefcase', 'suitcase',
    'backpack', 'briefcase', 'suitcase', 'backpack', 'suitcase', 'briefcase', 'backpack', 'suitcase'];
  for (const k of [...MANIFEST, ...spare, 'beachball', 'boombox', 'balloons', 'pizza', 'cat', 'mystery', 'popper', 'nuke']) spawnBag(BAGS[k]);
  buildPile();
})();
const BAGS_NEEDED = 12;
// stack the bags into a heap: a wide bottom layer, smaller layers on top. Each bag remembers the ones it's
// resting on; take one of those away and it tumbles down.
function buildPile() {
  const cx = BELT_X - 1.6, cz = BELT_END - 2.2, list = items.filter(i => !i.extra && !i.type.loose);
  items.filter(i => i.type.loose).forEach((it, k, all) => {   // the fun stuff waits round the edge where you can see it
    const a = Math.PI * (0.3 + 1.4 * k / Math.max(1, all.length - 1));   // (spread out, so it's clear which one you're pointing at)
    it.x = cx + Math.cos(a) * 3.4; it.z = cz + Math.sin(a) * 3.4; it.y = GROUND; it.state = 'free'; it.pileUnder = [];
    it.spinY = rand(0, 6.3); it.g.visible = true; it.g.position.set(it.x, it.y, it.z); it.g.rotation.set(0, it.spinY, 0);
  });
  const layers = [], per = [14, 9, 5, 2];
  let n = 0;
  for (let L = 0; L < per.length && n < list.length; L++) {
    const ring = [], count = Math.min(per[L], list.length - n), rad = [1.35, 0.95, 0.55, 0.2][L];
    for (let k = 0; k < count; k++, n++) {
      const it = list[n], a = k / count * Math.PI * 2 + L * 0.7, r = rad * (0.55 + (k % 3) * 0.22);
      it.x = cx + Math.cos(a) * r; it.z = cz + Math.sin(a) * r;
      // sit on top of whatever's underneath here
      const under = (layers[L - 1] || []).filter(o => Math.hypot(o.x - it.x, o.z - it.z) < (o.r + it.r) * 0.95);
      it.y = GROUND + (under.length ? Math.max(...under.map(o => o.y + o.h * 0.85)) : 0);
      it.pileUnder = under; it.state = 'pile'; it.spinY = rand(0, 6.3);
      it.g.visible = true; it.g.position.set(it.x, it.y, it.z); it.g.rotation.set(0, it.spinY, 0);
      ring.push(it);
    }
    layers.push(ring);
  }
}

// ---------------------------------------------------------------- carrying & throwing
const fwd = new THREE.Vector3();
function lookDir(pp = P) { return fwd.set(-Math.sin(pp.yaw) * Math.cos(pp.pitch), Math.sin(pp.pitch), -Math.cos(pp.yaw) * Math.cos(pp.pitch)); }
function freeSlot(it) { if (it.slot) { it.slot.item = null; it.slot = null; } }
// `who` is whoever grabbed it: LOCAL (you) or a remote player
function pickUp(obj, who = LOCAL) {
  if (obj.kind === 'pax') {
    obj.rag = null; obj.blend = null;   // grabbed out of a ragdoll heap
    if (obj.seat) { obj.seat.occupant = null; obj.seat = null; }
    if (obj.busSeat) { obj.busSeat.p = null; obj.busSeat = null; }
    if (obj.state === 'seated' && inAir()) { S.needs.calm -= 4; say(`${obj.name}: "Put me DOWN!"`); }
    obj.calling = null; obj.next = null; obj.rageT = 0; setPose(obj, 'stand');
    shout(obj, pick(YELLS.picked));
  } else { freeSlot(obj); if (obj.alive && obj.alive.kind === 'chicken') quack(); }
  obj.state = 'held'; who.held = obj; obj.holder = who;
  obj.pickFrom = obj.g.position.clone(); obj.pickAt = S.t;   // it swoops up from where it was into your arms
  beep(500, .08, 'sine', .05);
}
function throwHeld(strength, who = LOCAL) {
  const o = who.held; if (!o) return;
  who.held = null; o.holder = null;
  const pp = who.pose, d = lookDir(pp);
  o.x = pp.x; o.z = pp.z; o.y = pp.y + 1.0;
  // putting something down: it goes down right where you were holding it
  const hx = o.g.position.x, hz = o.g.position.z, hy = o.g.position.y;
  if (strength <= 2 && o.kind !== 'pax') {
    // next to a trolley? it goes on the trolley (if there's room)
    const v = S.phase === 'airport' && trolleyNear(hx, hz);
    if (v) {
      const slot = trolleySpot(v, o);
      if (slot) { slot.item = o; o.slot = slot; o.state = 'ride'; o.y = Math.max(hy, slotY(v, slot)); beep(380, .08, 'triangle', .05); return; }
      say(trolleyFullMsg(v, o), 'bad');
    }
    if (canGo(pp.x, pp.z, Math.max(hy, pp.y), hx, hz)) { o.x = hx; o.z = hz; o.y = Math.max(hy, pp.y + 0.3); }
  }
  const vx = d.x * strength, vz = d.z * strength, vy = d.y * strength + (strength > 2 ? 2.5 : 0);
  o.g.rotation.set(0, pp.yaw, 0);
  if (o.kind === 'pax') {
    if (strength > 2) ragdoll(o, vx, vy, vz);
    else { o.state = 'air'; o.pose = 'stand'; o.vx = vx; o.vy = vy; o.vz = vz; o.spin = { x: 0, z: 0 }; o.rig.core.rotation.set(0, 0, 0); }
  } else { o.state = 'free'; o.vx = vx; o.vy = vy; o.vz = vz; if (o.caged && strength > 2 && Math.random() < 0.5) o.breakOut = 0.6; }   // a hard landing might pop the cage
  if (strength > 2) beep(300, .15, 'triangle', .06);
}
function updateHeld() { for (const who of [LOCAL, ...NET.remotes]) holdInFront(who); }
function holdInFront(who) {
  const o = who.held; if (!o) return;
  // in first person things sit in front of your eyes; in third person, in front of your body
  const pp = who.pose, third = isThird(who), d = third ? lookDir({ yaw: bodyYaw(who), pitch: -0.15 }) : lookDir(pp), yaw = third ? bodyYaw(who) : pp.yaw;
  // bags are held low in front (bigger ones further out, so you can still see); people lie across your arms
  const far = o.kind === 'pax' ? 1.0 : 0.55 + o.r * 0.9, low = o.kind === 'pax' ? 0.55 : third ? 0.62 : 0.85;
  o.g.position.set(pp.x + d.x * far, pp.y + EYE - low + d.y * 0.8, pp.z + d.z * far);
  if (o.kind === 'pax') {
    // carried sideways across your arms, legs dangling
    o.g.rotation.set(0, yaw, 0);
    o.rig.core.rotation.set(0, 0, Math.PI / 2);
    o.g.position.y -= 1.0;
    o.pose = 'held'; animatePax(o);
  } else { o.g.rotation.set(0, yaw, 0); if (o.alive) { const ud = o.g.userData; if (ud.jaw) ud.jaw.rotation.x = Math.abs(Math.sin(S.t * 9)) * 0.6; if (ud.wings) ud.wings.forEach((w, i) => w.rotation.z = (i ? -1 : 1) * Math.abs(Math.sin(S.t * 25)) * 1.2); } }
  const k = o.pickFrom ? clamp((S.t - o.pickAt) / PICK_T, 0, 1) : 1;
  if (k < 1) o.g.position.lerpVectors(o.pickFrom, o.g.position, k * k * (3 - 2 * k));
  else o.pickFrom = null;
}
const PICK_T = 0.4;   // how long picking something up takes (the swoop, the squat, your arms reaching down)

// ---------------------------------------------------------------- luggage
function overboard(o) {
  o.state = 'gone';
  for (let i = targets.length - 1; i >= 0; i--) if (targets[i].userData.item === o || targets[i].userData.passenger === o) targets.splice(i, 1);
}
function updateConveyor(dt) {
  beltTex.offset.y -= dt * 0.8;
  S.beltSpawnT -= dt;
  const onBelt = items.filter(i => i.state === 'belt').sort((a, b) => a.z - b.z);
  if (S.beltSpawnT <= 0 && !onBelt.some(i => i.z > BELT_START - 1)) {
    const next = items.find(i => i.state === 'queue');
    if (next) { next.state = 'belt'; next.z = BELT_START; next.g.visible = true; onBelt.push(next); }
    S.beltSpawnT = 1.6;
  }
  let limit = BELT_END;
  for (const it of onBelt) {
    it.z = Math.max(limit, it.z - 0.9 * dt); limit = it.z + 0.9;
    it.x = BELT_X; it.y = BELT_Y;
    it.g.position.set(it.x, it.y, it.z); it.g.rotation.set(0, it.spinY, 0);
  }
  // bags wait at the end of the belt until someone picks them up and puts them on the trolley
}
// the crocodile rattles about in his cage, and sooner or later he gets out
function crocBreaksOut(it) {
  it.caged = false; it.g.userData.cage.visible = false;
  if (it.state === 'held' && it.holder) { it.holder.held = null; it.holder = null; }
  if (it.state === 'held' || it.state === 'ride') {
    const a = rand(0, Math.PI * 2);   // he leaps clear
    freeSlot(it); it.state = 'free'; it.vx = Math.cos(a) * 3.5; it.vz = Math.sin(a) * 3.5; it.vy = 3; it.noCatchT = S.t + 2;
  }
  it.wanderT = 0;
  boing(); say(it.alive.kind === 'cat' ? '🐱 The cat squeezed out of its carrier! Everybody say "awww".' : '🐊 The crocodile has broken out of his cage! Everybody stay calm. (Nobody stays calm.)', it.alive.kind === 'cat' ? 'good' : 'bad');
  const near = passengers.find(p => p.state !== 'gone' && Math.hypot(p.x - it.x, p.z - it.z) < 5);
  if (near) shout(near, it.alive.kind === 'cat' ? pick(['A KITTY!', 'Awww!', 'Here, puss puss!']) : pick(YELLS.croc));
}
function updateItems(dt) {
  if (S.phase === 'airport') updateConveyor(dt);
  for (const it of items) {
    if (it.state === 'pile') {
      if (it.pileUnder.length && it.pileUnder.every(o => o.state !== 'pile')) { it.state = 'free'; it.vx = rand(-0.5, 0.5); it.vz = rand(-0.5, 0.5); it.vy = 0; }
      else continue;
    }
    if (it.caged && it.state !== 'queue' && it.state !== 'belt' && it.state !== 'gone') {
      if (it.breakOut === undefined) it.breakOut = rand(50, 100);
      const ud = it.g.userData; if (ud.jaw) ud.jaw.rotation.x = Math.max(0, Math.sin(S.t * 4 + it.phase)) * 0.4;
      if (it.state !== 'held' && Math.random() < dt * 0.4) { it.g.position.x += rand(-0.03, 0.03); it.g.rotation.y += rand(-0.04, 0.04); }   // rattle rattle
      if ((it.breakOut -= dt) <= 0) crocBreaksOut(it);
    }
    if (it.state === 'ride') {
      const tv = it.slot.v, p = vehPoint(tv, it.slot.x, it.slot.z);
      // settle down onto whatever's below (it drops when a bag under it is taken)
      it.y = Math.max(slotY(tv, it.slot), it.y - 4 * dt); it.x = p.x; it.z = p.z;
      it.g.position.set(p.x, it.y, p.z); it.g.rotation.set(0, tv.h + (it.slot === tv.whole ? 0 : it.spinY * 0.1), 0);
      continue;
    }
    if (it.state !== 'free') continue;
    // a bag thrown onto a trolley lands on it
    const tv = S.phase === 'airport' && it.vy <= 0 && !(it.noCatchT > S.t) && trolleyNear(it.x, it.z, 0.15);
    if (tv && it.y < tv.bedTop + 1.4 && it.y > tv.bedTop - 0.2) {
      const l = vehLocal(tv, it.x, it.z), slot = trolleySpot(tv, it);
      if (slot && it.y < slotY(tv, slot) + 0.3) { slot.item = it; it.slot = slot; it.state = 'ride'; beep(380, .08, 'triangle', .05); continue; }
      // no room: the bag tumbles off the side
      if (!slot && it.y < tv.bedTop + 0.3 && Math.abs(l.x) < tv.w && Math.abs(l.z) < tv.l) {
        const side = l.x < 0 ? -1 : 1, c = Math.cos(tv.h), s = Math.sin(tv.h);
        it.vx = side * c * 3; it.vz = -side * s * 3; it.vy = 1.5;
        if (S.t - (S.fullMsgT || -9) > 3) { S.fullMsgT = S.t; say(trolleyFullMsg(tv, it), 'bad'); }
      }
    }
    cabinForces(it, force);
    it.vx += force.x * dt; it.vz += force.z * dt;
    const grounded = it.y <= (groundAt(it.x, it.z) ?? -99) + 0.03;
    if (grounded) { const fr = Math.max(0, 1 - (it.type.bouncy ? 0.5 : 3.5) * dt); it.vx *= fr; it.vz *= fr; }   // (a ball rolls on and on)
    if (it.alive && !it.caged) liveCargo(it, dt, grounded);
    const [hx, hz] = moveBody(it, it.vx * dt, it.vz * dt);
    if (hx) it.vx *= -0.3;
    if (hz) it.vz *= -0.3;
    if ((hx || hz) && it.alive) it.wanderT = 0;   // bumped into something: pick a new direction
    fallBody(it, dt);
    it.spinY += (Math.abs(it.vx) + Math.abs(it.vz)) * dt * 0.8;
    it.g.position.set(it.x, it.y, it.z);
    it.g.rotation.set(0, it.alive ? it.heading : it.spinY, 0);
    if (groundAt(it.x, it.z) === null && it.y < -3) {
      netEvent('lost', items.indexOf(it));
      overboard(it);
      toDebris(it.g, new THREE.Vector3(rand(-2, 2), -2, 25));
      if (inAir() && it.alive && it.alive.kind === 'croc') say('🐊 The crocodile has left the plane. Nobody is sad about this.', 'good');
      else if (inAir() && !it.extra) { S.lostBags++; S.needs.calm -= 6; say(`🧳 Somebody's ${it.name} just fell out of the plane!`, 'bad'); }
    }
  }
  // bags don't overlap each other
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.state !== 'free' || b.state !== 'free' || Math.abs(a.y - b.y) > 0.6) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = (a.r + b.r) * 0.75;
    if (d < min && d > 0.001) {
      const push = (min - d) / 2, nx = dx / d * push, nz = dz / d * push;
      if (canGo(a.x, a.z, a.y, a.x - nx, a.z - nz)) { a.x -= nx; a.z -= nz; }
      if (canGo(b.x, b.z, b.y, b.x + nx, b.z + nz)) { b.x += nx; b.z += nz; }
    }
  }
}
// animals: the crocodile crawls about snapping its jaws, the chicken hops, flaps and lays eggs
function liveCargo(it, dt, grounded) {
  const ud = it.g.userData, t = S.t + it.phase;
  if ((it.wanderT -= dt) <= 0) { it.wanderT = rand(1.5, 4); it.heading = rand(0, Math.PI * 2); it.resting = Math.random() < 0.3; }
  if (grounded && !it.resting) {
    it.vx = -Math.sin(it.heading) * it.alive.speed; it.vz = -Math.cos(it.heading) * it.alive.speed;
    if (it.alive.kind === 'chicken' && Math.random() < dt * 1.5) it.vy = rand(1.5, 3);
  }
  if (ud.jaw) ud.jaw.rotation.x = Math.max(0, Math.sin(t * 5)) * 0.55;
  if (ud.tail) ud.tail.rotation.y = Math.sin(t * 3) * 0.35;
  if (ud.wings) ud.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (grounded ? 0.1 : Math.abs(Math.sin(t * 25)) * 1.2); });
  if (it.alive.kind === 'chicken' && grounded && (it.eggT -= dt) <= 0) {
    it.eggT = rand(25, 40);
    const egg = spawnBag(BAGS.egg);
    Object.assign(egg, { state: 'free', x: it.x, y: it.y + 0.1, z: it.z }); egg.g.visible = true;
    quack(); say('🥚 The chicken laid an egg!');
  }
  // passengers do not enjoy sharing the cabin with a crocodile
  if (it.alive.kind === 'croc' && Math.random() < dt * 0.5) {
    const near = passengers.find(p => p.state !== 'gone' && Math.hypot(p.x - it.x, p.z - it.z) < 2.2);
    if (near) shout(near, pick(YELLS.croc));
  }
}
const crocLoose = () => inAir() && items.some(i => i.alive && i.alive.kind === 'croc' && i.state === 'free' && insideHull(i.x, i.z) && i.z < CARGO && i.z > BULK);
// a sudden lurch: luggage and standing passengers go flying
function jerk(k) {
  for (const it of items) if (it.state === 'free') { it.vx += rand(-1, 1) * k * 3; it.vz += rand(-1, 1) * k * 3; it.vy += rand(0, 1) * k * 2.5; }
  if (k > 0.6 && S.phase !== 'airport') for (const p of passengers) if (p.state === 'walk' || p.state === 'wait') {
    ragdoll(p, rand(-1, 1) * k * 2, k * 2, rand(-1, 1) * k * 2);
  }
}

// ---------------------------------------------------------------- passenger behaviour
function sendToSeat(p) {
  let seat = p.seat;
  if (!seat) {
    const free = seats.filter(s => !s.occupant);
    if (!free.length) { p.state = 'wait'; p.waitT = 999; return; }
    seat = free.reduce((a, b) => Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a);
    seat.occupant = p; p.seat = seat;
  }
  const z0 = clamp(p.z, BULK + 0.6, REAR - 0.6);
  p.path = [{ x: 0, z: z0 }, { x: 0, z: seat.z - 0.7 }, { x: seat.x, z: seat.z - 0.7 }, { x: seat.x, z: seat.z }];
  p.then = 'sit';
  p.state = 'walk'; setPose(p, 'stand');
}
function ejectPassenger(p, msg) {
  netEvent('eject', passengers.indexOf(p));
  p.rag = null; p.netRag = null; p.rig.core.quaternion.identity();
  if (p.seat) { p.seat.occupant = null; p.seat = null; }
  overboard(p);
  // first they plummet, tumbling and flailing; the parachute (hidden for now) pops open a moment later
  p.g.rotation.set(0, p.g.rotation.y, 0);
  p.pose = 'flail'; animatePax(p);
  const chute = new THREE.Group(); chute.visible = false; p.g.add(chute);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.42),
    std(pick([0xff4040, 0xffb020, 0x30a0ff, 0x40d070]), { side: THREE.DoubleSide, roughness: .8 }));
  canopy.scale.y = 0.6; canopy.position.y = 3.3; chute.add(canopy);
  const rimY = 3.3 + 0.6 * 1.3 * Math.cos(Math.PI * 0.42), rimR = 1.3 * Math.sin(Math.PI * 0.42) * 0.95;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, from = new THREE.Vector3(Math.sign(Math.cos(a)) * 0.2, 2.1, 0), to = new THREE.Vector3(Math.cos(a) * rimR, rimY, Math.sin(a) * rimR);
    const dir = to.clone().sub(from), line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, dir.length(), 4), M.dark);
    line.position.copy(from).addScaledVector(dir, 0.5);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    chute.add(line);
  }
  p.sprite.visible = false;
  shout(p, pick(['AAAAAAAAAAH!', 'NOT LIKE THIS!', 'WHERE\'S THE CORD?!', 'MOMMYYYY!', 'I REGRET EVERYTHING!']), 99);
  toDebris(p.g, new THREE.Vector3(rand(-3, 3), -2, 22), 11);
  Object.assign(falling[falling.length - 1], { chute: 'free', p, chuteG: chute, openAt: rand(1.6, 2.4), spinP: { x: rand(4, 8), z: rand(-6, 6) } });
  S.ejected++; S.needs.calm -= 25;
  say(msg || `🪂 ${p.name} left the plane. Their parachute opened. They will be writing a strongly-worded letter.`, 'bad');
}
// passengers who stay furious for too long storm off to an exit door and jump
const RAGE = { warn: ['THAT\'S IT!', 'I\'ve had ENOUGH!', 'I want OFF this plane!', 'I\'m counting to ten…', 'Where\'s the exit?!'],
  go: ['I\'M OUTTA HERE!', 'SO LONG, SUCKERS!', 'I\'LL TAKE MY CHANCES!', 'TELL MY CAT I LEFT!', 'BYEEEEE!'] };
function updateRage(dt) {
  if (S.phase !== 'flight') return;
  for (const p of passengers) {
    if (p.state !== 'seated' || p.calling) continue;
    const furious = p.mood < 12 || (p.angry > 0 && p.mood < 30);
    p.rageT = furious ? (p.rageT || 0) + dt : Math.max(0, (p.rageT || 0) - dt * 2);
    if (p.rageT > 6 && !p.warned) { p.warned = true; shout(p, pick(RAGE.warn), 3); say(`😠 ${p.name} looks like they're about to do something silly…`); }
    if (!furious) p.warned = false;
    if (p.rageT > 13) rageQuit(p);
  }
}
function rageQuit(p) {
  const seat = p.seat, side = seat.x < 0 ? 'L' : 'R', s = side === 'L' ? -1 : 1;
  seat.occupant = null; p.seat = null; p.rageT = 0; p.warned = false;
  p.state = 'walk'; setPose(p, 'stand'); p.then = 'jump'; p.jumpSide = side;
  p.path = [{ x: seat.x, z: seat.z - 0.7 }, { x: 0, z: seat.z - 0.7 }, { x: 0, z: 0 }, { x: s * (W - 0.5), z: 0 }];
  shout(p, pick(RAGE.go), 4);
  say(`😡 ${p.name} has had enough and is storming off to the ${sideWord(side)} exit door! Grab them before they jump!`, 'bad');
}
// where a passenger ends up after being thrown, dropped or knocked over
function landed(p) {
  if (insideHull(p.x, p.z) || onRamp(p.x, p.z)) return sendToSeat(p);
  if (S.phase === 'airport') { p.state = 'terminal'; p.tx = p.x; p.tz = p.z; setPose(p, 'stand'); return; }
  ejectPassenger(p, `🌬 The wind blew ${p.name} right off the plane! A parachute pops open. 🪂`);
}
// is someone else standing in the way of a step to (x, z)? (stepping away from them is always fine)
const ON_FOOT = new Set(['terminal', 'toBus', 'walk', 'wait']);
function npcAt(p, x, z) {
  for (const q of passengers) {
    if (q === p || !ON_FOOT.has(q.state)) continue;
    const dn = Math.hypot(q.x - x, q.z - z);
    if (dn < 0.55 && dn < Math.hypot(q.x - p.x, q.z - p.z)) return true;
  }
  return false;
}
function walkToward(p, tx, tz, speed, dt) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.06) return true;
  const st = Math.min(d, speed * dt);
  // outdoors, people walk around vehicles, walls and each other instead of through them
  // (if they're stuck for a few seconds they squeeze past anyway, so nobody waits forever)
  if (S.phase === 'airport' && !insideHull(p.x, p.z) && !onRamp(p.x, p.z) && !(p.ghostT > 0)) {
    for (const turn of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
      const c = Math.cos(turn), s = Math.sin(turn), ux = (dx * c - dz * s) / d, uz = (dx * s + dz * c) / d;
      const bx = p.x + ux * st, bz = p.z + uz * st;
      if (!canGo(p.x, p.z, p.y, bx, bz) || npcAt(p, bx, bz)) continue;
      p.x = bx; p.z = bz; p.stuckT = 0;
      p.g.rotation.set(0, turnToward(p.g.rotation.y, Math.atan2(-ux, -uz), 4 * dt), 0);   // turn smoothly, don't snap round
      stepGait(p, st, speed);
      return Math.hypot(tx - p.x, tz - p.z) < 0.06;
    }
    if ((p.stuckT = (p.stuckT || 0) + dt) > 3) { p.stuckT = 0; p.ghostT = 2; }
    return false;
  }
  if (p.ghostT > 0) p.ghostT -= dt;
  p.x += dx / d * st; p.z += dz / d * st;
  p.g.rotation.set(0, turnToward(p.g.rotation.y, Math.atan2(-dx, -dz), 4 * dt), 0);
  stepGait(p, st, speed);
  return d - st < 0.06;
}
function stepPassenger(p, dt) {
  if (p.state === 'air' && p.rag) {
    const held = p.rag.pins && p.rag.pins.length;   // someone's dragging them about by a wrist or an ankle
    const done = updateRagdoll(p, dt) && !held;
    if (groundAt(p.x, p.z) === null && p.y < -3 && !held) return ejectPassenger(p);
    if (done) {
      if (inAir() && !insideHull(p.x, p.z) && !onRamp(p.x, p.z)) { p.rag = null; p.rig.core.quaternion.identity(); return landed(p); }
      p.state = 'down'; p.downT = rand(2, 3);
      boing(); shout(p, pick(YELLS.landed));
    }
    return;
  }
  if (p.state === 'air') {
    cabinForces(p, force);
    p.vx += force.x * dt; p.vz += force.z * dt;
    const [hx, hz] = moveBody(p, p.vx * dt, p.vz * dt);
    if (hx) p.vx *= -0.3;
    if (hz) p.vz *= -0.3;
    const grounded = fallBody(p, dt);
    // tumble around the middle of the body
    const core = p.rig.core;
    core.rotation.x += p.spin.x * dt; core.rotation.z += p.spin.z * dt;
    if (grounded) {
      p.vx *= 0.8; p.vz *= 0.8; p.spin.x *= 0.7; p.spin.z *= 0.7;
      if (Math.hypot(p.vx, p.vz) < 0.6) {
        if (inAir() && !insideHull(p.x, p.z) && !onRamp(p.x, p.z)) return landed(p);
        // flop down and stay exactly the way they landed: arms and legs freeze where they were,
        // and the body just tips over onto the floor (whichever way is nearest) instead of snapping into a pose
        const wasThrown = !!(p.spin.x || p.spin.z);
        p.state = 'down'; p.pose = 'frozen'; p.downT = wasThrown ? rand(2.2, 3.2) : 0.6; p.flopT = 0;
        if (wasThrown) { boing(); shout(p, pick(YELLS.landed)); }
        const x = core.rotation.x, lie = Math.PI / 2 + Math.round((x - Math.PI / 2) / Math.PI) * Math.PI;
        p.lieTo = { x0: x, x1: lie, z: core.rotation.z };
      }
    }
    if (groundAt(p.x, p.z) === null && p.y < -3) return ejectPassenger(p);
    p.g.position.set(p.x, p.y, p.z);
    return;
  }
  if (p.state === 'down' && p.rag) {
    // lying in a heap exactly as they landed (still physics: they settle and slump), then bouncing back up
    stepRag(p, dt, 0, 0); mapRag(p, p.rag.pos, p.rag.yaw);
    if ((p.downT -= dt) <= 0) { p.state = 'getup'; startGetUp(p); }
    return;
  }
  if (p.state === 'getup' && p.rag) {
    if (stepGetUp(p, dt)) {
      const t = p.rag.targets, pel = ragMid(t, 7, 8), was = p.g.position.clone();
      p.rag = null; p.rig.core.position.y = 0.85;
      p.vx = p.vy = p.vz = 0;   // (forget the speed they were thrown at, or they'd take off again)
      const gy = groundAt(pel.x, pel.z); if (gy !== null) p.y = gy;
      p.x = pel.x; p.z = pel.z; p.g.position.set(p.x, p.y, p.z);
      startPoseBlend(p, was);
      p.pose = 'stand'; landed(p); animatePax(p);
    }
    return;
  }
  if (p.state === 'down') {
    const f = p.lieTo || { x0: Math.PI / 2, x1: Math.PI / 2, z: 0 }, core = p.rig.core;
    p.flopT = (p.flopT || 0) + dt;
    const k = smooth01(clamp(p.flopT / 0.3, 0, 1));                    // tipping over onto the floor
    core.rotation.set(f.x0 + (f.x1 - f.x0) * k, 0, f.z);
    p.g.position.set(p.x, p.y - 0.6 * k, p.z);
    if ((p.downT -= dt) <= 0) { p.state = 'getup'; p.getT = 0; p.pose = 'stand'; p.upFrom = { x: core.rotation.x, z: core.rotation.z }; }
    return;
  }
  if (p.state === 'getup') {
    // climb back up onto their feet
    p.getT += dt;
    const k = smooth01(clamp(p.getT / 0.6, 0, 1)), u = p.upFrom;
    p.rig.core.rotation.set(u.x * (1 - k), 0, u.z * (1 - k));
    p.g.position.set(p.x, p.y - 0.6 * (1 - k), p.z);
    if (k >= 1) { p.rig.core.rotation.set(0, 0, 0); landed(p); }
    return;
  }
  if (p.state === 'terminal') {
    p.wanderT -= dt;
    if (p.wanderT <= 0) {
      p.wanderT = rand(2, 7);
      const inside = inTerminal(p.x, p.z);
      p.tx = clamp(p.x + rand(-4, 4), inside ? TERM.x0 + 1 : -50, inside ? 9 : 50);
      p.tz = clamp(p.z + rand(-4, 4), inside ? TERM.z0 + 1 : -25, inside ? TERM.z1 - 1 : TERM.z0 - 1);
    }
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
    p.pose = d > 0.1 ? 'walk' : 'stand';
    if (d > 0.1) {
      const st = Math.min(d, 1.0 * dt);
      if (npcAt(p, p.x + dx / d * st, p.z + dz / d * st)) p.wanderT = 0;   // someone's in the way: go somewhere else
      else { const [hx, hz] = moveBody(p, dx / d * st, dz / d * st); if (hx || hz) p.wanderT = 0; }
      p.g.rotation.set(0, turnToward(p.g.rotation.y, Math.atan2(-dx, -dz), 4 * dt), 0); stepGait(p, st, 1.0);
    }
    fallBody(p, dt);
    p.g.position.set(p.x, p.y, p.z);
    return;
  }
  if (p.state === 'toBus') {
    const wp = p.path[0] || busDoor(bus, 0.7);
    const arrived = walkToward(p, wp.x, wp.z, 1.6, dt);
    p.pose = arrived && !p.path.length ? 'stand' : 'walk';
    if (arrived) {
      if (p.path.length) p.path.shift();
      else if (busDoorOpen()) {
        // through the door and down the aisle to a free seat
        const seat = bus.seats.find(s => !s.p && !s.player);
        if (seat) {
          seat.p = p; p.busSeat = seat; p.state = 'inBus';
          p.lx = bus.w + 0.7; p.lz = -3.1;
          p.path = [{ x: 0.9, z: -3.1 }, { x: 0, z: -2.6 }, { x: 0, z: seat.z }, { x: seat.x, z: seat.z }];
        } else { p.state = 'terminal'; say(`${p.name} couldn't fit on the bus.`); }
      }
    }
    p.y = GROUND;
    p.g.position.set(p.x, p.y, p.z);
    return;
  }
  if (p.state === 'inBus' || p.state === 'outBus') {
    // walking inside the bus, in the bus's own frame so it still works if the bus moves
    const wp = p.path[0];
    const throughDoor = wp && (p.state === 'inBus' ? p.lx > bus.w : wp.x > bus.w);
    if (wp && !(throughDoor && !busDoorOpen())) {
      const dx = wp.x - p.lx, dz = wp.z - p.lz, d = Math.hypot(dx, dz), st = Math.min(d, 1.3 * dt);
      if (d > 0.001) { p.lx += dx / d * st; p.lz += dz / d * st; stepGait(p, st, 1.3); p.faceL = Math.atan2(-dx, -dz); }
      if (d - st < 0.05) p.path.shift();
      p.pose = 'walk';
    } else p.pose = 'stand';
    const w = vehPoint(bus, p.lx, p.lz);
    p.x = w.x; p.z = w.z; p.y = Math.abs(p.lx) <= bus.w ? bus.floor : GROUND;
    p.g.position.set(p.x, p.y, p.z); p.g.rotation.set(0, bus.h + (p.faceL || 0), 0);
    if (!p.path.length) {
      if (p.state === 'inBus') { p.state = 'bus'; p.pose = 'sit'; beep(700, .05, 'sine', .04); }
      else { p.state = 'walk'; p.then = 'board'; p.y = GROUND; p.path = [{ x: RAMP_FOOT.x, z: RAMP_FOOT.z }]; }
    }
    return;
  }
  if (p.state === 'bus') {
    const s = vehPoint(bus, p.busSeat.x, p.busSeat.z);
    p.x = s.x; p.z = s.z; p.y = bus.floor; p.pose = 'sit';
    p.g.position.set(s.x, p.y, s.z); p.g.rotation.set(0, bus.h, 0);
    return;
  }
  if (p.state === 'walk') {
    p.pose = 'walk';
    const wp = p.path[0];
    if (wp && walkToward(p, wp.x, wp.z, 1.4, dt)) p.path.shift();
    if (!p.path.length) {
      if (p.then === 'sit') { p.state = 'seated'; p.pose = 'sit'; p.x = p.seat.x; p.z = p.seat.z; }
      else if (p.then === 'board') sendToSeat(p);
      else if (p.then === 'lav') { p.state = 'wait'; p.waitT = rand(4, 7); p.next = () => sendToSeat(p); }
      else if (p.then === 'jump') {
        // fling the exit door open… and go
        doors[p.jumpSide].target = 1; beep(200, .25, 'triangle', .08);
        p.state = 'wait'; p.waitT = 1.3; shout(p, pick(RAGE.go), 3);
        p.next = () => inAir() ? ejectPassenger(p, `🪂 ${p.name} JUMPED out of the ${sideWord(p.jumpSide)} exit door in a rage! (The door is still open…)`) : sendToSeat(p);
      }
    }
    p.y = groundAt(p.x, p.z) ?? p.y;
    p.g.position.set(p.x, p.y, p.z);
    // a hole in the wall nearby drags walkers out
    if (hole.seg && inAir() && Math.hypot((hole.side === 'L' ? -W : W) - p.x, hole.seg.z - p.z) < 3)
      ragdoll(p, (hole.side === 'L' ? -1 : 1) * 4, 1, 0);
    return;
  }
  if (p.state === 'wait') {
    p.pose = 'stand';
    p.waitT -= dt;
    if (p.waitT <= 0) { const n = p.next; p.next = null; if (n) n(); else sendToSeat(p); }
    return;
  }
  if (p.state === 'seated') { p.pose = 'sit'; p.g.position.set(p.seat.x, 0, p.seat.z); p.g.rotation.set(0, 0, 0); }
}
function updatePassengers(dt) {
  for (const p of passengers) {
    if (p.state === 'gone' || p.state === 'held') continue;
    stepPassenger(p, dt);
    if (p.state !== 'gone') animatePax(p);
    if (p.bubble && p.bubble.visible && (p.bubbleT -= dt) <= 0) p.bubble.visible = false;
  }
}

// ---------------------------------------------------------------- call buttons
function startCall() {
  const free = passengers.filter(p => p.state === 'seated' && !p.calling);
  if (!free.length) return;
  const p = pick(free);
  p.calling = { t: 0, text: pick(CALLS) };
  p.sprite.material = emojiMat('🔔', true);
  p.sprite.renderOrder = 998;
  p.face = '🔔';
  beep(1320, .1, 'sine', .05); setTimeout(() => beep(1050, .15, 'sine', .05), 130);
}
function resolveCall(p) {
  p.calling = null; p.face = ''; p.sprite.renderOrder = 0;
  S.needs.calm += 6; S.needs.comfort += 8;
  chime();
  say(pick([`${p.name}: "Oh, thank you so much!"`, `${p.name}: "You're the best captain ever."`, `${p.name}: "Wait, aren't you supposed to be flying?"`]), 'good');
}
