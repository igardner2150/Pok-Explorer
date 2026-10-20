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
const SPRITE = id => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
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

const STAT_LABEL = { hp:"HP", attack:"Attack", defense:"Defense", "special-attack":"Sp. Atk", "special-defense":"Sp. Def", speed:"Speed" };

/* ---------- Helpers ---------- */

const cache = new Map();
async function get(url) {
  if (!url.startsWith("http")) url = API + url;
  if (cache.has(url)) return cache.get(url);
  const promise = fetch(url).then(res => {
    if (!res.ok) throw new Error(res.status === 404 ? "not-found" : `PokéAPI returned ${res.status}`);
    return res.json();
  });
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
    : `Couldn't reach PokéAPI (${esc(err.message)}). Check your internet connection and refresh the page.`;
  view.innerHTML = `<div class="error"><p>${msg}</p><p><a href="#">Back to regions</a></p></div>`;
}

/* ---------- Layer 1: Regions ---------- */

async function renderRegions() {
  setCrumbs([{ label: "Regions" }]);
  view.innerHTML = `<p class="status">Loading regions…</p>`;
  const list = await get("/region?limit=50");
  const regions = await Promise.all(list.results.map(r => get(r.url)));

  view.innerHTML = `
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
  const mons = (await speciesForRegion(region)).sort((a, b) => a.id - b.id);

  view.innerHTML = `
    <h1>${esc(title(name))}</h1>
    <p class="lede">${region.main_generation
      ? `Pokémon that debuted in ${genLabel(region.main_generation.name)}.`
      : `Pokémon listed in the ${esc(title(region.pokedexes[0]?.name || name))} Pokédex.`} Select one for its full profile.</p>
    <div class="list-tools">
      <label class="visually-hidden" for="filter">Filter this region's Pokémon</label>
      <input id="filter" type="search" placeholder="Filter by name or number…" autocomplete="off">
      <span class="count" id="count">${mons.length} Pokémon</span>
    </div>
    <div class="mon-grid" id="mon-grid">
      ${mons.map(m => `
        <a class="mon-card" href="#pokemon/${m.name}" data-key="${m.name} ${m.id}">
          <img src="${SPRITE(m.id)}" alt="" loading="lazy" width="88" height="88">
          <span class="num">${pad(m.id)}</span>
          <span class="name">${esc(title(m.name))}</span>
        </a>`).join("")}
    </div>`;

  const filter = document.getElementById("filter");
  const cards = [...view.querySelectorAll(".mon-card")];
  filter.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase().replace(/^#?0*/, "");
    let shown = 0;
    cards.forEach(c => { const hit = !q || c.dataset.key.includes(q); c.hidden = !hit; if (hit) shown++; });
    document.getElementById("count").textContent = `${shown} of ${cards.length} Pokémon`;
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

async function renderPokemon(query) {
  setCrumbs([{ label: "Regions", href: "#" }, { label: "Loading…" }]);
  view.innerHTML = `<p class="status">Loading ${esc(query)}…</p>`;

  // Species holds the Pokédex data; its default variety holds stats, types and sprites.
  const species = await get(`/pokemon-species/${query}`);
  const defaultVariety = species.varieties.find(v => v.is_default) || species.varieties[0];
  const [mon, evo] = await Promise.all([
    get(defaultVariety.pokemon.url),
    species.evolution_chain ? get(species.evolution_chain.url) : null
  ]);

  const types = mon.types.map(t => t.type.name);
  const [matchups, abilities, encounters, otherForms] = await Promise.all([
    typeMatchups(types),
    Promise.all(mon.abilities.map(async a => {
      const ab = await get(a.ability.url);
      const text = english(ab.effect_entries, "short_effect")
        || [...ab.flavor_text_entries].reverse().find(f => f.language.name === "en")?.flavor_text || "";
      return { name: english(ab.names) || title(ab.name), hidden: a.is_hidden, text };
    })),
    get(`/pokemon/${mon.id}/encounters`).catch(() => []),
    Promise.all(species.varieties.filter(v => !v.is_default).slice(0, 10).map(v => get(v.pokemon.url).catch(() => null)))
  ]);

  const displayName = english(species.names) || title(species.name);
  const genus = english(species.genera, "genus") || "";
  const entries = species.flavor_text_entries.filter(f => f.language.name === "en");
  const entry = entries[entries.length - 1];
  const originRegion = GEN_REGION[species.generation.name];

  setCrumbs([
    { label: "Regions", href: "#" },
    originRegion ? { label: title(originRegion), href: `#region/${originRegion}` } : { label: genLabel(species.generation.name) },
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

  const art = mon.sprites.other?.["official-artwork"]?.front_default || mon.sprites.front_default;
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
          <h3>Other forms</h3>
          <div class="sprites">
            ${otherForms.filter(Boolean).map(f => {
              const src = f.sprites.other?.["official-artwork"]?.front_default || f.sprites.front_default;
              return src ? `<figure><img class="art" src="${src}" alt="${esc(title(f.name))}" loading="lazy"><figcaption>${esc(title(f.name))}</figcaption></figure>` : "";
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
    </div>`;

  if (cry) {
    const audio = new Audio(cry);
    audio.volume = 0.4;
    document.getElementById("cry").addEventListener("click", () => { audio.currentTime = 0; audio.play().catch(() => {}); });
  }
}

/* ---------- Router & search ---------- */

async function route() {
  const [page, param] = decodeURIComponent(location.hash.slice(1)).split("/");
  window.scrollTo(0, 0);
  try {
    if (page === "region" && param) await renderRegion(param);
    else if (page === "pokemon" && param) await renderPokemon(param);
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
route();
