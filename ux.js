/*
 * Poké Explorer — everyday conveniences:
 * search dropdown, favorites and recently viewed, previous/next Pokémon, metric/imperial units, share links,
 * first-time hints, remembered sections, type pages, and color-contrast checking.
 * Uses helpers from the other scripts (get, esc, title, pokeName, moveName, itemName, typeBadge, SPRITE, pad, flash…).
 */

/* =========================================================================
   Small storage helpers (every read and write survives private mode and corrupted data)
   ========================================================================= */

function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

/* =========================================================================
   Filters that stay set until the visitor clears them
   ========================================================================= */

const FILTERS_KEY = "pokeExplorerFilters";

// Saved values for one page's filters, or {} if none were saved.
const savedFilters = key => readJSON(FILTERS_KEY, {})[key] || {};

// Stores a page's filter values; drops the entry when every value is back to its default.
function storeFilters(key, values, defaults) {
  const all = readJSON(FILTERS_KEY, {});
  const changed = Object.keys(defaults).some(k => values[k] !== defaults[k]);
  if (changed) all[key] = values; else delete all[key];
  writeJSON(FILTERS_KEY, all);
  return changed;
}

// Restores the saved values of these form controls, saves every change, and wires a "Clear filters" button.
// The defaults are whatever the controls held before restoring. Returns true if any filter is active.
function keepFilters(key, ids, { clearBtn, onClear } = {}) {
  const els = ids.map(id => document.getElementById(id)).filter(Boolean);
  if (!els.length) return false;
  const read = el => (el.type === "checkbox" ? el.checked : el.value);
  const write = (el, v) => {
    if (el.type === "checkbox") el.checked = !!v;
    else if (el.tagName !== "SELECT" || [...el.options].some(o => o.value === v)) el.value = v;
  };
  const defaults = Object.fromEntries(els.map(el => [el.id, read(el)]));
  const saved = savedFilters(key);
  els.forEach(el => { if (el.id in saved) write(el, saved[el.id]); });
  const save = () => {
    const active = storeFilters(key, Object.fromEntries(els.map(el => [el.id, read(el)])), defaults);
    if (clearBtn) clearBtn.hidden = !active;
    return active;
  };
  els.forEach(el => { el.addEventListener("input", save); el.addEventListener("change", save); });
  if (clearBtn) clearBtn.addEventListener("click", () => {
    els.forEach(el => write(el, defaults[el.id]));
    save();
    if (onClear) onClear();
  });
  return save();
}
const clearFiltersBtn = (id = "clear-filters") => `<button type="button" class="link-btn clear-filters" id="${id}" hidden>Clear filters</button>`;

/* =========================================================================
   Favorites and recently viewed
   ========================================================================= */

const FAV_KEY = "pokeExplorerFavorites";
const RECENT_KEY = "pokeExplorerRecent";
const RECENT_MAX = 12;
const validEntry = e => e && typeof e.name === "string" && Number.isInteger(e.id);

function getFavorites() { return readJSON(FAV_KEY, []).filter(validEntry); }
function isFavorite(name) { return getFavorites().some(f => f.name === name); }
function toggleFavorite(entry) {
  const list = getFavorites();
  const on = !list.some(f => f.name === entry.name);
  writeJSON(FAV_KEY, on ? [{ name: entry.name, id: entry.id }, ...list] : list.filter(f => f.name !== entry.name));
  return on;
}

function getRecent() { return readJSON(RECENT_KEY, []).filter(validEntry); }
function addRecent(entry) {
  const list = [{ name: entry.name, id: entry.id }, ...getRecent().filter(r => r.name !== entry.name)].slice(0, RECENT_MAX);
  writeJSON(RECENT_KEY, list);
  return list;
}
function clearRecent() { writeJSON(RECENT_KEY, []); }

const STAR = on => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" fill="${on ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

function favoriteButton(entry, label) {
  const on = isFavorite(entry.name);
  return `<button type="button" class="icon-btn fav-btn${on ? " on" : ""}" id="fav-btn" aria-pressed="${on}"
    data-name="${esc(entry.name)}" data-id="${entry.id}" title="${on ? "Remove from favorites" : "Add to favorites"}">
    ${STAR(on)}<span>${on ? "Favorited" : "Favorite"}</span></button>`;
}
function wireFavoriteButton(label) {
  const btn = document.getElementById("fav-btn");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const on = toggleFavorite({ name: btn.dataset.name, id: Number(btn.dataset.id) });
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", on);
    btn.title = on ? "Remove from favorites" : "Add to favorites";
    btn.innerHTML = `${STAR(on)}<span>${on ? "Favorited" : "Favorite"}</span>`;
    flash(on ? `${label} added to your favorites.` : `${label} removed from your favorites.`);
  });
}

// "Your Pokémon" strip on the home page: favorites and recently viewed.
let homeMineTab = "favorites";
function renderHomeMine(box) {
  if (!box) return;
  const favs = getFavorites(), recent = getRecent();
  if (!favs.length && !recent.length) { box.innerHTML = ""; return; }
  if (homeMineTab === "favorites" && !favs.length) homeMineTab = "recent";
  if (homeMineTab === "recent" && !recent.length) homeMineTab = "favorites";
  const list = homeMineTab === "favorites" ? favs : recent;
  box.innerHTML = `
    <div class="section-head mine-head">
      <h2>Your Pokémon</h2>
      <div class="sub-tabs mine-tabs" role="tablist" aria-label="Your Pokémon">
        ${favs.length ? `<button type="button" role="tab" class="sub-tab${homeMineTab === "favorites" ? " active" : ""}" aria-selected="${homeMineTab === "favorites"}" data-mine="favorites">Favorites (${favs.length})</button>` : ""}
        ${recent.length ? `<button type="button" role="tab" class="sub-tab${homeMineTab === "recent" ? " active" : ""}" aria-selected="${homeMineTab === "recent"}" data-mine="recent">Recently viewed</button>` : ""}
      </div>
      ${homeMineTab === "recent" ? `<button type="button" class="link-btn" id="clear-recent">Clear history</button>` : ""}
    </div>
    <div class="mine-strip">${list.map(e => `
      <a class="mine-card" href="#pokemon/${e.name}">
        ${spriteImg(e.id, 64)}
        <span>${esc(pokeName(e.name))}</span>
      </a>`).join("")}</div>`;
  box.querySelectorAll("[data-mine]").forEach(b => b.addEventListener("click", () => { homeMineTab = b.dataset.mine; renderHomeMine(box); }));
  const clear = document.getElementById("clear-recent");
  if (clear) clear.addEventListener("click", () => { clearRecent(); renderHomeMine(box); });
}

/* =========================================================================
   Metric / imperial units
   ========================================================================= */

const UNITS_KEY = "pokeExplorerUnits";
function currentUnits() {
  try { const u = localStorage.getItem(UNITS_KEY); if (u === "metric" || u === "imperial") return u; } catch {}
  const lang = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return /^en-(US|LR|MM)$/i.test(lang) ? "imperial" : "metric";
}
function setUnits(u) { try { localStorage.setItem(UNITS_KEY, u); } catch {} }

// PokéAPI gives height in decimeters and weight in hectograms.
function fmtHeight(dm, units = currentUnits()) {
  if (dm == null) return "—";
  if (units === "metric") return `${(dm / 10).toFixed(1)} m`;
  const inches = Math.round(dm * 3.93701);
  return `${Math.floor(inches / 12)}′${inches % 12}″`;
}
function fmtWeight(hg, units = currentUnits()) {
  if (hg == null) return "—";
  return units === "metric" ? `${(hg / 10).toFixed(1)} kg` : `${(hg * 0.220462).toFixed(1)} lbs`;
}
// Spans that re-render when the unit setting changes.
const heightSpan = dm => `<span class="u-h" data-dm="${dm}">${fmtHeight(dm)}</span>`;
const weightSpan = hg => `<span class="u-w" data-hg="${hg}">${fmtWeight(hg)}</span>`;
function unitToggle() {
  const u = currentUnits();
  return `<button type="button" class="unit-toggle" data-units-toggle title="Switch units">${u === "metric" ? "Show feet / pounds" : "Show meters / kilograms"}</button>`;
}
function refreshUnits(root = document) {
  root.querySelectorAll(".u-h").forEach(el => (el.textContent = fmtHeight(Number(el.dataset.dm))));
  root.querySelectorAll(".u-w").forEach(el => (el.textContent = fmtWeight(Number(el.dataset.hg))));
  root.querySelectorAll("[data-units-toggle]").forEach(b => (b.textContent = currentUnits() === "metric" ? "Show feet / pounds" : "Show meters / kilograms"));
}
document.addEventListener("click", e => {
  const btn = e.target.closest?.("[data-units-toggle]");
  if (!btn) return;
  setUnits(currentUnits() === "metric" ? "imperial" : "metric");
  refreshUnits();
});

/* =========================================================================
   Share links
   ========================================================================= */

async function shareLink(url, label) {
  try {
    if (typeof navigator !== "undefined" && navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || "")) {
      await navigator.share({ title: label, url });
      return;
    }
  } catch (err) { if (err && err.name === "AbortError") return; }
  try {
    await navigator.clipboard.writeText(url);
    flash("Link copied. Paste it anywhere to share.");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    ta.remove();
    flash(ok ? "Link copied. Paste it anywhere to share." : `Copy this link: ${url}`);
  }
}
const SHARE_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const shareButton = (id = "share-btn", label = "Share") =>
  `<button type="button" class="icon-btn" id="${id}" title="Copy a link to this page">${SHARE_ICON}<span>${esc(label)}</span></button>`;
const pageUrl = hash => `${location.origin}${location.pathname}#${hash}`;

// Damage calculator settings travel in the link as compact, URL-safe text.
function encodeState(obj) {
  const json = JSON.stringify(obj);
  const b64 = typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decodeState(code) {
  try {
    const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
    const json = typeof atob === "function" ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : null;
  } catch { return null; }
}
// Copies only known keys with the same type as the defaults, so a tampered link can't break the page.
function mergeKnown(target, source) {
  if (!source || typeof source !== "object") return target;
  for (const [k, v] of Object.entries(target)) {
    if (!(k in source)) continue;
    if (v && typeof v === "object") mergeKnown(v, source[k]);
    else if (typeof source[k] === typeof v) target[k] = source[k];
  }
  return target;
}

/* =========================================================================
   First-time hints
   ========================================================================= */

const HINTS_KEY = "pokeExplorerHints";
const HINTS = {
  team: "Your grade updates as you add Pokémon. Try <strong>Auto-complete</strong> to fill empty slots, or a suggested swap to raise the grade.",
  "tracker-games": "Games you own are highlighted in shiny odds tables. Use <strong>Export progress</strong> at the bottom to back up.",
  "tracker-pokedex": "Tick <strong>Caught</strong> or <strong>Shiny</strong> for each Pokémon, or switch to <strong>Boxes</strong> and click a slot: once for caught, twice for shiny. Pokémon pages have the same checkboxes.",
  "tracker-forms": "Regional and Gigantamax forms are tracked separately from the main Pokédex, so you can aim for a complete form collection too.",
  "tracker-hunts": "Start a hunt, then tap <strong>+1</strong> for every encounter, egg or reset. The bar shows how you're doing against the odds, and <strong>Found it!</strong> marks the Pokémon shiny in your Pokédex."
};
const hintDismissed = id => readJSON(HINTS_KEY, []).includes(id);
function dismissHint(id) { writeJSON(HINTS_KEY, [...new Set([...readJSON(HINTS_KEY, []), id])]); }
function hintBox(id) {
  if (!HINTS[id] || hintDismissed(id)) return "";
  return `<aside class="hint" data-hint="${id}" role="note">
    <span class="hint-icon" aria-hidden="true">i</span>
    <p><strong>Tip:</strong> ${HINTS[id]}</p>
    <button type="button" class="hint-close" data-hint-close="${id}">Got it</button>
  </aside>`;
}
document.addEventListener("click", e => {
  const btn = e.target.closest?.("[data-hint-close]");
  if (!btn) return;
  dismissHint(btn.dataset.hintClose);
  btn.closest(".hint")?.remove();
});

/* =========================================================================
   Remembered sections: each main tab returns to the last page used in that section
   ========================================================================= */

const LAST_KEY = "pokeExplorerLastPages";
const SECTION_HOME = { pokedex: "#", battle: "#gimmicks", tools: "#tools/compare", tracker: "#tracker/games" };
function rememberPage(page, param) {
  const [section, sub] = navFor(page, param);
  if (!sub || page === "pokemon" || page === "type") return;   // only section pages, not individual Pokémon
  const last = readJSON(LAST_KEY, {});
  last[section] = location.hash || "#";
  writeJSON(LAST_KEY, last);
}
function updateMainTabLinks() {
  const last = readJSON(LAST_KEY, {});
  document.querySelectorAll(".tabs a[data-tab]").forEach(a => {
    const href = last[a.dataset.tab];
    a.setAttribute("href", typeof href === "string" && href.startsWith("#") ? href : SECTION_HOME[a.dataset.tab]);
  });
}

/* =========================================================================
   Search: index, matching and the dropdown
   ========================================================================= */

// Lowercase, no accents, letters and digits only: "Flabébé" → "flabebe", "Mr. Mime" → "mrmime".
const normalizeText = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/♀/g, "f").replace(/♂/g, "m").replace(/[^a-z0-9]/g, "");

// Edit distance with adjacent swaps (Damerau-Levenshtein), stopping early past `max`.
function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = [], prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2.splice(0, prev2.length, ...prev);
    prev.splice(0, prev.length, ...cur);
  }
  return prev[b.length];
}

const KIND_BONUS = { pokemon: 6, form: 0, move: -2, ability: -2, item: -3 };

// entries: [{ kind, slug, label, id? }] → index with precomputed search keys.
function buildSearchIndex(entries) {
  return entries.map(e => ({ ...e, key: normalizeText(e.label), slugKey: normalizeText(e.slug), words: e.label.toLowerCase().split(/[\s\-().:'’]+/).filter(Boolean).map(normalizeText) }));
}

// Returns the best matches, each with a score and whether it came from typo tolerance.
function searchIndex(index, query, { kinds = null, limit = 8 } = {}) {
  const raw = String(query).trim();
  if (!raw) return [];
  const q = normalizeText(raw.replace(/^#/, ""));
  if (!q) return [];
  const digits = /^#?\d+$/.test(raw) ? String(Number(raw.replace("#", ""))) : null;
  const maxTypos = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  const results = [];
  for (const e of index) {
    if (kinds && !kinds.includes(e.kind)) continue;
    let score = 0, fuzzy = false;
    if (digits) {
      if (e.kind !== "pokemon") continue;
      const id = String(e.id);
      score = id === digits ? 100 : id.startsWith(digits) ? 60 - id.length : 0;
    } else if (e.key === q || e.slugKey === q) score = 100;
    else if (e.key.startsWith(q) || e.slugKey.startsWith(q)) score = 85;
    else if (e.words.some(w => w.startsWith(q))) score = 70;
    else if (q.length >= 3 && e.key.includes(q)) score = 55;
    else if (maxTypos && (e.kind === "pokemon" || e.kind === "form" || q.length >= 5)) {
      const target = e.key.length > q.length + 2 ? e.key.slice(0, q.length) : e.key;
      const d = editDistance(q, target, maxTypos);
      if (d <= maxTypos) { score = 40 - d * 8; fuzzy = true; }
    }
    if (score > 0) results.push({ ...e, score: score + (KIND_BONUS[e.kind] || 0), fuzzy });
  }
  // Ties: Pokémon in Pokédex order, then shorter names.
  results.sort((a, b) => b.score - a.score || (a.id || 1e6) - (b.id || 1e6) || a.label.length - b.label.length);
  return results.slice(0, limit);
}

let SEARCH_INDEX = [];
let searchExtrasLoading = null;

// Pokémon are indexed as soon as the species list arrives; forms, moves, abilities and items load on first use.
function indexSpecies(list) {
  const extras = SEARCH_INDEX.filter(e => e.kind !== "pokemon");
  SEARCH_INDEX = buildSearchIndex(list.map(s => ({ kind: "pokemon", slug: s.name, label: pokeName(s.name), id: s.id }))).concat(extras);
}
function loadSearchExtras() {
  searchExtrasLoading ||= Promise.all([
    getAllPokemon().then(d => d.results.map(p => ({ kind: "form", slug: p.name, label: pokeName(p.name), id: idFromUrl(p.url) }))
      .filter(p => p.id > 10000)).catch(() => []),
    get("/move?limit=2000").then(d => d.results.map(m => ({ kind: "move", slug: m.name, label: moveName(m.name) }))).catch(() => []),
    get("/ability?limit=1000").then(d => d.results.map(a => ({ kind: "ability", slug: a.name, label: title(a.name) }))).catch(() => []),
    get("/item?limit=3000").then(d => d.results.map(i => ({ kind: "item", slug: i.name, label: itemName(i.name) }))).catch(() => [])
  ]).then(groups => {
    SEARCH_INDEX = SEARCH_INDEX.filter(e => e.kind === "pokemon").concat(buildSearchIndex(groups.flat()));
  });
  return searchExtrasLoading;
}

// Closest Pokémon names, for the "not found" page.
function suggestPokemon(query, limit = 4) {
  return searchIndex(SEARCH_INDEX, query, { kinds: ["pokemon", "form"], limit }).filter(r => r.score >= 20);
}

const KIND_LABEL = { pokemon: "Pokémon", form: "Form", move: "Move", ability: "Ability", item: "Item" };
const KIND_ROUTE = { pokemon: "pokemon", form: "pokemon", move: "tools/moves", ability: "tools/abilities", item: "tools/items" };
const resultHash = r => `${KIND_ROUTE[r.kind]}/${r.slug}`;

let comboCount = 0;
/*
 * Turns a text input into a search box with a suggestion list.
 * mode "all": Pokémon, forms, moves, abilities and items; picking one opens its page.
 * mode "pokemon": Pokémon and forms; picking one fills the input (used in tools like the team builder).
 */
function attachSearch(input, { mode = "all", onPick } = {}) {
  if (!input || !input.parentElement || input.dataset.search) return;
  input.dataset.search = mode;
  input.removeAttribute("list");
  const kinds = mode === "all" ? null : ["pokemon", "form"];
  const id = `search-pop-${++comboCount}`;
  const holder = input.parentElement;
  holder.classList.add("search-holder");
  const pop = document.createElement("ul");
  pop.className = "search-pop";
  pop.id = id;
  pop.setAttribute("role", "listbox");
  pop.hidden = true;
  holder.appendChild(pop);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", id);

  let results = [], active = -1, typeTimer;
  const close = () => { pop.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; };
  const setActive = i => {
    active = i;
    pop.querySelectorAll("[role=option]").forEach((li, k) => li.setAttribute("aria-selected", k === i));
    const li = pop.querySelector(`#${id}-${i}`);
    if (li) { input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({ block: "nearest" }); }
  };

  function pick(r) {
    close();
    if (onPick) return onPick(r);
    location.hash = resultHash(r);
    input.value = "";
    input.blur();
  }

  function render() {
    // A page can limit the suggestions (the team builder only offers Pokémon from the chosen game).
    results = input.searchFilter
      ? searchIndex(SEARCH_INDEX, input.value, { kinds, limit: 60 }).filter(input.searchFilter).slice(0, 8)
      : searchIndex(SEARCH_INDEX, input.value, { kinds });
    if (!input.value.trim()) return close();
    if (!results.length) {
      pop.innerHTML = `<li class="search-empty" role="presentation">No matches for “${esc(input.value.trim())}”</li>`;
    } else {
      const typo = results.every(r => r.fuzzy);
      pop.innerHTML = (typo ? `<li class="search-note" role="presentation">Did you mean…</li>` : "") + results.map((r, i) => {
        const pic = r.kind === "pokemon" || r.kind === "form"
          ? `<img src="${SPRITE(r.id)}" alt="" width="40" height="40" loading="lazy" data-alts="${HOME_ART(r.id)}" onerror="nextSprite(this)">`
          : r.kind === "item" ? `<img src="${ITEM_SPRITE(r.slug)}" alt="" width="32" height="32" loading="lazy" onerror="this.style.visibility='hidden'">`
          : `<span class="kind-glyph" aria-hidden="true">${r.kind === "move" ? "⚔" : "✦"}</span>`;
        return `<li role="option" id="${id}-${i}" aria-selected="false" data-i="${i}">
          ${pic}
          <span class="opt-text"><span class="opt-name">${esc(r.label)}</span>
            <span class="opt-meta">${r.kind === "pokemon" ? pad(r.id) : KIND_LABEL[r.kind]}<span class="opt-types" data-types-for="${r.kind === "pokemon" || r.kind === "form" ? r.id : ""}"></span></span>
          </span>
        </li>`;
      }).join("");
    }
    pop.hidden = false;
    input.setAttribute("aria-expanded", "true");
    setActive(results.length ? 0 : -1);
    clearTimeout(typeTimer);
    typeTimer = setTimeout(fillTypes, 250);
  }

  // Types for the first few Pokémon results (cached after the first lookup).
  function fillTypes() {
    [...pop.querySelectorAll("[data-types-for]")].filter(el => el.dataset.typesFor).slice(0, 4).forEach(el => {
      get(`/pokemon/${el.dataset.typesFor}`).then(mon => {
        if (el.isConnected) el.innerHTML = mon.types.map(t => typeBadge(t.type.name, "", false)).join("");
      }).catch(() => {});
    });
  }

  input.addEventListener("focus", () => { if (mode === "all") loadSearchExtras().then(() => { if (document.activeElement === input && input.value.trim()) render(); }); });
  input.addEventListener("input", render);
  input.addEventListener("keydown", e => {
    if (pop.hidden || !results.length) { if (e.key === "Escape") close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((active + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((active - 1 + results.length) % results.length); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(results[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  });
  pop.addEventListener("mousedown", e => e.preventDefault());   // keep focus in the input while clicking
  pop.addEventListener("click", e => {
    const li = e.target.closest("[role=option]");
    if (li) pick(results[Number(li.dataset.i)]);
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
}

// Tool inputs that list Pokémon get the dropdown automatically. Picking fills the input, and submits the form
// when it's the only text box (e.g. Breeding), so two-box forms like Compare don't jump away mid-way.
function enhancePokemonInputs(root) {
  root.querySelectorAll('input[list="name-suggestions"]:not([data-search])').forEach(input => {
    attachSearch(input, {
      mode: "pokemon",
      onPick: r => {
        input.value = r.slug;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        const form = input.form;
        if (form && form.querySelectorAll('input[type="search"], input[type="text"]').length === 1) form.requestSubmit();
      }
    });
  });
}

/* =========================================================================
   Previous / next Pokémon
   ========================================================================= */

let SPECIES_BY_ID = [];
function neighborsOf(speciesId) {
  const prev = SPECIES_BY_ID[speciesId - 1], next = SPECIES_BY_ID[speciesId + 1];
  return { prev: speciesId > 1 && prev ? { id: speciesId - 1, name: prev } : null, next: next ? { id: speciesId + 1, name: next } : null };
}
function dexNav(speciesId, tab) {
  const { prev, next } = neighborsOf(speciesId);
  if (!prev && !next) return "";
  const href = n => `#pokemon/${n.name}${tab && tab !== "overview" ? "/" + tab : ""}`;
  const link = (n, dir) => n ? `
    <a class="dex-step ${dir}" href="${href(n)}" data-dex-step="${dir}" data-name="${n.name}" rel="${dir === "prev" ? "prev" : "next"}"
       aria-label="${dir === "prev" ? "Previous" : "Next"}: ${esc(pokeName(n.name))}">
      ${dir === "prev" ? '<span class="arrow" aria-hidden="true">←</span>' : ""}
      <img src="${SPRITE(n.id)}" alt="" width="40" height="40" loading="lazy">
      <span><span class="num">${pad(n.id)}</span><span class="name">${esc(pokeName(n.name))}</span></span>
      ${dir === "next" ? '<span class="arrow" aria-hidden="true">→</span>' : ""}
    </a>` : `<span class="dex-step empty"></span>`;
  return `<nav class="dex-nav" aria-label="Browse the Pokédex">${link(prev, "prev")}${link(next, "next")}</nav>`;
}
// Keep the current details tab when stepping to the next Pokémon.
function updateDexNavTab(tab) {
  document.querySelectorAll("[data-dex-step]").forEach(a => {
    a.setAttribute("href", `#pokemon/${a.dataset.name}${tab && tab !== "overview" ? "/" + tab : ""}`);
  });
}
// Left/right arrow keys step through the Pokédex on details pages (not while typing or using tab controls).
document.addEventListener("keydown", e => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const t = e.target;
  if (t && (t.closest?.("input, textarea, select, [contenteditable], [role=tab], [role=listbox]"))) return;
  if (!location.hash.startsWith("#pokemon/")) return;
  const link = document.querySelector(`[data-dex-step="${e.key === "ArrowLeft" ? "prev" : "next"}"]`);
  if (link) { e.preventDefault(); location.hash = link.getAttribute("href").slice(1); }
});

/* =========================================================================
   Type pages (#type/fire): every badge links here
   ========================================================================= */

async function renderTypePage(type) {
  if (!TYPE_COLOR[type]) throw new Error("not-found");
  setCrumbs([{ label: "Tools", href: "#tools" }, { label: "Type chart", href: "#tools/typechart" }, { label: `${title(type)} type` }]);
  view.innerHTML = `<h1>${esc(title(type))} type</h1>${loadingBlock()}`;
  const [td, data] = await Promise.all([allTypeData(), get(`/type/${type}`)]);
  const group = (list, empty) => list.length ? list.map(([t, m]) => typeBadge(t, m !== undefined ? `<small>×${multText(m)}</small>` : "")).join("") : `<span class="muted">${empty}</span>`;
  const offense = ALL_TYPES.map(t => [t, effectiveness(td, type, [t])]);
  const defense = ALL_TYPES.map(t => [t, effectiveness(td, t, [type])]);
  const mons = data.pokemon.map(p => ({ name: p.pokemon.name, id: idFromUrl(p.pokemon.url) })).sort((a, b) => a.id - b.id);
  const species = mons.filter(m => m.id <= 1025), forms = mons.filter(m => m.id > 1025);

  view.innerHTML = `
    <div class="type-hero" style="${typeStyle(type)}">
      <span class="type-hero-name">${esc(title(type))}</span>
      <span class="type-hero-meta">${species.length} Pokémon · ${forms.length} forms</span>
    </div>
    <div class="sections">
      <section class="panel">
        <h2>When attacking</h2>
        <h3>Super effective against (×2)</h3><div class="types">${group(offense.filter(([, m]) => m === 2).map(([t]) => [t]), "Nothing")}</div>
        <h3>Not very effective against (×½)</h3><div class="types">${group(offense.filter(([, m]) => m === 0.5).map(([t]) => [t]), "Nothing")}</div>
        <h3>No effect on (×0)</h3><div class="types">${group(offense.filter(([, m]) => m === 0).map(([t]) => [t]), "Nothing")}</div>
      </section>
      <section class="panel">
        <h2>When defending</h2>
        <h3>Weak to (×2)</h3><div class="types">${group(defense.filter(([, m]) => m === 2).map(([t]) => [t]), "Nothing")}</div>
        <h3>Resists (×½)</h3><div class="types">${group(defense.filter(([, m]) => m === 0.5).map(([t]) => [t]), "Nothing")}</div>
        <h3>Immune to (×0)</h3><div class="types">${group(defense.filter(([, m]) => m === 0).map(([t]) => [t]), "Nothing")}</div>
      </section>
    </div>
    <div class="section-head">
      <h2>${esc(title(type))}-type Pokémon</h2>
      <a class="text-link" href="#tools/typechart">Full type chart →</a>
    </div>
    <div class="list-tools">
      <label class="visually-hidden" for="type-filter">Filter ${esc(title(type))}-type Pokémon</label>
      <input id="type-filter" type="search" placeholder="Filter by name or number…" autocomplete="off">
      <label class="check"><input type="checkbox" id="type-forms"> Include forms</label>
      <span class="count" id="type-count"></span>
      ${clearFiltersBtn()}
    </div>
    <div class="mon-grid" id="type-grid"></div>`;

  const grid = document.getElementById("type-grid"), filter = document.getElementById("type-filter"), withForms = document.getElementById("type-forms");
  const draw = () => {
    const q = normalizeText(filter.value.replace(/^#?0*/, ""));
    const list = (withForms.checked ? mons : species).filter(m => !q || normalizeText(pokeName(m.name)).includes(q) || String(m.id).startsWith(q));
    document.getElementById("type-count").textContent = `${list.length} Pokémon`;
    grid.innerHTML = list.map(m => `
      <a class="mon-card" href="#pokemon/${m.name}">
        ${spriteImg(m.id)}
        <span class="num">${m.id <= 1025 ? pad(m.id) : "Form"}</span>
        <span class="name">${esc(pokeName(m.name))}</span>
        ${m.id <= 1025 ? trackBadges(m.id) : ""}
      </a>`).join("") || `<p class="muted">No Pokémon match that filter.</p>`;
  };
  filter.addEventListener("input", draw);
  withForms.addEventListener("change", draw);
  keepFilters(`type-${type}`, ["type-filter", "type-forms"], { clearBtn: document.getElementById("clear-filters"), onClear: draw });
  draw();
}

/* =========================================================================
   Color contrast (WCAG 2.x relative luminance)
   ========================================================================= */

function luminance(hex) {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/* =========================================================================
   Start-up: search boxes on pages
   ========================================================================= */

if (typeof MutationObserver !== "undefined") {
  new MutationObserver(() => {
    enhancePokemonInputs(view);
    const hero = document.getElementById("hero-input");
    if (hero && !hero.dataset.search) attachSearch(hero, { mode: "all" });
  }).observe(view, { childList: true, subtree: true });
}
