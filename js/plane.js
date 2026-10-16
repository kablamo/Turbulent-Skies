// The airplane: fuselage, cockpit, cabin, lavatories, cargo bay, wings and engines,
// plus the things that can break off it.
'use strict';
const engines = {}, wings = {}, doors = {}, lavDoors = {}, segments = [], seats = [], beltSigns = [], navLights = [];
const hole = { seg: null, side: null };
let ramp, gear, movieTex;

// the in-flight movie: a little animated cartoon on the cabin screen
let movieT = 0, movieDrawT = 0;
function drawMovie(g, w, h) {
  if (movieT <= 0) {
    g.fillStyle = '#10161f'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a6a80'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.fillText('✈ FLIGHT 404', w / 2, h / 2 - 6);
    g.font = '14px sans-serif'; g.fillText('Please keep your seatbelt fastened', w / 2, h / 2 + 18);
    return;
  }
  const t = performance.now() / 1000;
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#ff9a5a'); sky.addColorStop(1, '#ffd98a');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = '#ffef9a'; g.beginPath(); g.arc(w * 0.75, h * 0.45, 22, 0, 7); g.fill();
  g.fillStyle = '#3d6b3d';
  for (let i = 0; i < 6; i++) { const x = ((i * 70 - t * 30) % (w + 80) + w + 80) % (w + 80) - 40; g.beginPath(); g.moveTo(x - 50, h); g.lineTo(x, h - 50); g.lineTo(x + 50, h); g.fill(); }
  g.font = '40px serif'; g.textAlign = 'center'; g.fillText('🐕', 60 + Math.sin(t * 2) * 30, h - 18 - Math.abs(Math.sin(t * 6)) * 18);
  g.fillText('🎈', w * 0.4, 50 + Math.sin(t) * 10);
}

function hullPiece(z0, z1, t0, tl, mat = M.hull, r = R) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, z1 - z0, 48, 1, true, t0 * D2R, tl * D2R), mat);
  m.rotation.x = Math.PI / 2; m.scale.x = SX; m.position.set(0, CY, (z0 + z1) / 2); plane.add(m);
  return m;
}
// One ring of fuselage. Each side panel (outer skin, stripes, inner lining and the window in it)
// is kept together in `meshes` so the whole thing rips away at once.
function hullSegment(z0, z1, withSides) {
  hullPiece(z0, z1, 300, 120, M.belly); hullPiece(z0, z1, 108, 144);
  hullPiece(z0, z1, 108, 144, M.ceiling, R - 0.06);
  if (!withSides) return;
  const seg = { z0, z1, z: (z0 + z1) / 2, sides: {} };
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1, mir = t => side === 'R' ? t : 360 - t;
    const wx = s * (wallX(1.45) - 0.06);
    const glass = box(0.2, 0.44, 0.32, M.window, wx, 1.45, seg.z);
    glass.renderOrder = 1;
    seg.sides[side] = { open: false, patched: false, meshes: [
      hullPiece(z0, z1, side === 'R' ? 60 : 252, 48),
      hullPiece(z0, z1, side === 'R' ? 60 : 252, 48, M.lining, R - 0.06),
      hullPiece(z0, z1, side === 'R' ? 62 : mir(65), 3, M.stripeRed, R + 0.01),
      hullPiece(z0, z1, side === 'R' ? 66 : mir(76), 10, M.stripe, R + 0.01),
      glass,
      box(0.05, 0.56, 0.44, M.frame, wx - s * 0.06, 1.45, seg.z),                    // window frame
      box(0.04, rand(0.05, 0.25), 0.33, M.white, wx - s * 0.09, 1.62, seg.z),        // window shade
    ] };
  }
  segments.push(seg);
}

// A walk-in lavatory with a door, toilet, sink and mirror.
// 'L' is the front lav (left of the front galley), 'R' the rear lav (right side of the cargo bay).
function lavRoom(side) {
  const front = side === 'L', s = front ? -1 : 1;
  const z0 = front ? BULK + 0.1 : 8.85, z1 = front ? -6.6 : 10.75;
  const dz0 = front ? -8.0 : 9.4, dz1 = front ? -7.2 : 10.2;
  const wx = s * 1.25, outer = s * 3.3, mid = (wx + outer) / 2, width = Math.abs(outer - wx);
  const area = front ? 'Front lavatory' : 'Rear lavatory', Name = front ? 'Front' : 'Rear';
  box(0.08, 2.3, dz0 - z0, M.lavWall, wx, 1.15, (z0 + dz0) / 2);
  box(0.08, 2.3, z1 - dz1, M.lavWall, wx, 1.15, (dz1 + z1) / 2);
  box(0.08, 0.2, dz1 - dz0, M.lavWall, wx, 2.2, (dz0 + dz1) / 2);
  box(width, 2.3, 0.08, M.lavWall, mid, 1.15, z1);
  if (!front) box(width, 2.3, 0.08, M.lavWall, mid, 1.15, z0);
  box(width, 0.06, z1 - z0, M.lavWall, mid, 2.32, (z0 + z1) / 2);
  box(0.4, 0.03, 0.4, M.lamp, mid, 2.28, (z0 + z1) / 2);
  // toilet against the outer wall
  const tx = s * 2.5, tz = (dz0 + dz1) / 2;
  const bowl = box(0.42, 0.4, 0.5, M.porcelain, tx, 0.2, tz);
  box(0.44, 0.05, 0.5, M.white, tx, 0.43, tz);
  box(0.18, 0.5, 0.42, M.porcelain, tx + s * 0.3, 0.6, tz);
  station('lav' + side, Name + ' lavatory toilet', area, bowl);
  // sink and mirror on the end wall
  const sz = front ? z0 + 0.25 : z1 - 0.25, mz = front ? z0 + 0.06 : z1 - 0.06;
  box(0.7, 0.08, 0.4, M.white, s * 1.85, 0.85, sz);
  cyl(0.14, 0.1, 0.1, M.steel, s * 1.85, 0.88, sz);
  box(0.6, 0.5, 0.02, M.mirror, s * 1.85, 1.45, mz);
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 8, 16), M.red);
  valve.position.set(s * 1.85, 0.6, sz); valve.rotation.x = Math.PI / 2; plane.add(valve);
  station('valve' + side, Name + ' lav water valve', area, box(0.4, 0.3, 0.4, M.hit, s * 1.85, 0.6, sz));
  // the door, hinged at dz0
  const hinge = new THREE.Group(); hinge.position.set(wx, 0, dz0); plane.add(hinge);
  const door = box(0.06, 2.0, 0.8, M.lavWall, 0, 1.0, 0.4, hinge);
  textPlane(0.3, 0.18, 'WC', '#2f6db5', '#fff', hinge, -s * 0.035, 1.6, 0.4, -s * Math.PI / 2, 'bold 70px sans-serif');
  box(0.08, 0.04, 0.12, M.steel, -s * 0.05, 1.0, 0.7, hinge);
  lavDoors[side] = { hinge, open: 0, target: 0, x: wx, z0: dz0, z1: dz1, swing: front ? 1.5 : -1.5 };
  station('lavdoor' + side, Name + ' lavatory door', front ? 'Front galley' : 'Cargo bay', door, { lavDoor: side });
}

(function buildPlane() {
  for (let z = NOSE; z < -1.25; z += 1.8) hullSegment(z, z + 1.8, true);
  hullSegment(-1.2, 1.2, false);                                   // exit-door section
  for (let z = 1.2; z < REAR - 0.05; z += 1.8) hullSegment(z, z + 1.8, true);
  box(2 * W + 0.1, 0.2, REAR - NOSE, M.carpet, 0, -0.1, (NOSE + REAR) / 2);
  box(1.0, 0.012, CARGO - GALLEY, M.runner, 0, 0.006, 0);
  for (const z of [-0.8, 0.8]) box(2 * W - 0.6, 0.014, 0.08, M.yellow, 0, 0.007, z);   // exit row markings

  // bulkheads: cockpit door at the front, a big cargo opening at the back
  const bulkhead = (z, hw, hh, mat, r) => {
    const s = new THREE.Shape(); s.absarc(0, CY, r, 0, Math.PI * 2, false);
    const h = new THREE.Path(); h.moveTo(-hw, 0); h.lineTo(-hw, hh); h.lineTo(hw, hh); h.lineTo(hw, 0); h.lineTo(-hw, 0); s.holes.push(h);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s, 32), mat); m.position.z = z; m.scale.x = SX; plane.add(m);
  };
  bulkhead(BULK, 0.55 / SX, 2.1, M.wall, R - 0.07);
  bulkhead(REAR, 1.8, 3.0, M.hull2, R);             // the back of the fuselage, painted like the outside

  // nose: a rounded, slightly drooping nose with a framed windshield wrapped around the top
  const NOSE_L = 3.5, NOSE_DROP = 1.2;
  const nosePiece = (h0, h1, phi0, phiLen, mat, rScale = 1) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const h = h0 + (h1 - h0) * i / 16;
      pts.push(new THREE.Vector2(Math.max(0.001, R * rScale * Math.sqrt(Math.max(0, 1 - (h / NOSE_L) ** 2))), h));
    }
    const geo = new THREE.LatheGeometry(pts, 32, phi0 * D2R, phiLen * D2R);
    geo.rotateX(-Math.PI / 2);                     // lathe axis now points forward (-z), phi 0 is the top
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {          // droop the tip so the pilots can see over it
      const h = Math.max(0, -pos.getZ(i));
      pos.setY(i, pos.getY(i) - NOSE_DROP * Math.pow(h / NOSE_L, 1.6));
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.scale.x = SX; m.position.set(0, CY, NOSE); plane.add(m);
    return m;
  };
  nosePiece(0, NOSE_L, 75, 210, M.hull2);              // chin and sides
  nosePiece(0, 0.35, 285, 150, M.hull2);               // above the windshield
  nosePiece(0.35, 2.95, 285, 150, M.glass);            // the windshield
  nosePiece(2.95, NOSE_L, 285, 150, M.hull2);          // nose tip
  for (const a of [285, 322, 358, 395, 432]) nosePiece(0.35, 2.95, a - 1.2, 2.4, M.dark, 1.006);   // window frames
  for (const h of [0.35, 2.95]) nosePiece(h - 0.04, h + 0.04, 285, 150, M.dark, 1.006);

  // upswept cargo-plane tail: only the top half of a cone, leaving room for the ramp underneath
  const tail = new THREE.Mesh(new THREE.ConeGeometry(R, 8, 40, 1, true, 90 * D2R, 180 * D2R), M.hull2);
  tail.rotation.x = Math.PI / 2 - 0.22; tail.scale.x = SX;
  tail.position.set(0, CY + 4 * Math.cos(tail.rotation.x), REAR + 4 * Math.sin(tail.rotation.x));
  plane.add(tail);
  // lower tail fairings, so the fuselage flows into the tail instead of stopping dead. The bottom
  // strip right behind the ramp is left open for the ramp to swing down through.
  const tailAxis = new THREE.Vector3(0, Math.cos(tail.rotation.x), Math.sin(tail.rotation.x));
  const tailSection = (t0, tl, d0, d1) => {
    const r0 = R * (1 - d0 / 8), r1 = R * (1 - d1 / 8) + 0.001;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, d1 - d0, 32, 1, true, t0 * D2R, tl * D2R), M.hull2);
    m.rotation.x = tail.rotation.x; m.scale.x = SX;
    m.position.set(0, CY, REAR).addScaledVector(tailAxis, (d0 + d1) / 2); plane.add(m);
  };
  tailSection(55, 35, 0, 8); tailSection(270, 35, 0, 8); tailSection(305, 110, 3.2, 8);
  const fin = box(0.3, 4.2, 3.4, M.stripe, 0, 4.6, 18.4); fin.rotation.x = 0.45;
  for (const s of [-1, 1]) textPlane(2.2, 1.1, '404', '#1f4fa8', '#ffd34a', fin, s * 0.16, 0.6, 0, s * Math.PI / 2, 'bold 200px sans-serif');
  box(12, 0.25, 2.2, M.hull, 0, 6.5, 19.6);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  beacon.position.set(0, 6.7, 19.6); plane.add(beacon); navLights.push({ m: beacon, blink: 1.3 });

  // the cargo ramp, hinged at the floor
  const pivot = new THREE.Group(); pivot.position.set(0, 0, REAR + 0.05); plane.add(pivot);
  const rw = 3.6 * SX;
  // painted like the fuselage on the outside, bare metal treads on the inside, with a dark seam all round
  box(rw, RAMP_LEN, 0.15, [M.hull, M.hull, M.hull, M.hull, M.hull, M.olive], 0, RAMP_LEN / 2, 0.08, pivot);
  for (const s of [-1, 1]) box(0.05, RAMP_LEN, 0.02, M.dark, s * (rw / 2 - 0.02), RAMP_LEN / 2, 0.165, pivot);
  box(rw, 0.05, 0.02, M.dark, 0, RAMP_LEN - 0.02, 0.165, pivot);
  box(rw - 0.4, 0.3, 0.02, M.stripe, 0, 0.6, 0.165, pivot);
  for (let i = 0; i < 6; i++) box(rw - 0.2, 0.05, 0.08, M.dark, 0, 0.3 + i * 0.5, -0.02, pivot);
  box(rw, 0.12, 0.12, M.yellow, 0, RAMP_LEN - 0.06, -0.02, pivot);
  for (const s of [-1, 1]) box(0.08, RAMP_LEN, 0.25, M.yellow, s * (rw / 2 - 0.05), RAMP_LEN / 2, -0.05, pivot);
  ramp = { pivot, open: 1, target: 1 };

  // landing gear (retracted after takeoff)
  gear = new THREE.Group(); plane.add(gear);
  for (const [x, y, z] of [[0, -1.25, -9.5], [-2.2, -1.25, 2], [2.2, -1.25, 2]]) {
    box(0.15, 1.2, 0.15, M.grey, x, y + 0.5, z, gear);
    cyl(0.35, 0.35, 0.3, M.dark, x, y, z, gear).rotation.z = Math.PI / 2;
    cyl(0.15, 0.15, 0.32, M.steel, x, y, z, gear).rotation.z = Math.PI / 2;
  }

  // ---- cockpit
  const dash = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.7, 0.3), new THREE.MeshBasicMaterial({
    map: canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#1b2430'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 7; i++) {
        const x = 40 + i * 72;
        if (i === 3) { g.fillStyle = '#123'; g.fillRect(x - 30, 20, 60, 88); g.fillStyle = '#39f'; g.fillRect(x - 24, 26, 48, 36); g.fillStyle = '#a6713a'; g.fillRect(x - 24, 62, 48, 40); g.fillStyle = '#fff'; g.fillRect(x - 24, 61, 48, 2); continue; }
        g.strokeStyle = '#8cf'; g.lineWidth = 3; g.beginPath(); g.arc(x, 64, 26, 0, 7); g.stroke();
        g.strokeStyle = '#fd4'; g.beginPath(); g.moveTo(x, 64); g.lineTo(x + Math.cos(i) * 20, 64 - Math.sin(i * 2) * 20); g.stroke();
      }
    }),
  }));
  dash.position.set(0, 0.85, NOSE - 0.15); plane.add(dash);
  box(3.1, 0.08, 0.55, M.dark, 0, 1.24, NOSE - 0.2);                 // glare shield
  box(3.0, 0.5, 0.5, M.panel, 0, 0.25, NOSE - 0.2);
  for (const s of [-1, 1]) {
    // pilot seats
    box(0.62, 0.16, 0.62, M.dark, s * 0.75, 0.45, -10.9);
    box(0.62, 0.95, 0.14, M.dark, s * 0.75, 0.98, -10.55);
    box(0.4, 0.22, 0.16, M.dark, s * 0.75, 1.58, -10.53);
    box(0.1, 0.4, 0.1, M.steel, s * 0.75, 0.2, -10.9);
    // yoke: column and horns
    box(0.07, 0.55, 0.07, M.dark, s * 0.75, 0.4, -11.65);
    box(0.4, 0.06, 0.06, M.dark, s * 0.75, 0.82, -11.62);
    box(0.06, 0.18, 0.06, M.dark, s * 0.75 - 0.2, 0.9, -11.62); box(0.06, 0.18, 0.06, M.dark, s * 0.75 + 0.2, 0.9, -11.62);
    // side consoles
    box(0.5, 0.8, 1.5, M.panel, s * 1.75, 0.4, -10.9);
    box(0.46, 0.02, 1.4, M.switches, s * 1.75, 0.81, -10.9);
  }
  station('yoke', 'Captain\'s seat & yoke', 'Cockpit', box(0.7, 0.6, 0.5, M.hit, -0.75, 0.85, -11.6));
  const ped = box(0.45, 0.7, 1.0, M.panel, 0, 0.35, -11.3);
  box(0.42, 0.02, 0.9, M.switches, 0, 0.71, -11.3);
  for (const [x, c] of [[-0.12, M.white], [0.0, M.white], [0.12, M.red]]) { box(0.04, 0.28, 0.04, M.steel, x, 0.85, -11.45); box(0.08, 0.06, 0.08, c, x, 0.99, -11.45); }
  station('pedestal', 'Engine & fuel controls', 'Cockpit', ped);
  box(0.08, 0.06, 0.28, M.dark, 1.7, 0.86, -10.6); box(0.02, 0.02, 0.4, M.dark, 1.72, 0.83, -10.35);
  station('pa', 'PA handset', 'Cockpit', box(0.4, 0.3, 0.5, M.hit, 1.7, 0.9, -10.6), { service: 'pa' });
  box(0.2, 0.04, 0.26, M.yellow, -1.7, 0.84, -10.55); box(0.04, 0.1, 0.04, M.white, -1.7, 0.9, -10.55);
  station('belt', 'Seatbelt sign switch', 'Cockpit', box(0.4, 0.3, 0.5, M.hit, -1.7, 0.9, -10.55), { service: 'belt' });
  // overhead panel, built right up into the ceiling
  const over = box(1.5, 1.0, 1.3, M.panel, 0, 3.25, -10.7);
  const overFace = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.25), M.switches);
  overFace.rotation.x = Math.PI / 2; overFace.position.set(0, 2.74, -10.7); plane.add(overFace);
  station('overhead', 'Overhead panel', 'Cockpit', over);

  // ---- front galley & front lav
  const closet = box(0.6, 2.1, 1.4, M.bin, 3.1, 1.05, -7.7);
  for (const z of [-8.05, -7.35]) box(0.02, 0.2, 0.05, M.steel, 2.79, 1.1, z);
  box(0.02, 2.0, 0.02, M.dark, 2.79, 1.05, -7.7);
  station('blankets', 'Blanket closet', 'Front galley', closet, { service: 'blankets' });
  box(0.4, 0.1, 0.12, M.steel, 1.5, 0.75, BULK + 0.1);
  const ext = cyl(0.1, 0.1, 0.55, M.red, 1.5, 1.05, BULK + 0.18);
  cyl(0.04, 0.04, 0.1, M.dark, 1.5, 1.38, BULK + 0.18);
  textPlane(0.4, 0.14, 'FIRE', '#c22', '#fff', plane, 1.5, 1.5, BULK + 0.04, 0, 'bold 80px sans-serif');
  station('extinguisher', 'Fire extinguisher', 'Front galley', ext);
  lavRoom('L');

  // ---- cargo bay & rear lav
  const cart = box(0.5, 1.0, 0.8, M.steel, 2.3, 0.5, 7.4);
  for (let i = 0; i < 3; i++) box(0.02, 0.02, 0.6, M.dark, 2.04, 0.3 + i * 0.3, 7.4);
  station('meals', 'Meal cart', 'Cargo bay', cart, { service: 'meals' });
  box(0.4, 0.05, 1.3, M.steel, -3.3, 0.95, 9.0);                           // tool shelf
  station('toolbox', 'Toolbox', 'Cargo bay', box(0.5, 0.3, 0.3, M.red, -3.2, 1.13, 9.0));
  box(0.4, 0.04, 0.12, M.steel, -3.2, 1.3, 9.0);
  station('ramp', 'Cargo ramp controls', 'Cargo bay', box(0.15, 0.6, 0.45, M.yellow, wallX(1.5) - 0.15, 1.5, 11.4));
  box(0.17, 0.12, 0.12, M.red, wallX(1.65) - 0.17, 1.65, 11.4);
  for (let i = 0; i < 6; i++) box(0.02, 1.6, 0.02, M.dark, -(wallX(1.2) - 0.12), 1.2, 7.2 + i * 0.75);   // cargo net
  for (let i = 0; i < 4; i++) box(0.02, 0.02, 3.8, M.dark, -(wallX(0.6 + i * 0.4) - 0.12), 0.6 + i * 0.4, 9.1);
  lavRoom('R');

  // ---- cabin: overhead bins, lights, seats, movie screen
  for (const s of [-1, 1]) {
    const bx = s * (wallX(2.2) - 0.45);
    box(0.8, 0.45, 13.0, M.bin, bx, 2.2, 0);
    for (let z = -6.3; z <= 6.4; z += 1.6) { box(0.01, 0.42, 0.02, M.frame, bx - s * 0.405, 2.2, z); box(0.012, 0.04, 0.3, M.dark, bx - s * 0.41, 2.3, z + 0.8); }
    box(0.35, 0.03, 13.0, M.lamp, s * (wallX(2.2) - 0.75), 1.97, 0);
    for (const z of ROWS) beltSigns.push(box(0.1, 0.05, 0.16, M.dark, s * (wallX(2.2) - 0.62), 1.95, z - 0.4));
  }
  box(0.3, 0.02, 13.0, M.lamp, 0, 3.8, 0);                                  // ceiling light strip
  ROWS.forEach((z, ri) => SEAT_X.forEach((x, i) => {
    box(0.06, 0.3, 0.06, M.steel, x - 0.2, 0.15, z); box(0.06, 0.3, 0.06, M.steel, x + 0.2, 0.15, z);
    box(0.6, 0.15, 0.55, M.seat, x, 0.38, z);
    box(0.6, 0.85, 0.12, M.seat, x, 0.9, z + 0.3).rotation.x = 0.08;
    box(0.5, 0.2, 0.135, M.white, x, 1.25, z + 0.33);
    box(0.06, 0.06, 0.45, M.dark, x + (i % 2 ? 0.31 : -0.31), 0.6, z + 0.03);
    seats.push({ x, z, label: (ri + 1) + 'ABCD'[i], row: ri + 1, occupant: null });
  }));
  movieTex = canvasTex(256, 144, drawMovie);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), new THREE.MeshBasicMaterial({ map: movieTex }));
  screen.position.set(0, 2.45, -6.55); plane.add(screen);
  box(1.7, 1.0, 0.05, M.dark, 0, 2.45, -6.58);
  box(0.06, 1.0, 0.06, M.dark, 0, 3.3, -6.58);
  station('movie', 'Cabin movie screen', 'Front of cabin', screen, { service: 'movie' });

  // ---- exit doors over the wings (swing outward and forward on a hinge)
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1, hx = s * 2.45 * SX;
    const hinge = new THREE.Group(); hinge.position.set(hx, 0, -1.2); plane.add(hinge);
    const panel = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.01, R - 0.01, 2.4, 12, 1, true, (side === 'R' ? 60 : 252) * D2R, 48 * D2R), M.hull2);
    panel.rotation.x = Math.PI / 2; panel.scale.x = SX; panel.position.set(-hx, CY, 1.2);
    hinge.add(panel);
    box(0.08, 0.38, 0.3, M.window, s * 0.12, 1.5, 1.2, hinge);
    box(0.14, 0.06, 0.3, M.red, -s * 0.12, 1.0, 1.6, hinge);
    textPlane(0.5, 0.12, 'EXIT', '#c22', '#fff', hinge, -s * 0.15, 1.95, 1.2, -s * Math.PI / 2, 'bold 70px sans-serif');
    doors[side] = { hinge, open: 0, target: 0 };
    station('door' + side, (side === 'L' ? 'Left' : 'Right') + ' exit door', 'Exit row', panel, { door: side });
  }
  // hitbox that gets moved to wherever the hull rips open
  station('hole', 'Hole in the wall', 'Cabin', box(0.5, 2.0, 1.6, M.hit, 0, -50, 0));

  // ---- wings with propeller engines
  const wingMesh = (x0, x1, s) => {
    const sh = new THREE.Shape();
    sh.moveTo(s * x0, le(x0)); sh.lineTo(s * x1, le(x1)); sh.lineTo(s * x1, te(x1)); sh.lineTo(s * x0, te(x0)); sh.lineTo(s * x0, le(x0));
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.45, bevelEnabled: false }), M.wing);
    m.rotation.x = Math.PI / 2; return m;
  };
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1, Side = side === 'L' ? 'Left' : 'Right';
    plane.add(wingMesh(ROOT - 0.2, WING_IN, s));
    box(1.6, 0.02, 2.4, M.dark, s * (ROOT + 0.9), 0.01, 0);   // painted walkway outside the door
    const fl = box(WING_IN - ROOT - 1, 0.02, 0.06, M.frame, s * (ROOT + WING_IN) / 2, 0.012, (te(ROOT) + te(WING_IN)) / 2 - 0.9);
    fl.rotation.y = -s * Math.atan(0.15);                     // flap hinge line
    const panel = new THREE.Group();
    plane.add(panel);
    panel.add(wingMesh(WING_IN, WING_OUT, s));
    box(0.2, 1.3, 1.5, M.red, s * WING_OUT, 0.6, (le(WING_OUT) + te(WING_OUT)) / 2, panel).rotation.z = -s * 0.25;
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: side === 'L' ? 0xff3030 : 0x30ff60 }));
    nav.position.set(s * (WING_OUT + 0.1), 0.05, le(WING_OUT) + 0.3); panel.add(nav);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(s * (WING_OUT + 0.1), 0.05, te(WING_OUT) - 0.2); panel.add(strobe); navLights.push({ m: strobe, blink: 1.0 });
    const patch = box(0.6, 0.3, te(WING_IN) - le(WING_IN) - 0.2, M.grey, s * WING_IN, 0, (le(WING_IN) + te(WING_IN)) / 2);
    patch.visible = false;
    wings[side] = { panel, patch, attached: true };
    station('tip' + side, Side + ' wing tip', Side + ' wing', box(1.2, 1.0, te(WING_IN) - le(WING_IN) - 0.2, M.hit, s * (WING_IN - 0.4), 0.4, (le(WING_IN) + te(WING_IN)) / 2));
    cyl(0.22, 0.22, 0.1, M.yellow, s * FUEL_X, 0.05, 3);
    station('fuel' + side, Side + ' fuel line', Side + ' wing', box(0.9, 0.6, 0.9, M.hit, s * FUEL_X, 0.25, 3));

    const eng = new THREE.Group();
    eng.position.set(s * ENG_X, 1.2, 0.4); plane.add(eng);
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.66, 3.6, 24), M.hull);
    nac.rotation.x = Math.PI / 2; eng.add(nac);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.06, 8, 24), M.dark); ring.position.z = -1.8; eng.add(ring);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.64, 0.25, 24), M.stripe); band.rotation.x = Math.PI / 2; band.position.z = -0.6; eng.add(band);
    box(0.25, 0.75, 2, M.grey, 0, -0.85, 0.3, eng);
    box(0.2, 0.2, 0.5, M.dark, s * 0.45, -0.25, 1.8, eng);
    const prop = new THREE.Group(); prop.position.z = -2.1; eng.add(prop);
    const hub = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 16), M.red);
    hub.rotation.x = -Math.PI / 2; hub.position.z = -0.2; prop.add(hub);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; prop.add(arm);
      box(0.22, 1.2, 0.05, M.dark, 0, 0.75, 0, arm).rotation.y = 0.35;
      box(0.22, 0.12, 0.06, M.yellow, 0, 1.3, 0, arm);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    disc.position.z = -2.1; eng.add(disc);
    engines[side] = { group: eng, prop, disc, spin: 10, state: 'ok', acc: 0, leak: false };
    station('eng' + side, Side + ' engine', Side + ' wing', nac);
  }

  // ---- a barbecue on the left wing (the airline calls it "premium outdoor dining")
  const g = new THREE.Group(); g.position.set(-BBQ_X, 0, (le(BBQ_X) + te(BBQ_X)) / 2 - 0.6); plane.add(g);
  const red = std(0xc0262e, { roughness: .35, metalness: .3, side: THREE.DoubleSide }), steel = std(0x9aa3ad, { metalness: .7, roughness: .3 });
  // kettle grill: a bowl, an open lid, three legs and a grate
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), red); bowl.position.y = 0.95; g.add(bowl);
  const lidHinge = new THREE.Group(); lidHinge.position.set(0, 0.95, 0.45); lidHinge.rotation.x = -1.2; g.add(lidHinge);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red); lid.position.z = -0.45; lidHinge.add(lid);
  cyl(0.04, 0.04, 0.1, M.dark, 0, 0.47, -0.45, lidHinge);
  for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const l = cyl(0.025, 0.025, 0.95, steel, Math.sin(a) * 0.3, 0.45, Math.cos(a) * 0.3, g); l.rotation.set(Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25); }
  const coals = cyl(0.36, 0.36, 0.04, new THREE.MeshBasicMaterial({ color: 0xff5a1a }), 0, 0.82, 0, g);
  cyl(0.42, 0.42, 0.015, M.dark, 0, 0.95, 0, g);
  const food = [];
  const brown = std(0x5a3418), sausage = std(0xb0502a);
  for (const [fx, fz] of [[-0.18, -0.12], [0.16, -0.15], [0.02, 0.17]]) food.push(cyl(0.11, 0.11, 0.05, brown, fx, 0.985, fz, g));
  for (const fz of [-0.02, 0.06]) { const sg = cyl(0.035, 0.035, 0.3, sausage, 0.05, 0.985, fz, g); sg.rotation.z = Math.PI / 2; food.push(sg); }
  // a little table with sauces and plates, a cooler, and a patio umbrella
  box(0.9, 0.05, 0.55, std(0xd9a066), 1.05, 0.78, 0, g);
  for (const [lx, lz] of [[0.65, -0.22], [1.45, -0.22], [0.65, 0.22], [1.45, 0.22]]) box(0.04, 0.78, 0.04, M.dark, lx, 0.39, lz, g);
  cyl(0.04, 0.045, 0.2, M.red, 0.85, 0.9, -0.1, g); cyl(0.04, 0.045, 0.2, M.yellow, 0.95, 0.9, -0.1, g);
  for (let i = 0; i < 4; i++) cyl(0.13, 0.11, 0.012, M.white, 1.25, 0.81 + i * 0.013, 0.05, g);
  box(0.6, 0.4, 0.4, std(0x2a7fd4), -1.0, 0.2, 0.3, g); box(0.62, 0.06, 0.42, M.white, -1.0, 0.43, 0.3, g);
  cyl(0.03, 0.03, 2.4, M.dark, 1.05, 1.2, 0.55, g);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.45, 12, 1, true), std(0xffd34a, { side: THREE.DoubleSide })); shade.position.set(1.05, 2.3, 0.55); g.add(shade);
  textPlane(0.9, 0.22, 'WING BBQ', '#c0262e', '#fff', g, -1.0, 0.22, 0.09, Math.PI, 'bold 80px sans-serif');
  const hit = box(1.2, 1.4, 1.2, M.hit, 0, 0.7, 0, g);
  station('bbq', 'Barbecue', 'Left wing', hit, { service: 'bbq' });
  window.bbq = { g, food, coals, lid: lidHinge, x: -BBQ_X, z: g.position.z };
})();

// ---------------------------------------------------------------- damage
const SPIN = { ok: 28, fire: 12, fail: 0, dead: 0 };
function setEngine(side, state) { engines[side].state = state; }
function detachPanel(side) {
  const w = wings[side];
  if (!w.attached) return;
  w.attached = false;
  plane.updateMatrixWorld(true);
  const m = w.panel.clone();
  m.applyMatrix4(plane.matrixWorld);
  scene.add(m);
  w.panel.visible = false;
  const s = side === 'L' ? -1 : 1;
  falling.push({ m, vel: new THREE.Vector3(s * 8, 6, 40), spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-5, 5)), t: 0, life: 8 });
  for (let i = 0; i < 30; i++) emitLocal(smokeFx, s * WING_IN, 0.3, 4, rand(-6, 6), rand(-4, 8), rand(10, 40), 0x777777, 1.5, 1.5, 3, 0.8);
  S.flash = 0.4; S.shake = 1; jerk(1);
  beep(90, 0.6, 'sawtooth', 0.12);
}
function explode(side) {
  netEvent('explode', side);
  const s = side === 'L' ? -1 : 1;
  for (let i = 0; i < 70; i++) emitLocal(fireFx, s * ENG_X, 1.2, 0.4, rand(-12, 12), rand(-6, 14), rand(-8, 30), pick([0xffaa22, 0xff5511, 0xffee88]), rand(1, 2.5), rand(.4, 1), 2);
  for (let i = 0; i < 40; i++) emitLocal(smokeFx, s * ENG_X, 1.2, 0.4, rand(-6, 6), rand(0, 8), rand(10, 40), 0x333333, 2, 2, 3, .8);
  S.flash = 0.9; S.shake = 1.5; jerk(1.5);
  beep(70, 1.0, 'sawtooth', 0.15);
}
function breakableWalls() {
  const out = [];
  for (const seg of segments) if (seg.z > GALLEY - 1.5) for (const side of ['L', 'R']) if (!seg.sides[side].open && !seg.sides[side].patched) out.push([seg, side]);
  return out;
}
function breachHull(seg, side) {
  if (!seg) [seg, side] = pick(breakableWalls());
  const sd = seg.sides[side], s = side === 'L' ? -1 : 1;
  sd.open = true;
  // the skin, lining, stripes, window, frame and shade all go together
  for (const m of sd.meshes) toDebris(m, new THREE.Vector3(s * rand(5, 12), rand(2, 8), rand(25, 45)));
  hole.seg = seg; hole.side = side;
  STATIONS.hole.mesh.position.set(s * (W - 0.2), 1.2, seg.z);
  for (let i = 0; i < 30; i++) emitLocal(smokeFx, s * W, rand(0.3, 2.3), seg.z + rand(-0.8, 0.8), s * rand(4, 10), rand(-2, 2), rand(5, 20), 0xcccccc, 0.8, 1.2, 3, 0.8);
  S.flash = 0.5; S.shake = 1.4; jerk(1.3);
  beep(110, 0.8, 'sawtooth', 0.14);
}
function patchHole() {
  if (!hole.seg) return;
  const seg = hole.seg, sd = seg.sides[hole.side];
  hullPiece(seg.z0, seg.z1, hole.side === 'R' ? 60 : 252, 48, M.grey, R - 0.03);
  sd.open = false; sd.patched = true;
  hole.seg = null; hole.side = null;
  STATIONS.hole.mesh.position.y = -50;
}
