// Team builder games, and filters that stay set until cleared.
const test = require("node:test");
const assert = require("node:assert/strict");
const { plain, loadSite } = require("./load-site");
const { site, localStorage } = loadSite();

test("a game's species list allows its Pokémon and their forms, and blocks the rest", () => {
  const paldea = new Set(["tauros", "wooper", "garchomp"]);
  assert.equal(site.allowedInGame("garchomp", paldea), true);
  assert.equal(site.allowedInGame("tauros-paldea-combat-breed", paldea), true);   // a form of an allowed species
  assert.equal(site.allowedInGame("charizard", paldea), false);
  assert.equal(site.allowedInGame("charizard", null), true);                       // "Any game"
});

test("the game swap pool has no repeats and maps form ids to species", () => {
  assert.equal(new Set(site.GAME_POOL).size, site.GAME_POOL.length);
  assert.equal(site.poolSpecies("aegislash-shield"), "aegislash");
  assert.equal(site.poolSpecies("mimikyu-disguised"), "mimikyu");
  assert.equal(site.poolSpecies("kommo-o"), "kommo-o");
  assert.equal(site.poolSpecies("porygon-z"), "porygon-z");
});

test("every team game has a unique id and at least one version group", () => {
  const ids = site.TEAM_GAMES.map(g => g[0]);
  assert.equal(new Set(ids).size, ids.length);
  site.TEAM_GAMES.forEach(([, label, groups]) => { assert.ok(label); assert.ok(groups.length > 0); });
});

test("filters are saved while set and forgotten once back to their defaults", () => {
  const defaults = { "f-type": "", "f-sort": "number" };
  assert.equal(site.storeFilters("region-kanto", { "f-type": "fire", "f-sort": "number" }, defaults), true);
  assert.deepEqual(plain(site.savedFilters("region-kanto")), { "f-type": "fire", "f-sort": "number" });
  assert.equal(site.storeFilters("region-kanto", { ...defaults }, defaults), false);
  assert.deepEqual(plain(site.savedFilters("region-kanto")), {});
  assert.equal(JSON.parse(localStorage.getItem("pokeExplorerFilters"))["region-kanto"], undefined);
});

test("a game's Pokédexes become sections in Pokédex order, counting each species once", () => {
  const entry = (num, name, id) => ({ entry_number: num, pokemon_species: { name, url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` } });
  const dexes = [
    { name: "paldea", names: [{ language: { name: "en" }, name: "Paldea" }], pokemon_entries: [entry(2, "fuecoco", 909), entry(1, "sprigatito", 906)] },
    { name: "kitakami", names: [], pokemon_entries: [entry(1, "spinarak", 167), entry(2, "sprigatito", 906)] },
    { name: "empty", names: [], pokemon_entries: [] },
    null
  ];
  const { sections, total } = plain(site.gameDexSections(dexes));
  assert.deepEqual(sections.map(s => s.label), ["Paldea", "Kitakami"]);
  assert.deepEqual(sections[0].mons.map(m => m.name), ["sprigatito", "fuecoco"]);
  assert.equal(sections[0].mons[0].id, 906);
  assert.equal(total, 3);   // sprigatito is in both Pokédexes
});

test("encounter data adds species seen in the game's versions, mapping forms to their species", () => {
  const ref = (name, id) => ({ name, url: `https://pokeapi.co/api/v2/pokemon/${id}/` });
  const ver = v => ({ version: { name: v } });
  const areas = [
    { pokemon_encounters: [
      { pokemon: ref("mewtwo", 150), version_details: [ver("red"), ver("blue")] },
      { pokemon: ref("rattata-alola", 10091), version_details: [ver("sun")] },
      { pokemon: ref("pikachu", 25), version_details: [ver("yellow")] }
    ] },
    null
  ];
  const byId = { 150: "mewtwo", 19: "rattata", 25: "pikachu" };
  const slugs = new Set(["mewtwo", "rattata", "pikachu"]);
  assert.deepEqual([...site.encounterSpecies(areas, new Set(["red", "blue"]), byId, slugs)], ["mewtwo"]);
  assert.deepEqual([...site.encounterSpecies(areas, new Set(["sun"]), byId, slugs)], ["rattata"]);
  assert.equal(site.speciesOfPokemon("tapu-koko", 785, { 785: "tapu-koko" }, new Set()), "tapu-koko");
});

test("post-game lists only name real, unique species ids", () => {
  for (const id of ["scarlet-violet", "sword-shield", "bdsp"]) {
    const list = site.extrasFor(id);
    assert.ok(list.length > 10, id);
    assert.equal(new Set(list).size, list.length, id);
    list.forEach(n => assert.match(n, /^[a-z]+(-[a-z]+)*$/, n));
  }
  assert.deepEqual(plain(site.extrasFor("red-blue")), []);
  assert.ok(site.ENCOUNTER_GAMES.has("platinum"));
});
