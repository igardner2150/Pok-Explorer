// Names, search matching, type matchups, roles, navigation and the reference tables.
const test = require("node:test");
const assert = require("node:assert/strict");
const { plain, loadSite, TYPE_DATA } = require("./load-site");
const { site } = loadSite();
site.setSpecies(["pikachu", "vulpix", "giratina", "charizard", "urshifu", "darmanitan", "meowth", "ho-oh", "nidoran-f"]);

test("Pokémon names use official spellings", () => {
  assert.equal(site.pokeName("mr-mime"), "Mr. Mime");
  assert.equal(site.pokeName("farfetchd"), "Farfetch'd");
  assert.equal(site.pokeName("nidoran-f"), "Nidoran♀");
  assert.equal(site.pokeName("type-null"), "Type: Null");
  assert.equal(site.pokeName("flabebe"), "Flabébé");
  assert.equal(site.pokeName("ho-oh"), "Ho-Oh");
});

test("form names read naturally", () => {
  assert.equal(site.pokeName("vulpix-alola"), "Alolan Vulpix");
  assert.equal(site.pokeName("darmanitan-galar-zen"), "Galarian Darmanitan (Zen)");
  assert.equal(site.pokeName("giratina-origin"), "Giratina (Origin)");
  assert.equal(site.pokeName("charizard-mega-x"), "Mega Charizard X");
  assert.equal(site.pokeName("urshifu-rapid-strike-gmax"), "Gigantamax Urshifu (Rapid Strike)");
});

test("totem and cap Pokémon aren't treated as regional forms", () => {
  assert.equal(site.isRegionalForm("raticate-totem-alola"), false);
  assert.equal(site.isRegionalForm("pikachu-alola-cap"), false);
  assert.equal(site.isRegionalForm("meowth-galar"), true);
});

test("search accepts official spellings and Pokédex numbers", () => {
  assert.equal(site.cleanQuery(" Mr. Mime "), "mr-mime");
  assert.equal(site.cleanQuery("Farfetch'd"), "farfetchd");
  assert.equal(site.cleanQuery("Nidoran♀"), "nidoran-f");
  assert.equal(site.cleanQuery("Type: Null"), "type-null");
  assert.equal(site.cleanQuery("Flabébé"), "flabebe");
  assert.equal(site.cleanQuery("#025"), "25");
});

test("item and move names", () => {
  assert.equal(site.itemName("kings-rock"), "King's Rock");
  assert.equal(site.itemName("poke-ball"), "Poké Ball");
  assert.equal(site.itemName("tm01"), "TM01");
  assert.equal(site.itemName("choice-scarf"), "Choice Scarf");
  assert.equal(site.moveName("u-turn"), "U-turn");
  assert.equal(site.moveName("will-o-wisp"), "Will-O-Wisp");
  assert.equal(site.moveName("earthquake"), "Earthquake");
});

test("type matchups", () => {
  assert.equal(site.effectiveness(TYPE_DATA, "rock", ["fire", "flying"]), 4);
  assert.equal(site.effectiveness(TYPE_DATA, "ground", ["fire", "flying"]), 0);
  assert.equal(site.effectiveness(TYPE_DATA, "electric", ["water", "flying"]), 4);
  assert.equal(site.effectiveness(TYPE_DATA, "fairy", ["dragon"]), 2);
  assert.equal(site.effectiveness(TYPE_DATA, "ghost", ["normal"]), 0);
  assert.equal(site.effectiveness(TYPE_DATA, "fire", ["water", "rock"]), 0.25);
});

test("suggested roles from base stats", () => {
  const garchomp = { hp: 108, attack: 130, defense: 95, "special-attack": 80, "special-defense": 85, speed: 102 };
  const blissey = { hp: 255, attack: 10, defense: 10, "special-attack": 75, "special-defense": 135, speed: 55 };
  assert.equal(site.suggestRole(garchomp), "fast-physical");
  assert.equal(site.suggestRole(blissey), "special-wall");
  const physicalAttacker = site.ROLES.find(r => r.id === "fast-physical");
  assert.deepEqual(plain(physicalAttacker.pick(garchomp)), ["jolly", "adamant"]);
});

test("gender ratios and EV yield read clearly", () => {
  assert.equal(site.genderText(-1), "Genderless");
  assert.equal(site.genderText(0), "Always male");
  assert.equal(site.genderText(1), "12.5% female, 87.5% male");
  assert.equal(site.genderText(4), "50% female, 50% male");
  assert.equal(site.evYield({ stats: [{ stat: { name: "speed" }, effort: 2 }, { stat: { name: "hp" }, effort: 0 }] }), "2 Speed");
});

test("navigation highlights the right section", () => {
  assert.deepEqual(plain(site.navFor("damage")), ["battle", "damage"]);
  assert.deepEqual(plain(site.navFor("tools", "items")), ["tools", "items"]);
  assert.deepEqual(plain(site.navFor("tracker")), ["tracker", "games"]);
  assert.deepEqual(plain(site.navFor("forms")), ["pokedex", "forms"]);
  assert.deepEqual(plain(site.navFor("")), ["pokedex", "regions"]);
});

test("Mega Evolution game availability", () => {
  assert.deepEqual(plain(site.megaGames("charizard-mega-x", 6)),
    ["X / Y", "Omega Ruby / Alpha Sapphire", "Sun / Moon", "Ultra Sun / Ultra Moon", "Let's Go Pikachu / Eevee"]);
  assert.ok(!site.megaGames("sceptile-mega", 254).includes("X / Y"));
});

test("shiny odds table", () => {
  assert.deepEqual(plain(site.SHINY.scarlet), { base: 4096, charm: 1365 });
  assert.deepEqual(plain(site.SHINY["legends-arceus"]), { base: 4096, charm: 1024 });
  assert.deepEqual(plain(site.SHINY.black), { base: 8192, charm: null });
  assert.deepEqual(plain(site.SHINY.red), { base: null, charm: null });
});

test("item location tables only use games the site knows", () => {
  const games = new Set(["X / Y", "Omega Ruby / Alpha Sapphire", "Sun / Moon", "Ultra Sun / Ultra Moon",
    "Let's Go Pikachu / Eevee", "Legends: Z-A", "Sword / Shield", "Scarlet / Violet"]);
  for (const table of [site.STONE_LOC, site.Z_LOC, ...Object.values(site.UNLOCK)])
    for (const game of Object.keys(table)) assert.ok(games.has(game), `unknown game label: ${game}`);
});
