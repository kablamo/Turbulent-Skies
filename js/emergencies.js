// Emergencies (multi-step checklists done at stations around the plane) and cabin service.
'use strict';
// Each step happens at a station; "$" in a station id is replaced by the side (L/R).
const DEFS = {
  fire: {
    group: 'eng', sided: true, drain: 0.7, deadline: 55, penalty: 12,
    title: s => `🔥 ${sideName(s)} ENGINE FIRE`,
    steps: [
      { label: 'Cut fuel to the $ engine', at: 'pedestal' },
      { label: 'Grab the fire extinguisher', at: 'extinguisher', gives: '🧯 Fire extinguisher' },
      { label: 'Spray the $ engine', at: 'eng$', type: 'hold', dur: 3, spray: true },
    ],
    start: f => setEngine(f.side, 'fire'),
    resolve: f => { setEngine(f.side, 'dead'); say(`${sideName(f.side)} engine fire is out. That propeller isn't turning again, though.`, 'good'); },
    fail: f => { setEngine(f.side, 'dead'); explode(f.side); say(`💥 THE ${sideName(f.side)} ENGINE EXPLODED!`, 'bad'); setTimeout(() => spawnFault('wing', f.side, true), 600); },
  },
  engfail: {
    group: 'eng', sided: true, drain: 0.2, deadline: 60, penalty: 8,
    title: s => `⚙ ${sideName(s)} ENGINE STALLED`,
    steps: [
      { label: 'Flip the $ engine ignition', at: 'pedestal' },
      { label: 'Kick the $ engine until it starts', at: 'eng$', type: 'mash', n: 12 },
    ],
    start: f => setEngine(f.side, 'fail'),
    resolve: f => { setEngine(f.side, 'ok'); say('The propeller sputters back to life!', 'good'); },
    fail: f => { setEngine(f.side, 'dead'); say(`${sideName(f.side)} engine won't restart. It's dead.`, 'bad'); },
  },
  fuel: {
    group: 'eng', sided: true, drain: 0.35, deadline: 55, penalty: 10,
    title: s => `⛽ ${sideName(s)} FUEL LEAK`,
    steps: [
      { label: 'Close the crossfeed valve', at: 'pedestal' },
      { label: 'Tighten the $ fuel line', at: 'fuel$', type: 'hold', dur: 2.5 },
    ],
    start: f => { engines[f.side].leak = true; },
    resolve: f => { engines[f.side].leak = false; },
    fail: f => { engines[f.side].leak = false; setEngine(f.side, 'dead'); say(`${sideName(f.side)} engine starved of fuel!`, 'bad'); },
  },
  wing: {
    group: 'wing', sided: true, drain: 0.45, deadline: 60, penalty: 15,
    title: s => `🪽 ${sideName(s)} WING TIP TORN OFF`,
    steps: [
      { label: 'Grab the sealant gun', at: 'toolbox', gives: '🔫 Sealant gun' },
      { label: 'Seal the torn $ wing tip', at: 'tip$', type: 'mash', n: 15 },
    ],
    canSpawn: s => wings[s].attached,
    start: f => { detachPanel(f.side); S.needs.calm -= 15; },
    resolve: f => { wings[f.side].patch.visible = true; },
    fail: f => { wings[f.side].patch.visible = true; say('The wing is now held on by duct tape and prayers.', 'bad'); },
  },
  hull: {
    drain: 0.6, deadline: 50, penalty: 15,
    title: () => '🧱 WALL PANEL RIPPED AWAY',
    steps: [
      { label: 'Grab the sealant gun', at: 'toolbox', gives: '🔫 Sealant gun' },
      { label: 'Patch the hole in the wall', at: 'hole', type: 'mash', n: 15 },
    ],
    canSpawn: () => !hole.seg && breakableWalls().length > 0,
    start: () => { breachHull(); S.needs.calm -= 25; },
    resolve: () => patchHole(),
    fail: () => { patchHole(); say('Someone stuffed the hole with pillows. It... sort of works.', 'bad'); },
  },
  decomp: {
    drain: 0.3, deadline: 50, penalty: 10,
    title: () => '💨 CARGO RAMP BLEW OPEN',
    steps: [
      { label: 'Drop the oxygen masks', at: 'overhead' },
      { label: 'Close the cargo ramp', at: 'ramp', type: 'hold', dur: 2.5 },
    ],
    start: () => { ramp.target = 1; S.needs.calm -= 20; },
    resolve: () => { ramp.target = 0; },
    fail: () => { ramp.target = 0; S.needs.calm -= 30; say('The ramp finally closed itself. Hopefully nothing important fell out.', 'bad'); },
  },
  elec: {
    drain: 0.12, deadline: 60, penalty: 8, minor: true,
    title: () => '⚡ ELECTRICAL FAULT',
    steps: [
      { label: 'Flip breaker A', at: 'overhead' }, { label: 'Flip breaker B', at: 'overhead' }, { label: 'Flip breaker C', at: 'overhead' },
      { label: 'Reboot the avionics', at: 'pedestal', type: 'hold', dur: 1.5 },
    ],
    start: () => $('hud').classList.add('flicker'),
    resolve: () => {}, fail: () => {},
  },
  toilet: {
    group: 'lav', sided: true, drain: 0.03, deadline: 50, penalty: 2, minor: true,
    title: s => `🚽 ${s === 'L' ? 'FRONT' : 'REAR'} LAVATORY FLOODING`,
    steps: [
      { label: 'Shut off the lavatory water valve', at: 'valve$' },
      { label: 'Plunge the toilet', at: 'lav$', type: 'mash', n: 10 },
    ],
    start: () => {}, resolve: () => {},
    fail: () => { S.needs.comfort -= 35; say('The whole plane smells... unforgettable.', 'bad'); },
  },
  autopilot: {
    drain: 0.4, deadline: 35, penalty: 12,
    title: () => '🧭 AUTOPILOT DISENGAGED',
    steps: [{ label: 'Re-engage the autopilot', at: 'yoke', type: 'hold', dur: 2 }],
    canSpawn: () => !piloted(),
    start: () => { S.needs.calm -= 10; },
    resolve: () => {},
    fail: () => say('The plane lurched into a dive before it caught itself!', 'bad'),
  },
};
// easier: more time to fix things, slower damage, smaller penalties, quicker repairs
for (const k in DEFS) {
  const d = DEFS[k];
  d.deadline = Math.round(d.deadline * 1.5); d.drain *= 0.55; d.penalty = Math.round(d.penalty * 0.6);
  for (const st of d.steps) { if (st.n) st.n = Math.ceil(st.n * 0.65); if (st.dur) st.dur *= 0.75; }
}
const stepAt = (f, st) => st.at.replace('$', f.side);
const stepLabel = (f, st) => st.label.replace('$', sideWord(f.side));
const faultKey = (id, side) => (DEFS[id].group || id) + (DEFS[id].sided ? side : '');

function spawnFault(id, side, force) {
  const def = DEFS[id];
  side = side || pick(['L', 'R']);
  if (def.group === 'eng' && engines[side].state === 'dead') return false;
  if (def.canSpawn && !def.canSpawn(side)) return false;
  const key = faultKey(id, side);
  if (S.faults.some(f => f.key === key)) return false;
  if (!force && S.faults.some(f => f.id === id)) return false;
  const f = { uid: ++S.uid, id, def, side, key, step: 0, age: 0, mash: 0, title: def.title(side) };
  S.faults.push(f);
  def.start(f);
  say(`WARNING: ${f.title}`, 'bad');
  beep(440, .3, 'square', .07);
  return true;
}
function randomFault() {
  // a battered plane starts shedding its walls
  if (S.integrity < 55 && Math.random() < 0.45 && spawnFault('hull')) return;
  const ids = Object.keys(DEFS);
  for (let tries = 0; tries < 12; tries++) if (spawnFault(pick(ids))) return;
}
function endFault(f, failed) {
  S.faults = S.faults.filter(x => x !== f);
  if (failed) { S.integrity -= f.def.penalty; f.def.fail(f); beep(150, .5, 'sawtooth', .1); }
  else { f.def.resolve(f); S.fixed++; chime(); S.needs.calm = Math.min(100, S.needs.calm + 6); }
  if (!S.faults.some(x => x.id === 'elec')) $('hud').classList.remove('flicker');
}
function advance(f) {
  f.step++; f.mash = 0;
  beep(700, .06, 'square', .04);
  if (f.step >= f.def.steps.length) endFault(f, false);
}
function heldTools() {
  const tools = [];
  for (const f of S.faults) f.def.steps.forEach((st, i) => { if (st.gives && i < f.step) tools.push(st.gives); });
  return tools;
}

// ---------------------------------------------------------------- cabin service
const SERVICES = {
  pa: { icon: '📢', name: 'Calm announcement', where: 'Cockpit · PA handset', cd: 12, label: () => 'Make a calm announcement',
    fn: () => { S.needs.calm += 30; say(pick(['"This is your captain. Everything is... under control."', '"Just a little bump, folks!"', '"That noise is normal. Probably."', '"Fun fact: this plane can fly on one propeller!"', '"Please ignore anyone you see walking on the wing."', '"If you see a crocodile, no you didn\'t."', '"The chicken in row 3 is NOT a flight attendant."', '"Please remain seated unless you are being thrown."', '"Our in-flight entertainment today is: panic."'])); } },
  blankets: { icon: '🛏', name: 'Blankets & pillows', where: 'Front galley closet', cd: 12, label: () => 'Hand out blankets & pillows',
    fn: () => { S.needs.comfort += 40; say('Blankets and pillows for everyone. 😴'); } },
  meals: { icon: '🍽', name: 'Meal service', where: 'Cargo bay · meal cart', cd: 16, hold: 1.5, label: () => 'Serve meals',
    check: () => S.seatbelt ? 'You can\'t serve meals while the seatbelt sign is on!' : null,
    fn: () => { S.needs.hunger += 45; say('Chicken or pasta? 🍗🍝'); } },
  movie: { icon: '🎬', name: 'In-flight movie', where: 'Screen at the front of the cabin', cd: 16, label: () => 'Start a movie',
    fn: () => { S.needs.bored += 45; movieT = 45; say(pick(['Now showing: "A Dog\'s Day Out" 🐕', 'Now showing: "Airplane!" ✈', 'Now showing: "Up" 🎈'])); } },
  bbq: { icon: '🍔', name: 'Wing BBQ', where: 'Left wing · barbecue', cd: 20, hold: 3, label: () => 'Grill burgers on the wing',
    check: () => S.seatbelt ? 'Nobody can come out to the wing for burgers while the seatbelt sign is on!' : null,
    fn: () => { S.needs.hunger += 50; S.needs.calm += 10; say(pick(['🍔 Burgers on the wing! The passengers can\'t believe it.', '🌭 Hot dogs at 3,000 metres. Five stars.', '🍔 "Is this… legal?" "Who cares, pass the ketchup!"', '🍔 The smell of barbecue drifts through the cabin. Everyone is calmer.'])); } },
  belt: { icon: '💺', name: 'Seatbelt sign', where: 'Cockpit · left console', cd: 1, label: () => `Turn seatbelt sign ${S.seatbelt ? 'OFF' : 'ON'}`,
    fn: () => { S.seatbelt = !S.seatbelt; beep(S.seatbelt ? 1200 : 900, .15, 'sine', .07); say(S.seatbelt ? '💺 Seatbelt sign ON' : 'Seatbelt sign off'); } },
};
for (const k in SERVICES) S.cd[k] = 0;

const CALLS = ['wants a glass of water', 'is terrified of flying', 'can\'t close the overhead bin', 'dropped their phone under the seat', 'has a screaming baby', 'wants to know if the wing is supposed to do that', 'is allergic to the peanuts', 'wants to speak to the manager', 'thinks they saw a gremlin'];
const COMPLAINTS = {
  hunger: ['"Excuse me, is there food on this flight?"', '"I paid for the pretzels!"', '"My child is eating the seat cushion."'],
  bored: ['"The screen is just showing the safety video. Again."', '"Are we there yet?"', '"I\'ve read the safety card 40 times."'],
  comfort: ['"It\'s freezing in here!"', '"The guy next to me took his shoes off."', '"Can someone dim these lights?"'],
  calm: ['"WHY IS THE ENGINE ON FIRE?!"', '"I want to speak to the captain!"', '"I\'m writing my will on a napkin."', '"Was that the pilot running past?!"'],
};
