/*
 * Poké Explorer — Team builder (#team), Tools (#tools/...), and home page extras.
 * Uses helpers from app.js, gimmicks.js and tracker.js.
 */

/* ---------- Shared type math ---------- */

let typeDataPromise;
// Damage relations for all 18 types (GET /type/{name}), loaded once.
function allTypeData() {
  typeDataPromise ||= Promise.all(ALL_TYPES.map(t => get(`/type/${t}`)))
    .then(list => Object.fromEntries(list.map(t => [t.name, t.damage_relations])));
  return typeDataPromise;
}

// Multiplier when a move of type `atk` hits a Pokémon with types `defTypes`.
function effectiveness(td, atk, defTypes) {
  const r = td[atk];
  return defTypes.reduce((m, d) =>
    m * (r.no_damage_to.some(x => x.name === d) ? 0 : r.double_damage_to.some(x => x.name === d) ? 2 : r.half_damage_to.some(x => x.name === d) ? 0.5 : 1), 1);
}

const multText = m => m === 0 ? "0" : m === 0.25 ? "¼" : m === 0.5 ? "½" : m === 1 ? "" : `${m}`;
const multClass = m => m === 0 ? "m0" : m < 1 ? (m === 0.25 ? "m025" : "m05") : m === 1 ? "m1" : m === 2 ? "m2" : "m4";

// Turns what people type ("Mr. Mime", "Farfetch'd", "Nidoran♀", "#025") into a PokéAPI id.
const cleanQuery = v => v.trim().toLowerCase().replace(/^#?0*(?=\d)/, "").replace(/[.':]/g, "")
  .replace(/♀/g, "-f").replace(/♂/g, "-m").replace(/é/g, "e").replace(/\s+/g, "-").replace(/-+/g, "-");

function monLabel(species, mon) {
  const isDefault = species.varieties.find(v => v.is_default)?.pokemon.name === mon.name;
  if (isDefault) return english(species.names) || title(species.name);
  return pokeName(mon.name);
}

const artOf = mon => mon.sprites.other?.["official-artwork"]?.front_default || mon.sprites.other?.home?.front_default || mon.sprites.front_default || "";

/* ---------- Team synergy score ---------- */

// Each member: { name, label, types: ["water", "ground"], stats: { hp, attack, … } } (base stats).
// Returns a score out of 100, a letter grade, five scored parts and plain-language tips.
const SYNERGY_PARTS = [["defense", "Defensive balance", 30], ["offense", "Offensive coverage", 25],
  ["roles", "Role mix", 20], ["speed", "Speed control", 15], ["variety", "Type variety", 10]];
const gradeFor = s => s >= 85 ? "A" : s >= 75 ? "B" : s >= 62 ? "C" : s >= 50 ? "D" : "F";
const article = w => (/^[aeiou]/i.test(w) ? "an" : "a");
const listTypes = (ts, joiner = "or") => ts.map(title).join(", ").replace(/, ([^,]*)$/, ` ${joiner} $1`);

function attackStyle(b) {
  if (b.attack > b["special-attack"] + 10) return "physical";
  if (b["special-attack"] > b.attack + 10) return "special";
  return "mixed";
}
const isBulky = b => ["physical-wall", "special-wall"].includes(suggestRole(b)) || b.hp + b.defense + b["special-defense"] >= 285;

function teamSynergy(members, td) {
  const n = members.length;
  const parts = {}, tips = [];
  if (!n) return { score: 0, grade: "F", parts: [], tips: [], size: 0 };

  // Defense: attacking types that hit several members super effectively with little backup.
  let penalty = 0;
  const problems = [];
  for (const atk of ALL_TYPES) {
    const mults = members.map(m => effectiveness(td, atk, m.types));
    const weak = mults.filter(x => x > 1).length, resist = mults.filter(x => x < 1).length;
    const quad = mults.filter(x => x >= 4).length;
    let p = weak >= 3 ? 6 + (weak - 3) * 2 : weak === 2 && resist === 0 ? 3 : 0;
    p += quad;
    const quadNames = members.filter((m, i) => mults[i] >= 4).map(m => m.label);
    if (p) { penalty += p; problems.push({ atk, weak, resist, p, quadNames, major: p > quad }); }
  }
  problems.sort((a, b) => b.p - a.p);
  parts.defense = Math.max(0, 30 - penalty);
  for (const pr of problems.slice(0, 2)) {
    const resisters = ALL_TYPES.filter(t => effectiveness(td, pr.atk, [t]) < 1);
    if (pr.major) tips.push(`${title(pr.atk)} hits ${pr.weak} of your Pokémon super effectively${pr.resist ? "" : " and nothing resists it"}. ${article(resisters[0]) === "an" ? "An" : "A"} ${listTypes(resisters.slice(0, 4))} type would help.`);
    else tips.push(`${pr.quadNames.join(" and ")} ${pr.quadNames.length > 1 ? "take" : "takes"} 4× damage from ${title(pr.atk)} moves, so keep ${article(pr.atk)} ${title(pr.atk)}-resistant switch-in ready.`);
  }

  // Offense: defending types at least one member's own type hits super effectively.
  const missed = ALL_TYPES.filter(def => !members.some(m => m.types.some(t => effectiveness(td, t, [def]) > 1)));
  parts.offense = Math.round(25 * (18 - missed.length) / 18);
  if (missed.length) {
    const fix = ALL_TYPES.filter(t => effectiveness(td, t, [missed[0]]) > 1);
    tips.push(`Nothing on your team hits ${listTypes(missed.slice(0, 3))}${missed.length > 3 ? ` (and ${missed.length - 3} more)` : ""} super effectively with its own type. For ${title(missed[0])}, try ${article(fix[0])} ${listTypes(fix)} type.`);
  }

  // Roles: physical and special attackers, something bulky, and not all one kind of attacker.
  const styles = members.map(m => attackStyle(m.stats));
  const phys = styles.filter(s => s !== "special").length, spec = styles.filter(s => s !== "physical").length;
  const bulky = members.filter(m => isBulky(m.stats)).length;
  parts.roles = (phys ? 6 : 0) + (spec ? 6 : 0) + (bulky ? 5 : 0) + (Math.abs(phys - spec) <= 2 ? 3 : 0);
  if (!spec) tips.push("Everyone attacks physically, so one Intimidate or burn slows your whole team. Add a special attacker.");
  else if (!phys) tips.push("Everyone attacks specially. Add a physical attacker so special walls can’t stop your whole team.");
  else if (Math.abs(phys - spec) > 2) tips.push(`Your attackers lean ${phys > spec ? "physical" : "special"}. Swapping one for the other kind makes you harder to wall.`);
  if (!bulky) tips.push("Nobody on the team is bulky. A defensive Pokémon gives you a safe switch-in.");

  // Speed: base Speed 100+ is fast, 80–99 is decent.
  const fast = members.filter(m => m.stats.speed >= 100).length, mid = members.filter(m => m.stats.speed >= 80 && m.stats.speed < 100).length;
  parts.speed = Math.min(15, fast * 6 + mid * 3);
  if (parts.speed < 12) tips.push(`${fast ? `Only ${fast}` : "None"} of your Pokémon ${fast === 1 ? "has" : "have"} base Speed 100 or more, so faster teams will usually move first.`);

  // Variety: the same type on several members stacks the same weaknesses.
  const counts = {};
  members.forEach(m => m.types.forEach(t => (counts[t] = (counts[t] || 0) + 1)));
  const repeats = Object.entries(counts).filter(([, c]) => c > 1);
  parts.variety = Math.max(0, 10 - repeats.reduce((s, [, c]) => s + (c - 1) * 3, 0));
  if (repeats.length) tips.push(`${listTypes(repeats.map(([t]) => t), "and")} ${repeats.length > 1 ? "each appear" : "appears"} on more than one Pokémon, which doubles up ${repeats.length > 1 ? "their" : "its"} weaknesses.`);

  // Each empty slot costs 4 points, so a partial team can't outscore a complete one.
  const emptyPenalty = (6 - Math.min(n, 6)) * 4;
  const score = Math.max(0, SYNERGY_PARTS.reduce((s, [k]) => s + parts[k], 0) - emptyPenalty);
  if (n < 6) tips.push(`You have ${n} of 6 Pokémon. Each empty slot costs 4 points; fill them to raise your score.`);
  return {
    score, grade: gradeFor(score), size: n, tips, emptyPenalty,
    parts: SYNERGY_PARTS.map(([key, label, max]) => ({ key, label, max, score: parts[key] }))
  };
}

// Well-rounded, fully evolved Pokémon to try in place of (or alongside) team members.
const SWAP_POOL = ["garchomp", "rotom-wash", "ferrothorn", "toxapex", "corviknight", "dragonite", "gengar", "scizor",
  "tyranitar", "gardevoir", "excadrill", "volcarona", "azumarill", "gyarados", "lucario", "togekiss", "metagross",
  "hippowdon", "blissey", "skarmory", "mimikyu", "greninja", "cinderace", "kingambit", "gholdengo", "dragapult",
  "clefable", "amoonguss", "slowbro", "weavile", "rillaboom", "primarina", "talonflame", "magnezone", "breloom", "mamoswine"];

// Best single changes: replace a member (full team) or add one (open slot). Returns up to `limit` suggestions.
function bestSwaps(members, pool, td, limit = 3) {
  const base = teamSynergy(members, td);
  const taken = new Set(members.map(m => m.name));
  const out = [];
  for (const c of pool) {
    if (taken.has(c.name)) continue;
    const options = members.length < 6
      ? [{ out: null, team: [...members, c] }]
      : members.map((m, i) => ({ out: m, slot: i, team: members.map((x, j) => (j === i ? c : x)) }));
    let best = null;
    for (const o of options) {
      const s = teamSynergy(o.team, td);
      if (!best || s.score > best.result.score) best = { ...o, result: s };
    }
    const gain = best.result.score - base.score;
    if (gain >= 2) {
      const why = best.result.parts.map((p, k) => ({ label: p.label, d: p.score - base.parts[k].score })).sort((a, b) => b.d - a.d)[0];
      out.push({ add: c, remove: best.out, slot: best.slot, from: base.score, to: best.result.score, gain, grade: best.result.grade, why: why.label });
    }
  }
  out.sort((a, b) => b.gain - a.gain || a.add.name.localeCompare(b.add.name));
  // Don't suggest replacing the same member three times; spread suggestions out when possible.
  const picked = [], seenOut = new Map();
  for (const s of out) {
    const key = s.remove ? s.remove.name : "+";
    if ((seenOut.get(key) || 0) >= 2) continue;
    seenOut.set(key, (seenOut.get(key) || 0) + 1);
    picked.push(s);
    if (picked.length === limit) break;
  }
  return picked;
}

// Fills open slots one at a time, each time adding the candidate that gives the highest score.
// Stops early if no candidate raises the score (for example when a game has few good picks left).
function autoComplete(members, pool, td) {
  const team = [...members], added = [];
  let current = teamSynergy(team, td).score;
  while (team.length < 6) {
    const taken = new Set(team.map(m => m.name));
    let best = null;
    for (const c of pool) {
      if (taken.has(c.name)) continue;
      const score = teamSynergy([...team, c], td).score;
      if (!best || score > best.score) best = { c, score };
    }
    if (!best || best.score <= current) break;
    team.push(best.c);
    added.push(best.c);
    current = best.score;
  }
  return { added, result: teamSynergy(team, td) };
}

// Reads a team from what people paste: a team link (…#team/a,b,c) or names separated by commas or new lines.
function parseTeamInput(text) {
  let v = String(text || "").trim();
  const link = v.match(/#team\/([^\s#]+)/);
  if (link) v = decodeURIComponent(link[1]);
  return v.split(/[,\n]+/).map(cleanQuery).filter(Boolean).slice(0, 6);
}

// Side-by-side comparison of two teams: synergy parts, who wins each, and STAB pressure on the other team.
function teamVersus(teamA, teamB, td) {
  const a = teamSynergy(teamA, td), b = teamSynergy(teamB, td);
  const parts = a.parts.map((p, i) => {
    const q = b.parts[i];
    return { key: p.key, label: p.label, max: p.max, a: p.score, b: q.score, winner: p.score > q.score ? "a" : q.score > p.score ? "b" : "tie" };
  });
  // How many of the other team's Pokémon at least one member can hit super effectively with its own type.
  const pressure = (atk, def) => def.filter(d => atk.some(m => m.types.some(t => effectiveness(td, t, d.types) > 1))).length;
  return {
    a, b, parts,
    winner: a.score > b.score ? "a" : b.score > a.score ? "b" : "tie",
    margin: Math.abs(a.score - b.score),
    categories: { a: parts.filter(p => p.winner === "a").length, b: parts.filter(p => p.winner === "b").length },
    pressure: { a: pressure(teamA, teamB), b: pressure(teamB, teamA) }
  };
}

function synergyPanel(result, shared) {
  const color = { A: "var(--good)", B: "var(--good)", C: "var(--gold)", D: "var(--accent)", F: "var(--accent)" }[result.grade];
  return `
    <section class="panel wide synergy" aria-labelledby="synergy-h">
      <div class="synergy-head">
        <div class="grade-badge" style="--grade:${color}" aria-label="Grade ${result.grade}"><span>${result.grade}</span></div>
        <div>
          <h2 id="synergy-h">Team synergy score</h2>
          <p class="synergy-total"><strong>${result.score}</strong> / 100${result.size < 6 ? ` <span class="muted">· ${result.size} of 6 Pokémon so far</span>` : ""}</p>
          <p class="muted">How well your six work together: shared weaknesses, coverage, roles, speed and variety.</p>
        </div>
      </div>
      <div class="synergy-grid">
        <div class="synergy-parts">
          ${result.parts.map(p => `
            <div class="synergy-part">
              <span>${p.label}</span><span class="val">${p.score} / ${p.max}</span>
              <div class="bar" role="img" aria-label="${p.label}: ${p.score} of ${p.max}"><span style="width:${Math.round(100 * p.score / p.max)}%;background:${p.score / p.max >= .75 ? "var(--good)" : p.score / p.max >= .5 ? "var(--gold)" : "var(--accent)"}"></span></div>
            </div>`).join("")}
          ${result.emptyPenalty ? `<div class="synergy-part penalty"><span>Empty slots (${6 - result.size})</span><span class="val">−${result.emptyPenalty}</span></div>` : ""}
        </div>
        <div>
          <h3>How to improve</h3>
          ${result.tips.length ? `<ul class="plain synergy-tips">${result.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p>No weak spots found. This team is well balanced.</p>`}
        </div>
      </div>
      <div id="synergy-swaps" class="synergy-swaps">
        <h3>Suggested swaps</h3>
        <p class="muted">Checking other Pokémon against your team…</p>
      </div>
    </section>`;
}

function swapsHtml(swaps, shared) {
  if (!swaps.length) return `<h3>Suggested swaps</h3><p class="muted">No single change from our suggestions raises your score. Nice team.</p>`;
  return `<h3>Suggested swaps</h3>
    <ul class="plain swap-list">${swaps.map((s, i) => `
      <li>
        <img src="${SPRITE(s.add.id)}" alt="" width="56" height="56" loading="lazy">
        <div>
          <strong>${s.remove ? `Swap ${esc(s.remove.label)} for ${esc(s.add.label)}` : `Add ${esc(s.add.label)}`}</strong>
          <span class="muted">${s.from} → ${s.to} (+${s.gain}, grade ${s.grade}) · biggest gain: ${esc(s.why.toLowerCase())}</span>
        </div>
        ${shared ? "" : `<button type="button" class="btn ghost" data-swap="${i}">Try it</button>`}
      </li>`).join("")}</ul>`;
}

/* ---------- Games for the team builder ---------- */

// [id, label, PokéAPI version groups]. A game's Pokémon are the ones in its regional Pokédexes (DLC included).
const TEAM_GAMES = [
  ["scarlet-violet", "Scarlet / Violet (with DLC)", ["scarlet-violet", "the-teal-mask", "the-indigo-disk"]],
  ["legends-arceus", "Legends: Arceus", ["legends-arceus"]],
  ["bdsp", "Brilliant Diamond / Shining Pearl", ["brilliant-diamond-and-shining-pearl"]],
  ["sword-shield", "Sword / Shield (with DLC)", ["sword-shield", "the-isle-of-armor", "the-crown-tundra"]],
  ["lets-go", "Let's Go, Pikachu! / Eevee!", ["lets-go-pikachu-lets-go-eevee"]],
  ["usum", "Ultra Sun / Ultra Moon", ["ultra-sun-ultra-moon"]],
  ["sun-moon", "Sun / Moon", ["sun-moon"]],
  ["oras", "Omega Ruby / Alpha Sapphire", ["omega-ruby-alpha-sapphire"]],
  ["x-y", "X / Y", ["x-y"]],
  ["b2w2", "Black 2 / White 2", ["black-2-white-2"]],
  ["black-white", "Black / White", ["black-white"]],
  ["hgss", "HeartGold / SoulSilver", ["heartgold-soulsilver"]],
  ["platinum", "Platinum", ["platinum"]],
  ["diamond-pearl", "Diamond / Pearl", ["diamond-pearl"]],
  ["emerald", "Emerald", ["emerald"]],
  ["frlg", "FireRed / LeafGreen", ["firered-leafgreen"]],
  ["ruby-sapphire", "Ruby / Sapphire", ["ruby-sapphire"]],
  ["crystal", "Crystal", ["crystal"]],
  ["gold-silver", "Gold / Silver", ["gold-silver"]],
  ["yellow", "Yellow", ["yellow"]],
  ["red-blue", "Red / Blue", ["red-blue"]]
];
const teamGameLabel = id => (TEAM_GAMES.find(g => g[0] === id) || [])[1] || "";

const TEAM_GAME_KEY = "pokeExplorerTeamGame";
function loadTeamGame() {
  try { const g = localStorage.getItem(TEAM_GAME_KEY) || ""; return TEAM_GAMES.some(x => x[0] === g) ? g : ""; } catch { return ""; }
}
function saveTeamGame(id) { try { if (id) localStorage.setItem(TEAM_GAME_KEY, id); else localStorage.removeItem(TEAM_GAME_KEY); } catch {} }

// Pokémon a game has outside its regional Pokédex. PokéAPI has little encounter data for the Switch games,
// so their post-game legendaries are listed here (Scarlet/Violet: Snacksworth in The Indigo Disk;
// Sword/Shield: Dynamax Adventures in The Crown Tundra; BDSP: Ramanas Park and other post-game encounters).
const GAME_EXTRAS = {
  "scarlet-violet": `articuno zapdos moltres raikou entei suicune lugia ho-oh latias latios kyogre groudon rayquaza
    cobalion terrakion virizion reshiram zekrom kyurem solgaleo lunala necrozma glastrier spectrier kubfu`,
  "sword-shield": `articuno zapdos moltres mewtwo raikou entei suicune lugia ho-oh latias latios kyogre groudon rayquaza
    uxie mesprit azelf dialga palkia heatran giratina cresselia tornadus thundurus reshiram zekrom landorus kyurem xerneas
    yveltal zygarde tapu-koko tapu-lele tapu-bulu tapu-fini solgaleo lunala nihilego buzzwole pheromosa xurkitree
    celesteela kartana guzzlord necrozma stakataka blacephalon`,
  "bdsp": `regirock regice registeel articuno zapdos moltres raikou entei suicune lugia ho-oh latias latios kyogre groudon
    rayquaza mewtwo giratina heatran regigigas cresselia`
};
const extrasFor = id => (GAME_EXTRAS[id] || "").split(/\s+/).filter(Boolean);
// Games where PokéAPI's encounter data (every place a Pokémon can be caught, by version) fills in the rest.
const ENCOUNTER_GAMES = new Set(["red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire", "emerald", "frlg",
  "diamond-pearl", "platinum", "hgss", "black-white", "b2w2", "x-y", "oras", "sun-moon", "usum"]);

// Species name for a Pokémon from an encounter list ("rattata-alola", id 10091 → "rattata").
function speciesOfPokemon(name, id, speciesById, speciesSlugs) {
  if (id <= 10000 && speciesById[id]) return speciesById[id];
  if (speciesSlugs.has(name)) return name;
  const parts = name.split("-");
  for (let i = parts.length - 1; i > 0; i--) { const base = parts.slice(0, i).join("-"); if (speciesSlugs.has(base)) return base; }
  return null;
}

// Every species found in these location areas in any of the given versions.
function encounterSpecies(areas, versions, speciesById, speciesSlugs) {
  const found = new Set();
  areas.forEach(a => a && a.pokemon_encounters.forEach(pe => {
    if (!pe.version_details.some(v => versions.has(v.version.name))) return;
    const sp = speciesOfPokemon(pe.pokemon.name, idFromUrl(pe.pokemon.url), speciesById, speciesSlugs);
    if (sp) found.add(sp);
  }));
  return found;
}

// Runs request functions a batch at a time, reporting progress.
async function inBatches(tasks, size, onProgress) {
  const out = [];
  for (let i = 0; i < tasks.length; i += size) {
    out.push(...await Promise.all(tasks.slice(i, i + size).map(t => t())));
    if (onProgress) onProgress(Math.min(i + size, tasks.length), tasks.length);
  }
  return out;
}

// Everything available in a game: its regional Pokédex sections, plus "extra" Pokémon from encounter data
// and the post-game lists above. The first visit to a game's encounter data takes a few hundred requests;
// after that every response comes from the cache.
const gameAvailCache = {};
const gameDexOnly = {};
function gameRegionalDex(id) {
  const game = TEAM_GAMES.find(g => g[0] === id);
  if (!game) return Promise.resolve(null);
  gameDexOnly[id] ||= (async () => {
    const vgs = (await Promise.all(game[2].map(vg => get(`/version-group/${vg}`).catch(() => null)))).filter(Boolean);
    const dexes = await Promise.all(vgs.flatMap(v => v.pokedexes.map(d => get(d.url).catch(() => null))));
    return { vgs, ...gameDexSections(dexes) };
  })();
  return gameDexOnly[id];
}
function gameAvailability(id, onProgress) {
  if (!TEAM_GAMES.some(g => g[0] === id)) return Promise.resolve(null);
  gameAvailCache[id] ||= (async () => {
    const { vgs, sections } = await gameRegionalDex(id);
    const inDex = new Set(sections.flatMap(s => s.mons.map(m => m.name)));
    const found = new Set(extrasFor(id));
    if (ENCOUNTER_GAMES.has(id)) {
      const versions = new Set(vgs.flatMap(v => v.versions.map(x => x.name)));
      const regions = (await Promise.all([...new Set(vgs.flatMap(v => v.regions.map(r => r.url)))].map(u => get(u).catch(() => null)))).filter(Boolean);
      const locations = await inBatches(regions.flatMap(r => r.locations).map(l => () => get(l.url).catch(() => null)), 25,
        (n, t) => onProgress && onProgress(`Checking locations… ${n} of ${t}`));
      const areas = await inBatches(locations.filter(Boolean).flatMap(l => l.areas).map(a => () => get(a.url).catch(() => null)), 25,
        (n, t) => onProgress && onProgress(`Checking where Pokémon appear… ${n} of ${t}`));
      encounterSpecies(areas, versions, SPECIES_BY_ID, SPECIES_SLUGS).forEach(n => found.add(n));
    }
    const idOf = new Map(Object.entries(SPECIES_BY_ID).map(([i, n]) => [n, Number(i)]));
    const extra = [...found].filter(n => !inDex.has(n) && idOf.has(n)).map(n => ({ name: n, id: idOf.get(n), num: idOf.get(n) }))
      .sort((a, b) => a.id - b.id);
    return { sections, extra, total: inDex.size + extra.length };
  })();
  return gameAvailCache[id];
}

// Species names available in a game (Pokédex plus extras), or null for "any game".
async function gameSpecies(id) {
  const avail = await gameAvailability(id);
  if (!avail) return null;
  const names = new Set([...avail.sections.flatMap(s => s.mons.map(m => m.name)), ...avail.extra.map(m => m.name)]);
  return names.size ? names : null;
}

// Is this Pokémon id (a species, or a form like "ninetales-alola") allowed by the game's species list?
function allowedInGame(slug, species) {
  if (!species) return true;
  if (species.has(slug)) return true;
  const parts = slug.split("-");
  for (let i = parts.length - 1; i > 0; i--) if (species.has(parts.slice(0, i).join("-"))) return true;
  return false;
}

// Fully evolved, battle-ready Pokémon from every generation. With a game picked, swap and
// auto-complete suggestions come from the ones in that game's Pokédex.
const GAME_POOL = `venusaur charizard blastoise pidgeot raichu sandslash nidoqueen nidoking clefable ninetales arcanine poliwrath
  alakazam machamp victreebel tentacruel golem slowbro magneton dewgong cloyster gengar exeggutor marowak hitmonlee hitmonchan
  rhydon chansey kangaskhan starmie scyther jynx pinsir tauros gyarados lapras vaporeon jolteon flareon omastar kabutops
  aerodactyl snorlax dragonite meganium typhlosion feraligatr ampharos azumarill politoed espeon umbreon slowking forretress
  steelix scizor heracross ursaring skarmory houndoom kingdra donphan porygon2 blissey crobat lanturn quagsire tyranitar
  sceptile blaziken swampert ludicolo shiftry pelipper gardevoir breloom hariyama aggron medicham manectric sharpedo camerupt
  torkoal flygon altaria zangoose seviper whiscash crawdaunt claydol cradily armaldo milotic banette absol glalie walrein
  salamence metagross torterra infernape empoleon staraptor luxray roserade floatzel gastrodon drifblim mismagius honchkrow
  bronzong spiritomb garchomp lucario hippowdon drapion toxicroak abomasnow weavile magnezone rhyperior tangrowth electivire
  magmortar togekiss yanmega leafeon glaceon gliscor mamoswine porygon-z gallade dusknoir froslass rotom serperior emboar
  samurott excadrill conkeldurr seismitoad scolipede whimsicott lilligant krookodile darmanitan crustle scrafty cofagrigus
  zoroark reuniclus vanilluxe escavalier amoonguss jellicent galvantula ferrothorn eelektross chandelure haxorus beartic
  mienshao golurk bisharp braviary mandibuzz hydreigon volcarona chesnaught delphox greninja talonflame pyroar florges
  pangoro aegislash-shield malamar barbaracle dragalge clawitzer tyrantrum aurorus sylveon hawlucha goodra klefki trevenant
  avalugg noivern decidueye incineroar primarina toucannon vikavolt ribombee lycanroc-midday toxapex mudsdale araquanid
  lurantis salazzle bewear tsareena golisopod palossand mimikyu-disguised drampa kommo-o rillaboom cinderace inteleon
  corviknight orbeetle eldegoss drednaw boltund coalossal flapple appletun sandaconda barraskewda toxtricity-amped
  centiskorch grapploct polteageist hatterene grimmsnarl obstagoon sirfetchd runerigus frosmoth copperajah duraludon
  dragapult meowscarada skeledirge quaquaval lokix pawmot garganacl armarouge ceruledge bellibolt kilowattrel mabosstiff
  brambleghast toedscruel scovillain espathra tinkaton palafin-zero revavroom glimmora houndstone cetitan dondozo
  annihilape clodsire farigiraf kingambit baxcalibur gholdengo wyrdeer kleavor ursaluna sneasler overqwil sinistcha
  archaludon hydrapple`.split(/\s+/).filter(Boolean);
// PokéAPI Pokémon id → species name ("aegislash-shield" → "aegislash").
const poolSpecies = slug => slug.replace(/-(shield|midday|disguised|amped|zero)$/, "");

// The candidates for swaps and auto-complete: the 36 popular picks for any game, or the game's own Pokémon.
async function swapPoolFor(species) {
  const names = species ? GAME_POOL.filter(n => species.has(poolSpecies(n))) : SWAP_POOL;
  const mons = [];
  for (let i = 0; i < names.length; i += 25) {   // in batches, to go easy on PokéAPI
    mons.push(...await Promise.all(names.slice(i, i + 25).map(n => get(`/pokemon/${n}`).catch(() => null))));
  }
  return mons.filter(Boolean).map(mon => ({ name: mon.name, label: pokeName(mon.name), types: mon.types.map(t => t.type.name), stats: baseStats(mon), id: mon.id }));
}

/* ---------- Games: every Pokémon in a game (#games, #games/scarlet-violet) ---------- */

// Turns PokéAPI Pokédex responses into sections of { name, id, num } in Pokédex order.
// Empty Pokédexes are dropped; `total` counts each species once even if it's in several sections.
function gameDexSections(dexes) {
  const sections = dexes.filter(d => d && d.pokemon_entries.length).map(d => ({
    key: d.name,
    label: english(d.names) || title(d.name),
    mons: d.pokemon_entries.map(e => ({ name: e.pokemon_species.name, id: idFromUrl(e.pokemon_species.url), num: e.entry_number }))
      .sort((a, b) => a.num - b.num)
  }));
  const total = new Set(sections.flatMap(s => s.mons.map(m => m.name))).size;
  return { sections, total };
}

async function renderGames(gameId) {
  const game = TEAM_GAMES.find(g => g[0] === gameId);
  if (!game) {
    setCrumbs([{ label: "Pokédex", href: "#" }, { label: "Games" }]);
    view.innerHTML = `
      <h1>Games</h1>
      <p class="lede">Pick a game to see every Pokémon in its Pokédex.</p>
      <div class="game-grid">
        ${TEAM_GAMES.map(([id, label]) => `<a class="game-card" href="#games/${id}"><span>${esc(label)}</span></a>`).join("")}
      </div>`;
    return;
  }

  const [id, label] = game;
  setCrumbs([{ label: "Pokédex", href: "#" }, { label: "Games", href: "#games" }, { label }]);
  view.innerHTML = `<h1>${esc(label)}</h1>${loadingBlock("Loading this game's Pokédex…")}`;
  const regional = await gameRegionalDex(id);
  if (!regional.sections.length) {
    view.innerHTML = `<h1>${esc(label)}</h1><p class="lede">PokéAPI doesn't have a Pokédex for this game yet.</p><p><a class="text-link" href="#games">All games</a></p>`;
    return;
  }
  // The regional Pokédexes show right away; "Also catchable" (legendaries, post-game and other Pokémon
  // outside the regional Pokédex) fills in once the encounter data has loaded.
  const hasExtra = ENCOUNTER_GAMES.has(id) || extrasFor(id).length > 0;
  const sections = [...regional.sections];
  const extraSection = { key: "extra", label: "Also catchable", mons: [], loading: "Checking post-game and legendary Pokémon…" };
  if (hasExtra) sections.push(extraSection);
  const dexNames = regional.sections.map(s => s.label);
  const dexText = `the ${dexNames.join(", ").replace(/, ([^,]*)$/, " and $1")} Pokédex${dexNames.length > 1 ? "es" : ""}`;
  const lede = (total, extra) => extra
    ? `${total} Pokémon you can catch: ${dexText}, plus ${extra} more such as legendaries and post-game Pokémon.`
    : `${total} Pokémon in ${dexText}.`;

  view.innerHTML = `
    <div class="page-head game-head">
      <div>
        <h1>${esc(label)}</h1>
        <p class="lede" id="g-lede">${lede(regional.total, 0)}</p>
      </div>
      <div class="page-actions"><button type="button" class="btn ghost" id="game-team">Build a team for this game</button></div>
    </div>
    ${sections.length > 1 ? `
      <div class="sub-tabs" role="tablist" aria-label="Pokédex">
        ${sections.map((s, i) => `<button type="button" role="tab" class="sub-tab ${i ? "" : "active"}" aria-selected="${!i}" data-dex="${i}">${esc(s.label)} <span data-dex-count="${i}">${s.loading ? "" : `(${s.mons.length})`}</span></button>`).join("")}
      </div>` : ""}
    <div class="list-tools region-tools">
      <div class="field grow"><label for="g-filter">Search</label>
        <input id="g-filter" type="search" placeholder="Name or number…" autocomplete="off"></div>
      <div class="field"><label for="g-type">Type</label>
        <select id="g-type"><option value="">Any type</option>${ALL_TYPES.map(t => `<option value="${t}">${title(t)}</option>`).join("")}</select></div>
      <div class="field"><label for="g-show">Show</label>
        <select id="g-show"><option value="all">All</option><option value="caught">Caught</option><option value="missing">Not caught</option><option value="shiny">Shiny</option></select></div>
    </div>
    <div class="count-row"><p class="count" id="g-count" aria-live="polite"></p>${clearFiltersBtn()}</div>
    <div class="mon-grid" id="g-grid"></div>`;

  document.getElementById("game-team").addEventListener("click", () => { saveTeamGame(id); location.hash = "team"; });
  const $ = el => document.getElementById(el);
  const typeSets = new Map();
  let current = 0, drawId = 0;

  async function draw() {
    const run = ++drawId;
    const q = normalizeText($("g-filter").value.replace(/^#?0*/, ""));
    const type = $("g-type").value, show = $("g-show").value;
    const section = sections[current];
    if (section.loading) {
      $("g-count").textContent = "";
      $("g-grid").innerHTML = `<p class="status" role="status">${esc(section.loading)}</p>`;
      return;
    }
    let list = section.mons;
    if (type) {
      if (!typeSets.has(type)) typeSets.set(type, new Set((await get(`/type/${type}`)).pokemon.map(p => idFromUrl(p.pokemon.url))));
      if (run !== drawId) return;   // a newer draw started while this one waited
      list = list.filter(m => typeSets.get(type).has(m.id));
    }
    if (q) list = list.filter(m => normalizeText(pokeName(m.name)).includes(q) || String(m.num).startsWith(q) || String(m.id).startsWith(q));
    if (show === "caught") list = list.filter(m => tracker.caught.has(m.id));
    if (show === "missing") list = list.filter(m => !tracker.caught.has(m.id));
    if (show === "shiny") list = list.filter(m => tracker.shiny.has(m.id));
    const all = sections[current].mons.length;
    $("g-count").textContent = list.length === all ? `${all} Pokémon` : `${list.length} of ${all} Pokémon`;
    $("g-grid").innerHTML = list.map(m => `
      <a class="mon-card" href="#pokemon/${m.name}">
        ${spriteImg(m.id)}
        <span class="num">${section.key === "extra" ? pad(m.id) : `#${String(m.num).padStart(3, "0")}`}</span>
        <span class="name">${esc(pokeName(m.name))}</span>
        ${trackBadges(m.id)}
      </a>`).join("") || `<p class="muted empty-note">No Pokémon match these filters.</p>`;
  }

  $("g-filter").addEventListener("input", draw);
  ["g-type", "g-show"].forEach(f => $(f).addEventListener("change", draw));
  view.querySelectorAll("[data-dex]").forEach(btn => btn.addEventListener("click", () => {
    view.querySelectorAll("[data-dex]").forEach(b => { const on = b === btn; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    current = Number(btn.dataset.dex);
    draw();
  }));
  keepFilters(`game-${id}`, ["g-filter", "g-type", "g-show"], { clearBtn: $("clear-filters"), onClear: draw });
  draw();

  if (!hasExtra) return;
  const extraIndex = sections.length - 1;
  const avail = await gameAvailability(id, msg => {
    extraSection.loading = msg;
    if (current === extraIndex && document.getElementById("g-grid")) draw();
  }).catch(() => null);
  if (!document.getElementById("g-grid")) return;   // the visitor already left the page
  extraSection.loading = null;
  extraSection.mons = avail ? avail.extra : [];
  const countEl = view.querySelector(`[data-dex-count="${extraIndex}"]`);
  if (!extraSection.mons.length) {
    view.querySelector(`[data-dex="${extraIndex}"]`)?.remove();
    if (current === extraIndex) current = 0;
  } else if (countEl) countEl.textContent = `(${extraSection.mons.length})`;
  if (avail) document.getElementById("g-lede").textContent = lede(avail.total, avail.extra.length);
  draw();
}

/* ---------- Team builder ---------- */

const TEAM_KEY = "pokeExplorerTeam";
function loadTeam() {
  try { const t = JSON.parse(localStorage.getItem(TEAM_KEY)); if (Array.isArray(t)) return [...t, "", "", "", "", "", ""].slice(0, 6); } catch {}
  return ["", "", "", "", "", ""];
}
function saveTeam(team) { try { localStorage.setItem(TEAM_KEY, JSON.stringify(team)); } catch {} }

// A shared team arrives as #team/garchomp,rotom-wash,… and is shown without touching the viewer's own saved team.
async function renderTeam(shared, sharedGame) {
  setCrumbs([{ label: "Battle", href: "#gimmicks" }, { label: shared ? "Shared team" : "Team builder" }]);
  const sharedList = shared ? shared.split(",").map(cleanQuery).filter(Boolean).slice(0, 6) : null;
  const team = sharedList ? [...sharedList, "", "", "", "", "", ""].slice(0, 6) : loadTeam();
  const filledNames = team.filter(Boolean);
  const game = sharedList ? (TEAM_GAMES.some(g => g[0] === sharedGame) ? sharedGame : "") : loadTeamGame();
  const gameLabel = teamGameLabel(game);
  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${sharedList ? "Shared team" : "Team builder"}</h1>
        <p class="lede">${sharedList
          ? "Someone shared this team. Save it to edit it."
          : "Pick up to six Pokémon to see your grade, weak spots and suggested swaps."}</p>
      </div>
      <div class="page-actions">
        ${sharedList ? `<button type="button" class="btn" id="team-save">Save as my team</button>` : ""}
        ${filledNames.length ? `<button type="button" class="btn ghost" id="team-share">Share this team</button>
          <a class="btn ghost" href="#teamvs/${filledNames.map(encodeURIComponent).join(",")}/">Compare with another team</a>` : ""}
      </div>
    </div>
    ${sharedList ? "" : hintBox("team")}
    ${sharedList
      ? (game ? `<p class="team-game-note">Built for <strong>${esc(gameLabel)}</strong></p>` : "")
      : `<div class="team-game">
          <label for="team-game">Building for</label>
          <select id="team-game">
            <option value="">Any game</option>
            ${TEAM_GAMES.map(([id, label]) => `<option value="${id}" ${id === game ? "selected" : ""}>${esc(label)}</option>`).join("")}
          </select>
          <span class="muted small" id="team-game-note">${game ? "Loading this game's Pokémon…" : "Pick a game to only use Pokémon from it."}</span>
        </div>`}
    <div class="share-box" id="share-box" hidden>
      <label for="share-link">Link to this team</label>
      <div class="share-row"><input id="share-link" type="text" readonly><button type="button" class="btn" id="share-copy">Copy</button></div>
      <p class="muted small" id="share-note">Anyone with this link sees the same six Pokémon.</p>
    </div>
    <div class="team-slots" id="team-slots">${team.map((_, i) => `<div class="team-slot skeleton-slot" data-slot="${i}"></div>`).join("")}</div>
    <div id="team-analysis"></div>`;

  const saveBtn = document.getElementById("team-save");
  if (saveBtn) saveBtn.addEventListener("click", () => { saveTeam(team); location.hash = "team"; });
  const shareBtn = document.getElementById("team-share");
  if (shareBtn) shareBtn.addEventListener("click", () => {
    const link = `${location.origin}${location.pathname}#team/${filledNames.join(",")}${game ? `/${game}` : ""}`;
    const box = document.getElementById("share-box"), input = document.getElementById("share-link");
    box.hidden = false;
    input.value = link;
    input.focus();
    input.select();
  });
  const copyBtn = document.getElementById("share-copy");
  copyBtn.addEventListener("click", async () => {
    const input = document.getElementById("share-link");
    try { await navigator.clipboard.writeText(input.value); document.getElementById("share-note").textContent = "Copied! Paste it anywhere to share."; }
    catch { input.select(); document.getElementById("share-note").textContent = "Press Ctrl+C (or ⌘C) to copy the selected link."; }
  });

  const gameSelect = document.getElementById("team-game");
  if (gameSelect) gameSelect.addEventListener("change", () => { saveTeamGame(gameSelect.value); renderTeam(); });

  const [td, allowed] = await Promise.all([allTypeData(), gameSpecies(game)]);
  const gameNote = document.getElementById("team-game-note");
  if (gameNote && game) gameNote.textContent = "Only Pokémon you can catch in this game can be added or suggested.";
  const members = await Promise.all(team.map(async name => {
    if (!name) return null;
    try {
      const { species, mon } = await loadSpeciesAndMon(name);
      return { name, species, mon, types: mon.types.map(t => t.type.name), notInGame: !!allowed && !allowed.has(species.name) };
    } catch { return { name, error: true }; }
  }));

  const slotsEl = document.getElementById("team-slots");
  slotsEl.innerHTML = members.map((m, i) => {
    if (!m && sharedList) return `<div class="team-slot empty" data-slot="${i}"><span class="slot-num">Slot ${i + 1}</span><p class="muted">Empty</p></div>`;
    if (!m) return `
      <form class="team-slot empty" data-slot="${i}">
        <span class="slot-num">Slot ${i + 1}</span>
        <label class="visually-hidden" for="slot-${i}">Pokémon for slot ${i + 1}</label>
        <input id="slot-${i}" type="search" list="name-suggestions" placeholder="Add a Pokémon" autocomplete="off">
        <button type="submit">Add</button>
        <p class="slot-error" role="alert" hidden></p>
      </form>`;
    if (m.error) return `
      <div class="team-slot" data-slot="${i}">
        <span class="slot-num">Slot ${i + 1}</span>
        <p class="muted">Couldn't find “${esc(m.name)}”.</p>
        <button type="button" class="remove" data-remove="${i}">Remove</button>
      </div>`;
    return `
      <div class="team-slot filled" data-slot="${i}">
        <span class="slot-num">Slot ${i + 1}</span>
        <img src="${artOf(m.mon)}" alt="">
        <a href="#pokemon/${m.mon.name}"><strong>${esc(monLabel(m.species, m.mon))}</strong></a>
        <div class="types">${m.types.map(t => typeBadge(t)).join("")}</div>
        ${m.notInGame ? `<p class="slot-warn">Not in ${esc(gameLabel)}</p>` : ""}
        ${sharedList ? "" : `<button type="button" class="remove" data-remove="${i}">Remove</button>`}
      </div>`;
  }).join("");

  slotsEl.querySelectorAll("form.team-slot").forEach(form => {
    const input = form.querySelector("input"), error = form.querySelector(".slot-error");
    // The suggestion list only offers Pokémon from the chosen game.
    if (allowed) input.searchFilter = r => allowedInGame(r.slug, allowed);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const v = cleanQuery(input.value);
      if (!v) return;
      if (allowed) {
        let species = null;
        try { species = (await loadSpeciesAndMon(v)).species; } catch {}
        if (species && !allowed.has(species.name)) {
          error.textContent = `${pokeName(species.name)} isn't in ${gameLabel}.`;
          error.hidden = false;
          return;
        }
      }
      team[Number(form.dataset.slot)] = v;
      saveTeam(team);
      renderTeam();
    });
    input.addEventListener("input", () => { error.hidden = true; });
  });
  slotsEl.querySelectorAll("[data-remove]").forEach(btn => btn.addEventListener("click", () => {
    team[Number(btn.dataset.remove)] = "";
    saveTeam(team);
    renderTeam();
  }));

  const filled = members.filter(m => m && !m.error);
  const out = document.getElementById("team-analysis");
  if (!filled.length) { out.innerHTML = `<p class="muted">Add a Pokémon to see your team's weaknesses and coverage.</p>`; return; }

  // Defense: every attacking type vs every member.
  const rows = ALL_TYPES.map(atk => {
    const mults = filled.map(m => effectiveness(td, atk, m.types));
    const weak = mults.filter(x => x > 1).length, resist = mults.filter(x => x < 1).length;
    return { atk, mults, weak, resist, threat: weak >= 3 || (weak >= 2 && resist === 0) };
  });
  // Offense: best STAB hit from the team against each single defending type.
  const offense = ALL_TYPES.map(def => {
    const best = Math.max(...filled.flatMap(m => m.types.map(t => effectiveness(td, t, [def]))));
    const hitters = filled.filter(m => m.types.some(t => effectiveness(td, t, [def]) > 1));
    return { def, best, hitters };
  });

  const synergyTeam = members.map((m, i) => m && !m.error
    ? { name: m.mon.name, label: monLabel(m.species, m.mon), types: m.types, stats: baseStats(m.mon), id: m.mon.id, slot: i }
    : null).filter(Boolean);
  const synergy = teamSynergy(synergyTeam, td);

  out.innerHTML = `
    <div class="sections">
      ${synergyPanel(synergy, !!sharedList)}
      <details class="panel wide more-charts">
        <summary>Show detailed charts <span class="muted">(every type against every team member)</span></summary>
      <section class="chart-block">
        <h2>Defensive chart</h2>
        <p class="muted">How much damage each attacking type does to each team member. Red is bad, green is good.</p>
        <div class="table-wrap"><table class="matchup-table">
          <thead><tr><th>Attack type</th>${filled.map(m => `<th><img src="${SPRITE(m.mon.id)}" onerror="nextSprite(this)" data-alts="${HOME_ART(m.mon.id)}" alt="${esc(monLabel(m.species, m.mon))}" title="${esc(monLabel(m.species, m.mon))}"></th>`).join("")}<th>Weak</th><th>Resist</th></tr></thead>
          <tbody>${rows.map(r => `<tr class="${r.threat ? "threat" : ""}">
            <td>${typeBadge(r.atk)}</td>
            ${r.mults.map(x => `<td class="${multClass(x)}">${multText(x) ? "×" + multText(x) : ""}</td>`).join("")}
            <td class="num ${r.weak >= 3 ? "bad" : ""}">${r.weak}</td><td class="num">${r.resist}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>

      <section class="chart-block">
        <h2>Offensive coverage (STAB)</h2>
        <p class="muted">For each defending type, which of your Pokémon can hit it super effectively with a move of its own type.</p>
        <div class="table-wrap"><table class="data-table wrap">
          <thead><tr><th>Defending type</th><th>Best</th><th>Who hits it super effectively</th></tr></thead>
          <tbody>${offense.map(o => `<tr><td>${typeBadge(o.def)}</td><td class="${o.best > 1 ? "good-cell" : o.best < 1 ? "m2" : ""}">×${multText(o.best) || "1"}</td>
            <td>${o.hitters.length ? o.hitters.map(m => esc(monLabel(m.species, m.mon))).join(", ") : '<span class="muted">Nobody</span>'}</td></tr>`).join("")}</tbody>
        </table></div>
      </section>
      </details>
    </div>`;

  // Swap suggestions need the candidates' stats and types; they load after the grade is on screen.
  const pool = await swapPoolFor(allowed);
  const box = document.getElementById("synergy-swaps");
  if (!box) return;   // the visitor already left the page
  const swaps = bestSwaps(synergyTeam, pool, td);
  const open = 6 - synergyTeam.length;
  const fill = !sharedList && open > 0 && pool.length ? autoComplete(synergyTeam, pool, td) : null;
  box.innerHTML = (fill && fill.added.length && fill.result.score > synergy.score ? `
    <div class="autofill">
      <div>
        <h3>Auto-complete my team</h3>
        <p>${fill.added.length === open ? `Fill the ${open} empty slot${open > 1 ? "s" : ""} with` : "Add"} ${fill.added.map(c => esc(c.label)).join(", ")}: score ${synergy.score} → ${fill.result.score} (grade ${fill.result.grade}).</p>
      </div>
      <button type="button" class="btn" id="autofill-btn">Auto-complete</button>
    </div>` : "") + swapsHtml(swaps, !!sharedList);
  const fillBtn = document.getElementById("autofill-btn");
  if (fillBtn) fillBtn.addEventListener("click", () => {
    const names = fill.added.map(c => c.name);
    team.forEach((x, i) => { if (!x && names.length) team[i] = names.shift(); });
    saveTeam(team);
    renderTeam();
  });
  box.querySelectorAll("[data-swap]").forEach(btn => btn.addEventListener("click", () => {
    const s = swaps[Number(btn.dataset.swap)];
    const slot = s.remove ? s.remove.slot : team.findIndex(x => !x);
    if (slot < 0) return;
    team[slot] = s.add.name;
    saveTeam(team);
    renderTeam();
  }));
}

/* ---------- Compare two teams (#teamvs/a,b,c/d,e,f) ---------- */

async function renderTeamCompare(aParam = "", bParam = "") {
  setCrumbs([{ label: "Battle", href: "#gimmicks" }, { label: "Team builder", href: "#team" }, { label: "Compare teams" }]);
  const mine = loadTeam().filter(Boolean);
  const listA = aParam ? parseTeamInput(aParam) : mine;
  const listB = parseTeamInput(bParam);
  const pretty = list => list.map(pokeName).join(", ");

  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Compare teams</h1>
        <p class="lede">See which of two teams works together better. Paste a team link or type names.</p>
      </div>
    </div>
    <form class="panel vs-form" id="vs-form">
      <div class="field"><label for="vs-a">Team A</label>
        <input id="vs-a" type="text" value="${esc(pretty(listA))}" placeholder="garchomp, rotom-wash, ferrothorn…" autocomplete="off"></div>
      <div class="field"><label for="vs-b">Team B</label>
        <input id="vs-b" type="text" value="${esc(pretty(listB))}" placeholder="Paste a team link or type names" autocomplete="off"></div>
      <div class="vs-actions">
        <button type="submit" class="btn">Compare</button>
        ${mine.length ? `<button type="button" class="btn ghost" id="vs-mine">Use my team as A</button>` : ""}
        <button type="button" class="btn ghost" id="vs-swap">Swap sides</button>
      </div>
    </form>
    <div id="vs-out">${listA.length && listB.length ? loadingBlock("Comparing teams…") : `<p class="muted">Enter both teams to compare them.</p>`}</div>`;

  const go = (a, b) => { location.hash = `teamvs/${a.map(encodeURIComponent).join(",")}/${b.map(encodeURIComponent).join(",")}`; };
  const read = id => parseTeamInput(document.getElementById(id).value);
  document.getElementById("vs-form").addEventListener("submit", e => { e.preventDefault(); go(read("vs-a"), read("vs-b")); });
  document.getElementById("vs-swap").addEventListener("click", () => go(read("vs-b"), read("vs-a")));
  const mineBtn = document.getElementById("vs-mine");
  if (mineBtn) mineBtn.addEventListener("click", () => go(mine, read("vs-b")));
  if (!listA.length || !listB.length) return;

  const td = await allTypeData();
  const load = list => Promise.all(list.map(async name => {
    try {
      const { species, mon } = await loadSpeciesAndMon(name);
      return { name: mon.name, label: monLabel(species, mon), types: mon.types.map(t => t.type.name), stats: baseStats(mon), id: mon.id };
    } catch { return { missing: name }; }
  }));
  const [rawA, rawB] = await Promise.all([load(listA), load(listB)]);
  const out = document.getElementById("vs-out");
  if (!out) return;
  const missing = [...rawA, ...rawB].filter(m => m.missing).map(m => m.missing);
  const teamA = rawA.filter(m => !m.missing), teamB = rawB.filter(m => !m.missing);
  if (!teamA.length || !teamB.length) { out.innerHTML = `<p class="muted">Couldn't find enough Pokémon to compare. Check the spelling and try again.</p>`; return; }

  const v = teamVersus(teamA, teamB, td);
  const side = (key, team, r) => `
    <div class="vs-side ${v.winner === key ? "win" : ""}">
      <p class="vs-label">Team ${key.toUpperCase()}${v.winner === key ? ' <span class="win-chip">Winner</span>' : ""}</p>
      <div class="vs-mons">${team.map(m => `<a href="#pokemon/${m.name}" title="${esc(m.label)}"><img src="${SPRITE(m.id)}" alt="${esc(m.label)}" width="64" height="64" loading="lazy"></a>`).join("")}</div>
      <p class="vs-score"><span class="vs-grade">${r.grade}</span> <strong>${r.score}</strong> / 100${r.size < 6 ? ` <span class="muted">(${r.size} Pokémon)</span>` : ""}</p>
    </div>`;
  const verdict = v.winner === "tie"
    ? `It's a tie at ${v.a.score} points.`
    : `Team ${v.winner.toUpperCase()} wins by ${v.margin} point${v.margin === 1 ? "" : "s"} and takes ${v.categories[v.winner]} of 5 categories.`;
  const shareUrl = `${location.origin}${location.pathname}#teamvs/${teamA.map(m => m.name).join(",")}/${teamB.map(m => m.name).join(",")}`;

  out.innerHTML = `
    ${missing.length ? `<p class="note muted">Couldn't find: ${missing.map(esc).join(", ")}. Compared the rest.</p>` : ""}
    <section class="panel vs-panel">
      <div class="vs-head">${side("a", teamA, v.a)}<p class="vs-vs" aria-hidden="true">vs</p>${side("b", teamB, v.b)}</div>
      <p class="vs-verdict">${verdict}</p>
      <div class="table-wrap"><table class="data-table vs-table">
        <thead><tr><th>Category</th><th class="num">Team A</th><th class="num">Team B</th><th class="hide-sm">Better</th></tr></thead>
        <tbody>
          ${v.parts.map(p => `<tr><td>${p.label} <span class="muted hide-sm">(out of ${p.max})</span></td>
            <td class="num ${p.winner === "a" ? "good-cell" : ""}">${p.a}</td><td class="num ${p.winner === "b" ? "good-cell" : ""}">${p.b}</td>
            <td class="hide-sm">${p.winner === "tie" ? '<span class="muted">Tie</span>' : `Team ${p.winner.toUpperCase()}`}</td></tr>`).join("")}
          ${v.a.emptyPenalty || v.b.emptyPenalty ? `<tr><td>Empty slots</td><td class="num">${v.a.emptyPenalty ? "−" + v.a.emptyPenalty : "0"}</td>
            <td class="num">${v.b.emptyPenalty ? "−" + v.b.emptyPenalty : "0"}</td><td class="hide-sm"></td></tr>` : ""}
          <tr class="vs-total"><td><strong>Total</strong></td><td class="num"><strong>${v.a.score}</strong></td><td class="num"><strong>${v.b.score}</strong></td>
            <td class="hide-sm">${v.winner === "tie" ? "Tie" : `Team ${v.winner.toUpperCase()}`}</td></tr>
        </tbody>
      </table></div>
      <h3>Head-to-head type pressure</h3>
      <p>Team A’s own-type moves hit <strong>${v.pressure.a} of ${teamB.length}</strong> of Team B’s Pokémon super effectively.
         Team B’s hit <strong>${v.pressure.b} of ${teamA.length}</strong> of Team A’s.</p>
      <p class="muted small">The synergy score measures how well each team works together. Real battles also depend on moves, items, abilities and the player.</p>
      <div class="vs-actions">
        <button type="button" class="btn ghost" id="vs-share">Copy link to this comparison</button>
        <span class="muted small" id="vs-share-note"></span>
      </div>
    </section>`;
  document.getElementById("vs-share").addEventListener("click", async () => {
    const note = document.getElementById("vs-share-note");
    try { await navigator.clipboard.writeText(shareUrl); note.textContent = "Copied!"; }
    catch { note.textContent = shareUrl; }
  });
}

/* ---------- Tools tab ---------- */

const TOOL_INTRO = {
  compare: "Two Pokémon side by side.",
  typechart: "Every type matchup in one chart, plus a calculator for dual types.",
  search: "Find Pokémon by type, generation and minimum stats.",
  stats: "Exact stats from level, IVs, EVs and nature.",
  abilities: "Look up any ability and every Pokémon that can have it.",
  moves: "Look up any move and every Pokémon that can learn it.",
  items: "Browse every item by bag pocket and category, or look one up directly.",
  breeding: "Egg groups, compatible partners and what hatches.",
  quiz: "Name the Pokémon from its silhouette."
};
const TOOLS = [["compare", "Compare"], ["typechart", "Type chart"], ["search", "Advanced search"], ["stats", "Stat calculator"],
  ["abilities", "Abilities"], ["moves", "Moves"], ["items", "Items"], ["breeding", "Breeding"], ["quiz", "Who's That Pokémon?"]];

async function renderTools(tool, rest = []) {
  tool = TOOLS.some(([id]) => id === tool) ? tool : "compare";
  const label = TOOLS.find(([id]) => id === tool)[1];
  setCrumbs([{ label: "Tools", href: "#tools" }, { label }]);
  view.innerHTML = `
    <h1>${esc(label)}</h1>
    <p class="lede">${esc(TOOL_INTRO[tool] || "")}</p>
    <div id="tool-body">${loadingBlock()}</div>`;
  const body = document.getElementById("tool-body");
  if (tool === "compare") await renderCompare(body, rest[0], rest[1]);
  else if (tool === "typechart") await renderTypeChart(body);
  else if (tool === "search") await renderSearch(body);
  else if (tool === "stats") await renderStatCalc(body, rest[0]);
  else if (tool === "abilities") await renderAbilitySearch(body, rest[0]);
  else if (tool === "moves") await renderMoveSearch(body, rest[0]);
  else if (tool === "breeding") await renderBreeding(body, rest[0]);
  else if (tool === "items") await renderItems(body, rest[0]);
  else await renderQuiz(body);
}

/* Compare two Pokémon */
async function renderCompare(body, a = "charizard", b = "blastoise") {
  body.innerHTML = `
    <form class="compare-form" id="compare-form">
      <label for="cmp-a" class="visually-hidden">First Pokémon</label>
      <input id="cmp-a" type="search" list="name-suggestions" value="${esc(a)}" autocomplete="off">
      <span class="vs">vs</span>
      <label for="cmp-b" class="visually-hidden">Second Pokémon</label>
      <input id="cmp-b" type="search" list="name-suggestions" value="${esc(b)}" autocomplete="off">
      <button type="submit">Compare</button>
    </form>
    <div id="compare-out"><p class="status">Loading…</p></div>`;
  document.getElementById("compare-form").addEventListener("submit", e => {
    e.preventDefault();
    location.hash = `tools/compare/${cleanQuery(document.getElementById("cmp-a").value) || a}/${cleanQuery(document.getElementById("cmp-b").value) || b}`;
  });

  const out = document.getElementById("compare-out");
  let left, right;
  try { [left, right] = await Promise.all([loadSpeciesAndMon(a), loadSpeciesAndMon(b)]); }
  catch { out.innerHTML = `<p class="error">Couldn't find one of those Pokémon. Check the spelling (use hyphens, e.g. mr-mime).</p>`; return; }
  const td = await allTypeData();
  const side = x => ({ ...x, label: monLabel(x.species, x.mon), types: x.mon.types.map(t => t.type.name), stats: baseStats(x.mon) });
  const L = side(left), R = side(right);
  const [abL, abR] = await Promise.all([abilityNames(L.mon), abilityNames(R.mon)]);
  const keys = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
  const total = s => keys.reduce((n, k) => n + s[k], 0);
  const bestHit = (from, to) => Math.max(...from.types.map(t => effectiveness(td, t, to.types)));
  const hitLine = (from, to) => {
    const m = bestHit(from, to);
    const word = m === 0 ? "can't touch" : m >= 2 ? "hits super effectively" : m < 1 ? "is resisted by" : "hits neutrally";
    return `<strong>${esc(from.label)}</strong>'s best STAB ${word} <strong>${esc(to.label)}</strong> <span class="${multClass(m)} pill">×${multText(m) || "1"}</span>`;
  };

  out.innerHTML = `
    <div class="result-actions">${shareButton("compare-share", "Share comparison")}</div>
    <div class="compare-grid">
      ${[[L, abL], [R, abR]].map(([x, ab]) => `
        <div class="panel compare-side">
          <img src="${artOf(x.mon)}" alt="">
          <a href="#pokemon/${x.mon.name}"><h2>${esc(x.label)}</h2></a>
          <div class="types">${x.types.map(t => typeBadge(t)).join("")}</div>
          <p class="muted">${esc(ab.join(" / "))}</p>
        </div>`).join("")}
    </div>
    <section class="panel">
      <h2>Base stats</h2>
      <div class="cmp-stats">
        ${keys.map(k => {
          const l = L.stats[k], r = R.stats[k];
          return `<div class="cmp-row">
            <span class="cmp-val ${l > r ? "win" : ""}">${l}</span>
            <span class="bar rev"><span style="width:${l / 255 * 100}%"></span></span>
            <span class="cmp-label">${STAT_LABEL[k]}</span>
            <span class="bar"><span style="width:${r / 255 * 100}%"></span></span>
            <span class="cmp-val ${r > l ? "win" : ""}">${r}</span>
          </div>`;
        }).join("")}
        <div class="cmp-row total">
          <span class="cmp-val ${total(L.stats) > total(R.stats) ? "win" : ""}">${total(L.stats)}</span><span></span>
          <span class="cmp-label">Total</span><span></span>
          <span class="cmp-val ${total(R.stats) > total(L.stats) ? "win" : ""}">${total(R.stats)}</span>
        </div>
      </div>
    </section>
    <section class="panel">
      <h2>Head to head</h2>
      <ul class="plain">
        <li>${hitLine(L, R)}</li>
        <li>${hitLine(R, L)}</li>
        <li>${L.stats.speed === R.stats.speed ? "They have the same base Speed, so it's a speed tie at equal investment."
          : `<strong>${esc(L.stats.speed > R.stats.speed ? L.label : R.label)}</strong> is faster (base ${Math.max(L.stats.speed, R.stats.speed)} vs ${Math.min(L.stats.speed, R.stats.speed)}).`}</li>
      </ul>
    </section>`;
  document.getElementById("compare-share").addEventListener("click", () =>
    shareLink(pageUrl(`tools/compare/${L.mon.name}/${R.mon.name}`), `${L.label} vs ${R.label} · Poké Explorer`));
}

/* Interactive type chart */
async function renderTypeChart(body) {
  const td = await allTypeData();
  body.innerHTML = `
    <p class="lede">Rows are the attacking move's type, columns the defending Pokémon's type. Pick one or two defending types to see the combined weaknesses.</p>
    <div class="dual-pick">
      <label for="def1">Defending type</label>
      <select id="def1">${ALL_TYPES.map(t => `<option value="${t}">${title(t)}</option>`).join("")}</select>
      <label for="def2">and</label>
      <select id="def2"><option value="">(none)</option>${ALL_TYPES.map(t => `<option value="${t}">${title(t)}</option>`).join("")}</select>
    </div>
    <div id="dual-out"></div>
    <div class="table-wrap"><table class="type-chart">
      <thead><tr><th class="corner">ATK ↓ / DEF →</th>${ALL_TYPES.map(t => `<th class="col-head" title="${title(t)}"><span class="tc-type" style="${typeStyle(t)}">${t.slice(0, 3)}</span></th>`).join("")}</tr></thead>
      <tbody>${ALL_TYPES.map(atk => `<tr><th>${typeBadge(atk)}</th>${ALL_TYPES.map(def => {
        const m = effectiveness(td, atk, [def]);
        return `<td class="${multClass(m)}" title="${title(atk)} → ${title(def)}: ×${multText(m) || 1}">${multText(m)}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
    </table></div>`;

  const draw = () => {
    const defs = [document.getElementById("def1").value, document.getElementById("def2").value].filter(Boolean);
    const uniq = [...new Set(defs)];
    const groups = { "Weak to": [], "Resists": [], "Immune to": [] };
    ALL_TYPES.forEach(atk => {
      const m = effectiveness(td, atk, uniq);
      if (m > 1) groups["Weak to"].push([atk, m]); else if (m === 0) groups["Immune to"].push([atk, m]); else if (m < 1) groups["Resists"].push([atk, m]);
    });
    document.getElementById("dual-out").innerHTML = `<div class="panel dual-result">
      <div class="types">${uniq.map(t => typeBadge(t)).join("")}</div>
      ${Object.entries(groups).map(([label, list]) => `<h3>${label}</h3><div class="types">${list.length ? list.map(([t, m]) => typeBadge(t, `<small>×${multText(m)}</small>`)).join("") : '<span class="muted">None</span>'}</div>`).join("")}
    </div>`;
  };
  document.getElementById("def1").addEventListener("change", draw);
  document.getElementById("def2").addEventListener("change", draw);
  draw();
}

/* Advanced search */
const SEARCH_DEFAULTS = { type1: "", type2: "", gen: "", stat: "", min: "", sort: "id", forms: false };
let searchState = { ...SEARCH_DEFAULTS };

async function renderSearch(body) {
  const st = SEARCH_DEFAULTS;   // controls start at their defaults; keepFilters restores saved choices below
  const opt = (v, label, cur) => `<option value="${v}" ${v === cur ? "selected" : ""}>${label}</option>`;
  body.innerHTML = `
    <form class="search-form" id="adv-form">
      <div><label for="s-type1">Type</label><select id="s-type1">${opt("", "Any", st.type1)}${ALL_TYPES.map(t => opt(t, title(t), st.type1)).join("")}</select></div>
      <div><label for="s-type2">Second type</label><select id="s-type2">${opt("", "Any", st.type2)}${ALL_TYPES.map(t => opt(t, title(t), st.type2)).join("")}</select></div>
      <div><label for="s-gen">Generation</label><select id="s-gen">${opt("", "Any", st.gen)}${GEN_NAMES.map((n, i) => opt(String(i + 1), `Gen ${i + 1} · ${n}`, st.gen)).join("")}</select></div>
      <div><label for="s-stat">Minimum stat</label><select id="s-stat">${opt("", "None", st.stat)}${Object.entries(STAT_LABEL).map(([k, l]) => opt(k, l, st.stat)).join("")}${opt("total", "Total", st.stat)}</select></div>
      <div><label for="s-min">At least</label><input id="s-min" type="number" min="1" max="800" placeholder="e.g. 100" value="${esc(st.min)}"></div>
      <div><label for="s-sort">Sort by</label><select id="s-sort">${opt("id", "Pokédex number", st.sort)}${Object.entries(STAT_LABEL).map(([k, l]) => opt(k, l, st.sort)).join("")}${opt("total", "Total", st.sort)}</select></div>
      <label class="check"><input type="checkbox" id="s-forms" ${st.forms ? "checked" : ""}> Include forms (regional, Mega, etc.)</label>
      <button type="submit">Search</button>
      ${clearFiltersBtn()}
    </form>
    <div id="adv-out"><p class="muted">Choose filters and press Search. Example: Fire type, minimum Speed 100.</p></div>`;

  document.getElementById("adv-form").addEventListener("submit", async e => {
    e.preventDefault();
    Object.assign(searchState, {
      type1: document.getElementById("s-type1").value, type2: document.getElementById("s-type2").value,
      gen: document.getElementById("s-gen").value, stat: document.getElementById("s-stat").value,
      min: document.getElementById("s-min").value, sort: document.getElementById("s-sort").value,
      forms: document.getElementById("s-forms").checked
    });
    await runSearch(document.getElementById("adv-out"));
  });
  const form = document.getElementById("adv-form");
  const ids = ["s-type1", "s-type2", "s-gen", "s-stat", "s-min", "s-sort", "s-forms"];
  const active = keepFilters("adv-search", ids, {
    clearBtn: document.getElementById("clear-filters"),
    onClear: () => {
      searchState = { ...SEARCH_DEFAULTS };
      document.getElementById("adv-out").innerHTML = `<p class="muted">Choose filters and press Search. Example: Fire type, minimum Speed 100.</p>`;
    }
  });
  if (active) form.requestSubmit();   // saved filters: show the results again right away
}

async function runSearch(out) {
  const st = searchState;
  out.innerHTML = `<p class="status">Searching…</p>`;
  // Candidates: from type lists if a type is chosen, otherwise every Pokémon.
  let cands;
  const typed = [st.type1, st.type2].filter(Boolean);
  if (typed.length) {
    const lists = await Promise.all(typed.map(t => get(`/type/${t}`)));
    const sets = lists.map(l => new Map(l.pokemon.map(p => [p.pokemon.name, idFromUrl(p.pokemon.url)])));
    cands = [...sets[0]].filter(([n]) => sets.every(s => s.has(n))).map(([name, id]) => ({ name, id }));
  } else {
    cands = (await getAllPokemon()).results.map(p => ({ name: p.name, id: idFromUrl(p.url) }));
  }
  if (!st.forms) cands = cands.filter(c => c.id <= 1025);
  if (st.gen) cands = cands.filter(c => c.id <= 1025 && String(genOf(c.id)) === st.gen);

  const needStats = (st.stat && st.min) || st.sort !== "id";
  const rows = cands.map(c => ({ ...c }));
  const statKey = st.sort !== "id" ? st.sort : st.stat;
  const searchId = ++runSearch.current;   // a newer search cancels this one

  // Draws whatever has loaded so far; results fill in while the rest load.
  const draw = loaded => {
    let list = needStats ? rows.slice(0, loaded).filter(r => r.stats) : rows.slice();
    if (st.stat && st.min) list = list.filter(r => r.stats[st.stat] >= Number(st.min));
    list.sort(st.sort === "id" ? (a, b) => a.id - b.id : (a, b) => (b.stats?.[st.sort] || 0) - (a.stats?.[st.sort] || 0));
    const done = loaded >= rows.length;
    out.innerHTML = `
      ${done ? "" : `<div class="search-progress"><span>Checking stats… ${loaded} of ${rows.length} Pokémon</span><div class="bar"><span style="width:${loaded / rows.length * 100}%"></span></div></div>`}
      ${list.length ? `<p class="count">${list.length} result${list.length > 1 ? "s" : ""}${done ? "" : " so far"}</p>
      <div class="mon-grid">${list.map(r => `
        <a class="mon-card" href="#pokemon/${r.name}">
          ${spriteImg(r.id)}
          <span class="num">${r.id <= 1025 ? pad(r.id) : "Form"}</span>
          <span class="name">${esc(pokeName(r.name))}</span>
          ${r.stats && statKey ? `<span class="num">${esc(STAT_LABEL[statKey] || "Total")} ${r.stats[statKey]}</span>` : ""}
          ${r.id <= 1025 ? trackBadges(r.id) : ""}
        </a>`).join("")}</div>`
      : done ? `<p class="muted">No Pokémon match those filters. Try lowering the minimum stat or removing a type.</p>` : ""}`;
  };

  if (!needStats) return draw(rows.length);
  const BATCH = 40;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = await Promise.all(rows.slice(i, i + BATCH).map(r => get(`/pokemon/${r.name}`).catch(() => null)));
    if (searchId !== runSearch.current) return;
    chunk.forEach((mon, j) => {
      if (!mon) return;
      const r = rows[i + j];
      r.stats = baseStats(mon);
      r.stats.total = Object.values(r.stats).reduce((a, b) => a + b, 0);
    });
    draw(Math.min(rows.length, i + BATCH));
  }
}
runSearch.current = 0;

/* Who's That Pokémon? */
const QUIZ_KEY = "pokeExplorerQuizBest";
let quiz = { streak: 0, gens: new Set(["1"]) };

async function renderQuiz(body) {
  let best = 0;
  try { best = Number(localStorage.getItem(QUIZ_KEY)) || 0; } catch {}
  body.innerHTML = `
    <div class="quiz-gens" role="group" aria-label="Generations to include">
      ${GEN_NAMES.map((n, i) => `<label class="gen-chip"><input type="checkbox" value="${i + 1}" ${quiz.gens.has(String(i + 1)) ? "checked" : ""}><span>Gen ${i + 1}</span></label>`).join("")}
    </div>
    <div class="quiz-card panel">
      <div class="quiz-score"><span>Streak <strong id="q-streak">${quiz.streak}</strong></span><span>Best <strong id="q-best">${best}</strong></span></div>
      <div class="quiz-art"><img id="q-img" alt="Mystery Pokémon silhouette"></div>
      <p class="quiz-result" id="q-result" aria-live="polite"></p>
      <div class="quiz-options" id="q-options"></div>
      <div class="quiz-actions">
        <button type="button" id="q-cry">▶ Hear its cry (hint)</button>
        <button type="button" id="q-next" hidden>Next Pokémon →</button>
      </div>
    </div>`;

  const species = (await get("/pokemon-species?limit=2000")).results.map(s => ({ name: s.name, id: idFromUrl(s.url) }));
  let answer, audio;

  body.querySelectorAll(".quiz-gens input").forEach(cb => cb.addEventListener("change", () => {
    if (cb.checked) quiz.gens.add(cb.value); else quiz.gens.delete(cb.value);
    if (!quiz.gens.size) { quiz.gens.add(cb.value); cb.checked = true; }
    nextQuestion();
  }));
  document.getElementById("q-next").addEventListener("click", nextQuestion);

  async function nextQuestion() {
    const pool = species.filter(s => s.id <= 1025 && quiz.gens.has(String(genOf(s.id))));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    const others = new Set();
    while (others.size < 3 && others.size < pool.length - 1) {
      const o = pool[Math.floor(Math.random() * pool.length)];
      if (o.id !== pick.id) others.add(o);
    }
    const choices = [pick, ...others].sort(() => Math.random() - 0.5);
    answer = pick;
    // Hide the picture until the next Pokémon has loaded. Otherwise the reveal fades back to a silhouette
    // while the new image arrives, and the new Pokémon shows in color for a moment.
    const img = document.getElementById("q-img");
    const url = OFFICIAL_ART(pick.id);
    img.classList.add("loading");
    img.classList.remove("revealed");
    const show = () => img.classList.remove("loading");
    img.onload = show;
    img.onerror = show;
    if (img.src === url && img.complete) show();   // same picture as last time: no load event will fire
    else img.src = url;
    document.getElementById("q-result").textContent = "";
    document.getElementById("q-next").hidden = true;
    const opts = document.getElementById("q-options");
    opts.innerHTML = choices.map(c => `<button type="button" class="quiz-option" data-id="${c.id}">${esc(pokeName(c.name))}</button>`).join("");
    opts.querySelectorAll("button").forEach(b => b.addEventListener("click", () => choose(Number(b.dataset.id))));
    audio = null;
    get(`/pokemon/${pick.id}`).then(mon => { if (answer === pick) audio = mon.cries?.latest || mon.cries?.legacy; }).catch(() => {});
  }

  function choose(id) {
    const right = id === answer.id;
    document.getElementById("q-img").classList.add("revealed");
    document.querySelectorAll(".quiz-option").forEach(b => {
      b.disabled = true;
      if (Number(b.dataset.id) === answer.id) b.classList.add("correct");
      else if (Number(b.dataset.id) === id) b.classList.add("wrong");
    });
    quiz.streak = right ? quiz.streak + 1 : 0;
    if (quiz.streak > best) { best = quiz.streak; try { localStorage.setItem(QUIZ_KEY, String(best)); } catch {} }
    document.getElementById("q-streak").textContent = quiz.streak;
    document.getElementById("q-best").textContent = best;
    document.getElementById("q-result").innerHTML = right
      ? `Correct! It's <a href="#pokemon/${answer.name}">${esc(pokeName(answer.name))}</a>.`
      : `It's <a href="#pokemon/${answer.name}">${esc(pokeName(answer.name))}</a>. Streak reset.`;
    document.getElementById("q-next").hidden = false;
    document.getElementById("q-next").focus();
  }

  document.getElementById("q-cry").addEventListener("click", () => {
    if (!audio) return;
    const a = new Audio(audio); a.volume = 0.4; a.play().catch(() => {});
  });
  nextQuestion();
}

/* ---------- Home page extras: Pokémon of the day + random ---------- */

function dayNumber() {
  const now = new Date();
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}
const pokemonOfTheDayId = () => (dayNumber() * 7919) % 1025 + 1;

window.renderHomeExtras = async box => {
  if (!box) return;
  const id = pokemonOfTheDayId();
  box.innerHTML = `
    <div class="potd">
      <div class="potd-art"><img src="${OFFICIAL_ART(id)}" alt=""></div>
      <div class="potd-text">
        <div class="dex-no">Pokémon of the day · ${pad(id)}</div>
        <h2 id="potd-name">Loading…</h2>
        <p class="muted" id="potd-genus"></p>
        <div class="types" id="potd-types"></div>
        <div class="potd-actions">
          <a class="btn" id="potd-link" href="#pokemon/${id}">See full profile</a>
          <button type="button" class="btn ghost" id="random-btn">Random Pokémon</button>
        </div>
      </div>
    </div>`;
  document.getElementById("random-btn").addEventListener("click", () => {
    location.hash = `pokemon/${Math.floor(Math.random() * 1025) + 1}`;
  });
  try {
    const { species, mon } = await loadSpeciesAndMon(String(id));
    document.getElementById("potd-name").textContent = english(species.names) || title(species.name);
    document.getElementById("potd-genus").textContent = english(species.genera, "genus") || "";
    document.getElementById("potd-types").innerHTML = mon.types.map(t => typeBadge(t.type.name)).join("");
    document.getElementById("potd-link").href = `#pokemon/${species.name}`;
  } catch {
    const n = document.getElementById("potd-name");
    if (n) n.textContent = `Pokémon ${pad(id)}`;
  }
};
