# Poké Explorer

![Tests](https://github.com/igardner2150/Pok-Explorer/actions/workflows/tests.yml/badge.svg)

**Team:** Jaden Stokes, Ian Gardner

**Live site:** http://77.113.237.171 (AWS) · backup at https://igardner2150.github.io/Pok-Explorer/ (GitHub Pages)

## 1. Project name and team

**Poké Explorer**, built by Jaden Stokes and Ian Gardner.

## 2. Description

Poké Explorer is a web service for looking up any Pokémon. For each one it shows the region it comes from, its evolution chain and how to evolve it, its type, what it's weak to and strong against, its base stats and abilities, and every version of how it looks, including shiny and alternate forms. It also lists the games it appears in and where to find it.

Around that core it adds tools for players: regional forms, battle gimmicks (Mega Evolution through Terastallization), natures, a team builder, a damage calculator, a stat calculator, ability, move and item lookups, breeding information, a quiz, and a tracker for the games, Pokémon and shinies a player owns.

## 3. Web API: PokéAPI

[PokéAPI](https://pokeapi.co) is a free, open RESTful API with data on every Pokémon. It needs no key or sign-up and allows requests from any website, so the browser calls it directly. Base URL: `https://pokeapi.co/api/v2/`.

| Endpoint | Used for |
|---|---|
| `/region`, `/region/{name}` | Region cards (Layer 1) |
| `/generation/{id}`, `/pokedex/{name}` | Pokémon from each region (Layer 2) |
| `/pokemon-species/{name}` | Pokédex number and entry, genus, generation, evolution chain link, egg groups, gender ratio, forms |
| `/pokemon/{name}` | Types, base stats, EV yield, abilities, sprites, cry, games, moves |
| `/pokemon/{id}/encounters` | Where to find it in the wild |
| `/evolution-chain/{id}` | Evolution chain and how each stage evolves |
| `/type/{name}` | Weaknesses, resistances, team and damage calculations |
| `/ability/{name}`, `/move/{name}` | Ability and move details, and who has or learns them |
| `/nature/{name}` | Nature effects and flavor preferences |
| `/egg-group/{name}` | Breeding partners |
| `/item/{name}`, `/item-pocket/{name}`, `/item-category/{name}` | Items page, Mega Stones, Z-Crystals |

Sprites and artwork come from PokéAPI's sprite repository. Responses are cached in the browser for 7 days to keep the site fast and reduce load on PokéAPI.

## 4. Three layers of interaction

| Layer | Route | What it shows |
|---|---|---|
| **a) List of regions** | `#` | Every region as a card (Kanto through Paldea). The home page also has a search box, quick links and a Pokémon of the day. |
| **b) Pokémon from the selected region** | `#region/kanto` | Every Pokémon that debuted there, with sprite and Pokédex number, a filter box and a *Regional forms* sub-tab |
| **c) Details of the selected Pokémon** | `#pokemon/charizard` | Tabs for **Overview** (stats, abilities, type matchups), **Evolution & forms**, **Moves** (per game, with levels), **Training & breeding** (natures, EV yield, egg groups) and **Games & shiny** (games, wild locations, shiny odds) |

The search bar jumps straight to Layer 3 from anywhere, breadcrumbs lead back up, and every page has its own link.

## Features

The site has four sections, each with its own sub-menu:

- **Pokédex:** regions, regional forms (Alolan, Galarian, Hisuian, Paldean), Pokémon details.
- **Battle**
  - **Battle gimmicks:** Mega Evolution, Primal Reversion, Z-Moves, Ultra Burst, Dynamax, Gigantamax and Terastallization. For each Pokémon it shows the games each gimmick is in, how stats, types, abilities and moves change, the item needed, and where to get it in each game.
  - **Team builder:** a weakness chart, biggest threats, coverage gaps, and shareable team links.
  - **Damage calculator:** levels, EVs, natures, stat stages, about 45 common abilities, items, Tera types, weather, critical hits, burn and screens. It shows all 16 damage rolls, % of HP and the odds to KO.
  - **Natures:** recommended natures by role, with explanations based on the Pokémon's stats.
- **Tools:** Compare, Type chart, Advanced search, Stat calculator (with a guide to IVs, EVs and natures), Abilities, Moves, Items, Breeding, and Who's That Pokémon?
- **My tracker:** games owned, caught and shiny Pokémon (list or PC-box view), regional and Gigantamax forms, and shiny hunt counters with odds. Saved in the browser, with export and import.

Plus: official spellings everywhere (Mr. Mime, Farfetch'd, Nidoran♀), a light/dark/auto theme, loading placeholders, a phone-friendly layout, per-page browser-tab titles, and link previews when the site is shared.

## Running it locally

No install or build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000     # then visit http://localhost:8000
```

An internet connection is needed for PokéAPI.

## Deployment

**Main site: AWS EC2** (Amazon Linux 2023, Apache, HTTPS from Let's Encrypt via certbot):

```bash
cd ~/Pok-Explorer && git pull
sudo cp ~/Pok-Explorer/*.html ~/Pok-Explorer/*.css ~/Pok-Explorer/*.js ~/Pok-Explorer/*.png /var/www/html/
```

**Backup: GitHub Pages**, published automatically from the `main` branch.

## Testing

```bash
npm test
```

42 automated tests (Node's built-in test runner, no dependencies) check:

- **Formulas:** the stat and damage formulas against Bulbapedia's worked examples, KO odds, and abilities, Tera and critical-hit rules.
- **Names and search:** official spellings, form names, item and move names, and search matching.
- **Game data:** type matchups, role suggestions, shiny odds and Mega Evolution availability.
- **Saved data:** tracker saves (including old saves and corrupted data) and shiny hunt math.
- **Project files:** every script is valid, loads together, and is included in `index.html`.

GitHub Actions runs the tests on Node 20 and 22 for every push. The badge at the top shows the result.

## Project structure

| File | Purpose |
|---|---|
| `index.html` | Page shell: top bar, navigation, link-preview tags |
| `styles.css` | All styling, light and dark themes (numbered sections, table of contents at the top) |
| `app.js` | Data loading and caching, names, routing, the three layers, regional forms, natures |
| `gimmicks.js` | Battle gimmicks |
| `tracker.js` | My tracker |
| `extras.js` | Team builder, Compare, Type chart, Advanced search, quiz, Pokémon of the day |
| `training.js` | Stat calculator, Abilities, Moves, Breeding |
| `battle.js` | Damage calculator, Items |
| `og-image.png` | Image for link previews |
| `tests/` | Automated tests |
| `.github/workflows/tests.yml` | Runs the tests on GitHub |
| `ARCHITECTURE.md` | How the project fits together, with diagrams |

## Data sources and credits

- Pokémon data and sprites: [PokéAPI](https://pokeapi.co).
- Information PokéAPI doesn't include (shiny odds, item and key-item locations, Z-Move and Max Move names) is kept in labelled tables in the code, with sources noted. Locations come from Bulbapedia, Gamer Guides, Prima Games, Pokémon GO Hub, Player.One and RPG Site.
- Pokémon and all related names are trademarks of Nintendo, Creatures Inc. and GAME FREAK. This is a fan project for a class and isn't affiliated with them.

## Known limitations

- The damage calculator models common abilities and items; anything marked "not modeled" isn't included.
- Mega Stone locations for Legends: Z-A aren't listed yet.
- Tracker progress is saved per browser. Use Export/Import to move it between devices.
