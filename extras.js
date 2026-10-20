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

/* ---------- Team builder ---------- */

const TEAM_KEY = "pokeExplorerTeam";
function loadTeam() {
  try { const t = JSON.parse(localStorage.getItem(TEAM_KEY)); if (Array.isArray(t)) return [...t, "", "", "", "", "", ""].slice(0, 6); } catch {}
  return ["", "", "", "", "", ""];
}
function saveTeam(team) { try { localStorage.setItem(TEAM_KEY, JSON.stringify(team)); } catch {} }

// A shared team arrives as #team/garchomp,rotom-wash,… and is shown without touching the viewer's own saved team.
async function renderTeam(shared) {
  setCrumbs([{ label: "Battle", href: "#gimmicks" }, { label: shared ? "Shared team" : "Team builder" }]);
  const sharedList = shared ? shared.split(",").map(cleanQuery).filter(Boolean).slice(0, 6) : null;
  const team = sharedList ? [...sharedList, "", "", "", "", "", ""].slice(0, 6) : loadTeam();
  const filledNames = team.filter(Boolean);
  view.innerHTML = `
    <div class="page-head">
      <div>
        <h1>${sharedList ? "Shared team" : "Team builder"}</h1>
        <p class="lede">${sharedList
          ? "Someone shared this team with you. Save it to make it your own and edit it."
          : "Pick up to six Pokémon (regional forms work too, e.g. ninetales-alola). The charts show which attacking types your team struggles against and which types your STAB moves can't hit hard."}</p>
      </div>
      <div class="page-actions">
        ${sharedList ? `<button type="button" class="btn" id="team-save">Save as my team</button>` : ""}
        ${filledNames.length ? `<button type="button" class="btn ghost" id="team-share">Share this team</button>` : ""}
      </div>
    </div>
    ${sharedList ? "" : hintBox("team")}
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
    const link = `${location.origin}${location.pathname}#team/${filledNames.join(",")}`;
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

  const td = await allTypeData();
  const members = await Promise.all(team.map(async name => {
    if (!name) return null;
    try { const { species, mon } = await loadSpeciesAndMon(name); return { name, species, mon, types: mon.types.map(t => t.type.name) }; }
    catch { return { name, error: true }; }
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
        ${sharedList ? "" : `<button type="button" class="remove" data-remove="${i}">Remove</button>`}
      </div>`;
  }).join("");

  slotsEl.querySelectorAll("form.team-slot").forEach(form => form.addEventListener("submit", e => {
    e.preventDefault();
    const v = cleanQuery(form.querySelector("input").value);
    if (!v) return;
    team[Number(form.dataset.slot)] = v;
    saveTeam(team);
    renderTeam();
  }));
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
  const threats = rows.filter(r => r.threat).sort((a, b) => b.weak - a.weak);
  const gaps = offense.filter(o => o.best <= 1);

  out.innerHTML = `
    <div class="sections">
      <section class="panel">
        <h2>Biggest threats</h2>
        ${threats.length ? `<ul class="plain">${threats.map(r => `<li>${typeBadge(r.atk)} hits <strong>${r.weak}</strong> of your Pokémon super effectively${r.resist ? `, ${r.resist} resist it` : ", and nothing resists it"}.</li>`).join("")}</ul>`
          : `<p>No attacking type hits three or more of your Pokémon super effectively. Nice balance.</p>`}
      </section>
      <section class="panel">
        <h2>Coverage gaps</h2>
        ${gaps.length ? `<p class="muted">Types your team's STAB moves can't hit super effectively:</p><div class="types">${gaps.map(g => typeBadge(g.def)).join("")}</div>
          <p class="note muted">Give someone a move that covers these, like a coverage TM.</p>`
          : `<p>Your STAB types hit every type super effectively. Full coverage.</p>`}
      </section>

      <section class="panel wide">
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

      <section class="panel wide">
        <h2>Offensive coverage (STAB)</h2>
        <p class="muted">For each defending type, which of your Pokémon can hit it super effectively with a move of its own type.</p>
        <div class="table-wrap"><table class="data-table wrap">
          <thead><tr><th>Defending type</th><th>Best</th><th>Who hits it super effectively</th></tr></thead>
          <tbody>${offense.map(o => `<tr><td>${typeBadge(o.def)}</td><td class="${o.best > 1 ? "good-cell" : o.best < 1 ? "m2" : ""}">×${multText(o.best) || "1"}</td>
            <td>${o.hitters.length ? o.hitters.map(m => esc(monLabel(m.species, m.mon))).join(", ") : '<span class="muted">Nobody</span>'}</td></tr>`).join("")}</tbody>
        </table></div>
      </section>
    </div>`;
}

/* ---------- Tools tab ---------- */

const TOOL_INTRO = {
  compare: "Put two Pokémon side by side: stats, types, abilities and who hits whom harder.",
  typechart: "Every type matchup in one chart, plus a calculator for dual types.",
  search: "Find Pokémon by type, generation and minimum stats.",
  stats: "Work out a Pokémon's exact stats from its level, IVs, EVs and nature, and learn how each one works.",
  abilities: "Look up any ability and every Pokémon that can have it.",
  moves: "Look up any move and every Pokémon that can learn it.",
  items: "Browse every item by bag pocket and category, or look one up directly.",
  breeding: "Egg groups, compatible partners and what hatches, plus how breeding works.",
  quiz: "Name the Pokémon from its silhouette. How long can you keep your streak going?"
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
let searchState = { type1: "", type2: "", gen: "", stat: "", min: "", sort: "id", forms: false };

async function renderSearch(body) {
  const st = searchState;
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
    const img = document.getElementById("q-img");
    img.classList.remove("revealed");
    img.src = OFFICIAL_ART(pick.id);
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
