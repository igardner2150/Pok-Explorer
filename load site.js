// Loads the site's scripts into a sandbox (no browser needed) and returns the functions the tests use.
// The scripts run in the same order as index.html, with small stand-ins for the browser APIs they touch.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const SCRIPTS = ["app.js", "gimmicks.js", "tracker.js", "extras.js", "training.js", "battle.js", "ux.js"];

// Everything the tests need from the site. Top-level `const` values aren't properties of the global object,
// so they're exported explicitly at the end of the combined script.
const EXPORTS = [
  "calcStat", "natureMultFor", "damageRolls", "koChance", "koText", "pokeRound", "stageMult", "effectiveness",
  "pokeName", "cleanQuery", "itemName", "moveName", "regionalInfo", "isRegionalForm", "gimmickLabel", "gimmickOf",
  "megaGames", "genderText", "evYield", "suggestRole", "navFor", "chanceBy", "huntOdds", "SHINY", "boxView",
  "loadTracker", "saveTracker", "toggle", "fromData", "toData", "TRACKER_KEY", "STAT_KEYS", "ROLES", "Z_LOC", "STONE_LOC", "UNLOCK",
  "normalizeText", "editDistance", "buildSearchIndex", "searchIndex", "resultHash", "fmtHeight", "fmtWeight", "encodeState", "decodeState",
  "mergeKnown", "getFavorites", "toggleFavorite", "isFavorite", "getRecent", "addRecent", "clearRecent", "hintBox", "dismissHint",
  "neighborsOf", "contrastRatio", "TYPE_COLOR", "typeText", "typeBadge", "SPECIES_BY_ID", "teamSynergy", "bestSwaps", "gradeFor", "autoComplete", "parseTeamInput", "teamVersus"
];

function fakeElement() {
  const el = {
    innerHTML: "", textContent: "", title: "", value: "", hidden: false, dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, appendChild() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, focus() {}, scrollIntoView() {}
  };
  return el;
}

function loadSite() {
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };
  const document = {
    getElementById: () => fakeElement(), querySelector: () => null, querySelectorAll: () => [],
    createElement: () => fakeElement(), body: fakeElement(), documentElement: { dataset: {} }, title: "",
    addEventListener() {}
  };
  const sandbox = {
    console, setTimeout, clearTimeout, localStorage, document, btoa, atob,
    location: { hash: "", origin: "http://localhost", pathname: "/" },
    history: { replaceState() {} },
    fetch: () => new Promise(() => {}),   // tests never touch the network
    indexedDB: undefined,
    addEventListener() {}
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  const source = SCRIPTS.map(f => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n;\n")
    + `\n;globalThis.__site = { ${EXPORTS.join(", ")}, setSpecies: list => { SPECIES_SLUGS = new Set(list); } };`;
  vm.runInContext(source, sandbox, { filename: "site.js" });
  return { site: sandbox.__site, localStorage };
}

// A full 18-type chart in PokéAPI's damage_relations shape, for tests that need real matchups.
const CHART = {
  normal: [[], ["rock", "steel"], ["ghost"]], fire: [["grass", "ice", "bug", "steel"], ["fire", "water", "rock", "dragon"], []],
  water: [["fire", "ground", "rock"], ["water", "grass", "dragon"], []], electric: [["water", "flying"], ["electric", "grass", "dragon"], ["ground"]],
  grass: [["water", "ground", "rock"], ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"], []],
  ice: [["grass", "ground", "flying", "dragon"], ["fire", "water", "ice", "steel"], []],
  fighting: [["normal", "ice", "rock", "dark", "steel"], ["poison", "flying", "psychic", "bug", "fairy"], ["ghost"]],
  poison: [["grass", "fairy"], ["poison", "ground", "rock", "ghost"], ["steel"]],
  ground: [["fire", "electric", "poison", "rock", "steel"], ["grass", "bug"], ["flying"]],
  flying: [["grass", "fighting", "bug"], ["electric", "rock", "steel"], []], psychic: [["fighting", "poison"], ["psychic", "steel"], ["dark"]],
  bug: [["grass", "psychic", "dark"], ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"], []],
  rock: [["fire", "ice", "flying", "bug"], ["fighting", "ground", "steel"], []], ghost: [["psychic", "ghost"], ["dark"], ["normal"]],
  dragon: [["dragon"], ["steel"], ["fairy"]], dark: [["psychic", "ghost"], ["fighting", "dark", "fairy"], []],
  steel: [["ice", "rock", "fairy"], ["fire", "water", "electric", "steel"], []], fairy: [["fighting", "dragon", "dark"], ["fire", "poison", "steel"], []]
};
const ref = name => ({ name });
const TYPE_DATA = Object.fromEntries(Object.entries(CHART).map(([t, [dd, hd, nd]]) =>
  [t, { double_damage_to: dd.map(ref), half_damage_to: hd.map(ref), no_damage_to: nd.map(ref) }]));

// The site runs in its own sandbox, so its arrays and objects come from a different JavaScript realm.
// plain() copies a value into ordinary data so strict deep comparisons work.
const plain = value => JSON.parse(JSON.stringify(value));

module.exports = { loadSite, TYPE_DATA, plain };
