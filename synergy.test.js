\// Team synergy score: grades a team out of 100 and suggests swaps that raise it.
const test = require("node:test");
const assert = require("node:assert/strict");
const { plain, loadSite, TYPE_DATA } = require("./load-site");
const { site } = loadSite();

const S = (hp, attack, defense, spa, spd, speed) => ({ hp, attack, defense, "special-attack": spa, "special-defense": spd, speed });
const M = (name, types, stats) => ({ name, label: name, types, stats });

const balanced = [
  M("garchomp", ["dragon", "ground"], S(108, 130, 95, 80, 85, 102)),
  M("rotom-wash", ["electric", "water"], S(50, 65, 107, 105, 107, 86)),
  M("ferrothorn", ["grass", "steel"], S(74, 94, 131, 54, 116, 20)),
  M("clefable", ["fairy"], S(95, 70, 73, 95, 90, 60)),
  M("volcarona", ["bug", "fire"], S(85, 60, 65, 135, 105, 100)),
  M("weavile", ["dark", "ice"], S(70, 120, 65, 45, 85, 125))
];
const allFire = [
  M("charizard", ["fire", "flying"], S(78, 84, 78, 109, 85, 100)),
  M("talonflame", ["fire", "flying"], S(78, 81, 71, 74, 69, 126)),
  M("arcanine", ["fire"], S(90, 110, 80, 100, 80, 95)),
  M("ninetales", ["fire"], S(73, 76, 75, 81, 100, 100)),
  M("butterfree", ["bug", "flying"], S(60, 45, 50, 90, 80, 70)),
  M("beedrill", ["bug", "poison"], S(65, 90, 40, 45, 80, 75))
];

test("parts add up to the score and to 100 at most", () => {
  for (const team of [balanced, allFire, balanced.slice(0, 2)]) {
    const r = site.teamSynergy(team, TYPE_DATA);
    assert.equal(Math.max(0, r.parts.reduce((s, p) => s + p.score, 0) - r.emptyPenalty), r.score);
    assert.equal(r.emptyPenalty, (6 - team.length) * 4);
    assert.equal(r.parts.reduce((s, p) => s + p.max, 0), 100);
    r.parts.forEach(p => assert.ok(p.score >= 0 && p.score <= p.max, p.key));
  }
});

test("a balanced team grades well and a stacked team grades badly", () => {
  const good = site.teamSynergy(balanced, TYPE_DATA), bad = site.teamSynergy(allFire, TYPE_DATA);
  assert.equal(good.grade, "A");
  assert.equal(bad.grade, "F");
  assert.ok(good.score - bad.score >= 30);
});

test("tips name the real problem", () => {
  const bad = site.teamSynergy(allFire, TYPE_DATA);
  assert.match(bad.tips[0], /^Rock hits 6 of your Pokémon super effectively and nothing resists it/);
  assert.ok(bad.tips.some(t => /Fire, Flying and Bug each appear/.test(t)));
  const good = site.teamSynergy(balanced, TYPE_DATA);
  assert.ok(good.tips.some(t => t === "garchomp takes 4× damage from Ice moves, so keep an Ice-resistant switch-in ready."));
});

test("an empty team scores zero and a partial team says how many are missing", () => {
  assert.equal(site.teamSynergy([], TYPE_DATA).score, 0);
  const r = site.teamSynergy(balanced.slice(0, 3), TYPE_DATA);
  assert.ok(r.tips.some(t => t.startsWith("You have 3 of 6 Pokémon")));
  assert.ok(r.score < site.teamSynergy(balanced, TYPE_DATA).score);   // a partial team can't beat the full one
});

test("grade thresholds", () => {
  assert.deepEqual([90, 85, 84, 75, 62, 50, 49].map(site.gradeFor), ["A", "A", "B", "B", "C", "D", "F"]);
});

test("swap suggestions raise the score and never repeat a team member", () => {
  const pool = [
    M("corviknight", ["flying", "steel"], S(98, 87, 105, 53, 85, 67)),
    M("toxapex", ["poison", "water"], S(50, 63, 152, 53, 142, 35)),
    M("gardevoir", ["psychic", "fairy"], S(68, 65, 65, 125, 115, 80)),
    M("excadrill", ["ground", "steel"], S(110, 135, 60, 50, 65, 88)),
    M("charizard", ["fire", "flying"], S(78, 84, 78, 109, 85, 100))
  ];
  const swaps = plain(site.bestSwaps(allFire, pool, TYPE_DATA));
  assert.ok(swaps.length > 0 && swaps.length <= 3);
  for (const s of swaps) {
    assert.ok(s.to > s.from);
    assert.notEqual(s.add.name, "charizard");                     // already on the team
    assert.equal(site.teamSynergy(allFire.map((m, i) => (i === s.slot ? pool.find(p => p.name === s.add.name) : m)), TYPE_DATA).score, s.to);
  }
  // With an open slot it suggests additions instead of swaps.
  plain(site.bestSwaps(balanced.slice(0, 3), pool, TYPE_DATA)).forEach(s => assert.equal(s.remove, null));
});

test("auto-complete adds Pokémon without repeats, each one raising the score", () => {
  const pool = [
    M("corviknight", ["flying", "steel"], S(98, 87, 105, 53, 85, 67)),
    M("toxapex", ["poison", "water"], S(50, 63, 152, 53, 142, 35)),
    M("gardevoir", ["psychic", "fairy"], S(68, 65, 65, 125, 115, 80)),
    M("excadrill", ["ground", "steel"], S(110, 135, 60, 50, 65, 88)),
    M("garchomp", ["dragon", "ground"], S(108, 130, 95, 80, 85, 102))
  ];
  const start = balanced.slice(0, 2);
  const { added, result } = plain(site.autoComplete(start, pool, TYPE_DATA));
  assert.ok(added.length >= 1 && added.length <= 4);
  const names = [...start.map(m => m.name), ...added.map(m => m.name)];
  assert.equal(new Set(names).size, names.length);               // garchomp is already on the team, so it's never added again
  assert.ok(result.score > site.teamSynergy(start, TYPE_DATA).score);
  // A pool with nothing that helps adds nothing.
  const bad = [M("beedrill", ["bug", "poison"], S(65, 90, 40, 45, 80, 75))];
  const none = plain(site.autoComplete(allFire.slice(0, 5), bad, TYPE_DATA));
  assert.ok(none.result.score >= site.teamSynergy(allFire.slice(0, 5), TYPE_DATA).score);
  assert.equal(plain(site.autoComplete(balanced, pool, TYPE_DATA)).added.length, 0);   // a full team gets nothing
});

test("team input accepts links, commas and new lines", () => {
  assert.deepEqual(plain(site.parseTeamInput("https://pokeexplorer.duckdns.org/#team/garchomp,rotom-wash")), ["garchomp", "rotom-wash"]);
  assert.deepEqual(plain(site.parseTeamInput("Mr. Mime, Farfetch'd\nNidoran♀")), ["mr-mime", "farfetchd", "nidoran-f"]);
  assert.equal(site.parseTeamInput("a,b,c,d,e,f,g,h").length, 6);
  assert.deepEqual(plain(site.parseTeamInput("")), []);
});

test("team versus picks the higher score and counts category wins and type pressure", () => {
  const v = plain(site.teamVersus(balanced, allFire, TYPE_DATA));
  assert.equal(v.winner, "a");
  assert.equal(v.margin, v.a.score - v.b.score);
  assert.equal(v.categories.a + v.categories.b + v.parts.filter(p => p.winner === "tie").length, 5);
  assert.ok(v.pressure.a >= 1 && v.pressure.a <= allFire.length);
  assert.equal(plain(site.teamVersus(balanced, balanced, TYPE_DATA)).winner, "tie");
});
