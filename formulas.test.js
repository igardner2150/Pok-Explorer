// Stat and damage formulas, checked against worked examples from Bulbapedia.
const test = require("node:test");
const assert = require("node:assert/strict");
const { plain, loadSite, TYPE_DATA } = require("./load-site");
const { site } = loadSite();

const ADAMANT = { increased_stat: { name: "attack" }, decreased_stat: { name: "special-attack" } };

test("stat formula matches Bulbapedia's level 78 Adamant Garchomp", () => {
  const base = { hp: 108, attack: 130, defense: 95, "special-attack": 80, "special-defense": 85, speed: 102 };
  const iv = { hp: 24, attack: 12, defense: 30, "special-attack": 16, "special-defense": 23, speed: 5 };
  const ev = { hp: 74, attack: 190, defense: 91, "special-attack": 48, "special-defense": 84, speed: 23 };
  const stats = site.STAT_KEYS.map(k => site.calcStat(k, base[k], iv[k], ev[k], 78, site.natureMultFor(ADAMANT, k)));
  assert.deepEqual(plain(stats), [289, 278, 193, 135, 171, 171]);
});

test("Shedinja always has 1 HP", () => {
  assert.equal(site.calcStat("hp", 1, 31, 252, 100, 1, true), 1);
});

test("natures boost one stat by 10%, lower another by 10%, and never touch HP", () => {
  assert.equal(site.natureMultFor(ADAMANT, "attack"), 1.1);
  assert.equal(site.natureMultFor(ADAMANT, "special-attack"), 0.9);
  assert.equal(site.natureMultFor(ADAMANT, "speed"), 1);
  assert.equal(site.natureMultFor(ADAMANT, "hp"), 1);
});

// Bulbapedia's damage example: level 75 Glaceon (Attack 123) uses Ice Fang (65 power) on Garchomp (Defense 163).
const glaceonVsGarchomp = (over = {}) => site.damageRolls({
  a: { stats: { attack: 123 }, types: ["ice"], level: 75, stage: 0, item: "none", tera: "", ability: "", ...over.a },
  d: { stats: { defense: 163 }, types: ["dragon", "ground"], stage: 0, item: "none", tera: "", ability: "", typeData: TYPE_DATA, ...over.d },
  move: { name: "ice-fang", type: "ice", category: "physical", power: 65, ...over.move },
  crit: false, weather: "none", burned: false, screen: false, spread: false, ...over.field
});

test("damage formula matches Bulbapedia's Glaceon vs Garchomp example (168–196)", () => {
  const r = glaceonVsGarchomp();
  assert.equal(r.base, 33);
  assert.equal(r.eff, 4);
  assert.equal(r.stab, 1.5);
  assert.equal(r.rolls.length, 16);
  assert.equal(r.rolls[0], 168);
  assert.equal(r.rolls[15], 196);
});

test("Game Freak rounding rounds 0.5 down", () => {
  assert.equal(site.pokeRound(2.5), 2);
  assert.equal(site.pokeRound(2.51), 3);
});

test("stat stages: +2 doubles, −1 is two-thirds", () => {
  assert.equal(site.stageMult(2), 2);
  assert.equal(site.stageMult(-1), 2 / 3);
});

test("critical hits ignore the defender's stat boosts", () => {
  const r = glaceonVsGarchomp({ d: { stage: 2 }, field: { crit: true } });
  assert.equal(r.D, 163);
});

test("Terastallizing into an original type gives 2× STAB", () => {
  assert.equal(glaceonVsGarchomp({ a: { tera: "ice" } }).stab, 2);
  assert.equal(glaceonVsGarchomp({ a: { tera: "fire" } }).stab, 1.5);   // still gets original-type STAB
});

test("KO chances", () => {
  const { rolls } = glaceonVsGarchomp();
  assert.equal(site.koChance(rolls, 100, 1), 1);
  assert.equal(site.koChance(rolls, 400, 1), 0);
  assert.equal(site.koText(rolls, 300).text, "Guaranteed 2HKO");
  assert.match(site.koText(rolls, 190).text, /chance to OHKO/);
});

test("abilities: Levitate blocks Ground moves, Mold Breaker gets through", () => {
  const eq = { move: { name: "earthquake", type: "ground", power: 100 } };
  assert.equal(glaceonVsGarchomp({ ...eq, d: { ability: "levitate", types: ["steel"] } }).rolls[15], 0);
  assert.ok(glaceonVsGarchomp({ ...eq, a: { ability: "mold-breaker" }, d: { ability: "levitate", types: ["steel"] } }).rolls[15] > 0);
});

test("abilities: Huge Power doubles Attack; Adaptability makes STAB 2×", () => {
  assert.equal(glaceonVsGarchomp({ a: { ability: "huge-power" } }).A, 246);
  assert.equal(glaceonVsGarchomp({ a: { ability: "adaptability" } }).stab, 2);
});

test("abilities: Technician boosts weak moves; Multiscale and Filter reduce damage", () => {
  assert.equal(glaceonVsGarchomp({ a: { ability: "technician" } }).power, 65);              // over 60: no boost
  assert.equal(glaceonVsGarchomp({ a: { ability: "technician" }, move: { power: 60 } }).power, 90);
  const plain = glaceonVsGarchomp().rolls[15];
  assert.ok(glaceonVsGarchomp({ d: { ability: "multiscale" } }).rolls[15] <= Math.ceil(plain / 2));
  assert.ok(glaceonVsGarchomp({ d: { ability: "filter" } }).rolls[15] < plain);
});

test("abilities: Pixilate turns Normal moves Fairy-type", () => {
  const r = glaceonVsGarchomp({ a: { ability: "pixilate" }, move: { type: "normal", power: 90 } });
  assert.equal(r.moveType, "fairy");
  assert.equal(r.eff, 2);   // Fairy vs Dragon/Ground
});
