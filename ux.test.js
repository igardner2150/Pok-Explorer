// Search matching, units, share links, favorites, recently viewed, hints, previous/next and color contrast.
const test = require("node:test");
const assert = require("node:assert/strict");
const { plain, loadSite } = require("./load-site");

const { site } = loadSite();
const INDEX = site.buildSearchIndex([
  { kind: "pokemon", slug: "charmander", label: "Charmander", id: 4 },
  { kind: "pokemon", slug: "charmeleon", label: "Charmeleon", id: 5 },
  { kind: "pokemon", slug: "charizard", label: "Charizard", id: 6 },
  { kind: "pokemon", slug: "pikachu", label: "Pikachu", id: 25 },
  { kind: "pokemon", slug: "mr-mime", label: "Mr. Mime", id: 122 },
  { kind: "pokemon", slug: "flabebe", label: "Flabébé", id: 669 },
  { kind: "pokemon", slug: "nidoran-f", label: "Nidoran♀", id: 29 },
  { kind: "pokemon", slug: "garchomp", label: "Garchomp", id: 445 },
  { kind: "form", slug: "charizard-mega-x", label: "Mega Charizard X", id: 10034 },
  { kind: "form", slug: "vulpix-alola", label: "Alolan Vulpix", id: 10103 },
  { kind: "move", slug: "earthquake", label: "Earthquake" },
  { kind: "move", slug: "u-turn", label: "U-turn" },
  { kind: "ability", slug: "intimidate", label: "Intimidate" },
  { kind: "item", slug: "choice-scarf", label: "Choice Scarf" },
  { kind: "item", slug: "charcoal", label: "Charcoal" }
]);
const top = (q, opts) => site.searchIndex(INDEX, q, opts).map(r => r.slug);

test("search: prefixes list Pokémon first", () => {
  assert.equal(top("char")[0], "charmander");
  assert.ok(top("char").includes("charcoal"));
  assert.ok(top("char").indexOf("charizard") < top("char").indexOf("charcoal"));
});

test("search: exact names win", () => {
  assert.equal(top("charizard")[0], "charizard");
  assert.equal(top("Earthquake")[0], "earthquake");
});

test("search: forgives typos", () => {
  const r = site.searchIndex(INDEX, "charizrd");
  assert.equal(r[0].slug, "charizard");
  assert.equal(r[0].fuzzy, true);
  assert.equal(top("pikahcu")[0], "pikachu");      // swapped letters
  assert.equal(top("garchmp")[0], "garchomp");     // missing letter
});

test("search: official spellings, accents and symbols", () => {
  assert.equal(top("mr mime")[0], "mr-mime");
  assert.equal(top("Mr. Mime")[0], "mr-mime");
  assert.equal(top("flabebe")[0], "flabebe");
  assert.equal(top("Nidoran♀")[0], "nidoran-f");
  assert.equal(top("uturn")[0], "u-turn");
});

test("search: Pokédex numbers and word starts", () => {
  assert.equal(top("25")[0], "pikachu");
  assert.equal(top("#006")[0], "charizard");
  assert.ok(top("vulpix").includes("vulpix-alola"));   // matches the second word of "Alolan Vulpix"
});

test("search: Pokémon-only mode and links for each kind", () => {
  assert.ok(!top("char", { kinds: ["pokemon", "form"] }).includes("charcoal"));
  const [eq] = site.searchIndex(INDEX, "earthquake");
  assert.equal(site.resultHash(eq), "tools/moves/earthquake");
  assert.equal(site.resultHash(site.searchIndex(INDEX, "intimidate")[0]), "tools/abilities/intimidate");
  assert.equal(site.resultHash(site.searchIndex(INDEX, "scarf")[0]), "tools/items/choice-scarf");
  assert.equal(site.resultHash(site.searchIndex(INDEX, "mega charizard")[0]), "pokemon/charizard-mega-x");
});

test("search: empty and nonsense queries return nothing", () => {
  assert.deepEqual(plain(top("")), []);
  assert.deepEqual(plain(top("zzzzzzzz")), []);
});

test("edit distance counts swaps as one edit", () => {
  assert.equal(site.editDistance("abc", "abc"), 0);
  assert.equal(site.editDistance("abc", "acb"), 1);
  assert.equal(site.editDistance("kitten", "sitting"), 3);
  assert.equal(site.normalizeText("Flabébé"), "flabebe");
});

test("units: metric and imperial", () => {
  assert.equal(site.fmtHeight(17, "metric"), "1.7 m");
  assert.equal(site.fmtWeight(905, "metric"), "90.5 kg");
  assert.equal(site.fmtHeight(17, "imperial"), "5′7″");     // Charizard
  assert.equal(site.fmtWeight(905, "imperial"), "199.5 lbs");
  assert.equal(site.fmtHeight(4, "imperial"), "1′4″");      // Pikachu
});

test("damage calculator links round-trip and ignore tampering", () => {
  const state = { atk: { mon: "garchomp", level: 50, ev: 252 }, move: "earthquake", crit: false };
  const code = site.encodeState(state);
  assert.match(code, /^[A-Za-z0-9_-]+$/);            // safe inside a URL, no "/"
  assert.deepEqual(plain(site.decodeState(code)), state);
  assert.equal(site.decodeState("not-valid!!"), null);
  const target = { atk: { mon: "a", level: 50 }, crit: false };
  site.mergeKnown(target, { atk: { mon: "b", level: "100", extra: 1 }, crit: true, evil: "x" });
  assert.deepEqual(plain(target), { atk: { mon: "b", level: 50 }, crit: true });   // wrong types and unknown keys dropped
});

test("favorites toggle on and off", () => {
  const { site } = loadSite();
  assert.equal(site.toggleFavorite({ name: "pikachu", id: 25 }), true);
  assert.equal(site.isFavorite("pikachu"), true);
  assert.equal(site.toggleFavorite({ name: "pikachu", id: 25 }), false);
  assert.equal(site.getFavorites().length, 0);
});

test("recently viewed: newest first, no duplicates, capped at 12", () => {
  const { site } = loadSite();
  for (let i = 1; i <= 15; i++) site.addRecent({ name: `mon-${i}`, id: i });
  site.addRecent({ name: "mon-10", id: 10 });
  const r = site.getRecent();
  assert.equal(r.length, 12);
  assert.equal(r[0].name, "mon-10");
  assert.equal(r.filter(x => x.name === "mon-10").length, 1);
  site.clearRecent();
  assert.equal(site.getRecent().length, 0);
});

test("hints show until dismissed", () => {
  const { site } = loadSite();
  assert.match(site.hintBox("team"), /class="hint"/);
  site.dismissHint("team");
  assert.equal(site.hintBox("team"), "");
  assert.equal(site.hintBox("not-a-hint"), "");
});

test("previous and next Pokémon", () => {
  const { site } = loadSite();
  site.SPECIES_BY_ID[1] = "bulbasaur"; site.SPECIES_BY_ID[2] = "ivysaur"; site.SPECIES_BY_ID[3] = "venusaur";
  assert.deepEqual(plain(site.neighborsOf(2)), { prev: { id: 1, name: "bulbasaur" }, next: { id: 3, name: "venusaur" } });
  assert.equal(site.neighborsOf(1).prev, null);
  assert.equal(site.neighborsOf(3).next, null);
});

test("every type badge meets WCAG AA contrast (4.5:1)", () => {
  assert.equal(Math.round(site.contrastRatio("#000000", "#ffffff")), 21);
  for (const [type, bg] of Object.entries(site.TYPE_COLOR)) {
    const ratio = site.contrastRatio(bg, site.typeText(type));
    assert.ok(ratio >= 4.5, `${type}: ${ratio.toFixed(2)}:1`);
  }
});

test("type badges link to type pages unless told not to", () => {
  assert.match(site.typeBadge("fire"), /^<a class="type" href="#type\/fire"/);
  assert.match(site.typeBadge("fire", "", false), /^<span class="type"/);
});
