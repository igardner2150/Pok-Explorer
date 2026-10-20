# Poké Explorer

**Team:** Jaden Stokes, Ian Gardner

Poké Explorer is a web service for looking up any Pokémon: its region of origin, evolution chain and how to evolve it, typing, type weaknesses and strengths, base stats, abilities, every version of how it looks, and the games it appears in. All data comes live from [PokéAPI](https://pokeapi.co).

## Running it

No build step or install is needed. Keep the three files in the same folder and open `index.html` in a browser (an internet connection is required for PokéAPI). For a local server instead, run `python -m http.server` in the folder and visit http://localhost:8000.

| File | Purpose |
|---|---|
| `index.html` | Page shell: top bar, search, breadcrumb, main view |
| `styles.css` | All styling, light and dark mode |
| `app.js` | API calls, routing, and rendering of the three layers |

## The three layers

| Layer | Route | What it shows | PokéAPI endpoints |
|---|---|---|---|
| a) Regions | `#` | Every region as a card (Kanto, Johto, … Paldea) | `GET /region`, `GET /region/{name}` |
| b) Pokémon from a region | `#region/kanto` | Every Pokémon that originates in that region, with sprite and Pokédex #, plus a live filter | `GET /generation/{id}` (or `GET /pokedex/{name}` for Hisui) |
| c) Pokémon details | `#pokemon/pikachu` | Pokédex # and entry, genus, region, height/weight, typing, weaknesses / strengths / resistances, base stats, abilities (incl. hidden), evolution chain with evolution methods, sprites and alternate forms, cry, games, wild encounter locations | `GET /pokemon-species/{name}`, `GET /pokemon/{id}`, `GET /evolution-chain/{id}`, `GET /type/{name}`, `GET /ability/{name}`, `GET /pokemon/{id}/encounters` |

The search bar in the header jumps straight to Layer 3 from anywhere (name or National Pokédex number). Breadcrumbs link back up through the layers, and the browser Back button works because each layer has its own URL hash.

## How some of the data is derived

- **"Originates from a region"** uses the region's main generation: `/generation/{id}` lists exactly the species that debuted there. Hisui has no generation of its own, so it falls back to its regional Pokédex.
- **Weak to / resists / immune** multiplies the damage relations of each of the Pokémon's types against all 18 attacking types (e.g. Charizard takes ×4 from Rock).
- **Strong against** is the union of each type's `double_damage_to` list.
- **How to evolve** turns PokéAPI's `evolution_details` (min level, item, trade, friendship, time of day, held item, known move, location, etc.) into a readable sentence.
- **Games** combines the versions from game indices, Pokédex entries and wild encounters, since newer games aren't always in every list.

Responses are cached in memory so moving between layers doesn't re-download data.
