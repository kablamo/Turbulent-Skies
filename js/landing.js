// The landing at the end of the flight: a second airport slides into view, the plane glides down
// onto its runway (you line it up with A/D from the captain's seat, or the autopilot tries), brakes,
// and stops at the destination gate.
'use strict';
const airport2 = new THREE.Group();
scene.add(airport2);
buildAirport(airport2, 'GATE 808  ✈');
// turned around, so its runway stretches back toward the approaching plane and ends at the gate
airport2.rotation.y = Math.PI;
airport2.visible = false;

const LAND = { Z0: -3600, TOUCH: -800, ALT: 200, DECEL: 4 };
function startLanding() {
  S.phase = 'landing'; S.touched = false;
  S.landZ = LAND.Z0; S.landV = 150; S.alt = LAND.ALT; S.lpitch = -0.03;
  S.landX = PW.x + rand(40, 90) * pick([-1, 1]);           // the runway starts off to one side
  PW.vy = 0;
  airport2.visible = true; gear.visible = true;
  S.stormOn = false; storm.visible = false;
  ocean.visible = false;
  S.chase = true;                                           // outside view, so you can see the runway
  for (const it of scenery) if (it.kind === 'island') it.o.visible = false;
  say('🛬 Destination in sight! Sit in the captain\'s seat and line up with the runway using A/D. The autopilot will try if you don\'t.', 'good');
  chime();
}
function updateLanding(dt) {
  if (!S.touched) {
    const s = clamp((S.landZ - LAND.Z0) / (LAND.TOUCH - LAND.Z0), 0, 1);
    S.landV = 150 - 85 * s;
    S.alt = LAND.ALT * Math.pow(1 - s, 1.4);
    S.lpitch = s > 0.85 ? (s - 0.85) * 0.8 : -0.03;         // nose down on approach, flare at the end
    // the autopilot lines up (a bit lazily) if nobody's at the controls
    if (!piloted()) PW.vx += (clamp((S.landX - PW.x) * 0.4, -25, 25) - PW.vx) * Math.min(1, dt * 0.8);
    if (S.landZ >= LAND.TOUCH) touchdown();
  } else {
    // brake to a stop exactly at the gate
    S.landV = Math.sqrt(Math.max(0, 2 * LAND.DECEL * -S.landZ));
    S.alt = 0; S.lpitch *= Math.max(0, 1 - dt * 2);
    PW.vx *= Math.max(0, 1 - dt * 3);
    S.shake = Math.max(S.shake, Math.min(0.4, S.landV * 0.006));
    if (S.landV < 0.6) { S.landZ = 0; airport2.position.set(S.landX, PW.y, 0); return gameOver(true); }
  }
  S.landZ = Math.min(0, S.landZ + S.landV * dt);
  airport2.position.set(S.landX, PW.y - S.alt, S.landZ);
}
function touchdown() {
  S.touched = true;
  const off = Math.abs(S.landX - PW.x);
  S.shake = 1.2; jerk(1.0); beep(80, .6, 'sawtooth', .12);
  if (off > 23) {
    S.landQuality = 'off'; S.integrity -= 35; S.needs.calm -= 40;
    say('💥 You missed the runway and ploughed across the grass!', 'bad');
  } else if (off > 9) {
    S.landQuality = 'bumpy'; S.integrity -= 8; S.needs.calm -= 12;
    say('Bump! A little off-centre, but we\'re down.', 'bad');
  } else {
    S.landQuality = 'smooth'; S.needs.calm = Math.min(100, S.needs.calm + 20);
    say('🛬 Butter-smooth touchdown! The passengers cheer.', 'good');
  }
}
