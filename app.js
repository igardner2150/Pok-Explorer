/*
 * Poké Explorer — Jaden Stokes & Ian Gardner
 * Data source: PokéAPI v2 (https://pokeapi.co/api/v2/)
 *
 * Three layers of interaction (hash-based routes):
 *   Layer 1  #               → list of regions             (GET /region, /region/{name})
 *   Layer 2  #region/{name}  → Pokémon from that region    (GET /generation/{id} or /pokedex/{name})
 *   Layer 3  #pokemon/{name} → full details for one Pokémon (GET /pokemon-species, /pokemon,
 *                               /evolution-chain, /type, /ability, /pokemon/{id}/encounters)
 */

const API = "https://pokeapi.co/api/v2";
const SPRITE_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const SPRITE = id => `${SPRITE_BASE}/${id}.png`;
const HOME_ART = id => `${SPRITE_BASE}/other/home/${id}.png`;
const OFFICIAL_ART = id => `${SPRITE_BASE}/other/official-artwork/${id}.png`;

// Sprite <img> that falls back to HOME art, then official art, when a form has no game sprite (e.g. Gigantamax).
const spriteImg = (id, size = 88) =>
  `<img src="${SPRITE(id)}" data-alts="${HOME_ART(id)} ${OFFICIAL_ART(id)}" onerror="nextSprite(this)" alt="" loading="lazy" width="${size}" height="${size}">`;
window.nextSprite = img => {
  const [next, ...rest] = (img.dataset.alts || "").split(" ").filter(Boolean);
  if (!next) { img.style.visibility = "hidden"; img.onerror = null; return; }
  img.dataset.alts = rest.join(" ");
  img.classList.add("art");
  img.src = next;
};
const view = document.getElementById("view");
const crumbs = document.getElementById("crumbs");

/* ---------- Static lookup tables ---------- */

// A recognizable Pokémon per region, used as the card image on Layer 1.
const REGION_ICON = { kanto: 25, johto: 152, hoenn: 255, sinnoh: 387, unova: 495, kalos: 650, alola: 722, galar: 810, hisui: 899, paldea: 906 };

// Which region each generation's new Pokémon come from (for "Region of origin").
const GEN_REGION = {
  "generation-i": "kanto", "generation-ii": "johto", "generation-iii": "hoenn", "generation-iv": "sinnoh",
  "generation-v": "unova", "generation-vi": "kalos", "generation-vii": "alola", "generation-viii": "galar", "generation-ix": "paldea"
};

const ALL_TYPES = ["normal","fire","water","electric","grass","ice","fighting","poison","ground","flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy"];

const TYPE_COLOR = {
  normal:"#9a9a6f", fire:"#e5622f", water:"#4f84e8", electric:"#e0b416", grass:"#5ba83a", ice:"#5fbcbc",
  fighting:"#b8322a", poison:"#9a3f9a", ground:"#c9a24c", flying:"#8f7be6", psychic:"#e8497b", bug:"#93a51c",
  rock:"#a8903a", ghost:"#6a5694", dragon:"#6234e8", dark:"#6b5546", steel:"#9a9ab5", fairy:"#d97fa0"
};

// Shiny odds per game (PokéAPI has no shiny data, so this table is maintained here).
// base = full-odds wild encounter; charm = with the Shiny Charm (null = no Shiny Charm in that game).
const SHINY = (() => {
  const rows = {};
  const set = (games, base, charm) => games.forEach(g => (rows[g] = { base, charm }));
  set(["red", "blue", "yellow"], null, null);                                     // shinies didn't exist yet
  set(["gold", "silver", "crystal", "ruby", "sapphire", "emerald", "firered", "leafgreen",
       "colosseum", "xd", "diamond", "pearl", "platinum", "heartgold", "soulsilver",
       "black", "white"], 8192, null);
  set(["black-2", "white-2"], 8192, 2731);                                         // charm = 3 rolls of 1/8192
  set(["x", "y", "omega-ruby", "alpha-sapphire", "sun", "moon", "ultra-sun", "ultra-moon",
       "lets-go-pikachu", "lets-go-eevee", "sword", "shield", "brilliant-diamond", "shining-pearl",
       "scarlet", "violet"], 4096, 1365);                                          // charm = 3 rolls of 1/4096
  set(["legends-arceus"], 4096, 1024);                                             // charm = 4 rolls of 1/4096
  return rows;
})();

// Version groups in release order, used to sort the "Moves" game picker.
const VG_ORDER = ["red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire", "emerald", "firered-leafgreen",
  "colosseum", "xd", "diamond-pearl", "platinum", "heartgold-soulsilver", "black-white", "black-2-white-2", "x-y",
  "omega-ruby-alpha-sapphire", "sun-moon", "ultra-sun-ultra-moon", "lets-go-pikachu-lets-go-eevee", "sword-shield",
  "the-isle-of-armor", "the-crown-tundra", "brilliant-diamond-and-shining-pearl", "legends-arceus", "scarlet-violet",
  "the-teal-mask", "the-indigo-disk"];
const VG_LABEL = {
  "red-blue": "Red / Blue", "gold-silver": "Gold / Silver", "ruby-sapphire": "Ruby / Sapphire",
  "firered-leafgreen": "FireRed / LeafGreen", "xd": "XD: Gale of Darkness", "diamond-pearl": "Diamond / Pearl",
  "heartgold-soulsilver": "HeartGold / SoulSilver", "black-white": "Black / White", "black-2-white-2": "Black 2 / White 2",
  "x-y": "X / Y", "omega-ruby-alpha-sapphire": "Omega Ruby / Alpha Sapphire", "sun-moon": "Sun / Moon",
  "ultra-sun-ultra-moon": "Ultra Sun / Ultra Moon", "lets-go-pikachu-lets-go-eevee": "Let's Go Pikachu / Eevee",
  "sword-shield": "Sword / Shield", "the-isle-of-armor": "Sword / Shield: Isle of Armor",
  "the-crown-tundra": "Sword / Shield: Crown Tundra", "brilliant-diamond-and-shining-pearl": "Brilliant Diamond / Shining Pearl",
  "legends-arceus": "Legends: Arceus", "scarlet-violet": "Scarlet / Violet", "the-teal-mask": "Scarlet / Violet: Teal Mask",
  "the-indigo-disk": "Scarlet / Violet: Indigo Disk"
};
const METHOD_LABEL = { "level-up": "Level up", machine: "TM / HM / TR", egg: "Egg moves", tutor: "Move tutor" };

// Roles for the Natures tab. Each role ranks natures for a given Pokémon's base stats (b).
const ROLES = [
  { id: "fast-physical", label: "Fast physical attacker", desc: "Hits hard with physical moves and wants to move before the opponent.",
    pick: b => ["jolly", "adamant"] },
  { id: "fast-special", label: "Fast special attacker", desc: "Hits hard with special moves and wants to move before the opponent.",
    pick: b => ["timid", "modest"] },
  { id: "mixed", label: "Mixed attacker", desc: "Uses both physical and special moves, so it gives up a defense instead of an attack stat.",
    pick: b => b.speed >= 80 ? ["naive", "hasty", "lonely", "mild"] : ["lonely", "mild", "naive", "hasty"] },
  { id: "physical-wall", label: "Physical wall", desc: "Built to take physical hits and stay in for a long time.",
    pick: b => b.attack >= b["special-attack"] ? ["impish", "bold"] : ["bold", "impish"] },
  { id: "special-wall", label: "Special wall", desc: "Built to take special hits and stay in for a long time.",
    pick: b => b.attack >= b["special-attack"] ? ["careful", "calm"] : ["calm", "careful"] },
  { id: "trick-room", label: "Trick Room / slow attacker", desc: "Wants to be as slow as possible so it moves first under Trick Room.",
    pick: b => b.attack >= b["special-attack"] ? ["brave", "quiet"] : ["quiet", "brave"] },
  { id: "support", label: "Fast support", desc: "Sets up hazards, screens or status before the opponent can act.",
    pick: b => b.attack >= b["special-attack"] ? ["jolly", "timid"] : ["timid", "jolly"] }
];

// Suggest a role from base stats.
function suggestRole(b) {
  const atk = b.attack, spa = b["special-attack"], bulk = Math.max(b.defense, b["special-defense"]);
  if (Math.max(atk, spa) + 10 < bulk) return b.defense >= b["special-defense"] ? "physical-wall" : "special-wall";
  const style = Math.abs(atk - spa) <= 10 ? "mixed" : atk > spa ? "physical" : "special";
  if (style === "mixed") return "mixed";
  if (b.speed < 50) return "trick-room";
  return style === "physical" ? "fast-physical" : "fast-special";
}

const NATURE_STATS = ["attack", "defense", "special-attack", "special-defense", "speed"];

async function getNatures() {
  const list = await get("/nature?limit=30");
  const all = await Promise.all(list.results.map(n => get(n.url)));
  return Object.fromEntries(all.map(n => [n.name, n]));
}

const baseStats = mon => Object.fromEntries(mon.stats.map(s => [s.stat.name, s.base_stat]));

const STAT_LABEL ={ hp:"HP", attack:"Attack", defense:"Defense", "special-attack":"Sp. Atk", "special-defense":"Sp. Def", speed:"Speed" };

/* ---------- Helpers ---------- */

// Two cache levels: memory (this visit) and IndexedDB in the browser (repeat visits, kept 7 days).
// IndexedDB works on plain http too; if it's unavailable the site just fetches as normal.
const cache = new Map();
const DISK_TTL = 7 * 24 * 60 * 60 * 1000;
const diskDb = new Promise(resolve => {
  try {
    const req = indexedDB.open("poke-explorer-cache", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("responses");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  } catch { resolve(null); }
});

async function diskGet(url) {
  const db = await diskDb;
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const req = db.transaction("responses").objectStore("responses").get(url);
      req.onsuccess = () => {
        const hit = req.result;
        resolve(hit && Date.now() - hit.t < DISK_TTL ? hit.data : null);
      };
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function diskPut(url, data) {
  const db = await diskDb;
  if (!db) return;
  try { db.transaction("responses", "readwrite").objectStore("responses").put({ t: Date.now(), data }, url); } catch {}
}

async function get(url) {
  if (!url.startsWith("http")) url = API + url;
  if (cache.has(url)) return cache.get(url);
  const promise = (async () => {
    const saved = await diskGet(url);
    if (saved) return saved;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status === 404 ? "not-found" : `PokéAPI returned ${res.status}`);
    const data = await res.json();
    diskPut(url, data);
    return data;
  })();
  cache.set(url, promise);
  promise.catch(() => cache.delete(url));
  return promise;
}

const idFromUrl = url => Number(url.split("/").filter(Boolean).pop());
const title = s => s.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const pad = n => "#" + String(n).padStart(4, "0");
const english = (list, key = "name") => (list || []).find(e => e.language.name === "en")?.[key];
const genLabel = g => "Generation " + g.replace("generation-", "").toUpperCase();
const typeBadge = (t, extra = "") => `<span class="type" style="background:${TYPE_COLOR[t] || "#777"}">${t}${extra}</span>`;

function setCrumbs(items) {
  crumbs.innerHTML = items.map((it, i) =>
    (i ? '<span class="sep">/</span>' : "") + (it.href ? `<a href="${it.href}">${esc(it.label)}</a>` : `<span>${esc(it.label)}</span>`)
  ).join("");
}

function showError(err, what) {
  const msg = err.message === "not-found"
    ? `No Pokémon or region called “${esc(what)}” was found. Check the spelling (use hyphens, e.g. mr-mime) or try a Pokédex number.`
    : err instanceof ReferenceError
      ? `Part of the site didn't load (${esc(err.message)}). Make sure index.html, styles.css, app.js, gimmicks.js, tracker.js, extras.js and training.js are all on the server, then refresh the page.`
      : err instanceof TypeError && /fetch|network|load failed/i.test(err.message)
        ? `Couldn't reach PokéAPI. Check your internet connection and refresh the page.`
        : `Something went wrong showing this page (${esc(err.message)}). Refresh the page to try again.`;
  view.innerHTML = `<div class="error"><p>${msg}</p><p><a href="#">Back to regions</a></p></div>`;
}

/* ---------- Layer 1: Regions ---------- */

async function renderRegions() {
  setCrumbs([{ label: "Regions" }]);
  view.innerHTML = `<p class="status">Loading regions…</p>`;
  const list = await get("/region?limit=50");
  const allRegions = await Promise.all(list.results.map(r => get(r.url)));
  // Hide regions with no Pokémon of their own (e.g. Orre). Regions with a generation always have some;
  // the others are checked through their regional Pokédex.
  const hasPokemon = await Promise.all(allRegions.map(r =>
    r.main_generation ? true : speciesForRegion(r).then(list => list.length > 0).catch(() => false)
  ));
  const regions = allRegions.filter((r, i) => hasPokemon[i]);

  view.innerHTML = `
    <div id="home-extras"></div>
    <h1>Choose a region</h1>
    <p class="lede">Every Pokémon debuted in one of these regions. Pick a region to see the Pokémon that originate there, or search any Pokémon by name or number above.</p>
    <div class="region-grid">
      ${regions.map(r => {
        const gen = r.main_generation ? genLabel(r.main_generation.name) : "Special region";
        const icon = REGION_ICON[r.name];
        return `
          <a class="region-card" href="#region/${r.name}">
            <div><div class="gen">${esc(gen)}</div><h3>${esc(title(r.name))}</h3></div>
            ${icon ? `<img src="${SPRITE(icon)}" alt="" loading="lazy">` : ""}
          </a>`;
      }).join("")}
    </div>`;
  renderHomeExtras(document.getElementById("home-extras"));
}

/* ---------- Layer 2: Pokémon in a region ---------- */

async function speciesForRegion(region) {
  // Prefer the region's generation: that list is exactly the Pokémon that originate there.
  if (region.main_generation) {
    const gen = await get(region.main_generation.url);
    return gen.pokemon_species.map(s => ({ name: s.name, id: idFromUrl(s.url) }));
  }
  // Regions without a generation (e.g. Hisui) fall back to their regional Pokédex.
  if (region.pokedexes.length) {
    const dex = await get(region.pokedexes[0].url);
    return dex.pokemon_entries.map(e => ({ name: e.pokemon_species.name, id: idFromUrl(e.pokemon_species.url) }));
  }
  return [];
}

async function renderRegion(name) {
  setCrumbs([{ label: "Regions", href: "#" }, { label: title(name) }]);
  view.innerHTML = `<p class="status">Loading Pokémon from ${esc(title(name))}…</p>`;
  const region = await get(`/region/${name}`);
  const [mons, forms] = await Promise.all([
    speciesForRegion(region).then(l => l.sort((a, b) => a.id - b.id)),
    REGIONAL[name] ? regionalForms(name) : []
  ]);
  if (!mons.length) {
    view.innerHTML = `<h1>${esc(title(name))}</h1>
      <p class="lede">No Pokémon originate from ${esc(title(name))}, so there's nothing to list here.</p>
      <p><a class="text-link" href="#">Back to regions</a></p>`;
    return;
  }

  view.innerHTML = `
    <h1>${esc(title(name))}</h1>
    <p class="lede">${region.main_generation
      ? `Pokémon that debuted in ${genLabel(region.main_generation.name)}.`
      : `Pokémon listed in the ${esc(title(region.pokedexes[0]?.name || name))} Pokédex.`} Select one for its full profile.</p>
    ${forms.length ? `
      <div class="sub-tabs" role="tablist" aria-label="${esc(title(name))} lists">
        <button type="button" role="tab" class="sub-tab active" aria-selected="true" data-grid="mon-grid">Native Pokémon (${mons.length})</button>
        <button type="button" role="tab" class="sub-tab" aria-selected="false" data-grid="form-grid">Regional forms (${forms.length})</button>
      </div>` : ""}
    <div class="list-tools">
      <label class="visually-hidden" for="filter">Filter this region's Pokémon</label>
      <input id="filter" type="search" placeholder="Filter by name or number…" autocomplete="off">
      <span class="count" id="count"></span>
    </div>
    <div class="mon-grid" id="mon-grid">
      ${mons.map(m => `
        <a class="mon-card" href="#pokemon/${m.name}" data-key="${m.name} ${m.id}">
          <img src="${SPRITE(m.id)}" alt="" loading="lazy" width="88" height="88">
          <span class="num">${pad(m.id)}</span>
          <span class="name">${esc(title(m.name))}</span>
          ${trackBadges(m.id)}
        </a>`).join("")}
    </div>
    ${forms.length ? `<div class="mon-grid" id="form-grid" hidden>${forms.map(formCard).join("")}</div>` : ""}`;

  const filter = document.getElementById("filter");
  let activeGrid = document.getElementById("mon-grid");
  const applyFilter = () => {
    const q = filter.value.trim().toLowerCase().replace(/^#?0*/, "");
    const cards = [...activeGrid.querySelectorAll(".mon-card")];
    let shown = 0;
    cards.forEach(c => { const hit = !q || c.dataset.key.includes(q); c.hidden = !hit; if (hit) shown++; });
    const noun = activeGrid.id === "form-grid" ? "regional forms" : "Pokémon";
    document.getElementById("count").textContent = q ? `${shown} of ${cards.length} ${noun}` : `${cards.length} ${noun}`;
  };
  filter.addEventListener("input", applyFilter);
  view.querySelectorAll(".sub-tab").forEach(btn => btn.addEventListener("click", () => {
    view.querySelectorAll(".sub-tab").forEach(b => { const on = b === btn; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    view.querySelectorAll(".mon-grid").forEach(g => (g.hidden = g.id !== btn.dataset.grid));
    activeGrid = document.getElementById(btn.dataset.grid);
    applyFilter();
  }));
  applyFilter();
}

/* ---------- Shared loaders ---------- */

// Accepts a species name ("vulpix"), a Pokédex number, or a specific form ("vulpix-alola", "charizard-mega-x").
async function loadSpeciesAndMon(query) {
  try {
    const species = await get(`/pokemon-species/${query}`);
    const v = species.varieties.find(x => x.is_default) || species.varieties[0];
    return { species, mon: await get(v.pokemon.url) };
  } catch (err) {
    if (err.message !== "not-found") throw err;
    const mon = await get(`/pokemon/${query}`);
    return { species: await get(mon.species.url), mon };
  }
}

const getAllPokemon = () => get("/pokemon?limit=2000");

/* ---------- Regional forms ---------- */

const REGIONAL = { alola: "Alolan", galar: "Galarian", hisui: "Hisuian", paldea: "Paldean" };
const REGIONAL_RE = /^(.+?)-(alola|galar|hisui|paldea)(?:-(.+))?$/;

// Regional variants only: skip totem Pokémon, Pikachu's cap costumes and Gigantamax forms.
const isRegionalForm = name => REGIONAL_RE.test(name) && !/totem|-cap$|-cap-|gmax/.test(name);

function regionalInfo(name) {
  const m = name.match(REGIONAL_RE);
  if (!m) return null;
  return { base: m[1], region: m[2], label: `${REGIONAL[m[2]]} ${title(m[1])}${m[3] ? ` (${title(m[3])})` : ""}` };
}

async function regionalForms(region) {
  const all = await getAllPokemon();
  return all.results.filter(p => isRegionalForm(p.name))
    .map(p => ({ name: p.name, id: idFromUrl(p.url), ...regionalInfo(p.name) }))
    .filter(f => !region || f.region === region);
}

const formCard = f => `
  <a class="mon-card" href="#pokemon/${f.name}" data-key="${f.name} ${f.label.toLowerCase()}">
    ${spriteImg(f.id)}
    <span class="num">${esc(REGIONAL[f.region] || "")} form</span>
    <span class="name">${esc(f.label)}</span>
  </a>`;

// Layer 1 of the Regional forms tab: one card per region. Layer 2: that region's forms.
const FORM_REGION_ICON = { alola: "vulpix-alola", galar: "ponyta-galar", hisui: "growlithe-hisui", paldea: "wooper-paldea" };

async function renderRegionalForms(region) {
  if (region) return renderFormRegion(region);
  setCrumbs([{ label: "Regional forms" }]);
  view.innerHTML = `<p class="status">Loading regional forms…</p>`;
  const forms = await regionalForms();

  view.innerHTML = `
    <h1>Regional forms</h1>
    <p class="lede">Some Pokémon adapted to a new region and changed their typing, stats, abilities and look. Pick a region to see the forms that live there.</p>
    <div class="region-grid">
      ${Object.keys(REGIONAL).map(r => {
        const list = forms.filter(f => f.region === r);
        if (!list.length) return "";
        const icon = list.find(f => f.name === FORM_REGION_ICON[r]) || list[0];
        return `
          <a class="region-card" href="#forms/${r}">
            <div><div class="gen">${list.length} ${REGIONAL[r]} form${list.length > 1 ? "s" : ""}</div><h3>${esc(title(r))}</h3></div>
            ${spriteImg(icon.id, 84)}
          </a>`;
      }).join("")}
    </div>`;
}

async function renderFormRegion(region) {
  if (!REGIONAL[region]) throw new Error("not-found");
  setCrumbs([{ label: "Regional forms", href: "#forms" }, { label: title(region) }]);
  view.innerHTML = `<p class="status">Loading ${REGIONAL[region]} forms…</p>`;
  const forms = await regionalForms(region);

  view.innerHTML = `
    <h1>${REGIONAL[region]} forms</h1>
    <p class="lede">Pokémon that look and battle differently in ${esc(title(region))}. Select one for its full profile, or <a class="text-link" href="#region/${region}">see every Pokémon from ${esc(title(region))}</a>.</p>
    <div class="list-tools">
      <label class="visually-hidden" for="form-filter">Filter ${REGIONAL[region]} forms</label>
      <input id="form-filter" type="search" placeholder="Filter by name…" autocomplete="off">
      <span class="count" id="count">${forms.length} forms</span>
    </div>
    <div class="mon-grid">${forms.map(formCard).join("")}</div>`;

  const filter = document.getElementById("form-filter");
  const cards = [...view.querySelectorAll(".mon-card")];
  filter.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    cards.forEach(c => { const hit = !q || c.dataset.key.includes(q); c.hidden = !hit; if (hit) shown++; });
    document.getElementById("count").textContent = q ? `${shown} of ${cards.length} forms` : `${cards.length} forms`;
  });
}

/* ---------- Layer 3: Pokémon details ---------- */

function describeEvolution(d) {
  if (!d) return "";
  const parts = [];
  const trigger = d.trigger?.name;
  if (trigger === "level-up") parts.push(d.min_level ? `Level ${d.min_level}` : "Level up");
  else if (trigger === "use-item" && d.item) parts.push(`Use ${title(d.item.name)}`);
  else if (trigger === "trade") parts.push("Trade");
  else if (trigger === "shed") parts.push("Level 20 with an empty party slot and a Poké Ball");
  else if (trigger) parts.push(title(trigger));
  if (d.item && trigger !== "use-item") parts.push(`with ${title(d.item.name)}`);
  if (d.held_item) parts.push(`holding ${title(d.held_item.name)}`);
  if (d.trade_species) parts.push(`for ${title(d.trade_species.name)}`);
  if (d.min_happiness) parts.push("with high friendship");
  if (d.min_affection) parts.push("with high affection");
  if (d.min_beauty) parts.push("with high Beauty");
  if (d.known_move) parts.push(`knowing ${title(d.known_move.name)}`);
  if (d.known_move_type) parts.push(`knowing a ${title(d.known_move_type.name)}-type move`);
  if (d.location) parts.push(`at ${title(d.location.name)}`);
  if (d.time_of_day) parts.push(`during the ${d.time_of_day}`);
  if (d.gender === 1) parts.push("(female)");
  if (d.gender === 2) parts.push("(male)");
  if (d.needs_overworld_rain) parts.push("while raining");
  if (d.party_species) parts.push(`with ${title(d.party_species.name)} in party`);
  if (d.party_type) parts.push(`with a ${title(d.party_type.name)}-type in party`);
  if (d.relative_physical_stats === 1) parts.push("(Attack > Defense)");
  if (d.relative_physical_stats === -1) parts.push("(Attack < Defense)");
  if (d.relative_physical_stats === 0) parts.push("(Attack = Defense)");
  if (d.turn_upside_down) parts.push("holding the console upside down");
  return parts.join(" ");
}

function evolutionStages(chain) {
  // Flatten the evolution tree into stages: [[base], [stage 1 options], [stage 2 options]].
  const stages = [];
  (function walk(node, depth) {
    (stages[depth] ||= []).push({
      name: node.species.name,
      id: idFromUrl(node.species.url),
      how: node.evolution_details.map(describeEvolution).filter(Boolean).join(" or ")
    });
    node.evolves_to.forEach(n => walk(n, depth + 1));
  })(chain, 0);
  return stages;
}

async function typeMatchups(types) {
  const data = await Promise.all(types.map(t => get(`/type/${t}`)));
  const defense = Object.fromEntries(ALL_TYPES.map(t => [t, 1]));
  const strong = new Set();
  data.forEach(({ damage_relations: r }) => {
    r.double_damage_from.forEach(t => defense[t.name] !== undefined && (defense[t.name] *= 2));
    r.half_damage_from.forEach(t => defense[t.name] !== undefined && (defense[t.name] *= 0.5));
    r.no_damage_from.forEach(t => defense[t.name] !== undefined && (defense[t.name] = 0));
    r.double_damage_to.forEach(t => strong.add(t.name));
  });
  const fmt = x => x === 0.25 ? "¼" : x === 0.5 ? "½" : String(x);
  return {
    weak: ALL_TYPES.filter(t => defense[t] > 1).map(t => ({ t, x: fmt(defense[t]) })),
    resist: ALL_TYPES.filter(t => defense[t] > 0 && defense[t] < 1).map(t => ({ t, x: fmt(defense[t]) })),
    immune: ALL_TYPES.filter(t => defense[t] === 0),
    strong: ALL_TYPES.filter(t => strong.has(t))
  };
}

function shinyRows(games) {
  const pct = n => (100 / n).toFixed(n >= 4000 ? 3 : 2) + "%";
  const odds = n => `1 in ${n.toLocaleString()} <span class="muted">(${pct(n)})</span>`;
  const order = Object.keys(SHINY);
  return [...games].filter(g => g in SHINY).sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(g => {
    const { base, charm } = SHINY[g];
    return `<tr>
      <td>${esc(GAME_LABEL[g] || title(g))}${ownsGame(g) ? ' <span class="own-chip">You own</span>' : ""}</td>
      <td>${base ? odds(base) : '<span class="muted">No shinies in this game</span>'}</td>
      <td>${charm ? odds(charm) : `<span class="muted">${base ? "No Shiny Charm" : "—"}</span>`}</td>
    </tr>`;
  }).join("");
}

// Group every move the Pokémon can learn by game (version group).
function movesByGame(mon) {
  const byVg = {};
  mon.moves.forEach(m => m.version_group_details.forEach(d => {
    (byVg[d.version_group.name] ||= []).push({
      name: m.move.name, url: m.move.url, method: d.move_learn_method.name, level: d.level_learned_at
    });
  }));
  return byVg;
}

const vgRank = vg => { const i = VG_ORDER.indexOf(vg); return i === -1 ? 999 : i; };

let moveRenderToken = 0;
async function renderMoves(byVg, vg, box) {
  const token = ++moveRenderToken;
  const list = byVg[vg] || [];
  box.innerHTML = `<p class="status">Loading ${list.length} moves…</p>`;
  const details = new Map(await Promise.all(
    [...new Set(list.map(m => m.url))].map(async url => [url, await get(url).catch(() => null)])
  ));
  if (token !== moveRenderToken) return;   // user switched games while loading

  const methods = [...new Set(list.map(m => m.method))]
    .sort((a, b) => (Object.keys(METHOD_LABEL).indexOf(a) + 1 || 99) - (Object.keys(METHOD_LABEL).indexOf(b) + 1 || 99));

  box.innerHTML = methods.map(method => {
    const rows = list.filter(m => m.method === method)
      .map(m => ({ ...m, d: details.get(m.url) }))
      .sort((a, b) => method === "level-up" ? a.level - b.level || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    const isLevel = method === "level-up";
    return `
      <h3>${esc(METHOD_LABEL[method] || title(method))} <span class="muted">(${rows.length})</span></h3>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>${isLevel ? "<th>Lv.</th>" : ""}<th>Move</th><th>Type</th><th>Category</th><th class="num">Power</th><th class="num">Acc.</th><th class="num">PP</th></tr></thead>
          <tbody>
            ${rows.map(({ level, name, d }) => `<tr>
              ${isLevel ? `<td class="num">${level === 0 ? "Evo" : level}</td>` : ""}
              <td><strong>${esc(d ? english(d.names) || title(name) : title(name))}</strong></td>
              <td>${d?.type ? typeBadge(d.type.name) : "—"}</td>
              <td>${d?.damage_class ? title(d.damage_class.name) : "—"}</td>
              <td class="num">${d?.power ?? "—"}</td>
              <td class="num">${d?.accuracy != null ? d.accuracy + "%" : "—"}</td>
              <td class="num">${d?.pp ?? "—"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
  }).join("") || '<p class="muted">No move data for this game.</p>';
}

async function renderPokemon(query) {
  setCrumbs([{ label: "Regions", href: "#" }, { label: "Loading…" }]);
  view.innerHTML = `<p class="status">Loading ${esc(query)}…</p>`;

  // Species holds the Pokédex data; the chosen variety (default or a form) holds stats, types and sprites.
  const { species, mon } = await loadSpeciesAndMon(query);
  const evo = species.evolution_chain ? await get(species.evolution_chain.url) : null;
  const isForm = !species.varieties.find(v => v.is_default && v.pokemon.name === mon.name);

  const types = mon.types.map(t => t.type.name);
  const [matchups, abilities, encounters, otherForms, natures] = await Promise.all([
    typeMatchups(types),
    Promise.all(mon.abilities.map(async a => {
      const ab = await get(a.ability.url);
      const text = english(ab.effect_entries, "short_effect")
        || [...ab.flavor_text_entries].reverse().find(f => f.language.name === "en")?.flavor_text || "";
      return { name: english(ab.names) || title(ab.name), hidden: a.is_hidden, text };
    })),
    get(`/pokemon/${mon.id}/encounters`).catch(() => []),
    Promise.all(species.varieties.filter(v => v.pokemon.name !== mon.name).slice(0, 16).map(v => get(v.pokemon.url).catch(() => null))),
    getNatures().catch(() => null)
  ]);

  const speciesName = english(species.names) || title(species.name);
  const displayName = !isForm ? speciesName : regionalInfo(mon.name)?.label || title(mon.name);
  const genus = english(species.genera, "genus") || "";
  const entries = species.flavor_text_entries.filter(f => f.language.name === "en");
  const entry = entries[entries.length - 1];
  const originRegion = regionalInfo(mon.name)?.region || GEN_REGION[species.generation.name];

  setCrumbs([
    ...(regionalInfo(mon.name)
      ? [{ label: "Regional forms", href: "#forms" }, { label: title(originRegion), href: `#forms/${originRegion}` }]
      : [{ label: "Regions", href: "#" },
         originRegion ? { label: title(originRegion), href: `#region/${originRegion}` } : { label: genLabel(species.generation.name) }]),
    { label: displayName }
  ]);

  // Games: combine versions from game data, Pokédex entries and wild encounters.
  const games = new Set();
  mon.game_indices.forEach(g => games.add(g.version.name));
  entries.forEach(f => games.add(f.version.name));
  encounters.forEach(e => e.version_details.forEach(v => games.add(v.version.name)));

  const encounterByGame = {};
  encounters.forEach(e => e.version_details.forEach(v => {
    (encounterByGame[v.version.name] ||= new Set()).add(title(e.location_area.name.replace(/-area$/, "")));
  }));

  const art = mon.sprites.other?.["official-artwork"]?.front_default || mon.sprites.other?.home?.front_default || mon.sprites.front_default;
  const cry = mon.cries?.latest || mon.cries?.legacy;
  const stages = evo ? evolutionStages(evo.chain) : [];
  const total = mon.stats.reduce((s, x) => s + x.base_stat, 0);

  const s = mon.sprites;
  const spriteList = [
    [s.other?.["official-artwork"]?.front_default, "Official art", true],
    [s.other?.["official-artwork"]?.front_shiny, "Official art (shiny)", true],
    [s.other?.home?.front_default, "HOME", true],
    [s.other?.home?.front_shiny, "HOME (shiny)", true],
    [s.front_default, "Front"], [s.back_default, "Back"],
    [s.front_shiny, "Shiny front"], [s.back_shiny, "Shiny back"],
    [s.front_female, "Female"], [s.front_shiny_female, "Shiny female"]
  ].filter(([src]) => src);

  const stats = baseStats(mon);
  const role = ROLES.find(r => r.id === suggestRole(stats));
  const naturePicks = natures ? role.pick(stats).slice(0, 2).map(n => natures[n]).filter(Boolean) : [];
  const shinyHtml = shinyRows(games);
  const byVg = movesByGame(mon);
  const vgs = Object.keys(byVg).sort((a, b) => vgRank(b) - vgRank(a));   // newest game first

  view.innerHTML = `
    <section class="hero">
      <div class="hero-art">
        ${art ? `<img src="${art}" alt="${esc(displayName)} official artwork">` : ""}
        ${cry ? `<button class="cry" id="cry" type="button">▶ Cry</button>` : ""}
      </div>
      <div>
        <div class="dex-no">National Pokédex ${pad(species.id)}</div>
        <h1>${esc(displayName)}</h1>
        <div class="genus">${esc(genus)}</div>
        <div class="types">${types.map(t => typeBadge(t)).join("")}</div>
        ${trackerToggles(species.id)}
        <dl class="facts">
          <div><dt>Region</dt><dd>${originRegion ? `<a href="#region/${originRegion}">${title(originRegion)}</a>` : "—"}</dd></div>
          <div><dt>Generation</dt><dd>${genLabel(species.generation.name).replace("Generation", "Gen")}</dd></div>
          <div><dt>Height</dt><dd>${(mon.height / 10).toFixed(1)} m</dd></div>
          <div><dt>Weight</dt><dd>${(mon.weight / 10).toFixed(1)} kg</dd></div>
          <div><dt>Base EXP</dt><dd>${mon.base_experience ?? "—"}</dd></div>
          <div><dt>Capture rate</dt><dd>${species.capture_rate} / 255</dd></div>
        </dl>
        ${entry ? `<blockquote class="entry">${esc(entry.flavor_text.replace(/[\f\n\r­]+/g, " "))}<cite>Pokédex entry · Pokémon ${esc(title(entry.version.name))}</cite></blockquote>` : ""}
      </div>
    </section>

    <div class="sections">
      <section class="panel">
        <h2>Base stats</h2>
        <div class="stats">
          ${mon.stats.map(st => {
            const pct = Math.min(100, st.base_stat / 255 * 100);
            const color = st.base_stat >= 100 ? "#3aa35b" : st.base_stat >= 70 ? "#d1a21b" : "#d6543a";
            return `<span class="label">${STAT_LABEL[st.stat.name] || st.stat.name}</span>
                    <span class="val">${st.base_stat}</span>
                    <span class="bar"><span style="width:${pct}%;background:${color}"></span></span>`;
          }).join("")}
          <span class="total">Total ${total}</span>
        </div>
      </section>

      <section class="panel">
        <h2>Abilities</h2>
        <ul class="abilities">
          ${abilities.map(a => `<li><strong>${esc(a.name)}${a.hidden ? '<span class="badge">Hidden</span>' : ""}</strong><span class="muted">${esc(a.text.replace(/\s+/g, " "))}</span></li>`).join("")}
        </ul>
      </section>

      <section class="panel wide">
        <h2>Type matchups</h2>
        <h3>Weak to (takes extra damage)</h3>
        <div class="types">${matchups.weak.map(m => typeBadge(m.t, `<small>×${m.x}</small>`)).join("") || '<span class="muted">None</span>'}</div>
        <h3>Strong against (its attacks deal ×2)</h3>
        <div class="types">${matchups.strong.map(t => typeBadge(t)).join("") || '<span class="muted">None</span>'}</div>
        <h3>Resists</h3>
        <div class="types">${matchups.resist.map(m => typeBadge(m.t, `<small>×${m.x}</small>`)).join("") || '<span class="muted">None</span>'}</div>
        ${matchups.immune.length ? `<h3>Immune to</h3><div class="types">${matchups.immune.map(t => typeBadge(t, "<small>×0</small>")).join("")}</div>` : ""}
      </section>

      <section class="panel wide">
        <h2>Evolution chain</h2>
        ${stages.length > 1 ? `<div class="evo">
          ${stages.map((stage, i) => `
            ${i ? '<div class="evo-arrow" aria-hidden="true">→</div>' : ""}
            <div class="evo-stage">
              ${stage.map(m => `
                <a class="evo-mon${m.id === species.id ? " current" : ""}" href="#pokemon/${m.name}">
                  <img src="${SPRITE(m.id)}" alt="" loading="lazy">
                  <strong>${esc(title(m.name))}</strong>
                  ${m.how ? `<span class="how">${esc(m.how)}</span>` : i ? "" : '<span class="how">Base form</span>'}
                </a>`).join("")}
            </div>`).join("")}
        </div>` : `<p class="muted">${esc(displayName)} does not evolve.</p>`}
      </section>

      <section class="panel wide">
        <h2>Appearance</h2>
        <div class="sprites">
          ${spriteList.map(([src, label, isArt]) => `<figure><img class="${isArt ? "art" : ""}" src="${src}" alt="${esc(displayName)} ${esc(label)}" loading="lazy"><figcaption>${label}</figcaption></figure>`).join("")}
        </div>
        ${otherForms.filter(Boolean).length ? `
          <h3>Other forms <span class="muted">(select one for its full profile)</span></h3>
          <div class="sprites">
            ${otherForms.filter(Boolean).map(f => {
              const src = f.sprites.other?.["official-artwork"]?.front_default || f.sprites.other?.home?.front_default || f.sprites.front_default;
              const label = f.is_default ? speciesName : regionalInfo(f.name)?.label || title(f.name);
              return src ? `<a class="form-link" href="#pokemon/${f.name}"><figure><img class="art" src="${src}" alt="${esc(label)}" loading="lazy"><figcaption>${esc(label)}</figcaption></figure></a>` : "";
            }).join("")}
          </div>` : ""}
      </section>

      <section class="panel wide">
        <h2>Games</h2>
        ${games.size ? `<div class="games">${[...games].map(g => `<span class="chip">${esc(title(g))}</span>`).join("")}</div>` : '<p class="muted">No game data available yet.</p>'}
        ${Object.keys(encounterByGame).length ? `
          <h3>Where to find it in the wild</h3>
          <div class="locs">
            ${Object.entries(encounterByGame).map(([game, places]) => `
              <details><summary>${esc(title(game))} <span class="muted">(${places.size} location${places.size > 1 ? "s" : ""})</span></summary>
                <ul>${[...places].map(p => `<li>${esc(p)}</li>`).join("")}</ul>
              </details>`).join("")}
          </div>` : '<p class="muted">No wild encounter locations listed; it may be obtained by evolution, trade, gift or event.</p>'}
      </section>

      <section class="panel wide">
        <div class="panel-head">
          <h2>Natures</h2>
          <a class="text-link" href="#natures/${species.name}">Compare all roles →</a>
        </div>
        <p class="muted">${esc(displayName)} can have any of the 25 natures. Based on its base stats, it suits a <strong>${esc(role.label.toLowerCase())}</strong>.</p>
        ${naturePicks.length ? `<div class="nature-cards">${naturePicks.map((n, i) => natureCard(n, stats, i)).join("")}</div>` : ""}
      </section>

      ${trainingPanel(species, mon, displayName)}

      <section class="panel wide">
        <div class="panel-head">
          <h2>Battle gimmicks</h2>
          <a class="text-link" href="#gimmicks/${species.name}">See gimmicks for ${esc(speciesName)} →</a>
        </div>
        <p class="muted">Mega Evolution, Primal Reversion, Z-Moves, Dynamax / Gigantamax and Terastallization: which ones ${esc(speciesName)} can use in each game, how its stats and moves change, and what you need to unlock them.</p>
      </section>

      <section class="panel wide">
        <h2>Shiny odds</h2>
        ${shinyHtml ? `
          <div class="shiny-pair">
            ${s.front_default ? `<figure><img src="${s.front_default}" alt="Normal ${esc(displayName)}"><figcaption>Normal</figcaption></figure>` : ""}
            ${s.front_shiny ? `<figure><img src="${s.front_shiny}" alt="Shiny ${esc(displayName)}"><figcaption>Shiny</figcaption></figure>` : ""}
          </div>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Game</th><th>Base odds</th><th>With Shiny Charm</th></tr></thead>
              <tbody>${shinyHtml}</tbody>
            </table>
          </div>
          <p class="muted note">Full-odds rates for a random encounter. Methods like the Masuda Method, chaining, mass outbreaks and Sandwich powers raise them further, and some legendary or gift Pokémon are shiny-locked.</p>`
        : '<p class="muted">No shiny data for the games this Pokémon appears in.</p>'}
      </section>

      <section class="panel wide">
        <div class="panel-head">
          <h2>Moves</h2>
          ${vgs.length ? `<label class="vg-pick"><span>Game</span>
            <select id="vg-select">${vgs.map(v => `<option value="${v}">${esc(VG_LABEL[v] || title(v))}</option>`).join("")}</select>
          </label>` : ""}
        </div>
        <div id="moves-body">${vgs.length ? "" : '<p class="muted">No move data available.</p>'}</div>
      </section>
    </div>`;

  if (vgs.length) {
    const select = document.getElementById("vg-select");
    const box = document.getElementById("moves-body");
    select.addEventListener("change", () => renderMoves(byVg, select.value, box));
    renderMoves(byVg, select.value, box);
  }

  wireTrackerToggles();

  if (cry) {
    const audio = new Audio(cry);
    audio.volume = 0.4;
    document.getElementById("cry").addEventListener("click", () => { audio.currentTime = 0; audio.play().catch(() => {}); });
  }
}

/* ---------- Natures tab ---------- */

const statShort = s => STAT_LABEL[s] || title(s);

// One recommended-nature card, with an explanation tied to the Pokémon's base stats when one is chosen.
function natureCard(n, b, rank) {
  const up = n.increased_stat?.name, down = n.decreased_stat?.name;
  let why = "";
  if (b && up && down) {
    why = `<p class="why">Boosts ${statShort(up)} (base ${b[up]}) and lowers ${statShort(down)} (base ${b[down]})${
      (down === "attack" || down === "special-attack") && b[down] < Math.max(b.attack, b["special-attack"]) ? ", which it doesn't need to attack with" :
      down === "speed" ? ", which helps under Trick Room" : ""}.</p>`;
  }
  return `
    <article class="nature-card${rank === 0 ? " best" : ""}">
      ${rank === 0 ? '<span class="badge">Best pick</span>' : ""}
      <h3>${esc(english(n.names) || title(n.name))}</h3>
      <div class="nature-fx">
        <span class="up">+10% ${statShort(up)}</span>
        <span class="down">−10% ${statShort(down)}</span>
      </div>
      ${why}
      <p class="flavor">Likes ${esc(n.likes_flavor?.name || "—")} food · dislikes ${esc(n.hates_flavor?.name || "—")}</p>
    </article>`;
}

let natureRole = null, lastNatureQuery;
async function renderNatures(query) {
  if (query !== lastNatureQuery) natureRole = null;
  lastNatureQuery = query;
  setCrumbs([{ label: "Natures", href: "#natures" }, ...(query ? [{ label: "Loading…" }] : [])]);
  view.innerHTML = `<p class="status">Loading natures…</p>`;

  const natures = await getNatures();
  let mon = null, species = null, b = null, displayName = "";
  if (query) {
    species = await get(`/pokemon-species/${query}`);
    const v = species.varieties.find(x => x.is_default) || species.varieties[0];
    mon = await get(v.pokemon.url);
    b = baseStats(mon);
    displayName = english(species.names) || title(species.name);
    setCrumbs([{ label: "Natures", href: "#natures" }, { label: displayName }]);
  }
  const suggested = b ? suggestRole(b) : null;
  if (!natureRole || (suggested && natureRole.auto)) natureRole = { id: suggested || "fast-physical", auto: true };

  view.innerHTML = `
    <h1>Natures</h1>
    <p class="lede">Every Pokémon can have any of the 25 natures. A nature raises one stat by 10% and lowers another by 10% (HP is never affected). Choose what you want the Pokémon to do, and optionally enter a Pokémon to get picks based on its base stats.</p>

    <form class="nature-pokemon" id="nature-form">
      <label for="nature-input">Pokémon</label>
      <input id="nature-input" type="search" list="name-suggestions" placeholder="e.g. garchomp" value="${esc(species ? species.name : "")}" autocomplete="off">
      <button type="submit">Use this Pokémon</button>
      ${species ? `<a class="clear" href="#natures">Clear</a>` : ""}
    </form>

    ${mon ? `
      <div class="nature-mon">
        <img src="${SPRITE(mon.id)}" alt="">
        <div>
          <a href="#pokemon/${species.name}"><strong>${esc(displayName)}</strong></a>
          <div class="mini-stats">${NATURE_STATS.concat("hp").map(s => `<span><em>${statShort(s)}</em> ${b[s]}</span>`).join("")}</div>
          <p class="muted">Suggested role from its stats: <strong>${esc(ROLES.find(r => r.id === suggested).label)}</strong></p>
        </div>
      </div>` : ""}

    <div class="role-tabs" role="tablist" aria-label="What do you want it to do?">
      ${ROLES.map(r => `<button type="button" role="tab" class="role${r.id === natureRole.id ? " active" : ""}" aria-selected="${r.id === natureRole.id}" data-role="${r.id}">${esc(r.label)}${r.id === suggested ? " ★" : ""}</button>`).join("")}
    </div>
    <div id="role-result"></div>

    <h2 class="grid-title">All 25 natures</h2>
    <p class="muted">Rows are the stat a nature raises, columns the stat it lowers. Natures on the diagonal are neutral. Highlighted cells are the picks for the selected role.</p>
    <div class="table-wrap"><table class="nature-grid" id="nature-grid"></table></div>`;

  const byEffect = {};
  Object.values(natures).forEach(n => {
    const up = n.increased_stat?.name, down = n.decreased_stat?.name;
    if (up && down) byEffect[up + "|" + down] = n;
  });
  const neutral = Object.values(natures).filter(n => !n.increased_stat);

  function draw() {
    const role = ROLES.find(r => r.id === natureRole.id);
    const picks = role.pick(b || { attack: 100, "special-attack": 100, speed: 100 }).map(name => natures[name]).filter(Boolean);
    document.getElementById("role-result").innerHTML = `
      <p class="role-desc">${esc(role.desc)}</p>
      <div class="nature-cards">${picks.map((n, i) => natureCard(n, b, i)).join("")}</div>`;

    const pickNames = new Set(picks.map(n => n.name));
    const neutralFor = i => neutral[i] ? english(neutral[i].names) || title(neutral[i].name) : "";
    let ni = 0;
    document.getElementById("nature-grid").innerHTML = `
      <thead><tr><th>+ \\ −</th>${NATURE_STATS.map(s => `<th>−${statShort(s)}</th>`).join("")}</tr></thead>
      <tbody>${NATURE_STATS.map(up => `<tr><th>+${statShort(up)}</th>${NATURE_STATS.map(down => {
        if (up === down) return `<td class="neutral">${esc(neutralFor(ni++))}</td>`;
        const n = byEffect[up + "|" + down];
        return `<td class="${n && pickNames.has(n.name) ? "pick" : ""}">${n ? esc(english(n.names) || title(n.name)) : "—"}</td>`;
      }).join("")}</tr>`).join("")}</tbody>`;
  }

  view.querySelectorAll(".role").forEach(btn => btn.addEventListener("click", () => {
    natureRole = { id: btn.dataset.role, auto: false };
    view.querySelectorAll(".role").forEach(x => { const on = x === btn; x.classList.toggle("active", on); x.setAttribute("aria-selected", on); });
    draw();
  }));
  document.getElementById("nature-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = document.getElementById("nature-input").value.trim().toLowerCase().replace(/^#?0*(?=\d)/, "").replace(/[.']/g, "").replace(/\s+/g, "-");
    location.hash = q ? `natures/${q}` : "natures";
  });
  draw();
}

/* ---------- Router & search ---------- */

function setTab(page) {
  document.querySelectorAll(".tabs a").forEach(a => {
    const tab = ["natures", "forms", "gimmicks", "tracker", "team", "tools"].includes(page) ? page : "explore";
    const on = a.dataset.tab === tab;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
}

async function route() {
  const [page, param, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
  window.scrollTo(0, 0);
  setTab(page);
  try {
    if (page === "region" && param) await renderRegion(param);
    else if (page === "pokemon" && param) await renderPokemon(param);
    else if (page === "natures") await renderNatures(param);
    else if (page === "forms") await renderRegionalForms(param);
    else if (page === "gimmicks") await renderGimmicks(param);
    else if (page === "tracker") await renderTracker(param);
    else if (page === "team") await renderTeam();
    else if (page === "tools") await renderTools(param, rest);
    else await renderRegions();
    view.focus({ preventScroll: true });
  } catch (err) {
    console.error(err);
    showError(err, param || "");
  }
}

document.getElementById("global-search").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("search-input");
  const q = input.value.trim().toLowerCase().replace(/^#?0*(?=\d)/, "").replace(/[.']/g, "").replace(/\s+/g, "-");
  if (q) location.hash = `pokemon/${q}`;
  input.value = "";
});

// Fill search suggestions with every species name (one lightweight request).
get("/pokemon-species?limit=2000").then(d => {
  document.getElementById("name-suggestions").innerHTML = d.results.map(s => `<option value="${s.name}">`).join("");
}).catch(() => {});

window.addEventListener("hashchange", route);
// Wait for every script (app.js, gimmicks.js) before the first render.
window.addEventListener("DOMContentLoaded", route);
