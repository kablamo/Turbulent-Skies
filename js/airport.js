// Airports: tarmac, runway, a walk-in terminal and the baggage conveyor. buildAirport() is used for
// both the departure airport (where the plane is parked) and the destination you land at.
'use strict';
function buildAirport(group, gateName) {
  const flat = (w, d, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); group.add(m); return m;
  };
  // (the layers sit well apart, or from a distance the grass flickers through the tarmac)
  flat(6000, 6000, 0x5f8f4e, 0, GROUND - 0.2, 0);
  flat(140, 150, 0x8c8f94, 0, GROUND - 0.03, 35);
  flat(46, 3200, 0x3d3f44, 0, GROUND - 0.08, -1560);
  for (let z = 20; z > -3100; z -= 30) flat(1, 12, 0xffffff, 0, GROUND - 0.01, z);
  for (const x of [-21, 21]) flat(0.6, 3200, 0xffffff, x, GROUND - 0.01, -1560);
  flat(0.4, 60, 0xf2c230, 0, GROUND - 0.01, 50);                  // taxi line from the plane to the gate
  // parking boxes for the vehicles
  for (const [x, z, w, d] of [[-7, 76, 4, 10], [5, 76, 3, 6]]) {
    flat(w, 0.15, 0xffffff, x, GROUND - 0.005, z - d / 2); flat(w, 0.15, 0xffffff, x, GROUND - 0.005, z + d / 2);
    flat(0.15, d, 0xffffff, x - w / 2, GROUND - 0.005, z); flat(0.15, d, 0xffffff, x + w / 2, GROUND - 0.005, z);
  }

  // ---- terminal: a hollow building you can walk into
  const wallM = std(0xc9c4b8, { roughness: .85 }), floorM = std(0xd9d4c7, { roughness: .7 });
  const T = TERM, cx = (T.x0 + T.x1) / 2, cz = (T.z0 + T.z1) / 2, tw = T.x1 - T.x0, td = T.z1 - T.z0, H = 6;
  box(tw, 0.1, td, floorM, cx, GROUND - 0.03, cz, group);
  box(tw + 0.4, H, 0.4, wallM, cx, GROUND + H / 2, T.z1, group);
  for (const x of [T.x0, T.x1]) box(0.4, H, td, wallM, x, GROUND + H / 2, cz, group);
  box(tw + 0.8, 0.4, td + 0.8, wallM, cx, GROUND + H + 0.2, cz, group);
  // glass front with a door in the middle
  for (const [x0, x1] of [[T.x0, -1.6], [1.6, T.x1]]) box(x1 - x0, H - 0.6, 0.12, M.termGlass, (x0 + x1) / 2, GROUND + 0.3 + (H - 0.6) / 2, T.z0, group);
  box(tw, 0.6, 0.4, wallM, cx, GROUND + 0.3, T.z0, group);
  box(3.2, H - 3.4, 0.4, wallM, 0, GROUND + 3.4 + (H - 3.4) / 2, T.z0, group);
  for (let x = T.x0; x <= T.x1; x += 4) if (Math.abs(x) > 2) box(0.15, H, 0.2, M.dark, x, GROUND + H / 2, T.z0, group);
  const doors = [box(1.6, 3.4, 0.08, M.termGlass, -0.8, GROUND + 1.7, T.z0, group), box(1.6, 3.4, 0.08, M.termGlass, 0.8, GROUND + 1.7, T.z0, group)];
  textPlane(10, 2.0, gateName, '#1b2a48', '#ffd34a', group, 0, GROUND + 7.4, T.z0 - 0.3, Math.PI);
  textPlane(4, 0.7, '🧳 BAGGAGE ⬇', '#1b2a48', '#fff', group, BELT_X - 1.6, GROUND + 2.4, T.z0 - 0.25, Math.PI, 'bold 54px sans-serif');
  // inside: benches, gate desk, departures board, lights
  for (const dz of [5, 7.5, 10]) {
    const z = T.z0 + dz;
    box(10, 0.1, 0.6, M.seat, -9, GROUND + 0.45, z, group);
    box(10, 0.5, 0.1, M.seat, -9, GROUND + 0.75, z + 0.3, group);
    for (let x = -13.5; x <= -4.5; x += 3) box(0.08, 0.45, 0.5, M.steel, x, GROUND + 0.22, z, group);
  }
  box(4, 1.1, 0.8, std(0x2c4a63), -15, GROUND + 0.55, T.z0 + 3, group);
  textPlane(3, 0.5, gateName, '#2c4a63', '#fff', group, -15, GROUND + 1.6, T.z0 + 2.55, Math.PI, 'bold 60px sans-serif');
  textPlane(8, 2.4, 'DEPARTURES  404 ➜ SOMEWHERE  ON TIME?', '#111', '#ffb000', group, -2, GROUND + 4, T.z1 - 0.25, Math.PI, 'bold 30px monospace');
  for (const x of [-12, 0, 12]) box(4, 0.05, 0.5, M.lamp, x, GROUND + H - 0.05, cz, group);
  const tl = new THREE.PointLight(0xfff4e0, 0.6, 40); tl.position.set(0, GROUND + 5, cz); group.add(tl);
  decorateTerminal(group);

  // (the luggage just waits in a big heap outside the terminal: see buildPile in people.js)

  // ---- control tower, lamp posts, fuel truck, cones
  cyl(1.8, 2.4, 26, wallM, -42, GROUND + 13, 75, group);
  cyl(4, 3, 4, std(0x2c4a63, { roughness: .2, metalness: .7 }), -42, GROUND + 28, 75, group);
  for (const [x, z] of [[-25, 60], [25, 60], [-25, 30], [25, 30], [-25, 0], [25, 0]]) { cyl(0.12, 0.15, 9, M.dark, x, GROUND + 4.5, z, group); box(1.2, 0.2, 0.5, M.lamp, x, GROUND + 9, z, group); }
  box(2.4, 2.2, 6, std(0xe8e8e0), 30, GROUND + 1.4, 50, group);
  box(2.4, 1.6, 2, M.red, 30, GROUND + 1.1, 46, group);
  for (const [x, z] of [[-6, 22], [6, 22], [-24, -4], [24, -4]]) cyl(0.02, 0.25, 0.7, std(0xff7a1a), x, GROUND + 0.35, z, group, 12);
  return doors;
}
// things that move inside the terminals (run every frame from updateEffects)
const termAnim = [];
// snack bar, coffee kiosk, vending machines, duty free, a giant duck, palm trees, an arcade machine…
function decorateTerminal(group) {
  const G = GROUND, Z1 = TERM.z1, Z0 = TERM.z0;
  const m = (c, o) => std(c, o);
  // red carpet from the door to the gate desk
  box(2.2, 0.02, 10, m(0xa3242c, { roughness: .95 }), 0, G + 0.03, Z0 + 5.5, group);
  // 🍔 snack bar along the back wall
  box(5.6, 1.1, 1.2, m(0xe8463a), 16.8, G + 0.55, Z1 - 2.2, group);
  box(5.8, 0.08, 1.4, m(0xf3f0e8), 16.8, G + 1.14, Z1 - 2.2, group);
  for (let i = 0; i < 4; i++) { cyl(0.25, 0.25, 0.08, m(0xffd34a), 14.6 + i * 1.4, G + 0.75, Z1 - 3.3, group); cyl(0.04, 0.04, 0.75, M.steel, 14.6 + i * 1.4, G + 0.37, Z1 - 3.3, group); }
  textPlane(6, 1.6, '🍔 BURGER BLAST', '#e8463a', '#fff', group, 16.8, G + 3.6, Z1 - 0.25, Math.PI, 'bold 72px sans-serif');
  textPlane(6, 1.1, 'Burger 4 · Fries 2 · Mystery Meat FREE', '#222', '#ffd34a', group, 16.8, G + 2.2, Z1 - 0.25, Math.PI, 'bold 34px sans-serif');
  for (let i = 0; i < 3; i++) { cyl(0.13, 0.11, 0.06, m(0x8a4b1f), 15.2 + i * 1.5, G + 1.21, Z1 - 2.2, group); cyl(0.14, 0.14, 0.04, m(0xf2c14e), 15.2 + i * 1.5, G + 1.26, Z1 - 2.2, group); }
  // ☕ coffee kiosk
  cyl(1.2, 1.2, 1.1, m(0x5b3a24), 16.5, G + 0.55, Z0 + 4, group, 20);
  cyl(1.3, 1.3, 0.08, m(0xf3f0e8), 16.5, G + 1.14, Z0 + 4, group, 20);
  cyl(0.06, 0.06, 2.4, M.dark, 16.5, G + 2.3, Z0 + 4, group);
  for (const ry of [0, Math.PI]) textPlane(2.6, 0.7, '☕ PLANE BEANS', '#5b3a24', '#fff', group, 16.5, G + 3.3, Z0 + 4 + (ry ? 0.03 : -0.03), ry, 'bold 60px sans-serif');
  for (let i = 0; i < 3; i++) cyl(0.07, 0.06, 0.16, M.white, 15.9 + i * 0.5, G + 1.26, Z0 + 2.95, group);
  // vending machines on the right wall, glowing
  const vendTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#e33'; g.fillRect(0, 0, w, 36);
    g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText('SODA-ISH', 14, 26);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) { g.fillStyle = ['#e33', '#3a3', '#36f', '#fc0', '#f6c'][(r + c) % 5]; g.fillRect(10 + c * 22, 48 + r * 36, 16, 28); }
    g.fillStyle = '#444'; g.fillRect(100, 60, 20, 120);
  });
  for (const [z, hue] of [[Z1 - 8.5, 0xd8302c], [Z1 - 7.2, 0x2c6fd8]]) {
    box(0.9, 2.1, 1.1, m(hue), TERM.x1 - 0.75, G + 1.05, z, group);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), new THREE.MeshBasicMaterial({ map: vendTex }));
    face.position.set(TERM.x1 - 1.21, G + 1.1, z); face.rotation.y = -Math.PI / 2; group.add(face);
  }
  // 🛍 duty free(ish) shelves and a giant teddy bear
  for (let x = -19; x <= -13.5; x += 1.8) {
    box(1.6, 2.2, 0.6, m(0xf3f0e8), x, G + 1.1, Z1 - 0.6, group);
    for (let sh = 0; sh < 3; sh++) for (let k = 0; k < 3; k++)
      box(0.35, 0.4, 0.3, m(new THREE.Color().setHSL(((x + sh * 3 + k * 7) * 0.13) % 1 + (x < 0 ? 1 : 0) % 1, 0.7, 0.55)), x - 0.5 + k * 0.5, G + 0.45 + sh * 0.7, Z1 - 0.8, group);
  }
  textPlane(5, 0.8, '🛍 DUTY FREE(ISH)', '#7a2bb5', '#fff', group, -16.3, G + 3.4, Z1 - 0.25, Math.PI, 'bold 60px sans-serif');
  const teddy = new THREE.Group(); teddy.position.set(-18.5, G, Z1 - 3.5); teddy.rotation.y = 2.4; group.add(teddy);
  const fur = m(0x8a5a2b, { roughness: 1 }), snout = m(0xd9b48a, { roughness: 1 });
  const ball = (r, mat_, x, y, z, s) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat_); b.position.set(x, y, z); if (s) b.scale.set(...s); teddy.add(b); return b; };
  ball(0.7, fur, 0, 0.7, 0, [1, 0.95, 0.85]); ball(0.5, fur, 0, 1.75, 0);
  for (const sx of [-1, 1]) { ball(0.18, fur, sx * 0.38, 2.15, 0); ball(0.25, fur, sx * 0.6, 0.95, -0.25); ball(0.28, fur, sx * 0.4, 0.2, -0.4); ball(0.06, M.dark, sx * 0.17, 1.85, -0.44); }
  ball(0.2, snout, 0, 1.65, -0.42, [1, 0.8, 0.8]); ball(0.07, M.dark, 0, 1.72, -0.6);
  // 🦆 the airport mascot: a giant rubber duck on a pedestal, slowly spinning
  cyl(0.9, 1.0, 0.9, m(0x9aa3ad, { metalness: .4 }), 5, G + 0.45, Z0 + 10.5, group, 20);
  const duck = new THREE.Group(); duck.position.set(5, G + 0.9, Z0 + 10.5); group.add(duck);
  const yel = m(0xffd21f, { roughness: .3 });
  const dball = (r, mat_, x, y, z, s) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat_); b.position.set(x, y, z); if (s) b.scale.set(...s); duck.add(b); };
  dball(0.75, yel, 0, 0.6, 0.1, [1, 0.8, 1.25]); dball(0.45, yel, 0, 1.45, -0.45);
  dball(0.2, m(0xff8a1a), 0, 1.35, -0.92, [1.2, 0.5, 1.2]);
  for (const sx of [-1, 1]) { dball(0.11, M.white, sx * 0.22, 1.6, -0.8); dball(0.055, M.dark, sx * 0.24, 1.62, -0.9); }
  textPlane(1.6, 0.35, 'OUR MASCOT, GARY', '#333', '#ffd34a', group, 5, G + 0.5, Z0 + 9.48, Math.PI, 'bold 44px sans-serif');
  termAnim.push(t => { duck.rotation.y = t * 0.4; duck.position.y = G + 0.9 + Math.abs(Math.sin(t * 2)) * 0.05; });
  // 🌴 potted palm trees
  for (const [x, z] of [[TERM.x0 + 1.2, Z0 + 1.5], [TERM.x1 - 1.2, Z0 + 1.5], [9.6, Z1 - 1.4]]) {
    cyl(0.5, 0.38, 0.7, m(0xb5651d), x, G + 0.35, z, group);
    const trunk = cyl(0.09, 0.14, 2.6, m(0x8a6a3a), x, G + 2, z, group); trunk.rotation.z = 0.08;
    for (let i = 0; i < 6; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.6, 4), m(0x2f9e44, { side: THREE.DoubleSide }));
      const a = i / 6 * Math.PI * 2; leaf.position.set(x + Math.cos(a) * 0.6, G + 3.2, z + Math.sin(a) * 0.6);
      leaf.rotation.set(Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9); leaf.scale.z = 0.25; group.add(leaf);
    }
  }
  // 🕹 arcade machine with a flickering screen
  box(0.9, 1.9, 0.9, m(0x2b2b8a), 9.6, G + 0.95, Z0 + 3.5, group);
  const arcTex = canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#05051a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff3b6b'; g.font = 'bold 30px monospace'; g.fillText('PLANE CRASH 2', 12, 40);
    g.fillStyle = '#3cf'; g.fillRect(60, 110, 120, 14); g.fillRect(110, 85, 20, 60);
    g.fillStyle = '#ffd34a'; g.font = 'bold 20px monospace'; g.fillText('INSERT COIN', 60, 175);
  });
  const arcScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.56), new THREE.MeshBasicMaterial({ map: arcTex }));
  arcScreen.position.set(9.6, G + 1.45, Z0 + 3.04); arcScreen.rotation.y = Math.PI; group.add(arcScreen);
  box(0.8, 0.08, 0.3, M.dark, 9.6, G + 1.02, Z0 + 3.0, group);
  for (const [bx, c] of [[-0.2, M.red], [0, M.yellow], [0.2, M.red]]) cyl(0.04, 0.04, 0.04, c, 9.6 + bx, G + 1.08, Z0 + 2.95, group);
  termAnim.push(t => { arcScreen.material.color.setScalar(0.75 + 0.25 * Math.abs(Math.sin(t * 7))); });
  // ✈ a model plane hanging from the ceiling, propeller spinning
  const mp = new THREE.Group(); mp.position.set(-2, G + 4.6, Z0 + 8); group.add(mp);
  cyl(0.01, 0.01, 1.0, M.dark, 0, 0.5, 0, mp);
  const fus = cyl(0.25, 0.18, 2.4, M.white, 0, 0, 0, mp); fus.rotation.x = Math.PI / 2;
  box(3.2, 0.05, 0.6, M.white, 0, 0, 0.1, mp); box(1.1, 0.05, 0.35, M.white, 0, 0, 1.05, mp); box(0.05, 0.45, 0.35, M.red, 0, 0.22, 1.05, mp);
  const mprop = new THREE.Group(); mprop.position.z = -1.25; mp.add(mprop);
  box(0.08, 0.8, 0.02, M.dark, 0, 0, 0, mprop);
  termAnim.push(t => { mprop.rotation.z = t * 25; mp.rotation.y = Math.sin(t * 0.3) * 0.4; });
  // weather TV, a clock, luggage trolleys
  textPlane(3, 1.6, '📺 WEATHER: ⛈ TURBULENT', '#0b2a4a', '#fff', group, TERM.x0 + 0.25, G + 3.5, Z0 + 7, Math.PI / 2, 'bold 40px sans-serif');
  const clockTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 6; g.stroke();
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 22); g.moveTo(64, 64); g.lineTo(96, 70); g.stroke();
    g.fillStyle = '#e33'; g.font = 'bold 14px sans-serif'; g.fillText('LATE', 48, 100);
  });
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), new THREE.MeshBasicMaterial({ map: clockTex })); clock.position.set(6, G + 4.4, Z1 - 0.25); clock.rotation.y = Math.PI; group.add(clock);
  for (const x of [2.6, 3.6]) { box(0.7, 0.05, 1.0, M.steel, x, G + 0.35, Z0 + 1.6, group); box(0.7, 0.9, 0.05, M.steel, x, G + 0.8, Z0 + 2.1, group); box(0.5, 0.35, 0.7, m(new THREE.Color().setHSL(x * 0.3 % 1, 0.6, 0.5)), x, G + 0.58, Z0 + 1.6, group); }
}

const beltTex = canvasTex(64, 64, (g) => { g.fillStyle = '#26292e'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#3c4048'; for (let i = 0; i < 4; i++) g.fillRect(0, i * 16, 64, 6); });
beltTex.wrapS = beltTex.wrapT = THREE.RepeatWrapping; beltTex.repeat.set(1, 18);

const airport = new THREE.Group();
scene.add(airport);
const termDoors = buildAirport(airport, 'GATE 404  ✈');

// things on the apron you can't walk or drive through
const BLOCKS = [
  [TERM.x0 - 0.2, -1.6, TERM.z0 - 0.25, TERM.z0 + 0.25], [1.6, TERM.x1 + 0.2, TERM.z0 - 0.25, TERM.z0 + 0.25],
  [TERM.x0 - 0.2, TERM.x0 + 0.2, TERM.z0, TERM.z1], [TERM.x1 - 0.2, TERM.x1 + 0.2, TERM.z0, TERM.z1],
  [TERM.x0, TERM.x1, TERM.z1 - 0.2, TERM.z1 + 0.2],
  ...[5, 7.5, 10].map(dz => [-14.2, -3.8, TERM.z0 + dz - 0.4, TERM.z0 + dz + 0.5]),
  [-17.1, -12.9, TERM.z0 + 2.5, TERM.z0 + 3.5], [-44.5, -39.5, 72.5, 77.5], [28.7, 31.3, 44.8, 53.2],
  // terminal decorations: snack bar, coffee kiosk, vending machines, shop shelves, teddy, duck, palms, arcade
  [13.9, 19.8, TERM.z1 - 2.9, TERM.z1 - 1.5], [15.2, 17.8, TERM.z0 + 2.7, TERM.z0 + 5.3], [TERM.x1 - 1.3, TERM.x1, TERM.z1 - 9.2, TERM.z1 - 6.5],
  [-19.9, -12.6, TERM.z1 - 1, TERM.z1], [-19.4, -17.6, TERM.z1 - 4.3, TERM.z1 - 2.7], [4, 6, TERM.z0 + 9.5, TERM.z0 + 11.5],
  [TERM.x0 + 0.6, TERM.x0 + 1.8, TERM.z0 + 0.9, TERM.z0 + 2.1], [TERM.x1 - 1.8, TERM.x1 - 0.6, TERM.z0 + 0.9, TERM.z0 + 2.1], [9, 10.2, TERM.z1 - 2, TERM.z1 - 0.8],
  [9.1, 10.1, TERM.z0 + 3, TERM.z0 + 4],
];
const airportBlocked = (x, z) => BLOCKS.some(b => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]);
const inAirport = (x, z) => Math.abs(x) < 60 && z > -30 && z < TERM.z1;
const inTerminal = (x, z) => x > TERM.x0 && x < TERM.x1 && z > TERM.z0 && z < TERM.z1;
