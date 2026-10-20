/*
 * Poké Explorer — My tracker tab (#tracker/games, #tracker/pokedex)
 * Lets each player track the games they own and which Pokémon they've caught / have shiny.
 * Saved in the player's own browser (localStorage), with Export / Import for backups.
 * Uses helpers from app.js (get, title, esc, SPRITE, pad, setCrumbs, view).
 */

const TRACKER_KEY = "pokeExplorerTracker";

// Main-series games. Keys match PokéAPI version names so they line up with the "Games" and shiny-odds data.
const GAME_LIST = [
  { gen: 1, platform: "Game Boy", games: [["red", "Red"], ["blue", "Blue"], ["yellow", "Yellow"]] },
  { gen: 2, platform: "Game Boy Color", games: [["gold", "Gold"], ["silver", "Silver"], ["crystal", "Crystal"]] },
  { gen: 3, platform: "Game Boy Advance / GameCube", games: [["ruby", "Ruby"], ["sapphire", "Sapphire"], ["emerald", "Emerald"],
    ["firered", "FireRed"], ["leafgreen", "LeafGreen"], ["colosseum", "Colosseum"], ["xd", "XD: Gale of Darkness"]] },
  { gen: 4, platform: "Nintendo DS", games: [["diamond", "Diamond"], ["pearl", "Pearl"], ["platinum", "Platinum"],
    ["heartgold", "HeartGold"], ["soulsilver", "SoulSilver"]] },
  { gen: 5, platform: "Nintendo DS", games: [["black", "Black"], ["white", "White"], ["black-2", "Black 2"], ["white-2", "White 2"]] },
  { gen: 6, platform: "Nintendo 3DS", games: [["x", "X"], ["y", "Y"], ["omega-ruby", "Omega Ruby"], ["alpha-sapphire", "Alpha Sapphire"]] },
  { gen: 7, platform: "Nintendo 3DS / Switch", games: [["sun", "Sun"], ["moon", "Moon"], ["ultra-sun", "Ultra Sun"], ["ultra-moon", "Ultra Moon"],
    ["lets-go-pikachu", "Let's Go, Pikachu!"], ["lets-go-eevee", "Let's Go, Eevee!"]] },
  { gen: 8, platform: "Nintendo Switch", games: [["sword", "Sword"], ["shield", "Shield"], ["brilliant-diamond", "Brilliant Diamond"],
    ["shining-pearl", "Shining Pearl"], ["legends-arceus", "Legends: Arceus"]] },
  { gen: 9, platform: "Nintendo Switch", games: [["scarlet", "Scarlet"], ["violet", "Violet"], ["legends-za", "Legends: Z-A"]] }
];
const GAME_LABEL = Object.fromEntries(GAME_LIST.flatMap(g => g.games));

// National Pokédex number ranges per generation.
const GEN_RANGES = [[1, 151], [152, 251], [252, 386], [387, 493], [494, 649], [650, 721], [722, 809], [810, 905], [906, 1025]];
const genOf = id => GEN_RANGES.findIndex(([a, b]) => id >= a && id <= b) + 1 || GEN_RANGES.length;
const GEN_NAMES = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova", "Kalos", "Alola", "Galar / Hisui", "Paldea"];

/* ---------- Storage ---------- */

// caught / shiny hold National Pokédex numbers; formCaught / formShiny hold form names (e.g. "vulpix-alola").
function fromData(d = {}) {
  return {
    games: new Set((d.games || []).filter(g => typeof g === "string")),
    caught: new Set((d.caught || []).map(Number).filter(Number.isInteger)),
    shiny: new Set((d.shiny || []).map(Number).filter(Number.isInteger)),
    formCaught: new Set((d.formCaught || []).filter(f => typeof f === "string")),
    formShiny: new Set((d.formShiny || []).filter(f => typeof f === "string")),
    hunts: Array.isArray(d.hunts) ? d.hunts.filter(h => h && typeof h.pokemon === "string") : []
  };
}
const toData = t => ({ games: [...t.games], caught: [...t.caught], shiny: [...t.shiny],
  formCaught: [...t.formCaught], formShiny: [...t.formShiny], hunts: t.hunts });

function loadTracker() {
  try { return fromData(JSON.parse(localStorage.getItem(TRACKER_KEY)) || {}); }
  catch { return fromData(); }
}

function saveTracker(t) {
  try { localStorage.setItem(TRACKER_KEY, JSON.stringify(toData(t))); return true; }
  catch { return false; }
}

let tracker = loadTracker();

function toggle(setName, value, on) {
  if (on) tracker[setName].add(value); else tracker[setName].delete(value);
  // Having a shiny means you have that Pokémon too.
  if (setName === "shiny" && on) tracker.caught.add(value);
  if (setName === "caught" && !on) tracker.shiny.delete(value);
  if (setName === "formShiny" && on) tracker.formCaught.add(value);
  if (setName === "formCaught" && !on) tracker.formShiny.delete(value);
  if (!saveTracker(tracker)) flash("Your browser blocked saving. Progress will be lost when you close this tab.");
}

/* ---------- Small shared pieces (used by app.js too) ---------- */

// Badges on Pokémon cards in region lists.
window.trackBadges = id => {
  const c = tracker.caught.has(id), s = tracker.shiny.has(id);
  return c || s ? `<span class="track-badges">${c ? '<span class="tb caught" title="Caught">✓</span>' : ""}${s ? '<span class="tb shiny" title="Shiny">★</span>' : ""}</span>` : "";
};

// Toggle buttons on a Pokémon's details page.
window.trackerToggles = id => `
  <div class="track-toggles" data-id="${id}">
    <label class="track-toggle"><input type="checkbox" data-set="caught" ${tracker.caught.has(id) ? "checked" : ""}> I have it</label>
    <label class="track-toggle shiny"><input type="checkbox" data-set="shiny" ${tracker.shiny.has(id) ? "checked" : ""}> I have it shiny ★</label>
  </div>`;

window.wireTrackerToggles = () => {
  document.querySelectorAll(".track-toggles").forEach(box => {
    const id = Number(box.dataset.id);
    box.addEventListener("change", e => {
      const set = e.target.dataset.set;
      if (!set) return;
      toggle(set, id, e.target.checked);
      box.querySelector('[data-set="caught"]').checked = tracker.caught.has(id);
      box.querySelector('[data-set="shiny"]').checked = tracker.shiny.has(id);
    });
  });
};

window.ownsGame = version => tracker.games.has(version);

function flash(msg) {
  let el = document.getElementById("flash");
  if (!el) { el = document.createElement("div"); el.id = "flash"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(flash.t);
  flash.t = setTimeout(() => el.classList.remove("show"), 2600);
}

/* ---------- Page ---------- */

const TRACKER_TABS = [["games", "My games"], ["pokedex", "Pokédex"], ["forms", "Forms"], ["hunts", "Shiny hunts"]];

async function renderTracker(tab) {
  tab = TRACKER_TABS.some(([id]) => id === tab) ? tab : "games";
  tracker = loadTracker();   // pick up changes made in another tab
  setCrumbs([{ label: "My tracker", href: "#tracker" }, { label: TRACKER_TABS.find(([id]) => id === tab)[1] }]);

  view.innerHTML = `
    <h1>My tracker</h1>
    <p class="lede">Check off the games you own and the Pokémon you've caught or have shiny. Your progress is saved in this browser on this device; use Export to back it up or move it to another device.</p>
    ${hintBox("tracker-" + tab)}
    <div id="tracker-body"><p class="status">Loading…</p></div>
    <div class="backup">
      <h2>Backup</h2>
      <p class="muted">Export saves a file with all your checkmarks. Import loads one back in and replaces what's here.</p>
      <div class="backup-actions">
        <button type="button" id="export-btn">Export progress</button>
        <label class="import-btn">Import progress<input type="file" id="import-file" accept="application/json,.json" hidden></label>
        <button type="button" id="reset-btn" class="danger">Clear everything</button>
      </div>
      <div id="reset-confirm" hidden class="confirm">
        <span>Clear all games, caught and shiny checkmarks, forms and shiny hunts? This can't be undone.</span>
        <button type="button" id="reset-yes" class="danger">Yes, clear it</button>
        <button type="button" id="reset-no">Cancel</button>
      </div>
    </div>`;

  updateCounts();
  wireBackup();
  if (tab === "games") renderGamesTab();
  else if (tab === "pokedex") await renderDexTab();
  else if (tab === "forms") await renderFormsTab();
  else await renderHuntsTab();
}

function updateCounts() {
  const total = GAME_LIST.reduce((n, g) => n + g.games.length, 0);
  const gc = document.getElementById("games-count"), dc = document.getElementById("dex-count");
  if (gc) gc.textContent = `(${tracker.games.size}/${total})`;
  if (dc) dc.textContent = `(${tracker.caught.size} caught · ${tracker.shiny.size} shiny)`;
  const fc = document.getElementById("forms-count"), hc = document.getElementById("hunts-count");
  if (fc) fc.textContent = `(${tracker.formCaught.size})`;
  if (hc) hc.textContent = `(${tracker.hunts.filter(h => !h.found).length} active)`;
}

function renderGamesTab() {
  const body = document.getElementById("tracker-body");
  const total = GAME_LIST.reduce((n, g) => n + g.games.length, 0);
  body.innerHTML = `
    ${progress("Games owned", tracker.games.size, total, "games")}
    <div class="game-gens">
      ${GAME_LIST.map(g => `
        <section class="game-gen">
          <h3>Generation ${g.gen} <span class="muted">· ${esc(g.platform)}</span></h3>
          <div class="game-checks">
            ${g.games.map(([key, label]) => `
              <label class="game-check">
                <input type="checkbox" data-game="${key}" ${tracker.games.has(key) ? "checked" : ""}>
                <span>${esc(label)}</span>
              </label>`).join("")}
          </div>
        </section>`).join("")}
    </div>`;
  body.addEventListener("change", e => {
    const key = e.target.dataset.game;
    if (!key) return;
    toggle("games", key, e.target.checked);
    body.querySelector(".progress[data-kind=games]").outerHTML = progress("Games owned", tracker.games.size, total, "games");
    updateCounts();
  });
}

function progress(label, n, total, kind) {
  const pct = total ? Math.round(n / total * 100) : 0;
  return `<div class="progress" data-kind="${kind}">
    <div class="progress-label"><span>${esc(label)}</span><strong>${n} / ${total} <span class="muted">(${pct}%)</span></strong></div>
    <div class="bar"><span style="width:${pct}%"></span></div>
  </div>`;
}

let dexFilter = { gen: "all", show: "all", q: "", view: "list" };

async function renderDexTab() {
  const body = document.getElementById("tracker-body");
  const list = await get("/pokemon-species?limit=2000");
  const all = list.results.map(s => ({ name: s.name, id: idFromUrl(s.url) })).sort((a, b) => a.id - b.id);

  body.innerHTML = `
    <div class="progress-pair" id="dex-progress"></div>
    <div class="dex-tools">
      <label class="visually-hidden" for="dex-q">Search</label>
      <input id="dex-q" type="search" placeholder="Search name or #" value="${esc(dexFilter.q)}" autocomplete="off">
      <label class="visually-hidden" for="dex-gen">Generation</label>
      <select id="dex-gen">
        <option value="all">All generations</option>
        ${GEN_NAMES.map((n, i) => `<option value="${i + 1}" ${String(i + 1) === dexFilter.gen ? "selected" : ""}>Gen ${i + 1} · ${n}</option>`).join("")}
      </select>
      <label class="visually-hidden" for="dex-show">Show</label>
      <select id="dex-show">
        <option value="all">Show all</option>
        <option value="missing">Missing (not caught)</option>
        <option value="caught">Caught</option>
        <option value="no-shiny">No shiny yet</option>
        <option value="shiny">Shiny</option>
      </select>
      <span class="count" id="dex-shown"></span>
      <div class="view-toggle" role="group" aria-label="View">
        <button type="button" data-view="list" class="${dexFilter.view === "list" ? "active" : ""}">List</button>
        <button type="button" data-view="boxes" class="${dexFilter.view === "boxes" ? "active" : ""}">Boxes</button>
      </div>
    </div>
    <div class="dex-list" id="dex-list"></div>`;
  document.getElementById("dex-show").value = dexFilter.show;

  const listEl = document.getElementById("dex-list");

  function drawProgress() {
    const scope = dexFilter.gen === "all" ? all : all.filter(p => String(genOf(p.id)) === dexFilter.gen);
    const label = dexFilter.gen === "all" ? "National Pokédex" : `Gen ${dexFilter.gen} · ${GEN_NAMES[dexFilter.gen - 1]}`;
    document.getElementById("dex-progress").innerHTML =
      progress(`Caught · ${label}`, scope.filter(p => tracker.caught.has(p.id)).length, scope.length, "caught") +
      progress(`Shiny · ${label}`, scope.filter(p => tracker.shiny.has(p.id)).length, scope.length, "shiny");
    updateCounts();
  }

  function draw() {
    const q = dexFilter.q.trim().toLowerCase().replace(/^#?0*/, "");
    const rows = all.filter(p =>
      (dexFilter.gen === "all" || String(genOf(p.id)) === dexFilter.gen) &&
      (!q || p.name.includes(q) || String(p.id).startsWith(q)) &&
      (dexFilter.show === "all" ||
       (dexFilter.show === "missing" && !tracker.caught.has(p.id)) ||
       (dexFilter.show === "caught" && tracker.caught.has(p.id)) ||
       (dexFilter.show === "no-shiny" && !tracker.shiny.has(p.id)) ||
       (dexFilter.show === "shiny" && tracker.shiny.has(p.id))));
    document.getElementById("dex-shown").textContent = `${rows.length} shown`;
    listEl.classList.toggle("boxes", dexFilter.view === "boxes");
    if (dexFilter.view === "boxes") { listEl.innerHTML = boxView(rows); drawProgress(); return; }
    listEl.innerHTML = rows.length ? rows.map(p => `
      <div class="dex-row${tracker.caught.has(p.id) ? " is-caught" : ""}${tracker.shiny.has(p.id) ? " is-shiny" : ""}" data-id="${p.id}">
        <img src="${SPRITE(p.id)}" alt="" loading="lazy" width="56" height="56">
        <span class="num">${pad(p.id)}</span>
        <a href="#pokemon/${p.name}" class="dex-name">${esc(pokeName(p.name))}</a>
        <label class="dex-check"><input type="checkbox" data-set="caught" ${tracker.caught.has(p.id) ? "checked" : ""}><span>Caught</span></label>
        <label class="dex-check shiny"><input type="checkbox" data-set="shiny" ${tracker.shiny.has(p.id) ? "checked" : ""}><span>Shiny ★</span></label>
      </div>`).join("") : '<p class="muted">Nothing matches these filters.</p>';
    drawProgress();
  }

  // Box view: click a slot to mark it caught; click again to mark it shiny; once more to clear.
  listEl.addEventListener("click", e => {
    const slot = e.target.closest(".box-slot[data-id]");
    if (!slot) return;
    const id = Number(slot.dataset.id);
    if (!tracker.caught.has(id)) toggle("caught", id, true);
    else if (!tracker.shiny.has(id)) toggle("shiny", id, true);
    else toggle("caught", id, false);
    slot.className = slotClass(id);
    slot.title = slotTitle(slot.dataset.name, id);
    drawProgress();
  });
  body.querySelectorAll(".view-toggle button").forEach(b => b.addEventListener("click", () => {
    dexFilter.view = b.dataset.view;
    body.querySelectorAll(".view-toggle button").forEach(x => x.classList.toggle("active", x === b));
    draw();
  }));

  listEl.addEventListener("change", e => {
    const set = e.target.dataset.set;
    if (!set) return;
    const row = e.target.closest(".dex-row");
    const id = Number(row.dataset.id);
    toggle(set, id, e.target.checked);
    row.querySelector('[data-set="caught"]').checked = tracker.caught.has(id);
    row.querySelector('[data-set="shiny"]').checked = tracker.shiny.has(id);
    row.classList.toggle("is-caught", tracker.caught.has(id));
    row.classList.toggle("is-shiny", tracker.shiny.has(id));
    drawProgress();
  });
  document.getElementById("dex-q").addEventListener("input", e => { dexFilter.q = e.target.value; draw(); });
  document.getElementById("dex-gen").addEventListener("change", e => { dexFilter.gen = e.target.value; draw(); });
  document.getElementById("dex-show").addEventListener("change", e => { dexFilter.show = e.target.value; draw(); });
  draw();
}

function wireBackup() {
  document.getElementById("export-btn").addEventListener("click", () => {
    const data = JSON.stringify({ app: "poke-explorer", version: 2, exported: new Date().toISOString(), ...toData(tracker) }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `poke-explorer-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    flash("Progress exported.");
  });

  document.getElementById("import-file").addEventListener("change", async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.caught) || !Array.isArray(d.shiny)) throw new Error();
      tracker = fromData(d);
      saveTracker(tracker);
      flash(`Imported ${tracker.games.size} games, ${tracker.caught.size} caught and ${tracker.shiny.size} shiny.`);
      route();
    } catch {
      flash("That file isn't a Poké Explorer export. Choose a file made with Export progress.");
    }
    e.target.value = "";
  });

  const confirmBox = document.getElementById("reset-confirm");
  document.getElementById("reset-btn").addEventListener("click", () => (confirmBox.hidden = false));
  document.getElementById("reset-no").addEventListener("click", () => (confirmBox.hidden = true));
  document.getElementById("reset-yes").addEventListener("click", () => {
    tracker = fromData();
    saveTracker(tracker);
    flash("All progress cleared.");
    route();
  });
}

/* ---------- Box view ---------- */

const slotClass = id => `box-slot${tracker.caught.has(id) ? " caught" : ""}${tracker.shiny.has(id) ? " shiny" : ""}`;
const slotTitle = (name, id) => `${pad(id)} ${pokeName(name)}: ${tracker.shiny.has(id) ? "shiny" : tracker.caught.has(id) ? "caught" : "not caught"} (click to change)`;

// Living Dex boxes: 30 slots each, in National Pokédex order, like the in-game PC.
function boxView(rows) {
  if (!rows.length) return '<p class="muted">Nothing matches these filters.</p>';
  const byBox = new Map();
  rows.forEach(p => {
    const box = Math.floor((p.id - 1) / 30) + 1;
    if (!byBox.has(box)) byBox.set(box, []);
    byBox.get(box).push(p);
  });
  return `<p class="muted box-help">Click a slot once for caught, twice for shiny, three times to clear. Faded slots are missing.</p>` +
    [...byBox].map(([box, list]) => {
      const first = (box - 1) * 30 + 1;
      const slots = Array.from({ length: 30 }, (_, i) => list.find(p => p.id === first + i) || null);
      return `<section class="pc-box">
        <h3>Box ${box} <span class="muted">${pad(first)}–${pad(Math.min(first + 29, 1025))} · ${list.filter(p => tracker.caught.has(p.id)).length}/${list.length}</span></h3>
        <div class="box-grid">${slots.map(p => p
          ? `<button type="button" class="${slotClass(p.id)}" data-id="${p.id}" data-name="${p.name}" title="${esc(slotTitle(p.name, p.id))}"><img src="${SPRITE(p.id)}" alt="${esc(pokeName(p.name))}" loading="lazy"></button>`
          : `<span class="box-slot empty"></span>`).join("")}</div>
      </section>`;
    }).join("");
}

/* ---------- Forms tab: regional and Gigantamax forms ---------- */

async function renderFormsTab() {
  const body = document.getElementById("tracker-body");
  body.innerHTML = `<p class="status">Loading forms…</p>`;
  const [regional, all] = await Promise.all([regionalForms(), getAllPokemon()]);
  const gmax = all.results.filter(p => /-gmax$/.test(p.name)).map(p => ({ name: p.name, id: idFromUrl(p.url), label: gimmickLabel(p.name) }));
  const groups = [
    ...Object.keys(REGIONAL).map(r => [`${REGIONAL[r]} forms`, regional.filter(f => f.region === r)]),
    ["Gigantamax forms", gmax]
  ].filter(([, list]) => list.length);
  const allForms = groups.flatMap(([, list]) => list);

  body.innerHTML = `
    <div class="progress-pair" id="form-progress"></div>
    ${groups.map(([label, list]) => `
      <section class="form-track">
        <h3>${esc(label)} <span class="muted" data-group-count></span></h3>
        <div class="dex-list">${list.map(f => `
          <div class="dex-row${tracker.formCaught.has(f.name) ? " is-caught" : ""}${tracker.formShiny.has(f.name) ? " is-shiny" : ""}" data-form="${f.name}">
            ${spriteImg(f.id, 56)}
            <span class="num">Form</span>
            <a href="#pokemon/${f.name}" class="dex-name">${esc(f.label)}</a>
            <label class="dex-check"><input type="checkbox" data-set="formCaught" ${tracker.formCaught.has(f.name) ? "checked" : ""}><span>Caught</span></label>
            <label class="dex-check shiny"><input type="checkbox" data-set="formShiny" ${tracker.formShiny.has(f.name) ? "checked" : ""}><span>Shiny ★</span></label>
          </div>`).join("")}</div>
      </section>`).join("")}`;

  const drawProgress = () => {
    document.getElementById("form-progress").innerHTML =
      progress("Forms caught", allForms.filter(f => tracker.formCaught.has(f.name)).length, allForms.length, "caught") +
      progress("Forms shiny", allForms.filter(f => tracker.formShiny.has(f.name)).length, allForms.length, "shiny");
    updateCounts();
  };
  body.addEventListener("change", e => {
    const set = e.target.dataset.set;
    if (!set) return;
    const row = e.target.closest(".dex-row");
    const name = row.dataset.form;
    toggle(set, name, e.target.checked);
    row.querySelector('[data-set="formCaught"]').checked = tracker.formCaught.has(name);
    row.querySelector('[data-set="formShiny"]').checked = tracker.formShiny.has(name);
    row.classList.toggle("is-caught", tracker.formCaught.has(name));
    row.classList.toggle("is-shiny", tracker.formShiny.has(name));
    drawProgress();
  });
  drawProgress();
}

/* ---------- Shiny hunts ---------- */

// Games with shiny odds, newest first, for the hunt form.
const HUNT_GAMES = GAME_LIST.slice().reverse().flatMap(g => g.games).filter(([key]) => SHINY[key]?.base);

function huntOdds(h) {
  const row = SHINY[h.game];
  if (!row?.base) return null;
  return h.charm && row.charm ? row.charm : row.base;
}
// Chance of at least one shiny after n encounters at 1/N odds.
const chanceBy = (n, N) => 1 - Math.pow(1 - 1 / N, n);

function saveHunts() {
  if (!saveTracker(tracker)) flash("Your browser blocked saving. Progress will be lost when you close this tab.");
  updateCounts();
}

async function renderHuntsTab() {
  const body = document.getElementById("tracker-body");
  const owned = HUNT_GAMES.filter(([k]) => tracker.games.has(k));
  const gameOptions = (owned.length ? [["", "— Games you own —"], ...owned, ["", "— All games —"]] : []).concat(HUNT_GAMES)
    .map(([k, l]) => k ? `<option value="${k}">${esc(l)}</option>` : `<option disabled>${esc(l)}</option>`).join("");

  body.innerHTML = `
    <form class="hunt-form panel" id="hunt-form">
      <h2>Start a shiny hunt</h2>
      <div class="hunt-fields">
        <div><label for="hunt-mon">Pokémon</label><input id="hunt-mon" type="search" list="name-suggestions" placeholder="e.g. ralts" autocomplete="off" required></div>
        <div><label for="hunt-game">Game</label><select id="hunt-game">${gameOptions}</select></div>
        <label class="check"><input type="checkbox" id="hunt-charm"> I have the Shiny Charm</label>
        <button type="submit">Start hunt</button>
      </div>
      <p class="muted note" id="hunt-odds-note"></p>
    </form>
    <div id="hunt-list"></div>`;

  const gameSel = document.getElementById("hunt-game"), charm = document.getElementById("hunt-charm");
  const note = () => {
    const row = SHINY[gameSel.value];
    charm.disabled = !row?.charm;
    if (charm.disabled) charm.checked = false;
    document.getElementById("hunt-odds-note").textContent = row
      ? `Odds in ${GAME_LABEL[gameSel.value]}: 1 in ${row.base.toLocaleString()}${row.charm ? `, or 1 in ${row.charm.toLocaleString()} with the Shiny Charm` : " (no Shiny Charm in this game)"}.`
      : "";
  };
  gameSel.addEventListener("change", note);
  note();

  document.getElementById("hunt-form").addEventListener("submit", async e => {
    e.preventDefault();
    const q = document.getElementById("hunt-mon").value.trim().toLowerCase().replace(/[.']/g, "").replace(/\s+/g, "-");
    if (!q) return;
    try {
      const { species, mon } = await loadSpeciesAndMon(q);
      tracker.hunts.unshift({ id: Date.now(), pokemon: mon.name, speciesId: species.id, monId: mon.id,
        label: english(species.names) || title(species.name), game: gameSel.value, charm: charm.checked, count: 0, started: new Date().toISOString() });
      saveHunts();
      document.getElementById("hunt-mon").value = "";
      drawHunts();
    } catch {
      flash(`Couldn't find “${q}”. Check the spelling.`);
    }
  });

  const list = document.getElementById("hunt-list");
  function huntCard(h) {
    const N = huntOdds(h);
    const pct = N ? chanceBy(h.count, N) * 100 : 0;
    const shinySprite = `${SPRITE_BASE}/shiny/${h.monId}.png`;
    return `
      <article class="hunt panel${h.found ? " found" : ""}" data-hunt="${h.id}">
        <div class="hunt-head">
          <img src="${shinySprite}" alt="Shiny ${esc(h.label)}" onerror="this.src='${SPRITE(h.monId)}'">
          <div>
            <h3><a href="#pokemon/${h.pokemon}">${esc(h.label)}</a> ${h.found ? '<span class="badge">Found ★</span>' : ""}</h3>
            <p class="muted">${esc(GAME_LABEL[h.game] || h.game)} · ${N ? `1 in ${N.toLocaleString()}` : "no shinies"}${h.charm ? " · Shiny Charm" : ""}</p>
          </div>
        </div>
        <div class="hunt-count">
          <span class="hunt-num">${h.count.toLocaleString()}</span><span class="muted">encounters</span>
        </div>
        ${N ? `
          <div class="bar"><span style="width:${Math.min(100, h.count / N * 100)}%"></span></div>
          <p class="hunt-stats">After ${h.count.toLocaleString()} encounters you had a <strong>${pct < 0.1 && h.count ? "<0.1" : pct.toFixed(1)}%</strong> chance of seeing one.
            ${h.count < N ? `On average a shiny takes ${N.toLocaleString()} encounters.` : `You're past the average of ${N.toLocaleString()}. Keep going!`}</p>` : ""}
        ${h.found ? `<p class="muted">Found ${h.foundAt ? new Date(h.foundAt).toLocaleDateString() : ""} after ${h.count.toLocaleString()} encounters.</p>` : `
        <div class="hunt-actions">
          <button type="button" class="big" data-act="1">+1</button>
          <button type="button" data-act="10">+10</button>
          <button type="button" data-act="-1">−1</button>
          <button type="button" class="found-btn" data-act="found">Found it! ★</button>
        </div>`}
        <div class="hunt-foot">
          <button type="button" class="link-btn" data-act="delete">Delete hunt</button>
          <span class="confirm-inline" hidden>Delete this hunt? <button type="button" class="link-btn danger" data-act="delete-yes">Yes, delete</button> <button type="button" class="link-btn" data-act="delete-no">Cancel</button></span>
        </div>
      </article>`;
  }

  function drawHunts() {
    const active = tracker.hunts.filter(h => !h.found), done = tracker.hunts.filter(h => h.found);
    list.innerHTML = tracker.hunts.length ? `
      ${active.length ? `<h2 class="grid-title">Active hunts</h2><div class="hunt-grid">${active.map(huntCard).join("")}</div>` : ""}
      ${done.length ? `<h2 class="grid-title">Completed</h2><div class="hunt-grid">${done.map(huntCard).join("")}</div>` : ""}`
      : `<p class="muted">No hunts yet. Start one above, then tap +1 for every encounter (or every egg, reset or outbreak Pokémon).</p>`;
    updateCounts();
  }

  list.addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;
    const card = btn.closest("[data-hunt]");
    const h = tracker.hunts.find(x => String(x.id) === card.dataset.hunt);
    if (!h) return;
    const act = btn.dataset.act;
    if (act === "delete") { card.querySelector(".confirm-inline").hidden = false; return; }
    if (act === "delete-no") { card.querySelector(".confirm-inline").hidden = true; return; }
    if (act === "delete-yes") tracker.hunts = tracker.hunts.filter(x => x !== h);
    else if (act === "found") {
      h.found = true; h.foundAt = new Date().toISOString();
      if (h.speciesId) toggle("shiny", h.speciesId, true);
      if (h.pokemon !== undefined && h.speciesId && h.monId !== h.speciesId) toggle("formShiny", h.pokemon, true);
      flash(`Congrats on your shiny ${h.label}! It's marked shiny in your Pokédex.`);
    } else {
      h.count = Math.max(0, h.count + Number(act));
    }
    saveHunts();
    drawHunts();
    const again = list.querySelector(`[data-hunt="${h.id}"] [data-act="${act}"]`);
    if (again) again.focus();
  });
  drawHunts();
}
