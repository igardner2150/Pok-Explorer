/*
 * Poké Explorer — Battle gimmicks tab (#gimmicks, #gimmicks/{pokemon})
 * Uses helpers from app.js (get, title, esc, english, typeBadge, SPRITE, loadSpeciesAndMon, movesByGame, ...).
 *
 * Live from PokéAPI: Mega / Primal / Gigantamax / Ultra forms (species varieties), their stats, types,
 * abilities and sprites, every move the Pokémon learns per game, and held-item info (/item/{name}).
 * Maintained here (not in PokéAPI): which games each gimmick is in, item names, Z-Move / Max Move names
 * and power conversions, and where to get the key items.
 */

/* ---------- Gimmick definitions ---------- */

const GIMMICKS = [
  { id: "mega", name: "Mega Evolution", gen: "Gen 6–7",
    games: ["X / Y", "Omega Ruby / Alpha Sapphire", "Sun / Moon", "Ultra Sun / Ultra Moon", "Let's Go Pikachu / Eevee", "Legends: Z-A"],
    keyItem: "Key Stone (Mega Ring / Mega Bracelet)", held: "Its own Mega Stone",
    how: "Once per battle, a Pokémon holding its Mega Stone transforms for the rest of the battle.",
    changes: "Base stats rise by 100 in total, and the ability (sometimes the type) changes. Its moves stay the same." },
  { id: "primal", name: "Primal Reversion", gen: "Gen 6–7",
    games: ["Omega Ruby / Alpha Sapphire", "Sun / Moon", "Ultra Sun / Ultra Moon"],
    keyItem: "None", held: "Red Orb (Groudon) or Blue Orb (Kyogre)",
    how: "Groudon or Kyogre holding its orb reverts automatically when it enters battle.",
    changes: "Higher stats and a new weather ability. Primal Groudon also gains the Fire type." },
  { id: "zmove", name: "Z-Moves", gen: "Gen 7",
    games: ["Sun / Moon", "Ultra Sun / Ultra Moon"],
    keyItem: "Z-Ring (Z-Power Ring in Ultra Sun / Ultra Moon)", held: "A Z-Crystal",
    how: "Once per battle, a Pokémon holding a Z-Crystal turns one of its moves into a Z-Move.",
    changes: "Stats don't change. A damaging move of the crystal's type becomes a much stronger Z-Move; status moves gain a bonus effect. Some Pokémon have their own exclusive Z-Move." },
  { id: "ultra", name: "Ultra Burst", gen: "Gen 7",
    games: ["Ultra Sun / Ultra Moon"],
    keyItem: "Z-Power Ring", held: "Ultranecrozium Z",
    how: "Dusk Mane or Dawn Wings Necrozma holding Ultranecrozium Z bursts into Ultra Necrozma.",
    changes: "Becomes Psychic/Dragon with much higher stats and gains Light That Burns the Sky." },
  { id: "dynamax", name: "Dynamax", gen: "Gen 8",
    games: ["Sword / Shield"],
    keyItem: "Dynamax Band", held: "Nothing",
    how: "Once per battle, a Pokémon grows huge for 3 turns (only in Gyms, Max Raids and some battles).",
    changes: "HP rises up to ×2 (based on Dynamax Level). Every move becomes a Max Move; status moves become Max Guard." },
  { id: "gmax", name: "Gigantamax", gen: "Gen 8",
    games: ["Sword / Shield"],
    keyItem: "Dynamax Band", held: "Nothing (needs the Gigantamax Factor)",
    how: "Pokémon with the Gigantamax Factor take a special form when they Dynamax.",
    changes: "Same HP boost as Dynamax plus a new look. Moves of one type become its exclusive G-Max Move." },
  { id: "tera", name: "Terastallization", gen: "Gen 9",
    games: ["Scarlet / Violet"],
    keyItem: "Tera Orb", held: "Nothing",
    how: "Once per battle, a Pokémon changes to its Tera Type for the rest of the battle.",
    changes: "Stats don't change. Its type becomes its Tera Type, it gets STAB on that type (2× if it matches an original type), and Tera Blast becomes that type." }
];

// Where to get the key item / form item, per game. Only verified entries are filled in;
// add more here as "Game label": "where to get it".
const UNLOCK = {
  mega: { "X / Y": "Mega Ring: given by Gurkinn at the Tower of Mastery in Shalour City after you beat Korrina." },
  gmax: { "Sword / Shield": "Gigantamax Factor: catch a Gigantamax Pokémon in a Max Raid Battle, or (Isle of Armor DLC) have the cook at the Master Dojo make Max Soup from 3 Max Mushrooms and feed it to a Pokémon that has a Gigantamax form." }
};

/* ---------- Item and move tables ---------- */

const MEGA_STONE = {
  "venusaur-mega": "venusaurite", "charizard-mega-x": "charizardite-x", "charizard-mega-y": "charizardite-y",
  "blastoise-mega": "blastoisinite", "beedrill-mega": "beedrillite", "pidgeot-mega": "pidgeotite",
  "alakazam-mega": "alakazite", "slowbro-mega": "slowbronite", "gengar-mega": "gengarite",
  "kangaskhan-mega": "kangaskhanite", "pinsir-mega": "pinsirite", "gyarados-mega": "gyaradosite",
  "aerodactyl-mega": "aerodactylite", "mewtwo-mega-x": "mewtwonite-x", "mewtwo-mega-y": "mewtwonite-y",
  "ampharos-mega": "ampharosite", "steelix-mega": "steelixite", "scizor-mega": "scizorite",
  "heracross-mega": "heracronite", "houndoom-mega": "houndoominite", "tyranitar-mega": "tyranitarite",
  "sceptile-mega": "sceptilite", "blaziken-mega": "blazikenite", "swampert-mega": "swampertite",
  "gardevoir-mega": "gardevoirite", "sableye-mega": "sablenite", "mawile-mega": "mawilite",
  "aggron-mega": "aggronite", "medicham-mega": "medichamite", "manectric-mega": "manectite",
  "sharpedo-mega": "sharpedonite", "camerupt-mega": "cameruptite", "altaria-mega": "altarianite",
  "banette-mega": "banettite", "absol-mega": "absolite", "glalie-mega": "glalitite",
  "salamence-mega": "salamencite", "metagross-mega": "metagrossite", "latias-mega": "latiasite",
  "latios-mega": "latiosite", "lopunny-mega": "lopunnite", "garchomp-mega": "garchompite",
  "lucario-mega": "lucarionite", "abomasnow-mega": "abomasite", "gallade-mega": "galladite",
  "audino-mega": "audinite", "diancie-mega": "diancite"
};
const PRIMAL_ORB = { "groudon-primal": "red-orb", "kyogre-primal": "blue-orb" };

// Megas available in X / Y (the rest arrived in Omega Ruby / Alpha Sapphire).
const XY_MEGAS = new Set(["venusaur-mega", "charizard-mega-x", "charizard-mega-y", "blastoise-mega", "alakazam-mega",
  "gengar-mega", "kangaskhan-mega", "pinsir-mega", "gyarados-mega", "aerodactyl-mega", "mewtwo-mega-x", "mewtwo-mega-y",
  "ampharos-mega", "scizor-mega", "heracross-mega", "houndoom-mega", "tyranitar-mega", "blaziken-mega", "gardevoir-mega",
  "mawile-mega", "aggron-mega", "medicham-mega", "manectric-mega", "banette-mega", "absol-mega", "garchomp-mega",
  "lucario-mega", "abomasnow-mega"]);

const Z_TYPE = {
  normal: ["Normalium Z", "Breakneck Blitz"], fire: ["Firium Z", "Inferno Overdrive"], water: ["Waterium Z", "Hydro Vortex"],
  electric: ["Electrium Z", "Gigavolt Havoc"], grass: ["Grassium Z", "Bloom Doom"], ice: ["Icium Z", "Subzero Slammer"],
  fighting: ["Fightinium Z", "All-Out Pummeling"], poison: ["Poisonium Z", "Acid Downpour"], ground: ["Groundium Z", "Tectonic Rage"],
  flying: ["Flyinium Z", "Supersonic Skystrike"], psychic: ["Psychium Z", "Shattered Psyche"], bug: ["Buginium Z", "Savage Spin-Out"],
  rock: ["Rockium Z", "Continental Crush"], ghost: ["Ghostium Z", "Never-Ending Nightmare"], dragon: ["Dragonium Z", "Devastating Drake"],
  dark: ["Darkinium Z", "Black Hole Eclipse"], steel: ["Steelium Z", "Corkscrew Crash"], fairy: ["Fairium Z", "Twinkle Tackle"]
};

// Exclusive Z-Moves: species → [crystal, base move, Z-Move]
const Z_EXCLUSIVE = {
  pikachu: [["Pikanium Z", "Volt Tackle", "Catastropika"]],
  "raichu-alola": [["Aloraichium Z", "Thunderbolt", "Stoked Sparksurfer"]],
  decidueye: [["Decidium Z", "Spirit Shackle", "Sinister Arrow Raid"]],
  incineroar: [["Incinium Z", "Darkest Lariat", "Malicious Moonsault"]],
  primarina: [["Primarium Z", "Sparkling Aria", "Oceanic Operetta"]],
  eevee: [["Eevium Z", "Last Resort", "Extreme Evoboost"]],
  snorlax: [["Snorlium Z", "Giga Impact", "Pulverizing Pancake"]],
  mew: [["Mewnium Z", "Psychic", "Genesis Supernova"]],
  marshadow: [["Marshadium Z", "Spectral Thief", "Soul-Stealing 7-Star Strike"]],
  "tapu-koko": [["Tapunium Z", "Nature's Madness", "Guardian of Alola"]],
  "tapu-lele": [["Tapunium Z", "Nature's Madness", "Guardian of Alola"]],
  "tapu-bulu": [["Tapunium Z", "Nature's Madness", "Guardian of Alola"]],
  "tapu-fini": [["Tapunium Z", "Nature's Madness", "Guardian of Alola"]],
  "kommo-o": [["Kommonium Z", "Clanging Scales", "Clangorous Soulblaze"]],
  lycanroc: [["Lycanium Z", "Stone Edge", "Splintered Stormshards"]],
  mimikyu: [["Mimikium Z", "Play Rough", "Let's Snuggle Forever"]],
  solgaleo: [["Solganium Z", "Sunsteel Strike", "Searing Sunraze Smash"]],
  lunala: [["Lunalium Z", "Moongeist Beam", "Menacing Moonraze Maelstrom"]],
  necrozma: [["Ultranecrozium Z", "Photon Geyser", "Light That Burns the Sky"],
             ["Solganium Z", "Sunsteel Strike", "Searing Sunraze Smash (Dusk Mane)"],
             ["Lunalium Z", "Moongeist Beam", "Menacing Moonraze Maelstrom (Dawn Wings)"]]
};

const MAX_MOVE = {
  normal: "Max Strike", fire: "Max Flare", water: "Max Geyser", electric: "Max Lightning", grass: "Max Overgrowth",
  ice: "Max Hailstorm", fighting: "Max Knuckle", poison: "Max Ooze", ground: "Max Quake", flying: "Max Airstream",
  psychic: "Max Mindstorm", bug: "Max Flutterby", rock: "Max Rockfall", ghost: "Max Phantasm", dragon: "Max Wyrmwind",
  dark: "Max Darkness", steel: "Max Steelspike", fairy: "Max Starfall"
};

// G-Max Moves: form (without "-gmax") → [move, type it replaces]
const GMAX_MOVE = {
  venusaur: ["G-Max Vine Lash", "grass"], charizard: ["G-Max Wildfire", "fire"], blastoise: ["G-Max Cannonade", "water"],
  butterfree: ["G-Max Befuddle", "bug"], pikachu: ["G-Max Volt Crash", "electric"], meowth: ["G-Max Gold Rush", "normal"],
  machamp: ["G-Max Chi Strike", "fighting"], gengar: ["G-Max Terror", "ghost"], kingler: ["G-Max Foam Burst", "water"],
  lapras: ["G-Max Resonance", "ice"], eevee: ["G-Max Cuddle", "normal"], snorlax: ["G-Max Replenish", "normal"],
  garbodor: ["G-Max Malodor", "poison"], melmetal: ["G-Max Meltdown", "steel"], rillaboom: ["G-Max Drum Solo", "grass"],
  cinderace: ["G-Max Fireball", "fire"], inteleon: ["G-Max Hydrosnipe", "water"], corviknight: ["G-Max Wind Rage", "flying"],
  orbeetle: ["G-Max Gravitas", "psychic"], drednaw: ["G-Max Stonesurge", "water"], coalossal: ["G-Max Volcalith", "rock"],
  flapple: ["G-Max Tartness", "grass"], appletun: ["G-Max Sweetness", "grass"], sandaconda: ["G-Max Sandblast", "ground"],
  toxtricity: ["G-Max Stun Shock", "electric"], "toxtricity-amped": ["G-Max Stun Shock", "electric"],
  "toxtricity-low-key": ["G-Max Stun Shock", "electric"], centiskorch: ["G-Max Centiferno", "fire"],
  hatterene: ["G-Max Smite", "fairy"], grimmsnarl: ["G-Max Snooze", "dark"], alcremie: ["G-Max Finale", "fairy"],
  copperajah: ["G-Max Steelsurge", "steel"], duraludon: ["G-Max Depletion", "dragon"],
  "urshifu-single-strike": ["G-Max One Blow", "dark"], "urshifu-rapid-strike": ["G-Max Rapid Flow", "water"]
};

const NO_DYNAMAX = new Set(["zacian", "zamazenta", "eternatus"]);

// Version groups that represent each game in PokéAPI move data.
const GAME_VGS = {
  zmove: ["ultra-sun-ultra-moon", "sun-moon"],
  dynamax: ["sword-shield", "the-isle-of-armor", "the-crown-tundra"],
  tera: ["scarlet-violet", "the-teal-mask", "the-indigo-disk"],
  lgpe: ["lets-go-pikachu-lets-go-eevee"]
};

// Approximate power conversions (a few moves, like multi-hit or fixed-damage ones, have special values).
const zPower = p => p == null ? "—" : p >= 140 ? 200 : p >= 130 ? 195 : p >= 120 ? 190 : p >= 110 ? 185 :
  p >= 100 ? 180 : p >= 90 ? 175 : p >= 80 ? 160 : p >= 70 ? 140 : p >= 60 ? 120 : 100;
const maxPower = (p, type) => {
  if (p == null) return "—";
  const weak = type === "fighting" || type === "poison";
  const steps = [40, 50, 60, 70, 100, 140];
  const vals = weak ? [70, 75, 80, 85, 90, 95, 100] : [90, 100, 110, 120, 130, 140, 150];
  const i = steps.findIndex(s => p <= s);
  return vals[i === -1 ? 6 : i];
};

/* ---------- Helpers ---------- */

const GIMMICK_FORM_RE = /-(mega(-[xyz])?|primal|gmax)$|^necrozma-ultra$/;

function gimmickLabel(name) {
  let m;
  if ((m = name.match(/^(.+?)-mega(?:-([xyz]))?$/))) return `Mega ${title(m[1])}${m[2] ? " " + m[2].toUpperCase() : ""}`;
  if ((m = name.match(/^(.+)-primal$/))) return `Primal ${title(m[1])}`;
  if ((m = name.match(/^(.+)-gmax$/))) {
    const [base, ...rest] = m[1].split("-");
    const known = ["urshifu", "toxtricity"].includes(base);
    return `Gigantamax ${known ? title(base) + ` (${title(rest.join("-"))})` : title(m[1])}`;
  }
  if (name === "necrozma-ultra") return "Ultra Necrozma";
  return title(name);
}

function gimmickOf(name) {
  if (/-mega(-[xyz])?$/.test(name)) return "mega";
  if (/-primal$/.test(name)) return "primal";
  if (/-gmax$/.test(name)) return "gmax";
  if (name === "necrozma-ultra") return "ultra";
  return null;
}

function megaGames(formName, speciesId) {
  if (!MEGA_STONE[formName]) return ["Legends: Z-A or later"];
  const games = [];
  if (XY_MEGAS.has(formName)) games.push("X / Y");
  games.push("Omega Ruby / Alpha Sapphire");
  if (formName !== "rayquaza-mega") games.push("Sun / Moon", "Ultra Sun / Ultra Moon");
  if (speciesId <= 151) games.push("Let's Go Pikachu / Eevee");
  return games;
}

async function itemInfo(slug) {
  if (!slug) return null;
  try {
    const item = await get(`/item/${slug}`);
    return {
      name: english(item.names) || title(slug),
      sprite: item.sprites?.default,
      text: english(item.effect_entries, "short_effect")
        || [...(item.flavor_text_entries || [])].reverse().find(f => f.language.name === "en")?.text || ""
    };
  } catch { return { name: title(slug), sprite: null, text: "" }; }
}

// Normal and shiny sprites for a form, in every style PokéAPI has for it.
function spriteGallery(mon, label) {
  const s = mon.sprites, o = s.other || {};
  const list = [
    [s.front_default, "Sprite"], [s.front_shiny, "Shiny sprite"],
    [s.back_default, "Back"], [s.back_shiny, "Shiny back"],
    [o.home?.front_default, "HOME", true], [o.home?.front_shiny, "HOME shiny", true],
    [o["official-artwork"]?.front_default, "Official art", true], [o["official-artwork"]?.front_shiny, "Official art shiny", true]
  ].filter(([src]) => src);
  if (!list.length) return "";
  return `<h3>Sprites</h3><div class="sprites">${list.map(([src, cap, art]) =>
    `<figure><img class="${art ? "art" : ""}" src="${src}" alt="${esc(label)} ${esc(cap)}" loading="lazy"><figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>`;
}

const chips = list => `<div class="games">${list.map(g => `<span class="chip">${esc(g)}</span>`).join("")}</div>`;

function itemBox(item, fallback) {
  if (!item) return fallback ? `<p><strong>Item:</strong> ${esc(fallback)}</p>` : "";
  return `<div class="item-box">
    ${item.sprite ? `<img src="${item.sprite}" alt="">` : ""}
    <div><strong>${esc(item.name)}</strong>${item.text ? `<span class="muted">${esc(item.text.replace(/\s+/g, " "))}</span>` : ""}</div>
  </div>`;
}

function whereToGet(gimmickId, games) {
  const g = GIMMICKS.find(x => x.id === gimmickId);
  const rows = games.map(game => {
    const info = UNLOCK[gimmickId]?.[game];
    return `<tr><td>${esc(game)}</td><td>${info ? esc(info) : '<span class="muted">Location not added yet</span>'}</td></tr>`;
  }).join("");
  return `<h3>Where to get what you need</h3>
    <p class="muted">Key item: ${esc(g.keyItem)} · Held item: ${esc(g.held)}</p>
    <div class="table-wrap"><table class="data-table wrap"><thead><tr><th>Game</th><th>Where to get it</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function statCompare(base, form) {
  const b = baseStats(base), f = baseStats(form);
  const keys = ["hp", "attack", "defense", "special-attack", "special-defense", "speed"];
  const sum = o => keys.reduce((s, k) => s + (o[k] || 0), 0);
  const diff = (x, y) => { const d = y - x; return d > 0 ? `<span class="up">+${d}</span>` : d < 0 ? `<span class="down">${d}</span>` : '<span class="muted">0</span>'; };
  return `<div class="table-wrap"><table class="data-table">
    <thead><tr><th>Stat</th><th class="num">Base form</th><th class="num">${esc(gimmickLabel(form.name))}</th><th class="num">Change</th></tr></thead>
    <tbody>
      ${keys.map(k => `<tr><td>${STAT_LABEL[k]}</td><td class="num">${b[k]}</td><td class="num">${f[k]}</td><td class="num">${diff(b[k], f[k])}</td></tr>`).join("")}
      <tr class="total-row"><td>Total</td><td class="num">${sum(b)}</td><td class="num">${sum(f)}</td><td class="num">${diff(sum(b), sum(f))}</td></tr>
    </tbody></table></div>`;
}

async function abilityNames(mon) {
  return Promise.all(mon.abilities.map(async a => {
    const ab = await get(a.ability.url).catch(() => null);
    return (ab && english(ab.names)) || title(a.ability.name);
  }));
}

async function formChanges(base, form) {
  const [baseAb, formAb] = await Promise.all([abilityNames(base), abilityNames(form)]);
  const bt = base.types.map(t => t.type.name), ft = form.types.map(t => t.type.name);
  const typeChanged = bt.join() !== ft.join();
  return `
    <div class="change-grid">
      <div><span class="label">Type</span>${typeChanged
        ? `${bt.map(t => typeBadge(t)).join("")} <span class="arrow">→</span> ${ft.map(t => typeBadge(t)).join("")}`
        : `${ft.map(t => typeBadge(t)).join("")} <span class="muted">(unchanged)</span>`}</div>
      <div><span class="label">Ability</span>${baseAb.join(" / ")} <span class="arrow">→</span> <strong>${formAb.join(" / ")}</strong></div>
      <div><span class="label">Height / weight</span>${(base.height / 10).toFixed(1)} m, ${(base.weight / 10).toFixed(1)} kg <span class="arrow">→</span> ${(form.height / 10).toFixed(1)} m, ${(form.weight / 10).toFixed(1)} kg</div>
    </div>`;
}

// Table of the Pokémon's damaging moves in a game, converted by a gimmick.
async function convertedMoveTable(byVg, vgList, convert, head) {
  const vgsPresent = vgList.filter(v => byVg[v]);
  if (!vgsPresent.length) return "";
  const seen = new Map();
  vgsPresent.forEach(v => byVg[v].forEach(m => seen.set(m.name, m.url)));
  const details = (await Promise.all([...seen.values()].map(u => get(u).catch(() => null)))).filter(Boolean);
  const damaging = details.filter(d => d.damage_class?.name !== "status")
    .sort((a, b) => a.type.name.localeCompare(b.type.name) || (b.power || 0) - (a.power || 0));
  const statusCount = details.length - damaging.length;
  if (!damaging.length) return `<p class="muted">It has no damaging moves in this game.</p>`;
  return `
    <details class="move-convert">
      <summary>How its ${damaging.length} damaging moves change ${statusCount ? `<span class="muted">(+${statusCount} status moves)</span>` : ""}</summary>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Move</th><th>Type</th><th class="num">Power</th><th>${esc(head)}</th><th class="num">New power</th></tr></thead>
        <tbody>${damaging.map(d => {
          const [name, power] = convert(d);
          return `<tr><td>${esc(english(d.names) || title(d.name))}</td><td>${typeBadge(d.type.name)}</td><td class="num">${d.power ?? "—"}</td><td><strong>${esc(name)}</strong></td><td class="num">${power}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </details>`;
}

/* ---------- Page: overview ---------- */

async function renderGimmickOverview() {
  setCrumbs([{ label: "Battle gimmicks" }]);
  view.innerHTML = `<p class="status">Loading battle gimmicks…</p>`;
  const all = await getAllPokemon();
  const forms = all.results.filter(p => GIMMICK_FORM_RE.test(p.name)).map(p => ({ name: p.name, id: idFromUrl(p.url), g: gimmickOf(p.name) }));

  const grid = list => `<div class="mon-grid">${list.map(f => `
    <a class="mon-card" href="#gimmicks/${f.name}">
      ${spriteImg(f.id)}
      <span class="name">${esc(gimmickLabel(f.name))}</span>
    </a>`).join("")}</div>`;

  view.innerHTML = `
    <h1>Battle gimmicks</h1>
    <p class="lede">Each generation added its own once-per-battle power-up. Look up a Pokémon to see which gimmicks it can use in each game, what changes about its stats and moves, and what you need to unlock it.</p>
    ${gimmickSearchForm("")}
    <div class="gimmick-cards">
      ${GIMMICKS.map(g => `
        <article class="gimmick-card">
          <div class="dex-no">${esc(g.gen)}</div>
          <h3>${esc(g.name)}</h3>
          <p>${esc(g.how)}</p>
          <p class="muted">${esc(g.changes)}</p>
          ${chips(g.games)}
        </article>`).join("")}
    </div>
    <h2 class="grid-title">Mega Evolutions <span class="muted">(${forms.filter(f => f.g === "mega").length})</span></h2>
    ${grid(forms.filter(f => f.g === "mega"))}
    <h2 class="grid-title">Primal Reversion and Ultra Burst</h2>
    ${grid(forms.filter(f => f.g === "primal" || f.g === "ultra"))}
    <h2 class="grid-title">Gigantamax forms <span class="muted">(${forms.filter(f => f.g === "gmax").length})</span></h2>
    ${grid(forms.filter(f => f.g === "gmax"))}`;
  wireGimmickSearch();
}

function gimmickSearchForm(value) {
  return `
    <form class="nature-pokemon" id="gimmick-form">
      <label for="gimmick-input">Pokémon</label>
      <input id="gimmick-input" type="search" list="name-suggestions" placeholder="e.g. charizard" value="${esc(value)}" autocomplete="off">
      <button type="submit">Look up gimmicks</button>
      ${value ? `<a class="clear" href="#gimmicks">All gimmicks</a>` : ""}
    </form>`;
}

function wireGimmickSearch() {
  document.getElementById("gimmick-form").addEventListener("submit", e => {
    e.preventDefault();
    const q = document.getElementById("gimmick-input").value.trim().toLowerCase().replace(/^#?0*(?=\d)/, "").replace(/[.']/g, "").replace(/\s+/g, "-");
    location.hash = q ? `gimmicks/${q}` : "gimmicks";
  });
}

/* ---------- Page: one Pokémon ---------- */

async function renderGimmicks(query) {
  if (!query) return renderGimmickOverview();
  setCrumbs([{ label: "Battle gimmicks", href: "#gimmicks" }, { label: "Loading…" }]);
  view.innerHTML = `<p class="status">Loading ${esc(query)}…</p>`;

  const { species } = await loadSpeciesAndMon(query);
  const defaultV = species.varieties.find(v => v.is_default) || species.varieties[0];
  const base = await get(defaultV.pokemon.url);
  const name = english(species.names) || title(species.name);
  setCrumbs([{ label: "Battle gimmicks", href: "#gimmicks" }, { label: name }]);

  const formVarieties = species.varieties.filter(v => GIMMICK_FORM_RE.test(v.pokemon.name));
  const forms = await Promise.all(formVarieties.map(v => get(v.pokemon.url)));
  const byVg = movesByGame(base);
  const inGame = key => GAME_VGS[key].some(v => byVg[v]);
  const types = base.types.map(t => t.type.name);
  const sections = [];
  const notAvailable = [];

  // Mega Evolution
  const megas = forms.filter(f => gimmickOf(f.name) === "mega");
  if (megas.length) {
    const blocks = await Promise.all(megas.map(async f => {
      const games = megaGames(f.name, species.id);
      const [changes, stone] = await Promise.all([formChanges(base, f), itemInfo(MEGA_STONE[f.name])]);
      return `<div class="form-block">
        <div class="form-head">
          <img src="${f.sprites.other?.["official-artwork"]?.front_default || f.sprites.other?.home?.front_default || f.sprites.front_default || ""}" alt="">
          <div><h3 class="form-title">${esc(gimmickLabel(f.name))}</h3>${chips(games)}</div>
        </div>
        ${changes}
        ${statCompare(base, f)}
        ${spriteGallery(f, gimmickLabel(f.name))}
        <p class="note muted">${f.name === "rayquaza-mega"
          ? "Mega Rayquaza doesn't use a Mega Stone. It must know Dragon Ascent, and its moves otherwise stay the same."
          : "Moves: unchanged. A Mega Pokémon keeps the same four moves; only its stats, ability and type change."}</p>
        ${itemBox(stone, f.name === "rayquaza-mega" ? "No stone needed (knows Dragon Ascent)" : "Its Mega Stone")}
        ${whereToGet("mega", games)}
      </div>`;
    }));
    sections.push(gimmickSection("mega", blocks.join("")));
  } else notAvailable.push("Mega Evolution");

  // Primal Reversion
  const primals = forms.filter(f => gimmickOf(f.name) === "primal");
  if (primals.length) {
    const blocks = await Promise.all(primals.map(async f => {
      const games = GIMMICKS.find(g => g.id === "primal").games;
      const [changes, orb] = await Promise.all([formChanges(base, f), itemInfo(PRIMAL_ORB[f.name])]);
      return `<div class="form-block">
        <div class="form-head"><img src="${f.sprites.other?.["official-artwork"]?.front_default || f.sprites.other?.home?.front_default || ""}" alt=""><div><h3 class="form-title">${esc(gimmickLabel(f.name))}</h3>${chips(games)}</div></div>
        ${changes}${statCompare(base, f)}
        ${spriteGallery(f, gimmickLabel(f.name))}
        <p class="note muted">Moves: unchanged.</p>
        ${itemBox(orb)}${whereToGet("primal", games)}
      </div>`;
    }));
    sections.push(gimmickSection("primal", blocks.join("")));
  }

  // Z-Moves
  if (inGame("zmove")) {
    const games = GIMMICKS.find(g => g.id === "zmove").games.filter((g, i) => byVg[GAME_VGS.zmove[1 - i]]);
    const exclusive = Z_EXCLUSIVE[base.name] || Z_EXCLUSIVE[species.name] || [];
    const table = await convertedMoveTable(byVg, GAME_VGS.zmove, d => [Z_TYPE[d.type.name]?.[1] || "—", zPower(d.power)], "Z-Move");
    sections.push(gimmickSection("zmove", `
      ${chips(games)}
      ${exclusive.length ? `<h3>Exclusive Z-Move${exclusive.length > 1 ? "s" : ""}</h3>
        <ul class="plain">${exclusive.map(([crystal, move, z]) => `<li><strong>${esc(z)}</strong>: hold <strong>${esc(crystal)}</strong> and use ${esc(move)}.</li>`).join("")}</ul>` : ""}
      <h3>Type Z-Crystals for its own types</h3>
      <ul class="plain">${types.map(t => `<li>${typeBadge(t)} <strong>${Z_TYPE[t][0]}</strong> turns any damaging ${title(t)} move into <strong>${Z_TYPE[t][1]}</strong>.</li>`).join("")}</ul>
      <p class="note muted">Stats: unchanged. Any type's Z-Crystal works on a matching move, not just its own types.</p>
      ${table}
      ${whereToGet("zmove", games)}`));
  } else notAvailable.push("Z-Moves (not in Sun / Moon or Ultra Sun / Ultra Moon)");

  // Ultra Burst
  const ultra = forms.find(f => f.name === "necrozma-ultra");
  if (ultra) {
    const changes = await formChanges(base, ultra);
    sections.push(gimmickSection("ultra", `
      <div class="form-block">
        <div class="form-head"><img src="${ultra.sprites.other?.["official-artwork"]?.front_default || ""}" alt=""><div><h3 class="form-title">Ultra Necrozma</h3>${chips(["Ultra Sun / Ultra Moon"])}</div></div>
        ${changes}${statCompare(base, ultra)}
        ${spriteGallery(ultra, "Ultra Necrozma")}
        <p class="note muted">Moves: Photon Geyser becomes Light That Burns the Sky with Ultranecrozium Z. Necrozma must first fuse with Solgaleo (Dusk Mane) or Lunala (Dawn Wings).</p>
        ${itemBox(await itemInfo("ultranecrozium-z"))}${whereToGet("ultra", ["Ultra Sun / Ultra Moon"])}
      </div>`));
  }

  // Dynamax + Gigantamax
  if (inGame("dynamax") && !NO_DYNAMAX.has(species.name)) {
    const table = await convertedMoveTable(byVg, GAME_VGS.dynamax, d => [MAX_MOVE[d.type.name] || "—", maxPower(d.power, d.type.name)], "Max Move");
    sections.push(gimmickSection("dynamax", `
      ${chips(["Sword / Shield"])}
      <div class="change-grid">
        <div><span class="label">HP</span>×1.5 at Dynamax Level 0, up to ×2 at Dynamax Level 10</div>
        <div><span class="label">Other stats</span>Unchanged</div>
        <div><span class="label">Status moves</span>All become Max Guard</div>
      </div>
      ${table}
      ${whereToGet("dynamax", ["Sword / Shield"])}`));
  } else notAvailable.push(NO_DYNAMAX.has(species.name) ? "Dynamax (this Pokémon can't Dynamax)" : "Dynamax (not in Sword / Shield)");

  const gmaxForms = forms.filter(f => gimmickOf(f.name) === "gmax");
  if (gmaxForms.length) {
    const blocks = await Promise.all(gmaxForms.map(async f => {
      const key = f.name.replace(/-gmax$/, "");
      const [gmove, gtype] = GMAX_MOVE[key] || GMAX_MOVE[species.name] || ["its G-Max Move", null];
      const table = await convertedMoveTable(byVg, GAME_VGS.dynamax,
        d => d.type.name === gtype ? [gmove, maxPower(d.power, d.type.name)] : [MAX_MOVE[d.type.name] || "—", maxPower(d.power, d.type.name)], "Max / G-Max Move");
      return `<div class="form-block">
        <div class="form-head"><img src="${f.sprites.other?.["official-artwork"]?.front_default || f.sprites.other?.home?.front_default || f.sprites.front_default || ""}" alt="" onerror="this.style.visibility='hidden'"><div><h3 class="form-title">${esc(gimmickLabel(f.name))}</h3>${chips(["Sword / Shield"])}</div></div>
        <div class="change-grid">
          <div><span class="label">Exclusive move</span>${gtype ? `${typeBadge(gtype)} moves become <strong>${esc(gmove)}</strong>` : esc(gmove)}</div>
          <div><span class="label">Stats</span>Same as Dynamax: HP up to ×2, others unchanged</div>
          <div><span class="label">Height</span>${(f.height / 10).toFixed(1)} m while Gigantamaxed</div>
        </div>
        ${spriteGallery(f, gimmickLabel(f.name))}
        ${table}
        ${whereToGet("gmax", ["Sword / Shield"])}
      </div>`;
    }));
    sections.push(gimmickSection("gmax", blocks.join("")));
  }

  // Terastallization
  if (inGame("tera")) {
    const knowsTeraBlast = GAME_VGS.tera.some(v => (byVg[v] || []).some(m => m.name === "tera-blast"));
    sections.push(gimmickSection("tera", `
      ${chips(["Scarlet / Violet"])}
      <div class="change-grid">
        <div><span class="label">Usual Tera Type</span>${types.map(t => typeBadge(t)).join("")} <span class="muted">(matches its own type unless changed)</span></div>
        <div><span class="label">Type after Terastallizing</span>Its Tera Type only; any of the 18 types (plus Stellar in The Indigo Disk)</div>
        <div><span class="label">Stats</span>Unchanged</div>
        <div><span class="label">Damage</span>STAB on the Tera Type; 2× instead of 1.5× if the Tera Type matches one of its original types</div>
        <div><span class="label">Tera Blast</span>${knowsTeraBlast ? "Can learn it. It becomes the Tera Type, and physical if Attack is higher than Sp. Atk" : "Can't learn it in Scarlet / Violet"}</div>
      </div>
      ${whereToGet("tera", ["Scarlet / Violet"])}`));
  } else notAvailable.push("Terastallization (not in Scarlet / Violet)");

  view.innerHTML = `
    <h1>${esc(name)}: battle gimmicks</h1>
    ${gimmickSearchForm(species.name)}
    <div class="nature-mon">
      <img src="${SPRITE(base.id)}" alt="">
      <div>
        <a href="#pokemon/${species.name}"><strong>${esc(name)}</strong></a>
        <div class="types">${types.map(t => typeBadge(t)).join("")}</div>
        <p class="muted">${sections.length ? `Can use ${sections.length} gimmick${sections.length > 1 ? "s" : ""}.` : "Can't use any battle gimmick."}</p>
      </div>
    </div>
    ${sections.join("")}
    ${notAvailable.length ? `<p class="muted note">Not available: ${notAvailable.map(esc).join(" · ")}.</p>` : ""}`;
  wireGimmickSearch();
}

function gimmickSection(id, body) {
  const g = GIMMICKS.find(x => x.id === id);
  return `<section class="panel gimmick-panel">
    <div class="panel-head"><h2>${esc(g.name)}</h2><span class="dex-no">${esc(g.gen)}</span></div>
    <p class="muted">${esc(g.how)}</p>
    ${body}
  </section>`;
}
