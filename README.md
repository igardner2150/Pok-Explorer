# Poké Explorer

**Team:** Jaden Stokes, Ian Gardner

Poké Explorer is a web service for looking up any Pokémon: its region of origin, evolution chain and how to evolve it, typing, type weaknesses and strengths, base stats, abilities, every version of how it looks, and the games it appears in. All data comes live from [PokéAPI](https://pokeapi.co).

## Running it

No build step or install is needed. Keep the three files in the same folder and open `index.html` in a browser (an internet connection is required for PokéAPI). For a local server instead, run `python -m http.server` in the folder and visit http://localhost:8000.

| File | Purpose |
|---|---|
| `index.html` | Page shell: top bar, search, breadcrumb, main view |
| `styles.css` | All styling, light and dark mode |
| `app.js` | API calls, routing, the three layers, regional forms and natures |
| `tracker.js` | My tracker tab: games owned, caught and shiny Pokémon (saved in the browser) |
| `gimmicks.js` | Battle gimmicks tab (Mega Evolution, Primal Reversion, Z-Moves, Ultra Burst, Dynamax, Gigantamax, Terastallization) |

## The three layers

| Layer | Route | What it shows | PokéAPI endpoints |
|---|---|---|---|
| a) Regions | `#` | Every region as a card (Kanto, Johto, … Paldea) | `GET /region`, `GET /region/{name}` |
| b) Pokémon from a region | `#region/kanto` | Every Pokémon that originates in that region, with sprite and Pokédex #, plus a live filter | `GET /generation/{id}` (or `GET /pokedex/{name}` for Hisui) |
| c) Pokémon details | `#pokemon/pikachu` | Pokédex # and entry, genus, region, height/weight, typing, weaknesses / strengths / resistances, base stats, abilities (incl. hidden), evolution chain with evolution methods, sprites and alternate forms, cry, games, wild encounter locations, shiny odds per game (with and without the Shiny Charm), every learnable move per game (level-up with levels, TM/HM/TR, egg, tutor) | `GET /pokemon-species/{name}`, `GET /pokemon/{id}`, `GET /evolution-chain/{id}`, `GET /type/{name}`, `GET /ability/{name}`, `GET /pokemon/{id}/encounters`, `GET /move/{name}` |

The tab bar on the home page has five sections: **Regions**, **Regional forms**, **Battle gimmicks**, **Natures** and **My tracker**.

- **Regional forms** (`#forms`) works like Regions: a card for Alola, Galar, Hisui and Paldea, and selecting one (`#forms/alola`) lists that region's forms with a filter. Region pages for Alola, Galar, Hisui and Paldea also have a *Regional forms* sub-tab. Forms come from PokéAPI's Pokémon list (names like `vulpix-alola`), and each one opens its own details page (`#pokemon/vulpix-alola`).
- **Battle gimmicks** (`#gimmicks`, or `#gimmicks/charizard`) shows each gimmick and every Mega, Primal, Ultra and Gigantamax form. For a specific Pokémon it shows, per game: the forms it can take, a stat comparison against its base form, type/ability/size changes, how its damaging moves convert into Z-Moves, Max Moves or G-Max Moves (with new power), exclusive Z-Moves, Tera rules, the item it needs (from `GET /item/{name}`), and where to get the key item. Gimmick forms, stats and moves are live from PokéAPI; game availability, Z-Move/Max Move names, power conversions and item locations are tables in `gimmicks.js` because PokéAPI doesn't have them.

- **My tracker** (`#tracker/games`, `#tracker/pokedex`) lets a player check off the main-series games they own and, for all 1,025 Pokémon, which ones they've caught and which they have shiny, with progress bars and filters (generation, missing, no shiny yet). Details pages have the same *I have it* / *I have it shiny* checkboxes, region lists show ✓ and ★ badges, and the shiny-odds table marks games the player owns. Because the site has no backend, progress is saved in the player's browser (`localStorage`); **Export progress** downloads a JSON backup and **Import progress** restores it on any device.

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

Responses are cached in memory so moving between layers doesn't re-download data.
