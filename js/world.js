// The sky world seen in flight: ocean, islands, clouds and storm cells.
'use strict';
const oceanTex = canvasTex(256, 256, g => {
  g.fillStyle = '#1f6f9f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${Math.random() < .5 ? '120,190,230' : '15,70,110'},${rand(.15, .4)})`;
    g.fillRect(rand(0, 256), rand(0, 256), rand(10, 40), rand(2, 4));
  }
});
oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping; oceanTex.repeat.set(30, 30);
const ocean = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshLambertMaterial({ map: oceanTex }));
ocean.rotation.x = -Math.PI / 2; ocean.position.y = -400;
scene.add(ocean);

const sphere = new THREE.SphereGeometry(1, 12, 10);
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
const stormMat = new THREE.MeshLambertMaterial({ color: 0x3b4150, transparent: true, opacity: 0.95 });
function makePuff(mat, count, size) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(sphere, mat);
    const r = size * rand(0.5, 1);
    m.scale.set(r, r * 0.7, r);
    m.position.set(rand(-size, size) * 1.3, rand(-size, size) * 0.3, rand(-size, size) * 0.8);
    g.add(m);
  }
  return g;
}
// somewhere around the plane, but never right on top of it
function clearSpot() {
  let x, y;
  do { x = rand(-700, 700); y = rand(-300, 250); } while (Math.abs(x) < 90 && Math.abs(y) < 60);
  return [PW.x + x, PW.y + y];
}
const scenery = [];
for (let i = 0; i < 34; i++) {
  const o = makePuff(cloudMat, 6, rand(15, 35));
  const [x, y] = clearSpot(); o.position.set(x, y, rand(-2500, 200)); o.visible = false;
  scene.add(o); scenery.push({ o, kind: 'cloud' });
}
for (let i = 0; i < 14; i++) {
  const g = new THREE.Group(), r = rand(40, 120);
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.15, r * 1.25, 3, 18), new THREE.MeshLambertMaterial({ color: 0xe6d29a }));
  const hill = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.8, 18), new THREE.MeshLambertMaterial({ color: 0x3f8f45 }));
  hill.position.y = r * 0.4; g.add(sand, hill);
  g.position.set(rand(-1500, 1500), -400, rand(-3000, 200)); g.visible = false;
  scene.add(g); scenery.push({ o: g, kind: 'island' });
}
function scrollScenery(worldSpeed, dt) {
  for (const it of scenery) {
    it.o.position.z += worldSpeed * dt;
    if (it.o.position.z > 400) {
      if (it.kind === 'cloud') { const [x, y] = clearSpot(); it.o.position.set(x, y, rand(-2800, -2400)); }
      else it.o.position.set(PW.x + rand(-1500, 1500), -400, rand(-3200, -2800));
    }
    // clouds never pass through the cabin
    if (it.kind === 'cloud') it.o.visible = Math.abs(it.o.position.x - PW.x) > 45 || Math.abs(it.o.position.y - PW.y) > 30 || Math.abs(it.o.position.z) > 60;
  }
}

// a storm cell: a dark mass you can fly into (or steer around)
const STORM_RX = 115, STORM_RY = 70, STORM_RZ = 330;
const storm = new THREE.Group();
for (let i = 0; i < 46; i++) {
  const p = makePuff(stormMat, 5, rand(18, 38));
  let x, y, z;
  do { x = rand(-1, 1); y = rand(-1, 1); z = rand(-1, 1); } while (x * x + y * y + z * z > 1);
  p.position.set(x * STORM_RX, y * STORM_RY, z * STORM_RZ);
  storm.add(p);
}
storm.visible = false;
scene.add(storm);
function stormInfo() {
  if (!S.stormOn) return null;
  const dx = storm.position.x - PW.x, dy = storm.position.y - PW.y, z = storm.position.z;
  const lateral = Math.hypot(dx / STORM_RX, dy / STORM_RY);
  return { dx, dy, z, lateral, inside: Math.abs(z) < STORM_RZ && lateral < 1 };
}
