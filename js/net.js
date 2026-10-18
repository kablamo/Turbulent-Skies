// Online multiplayer. One player hosts and runs the real game; friends join with a 4-letter code.
// Players connect directly to each other through PeerJS (a free public matchmaking service).
//   host → everyone: a snapshot of the world ~15 times a second, plus one-off events
//   player → host:   where they are / what keys they hold, and what they pressed E on
'use strict';
const PEER_PREFIX = 'turbulent-skies-404-';
const SNAP_RATE = 1 / 15;
let peer = null, hostConn = null, myId = null, netT = 0, gotFirstSnap = false;

// ---------------------------------------------------------------- lobby
const randomCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
function lobbyGo(mode, code) {
  const name = encodeURIComponent(($('nameIn').value || 'Pilot').trim().slice(0, 16));
  location.href = `${location.pathname}?${mode}=${code}&name=${name}`;
}
$('soloBtn').onclick = startGame;
$('hostBtn').onclick = () => lobbyGo('host', randomCode());
$('joinBtn').onclick = () => {
  const code = $('codeIn').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { $('lobbyMsg').textContent = 'Room codes are 4 letters, like KQZX.'; return; }
  lobbyGo('join', code);
};
$('nameIn').value = NET.name === 'Pilot' ? '' : NET.name;

function loadPeerJS(then) {
  if (window.Peer) return then();
  const s = document.createElement('script');
  s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  s.onload = then;
  s.onerror = () => lobbyError('Could not load the multiplayer library. Are you online?');
  document.head.appendChild(s);
}
function lobbyError(msg) {
  $('ovBox').innerHTML = `<h1>😬 Uh oh</h1><p>${msg}</p><button class="big" onclick="location.href = location.pathname">Back to the menu</button>`;
  $('overlay').style.display = 'flex';
}
function showRoomPanel() {
  const names = [NET.name + (NET.mode === 'host' ? ' (host, you)' : ' (you)'), ...(NET.roster || [])];
  $('netPanel').style.display = '';
  $('netPanel').innerHTML = `<b>ROOM ${NET.room}</b> · ${names.length} aboard<br><small>${names.join(' · ')}</small>`;
}

if (NET.mode === 'host') {
  $('ovBox').innerHTML = `<h1>✈ Hosting room <span style="color:#ffd34a">${NET.room}</span></h1>
    <p>Tell your friends to open the game, click <b>Join game</b> and type <b style="font-size:20px">${NET.room}</b>. They can join any time, even mid-flight.</p>
    <p id="hostStatus">Opening the room…</p><button class="big" id="goBtn" disabled>Start playing</button>`;
  loadPeerJS(() => {
    peer = new Peer(PEER_PREFIX + NET.room);
    peer.on('open', () => { $('hostStatus').textContent = 'Room open! Waiting for friends (you can start now).'; $('goBtn').disabled = false; });
    peer.on('error', e => lobbyError(e.type === 'unavailable-id' ? 'That room code is already in use. Go back and host again for a new one.' : 'Connection problem: ' + e.type));
    peer.on('connection', conn => conn.on('open', () => hostAddPlayer(conn)));
  });
  setTimeout(() => { if ($('goBtn')) $('goBtn').onclick = () => { startGame(); showRoomPanel(); }; });
} else if (NET.mode === 'client') {
  $('ovBox').innerHTML = `<h1>✈ Joining room <span style="color:#ffd34a">${NET.room}</span></h1><p id="joinStatus">Connecting…</p><button class="big" id="goBtn" disabled>Start playing</button>`;
  loadPeerJS(() => {
    peer = new Peer();
    peer.on('open', id => {
      myId = id;
      hostConn = peer.connect(PEER_PREFIX + NET.room, { reliable: true, serialization: 'json' });
      hostConn.on('open', () => { hostConn.send({ t: 'hello', name: NET.name }); $('joinStatus').textContent = 'Connected! Loading the plane…'; });
      hostConn.on('data', clientOnData);
      hostConn.on('close', () => lobbyError('The host left the game.'));
    });
    peer.on('error', e => lobbyError(e.type === 'peer-unavailable' ? `Room ${NET.room} wasn't found. Check the code with your host.` : 'Connection problem: ' + e.type));
  });
  $('goBtn').onclick = () => { startGame(); showRoomPanel(); };
}

// ---------------------------------------------------------------- avatars for other players
// They look like passengers (with captain hats and name tags). Look at one and press E to pick them up.
const avatars = {};
function makeAvatar(name, id) {
  const a = makePassenger(name, true);
  a.g.traverse(o => { if (o.isMesh) { delete o.userData.passenger; o.userData.playerId = id; } });
  // a pilot's uniform: white shirt, navy trousers, black shoes (and a captain's hat)
  a.mats.shirt.color.set(0xf2f4f8); a.mats.pants.color.set(0x1d2a4a); a.mats.shoes.color.set(0x151515);
  a.pilot = true;
  const head = a.rig.head;
  cyl(0.19, 0.2, 0.12, M.dark, 0, 0.2, 0, head); box(0.3, 0.02, 0.18, M.dark, 0, 0.15, -0.16, head);
  box(0.12, 0.05, 0.02, mat(0xffd34a, { metalness: .8 }), 0, 0.22, -0.2, head);
  a.sprite.visible = false;
  shout(a, '✈ ' + name, 1e9);
  if (MODEL.proto) applyModel(a);   // your Blender character, dressed as a pilot
  return a;
}
function removeAvatar(a) {
  plane.remove(a.g);
  a.g.traverse(o => { const i = targets.indexOf(o); if (i >= 0) targets.splice(i, 1); });
}
function poseAvatar(a, d, dt) {
  if (d.cb) {
    // being carried: lying sideways across someone's arms
    a.pose = 'held'; a.spinT = 0;
    lerpTo(a.g.position, d.x, d.y + EYE - 1.55, d.z, dt);
    a.g.rotation.set(0, d.yaw, 0); a.rig.core.rotation.set(0, 0, Math.PI / 2);
    animatePax(a);
    return;
  }
  if (a.isMe) a.g.position.set(d.x, d.y, d.z); else lerpTo(a.g.position, d.x, d.y, d.z, dt);
  // your body swings round to face the new way, a little behind
  a.g.rotation.set(0, a.isMe ? d.yaw : turnToward(a.g.rotation.y, d.yaw, 12 * dt), 0);
  wobble(a, dt);
  // the legs step in time with how far the body actually moved, so the feet don't skate
  const spd = Math.hypot(a.svx || 0, a.svz || 0);
  a.moving = spd > 0.3 && !d.seat;
  if (a.moving) stepGait(a, spd * dt, spd); else a.stride = Math.max(0, (a.stride || 0) - dt * 3);
  // picking things up and throwing them: a quick squat when something lands in your arms, a fling when it leaves
  const holding = !!(d.held || d.cy);
  if (holding !== !!a.wasHolding) { a.actT = 0; a.act = holding ? 'pickup' : 'throw'; }
  a.wasHolding = holding;
  a.actT = (a.actT ?? 9) + dt;
  const actLen = a.act === 'pickup' ? PICK_T + 0.1 : 0.45;
  a.pickK = Math.sin(Math.PI * clamp(a.actT / actLen, 0, 1));
  a.pose = d.seat ? 'sit' : d.push ? 'push' : a.actT < actLen ? a.act : holding ? 'carry' : a.stride > 0.05 && !d.noWalk ? 'walk' : 'stand';
  // thrown: tumbling through the air
  if (d.air) { a.spinT = (a.spinT || 0) + dt; a.pose = 'flail'; a.rig.core.rotation.set(a.spinT * 7, 0, a.spinT * 4); }
  else { a.spinT = 0; a.rig.core.rotation.set((a.pose === 'pickup' ? -0.45 * a.pickK : a.pose === 'push' ? -0.15 : 0) - a.lf, 0, -a.ls); }   // lean in (plus the wobble)
  a.rig.head.rotation.z = a.ls * 0.8;
  animatePax(a);
  // their body is an active ragdoll on their screen: show exactly what it's doing (eased between updates)
  if (d.rg && !a.isMe) {
    if (!a.cliRag) a.cliRag = Array.from({ length: 13 }, (_, j) => new THREE.Vector3(d.rg[j * 3], d.rg[j * 3 + 1], d.rg[j * 3 + 2]));
    const k = Math.min(1, dt * 16);
    a.cliRag.forEach((v, j) => { v.x += (d.rg[j * 3] - v.x) * k; v.y += (d.rg[j * 3 + 1] - v.y) * k; v.z += (d.rg[j * 3 + 2] - v.z) * k; });
    mapRag(a, a.cliRag, d.yaw);
    if (a.model) poseModel(a);
  } else a.cliRag = null;
}
const ragFlat = Rg => Rg ? Rg.pos.flatMap(v => [r2(v.x), r2(v.y), r2(v.z)]) : null;
// Wobbly bodies (a bit like Wobbly Life / Human Fall Flat): everyone leans into speeding up, slowing down
// and turning, on springs, so they overshoot and wobble back; the arms flop about the same way.
function wobble(a, dt) {
  dt = Math.max(dt, 1e-3);
  const p = a.g.position, jumped = a.wpx === undefined || Math.hypot(p.x - a.wpx, p.z - a.wpz) > 1;   // (teleports don't count)
  const vx = jumped ? (a.svx || 0) : (p.x - a.wpx) / dt, vz = jumped ? (a.svz || 0) : (p.z - a.wpz) / dt;
  a.wpx = p.x; a.wpz = p.z;
  const k = Math.min(1, dt * 10);
  const svx = (a.svx || 0) + (vx - (a.svx || 0)) * k, svz = (a.svz || 0) + (vz - (a.svz || 0)) * k;
  const ax = (svx - (a.svx || 0)) / dt, az = (svz - (a.svz || 0)) / dt;
  a.svx = svx; a.svz = svz;
  const yaw = a.g.rotation.y, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const fwdSpeed = svx * fx + svz * fz, fwdAcc = ax * fx + az * fz, sideAcc = ax * rx + az * rz;
  const spring = (key, target, stiff, damp) => {
    const v = (a[key + 'v'] || 0) + ((target - (a[key] || 0)) * stiff - (a[key + 'v'] || 0) * damp) * dt;
    a[key + 'v'] = v; a[key] = (a[key] || 0) + v * dt;
  };
  const waddle = Math.sin((a.walkT || 0) * 8) * clamp(Math.abs(fwdSpeed) / 3, 0, 1) * 0.09;
  spring('lf', clamp(fwdAcc * 0.05 + fwdSpeed * 0.04, -0.45, 0.45), 90, 7);   // forward/back lean
  spring('ls', clamp(sideAcc * 0.04 + waddle, -0.35, 0.35), 80, 6);           // side lean (and a waddle)
  spring('fl', clamp(-fwdAcc * 0.1, -1.0, 1.0), 55, 4);                       // floppy arms
  a.flop = a.fl; a.flopS = -a.ls * 0.8;
}
// the host shows remote players; everyone else shows whoever's in the snapshot except themselves
function updateAvatars(dt) {
  if (NET.mode === 'host') for (const r of NET.remotes) poseAvatar(r.avatar, playerPose(r), dt);
  if (NET.mode === 'client' && NET.players) {
    const seen = new Set();
    for (const d of NET.players) {
      if (d.id === myId) continue;
      seen.add(d.id);
      if (!avatars[d.id]) avatars[d.id] = makeAvatar(d.name, d.id);
      poseAvatar(avatars[d.id], d, dt);
    }
    for (const id in avatars) if (!seen.has(id)) { removeAvatar(avatars[id]); delete avatars[id]; }
  }
}

// ---------------------------------------------------------------- host side
function hostAddPlayer(conn) {
  const r = { id: conn.peer, conn, name: 'Pilot', isLocal: false, pose: { x: 0, y: GROUND, z: TERM.z0 + 4.5, yaw: 0, pitch: 0 }, keys: {}, held: null, driving: null };
  r.avatar = makeAvatar('...', r.id);
  NET.remotes.push(r);
  conn.on('data', m => hostOnData(r, m));
  conn.on('close', () => {
    if (r.held) throwHeld(1, r);
    if (r.carryP) releasePlayer(r, 1);
    if (r.carriedBy) r.carriedBy.carryP = null;
    if (S.pilotRP === r) S.pilotRP = null;
    removeAvatar(r.avatar);
    NET.remotes.splice(NET.remotes.indexOf(r), 1);
    say(`👋 ${r.name} left the flight.`);
    NET.roster = NET.remotes.map(x => x.name); showRoomPanel();
  });
  // start them in the terminal, or in the cabin if we're already flying
  if (S.phase === 'airport') netTeleport(r, rand(-3, 3), GROUND, TERM.z0 + 4.5, 0);
  else netTeleport(r, 0, 0, rand(-1, 1), 0);
}
const toHost = r => r;   // remote player objects double as "who" for actions
function hostOnData(r, m) {
  switch (m.t) {
    case 'hello':
      r.name = String(m.name || 'Pilot').slice(0, 16);
      removeAvatar(r.avatar); r.avatar = makeAvatar(r.name, r.id);
      say(`👋 ${r.name} joined the crew!`, 'good');
      NET.roster = NET.remotes.map(x => x.name); showRoomPanel();
      break;
    case 'me':
      if (!r.driving && S.pilotRP !== r && !r.carriedBy) Object.assign(r.pose, { x: m.x, y: m.y, z: m.z });
      r.pose.yaw = m.yaw; r.pose.pitch = m.pitch; r.pose.face = m.face; r.pose.tp = m.tp; r.rg = m.rg || null; r.grab = m.grab || null; r.keys = m.keys || {}; r.air = !!m.air; r.sit = !!m.seat;
      break;
    case 'act': {
      const ud = hostRef(m.ref); if (!ud) return;
      const a = actionFor(ud, toHost(r));
      if (!a || a.type === 'info') return;
      if (!a.ready) { if (a.why) r.conn.send({ t: 'say', text: a.why }); return; }
      if (m.how === 'mash' && a.mash) a.mash(); else if (a.done) a.done();
      break;
    }
    case 'throw':
      r.pose.yaw = m.yaw; r.pose.pitch = m.pitch;
      if (r.held) throwHeld(m.strength, r); else if (r.carryP) releasePlayer(r, m.strength);
      break;
    case 'wriggle': wriggle(r); break;
    case 'exit': if (r.driving) exitVehicle(r); break;
    case 'vpush': shoveVehicle(vehicles[m.i], m.dx, m.dz); break;   // a player bumped into a vehicle
    case 'knock': knockOver(passengers[m.i], m.vx, m.vz); break;    // …or ran someone over
    case 'fire': { const it = items[m.i]; if (it && it.type.weapon) weaponFire(r, it); break; }   // …or used a weapon
    case 'kick': { const it = items[m.i]; if (it && it.state === 'free') { it.vx = m.vx; it.vz = m.vz; it.vy = 2.5; } break; }   // …or kicked the beach ball
    case 'vehAct': if (r.driving) vehicleAction(r.driving); break;
    case 'busDoor': if (r.driving && r.driving.kind === 'bus') toggleBusDoor(r.driving); break;
    case 'stand': if (S.pilotRP === r) { S.pilotRP = null; netTeleport(r, -0.75, 0, -10, Math.PI); say(`${r.name} left the controls. Autopilot on.`); } break;
    case 'fell':
      if (r.held) throwHeld(1, r);
      if (r.carryP) releasePlayer(r, 1);
      S.integrity -= 3; S.needs.calm -= 15; S.falls++;
      say(`🪂 ${r.name} fell off the plane and climbed back in. The passengers saw everything.`, 'bad');
      break;
  }
}
function netTeleport(r, x, y, z, yaw) {
  Object.assign(r.pose, { x, y, z, yaw });
  if (r.conn && r.conn.open) r.conn.send({ t: 'tp', x, y, z, yaw });
}
// remote players shove luggage they walk into, just like you do
function netShoveBags(dt) {
  for (const r of NET.remotes) for (const it of items) {
    if (it.state !== 'free' || Math.abs(it.y - r.pose.y) > 0.8) continue;
    const dx = it.x - r.pose.x, dz = it.z - r.pose.z, d = Math.hypot(dx, dz);
    if (d < it.r + 0.3 && d > 0.001) { it.vx += dx / d * 40 * dt; it.vz += dz / d * 40 * dt; }
  }
}
function heldRef(o) { return !o ? null : o.kind === 'pax' ? ['pax', passengers.indexOf(o)] : ['item', items.indexOf(o)]; }
// which way someone's body faces (in third person that's where they're walking, not where they look)
const bodyYaw = who => who.isLocal ? P.face : (who.pose.face ?? who.pose.yaw);
const isThird = who => who.isLocal ? S.view === 'third' : !!who.pose.tp;
// where each player's body should be drawn (sitting at the wheel / in the cockpit when driving / flying, or walking behind the trolley)
function playerPose(who) {
  const v = who.isLocal ? S.driving : who.driving, flying = who.isLocal ? S.flying : S.pilotRP === who;
  const extra = { pitch: who.pose.pitch || 0, cb: who.carriedBy ? idOf(who.carriedBy) : null, cy: who.carryP ? idOf(who.carryP) : null,
    air: who.isLocal ? !!P.launched : !!who.air, held: !!who.held,
    rg: who.isLocal ? ragFlat(ME && ME.rag) : who.rg || null };
  if (v) { const e = vehPoint(v, v.eye.x, v.eye.z); return { x: e.x, y: v.floor, z: e.z, yaw: v.h, seat: !v.push, push: !!v.push, ...extra }; }
  if (flying) return { x: CPT.x, y: 0, z: CPT.z + 0.15, yaw: 0, seat: true, ...extra };
  const yaw = who.carriedBy ? bodyYaw(who.carriedBy) : bodyYaw(who);
  // sitting in a vehicle seat (your own y is lowered for the camera; report the floor)
  if (who.isLocal && P.sitV) return { x: P.x, y: P.sitV.floor, z: P.z, yaw, seat: true, ...extra };
  return { x: who.pose.x, y: who.pose.y, z: who.pose.z, yaw, seat: !!who.sit, ...extra };
}
const r2 = v => Math.round(v * 100) / 100;
function buildSnap() {
  const segBits = segments.map(sg => (sg.sides.L.open ? 1 : 0) | (sg.sides.L.patched ? 2 : 0) | (sg.sides.R.open ? 4 : 0) | (sg.sides.R.patched ? 8 : 0));
  const players = [LOCAL, ...NET.remotes].map(w => {
    const p = playerPose(w);
    return { id: idOf(w), name: w.name, x: r2(p.x), y: r2(p.y), z: r2(p.z), yaw: r2(p.yaw), pitch: r2(p.pitch), seat: p.seat, push: p.push, rg: p.rg, cb: p.cb, cy: p.cy, air: p.air,
      drv: vehicles.indexOf(w.isLocal ? S.driving : w.driving), fly: w.isLocal ? S.flying : S.pilotRP === w, held: heldRef(w.held) };
  });
  return {
    t: 'snap',
    S: { phase: S.phase, dist: S.dist, integrity: S.integrity, seatbelt: S.seatbelt, turb: S.turb, roll: S.roll, needs: S.needs, cd: S.cd, stormOn: S.stormOn,
      ws: S.ws || 0, alt: S.alt, pitch: S.pitch, toSpeed: S.toSpeed, liftoff: S.liftoff, landX: S.landX, touched: S.touched, landQuality: S.landQuality, lpitch: S.lpitch,
      fixed: S.fixed, falls: S.falls, ejected: S.ejected, lostBags: S.lostBags },
    F: S.faults.map(f => [f.id, f.side, f.step, r2(f.age), f.mash, f.uid]),
    PW: [r2(PW.x), r2(PW.y)], PR: [plane.rotation.x, plane.rotation.z, plane.position.y],
    st: [storm.position.x, storm.position.y, storm.position.z, storm.visible ? 1 : 0],
    ap: [airport.position.y, airport.position.z, airport.visible ? 1 : 0], ap2: [airport2.position.x, airport2.position.y, airport2.position.z, airport2.visible ? 1 : 0], gear: gear.visible ? 1 : 0,
    eng: ['L', 'R'].map(s => [engines[s].state, engines[s].leak ? 1 : 0]),
    wing: ['L', 'R'].map(s => [wings[s].attached ? 1 : 0, wings[s].patch.visible ? 1 : 0]),
    hole: hole.seg ? [segments.indexOf(hole.seg), hole.side] : null, segs: segBits,
    dr: [doors.L.target, doors.R.target, doors.L.open, doors.R.open, lavDoors.L.target, lavDoors.R.target, lavDoors.L.open, lavDoors.R.open, ramp.target, ramp.open, bus.door.target, bus.door.open].map(r2),
    V: vehicles.map(v => [r2(v.x), r2(v.z), Math.round(v.h * 1000) / 1000]),
    I: items.map(it => [r2(it.g.position.x), r2(it.g.position.y), r2(it.g.position.z), r2(it.g.rotation.y), it.state, it.g.visible ? 1 : 0, it.extra ? Object.keys(BAGS).find(k => BAGS[k] === it.type) : 0, it.caged ? 1 : 0, cargoFlags(it)]),
    X: passengers.map(p => [r2(p.g.position.x), r2(p.g.position.y), r2(p.g.position.z), r2(p.g.rotation.y), r2(p.rig.core.rotation.x), r2(p.rig.core.rotation.z),
      p.pose, r2(p.walkT), p.state, p.bubble && p.bubble.visible ? p.bubbleText : '', r2(p.mood), p.calling ? p.calling.text : null, p.seat ? seats.indexOf(p.seat) : -1, p.angry > 0 ? 1 : 0,
      p.rag ? p.rag.pos.flatMap(v => [r2(v.x), r2(v.y), r2(v.z)]) : null]),                    // a ragdoll's joints
    pl: players, movie: r2(movieT), ev: NET.events.splice(0),
  };
}

// ---------------------------------------------------------------- client side
function netSend(m) { if (hostConn && hostConn.open) hostConn.send(m); }
// a portable name for whatever you pointed at
function netRef(ud) {
  if (!ud) return null;
  if (ud.playerId) return { player: ud.playerId };
  if (ud.item) return { item: items.indexOf(ud.item) };
  if (ud.passenger) return { pax: passengers.indexOf(ud.passenger) };
  if (ud.drive) return { drive: vehicles.indexOf(ud.drive) };
  if (ud.busDoor) return { busDoor: vehicles.indexOf(ud.busDoor) };
  if (ud.detonator) return { detonator: vehicles.indexOf(ud.detonator) };
  if (ud.autoload) return { autoload: 1 };
  if (ud.station) return { station: ud.station };
  return null;
}
function hostRef(ref) {
  if (!ref) return null;
  if (ref.player !== undefined) return whoById(ref.player) && { playerId: ref.player };
  if (ref.item !== undefined) return items[ref.item] && { item: items[ref.item] };
  if (ref.pax !== undefined) return passengers[ref.pax] && { passenger: passengers[ref.pax] };
  if (ref.drive !== undefined) return vehicles[ref.drive] && { drive: vehicles[ref.drive] };
  if (ref.busDoor !== undefined) return vehicles[ref.busDoor] && { busDoor: vehicles[ref.busDoor] };
  if (ref.detonator !== undefined) return vehicles[ref.detonator] && { detonator: vehicles[ref.detonator] };
  if (ref.autoload) return { autoload: true };
  if (ref.station && STATIONS[ref.station]) return { station: ref.station };
  return null;
}
function clientOnData(m) {
  if (m.t === 'snap') {
    applySnap(m);
    if (!gotFirstSnap) { gotFirstSnap = true; $('joinStatus').textContent = 'Ready!'; $('goBtn').disabled = false; }
  } else if (m.t === 'launch') { launchMe(m); if (NET.me) NET.me.cb = null; }
  else if (m.t === 'tp' && P.sitV) { P.sitSeat.player = false; P.sitV = P.sitSeat = null; Object.assign(P, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, vy: 0, falling: false }); }
  else if (m.t === 'tp') { Object.assign(P, { x: m.x, y: m.y, z: m.z, yaw: m.yaw, vy: 0, falling: false }); }
  else if (m.t === 'say') sayLocal(m.text);
}
const lerpTo = (v, x, y, z, dt) => { const k = Math.min(1, dt * 14); v.x += (x - v.x) * k; v.y += (y - v.y) * k; v.z += (z - v.z) * k; };
let snapPR = [0, 0, 0], snapPW = [0, 0];
function applySnap(m) {
  const prevPhase = S.phase;
  Object.assign(S, m.S);
  if (prevPhase !== S.phase) onPhaseChange(prevPhase);
  // emergencies
  S.faults = m.F.map(([id, side, step, age, mash, uid]) => ({ id, side, step, age, mash, uid, def: DEFS[id], key: faultKey(id, side), title: DEFS[id].title(side) }));
  $('hud').classList.toggle('flicker', S.faults.some(f => f.id === 'elec'));
  snapPW = m.PW; snapPR = m.PR;
  storm.position.set(m.st[0], m.st[1], m.st[2]); storm.visible = !!m.st[3];
  airport.position.y = m.ap[0]; airport.position.z = m.ap[1]; airport.visible = !!m.ap[2];
  airport2.position.set(m.ap2[0], m.ap2[1], m.ap2[2]); airport2.visible = !!m.ap2[3]; gear.visible = !!m.gear;
  ['L', 'R'].forEach((s, i) => {
    engines[s].state = m.eng[i][0]; engines[s].leak = !!m.eng[i][1];
    if (!m.wing[i][0] && wings[s].attached) detachPanel(s);
    wings[s].patch.visible = !!m.wing[i][1];
  });
  // walls: rip off / patch to match the host
  segments.forEach((sg, i) => ['L', 'R'].forEach((side, j) => {
    const bits = m.segs[i] >> (j * 2), open = !!(bits & 1), patched = !!(bits & 2), sd = sg.sides[side];
    if (open && !sd.open) breachHull(sg, side);
    if (patched && !sd.patched) { hole.seg = sg; hole.side = side; patchHole(); }
  }));
  if (m.hole) { hole.seg = segments[m.hole[0]]; hole.side = m.hole[1]; STATIONS.hole.mesh.position.set((hole.side === 'L' ? -1 : 1) * (W - 0.2), 1.2, hole.seg.z); }
  else if (hole.seg && !hole.seg.sides[hole.side].open) { hole.seg = null; STATIONS.hole.mesh.position.y = -50; }
  const d = m.dr;
  [doors.L.target, doors.R.target, doors.L.open, doors.R.open, lavDoors.L.target, lavDoors.R.target, lavDoors.L.open, lavDoors.R.open, ramp.target, ramp.open, bus.door.target, bus.door.open] = d;
  m.V.forEach(([x, z, h], i) => {
    const v = vehicles[i];
    if (v === heldVehicle()) return;          // the trolley in your hands goes where you take it (physics.js), no waiting
    if (v === S.driving) { P.yaw += h - v.h; Object.assign(v, { x, z, h }); syncVehicle(v); return; }   // your view turns with the vehicle you're driving
    v.net = { x, z, h };                      // everything else glides there (netAnimate) instead of jumping 15 times a second
  });
  // luggage (new eggs appear as the chicken lays them)
  while (items.length < m.I.length) spawnBag(BAGS[m.I[items.length][6]] || BAGS.egg);   // (new eggs and banana peels)
  m.I.forEach(([x, y, z, ry, state, vis, egg, caged, fx], i) => {
    const it = items[i];
    if (it.state === 'gone') return;
    applyCargoFlags(it, fx);
    if (it.g.userData.cage) { it.caged = !!caged; it.g.userData.cage.visible = !!caged; }
    it.net = { x, y, z, ry }; it.state = state; it.g.visible = !!vis;
    if (!it.placed) { it.g.position.set(x, y, z); it.placed = true; }
  });
  m.X.forEach(([x, y, z, ry, crx, crz, pose, walkT, state, bubble, mood, calling, seatI, angry, rg], i) => {
    const p = passengers[i];
    if (p.state === 'gone') return;
    p.netRag = rg;
    if (state === 'gone') { p.state = 'gone'; p.g.visible = false; return; }   // left behind (or off the plane)
    p.net = { x, y, z, ry, crx, crz }; p.pose = pose; p.walkT = walkT; p.state = state; p.mood = mood; p.angry = angry ? 1 : 0;
    p.seat = seatI >= 0 ? seats[seatI] : null;
    if (bubble && (bubble !== p.bubbleText || !p.bubble.visible)) shout(p, bubble, 3);
    if (!bubble && p.bubble) p.bubble.visible = false;
    if (calling && !p.calling) { p.calling = { t: 0, text: calling }; p.sprite.material = emojiMat('🔔', true); p.face = '🔔'; }
    else if (!calling && p.calling) { p.calling = null; p.face = ''; }
    if (!p.placed) { p.g.position.set(x, y, z); p.placed = true; }
  });
  // other players, and what the host says *you* are doing
  NET.players = m.pl;
  const roster = m.pl.filter(p => p.id !== myId).map(p => p.name + (p.id === 'host' ? ' (host)' : ''));
  if (String(roster) !== String(NET.roster)) { NET.roster = roster; if (S.running) showRoomPanel(); }
  const me = m.pl.find(p => p.id === myId);
  NET.me = me;
  if (me) {
    const wasDriving = S.driving;
    S.driving = me.drv >= 0 ? vehicles[me.drv] : null;
    if (S.driving && !wasDriving) { P.yaw = S.driving.h; S.chase = true; }
    if (me.fly && !S.flying) { P.yaw = 0; P.pitch = 0.02; }
    S.flying = me.fly;
    S.held = !me.held ? null : me.held[0] === 'pax' ? passengers[me.held[1]] : items[me.held[1]];
  }
  movieT = m.movie;
  // one-off events, replayed quietly (the host's messages arrive as 'say' events)
  for (const e of m.ev) {
    if (e[0] === 'say') { sayLocal(e[1], e[2]); continue; }
    NET.quiet = true;
    try {
      if (e[0] === 'explode') explode(e[1]);
      else if (e[0] === 'confetti') burstConfetti(e[1], e[2], e[3]);
      else if (e[0] === 'nuke') nukeLooks(e[1], e[2], e[3]);
      else if (e[0] === 'dart') spawnDart(e[1], e[2], e[3], e[4], e[5], e[6], false);
      else if (e[0] === 'whack') { quack(); burstConfetti(e[1], e[2], e[3], 12); }
      else if (e[0] === 'eject' && passengers[e[1]].state !== 'gone') ejectPassenger(passengers[e[1]]);
      else if (e[0] === 'lost' && items[e[1]].state !== 'gone') { const it = items[e[1]]; overboard(it); toDebris(it.g, new THREE.Vector3(rand(-2, 2), -2, 25)); }
      else if (e[0] === 'over') { NET.quiet = false; showGameOver(e[1].html ?? e[1], e[1].end); }
    } finally { NET.quiet = false; }
  }
}
function onPhaseChange(prev) {
  if (S.phase === 'takeoff') { for (const sd of [doors.L, doors.R]) sd.target = 0; }
  if (S.phase === 'flight') { gear.visible = false; for (const it of scenery) it.o.visible = true; }
  if (S.phase === 'landing') { ocean.visible = false; for (const it of scenery) if (it.kind === 'island') it.o.visible = false; S.chase = true; }
}
// smooth the 15-per-second snapshots out into every frame
function netApplyPlane(dt) {
  const k = Math.min(1, dt * 10);
  PW.x += (snapPW[0] - PW.x) * k; PW.y += (snapPW[1] - PW.y) * k;
  plane.rotation.x += (snapPR[0] - plane.rotation.x) * k; plane.rotation.z += (snapPR[1] - plane.rotation.z) * k;
  plane.position.set(inAir() ? PW.x : 0, inAir() ? PW.y : 0, 0);
}
function netAnimate(dt) {
  for (const v of vehicles) if (v.net && v !== S.driving && v !== heldVehicle()) {
    const k = Math.min(1, dt * 12), dh = Math.atan2(Math.sin(v.net.h - v.h), Math.cos(v.net.h - v.h));
    if (Math.hypot(v.net.x - v.x, v.net.z - v.z) > 4) { v.x = v.net.x; v.z = v.net.z; v.h = v.net.h; }
    else { v.x += (v.net.x - v.x) * k; v.z += (v.net.z - v.z) * k; v.h += dh * k; }
    syncVehicle(v);
  }
  for (const it of items) if (it.net && it.state !== 'gone') {
    lerpTo(it.g.position, it.net.x, it.net.y, it.net.z, dt);
    it.g.rotation.set(0, it.net.ry, 0);
    it.x = it.g.position.x; it.y = it.g.position.y; it.z = it.g.position.z;
    if (it.alive && it.g.userData.jaw) it.g.userData.jaw.rotation.x = Math.max(0, Math.sin(S.t * 5 + it.phase)) * 0.55;
  }
  for (const p of passengers) if (p.net && p.state !== 'gone') {
    if (p.netRag) {
      // a ragdoll: ease our copy of its joints toward the host's, and pose the body from them
      const k = Math.min(1, dt * 14);
      if (!p.cliRag) { p.cliRag = Array.from({ length: 13 }, () => new THREE.Vector3()); p.ragFresh = true; }
      p.cliRag.forEach((v, j) => { const tx = p.netRag[j * 3], ty = p.netRag[j * 3 + 1], tz = p.netRag[j * 3 + 2]; if (p.ragFresh) v.set(tx, ty, tz); else { v.x += (tx - v.x) * k; v.y += (ty - v.y) * k; v.z += (tz - v.z) * k; } });
      p.ragFresh = false;
      mapRag(p, p.cliRag, p.net.ry);
      p.x = p.g.position.x; p.z = p.g.position.z;
      animatePax(p);
      p.hadRag = true;
      continue;
    }
    p.ragFresh = true;
    // the ragdoll just ended: blend out of it smoothly here too
    if (p.hadRag) { p.hadRag = false; startPoseBlend(p, p.g.position); }   // (the position already glides over by itself here)
    lerpTo(p.g.position, p.net.x, p.net.y, p.net.z, dt);
    p.g.rotation.set(0, p.net.ry, 0);
    p.rig.core.rotation.set(p.net.crx, 0, p.net.crz);
    p.x = p.g.position.x; p.z = p.g.position.z;
    animatePax(p);
    if (p.bubble && p.bubble.visible && (p.bubbleT -= dt) <= 0) p.bubble.visible = false;
  }
}

// ---------------------------------------------------------------- picking up other players
// The host decides who's carrying whom; a carried player's own game just follows their carrier around.
const idOf = w => w.isLocal ? 'host' : w.id;
function whoById(id) { return id === 'host' ? LOCAL : NET.remotes.find(r => r.id === id) || null; }
const nameOfId = id => { const d = (NET.players || []).find(q => q.id === id); return d ? d.name : 'Someone'; };
const isDriving = w => w.isLocal ? !!S.driving : !!w.driving;
const isFlying = w => w.isLocal ? S.flying : S.pilotRP === w;
// who's carrying you / who you're carrying (null if nobody)
function carriedByName() { return isClient() ? (NET.me && NET.me.cb ? nameOfId(NET.me.cb) : null) : LOCAL.carriedBy ? LOCAL.carriedBy.name : null; }
function carryingName() { return isClient() ? (NET.me && NET.me.cy ? nameOfId(NET.me.cy) : null) : LOCAL.carryP ? LOCAL.carryP.name : null; }
// a carried player is held a metre in front of their carrier
function carrySpot(pp) { const d = lookDir(pp); return { x: pp.x + d.x * 1.0, y: pp.y, z: pp.z + d.z * 1.0 }; }
function canCarry(who, t) {
  if (!t || t === who) return null;
  if (who.held || who.carryP) return 'Your hands are full!';
  if (who.carriedBy) return null;
  if (t.carriedBy) return `Someone is already carrying ${t.name}!`;
  if (t.carryP) return `${t.name} is carrying someone. One at a time!`;
  if (isDriving(t) || isFlying(t)) return `${t.name} is busy ${isFlying(t) ? 'flying the plane' : 'driving'}!`;
  return 'ok';
}
function carryPlayer(who, t) {
  if (canCarry(who, t) !== 'ok') return;
  who.carryP = t; t.carriedBy = who; t.wriggle = 0;
  say(pick([`💪 ${who.name} picked up ${t.name}!`, `${who.name} scooped up ${t.name} like a sack of potatoes!`, `${t.name} is being carried by ${who.name}. How undignified.`]));
  beep(500, .08, 'sine', .05);
}
// let go of whoever `who` is carrying: a gentle drop, or a big throw
function releasePlayer(who, strength) {
  const t = who.carryP; if (!t) return;
  who.carryP = null; t.carriedBy = null;
  const d = lookDir(who.pose);
  const v = { x: d.x * strength, y: Math.max(0, d.y) * strength + (strength > 2 ? 3.5 : 0.5), z: d.z * strength };
  if (t.isLocal) launchMe(v); else if (t.conn && t.conn.open) t.conn.send({ t: 'launch', x: v.x, y: v.y, z: v.z });
  if (strength > 2) {
    say(pick([`🚀 ${who.name} threw ${t.name}!`, `${t.name} is flying! (Thanks, ${who.name}.)`, `${who.name} yeeted ${t.name} across the room.`]));
    beep(300, .15, 'triangle', .06);
  }
}
function launchMe(v) { P.lvx = v.x; P.lvz = v.z; P.vy = v.y; P.y += 0.2; P.launched = true; }
// mash Space while carried to escape
function wriggle(t) {
  if (!t.carriedBy) return;
  t.wriggle = (t.wriggle || 0) + 1;
  if (t.wriggle >= 8) { const c = t.carriedBy; say(`🐛 ${t.name} wriggled free from ${c.name}!`); releasePlayer(c, 1.5); }
}
// a carrier's position, smoothed (remote players only report in 15 times a second)
function smoothPose(who) {
  if (who.isLocal) return who.pose;
  const g = who.avatar.g.position;
  return { x: g.x, y: g.y, z: g.z, yaw: bodyYaw(who), pitch: isThird(who) ? -0.15 : who.pose.pitch || 0 };
}
// host: keep carried players in their carrier's arms, and drop them if the carrier gets busy
function hostCarry() {
  for (const who of [LOCAL, ...NET.remotes]) {
    const t = who.carryP; if (!t) continue;
    if (isDriving(who) || isFlying(who) || (who.isLocal && P.falling)) { releasePlayer(who, 1); continue; }
    const c = carrySpot(smoothPose(who));
    if (t.isLocal) { P.x = c.x; P.y = c.y; P.z = c.z; P.vy = 0; }
    else Object.assign(t.pose, c);
  }
}
// client: if you're being carried, go where your carrier's arms are
function followCarrier() {
  const id = NET.me && NET.me.cb, a = avatars[id], d = (NET.players || []).find(q => q.id === id);
  if (!a || !d) return;
  const c = carrySpot({ x: a.g.position.x, y: a.g.position.y, z: a.g.position.z, yaw: d.yaw, pitch: d.pitch || 0 });
  P.x = c.x; P.y = c.y; P.z = c.z; P.vy = 0;
}

// ---------------------------------------------------------------- the network tick
function netUpdate(dt) {
  if (NET.mode === 'solo') return;
  netT -= dt;
  if (netT > 0) return;
  netT = SNAP_RATE;
  if (NET.mode === 'host' && NET.remotes.length) {
    const snap = buildSnap();
    for (const r of NET.remotes) if (r.conn.open) r.conn.send(snap);
  } else if (NET.mode === 'host') NET.events.length = 0;
  if (NET.mode === 'client') {
    const k = {};
    for (const key of ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']) if (keys[key]) k[key] = true;
    netSend({ t: 'me', x: r2(P.x), y: r2(P.sitV ? P.sitV.floor : P.y), z: r2(P.z), yaw: r2(P.yaw), pitch: r2(P.pitch), face: r2(P.face), tp: S.view === 'third' ? 1 : 0, rg: ragFlat(ME && ME.rag), grab: GRAB.hands, keys: k, air: !!P.launched, seat: !!P.sitV });
  }
}
// the host keeps sending snapshots even before it clicks "Start playing"
setInterval(() => { if (NET.mode === 'host' && !S.running && NET.remotes.length) { const snap = buildSnap(); for (const r of NET.remotes) if (r.conn.open) r.conn.send(snap); } }, 250);
