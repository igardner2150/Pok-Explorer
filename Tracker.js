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

function loadTracker() {
  try {
    const d = JSON.parse(localStorage.getItem(TRACKER_KEY)) || {};
    return { games: new Set(d.games || []), caught: new Set(d.caught || []), shiny: new Set(d.shiny || []) };
  } catch {
    return { games: new Set(), caught: new Set(), shiny: new Set() };
  }
}

function saveTracker(t) {
  try {
    localStorage.setItem(TRACKER_KEY, JSON.stringify({ games: [...t.games], caught: [...t.caught], shiny: [...t.shiny] }));
    return true;
  } catch {
    return false;
  }
}

let tracker = loadTracker();

function toggle(setName, value, on) {
  if (on) tracker[setName].add(value); else tracker[setName].delete(value);
  // Having a shiny means you have that Pokémon too.
  if (setName === "shiny" && on) tracker.caught.add(value);
  if (setName === "caught" && !on) tracker.shiny.delete(value);
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

async function renderTracker(tab) {
  tab = tab === "pokedex" ? "pokedex" : "games";
  tracker = loadTracker();   // pick up changes made in another tab
  setCrumbs([{ label: "My tracker", href: "#tracker" }, { label: tab === "games" ? "My games" : "Pokédex" }]);

  view.innerHTML = `
    <h1>My tracker</h1>
    <p class="lede">Check off the games you own and the Pokémon you've caught or have shiny. Your progress is saved in this browser on this device; use Export to back it up or move it to another device.</p>
    <div class="sub-tabs">
      <a class="sub-tab${tab === "games" ? " active" : ""}" href="#tracker/games">My games <span class="muted" id="games-count"></span></a>
      <a class="sub-tab${tab === "pokedex" ? " active" : ""}" href="#tracker/pokedex">Pokédex <span class="muted" id="dex-count"></span></a>
    </div>
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
        <span>Clear all games, caught and shiny checkmarks? This can't be undone.</span>
        <button type="button" id="reset-yes" class="danger">Yes, clear it</button>
        <button type="button" id="reset-no">Cancel</button>
      </div>
    </div>`;

  updateCounts();
  wireBackup();
  if (tab === "games") renderGamesTab(); else await renderDexTab();
}

function updateCounts() {
  const total = GAME_LIST.reduce((n, g) => n + g.games.length, 0);
  const gc = document.getElementById("games-count"), dc = document.getElementById("dex-count");
  if (gc) gc.textContent = `(${tracker.games.size}/${total})`;
  if (dc) dc.textContent = `(${tracker.caught.size} caught · ${tracker.shiny.size} shiny)`;
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

let dexFilter = { gen: "all", show: "all", q: "" };

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
    listEl.innerHTML = rows.length ? rows.map(p => `
      <div class="dex-row${tracker.caught.has(p.id) ? " is-caught" : ""}${tracker.shiny.has(p.id) ? " is-shiny" : ""}" data-id="${p.id}">
        <img src="${SPRITE(p.id)}" alt="" loading="lazy" width="56" height="56">
        <span class="num">${pad(p.id)}</span>
        <a href="#pokemon/${p.name}" class="dex-name">${esc(title(p.name))}</a>
        <label class="dex-check"><input type="checkbox" data-set="caught" ${tracker.caught.has(p.id) ? "checked" : ""}><span>Caught</span></label>
        <label class="dex-check shiny"><input type="checkbox" data-set="shiny" ${tracker.shiny.has(p.id) ? "checked" : ""}><span>Shiny ★</span></label>
      </div>`).join("") : '<p class="muted">Nothing matches these filters.</p>';
    drawProgress();
  }

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
    const data = JSON.stringify({ app: "poke-explorer", version: 1, exported: new Date().toISOString(),
      games: [...tracker.games], caught: [...tracker.caught], shiny: [...tracker.shiny] }, null, 2);
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
      tracker = {
        games: new Set((d.games || []).filter(g => typeof g === "string")),
        caught: new Set(d.caught.map(Number).filter(Number.isInteger)),
        shiny: new Set(d.shiny.map(Number).filter(Number.isInteger))
      };
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
    tracker = { games: new Set(), caught: new Set(), shiny: new Set() };
    saveTracker(tracker);
    flash("All progress cleared.");
    route();
  });
}
