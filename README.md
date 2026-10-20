# Poké Explorer

**Team:** Jaden Stokes, Ian Gardner

Poké Explorer is a web service for looking up any Pokémon: its region of origin, evolution chain and how to evolve it, typing, type weaknesses and strengths, base stats, abilities, every version of how it looks, and the games it appears in. All data comes live from [PokéAPI](https://pokeapi.co).

## Running it

No build step or install is needed. Keep all the files below in the same folder and open `index.html` in a browser (an internet connection is required for PokéAPI). For a local server instead, run `python -m http.server` in the folder and visit http://localhost:8000.

| File | Purpose |
|---|---|
| `index.html` | Page shell: top bar, search, breadcrumb, main view |
| `styles.css` | All styling, light and dark mode |
| `app.js` | API calls, routing, the three layers, regional forms and natures |
| `tracker.js` | My tracker tab: games owned, caught/shiny Pokémon (list or PC box view), regional and Gigantamax forms, shiny hunt counters (saved in the browser) |
| `extras.js` | Team builder, Tools tab (compare, type chart, advanced search, Who's That Pokémon?) and Pokémon of the day |
| `training.js` | Tools: stat calculator with an IV/EV/nature guide, ability search, move search, breeding; the Training & breeding panel on details pages |
| `battle.js` | Damage calculator and Items pages |
| `og-image.png` | Image shown in link previews (Discord, iMessage, etc.) |
| `gimmicks.js` | Battle gimmicks tab (Mega Evolution, Primal Reversion, Z-Moves, Ultra Burst, Dynamax, Gigantamax, Terastallization) |

## The three layers

| Layer | Route | What it shows | PokéAPI endpoints |
|---|---|---|---|
| a) Regions | `#` | Every region as a card (Kanto, Johto, … Paldea) | `GET /region`, `GET /region/{name}` |
| b) Pokémon from a region | `#region/kanto` | Every Pokémon that originates in that region, with sprite and Pokédex #, plus a live filter | `GET /generation/{id}` (or `GET /pokedex/{name}` for Hisui) |
| c) Pokémon details | `#pokemon/pikachu` | Pokédex # and entry, genus, region, height/weight, typing, weaknesses / strengths / resistances, base stats, abilities (incl. hidden), evolution chain with evolution methods, sprites and alternate forms, cry, games, wild encounter locations, shiny odds per game (with and without the Shiny Charm), every learnable move per game (level-up with levels, TM/HM/TR, egg, tutor) | `GET /pokemon-species/{name}`, `GET /pokemon/{id}`, `GET /evolution-chain/{id}`, `GET /type/{name}`, `GET /ability/{name}`, `GET /pokemon/{id}/encounters`, `GET /move/{name}` |

## Navigation

Four main sections, each with its own sub-menu (routes are plain URL hashes, so every page can be bookmarked or shared):

| Section | Pages |
|---|---|
| **Pokédex** | Regions (home), Regional forms, Pokémon details |
| **Battle** | Battle gimmicks, Team builder, Damage calculator, Natures |
| **Tools** | Compare, Type chart, Advanced search, Stat calculator, Abilities, Moves, Items, Breeding, Who's That Pokémon? |
| **My tracker** | My games, Pokédex (list or PC boxes), Forms, Shiny hunts |

The home page has a large search box, quick links to the most-used tools, a **Pokémon of the day** (the same for everyone each day) and a **Random Pokémon** button, above the region cards.

Each **Pokémon details page** is split into tabs: **Overview** (stats, abilities, type matchups), **Evolution & forms** (evolution chain, sprites, other forms, battle gimmicks), **Moves** (loaded only when opened), **Training & breeding** (natures, EV yield, egg groups) and **Games & shiny**. Each tab has its own link, e.g. `#pokemon/eevee/moves`.

Other site-wide touches: correct official spellings everywhere (Mr. Mime, Farfetch'd, Nidoran♀, Type: Null, Flabébé, "Giratina (Origin)"), search that accepts those spellings, a light / dark / auto theme switch, skeleton loading placeholders, a Poké Ball tab icon, per-page browser-tab titles, and link-preview tags so shared links show a title, description and image.

- **Regional forms** (`#forms`) works like Regions: a card for Alola, Galar, Hisui and Paldea, and selecting one (`#forms/alola`) lists that region's forms with a filter. Region pages for Alola, Galar, Hisui and Paldea also have a *Regional forms* sub-tab. Forms come from PokéAPI's Pokémon list (names like `vulpix-alola`), and each one opens its own details page (`#pokemon/vulpix-alola`).
- **Battle gimmicks** (`#gimmicks`, or `#gimmicks/charizard`) shows each gimmick and every Mega, Primal, Ultra and Gigantamax form. For a specific Pokémon it shows, per game: the forms it can take, a stat comparison against its base form, type/ability/size changes, how its damaging moves convert into Z-Moves, Max Moves or G-Max Moves (with new power), exclusive Z-Moves, Tera rules, the item it needs (from `GET /item/{name}`), and where to get the key item. Gimmick forms, stats and moves are live from PokéAPI; game availability, Z-Move/Max Move names, power conversions and item locations are tables in `gimmicks.js` because PokéAPI doesn't have them.

- **My tracker** (`#tracker/games`, `#tracker/pokedex`) lets a player check off the main-series games they own and, for all 1,025 Pokémon, which ones they've caught and which they have shiny, with progress bars and filters (generation, missing, no shiny yet). Details pages have the same *I have it* / *I have it shiny* checkboxes, region lists show ✓ and ★ badges, and the shiny-odds table marks games the player owns. Because the site has no backend, progress is saved in the player's browser (`localStorage`); **Export progress** downloads a JSON backup and **Import progress** restores it on any device.

- **Team builder** (`#team`) holds up to six Pokémon (forms allowed). **Share this team** creates a link like `#team/garchomp,rotom-wash,…`; opening it shows that team without changing the viewer's own, with a *Save as my team* button. It charts how every attacking type hits each member, flags types that threaten three or more members, and lists defending types the team's STAB moves can't hit super effectively. Uses `GET /type/{name}` for all 18 types.
- **Tools** (`#tools/...`): **Compare** two Pokémon side by side (`#tools/compare/charizard/blastoise`), an interactive 18×18 **Type chart** with a dual-type calculator, **Advanced search** by type, second type, generation, minimum stat and sort order, and **Who's That Pokémon?**, a silhouette quiz with cries, generation filters and a saved best streak.
  - **Stat calculator** (`#tools/stats/garchomp`): real stats at any level from base stats, IVs (0–31), EVs (0–252, 510 total) and nature, with possible ranges, EV-limit warnings, common spread presets, and a guide explaining IVs, EVs, natures and how older games differ. Uses the Gen 3+ formula: HP = ⌊(2B + IV + ⌊EV/4⌋)·L/100⌋ + L + 10; other stats = ⌊(⌊(2B + IV + ⌊EV/4⌋)·L/100⌋ + 5)·N⌋.
  - **Abilities** (`#tools/abilities/intimidate`): an ability's effect and every Pokémon that can have it, split into regular and Hidden Ability (`GET /ability/{name}`).
  - **Moves** (`#tools/moves/earthquake`): a move's type, category, power, accuracy, PP, priority, target and effect, and every Pokémon that can learn it (`GET /move/{name}`).
  - **Breeding** (`#tools/breeding/eevee`): egg groups, gender ratio, egg cycles, what hatches, every compatible partner by egg group, and a guide to breeding, inheritance and the Masuda Method (`GET /egg-group/{name}`, `GET /evolution-chain/{id}`).
  - **Items** (`#tools/items`): browse every item by bag pocket and category, or open one (`#tools/items/choice-scarf`) for its effect, price, Fling power and the wild Pokémon that hold it (`GET /item-pocket`, `/item-category/{name}`, `/item/{name}`).
- **Damage calculator** (`#damage`): attacker and defender (level, EVs, nature, stat stages, items, Terastallization), a move, and field conditions (weather, critical hit, burn, screens, spread). Shows the 16 damage rolls, the range as % of HP, and the exact chance to OHKO / 2HKO / 3HKO. Uses the Gen 5+ formula: base = ⌊⌊⌊2L/5 + 2⌋·Power·A/D⌋/50⌋ + 2, then spread, weather, critical hit, random 85–100%, STAB (Tera-aware), type effectiveness, burn, screens and item modifiers. Checked against Bulbapedia's worked example (level 75 Glaceon's Ice Fang vs Garchomp: 168–196).
- Every details page also has a **Training & breeding** panel: EV yield, egg groups, gender ratio, egg cycles, base friendship and growth rate.
- **My tracker** also has a **Forms** sub-tab for regional and Gigantamax forms, a **Boxes** view of the Pokédex (30-slot PC boxes; click once for caught, twice for shiny), and **Shiny hunts**: pick a Pokémon, game and Shiny Charm, count encounters, and see the chance of having found one by now (1 − (1 − 1/N)ⁿ). Marking a hunt found also marks that Pokémon shiny.

There is also a **Natures** tab (`#natures`, or `#natures/garchomp` for a specific Pokémon) on the home page. You pick a role (fast physical or special attacker, mixed attacker, physical or special wall, Trick Room, fast support) and it recommends natures, explains each pick using the Pokémon's base stats, and shows all 25 natures in a +/− grid (`GET /nature`, `GET /nature/{name}`). Each details page also suggests a role and its best natures.

The search bar in the header jumps straight to Layer 3 from anywhere (name or National Pokédex number). Breadcrumbs link back up through the layers, and the browser Back button works because each layer has its own URL hash.

## How some of the data is derived

- **"Originates from a region"** uses the region's main generation: `/generation/{id}` lists exactly the species that debuted there. Hisui has no generation of its own, so it falls back to its regional Pokédex.
- **Weak to / resists / immune** multiplies the damage relations of each of the Pokémon's types against all 18 attacking types (e.g. Charizard takes ×4 from Rock).
- **Strong against** is the union of each type's `double_damage_to` list.
- **How to evolve** turns PokéAPI's `evolution_details` (min level, item, trade, friendship, time of day, held item, known move, location, etc.) into a readable sentence.
- **Games** combines the versions from game indices, Pokédex entries and wild encounters, since newer games aren't always in every list.

- **Moves** come from the Pokémon's `moves` list, grouped by game (version group). A game picker switches between games; each move's type, category, power, accuracy and PP come from `/move/{name}`. Level "Evo" means it's learned on evolving.
- **Shiny odds** aren't in PokéAPI, so `app.js` has a table of full-odds rates per game: 1/8192 in Gens 2–5, 1/4096 from Gen 6 on. With the Shiny Charm it's about 1/2731 in Black 2/White 2, 1/1365 in later games, and 1/1024 in Legends: Arceus.

- **Suggested role** compares the higher attacking stat with the higher defense, then physical vs. special (within 10 points counts as mixed), then Speed (under 50 suggests Trick Room). Every Pokémon can have any nature; the role only decides which ones are recommended.

- **Item locations** in the Battle gimmicks tab come from Bulbapedia (key items and orbs per game), Gamer Guides (X / Y Mega Stones) and Prima Games (Omega Ruby / Alpha Sapphire Mega Stones). Stone locations for later games are not listed yet.

Responses are cached in memory for the current visit and in the browser's IndexedDB for 7 days, so repeat visits load almost instantly and send far fewer requests to PokéAPI.
