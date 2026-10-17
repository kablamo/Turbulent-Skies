// The game loop: phases (airport → takeoff → flight), the per-frame update, HUD and game over.
'use strict';
function updateTakeoff(dt) {
  S.toT += dt;
  S.toSpeed = Math.min(1, S.toSpeed + dt / 7);
  airport.position.z += 75 * S.toSpeed * dt;
  if (!S.liftoff && S.toSpeed > 0.75 && ((piloted() && (pilotKeys().w || pilotKeys().arrowup)) || S.toT > 15)) { S.liftoff = true; say('Wheels up! ✈', 'good'); }
  if (S.liftoff) { S.alt += (8 + S.alt * 0.35) * dt; S.pitch += (0.13 - S.pitch) * Math.min(1, dt * 1.5); }
  else S.shake = Math.max(S.shake, 0.15 * S.toSpeed);
  airport.position.y = -S.alt;
  if (S.alt > 160) startFlight();
}
function startFlight() {
  S.phase = 'flight'; airport.visible = false; gear.visible = false; S.pitch = 0;
  for (const it of scenery) it.o.visible = true;
  say('Cruising altitude reached. Now the fun begins.', 'good');
}

// In multiplayer, only the host runs the real flight; everyone else just scrolls the scenery.
function updateFlight(dt, speed, prog) {
  const H = !isClient(), landing = S.phase === 'landing';
  if (H) S.ws = landing ? S.landV : 160 * speed;
  const worldSpeed = S.ws || 0;
  const oldX = PW.x;
  if (H) {
    if (!landing) S.dist += dt * speed;
    // steering (or the autopilot gently levelling out)
    if (piloted()) {
      const k = pilotKeys();
      const tx = (k.d || k.arrowright ? 1 : 0) - (k.a || k.arrowleft ? 1 : 0);
      const ty = landing ? 0 : (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0);   // the glide path is automatic
      PW.vx += (tx * 45 - PW.vx) * Math.min(1, dt * 1.4);
      PW.vy += (ty * 25 - PW.vy) * Math.min(1, dt * 1.4);
    } else { PW.vx *= Math.max(0, 1 - dt * 0.8); PW.vy *= Math.max(0, 1 - dt * 0.8); }
    PW.x += PW.vx * dt;
    PW.y = clamp(PW.y + PW.vy * dt, -220, 220);
    if (PW.y <= -220 || PW.y >= 220) PW.vy = 0;
  }
  ocean.position.x = PW.x;
  oceanTex.offset.x += (PW.x - oldX) / 266;
  oceanTex.offset.y += worldSpeed * dt / 266;
  scrollScenery(worldSpeed, dt);

  // storm cells
  if (H) {
    S.nextStorm -= dt;
    if (!landing && !S.stormOn && S.nextStorm <= 0) {
      S.stormOn = true; storm.visible = true;
      storm.position.set(PW.x + rand(-40, 40), PW.y + rand(-20, 20), -2600);
      say('⛈ Storm cell dead ahead! Steer around it from the cockpit, or buckle up.', 'bad');
      beep(520, .2, 'sine', .07); setTimeout(() => beep(520, .2, 'sine', .07), 300);
    }
  }
  const si = stormInfo();
  let stormNear = 0;
  if (si) {
    if (H) storm.position.z += worldSpeed * dt;
    stormNear = clamp(1 - Math.abs(si.z) / 1400, 0, 1) * clamp(1.8 - si.lateral, 0, 1);
    for (const p of storm.children) {
      tmpV.copy(p.position).add(storm.position);
      p.visible = Math.hypot(tmpV.x - PW.x, tmpV.y - PW.y, tmpV.z) > 40;
    }
    if (H && si.z > STORM_RZ + 900) { S.stormOn = false; storm.visible = false; S.nextStorm = rand(45, 65) - prog * 15; }
  }
  if (stormNear > 0.3 && Math.random() < dt * 0.7) { S.flash = 0.7; setTimeout(() => beep(55, .8, 'sawtooth', .08), rand(100, 600)); }

  if (H) {
    if (si && si.inside && Math.random() < dt * 0.025) randomFault();
    // emergencies
    for (const f of [...S.faults]) {
      f.age += dt;
      S.integrity -= f.def.drain * (1 + f.age / 30) * dt;
      if (f.age >= f.def.deadline) endFault(f, true);
    }
    S.integrity -= 0.15 * S.turb * dt;
    S.nextFault -= dt;
    if (!landing && S.nextFault <= 0) {
      if (S.firstFault) { spawnFault('fire'); S.firstFault = false; }
      else if (S.faults.length < 1 + Math.floor(prog * 1.6)) randomFault();
      S.nextFault = rand(48, 62) - prog * 12;
    }
    // a plane that's falling apart sometimes just loses a wall
    if (!landing && S.integrity < 30 && Math.random() < dt * 0.006) spawnFault('hull');
    if (landing) updateLanding(dt);
  }
  if (S.faults.length) {
    S.alarmT -= dt;
    if (S.alarmT <= 0) { S.alarmT = 1.4; beep(S.faults.length > 1 ? 960 : 820, .1, 'square', .025); }
  }
  return { si, stormNear, inStorm: !!(si && si.inside) };
}

function updatePassengerNeeds(dt, dead, openings) {
  const n = S.needs, belt = S.seatbelt;
  n.hunger -= 0.26 * dt;
  n.bored -= (belt ? 0.45 : 0.3) * (movieT > 0 ? 0.2 : 1) * dt;
  n.comfort -= (belt ? 0.35 : 0.16) * dt;
  const scare = (crocLoose() ? 1.2 : 0) + S.faults.reduce((a, f) => a + (f.def.minor ? 0.3 : 0.8), 0) + S.turb * (belt ? 1 : 4) + Math.abs(S.roll) * 6 + (dead ? 0.2 : 0) + openings;
  n.calm += (scare > 0.05 ? -scare * 0.65 : 1.6) * dt;
  n.comfort -= (S.turb * (belt ? 0.3 : 1.4) + openings * 0.6) * dt;
  for (const k in n) n[k] = clamp(n[k], 0, 100);
  for (const k in S.cd) S.cd[k] = Math.max(0, S.cd[k] - dt);

  S.nextCall -= dt;
  if (S.nextCall <= 0) { if (passengers.filter(p => p.calling).length < 2) startCall(); S.nextCall = rand(26, 38); }
  // passengers stretch their legs and queue for the loo when the seatbelt sign is off
  S.nextStroll -= dt;
  if (S.nextStroll <= 0) {
    S.nextStroll = rand(12, 22);
    const sitters = passengers.filter(p => p.state === 'seated' && !p.calling);
    if (!S.seatbelt && sitters.length) {
      const p = pick(sitters), front = p.seat.z < 0;
      p.state = 'walk'; setPose(p, 'stand'); p.then = 'lav';
      p.path = [{ x: p.seat.x, z: p.seat.z - 0.7 }, { x: 0, z: p.seat.z - 0.7 }, front ? { x: 0, z: -6.3 } : { x: 0, z: 9.8 }, front ? { x: -0.85, z: -7.6 } : { x: 0.85, z: 9.8 }];
    }
  }
  for (const p of passengers) {
    if (p.calling && (p.calling.t += dt) > 60) {
      p.calling = null; p.angry = 12; p.sprite.renderOrder = 0;
      n.calm -= 8; n.comfort -= 8;
      say(`${p.name} (${p.seat ? p.seat.label : '?'}) gave up waiting and is now furious. 😡`, 'bad');
    }
    p.angry = Math.max(0, p.angry - dt);
  }
  updateRage(dt);
  S.complainT -= dt;
  const aboard = passengers.filter(p => p.state !== 'gone');
  if (S.complainT <= 0 && aboard.length) {
    const low = Object.keys(n).sort((a, b) => n[a] - n[b])[0];
    if (n[low] < 40) { say(`${pick(aboard).name}: ${pick(COMPLAINTS[low])}`); S.complainT = rand(9, 14); } else S.complainT = 3;
  }
  return aboard.length;
}

function updateEffects(dt, flight) {
  for (const f of termAnim) f(S.t);
  for (const s of ['L', 'R']) {
    const e = engines[s], sx = s === 'L' ? -ENG_X : ENG_X;
    e.acc += dt;
    while (e.acc > 1 / 50) {
      e.acc -= 1 / 50;
      if (e.state === 'fire') {
        emitLocal(fireFx, sx + rand(-.5, .5), 1.2 + rand(0, .8), rand(-1.2, 2.0), rand(-1, 1), rand(1.5, 4), 14, pick([0xff8a20, 0xff4a10, 0xffcc44]), rand(.6, 1.2), rand(.3, .6), 1.5);
        if (Math.random() < .5) emitLocal(smokeFx, sx, 1.9, 2.2, rand(-1, 1), rand(1, 3), 22, 0x2a2a2a, 1.2, 2, 4, .7);
      } else if (e.state === 'fail' && Math.random() < .4) emitLocal(smokeFx, sx, 1.2, 2.4, rand(-.5, .5), rand(0, 1), 20, 0x666666, .8, 1.5, 3, .5);
      else if (e.state === 'dead' && Math.random() < .15) emitLocal(smokeFx, sx, 1.4, 2.2, 0, 1, 18, 0x444444, .8, 1.5, 3, .4);
      if (e.leak && Math.random() < .5) emitLocal(smokeFx, s === 'L' ? -FUEL_X : FUEL_X, 0.15, 3, rand(-.3, .3), rand(.5, 1.5), 9, 0xeef4ff, .3, 1, 3, .6);
    }
  }
  // the barbecue smokes away, a lot more when someone's grilling
  const grilling = S.holdKey === 'svcbbq';
  bbq.coals.material.color.setHSL(0.05, 1, 0.45 + Math.sin(S.t * 6) * 0.08 + (grilling ? 0.12 : 0));
  bbq.food.forEach((f, i) => { f.position.y = 0.985 + (grilling ? Math.max(0, Math.sin(S.t * 9 + i * 1.7)) * 0.12 : 0); });
  if (Math.random() < dt * (grilling ? 40 : 6))
    emitLocal(smokeFx, bbq.x + rand(-.2, .2), 1.1, bbq.z + rand(-.2, .2), rand(-.3, .3), rand(.8, 1.6), flight ? 12 : 0.4, grilling ? 0x999999 : 0xbbbbbb, .35, 1.6, 3, .45);
  if (flight && ramp.open > 0.3 && Math.random() < dt * 25)
    emitLocal(smokeFx, rand(-.6, .6), rand(.6, 2.2), rand(-6, 10), 0, 0, 6, 0xffffff, .3, 1.5, 3, .3);
  if (hole.seg && Math.random() < dt * 30) {
    const s = hole.side === 'L' ? -1 : 1;
    emitLocal(smokeFx, s * rand(0.5, W), rand(0.3, 2.2), hole.seg.z + rand(-2, 2), s * 6, 0, 2, 0xffffff, .25, 1, 3, .35);
  }
  for (const f of S.faults) if (f.id === 'toilet' && Math.random() < dt * 18) {
    const front = f.side === 'L';
    emitLocal(smokeFx, front ? rand(-2.8, -0.5) : rand(0.8, 2.8), 0.03, front ? rand(-8.4, -6.8) : rand(8.9, 10.6), rand(-.3, .3), 0, rand(-.3, .3), 0x3399ff, .4, 2, 2, .7);
  }
  const elec = S.faults.some(f => f.id === 'elec');
  if (elec && Math.random() < dt * 6) for (let i = 0; i < 6; i++) emitLocal(fireFx, rand(-.5, .5), 2.75, -10.7, rand(-2, 2), rand(-3, 0), rand(-2, 2), 0xfff066, .08, .4, 0);
  for (const l of cabinLights) l.intensity = elec ? (Math.random() < .3 ? 0.05 : 0.45) : 0.5;
  M.lamp.color.setHex(elec && Math.random() < .3 ? 0x333333 : 0xfff3d6);
  for (const b of beltSigns) b.material = S.seatbelt ? M.yellow : M.dark;
  for (const n of navLights) n.m.visible = (S.t % n.blink) < 0.12;
  // the cabin movie
  movieT = Math.max(0, movieT - dt);
  movieDrawT -= dt;
  if (movieDrawT <= 0) { movieDrawT = 0.15; const c = movieTex.userData.canvas; drawMovie(c.getContext('2d'), c.width, c.height); movieTex.needsUpdate = true; }
  // debris & parachutes
  for (let i = falling.length - 1; i >= 0; i--) {
    const fp = falling[i];
    fp.t += dt;
    if (fp.chute === 'free') {
      // free fall: tumbling head over heels, arms and legs going everywhere
      fp.vel.y -= 22 * dt;
      const core = fp.p.rig.core;
      core.rotation.x += fp.spinP.x * dt; core.rotation.z += fp.spinP.z * dt;
      animatePax(fp.p);
      if (fp.t > fp.openAt) {
        // FWUMP: the parachute opens and yanks them upright
        fp.chute = true; fp.chuteG.visible = true; fp.vel.y = -3;
        core.rotation.set(0, 0, 0); fp.p.pose = 'chute'; animatePax(fp.p);
        shout(fp.p, pick(YELLS.chute), 99);
      }
    } else if (fp.chute) {
      // sway gently under the canopy (relative to how they left the plane, so they never flip upside down)
      fp.vel.y = Math.max(fp.vel.y - 10 * dt, -7);
      if (!fp.baseQ) fp.baseQ = fp.m.quaternion.clone();
      fp.m.quaternion.copy(fp.baseQ); fp.m.rotateZ(Math.sin(fp.t * 2) * 0.2);
    }
    else { fp.vel.y -= 30 * dt; fp.m.rotation.x += fp.spin.x * dt; fp.m.rotation.y += fp.spin.y * dt; fp.m.rotation.z += fp.spin.z * dt; }
    fp.m.position.addScaledVector(fp.vel, dt);
    if (fp.t > fp.life) { scene.remove(fp.m); falling.splice(i, 1); }
  }
  fireFx.update(dt); smokeFx.update(dt);
}

// ---------------------------------------------------------------- main update
function update(dt) {
  S.t += dt;
  const flight = inAir();
  const prog = S.dist / TOTAL;

  // --- engines & speed
  let dead = 0, failed = 0;
  for (const s of ['L', 'R']) {
    const e = engines[s];
    if (e.state === 'dead' || e.state === 'fire') dead++;
    if (e.state === 'fail') failed++;
    const target = S.phase === 'airport' ? (e.state === 'ok' ? 10 : 0) : SPIN[e.state];
    e.spin += (target - e.spin) * Math.min(1, dt * 0.8);
    e.prop.rotation.z += e.spin * dt * (s === 'L' ? 1 : -1);
    e.disc.material.opacity = clamp((e.spin - 8) / 20, 0, 1) * 0.18;
  }
  const speed = Math.max(0.45, 1 - 0.22 * dead - 0.12 * failed);
  if (droneOsc) { droneOsc.frequency.value = 30 + (S.phase === 'airport' ? 0 : S.phase === 'takeoff' ? 18 * S.toSpeed : 18); droneGain.gain.value = S.phase === 'airport' ? 0.02 : 0.035; }

  // --- phase-specific
  let sky = { si: null, stormNear: 0, inStorm: false };
  const H = !isClient();
  if (H) {
    if (S.phase === 'takeoff') updateTakeoff(dt);
    if (S.driving) driveVehicle(S.driving, dt);
    for (const r of NET.remotes) if (r.driving) driveVehicle(r.driving, dt, r.keys);
  }
  if (S.phase === 'airport') updateVehicles(dt);
  if (S.phase === 'airport') {
    // the terminal's sliding doors open for anyone nearby
    const near = [P, ...passengers].some(b => Math.abs(b.x) < 2.5 && Math.abs(b.z - TERM.z0) < 2.5);
    termDoors.forEach((d, i) => { const tx = (i ? 1 : -1) * (near ? 2.3 : 0.8); d.position.x += (tx - d.position.x) * Math.min(1, dt * 5); });
  }
  if (flight) sky = updateFlight(dt, speed, prog);
  if (H) S.turb += ((sky.inStorm ? 1 : 0) - S.turb) * Math.min(1, dt * (sky.inStorm ? 2 : 0.7));
  S.gustT -= dt;
  if (S.gustT <= 0) {
    S.gustT = rand(0.3, 0.9); S.gustTarget = rand(-1, 1) * (0.4 + S.turb * 3.5);
    if (H && S.turb > 0.3) jerk(S.turb * 0.7);
  }
  S.gust += ((S.gustTarget || 0) - S.gust) * Math.min(1, dt * 3);

  // --- doors & ramp
  for (const s of ['L', 'R']) {
    const d = doors[s];
    d.open += clamp(d.target - d.open, -dt * 1.5, dt * 1.5);
    d.hinge.rotation.y = (s === 'L' ? -1 : 1) * d.open * 1.75;
    const ld = lavDoors[s];
    ld.open += clamp(ld.target - ld.open, -dt * 3, dt * 3);
    ld.hinge.rotation.y = ld.swing * ld.open;
  }
  ramp.open += clamp(ramp.target - ramp.open, -dt * 0.45, dt * 0.45);
  ramp.pivot.rotation.x = ramp.open * RAMP_OPEN;
  if (!P.falling && !S.driving && P.z > REAR - 0.05 && P.z < REAR + RAMP_RUN + 0.2 && Math.abs(P.x) < RAMP_HW && P.y > GROUND + 0.1 && ramp.open < 0.99 && ramp.target === 0) {
    if (S.phase === 'airport') { P.z = REAR - 0.3; P.y = 0; }
    else startFalling(0, 6, 'You rode the closing ramp... right off the plane!');
  }

  // --- plane attitude
  const auto = S.faults.some(f => f.id === 'autopilot');
  if (H) S.roll += ((auto ? Math.sin(S.t * 0.5) * 0.3 + 0.08 : 0) - S.roll) * Math.min(1, dt * 0.8);
  if (!H) netApplyPlane(dt);
  else if (flight) {
    plane.rotation.set((auto ? -0.05 : 0) + PW.vy * 0.006 + (S.phase === 'landing' ? S.lpitch : 0) + Math.sin(S.t * 5.3) * 0.015 * S.turb, 0,
      S.roll - PW.vx * 0.009 + Math.sin(S.t * 8.7) * 0.035 * S.turb);
    plane.position.set(PW.x, PW.y + Math.sin(S.t * 11) * 0.12 * S.turb, 0);
  } else plane.rotation.set(S.pitch, 0, 0);

  // --- player & camera
  rideVehicles();
  updatePlayer(dt);
  S.shake = Math.max(0, S.shake - dt * 2);
  const shake = S.turb * 0.05 + S.shake * 0.08;
  S.camThird = false;
  if (S.driving && S.chase) {
    // chase camera behind the vehicle (toggle with C)
    const v = S.driving, back = v.kind === 'bus' ? 11 : 7.5, up = v.kind === 'bus' ? 5.5 : 4;
    const cp = vehPoint(v, 0, back), look = vehPoint(v, 0, -5);
    camera.position.set(cp.x, GROUND + up, cp.z);
    camera.lookAt(look.x, GROUND + 1, look.z);
  } else if (S.flying && S.chase) {
    // outside view from behind the plane (toggle with C while flying)
    camera.position.set(rand(-shake, shake), 9, 42);
    camera.lookAt(plane.localToWorld(tmpV.set(0, 1, -25)));
  } else if (S.view === 'third' && !S.flying && !(S.driving && !S.driving.push)) {
    // third person: the camera hangs back behind your character (V switches to first person)
    thirdPersonCam(shake);
  } else if (S.driving) {
    // sitting in the driver's seat (or walking behind the trolley)
    const v = S.driving, e = vehPoint(v, v.eye.x, v.eye.z);
    if (v.push) P.walkT += Math.abs(v.v) * dt;                         // walking along behind the trolley
    const bob = v.push ? Math.sin(P.walkT * 2.6) * 0.035 : 0;
    camera.position.set(e.x, v.eye.y + bob + rand(-shake, shake), e.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
  } else {
    const bob = S.flying ? 0 : Math.sin(P.walkT * 2.6) * 0.035;
    camera.position.set(P.x + rand(-shake, shake), P.y + (S.flying ? 1.55 : EYE) + bob + rand(-shake, shake), P.z);
    camera.rotation.set(P.pitch, P.yaw, 0);
  }
  plane.updateMatrixWorld(true);
  if (H) { updateItems(dt); updatePassengers(dt); updateHeld(); hostCarry(); hostGrabs(dt); netShoveBags(dt); chatter(dt); }
  else netAnimate(dt);
  updateAvatars(dt);
  updateMe(dt);
  interact(dt);
  updateMarkers();
  const tools = heldTools();
  updateFPArms(dt);
  handItems['🧯'].visible = S.view === 'first' && !S.held && !S.driving && tools.some(i => i.startsWith('🧯'));
  handItems['🔫'].visible = S.view === 'first' && !S.held && !S.driving && tools.some(i => i.startsWith('🔫'));
  updateEffects(dt, flight);

  // --- passengers' needs, win / lose
  const openings = (ramp.open > 0.2 ? 1.2 : 0) + (doors.L.open > 0.2 ? 0.5 : 0) + (doors.R.open > 0.2 ? 0.5 : 0) + (hole.seg ? 1.5 : 0);
  if (flight && H) {
    const aboard = updatePassengerNeeds(dt, dead, openings);
    const hap = happiness();
    if (S.integrity <= 0) return gameOver(false, 'The plane fell apart around you. 🧩✈');
    if (!aboard) return gameOver(false, 'There are no passengers left on the plane. The airline has questions. 🪂');
    if (hap < 5) { S.lowHapT += dt; if (S.lowHapT > 2) return gameOver(false, 'The passengers mutinied and locked you in the lavatory. 😡'); } else S.lowHapT = 0;
    if (S.phase === 'flight' && S.dist >= TOTAL) startLanding();
    if (S.over) return;
  }

  // --- sky & fog (thick grey soup inside a storm)
  const k = Math.pow(prog, 1.6);
  scene.background.copy(SKY_A).lerp(SKY_B, k).lerp(SKY_STORM, Math.max(sky.stormNear * 0.75, S.turb));
  scene.fog.color.copy(scene.background);
  scene.fog.near = 400 - S.turb * 395;
  scene.fog.far = 2600 - S.turb * 2440;
  S.flash = Math.max(0, S.flash - dt * 2.5);
  hemi.intensity = 0.75 + S.flash * 1.5 - sky.stormNear * 0.35;
  sun.intensity = 0.8 - sky.stormNear * 0.5;
  if (windGain) windGain.gain.value = S.phase === 'airport' ? 0.01 : (!insideHull(P.x, P.z) ? 0.16 : 0.025) + openings * 0.04 + S.turb * 0.05;

  S.hudT -= dt;
  if (S.hudT <= 0) { S.hudT = 0.15; updateHud(prog, speed, tools, sky.si); }
  netUpdate(dt);
}

// passengers say silly things now and then (and something in the hold quacks)
function chatter(dt) {
  S.chatT = (S.chatT ?? 4) - dt;
  if (S.chatT > 0) return;
  S.chatT = rand(4, 8);
  const who = passengers.filter(p => ['terminal', 'seated', 'bus', 'walk', 'wait', 'inBus'].includes(p.state));
  if (who.length) {
    const lines = S.phase === 'airport' ? YELLS.airport : (S.faults.length || S.turb > 0.3) && Math.random() < 0.6 ? YELLS.scary : YELLS.flight;
    shout(pick(who), pick(lines), 3.2);
  }
  if (inAir() && Math.random() < 0.3 && items.some(i => i.type === BAGS.duck && i.state !== 'gone')) setTimeout(quack, rand(300, 1500));
}

// ---------------------------------------------------------------- HUD
function setBar(el, v) {
  el.style.width = clamp(v, 0, 100) + '%';
  el.style.background = `hsl(${clamp(v, 0, 100) * 1.2},75%,48%)`;
}
function boardingCard() {
  const b = boarding();
  const inTerm = passengers.filter(p => p.state === 'terminal').length, onBus = passengers.filter(p => p.state === 'bus').length;
  const onBelt = items.filter(i => i.state === 'pile').length, onTrolley = trolleys.reduce((n, v) => n + trolleyLoad(v), 0);
  const row = (ok, text, loc) => `<div class="st ${ok ? 'done' : 'cur'}">${ok ? '✓' : '▶'} ${text}${!ok && loc ? `<span class="loc">📍 ${loc}</span>` : ''}</div>`;
  return `<div class="card board"><div class="ct">🛫 BOARDING · FLIGHT 404</div>
    ${row(b.seated >= b.pax, `Passengers seated: ${b.seated}/${b.pax} needed`, `${inTerm} in the terminal · ${onBus} on the bus. Park the bus at the terminal doors and press F, then press F again at the cargo ramp.`)}
    ${row(b.loaded === b.bags, `Bags in the cargo bay: ${b.loaded}/${b.bags}`, `${onBelt} still in the pile · ${onTrolley} on the trolleys. Grab bags from the big pile by the conveyor (hold the left mouse button), drop them on a luggage trolley, push it to the cargo ramp with your hands and drag each bag into the cargo bay.`)}
    ${row(b.rampUp, 'Raise the cargo ramp', 'Cargo bay · yellow panel')}
    ${row(b.doorsShut, 'Exit doors closed', 'Exit row')}
    ${row(false, 'Take off from the captain\'s seat', 'Cockpit · yoke')}</div>`;
}
function updateHud(prog, speed, tools, si) {
  const hap = happiness();
  if (S.phase === 'flight') {
    const remain = (TOTAL - S.dist) / speed;
    $('eta').textContent = `ETA ${Math.floor(remain / 60)}:${String(Math.floor(remain % 60)).padStart(2, '0')}`;
  } else $('eta').textContent = { airport: 'AT THE GATE', takeoff: 'TAKING OFF', landing: S.touched ? 'TOUCHDOWN' : 'ON APPROACH' }[S.phase];
  $('bProg').style.width = prog * 100 + '%'; $('bProg').style.background = '#4af';
  setBar($('bInt'), S.integrity); $('intTxt').textContent = Math.max(0, Math.ceil(S.integrity)) + '%';
  setBar($('bHap'), hap); $('hapTxt').textContent = Math.round(hap) + '%';
  setBar($('nCalm'), S.needs.calm); setBar($('nHunger'), S.needs.hunger);
  setBar($('nBored'), S.needs.bored); setBar($('nComfort'), S.needs.comfort);
  const eng = s => ({ ok: '🟢', fire: '🔥', fail: '🟡', dead: '⚫' }[engines[s].state]);
  $('engTxt').textContent = `ENG L ${eng('L')} R ${eng('R')} · SPD ${Math.round(speed * 100)}%`;
  $('beltTxt').textContent = (S.turb > 0.3 ? '⚠ TURBULENCE ' : '') + (S.seatbelt ? '💺' : '');
  const st = $('stormTxt');
  if (S.phase === 'landing' && !S.touched) {
    const off = S.landX - PW.x;
    st.textContent = Math.abs(off) < 6 ? '🛬 Lined up with the runway ✓' : `🛬 Runway is ${Math.round(Math.abs(off))} m to the ${off > 0 ? 'RIGHT' : 'LEFT'}`;
    st.className = Math.abs(off) < 9 ? '' : 'hit';
  } else if (si && si.z < STORM_RZ) {
    const secs = Math.max(0, Math.round((-si.z - STORM_RZ) / (160 * speed)));
    st.textContent = si.inside ? '⛈ INSIDE THE STORM!' : si.lateral < 1 ? `⛈ Storm in ${secs}s, dead ahead! Steer ${si.dx > 0 ? 'LEFT' : 'RIGHT'}.` : `⛈ Storm in ${secs}s, passing safely to the ${si.dx > 0 ? 'right' : 'left'}`;
    st.className = si.lateral < 1 ? 'hit' : '';
  } else st.textContent = '';
  $('where').textContent = '📍 ' + (P.falling ? 'Mid-air!' : areaName(P.x, P.z));
  const holding = S.held ? [S.held.kind === 'pax' ? '🧍 ' + S.held.name : '🧳 ' + S.held.name] : tools;
  $('hand').textContent = holding.length ? 'Holding: ' + holding.join(', ') : '';

  // tasks
  let html = S.phase === 'airport' ? boardingCard() : '';
  for (const f of S.faults) {
    html += `<div class="card${f.def.minor ? ' minor' : ''}"><div class="ct">${f.title}</div><div class="cbar"><i style="width:${Math.min(100, f.age / f.def.deadline * 100)}%"></i></div>`;
    f.def.steps.forEach((st, i) => {
      const label = stepLabel(f, st);
      if (i < f.step) html += `<div class="st done">✓ ${label}</div>`;
      else if (i === f.step) {
        const s = STATIONS[stepAt(f, st)];
        html += `<div class="st cur">▶ ${label}<span class="loc">📍 ${s.id === 'hole' ? areaName(0, hole.seg ? hole.seg.z : 0) : s.area} · ${s.name}</span></div>`;
      } else html += `<div class="st">· ${label}</div>`;
    });
    html += '</div>';
  }
  if (crocLoose()) html += '<div class="card"><div class="ct">🐊 CROCODILE LOOSE IN THE CABIN</div><div class="st cur">▶ Grab it (E) and carry it back to the cargo bay<span class="loc">📍 Follow the screaming</span></div></div>';
  for (const p of passengers) if (p.calling)
    html += `<div class="card call">🔔 <b>${p.name}</b> (seat ${p.seat.label}) ${p.calling.text}<span class="loc">📍 Cabin · row ${p.seat.row}</span><div class="cbar"><i style="width:${p.calling.t / 40 * 100}%;background:#5af"></i></div></div>`;
  $('tasks').innerHTML = html;

  // services
  let sv = '<div class="row"><span>CABIN SERVICE</span></div>';
  for (const k in SERVICES) {
    const s = SERVICES[k], cd = S.cd[k];
    const status = k === 'belt' ? `<b class="${S.seatbelt ? 'wait' : 'ok'}">${S.seatbelt ? 'ON' : 'OFF'}</b>` : cd > 0 ? `<b class="wait">${Math.ceil(cd)}s</b>` : '<b class="ok">READY</b>';
    sv += `<div class="sv"><span>${s.icon}</span><span>${s.name}<small>${s.where}</small></span>${status}</div>`;
  }
  $('svc').innerHTML = sv;

  // passengers' faces
  const masks = S.faults.some(f => f.id === 'decomp' && f.step >= 1);
  for (const p of passengers) {
    if (p.calling || p.state === 'gone') continue;
    const m = hap + p.off;
    p.mood = m;
    const face = p.state === 'held' || p.state === 'air' ? '😵' : p.angry > 0 ? '😡' : masks && p.state === 'seated' ? '😷' : m > 78 ? '😄' : m > 60 ? '🙂' : m > 42 ? '😐' : m > 25 ? '😟' : m > 12 ? '😠' : '😱';
    if (face !== p.face) { p.face = face; p.sprite.material = emojiMat(face); }
    if (p.state === 'seated') p.rig.head.rotation.z = m < 25 || S.turb > 0.4 ? rand(-0.2, 0.2) : 0;   // nervous shaking
  }
  const crit = S.faults.some(f => !f.def.minor);
  $('warn').style.opacity = crit ? (0.3 + 0.25 * Math.sin(S.t * 8)) : S.integrity < 30 ? 0.3 : 0;
  $('flash').style.opacity = S.flash * 0.45;
}

function gameOver(won, reason) {
  S.over = true; S.running = false;
  if (droneGain) droneGain.gain.value = 0;
  if (windGain) windGain.gain.value = 0;
  unlock();
  const hap = Math.round(happiness()), integ = Math.max(0, Math.round(S.integrity));
  const stats = `Emergencies fixed: <b>${S.fixed}</b> · Times you fell off: <b>${S.falls}</b><br>Passengers who left by parachute: <b>${S.ejected}</b> · Bags lost: <b>${S.lostBags}</b>`;
  let html;
  if (won) {
    const landBonus = { smooth: 300, bumpy: 0, off: -300 }[S.landQuality] || 0;
    const score = Math.round(integ * 10 + hap * 10 + S.fixed * 50 - S.falls * 100 - S.ejected * 200 - S.lostBags * 50 + landBonus);
    const stars = score > 1900 ? 3 : score > 1300 ? 2 : 1;
    html = `<h1>🛬 Welcome to Gate 808!</h1>
      <p>${{ smooth: 'A butter-smooth landing (+300).', bumpy: 'A bumpy landing, but everyone walked away.', off: 'You landed... next to the runway (−300).' }[S.landQuality] || ''}</p>
      <p style="font-size:30px;margin:4px 0">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</p>
      <p>Airframe: <b>${integ}%</b> · Passenger happiness: <b>${hap}%</b><br>${stats}<br>Score: <b>${score}</b></p>
      <p>${pick(['The passengers applaud. A few of them are crying.', 'Everyone claps. Someone kisses the ground.', 'The airline is "reviewing the incident".'])}</p>`;
    chime();
  } else {
    html = `<h1>💥 Mission failed</h1><p>${reason}</p>
      <p>You made it <b>${Math.round(S.dist / TOTAL * 100)}%</b> of the way.<br>${stats}</p>`;
    explode('L'); explode('R');
  }
  netEvent('over', html);
  showGameOver(html);
}
function showGameOver(html) {
  S.over = true; S.running = false;
  unlock();
  $('ovBox').innerHTML = html + `<button class="big" onclick="location.href = location.pathname">Fly again</button>`;
  $('overlay').style.display = 'flex';
}

function startGame() {
  $('overlay').style.display = 'none';
  initAudio();
  S.running = true;
  lock(); goFullscreen();
  startCutscene();   // shows the HUD and the welcome message when it ends
}

// debug hook for testing from the console, e.g. __debug.spawnFault('hull') or __debug.boardAll()
function boardAll() {
  for (const p of passengers) if (p.state !== 'gone' && p.state !== 'seated') {
    if (p.busSeat) { p.busSeat.p = null; p.busSeat = null; }
    const seat = seats.find(s => !s.occupant); seat.occupant = p; p.seat = seat; p.state = 'seated'; setPose(p, 'sit'); p.x = seat.x; p.z = seat.z;
  }
  items.forEach((it, i) => { if (it.state !== 'gone') { freeSlot(it); it.g.visible = true; it.state = 'free'; it.x = -2.4 + (i % 4) * 0.9; it.z = 7.4 + Math.floor(i / 4) * 1.1; it.y = 0; it.vx = it.vz = it.vy = 0; } });
  ramp.target = 0;
}
window.__debug = { skipCutscene: () => skipCutscene(), NET, spawnFault, startCall, boardAll, takeOff, startFlight, throwHeld, enterVehicle, vehicleAction, S, P, PW, doors, lavDoors, ramp, items, passengers, hole, trolleys, bus };

// ---------------------------------------------------------------- third person
// The camera sits behind and a little above your head, looking the way you look. Indoors (the cabin, the
// terminal, the bus) it slides in closer rather than poking through the walls.
const _eye = new THREE.Vector3(), _cam = new THREE.Vector3(), BOOM = 3.4;
function camSpotOK(c) {
  if (insideHull(P.x, P.z)) return insideHull(c.x, c.z) && c.y > 0.25 && c.y < CY + Math.sqrt(Math.max(0, R * R - c.x * c.x)) - 0.35;
  if (S.phase === 'airport') {
    if (inTerminal(P.x, P.z)) return inTerminal(c.x, c.z) && c.y > GROUND + 0.3 && c.y < GROUND + 5.4;
    if (vehicleZoneAt(bus, P.x, P.z)) { const l = vehLocal(bus, c.x, c.z); return Math.abs(l.x) < 1.15 && Math.abs(l.z) < 4.0 && c.y > VFLOOR + 0.3 && c.y < VFLOOR + 2.4; }
  }
  const g = groundAt(c.x, c.z);
  return g === null || c.y > g + 0.3;
}
function thirdPersonCam(shake) {
  const d = lookDir(P);
  _eye.set(P.x, P.y + EYE - 0.1, P.z);
  for (let b = BOOM; b > 0.3; b -= 0.15) {
    // over your right shoulder, so you can see past your own head
    // (and a bit high, so your character sits low on the screen and their hat isn't in the way)
    _cam.copy(_eye).addScaledVector(d, -b); _cam.y += 0.75 * b / BOOM;
    _cam.x += Math.cos(P.yaw) * 0.45 * b / BOOM; _cam.z -= Math.sin(P.yaw) * 0.45 * b / BOOM;
    if (camSpotOK(_cam)) break;
  }
  S.camDist = _cam.distanceTo(_eye); S.camThird = true;
  camera.position.set(_cam.x + rand(-shake, shake), _cam.y + rand(-shake, shake), _cam.z);
  camera.rotation.set(P.pitch, P.yaw, 0);
}
// your own character (the same pilot everyone else sees), drawn when the camera is outside your head
let ME = null;
function updateMe(dt) {
  if (!ME) {
    ME = makeAvatar(NET.name, 'me'); ME.isMe = true;
    ME.g.traverse(o => { const i = targets.indexOf(o); if (i >= 0) targets.splice(i, 1); });   // you can't pick yourself up
    if (ME.bubble) ME.bubble.visible = false;
  }
  const seatCam = (S.driving && !S.driving.push) || S.flying;
  ME.g.visible = S.chase || (S.view === 'third' && !seatCam);
  const d = playerPose(LOCAL);
  if (P.falling) d.air = true;
  if (carriedByName()) d.cb = 1;
  // on your feet, your body is an active ragdoll (ragdoll.js); sitting, driving, flying or carried, it's animated
  const active = !P.falling && !d.cb && !S.flying && !P.sitV && !(S.driving && !S.driving.push);
  if (!active) { ME.rag = null; poseAvatar(ME, d, dt); return; }
  let Rg = ME.rag;
  // thrown by someone, or holding R: go limp
  if (Rg && P.launched) { goLimp(ME, P.lvx, P.vy, P.lvz); P.launched = false; P.lvx = P.lvz = 0; }
  if (Rg && keys.r && !Rg.limp && !S.driving) goLimp(ME, P.mvx, 0, P.mvz);
  if (Rg && Rg.limp) {
    if (S.held) throwHeld(1.2);
    // you're a ragdoll now: you go wherever your body goes
    Rg.limpT += dt;
    const pel = ragMid(Rg.pos, 7, 8), g = groundAt(pel.x, pel.z);
    P.x = pel.x; P.z = pel.z; P.y = g !== null && pel.y < g + 1.3 ? g : pel.y - 0.75; P.vy = 0; P.mvx = P.mvz = 0;
    if (g === null && pel.y < -2.5) { ME.rag = null; startFalling(0, 2); return; }   // tumbled off into the sky
    // let go of R and come to rest: the springs come back on and you heave yourself up
    if (!keys.r && Rg.limpT > 0.5 && (Rg.still > 0.25 || Rg.limpT > 3)) {
      Rg.limp = false; Rg.ramp = 0;
      let best = 1e9;
      for (let k = 0; k < 12; k++) {   // stand up facing whichever way is least twisting
        const yaw = P.face + k * Math.PI / 6, t = standPoints(ME, P.x, P.y, P.z, yaw);
        let e = 0; for (let i = 0; i < t.length; i++) e += (t[i].x - Rg.pos[i].x) ** 2 + (t[i].z - Rg.pos[i].z) ** 2;
        if (e < best) { best = e; Rg.upYaw = yaw; }
      }
      P.face = Rg.upYaw;
      if (S.view !== 'third') P.yaw = P.face;
    }
  }
  poseAvatar(ME, { ...d, yaw: P.face, noWalk: true }, dt);   // the animation: where the body *wants* to be (the stepping's done by balanceFeet)
  const g = groundAt(P.x, P.z), onGround = g !== null && P.y <= g + 0.06 && !S.driving;
  if (ME.rag) ME.rag.solidBags = true;
  activeRag(ME, dt, P.face, goal => { if (!S.driving) balanceFeet(ME, goal, dt, P.face, onGround); reachHands(goal); });   // the physics: where it actually is
  updateGrab();
  if (ME.model) poseModel(ME);
}

let last = performance.now(), lastDrawn = last;
function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // in multiplayer the world keeps going while your menu is open
  if (S.running && (!S.paused || NET.mode !== 'solo')) { update(dt); if (CUT.on) updateCutscene(dt); }
  else if (!S.running && !S.over) {
    // title screen: look out of the terminal at the plane
    camera.position.set(P.x, P.y + EYE, P.z);
    camera.rotation.set(0.02, Math.sin(now / 3000) * 0.4, 0);
    for (const s of ['L', 'R']) engines[s].prop.rotation.z += 0.15;
  } else { fireFx.update(dt); smokeFx.update(dt); }
}
function frame(now) {
  lastDrawn = performance.now();
  step(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// A backup clock for multiplayer. Browsers stop drawing a page that's minimised, in another tab or hidden behind
// another window, and if that's the host's page the whole world would freeze for everyone (the host runs it).
// A worker's timer keeps going in the background, so the game keeps running (just without drawing) until it's back.
(function () {
  const tick = () => { const now = performance.now(); if (NET.mode !== 'solo' && S.running && now - lastDrawn > 150) step(now); };
  try {
    const w = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33);'], { type: 'text/javascript' })));
    w.onmessage = tick;
  } catch (e) { setInterval(tick, 33); }
})();
