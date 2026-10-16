// Airports: tarmac, runway, a walk-in terminal and the baggage conveyor. buildAirport() is used for
// both the departure airport (where the plane is parked) and the destination you land at.
'use strict';
function buildAirport(group, gateName) {
  const flat = (w, d, color, x, y, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ color }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); group.add(m); return m;
  };
  flat(6000, 6000, 0x5f8f4e, 0, GROUND - 0.04, 0);
  flat(140, 150, 0x8c8f94, 0, GROUND - 0.02, 35);
  flat(46, 3200, 0x3d3f44, 0, GROUND - 0.03, -1560);
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
  // glass front with a door in the middle and a hatch for the baggage belt
  for (const [x0, x1] of [[T.x0, -1.6], [1.6, BELT_X - 1], [BELT_X + 1, T.x1]]) box(x1 - x0, H - 0.6, 0.12, M.termGlass, (x0 + x1) / 2, GROUND + 0.3 + (H - 0.6) / 2, T.z0, group);
  box(tw, 0.6, 0.4, wallM, cx, GROUND + 0.3, T.z0, group);
  box(3.2, H - 3.4, 0.4, wallM, 0, GROUND + 3.4 + (H - 3.4) / 2, T.z0, group);
  box(2, H - 1.9, 0.4, wallM, BELT_X, GROUND + 1.9 + (H - 1.9) / 2, T.z0, group);
  for (let x = T.x0; x <= T.x1; x += 4) if (Math.abs(x) > 2 && Math.abs(x - BELT_X) > 1.2) box(0.15, H, 0.2, M.dark, x, GROUND + H / 2, T.z0, group);
  const doors = [box(1.6, 3.4, 0.08, M.termGlass, -0.8, GROUND + 1.7, T.z0, group), box(1.6, 3.4, 0.08, M.termGlass, 0.8, GROUND + 1.7, T.z0, group)];
  textPlane(10, 2.0, gateName, '#1b2a48', '#ffd34a', group, 0, GROUND + 7.4, T.z0 - 0.3, Math.PI);
  textPlane(4, 0.7, '🧳 BAGGAGE', '#1b2a48', '#fff', group, BELT_X, GROUND + 2.4, T.z0 - 0.25, Math.PI, 'bold 54px sans-serif');
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

  // ---- baggage conveyor belt, running out through a flap in the terminal wall
  box(1.4, 0.6, BELT_START - BELT_END + 1, M.grey, BELT_X, GROUND + 0.4, (BELT_START + BELT_END) / 2, group);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, BELT_START - BELT_END + 1), new THREE.MeshStandardMaterial({ map: beltTex, roughness: .8 }));
  belt.position.set(BELT_X, BELT_Y - 0.02, (BELT_START + BELT_END) / 2); group.add(belt);
  for (const s of [-1, 1]) box(0.08, 0.25, BELT_START - BELT_END + 1, M.yellow, BELT_X + s * 0.68, BELT_Y + 0.08, (BELT_START + BELT_END) / 2, group);
  box(1.6, 0.6, 0.2, M.yellow, BELT_X, GROUND + 0.4, BELT_END - 0.6, group);
  for (let i = 0; i < 7; i++) box(0.16, 1.0, 0.03, M.dark, BELT_X - 0.55 + i * 0.18, GROUND + 1.35, T.z0 - 0.05, group);

  // ---- control tower, lamp posts, fuel truck, cones
  cyl(1.8, 2.4, 26, wallM, -42, GROUND + 13, 75, group);
  cyl(4, 3, 4, std(0x2c4a63, { roughness: .2, metalness: .7 }), -42, GROUND + 28, 75, group);
  for (const [x, z] of [[-25, 60], [25, 60], [-25, 30], [25, 30], [-25, 0], [25, 0]]) { cyl(0.12, 0.15, 9, M.dark, x, GROUND + 4.5, z, group); box(1.2, 0.2, 0.5, M.lamp, x, GROUND + 9, z, group); }
  box(2.4, 2.2, 6, std(0xe8e8e0), 30, GROUND + 1.4, 50, group);
  box(2.4, 1.6, 2, M.red, 30, GROUND + 1.1, 46, group);
  for (const [x, z] of [[-6, 22], [6, 22], [-24, -4], [24, -4]]) cyl(0.02, 0.25, 0.7, std(0xff7a1a), x, GROUND + 0.35, z, group, 12);
  return doors;
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
  [BELT_X - 0.8, BELT_X + 0.8, BELT_END - 0.8, BELT_START + 0.6],
  ...[5, 7.5, 10].map(dz => [-14.2, -3.8, TERM.z0 + dz - 0.4, TERM.z0 + dz + 0.5]),
  [-17.1, -12.9, TERM.z0 + 2.5, TERM.z0 + 3.5], [-44.5, -39.5, 72.5, 77.5], [28.7, 31.3, 44.8, 53.2],
];
const airportBlocked = (x, z) => BLOCKS.some(b => x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3]);
const inAirport = (x, z) => Math.abs(x) < 60 && z > -30 && z < TERM.z1;
const inTerminal = (x, z) => x > TERM.x0 && x < TERM.x1 && z > TERM.z0 && z < TERM.z1;
