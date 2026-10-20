/*
 * Poké Explorer — Damage calculator (#damage) and Items (#tools/items, #tools/items/{name}).
 * Uses helpers from app.js, extras.js and training.js (get, esc, title, english, typeBadge, pokeName, cleanQuery,
 * loadSpeciesAndMon, baseStats, getNatures, calcStat, natureMultFor, allTypeData, effectiveness, artOf, monLabel).
 */

/* =========================================================================
   Damage calculator — Generation 5+ damage formula
   ========================================================================= */

// Game Freak rounds certain steps "half down": 2.5 → 2, 2.51 → 3.
const pokeRound = x => (x % 1 > 0.5 ? Math.ceil(x) : Math.floor(x));
const stageMult = s => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));

const ATK_ITEMS = {
  none: ["No item", null],
  band: ["Choice Band (Attack ×1.5)", "physical"],
  specs: ["Choice Specs (Sp. Atk ×1.5)", "special"],
  orb: ["Life Orb (damage ×1.3)", null],
  belt: ["Expert Belt (super-effective ×1.2)", null],
  typeboost: ["Type-boosting item, e.g. Charcoal (×1.2)", null]
};
const DEF_ITEMS = {
  none: ["No item"],
  vest: ["Assault Vest (Sp. Def ×1.5)"],
  eviolite: ["Eviolite (Def and Sp. Def ×1.5)"]
};

/* Abilities the calculator models. Each Pokémon's ability list comes from PokéAPI; anything not here is shown
   as "not modeled" and has no effect. */
const ATK_ABILITY = {
  "huge-power": "Doubles Attack", "pure-power": "Doubles Attack", "hustle": "Attack ×1.5", "gorilla-tactics": "Attack ×1.5",
  "guts": "Attack ×1.5 when statused; ignores burn", "solar-power": "Sp. Atk ×1.5 in sun",
  "blaze": "Fire moves ×1.5 at low HP", "torrent": "Water moves ×1.5 at low HP", "overgrow": "Grass moves ×1.5 at low HP", "swarm": "Bug moves ×1.5 at low HP",
  "technician": "Moves with 60 power or less ×1.5", "adaptability": "STAB is ×2", "sniper": "Critical hits ×2.25",
  "tinted-lens": "Not-very-effective hits ×2", "steelworker": "Steel moves ×1.5", "dragons-maw": "Dragon moves ×1.5",
  "transistor": "Electric moves ×1.3", "water-bubble": "Water moves ×2",
  "aerilate": "Normal moves become Flying ×1.2", "pixilate": "Normal moves become Fairy ×1.2",
  "refrigerate": "Normal moves become Ice ×1.2", "galvanize": "Normal moves become Electric ×1.2",
  "mold-breaker": "Ignores the target's ability", "teravolt": "Ignores the target's ability", "turboblaze": "Ignores the target's ability"
};
const DEF_ABILITY = {
  "levitate": "Immune to Ground", "earth-eater": "Immune to Ground", "flash-fire": "Immune to Fire", "well-baked-body": "Immune to Fire",
  "water-absorb": "Immune to Water", "storm-drain": "Immune to Water", "dry-skin": "Immune to Water",
  "volt-absorb": "Immune to Electric", "lightning-rod": "Immune to Electric", "motor-drive": "Immune to Electric", "sap-sipper": "Immune to Grass",
  "wonder-guard": "Only super-effective hits land", "thick-fat": "Fire and Ice damage halved", "heatproof": "Fire damage halved",
  "multiscale": "Damage halved at full HP", "shadow-shield": "Damage halved at full HP",
  "filter": "Super-effective damage ×0.75", "solid-rock": "Super-effective damage ×0.75", "prism-armor": "Super-effective damage ×0.75",
  "fur-coat": "Defense doubled", "ice-scales": "Special damage halved"
};
const ABILITY_IMMUNE = { levitate: "ground", "earth-eater": "ground", "flash-fire": "fire", "well-baked-body": "fire", "water-absorb": "water",
  "storm-drain": "water", "dry-skin": "water", "volt-absorb": "electric", "lightning-rod": "electric", "motor-drive": "electric", "sap-sipper": "grass" };
const PINCH = { blaze: "fire", torrent: "water", overgrow: "grass", swarm: "bug" };
const ATE = { aerilate: "flying", pixilate: "fairy", refrigerate: "ice", galvanize: "electric" };

/*
 * Returns the 16 possible damage values (random factor 85–100%) plus the numbers behind them.
 * a = attacker, d = defender: { stats (final, before stages), types, level, stage, item, tera }
 */
function damageRolls({ a, d, move, crit, weather, burned, screen, spread }) {
  const physical = move.category === "physical";
  const atkKey = physical ? "attack" : "special-attack";
  const defKey = physical ? "defense" : "special-defense";
  const aAb = a.ability || "", dAb = ["mold-breaker", "teravolt", "turboblaze"].includes(aAb) ? "" : (d.ability || "");

  // -ate abilities turn Normal moves into another type with a power boost.
  let moveType = move.type;
  let power = move.power;
  if (ATE[aAb] && moveType === "normal") { moveType = ATE[aAb]; power = Math.floor(power * 1.2); }
  if (aAb === "technician" && power <= 60) power = Math.floor(power * 1.5);
  if (a.item === "typeboost") power = Math.floor(power * 1.2);
  move = { ...move, type: moveType };

  // Critical hits ignore the attacker's stat drops and the defender's stat boosts.
  const aStage = crit ? Math.max(0, a.stage) : a.stage;
  const dStage = crit ? Math.min(0, d.stage) : d.stage;
  let A = Math.floor(a.stats[atkKey] * stageMult(aStage));
  let D = Math.floor(d.stats[defKey] * stageMult(dStage));
  if ((a.item === "band" && physical) || (a.item === "specs" && !physical)) A = Math.floor(A * 1.5);
  if (physical && (aAb === "huge-power" || aAb === "pure-power")) A *= 2;
  if (physical && (aAb === "hustle" || aAb === "gorilla-tactics" || (aAb === "guts" && burned))) A = Math.floor(A * 1.5);
  if (!physical && aAb === "solar-power" && weather === "sun") A = Math.floor(A * 1.5);
  if (PINCH[aAb] === move.type && a.pinch) A = Math.floor(A * 1.5);
  if ((aAb === "steelworker" && move.type === "steel") || (aAb === "dragons-maw" && move.type === "dragon")) A = Math.floor(A * 1.5);
  if (aAb === "transistor" && move.type === "electric") A = Math.floor(A * 1.3);
  if (aAb === "water-bubble" && move.type === "water") A *= 2;
  if (dAb === "thick-fat" && (move.type === "fire" || move.type === "ice")) A = Math.floor(A * 0.5);
  if (dAb === "heatproof" && move.type === "fire") A = Math.floor(A * 0.5);
  if ((d.item === "vest" && !physical) || d.item === "eviolite") D = Math.floor(D * 1.5);
  if (dAb === "fur-coat" && physical) D *= 2;

  const base = Math.floor(Math.floor(Math.floor(2 * a.level / 5 + 2) * power * A / D) / 50) + 2;

  // STAB, including Terastallization rules.
  let stab = 1;
  if (a.tera) {
    if (move.type === a.tera) stab = a.types.includes(a.tera) ? 2 : 1.5;
    else if (a.types.includes(move.type)) stab = 1.5;
  } else if (a.types.includes(move.type)) stab = 1.5;
  if (aAb === "adaptability" && stab === 1.5) stab = 2;

  const defTypes = d.tera ? [d.tera] : d.types;
  let eff = effectiveness(d.typeData, move.type, defTypes);
  if (ABILITY_IMMUNE[dAb] === move.type) eff = 0;
  if (dAb === "wonder-guard" && eff <= 1) eff = 0;

  let weatherMult = 1;
  if (weather === "sun") weatherMult = move.type === "fire" ? 1.5 : move.type === "water" ? 0.5 : 1;
  if (weather === "rain") weatherMult = move.type === "water" ? 1.5 : move.type === "fire" ? 0.5 : 1;

  const rolls = [];
  for (let r = 85; r <= 100; r++) {
    let dmg = base;
    if (spread) dmg = pokeRound(dmg * 0.75);
    if (weatherMult !== 1) dmg = pokeRound(dmg * weatherMult);
    if (crit) dmg = Math.floor(dmg * (aAb === "sniper" ? 2.25 : 1.5));
    dmg = Math.floor(dmg * r / 100);
    if (stab !== 1) dmg = pokeRound(dmg * stab);
    dmg = Math.floor(dmg * eff);
    if (burned && physical && move.name !== "facade" && aAb !== "guts") dmg = pokeRound(dmg * 0.5);
    if (aAb === "tinted-lens" && eff > 0 && eff < 1) dmg = pokeRound(dmg * 2);
    if ((dAb === "multiscale" || dAb === "shadow-shield") && d.fullHp !== false) dmg = pokeRound(dmg * 0.5);
    if (["filter", "solid-rock", "prism-armor"].includes(dAb) && eff > 1) dmg = pokeRound(dmg * 0.75);
    if (dAb === "ice-scales" && !physical) dmg = pokeRound(dmg * 0.5);
    if (screen && !crit) dmg = pokeRound(dmg * 0.5);
    if (a.item === "orb") dmg = pokeRound(dmg * 1.3);
    if (a.item === "belt" && eff > 1) dmg = pokeRound(dmg * 1.2);
    rolls.push(eff === 0 ? 0 : Math.max(1, dmg));
  }
  return { rolls, base, A, D, stab, eff, power, moveType };
}

// Chance that n hits knock out `hp`, using every combination of rolls (exact for n ≤ 3).
function koChance(rolls, hp, n) {
  if (n === 1) return rolls.filter(r => r >= hp).length / rolls.length;
  let dist = new Map([[0, 1]]);
  for (let i = 0; i < n; i++) {
    const next = new Map();
    dist.forEach((p, sum) => rolls.forEach(r => {
      const k = Math.min(hp, sum + r);
      next.set(k, (next.get(k) || 0) + p / rolls.length);
    }));
    dist = next;
  }
  return dist.get(hp) || 0;
}

function koText(rolls, hp) {
  if (!rolls[rolls.length - 1]) return { text: "No damage: the target is immune.", level: "none" };
  for (let n = 1; n <= 3; n++) {
    const p = koChance(rolls, hp, n);
    if (p >= 1) return { text: `Guaranteed ${n === 1 ? "OHKO" : n + "HKO"}`, level: n === 1 ? "ko1" : "ko2" };
    if (p > 0) return { text: `${(p * 100).toFixed(1).replace(".0", "")}% chance to ${n === 1 ? "OHKO" : n + "HKO"}`, level: n === 1 ? "ko1" : "ko2" };
  }
  const hits = Math.ceil(hp / rolls[rolls.length - 1]);
  return { text: `Takes ${hits}+ hits to KO`, level: "ko4" };
}

/* ---------- Page ---------- */

let dmgState = {
  atk: { mon: "garchomp", level: 50, nature: "jolly", ev: 252, stage: 0, item: "none", tera: "", burned: false, ability: "", pinch: false },
  def: { mon: "dragonite", level: 50, nature: "careful", hpEv: 4, ev: 252, stage: 0, item: "none", tera: "", ability: "" },
  move: "dragon-claw", crit: false, weather: "none", screen: false, spread: false
};

async function renderDamage(code) {
  // A shared link carries the settings: #damage/<code>
  if (code) mergeKnown(dmgState, decodeState(code));
  setCrumbs([{ label: "Battle", href: "#gimmicks" }, { label: "Damage calculator" }]);
  view.innerHTML = `
    <h1>Damage calculator</h1>
    <p class="lede">Pick an attacker, a move and a defender to see exactly how much damage it does, as a range and as a percentage of HP, and how many hits it takes to knock out.</p>
    ${loadingBlock()}`;
  const [natures, typeData] = await Promise.all([getNatures(), allTypeData()]);
  const st = dmgState;
  const natureOpts = cur => Object.values(natures).sort((x, y) => x.name.localeCompare(y.name)).map(n => {
    const up = n.increased_stat?.name, down = n.decreased_stat?.name;
    return `<option value="${n.name}" ${n.name === cur ? "selected" : ""}>${esc((english(n.names) || title(n.name)) + (up ? ` (+${STAT_LABEL[up]}, −${STAT_LABEL[down]})` : " (neutral)"))}</option>`;
  }).join("");
  const stageOpts = cur => Array.from({ length: 13 }, (_, i) => i - 6).map(v => `<option value="${v}" ${v === cur ? "selected" : ""}>${v > 0 ? "+" + v : v}</option>`).join("");
  const teraOpts = cur => `<option value="">Not Terastallized</option>${ALL_TYPES.map(t => `<option value="${t}" ${t === cur ? "selected" : ""}>Tera ${title(t)}</option>`).join("")}`;
  const itemOpts = (map, cur) => Object.entries(map).map(([k, [label]]) => `<option value="${k}" ${k === cur ? "selected" : ""}>${esc(label)}</option>`).join("");

  view.innerHTML = `
    <h1>Damage calculator</h1>
    <p class="lede">Pick an attacker, a move and a defender to see exactly how much damage it does, as a range and as a percentage of HP, and how many hits it takes to knock out.</p>

    <div class="dmg-result panel" id="dmg-result" aria-live="polite">${loadingBlock("Calculating…")}</div>

    <div class="dmg-grid">
      <section class="panel dmg-side" id="atk-side">
        <div class="dmg-side-head"><span class="eyebrow">Attacker</span><img id="atk-img" alt=""></div>
        <div class="field wide"><label for="atk-mon">Pokémon</label><input id="atk-mon" type="search" list="name-suggestions" value="${esc(st.atk.mon)}" autocomplete="off"></div>
        <div class="types" id="atk-types"></div>
        <div class="field-row">
          <div class="field"><label for="atk-level">Level</label><input id="atk-level" type="number" min="1" max="100" value="${st.atk.level}"></div>
          <div class="field"><label for="atk-ev">Attacking EVs</label><input id="atk-ev" type="number" min="0" max="252" step="4" value="${st.atk.ev}"></div>
          <div class="field"><label for="atk-stage">Stat stage</label><select id="atk-stage">${stageOpts(st.atk.stage)}</select></div>
        </div>
        <div class="field wide"><label for="atk-nature">Nature</label><select id="atk-nature">${natureOpts(st.atk.nature)}</select></div>
        <div class="field wide"><label for="atk-ability">Ability</label><select id="atk-ability"></select></div>
        <label class="check" id="atk-pinch-row" hidden><input type="checkbox" id="atk-pinch" ${st.atk.pinch ? "checked" : ""}> HP is at 1/3 or below</label>
        <div class="field wide"><label for="atk-item">Item</label><select id="atk-item">${itemOpts(ATK_ITEMS, st.atk.item)}</select></div>
        <div class="field wide"><label for="atk-tera">Terastallization</label><select id="atk-tera">${teraOpts(st.atk.tera)}</select></div>
        <label class="check"><input type="checkbox" id="atk-burned" ${st.atk.burned ? "checked" : ""}> Burned (halves physical damage)</label>
        <p class="muted small" id="atk-stat"></p>
      </section>

      <section class="panel dmg-move">
        <span class="eyebrow">Move &amp; field</span>
        <div class="field wide"><label for="dmg-move">Move</label><input id="dmg-move" type="search" list="atk-moves" value="${esc(st.move)}" autocomplete="off"><datalist id="atk-moves"></datalist></div>
        <div id="move-info" class="move-info"></div>
        <div class="field wide"><label for="dmg-weather">Weather</label>
          <select id="dmg-weather">
            <option value="none" ${st.weather === "none" ? "selected" : ""}>None</option>
            <option value="sun" ${st.weather === "sun" ? "selected" : ""}>Harsh sunlight (Fire ×1.5, Water ×0.5)</option>
            <option value="rain" ${st.weather === "rain" ? "selected" : ""}>Rain (Water ×1.5, Fire ×0.5)</option>
          </select></div>
        <label class="check"><input type="checkbox" id="dmg-crit" ${st.crit ? "checked" : ""}> Critical hit (×1.5)</label>
        <label class="check"><input type="checkbox" id="dmg-screen" ${st.screen ? "checked" : ""}> Reflect / Light Screen up</label>
        <label class="check"><input type="checkbox" id="dmg-spread" ${st.spread ? "checked" : ""}> Hits both foes in a Double Battle (×0.75)</label>
        <button type="button" class="btn ghost swap" id="dmg-swap">⇄ Swap attacker and defender</button>
      </section>

      <section class="panel dmg-side" id="def-side">
        <div class="dmg-side-head"><span class="eyebrow">Defender</span><img id="def-img" alt=""></div>
        <div class="field wide"><label for="def-mon">Pokémon</label><input id="def-mon" type="search" list="name-suggestions" value="${esc(st.def.mon)}" autocomplete="off"></div>
        <div class="types" id="def-types"></div>
        <div class="field-row">
          <div class="field"><label for="def-level">Level</label><input id="def-level" type="number" min="1" max="100" value="${st.def.level}"></div>
          <div class="field"><label for="def-hpev">HP EVs</label><input id="def-hpev" type="number" min="0" max="252" step="4" value="${st.def.hpEv}"></div>
          <div class="field"><label for="def-ev">Defending EVs</label><input id="def-ev" type="number" min="0" max="252" step="4" value="${st.def.ev}"></div>
          <div class="field"><label for="def-stage">Stat stage</label><select id="def-stage">${stageOpts(st.def.stage)}</select></div>
        </div>
        <div class="field wide"><label for="def-nature">Nature</label><select id="def-nature">${natureOpts(st.def.nature)}</select></div>
        <div class="field wide"><label for="def-ability">Ability</label><select id="def-ability"></select></div>
        <div class="field wide"><label for="def-item">Item</label><select id="def-item">${itemOpts(DEF_ITEMS, st.def.item)}</select></div>
        <div class="field wide"><label for="def-tera">Terastallization</label><select id="def-tera">${teraOpts(st.def.tera)}</select></div>
        <p class="muted small" id="def-stat"></p>
      </section>
    </div>
    <p class="note muted">Uses the Generation 5+ damage formula with all IVs at 31. Common damage-changing abilities are modeled; abilities marked "not modeled", other items and field effects aren't included. For Intimidate, set the attacker's stat stage to −1.</p>`;

  const $ = id => document.getElementById(id);
  let atk = null, def = null, move = null, timer;

  async function loadMon(side) {
    const input = $(`${side}-mon`);
    const q = cleanQuery(input.value);
    try {
      const { species, mon } = await loadSpeciesAndMon(q);
      $(`${side}-img`).src = artOf(mon);
      $(`${side}-img`).alt = monLabel(species, mon);
      $(`${side}-types`).innerHTML = mon.types.map(t => typeBadge(t.type.name)).join("");
      input.classList.remove("invalid");
      if (side === "atk") $("atk-moves").innerHTML = mon.moves.map(m => `<option value="${m.move.name}">${esc(moveName(m.move.name))}</option>`).join("");
      const modeled = side === "atk" ? ATK_ABILITY : DEF_ABILITY;
      const abilities = mon.abilities.map(a => a.ability.name);
      const keep = abilities.includes(st[side].ability) ? st[side].ability : (abilities.find(a => modeled[a]) || abilities[0] || "");
      $(`${side}-ability`).innerHTML = abilities.map(a => `<option value="${a}" ${a === keep ? "selected" : ""}>${esc(title(a))}${modeled[a] ? ` · ${esc(modeled[a])}` : " · not modeled"}</option>`).join("")
        || `<option value="">None</option>`;
      st[side].ability = keep;
      return { species, mon, base: baseStats(mon), types: mon.types.map(t => t.type.name), label: monLabel(species, mon) };
    } catch {
      input.classList.add("invalid");
      return null;
    }
  }

  async function loadMove() {
    const q = cleanQuery($("dmg-move").value);
    try {
      const m = await get(`/move/${q}`);
      $("dmg-move").classList.remove("invalid");
      move = { name: m.name, label: english(m.names) || title(m.name), type: m.type.name, category: m.damage_class?.name, power: m.power };
      $("move-info").innerHTML = `${typeBadge(move.type)} <span class="chip">${esc(title(move.category || "—"))}</span> <span class="chip">Power ${move.power ?? "—"}</span>`;
    } catch {
      $("dmg-move").classList.add("invalid");
      move = null;
      $("move-info").innerHTML = `<span class="muted">Type a move this Pokémon can use, e.g. earthquake.</span>`;
    }
  }

  const num = (id, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number($(id).value) || 0)));

  function calc() {
    Object.assign(st.atk, { mon: cleanQuery($("atk-mon").value), level: num("atk-level", 1, 100), ev: num("atk-ev", 0, 252),
      stage: Number($("atk-stage").value), nature: $("atk-nature").value, item: $("atk-item").value, tera: $("atk-tera").value, burned: $("atk-burned").checked,
      ability: $("atk-ability").value, pinch: $("atk-pinch").checked });
    Object.assign(st.def, { mon: cleanQuery($("def-mon").value), level: num("def-level", 1, 100), hpEv: num("def-hpev", 0, 252), ev: num("def-ev", 0, 252),
      stage: Number($("def-stage").value), nature: $("def-nature").value, item: $("def-item").value, tera: $("def-tera").value, ability: $("def-ability").value });
    $("atk-pinch-row").hidden = !PINCH[st.atk.ability];
    Object.assign(st, { move: cleanQuery($("dmg-move").value), crit: $("dmg-crit").checked, weather: $("dmg-weather").value,
      screen: $("dmg-screen").checked, spread: $("dmg-spread").checked });

    const out = $("dmg-result");
    if (!atk || !def) { out.innerHTML = `<p class="muted">Enter two Pokémon to calculate damage.</p>`; return; }
    if (!move) { out.innerHTML = `<p class="muted">Choose a move to calculate damage.</p>`; return; }
    if (move.category === "status") { out.innerHTML = `<p><strong>${esc(move.label)}</strong> is a status move, so it doesn't deal direct damage.</p>`; return; }
    if (!move.power) { out.innerHTML = `<p><strong>${esc(move.label)}</strong>'s power changes with the situation (weight, HP, speed…), so it can't be calculated here.</p>`; return; }

    const physical = move.category === "physical";
    const atkKey = physical ? "attack" : "special-attack", defKey = physical ? "defense" : "special-defense";
    const stat = (side, s, key, ev) => calcStat(key, side.base[key], 31, ev, s.level, natureMultFor(natures[s.nature], key), side.species.name === "shedinja");
    const aStats = { [atkKey]: stat(atk, st.atk, atkKey, st.atk.ev) };
    const dStats = { [defKey]: stat(def, st.def, defKey, st.def.ev) };
    const hp = stat(def, st.def, "hp", st.def.hpEv);
    $("atk-stat").textContent = `${STAT_LABEL[atkKey]} stat: ${aStats[atkKey]}`;
    $("def-stat").textContent = `HP: ${hp} · ${STAT_LABEL[defKey]} stat: ${dStats[defKey]}`;

    const res = damageRolls({
      a: { stats: aStats, types: atk.types, level: st.atk.level, stage: st.atk.stage, item: st.atk.item, tera: st.atk.tera, ability: st.atk.ability, pinch: st.atk.pinch },
      d: { stats: dStats, types: def.types, stage: st.def.stage, item: st.def.item, tera: st.def.tera, ability: st.def.ability, typeData },
      move, crit: st.crit, weather: st.weather, burned: st.atk.burned, screen: st.screen, spread: st.spread
    });
    const min = res.rolls[0], max = res.rolls[15];
    const pct = x => (x / hp * 100).toFixed(1);
    const ko = koText(res.rolls, hp);
    const effWord = res.eff === 0 ? "no effect" : res.eff >= 4 ? "4× super effective" : res.eff >= 2 ? "super effective" : res.eff < 1 ? "not very effective" : "neutral";

    out.innerHTML = `
      <div class="dmg-top">
        <p class="dmg-line"><strong>${esc(atk.label)}</strong>'s <strong>${esc(move.label)}</strong> vs <strong>${esc(def.label)}</strong></p>
        ${shareButton("dmg-share", "Share result")}
      </div>
      <div class="dmg-big">
        <span class="dmg-range">${min}–${max}</span>
        <span class="dmg-pct">${pct(min)}% – ${pct(max)}% of ${hp} HP</span>
        <span class="ko-pill ${ko.level}">${esc(ko.text)}</span>
      </div>
      <div class="hp-track" role="img" aria-label="Damage covers ${pct(min)} to ${pct(max)} percent of HP">
        <span class="hp-min" style="width:${Math.min(100, min / hp * 100)}%"></span>
        <span class="hp-max" style="left:${Math.min(100, min / hp * 100)}%;width:${Math.max(0, Math.min(100, max / hp * 100) - Math.min(100, min / hp * 100))}%"></span>
      </div>
      <p class="muted small">${esc(effWord)}${res.moveType !== move.type ? ` · becomes ${esc(title(res.moveType))}-type` : ""}${res.eff === 0 && ABILITY_IMMUNE[st.def.ability] === res.moveType ? ` · blocked by ${esc(title(st.def.ability))}` : ""}${res.stab !== 1 ? ` · STAB ×${res.stab}` : ""}${st.crit ? " · critical hit" : ""} · power ${res.power} · base damage ${res.base}</p>
      <details class="rolls"><summary>All 16 damage rolls</summary><p class="mono">${res.rolls.join(", ")}</p></details>`;
    document.getElementById("dmg-share").addEventListener("click", () =>
      shareLink(pageUrl(`damage/${encodeState(dmgState)}`), `${atk.label} vs ${def.label} · Poké Explorer`));
  }

  const refresh = async which => {
    if (which === "atk" || which === "all") atk = await loadMon("atk");
    if (which === "def" || which === "all") def = await loadMon("def");
    if (which === "move" || which === "all") await loadMove();
    calc();
  };
  const debounce = (fn, ms = 350) => { clearTimeout(timer); timer = setTimeout(fn, ms); };

  $("atk-mon").addEventListener("change", () => refresh("atk"));
  $("def-mon").addEventListener("change", () => refresh("def"));
  $("dmg-move").addEventListener("change", () => refresh("move"));
  view.querySelectorAll(".dmg-grid input:not([type=search]), .dmg-grid select").forEach(el => {
    el.addEventListener("input", () => debounce(calc, 120));
    el.addEventListener("change", calc);
  });
  $("dmg-swap").addEventListener("click", async () => {
    const a = $("atk-mon").value, d = $("def-mon").value;
    $("atk-mon").value = d; $("def-mon").value = a;
    await refresh("all");
  });
  await refresh("all");
}

/* =========================================================================
   Items
   ========================================================================= */

const POCKET_LABEL = { misc: "Items", medicine: "Medicine", pokeballs: "Poké Balls", machines: "TMs & HMs",
  berries: "Berries", mail: "Mail", battle: "Battle items", key: "Key items" };
const POCKET_ORDER = ["misc", "battle", "medicine", "berries", "pokeballs", "machines", "key", "mail"];
const ITEM_SPRITE = name => `${SPRITE_BASE.replace("/pokemon", "")}/items/${name}.png`;
let itemsView = { pocket: "misc", category: "held-items" };

async function renderItems(body, itemName) {
  fillDatalist("item-list", "/item?limit=3000", itemName);
  body.innerHTML = `
    <form class="compare-form" id="item-form">
      <label for="item-q" class="visually-hidden">Item</label>
      <input id="item-q" type="search" list="item-list" placeholder="Look up an item, e.g. choice-scarf" value="${esc(itemName || "")}" autocomplete="off">
      <button type="submit">Look up</button>
    </form>
    <div id="item-out">${loadingBlock()}</div>`;
  document.getElementById("item-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = cleanQuery(document.getElementById("item-q").value);
    if (q) location.hash = `tools/items/${q}`;
  });
  if (itemName) return renderItemDetail(document.getElementById("item-out"), itemName);
  return renderItemBrowser(document.getElementById("item-out"));
}

async function renderItemBrowser(out) {
  const pockets = (await get("/item-pocket?limit=20")).results.map(p => p.name)
    .sort((a, b) => (POCKET_ORDER.indexOf(a) + 1 || 99) - (POCKET_ORDER.indexOf(b) + 1 || 99));
  out.innerHTML = `
    <div class="sub-tabs pocket-tabs" role="tablist" aria-label="Bag pockets">
      ${pockets.map(p => `<button type="button" role="tab" class="sub-tab${p === itemsView.pocket ? " active" : ""}" aria-selected="${p === itemsView.pocket}" data-pocket="${p}">${esc(POCKET_LABEL[p] || title(p))}</button>`).join("")}
    </div>
    <div class="cat-chips" id="cat-chips"></div>
    <div id="item-grid">${loadingBlock()}</div>`;

  async function showPocket(pocket) {
    itemsView.pocket = pocket;
    out.querySelectorAll("[data-pocket]").forEach(b => { const on = b.dataset.pocket === pocket; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
    const data = await get(`/item-pocket/${pocket}`);
    const cats = data.categories.map(c => c.name).filter(c => !["unused", "data-cards", "dex-completion", "event-items"].includes(c));
    if (!cats.includes(itemsView.category)) itemsView.category = cats[0];
    document.getElementById("cat-chips").innerHTML = cats.map(c =>
      `<button type="button" class="chip-btn${c === itemsView.category ? " active" : ""}" data-cat="${c}">${esc(title(c))}</button>`).join("");
    document.querySelectorAll("[data-cat]").forEach(b => b.addEventListener("click", () => showCategory(b.dataset.cat)));
    await showCategory(itemsView.category);
  }

  async function showCategory(cat) {
    itemsView.category = cat;
    document.querySelectorAll("[data-cat]").forEach(b => b.classList.toggle("active", b.dataset.cat === cat));
    const grid = document.getElementById("item-grid");
    grid.innerHTML = loadingBlock();
    const data = await get(`/item-category/${cat}`);
    const items = data.items.map(i => i.name).sort();
    grid.innerHTML = items.length ? `
      <p class="count">${items.length} item${items.length > 1 ? "s" : ""} in ${esc(title(cat))}</p>
      <div class="item-grid">${items.map(n => `
        <a class="item-card" href="#tools/items/${n}">
          <img src="${ITEM_SPRITE(n)}" alt="" loading="lazy" width="48" height="48" onerror="this.style.visibility='hidden'">
          <span>${esc(itemName(n))}</span>
        </a>`).join("")}</div>` : `<p class="muted">No items in this category.</p>`;
  }

  out.querySelectorAll("[data-pocket]").forEach(b => b.addEventListener("click", () => showPocket(b.dataset.pocket)));
  await showPocket(itemsView.pocket);
}

async function renderItemDetail(out, name) {
  let item;
  try { item = await get(`/item/${name}`); }
  catch { out.innerHTML = `<p class="error">No item called “${esc(name)}”. Use hyphens for spaces, e.g. choice-scarf.</p>`; return; }
  const label = english(item.names) || itemName(item.name);
  setCrumbs([{ label: "Tools", href: "#tools" }, { label: "Items", href: "#tools/items" }, { label }]);
  const effect = englishEffect(item);
  const flavor = [...(item.flavor_text_entries || [])].reverse().find(f => f.language.name === "en")?.text?.replace(/\s+/g, " ");
  const holders = (item.held_by_pokemon || []).map(h => ({ name: h.pokemon.name, id: idFromUrl(h.pokemon.url),
    rarity: Math.max(...h.version_details.map(v => v.rarity)) }));
  const category = item.category?.name;

  out.innerHTML = `
    <section class="panel item-detail">
      <div class="item-head">
        <div class="item-icon"><img src="${item.sprites?.default || ITEM_SPRITE(item.name)}" alt="" onerror="this.style.visibility='hidden'"></div>
        <div>
          <h2>${esc(label)}</h2>
          ${category ? `<button type="button" class="chip-btn" id="item-cat">${esc(title(category))}</button>` : ""}
        </div>
      </div>
      ${effect ? `<p class="item-effect">${esc(effect)}</p>` : ""}
      ${flavor && flavor !== effect ? `<blockquote class="entry">${esc(flavor)}</blockquote>` : ""}
      <dl class="facts">
        <div><dt>Buy price</dt><dd>${item.cost ? "₽" + item.cost.toLocaleString() : "Can't be bought"}</dd></div>
        <div><dt>Fling power</dt><dd>${item.fling_power ?? "—"}</dd></div>
        ${item.fling_effect ? `<div><dt>Fling effect</dt><dd>${esc(title(item.fling_effect.name))}</dd></div>` : ""}
      </dl>
      ${item.attributes?.length ? `<div class="games">${item.attributes.map(a => `<span class="chip">${esc(title(a.name))}</span>`).join("")}</div>` : ""}
    </section>
    ${holders.length ? `
      <h2 class="grid-title">Wild Pokémon that may hold it</h2>
      <div class="mon-grid">${holders.sort((a, b) => a.id - b.id).map(h => `
        <a class="mon-card" href="#pokemon/${h.name}">
          ${spriteImg(h.id)}
          <span class="name">${esc(pokeName(h.name))}</span>
          <span class="num">Up to ${h.rarity}% held</span>
        </a>`).join("")}</div>` : ""}`;

  const catBtn = document.getElementById("item-cat");
  if (catBtn) catBtn.addEventListener("click", async () => {
    const pockets = (await get("/item-pocket?limit=20")).results.map(p => p.name);
    for (const p of pockets) {
      const data = await get(`/item-pocket/${p}`);
      if (data.categories.some(c => c.name === category)) { itemsView = { pocket: p, category }; break; }
    }
    location.hash = "tools/items";
  });
}
