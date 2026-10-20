/*
 * Poké Explorer — Training & breeding tools (Tools tab: Stat calculator, Abilities, Moves, Breeding)
 * plus the "Training & breeding" panel on each details page.
 * Uses helpers from app.js and extras.js (get, english, title, esc, typeBadge, SPRITE, spriteImg, pad,
 * loadSpeciesAndMon, baseStats, getNatures, STAT_LABEL, idFromUrl, artOf, monLabel, cleanQuery).
 *
 * PokéAPI endpoints: /pokemon-species/{name} (egg groups, gender, egg cycles), /pokemon/{name} (base stats,
 * EV yield), /nature, /ability/{name}, /move/{name}, /egg-group/{name}, /evolution-chain/{id}.
 */

const STAT_KEYS = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];

/* ---------- Stat formula (Generation 3 onward) ---------- */

// HP = ⌊(2·Base + IV + ⌊EV/4⌋) · Level/100⌋ + Level + 10
// Other = ⌊(⌊(2·Base + IV + ⌊EV/4⌋) · Level/100⌋ + 5) · Nature⌋, Nature = 1.1 boosted, 0.9 lowered, 1.0 otherwise
function calcStat(stat, base, iv, ev, level, natureMult = 1, shedinja = false) {
  const core = Math.floor((2 * base + iv + Math.floor(ev / 4)) * level / 100);
  if (stat === "hp") return shedinja ? 1 : core + level + 10;
  return Math.floor((core + 5) * natureMult);
}

function natureMultFor(nature, stat) {
  if (!nature || stat === "hp") return 1;
  if (nature.increased_stat?.name === stat) return 1.1;
  if (nature.decreased_stat?.name === stat) return 0.9;
  return 1;
}

const evYield = mon => mon.stats.filter(s => s.effort > 0).map(s => `${s.effort} ${STAT_LABEL[s.stat.name]}`).join(", ") || "None";

/* ---------- Stat calculator ---------- */

let calcState = { level: 50, nature: "hardy", ivs: {}, evs: {} };

async function renderStatCalc(body, query = "garchomp") {
  body.innerHTML = `<p class="status">Loading…</p>`;
  let data;
  try { data = await loadSpeciesAndMon(query); }
  catch { body.innerHTML = `<p class="error">Couldn't find “${esc(query)}”. Check the spelling.</p>${statGuide()}`; return; }
  const natures = await getNatures();
  const { species, mon } = data;
  const base = baseStats(mon);
  const shedinja = species.name === "shedinja";
  const label = monLabel(species, mon);
  STAT_KEYS.forEach(k => { calcState.ivs[k] ??= 31; calcState.evs[k] ??= 0; });

  const natureOptions = Object.values(natures).sort((a, b) => a.name.localeCompare(b.name)).map(n => {
    const up = n.increased_stat?.name, down = n.decreased_stat?.name;
    const fx = up && down ? ` (+${STAT_LABEL[up]}, −${STAT_LABEL[down]})` : " (neutral)";
    return `<option value="${n.name}" ${n.name === calcState.nature ? "selected" : ""}>${esc((english(n.names) || title(n.name)) + fx)}</option>`;
  }).join("");

  body.innerHTML = `
    <form class="compare-form" id="calc-form">
      <label for="calc-mon" class="visually-hidden">Pokémon</label>
      <input id="calc-mon" type="search" list="name-suggestions" value="${esc(mon.name)}" autocomplete="off">
      <button type="submit">Load Pokémon</button>
    </form>
    <section class="panel calc">
      <div class="calc-head">
        <img src="${artOf(mon)}" alt="">
        <div>
          <a href="#pokemon/${mon.name}"><h2>${esc(label)}</h2></a>
          <div class="types">${mon.types.map(t => typeBadge(t.type.name)).join("")}</div>
          <p class="muted">Defeating it gives: <strong>${esc(evYield(mon))}</strong> EV${mon.stats.reduce((n, s) => n + s.effort, 0) === 1 ? "" : "s"}</p>
        </div>
        <div class="calc-controls">
          <div><label for="calc-level">Level</label><input id="calc-level" type="number" min="1" max="100" value="${calcState.level}"></div>
          <div><label for="calc-nature">Nature</label><select id="calc-nature">${natureOptions}</select></div>
        </div>
      </div>
      <div class="table-wrap"><table class="data-table calc-table">
        <thead><tr><th>Stat</th><th class="num">Base</th><th class="num">IV (0–31)</th><th class="num">EV (0–252)</th><th class="num">Nature</th><th class="num">Result</th><th class="num">Possible range</th></tr></thead>
        <tbody>${STAT_KEYS.map(k => `<tr data-stat="${k}">
          <td>${STAT_LABEL[k]}</td>
          <td class="num">${base[k]}</td>
          <td class="num"><input type="number" min="0" max="31" data-iv="${k}" value="${calcState.ivs[k]}" aria-label="${STAT_LABEL[k]} IV"></td>
          <td class="num"><input type="number" min="0" max="252" step="4" data-ev="${k}" value="${calcState.evs[k]}" aria-label="${STAT_LABEL[k]} EV"></td>
          <td class="num nat"></td>
          <td class="num result"></td>
          <td class="num range muted"></td>
        </tr>`).join("")}</tbody>
      </table></div>
      <div class="calc-foot">
        <span id="ev-total"></span>
        <div class="calc-presets">
          <button type="button" data-preset="max-iv">All IVs 31</button>
          <button type="button" data-preset="zero-iv">All IVs 0</button>
          <button type="button" data-preset="clear-ev">Clear EVs</button>
          <button type="button" data-preset="phys">252 Atk / 252 Spe / 4 HP</button>
          <button type="button" data-preset="spec">252 SpA / 252 Spe / 4 HP</button>
          <button type="button" data-preset="bulk">252 HP / 252 Def / 4 SpD</button>
        </div>
      </div>
      <p class="note muted">Formula from Generation 3 onward. The "possible range" is the lowest (0 IV, 0 EV, lowering nature) to highest (31 IV, 252 EV, boosting nature) value at this level.${shedinja ? " Shedinja always has exactly 1 HP." : ""}</p>
    </section>
    ${statGuide()}`;

  const level = () => Math.min(100, Math.max(1, Number(document.getElementById("calc-level").value) || 1));
  const clampInput = (el, max) => { const v = Math.min(max, Math.max(0, Math.floor(Number(el.value) || 0))); el.value = v; return v; };

  function recalc() {
    calcState.level = level();
    calcState.nature = document.getElementById("calc-nature").value;
    const nature = natures[calcState.nature];
    let total = 0;
    STAT_KEYS.forEach(k => {
      const row = body.querySelector(`tr[data-stat="${k}"]`);
      const iv = clampInput(row.querySelector("[data-iv]"), 31), ev = clampInput(row.querySelector("[data-ev]"), 252);
      calcState.ivs[k] = iv; calcState.evs[k] = ev; total += ev;
      const m = natureMultFor(nature, k);
      row.querySelector(".nat").innerHTML = m > 1 ? '<span class="up">+10%</span>' : m < 1 ? '<span class="down">−10%</span>' : "";
      row.querySelector(".result").textContent = calcStat(k, base[k], iv, ev, calcState.level, m, shedinja);
      const lo = calcStat(k, base[k], 0, 0, calcState.level, k === "hp" ? 1 : 0.9, shedinja);
      const hi = calcStat(k, base[k], 31, 252, calcState.level, k === "hp" ? 1 : 1.1, shedinja);
      row.querySelector(".range").textContent = `${lo}–${hi}`;
    });
    const el = document.getElementById("ev-total");
    el.className = total > 510 ? "over" : "";
    el.innerHTML = `EVs used: <strong>${total} / 510</strong>${total > 510 ? " · Over the 510 limit; a real Pokémon can't have this spread." : ` · ${510 - total} left`}`;
  }

  body.querySelector(".calc").addEventListener("input", recalc);
  body.querySelector(".calc").addEventListener("change", recalc);
  body.querySelectorAll("[data-preset]").forEach(btn => btn.addEventListener("click", () => {
    const p = btn.dataset.preset;
    const setIv = v => body.querySelectorAll("[data-iv]").forEach(i => (i.value = v));
    const setEvs = map => body.querySelectorAll("[data-ev]").forEach(i => (i.value = map[i.dataset.ev] || 0));
    if (p === "max-iv") setIv(31);
    if (p === "zero-iv") setIv(0);
    if (p === "clear-ev") setEvs({});
    if (p === "phys") setEvs({ attack: 252, speed: 252, hp: 4 });
    if (p === "spec") setEvs({ "special-attack": 252, speed: 252, hp: 4 });
    if (p === "bulk") setEvs({ hp: 252, defense: 252, "special-defense": 4 });
    recalc();
  }));
  document.getElementById("calc-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = cleanQuery(document.getElementById("calc-mon").value);
    if (q) location.hash = `tools/stats/${q}`;
  });
  recalc();
}

function statGuide() {
  return `
  <section class="guide">
    <h2 class="grid-title">How stats work</h2>
    <p class="lede">Every Pokémon's six stats come from four things: its species' <strong>base stats</strong>, its <strong>IVs</strong>, its <strong>EVs</strong> and its <strong>nature</strong>, scaled by its level. Two Pikachu at the same level can have quite different stats because of the last three.</p>
    <div class="guide-grid">
      <article class="panel">
        <h3 class="guide-title">IVs: Individual Values</h3>
        <p>Think of IVs as a Pokémon's genes. Each stat gets a hidden IV from <strong>0 to 31</strong> when the Pokémon is caught, hatched or received, and it never changes on its own.</p>
        <ul class="plain">
          <li>At level 100, every IV point adds 1 to that stat, so a 31 IV gives up to <strong>+31</strong> over a 0 IV.</li>
          <li>Legendary and Mythical Pokémon (from Gen 6 on) are guaranteed at least three perfect (31) IVs.</li>
          <li>In breeding, a parent holding a <strong>Destiny Knot</strong> passes down 5 of the parents' 12 IVs instead of 3.</li>
          <li><strong>Hyper Training</strong> (Gen 7 on) uses Bottle Caps to treat an IV as 31: level 100 in Sun/Moon through Sword/Shield, level 50 in Scarlet/Violet.</li>
          <li>Many games have an <strong>IV judge</strong> (in the PC Box from Gen 7 on) that rates each stat, with "Best" meaning 31.</li>
        </ul>
      </article>
      <article class="panel">
        <h3 class="guide-title">EVs: Effort Values</h3>
        <p>EVs are training points. Every Pokémon you defeat gives EVs in specific stats (its <strong>EV yield</strong>, shown on each details page). Defeat a Pikachu and you get 2 Speed EVs.</p>
        <ul class="plain">
          <li>Limits: <strong>252 per stat</strong> and <strong>510 total</strong> (from Gen 6; 255 per stat before). So you can max two stats and put 4 in a third.</li>
          <li>At level 100, every <strong>4 EVs = +1 stat</strong>, so 252 EVs gives +63.</li>
          <li>Vitamins (HP Up, Protein, Iron, Calcium, Zinc, Carbos) give 10 EVs each; feathers (wings) give 1.</li>
          <li><strong>Power items</strong> (Power Weight, Bracer…) add 8 EVs per battle, and <strong>Pokérus</strong> doubles the EVs gained.</li>
          <li>EV-reducing berries (Pomeg, Kelpsy, Qualot, Hondew, Grepa, Tamato) lower them again.</li>
        </ul>
      </article>
      <article class="panel">
        <h3 class="guide-title">Natures</h3>
        <p>A nature raises one stat by 10% and lowers another by 10%. Five natures (Hardy, Docile, Serious, Bashful, Quirky) are neutral. HP is never affected.</p>
        <ul class="plain">
          <li>Pick a nature that boosts a stat you use and lowers one you don't, e.g. <strong>Adamant</strong> (+Atk, −SpA) for a physical attacker.</li>
          <li><strong>Mints</strong> (Sword/Shield and later) change which stats a nature affects, without changing its name.</li>
          <li>In breeding, a parent holding an <strong>Everstone</strong> passes down its nature (guaranteed from Gen 5).</li>
          <li><a class="text-link" href="#natures">See the Natures tab</a> for picks by role and all 25 natures.</li>
        </ul>
      </article>
      <article class="panel">
        <h3 class="guide-title">Differences between games</h3>
        <ul class="plain">
          <li><strong>Red/Blue/Yellow and Gold/Silver/Crystal</strong> used older systems ("DVs" from 0–15 and "stat experience") instead of IVs and EVs.</li>
          <li><strong>Let's Go, Pikachu!/Eevee!</strong> replace EVs with <strong>AVs</strong> (Awakening Values, up to 200 per stat) from Candies.</li>
          <li><strong>Legends: Arceus</strong> replaces EVs with <strong>Effort Levels</strong> (0–10) raised with Grit items.</li>
          <li>Everywhere else from Ruby/Sapphire on, the IV/EV/nature system and the formula on this page apply.</li>
        </ul>
      </article>
    </div>
  </section>`;
}

/* ---------- Ability search ---------- */

async function fillDatalist(id, url) {
  if (document.getElementById(id)) return;
  const dl = document.createElement("datalist");
  dl.id = id;
  document.body.appendChild(dl);
  try { dl.innerHTML = (await get(url)).results.map(r => `<option value="${r.name}">`).join(""); } catch {}
}

const englishEffect = x => {
  const e = (x.effect_entries || []).find(e => e.language.name === "en");
  const flavor = [...(x.flavor_text_entries || [])].reverse().find(f => f.language.name === "en");
  let text = e?.short_effect || e?.effect || flavor?.flavor_text || flavor?.text || "";
  if (x.effect_chance != null) text = text.replace(/\$effect_chance/g, x.effect_chance);
  return text.replace(/\s+/g, " ");
};

async function renderAbilitySearch(body, query) {
  fillDatalist("ability-list", "/ability?limit=500");
  body.innerHTML = `
    <form class="compare-form" id="ab-form">
      <label for="ab-q" class="visually-hidden">Ability</label>
      <input id="ab-q" type="search" list="ability-list" placeholder="Ability, e.g. intimidate" value="${esc(query || "")}" autocomplete="off">
      <button type="submit">Find Pokémon</button>
    </form>
    <div id="ab-out">${query ? '<p class="status">Loading…</p>' : '<p class="muted">Type an ability to see what it does and every Pokémon that can have it. Try <a class="text-link" href="#tools/abilities/intimidate">Intimidate</a>, <a class="text-link" href="#tools/abilities/levitate">Levitate</a> or <a class="text-link" href="#tools/abilities/protean">Protean</a>.</p>'}</div>`;
  document.getElementById("ab-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = cleanQuery(document.getElementById("ab-q").value);
    if (q) location.hash = `tools/abilities/${q}`;
  });
  if (!query) return;

  const out = document.getElementById("ab-out");
  let ab;
  try { ab = await get(`/ability/${query}`); }
  catch { out.innerHTML = `<p class="error">No ability called “${esc(query)}”. Use hyphens for spaces, e.g. swift-swim.</p>`; return; }
  const holders = ab.pokemon.map(p => ({ name: p.pokemon.name, id: idFromUrl(p.pokemon.url), hidden: p.is_hidden }))
    .sort((a, b) => a.id - b.id);
  const normal = holders.filter(h => !h.hidden), hidden = holders.filter(h => h.hidden);
  const grid = list => `<div class="mon-grid">${list.map(h => `
    <a class="mon-card" href="#pokemon/${h.name}">
      ${spriteImg(h.id)}
      <span class="num">${h.id <= 1025 ? pad(h.id) : "Form"}</span>
      <span class="name">${esc(regionalInfo(h.name)?.label || (typeof gimmickLabel === "function" ? gimmickLabel(h.name) : title(h.name)))}</span>
    </a>`).join("")}</div>`;

  out.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>${esc(english(ab.names) || title(ab.name))}</h2><span class="dex-no">Introduced in ${esc(genLabel(ab.generation.name))}</span></div>
      <p>${esc(englishEffect(ab)) || '<span class="muted">No description available.</span>'}</p>
      <p class="muted">${holders.length} Pokémon can have this ability${hidden.length ? `, ${hidden.length} of them only as a Hidden Ability` : ""}.</p>
    </section>
    ${normal.length ? `<h2 class="grid-title">Regular ability <span class="muted">(${normal.length})</span></h2>${grid(normal)}` : ""}
    ${hidden.length ? `<h2 class="grid-title">Hidden Ability <span class="muted">(${hidden.length})</span></h2>
      <p class="muted">Hidden Abilities come from special encounters (Dream World, Friend Safari, Max Raids, Tera Raids…), an Ability Patch, or breeding from a parent that has it.</p>${grid(hidden)}` : ""}`;
}

/* ---------- Move search ---------- */

async function renderMoveSearch(body, query) {
  fillDatalist("move-list", "/move?limit=1000");
  body.innerHTML = `
    <form class="compare-form" id="mv-form">
      <label for="mv-q" class="visually-hidden">Move</label>
      <input id="mv-q" type="search" list="move-list" placeholder="Move, e.g. earthquake" value="${esc(query || "")}" autocomplete="off">
      <button type="submit">Find Pokémon</button>
    </form>
    <div id="mv-out">${query ? '<p class="status">Loading…</p>' : '<p class="muted">Type a move to see its stats and every Pokémon that can learn it. Try <a class="text-link" href="#tools/moves/earthquake">Earthquake</a>, <a class="text-link" href="#tools/moves/u-turn">U-turn</a> or <a class="text-link" href="#tools/moves/trick-room">Trick Room</a>.</p>'}</div>`;
  document.getElementById("mv-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = cleanQuery(document.getElementById("mv-q").value);
    if (q) location.hash = `tools/moves/${q}`;
  });
  if (!query) return;

  const out = document.getElementById("mv-out");
  let mv;
  try { mv = await get(`/move/${query}`); }
  catch { out.innerHTML = `<p class="error">No move called “${esc(query)}”. Use hyphens for spaces, e.g. close-combat.</p>`; return; }
  const learners = (mv.learned_by_pokemon || []).map(p => ({ name: p.name, id: idFromUrl(p.url) })).sort((a, b) => a.id - b.id);
  const fact = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;

  out.innerHTML = `
    <section class="panel">
      <div class="panel-head"><h2>${esc(english(mv.names) || title(mv.name))}</h2><span class="dex-no">Introduced in ${esc(genLabel(mv.generation.name))}</span></div>
      <dl class="facts">
        ${fact("Type", typeBadge(mv.type.name))}
        ${fact("Category", esc(title(mv.damage_class?.name || "—")))}
        ${fact("Power", mv.power ?? "—")}
        ${fact("Accuracy", mv.accuracy != null ? mv.accuracy + "%" : "—")}
        ${fact("PP", mv.pp ?? "—")}
        ${fact("Priority", mv.priority > 0 ? "+" + mv.priority : mv.priority)}
        ${fact("Target", esc(title(mv.target?.name || "—")))}
      </dl>
      <p>${esc(englishEffect(mv)) || '<span class="muted">No description available.</span>'}</p>
    </section>
    <div class="list-tools">
      <label class="visually-hidden" for="mv-filter">Filter Pokémon</label>
      <input id="mv-filter" type="search" placeholder="Filter by name…" autocomplete="off">
      <span class="count" id="mv-count">${learners.length} Pokémon can learn it</span>
    </div>
    <p class="muted note">Across all games and methods. Open a Pokémon and use its Moves section to see the level, TM or tutor for each game.</p>
    <div class="mon-grid" id="mv-grid">${learners.map(h => `
      <a class="mon-card" href="#pokemon/${h.name}" data-key="${h.name} ${h.id}">
        ${spriteImg(h.id)}
        <span class="num">${h.id <= 1025 ? pad(h.id) : "Form"}</span>
        <span class="name">${esc(regionalInfo(h.name)?.label || (typeof gimmickLabel === "function" ? gimmickLabel(h.name) : title(h.name)))}</span>
      </a>`).join("")}</div>`;

  const filter = document.getElementById("mv-filter");
  const cards = [...out.querySelectorAll(".mon-card")];
  filter.addEventListener("input", () => {
    const q = filter.value.trim().toLowerCase();
    let shown = 0;
    cards.forEach(c => { const hit = !q || c.dataset.key.includes(q); c.hidden = !hit; if (hit) shown++; });
    document.getElementById("mv-count").textContent = q ? `${shown} of ${cards.length}` : `${cards.length} Pokémon can learn it`;
  });
}

/* ---------- Breeding ---------- */

const EGG_GROUP_LABEL = {
  monster: "Monster", water1: "Water 1", water2: "Water 2", water3: "Water 3", bug: "Bug", flying: "Flying",
  ground: "Field", fairy: "Fairy", plant: "Grass", humanshape: "Human-Like", mineral: "Mineral",
  indeterminate: "Amorphous", ditto: "Ditto", dragon: "Dragon", "no-eggs": "Undiscovered"
};
const eggLabel = g => EGG_GROUP_LABEL[g] || title(g);

function genderText(rate) {
  if (rate === -1) return "Genderless";
  if (rate === 0) return "Always male";
  if (rate === 8) return "Always female";
  return `${(rate / 8 * 100).toFixed(1).replace(".0", "")}% female, ${((8 - rate) / 8 * 100).toFixed(1).replace(".0", "")}% male`;
}

function genderBar(rate) {
  if (rate === -1) return `<div class="gender-bar none"><span style="width:100%"></span></div>`;
  const f = rate / 8 * 100;
  return `<div class="gender-bar" role="img" aria-label="${genderText(rate)}"><span class="m" style="width:${100 - f}%"></span><span class="f" style="width:${f}%"></span></div>`;
}

async function babyOf(species) {
  if (!species.evolution_chain) return species.name;
  const chain = await get(species.evolution_chain.url);
  return chain.chain.species.name;
}

async function renderBreeding(body, query) {
  body.innerHTML = `
    <form class="compare-form" id="br-form">
      <label for="br-q" class="visually-hidden">Pokémon</label>
      <input id="br-q" type="search" list="name-suggestions" placeholder="Pokémon, e.g. eevee" value="${esc(query || "")}" autocomplete="off">
      <button type="submit">Show breeding info</button>
    </form>
    <div id="br-out">${query ? '<p class="status">Loading…</p>' : ""}</div>
    ${breedingGuide()}`;
  document.getElementById("br-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = cleanQuery(document.getElementById("br-q").value);
    if (q) location.hash = `tools/breeding/${q}`;
  });
  if (!query) {
    document.getElementById("br-out").innerHTML = `<p class="muted">Enter a Pokémon to see its egg groups, which Pokémon it can breed with, and what hatches from its eggs. Try <a class="text-link" href="#tools/breeding/eevee">Eevee</a> or <a class="text-link" href="#tools/breeding/garchomp">Garchomp</a>.</p>`;
    return;
  }

  const out = document.getElementById("br-out");
  let data;
  try { data = await loadSpeciesAndMon(query); }
  catch { out.innerHTML = `<p class="error">Couldn't find “${esc(query)}”. Check the spelling.</p>`; return; }
  const { species, mon } = data;
  const name = english(species.names) || title(species.name);
  const groups = species.egg_groups.map(g => g.name);
  const undiscovered = groups.includes("no-eggs");
  const isDitto = species.name === "ditto";
  const genderless = species.gender_rate === -1;
  const baby = await babyOf(species);

  let partnersHtml = "";
  if (isDitto) {
    partnersHtml = `<p>Ditto can breed with almost any Pokémon, including genderless ones, except those in the Undiscovered group and other Ditto. The egg is always the other Pokémon's species.</p>`;
  } else if (undiscovered) {
    partnersHtml = `<p><strong>${esc(name)} can't breed.</strong> ${species.is_baby ? "It's a baby Pokémon; evolve it first and breed the evolved form." : "Pokémon in the Undiscovered egg group (most Legendaries and Mythicals, among others) can't produce eggs."}</p>`;
  } else {
    const lists = await Promise.all(groups.map(g => get(`/egg-group/${g}`)));
    const sections = lists.map(l => {
      const list = l.pokemon_species.map(s => ({ name: s.name, id: idFromUrl(s.url) })).filter(s => s.name !== species.name).sort((a, b) => a.id - b.id);
      return `<h3>${esc(eggLabel(l.name))} group <span class="muted">(${list.length})</span></h3>
        <div class="mon-grid compact">${list.map(s => `<a class="mon-card" href="#tools/breeding/${s.name}" data-key="${s.name}">
          <img src="${SPRITE(s.id)}" alt="" loading="lazy" width="64" height="64"><span class="name">${esc(title(s.name))}</span></a>`).join("")}</div>`;
    }).join("");
    partnersHtml = genderless
      ? `<p><strong>${esc(name)} is genderless, so it can only breed with Ditto.</strong></p>`
      : `<p>${esc(name)} can breed with Ditto, or with any Pokémon of the opposite gender that shares an egg group with it.${
          species.gender_rate === 0 ? " It's always male, so its partner must be female (or Ditto)." : species.gender_rate === 8 ? " It's always female, so its partner must be male (or Ditto)." : ""}
          Genderless Pokémon listed in these groups can only breed with Ditto.</p>${sections}`;
  }

  out.innerHTML = `
    <section class="panel">
      <div class="calc-head">
        <img src="${artOf(mon)}" alt="">
        <div>
          <a href="#pokemon/${species.name}"><h2>${esc(name)}</h2></a>
          <div class="types">${mon.types.map(t => typeBadge(t.type.name)).join("")}</div>
        </div>
      </div>
      <dl class="facts">
        <div><dt>Egg groups</dt><dd>${groups.map(eggLabel).join(" / ")}</dd></div>
        <div><dt>Gender</dt><dd>${genderText(species.gender_rate)}</dd></div>
        <div><dt>Egg cycles</dt><dd>${species.hatch_counter ?? "—"}</dd></div>
        <div><dt>Hatches into</dt><dd>${undiscovered && !isDitto ? "—" : isDitto ? "Partner's species" : `<a href="#pokemon/${baby}">${esc(title(baby))}</a>`}</dd></div>
      </dl>
      ${genderBar(species.gender_rate)}
      <p class="note muted">An egg cycle is a set number of steps that varies by game. A Pokémon with Flame Body or Magma Armor in your party halves hatching time.${!undiscovered && baby !== species.name && !isDitto ? ` Some babies need the parent to hold an incense item to appear; otherwise the egg hatches into the next stage.` : ""}</p>
    </section>
    <section class="panel">
      <h2>Who it can breed with</h2>
      ${partnersHtml}
    </section>`;
}

function breedingGuide() {
  return `
  <section class="guide">
    <h2 class="grid-title">How breeding works</h2>
    <div class="guide-grid">
      <article class="panel">
        <h3 class="guide-title">The basics</h3>
        <ul class="plain">
          <li>Leave two compatible Pokémon at the Day Care / Nursery (or have a picnic in Scarlet/Violet) to get an egg.</li>
          <li>Compatible means: opposite genders <strong>and</strong> a shared egg group, or one of them is <strong>Ditto</strong>.</li>
          <li>The egg is the <strong>mother's</strong> species (or the non-Ditto parent's), at its lowest evolution stage.</li>
          <li>Undiscovered-group Pokémon (most Legendaries, babies) can't breed.</li>
        </ul>
      </article>
      <article class="panel">
        <h3 class="guide-title">Passing things down</h3>
        <ul class="plain">
          <li><strong>IVs:</strong> 3 are inherited from the parents, or 5 if a parent holds a <strong>Destiny Knot</strong>.</li>
          <li><strong>Nature:</strong> a parent holding an <strong>Everstone</strong> passes down its nature.</li>
          <li><strong>Egg moves:</strong> special moves the baby can learn only by breeding (listed under "Egg moves" in each Pokémon's Moves section) can be passed from a parent that knows them.</li>
          <li><strong>Hidden Ability:</strong> can be passed down from a parent that has it.</li>
          <li><strong>Poké Ball:</strong> usually the mother's ball is passed down.</li>
        </ul>
      </article>
      <article class="panel">
        <h3 class="guide-title">Shiny breeding</h3>
        <ul class="plain">
          <li>The <strong>Masuda Method</strong>: breed two Pokémon from games of different languages to boost shiny odds.</li>
          <li>From Gen 6 on, that's about <strong>1 in 683</strong>, or about <strong>1 in 512</strong> with the Shiny Charm.</li>
          <li>Track your egg hunt in <a class="text-link" href="#tracker/hunts">My tracker → Shiny hunts</a>.</li>
        </ul>
      </article>
    </div>
  </section>`;
}

/* ---------- Details page panel ---------- */

window.trainingPanel = (species, mon, name) => {
  const groups = species.egg_groups.map(g => eggLabel(g.name));
  return `
    <section class="panel wide">
      <div class="panel-head">
        <h2>Training &amp; breeding</h2>
        <span class="links-inline">
          <a class="text-link" href="#tools/stats/${mon.name}">Stat calculator →</a>
          <a class="text-link" href="#tools/breeding/${species.name}">Breeding info →</a>
        </span>
      </div>
      <dl class="facts">
        <div><dt>EV yield</dt><dd>${esc(evYield(mon))}</dd></div>
        <div><dt>Egg groups</dt><dd>${esc(groups.join(" / "))}</dd></div>
        <div><dt>Gender</dt><dd>${esc(genderText(species.gender_rate))}</dd></div>
        <div><dt>Egg cycles</dt><dd>${species.hatch_counter ?? "—"}</dd></div>
        <div><dt>Base friendship</dt><dd>${species.base_happiness ?? "—"}</dd></div>
        <div><dt>Growth rate</dt><dd>${esc(title(species.growth_rate?.name || "—"))}</dd></div>
      </dl>
      ${genderBar(species.gender_rate)}
      <p class="note muted">Defeating ${esc(name)} gives the EV yield above. See <a class="text-link" href="#tools/stats/${mon.name}">how IVs, EVs and natures work</a> and calculate its exact stats at any level.</p>
    </section>`;
};
