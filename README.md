# Shiny Hunt Guide — React source with restored field-guide design

This project keeps the editable Vite + React component/page/data/hooks/utils
folder structure, while restoring the field-guide frontend: the blue Mew icon,
Hunt and Calendar bottom navigation, featured event cards, calendar export,
local-time countdowns, and the original dark/lime visual design.

Card sprites now use the same Leek Duck icon path and 66px/75px card sizing
as the working static guide. The artwork switch remains the Normal/Shiny
control at the top of the Hunt page.

## Run it

Open Terminal inside the unzipped `shiny-hunt-guide-react-restored` folder
(in Finder, drag the folder onto Terminal after typing `cd `). Then run:

```bash
npm --version
npm install
npm run dev
```

Open the **Local** URL that Terminal prints (usually `http://localhost:5173`;
it may use a different port if an older development server is still running).
Stop any older `npm run dev` terminal with Control-C and refresh the browser.

## Install on your iPhone with Xcode (macOS)

This ZIP includes a Capacitor iOS project with a bundled copy of the web app.
You need Xcode, Node.js 22+, and an internet connection the first time Xcode
downloads the Capacitor Swift package. On your Mac, open Terminal in the folder
containing this README and run:

```bash
npm install
npm run ios:sync
npm run ios:open
```

In Xcode, connect and unlock your iPhone, select the **App** project and target,
then choose **Signing & Capabilities → Team** and select your Apple Account's
Personal Team. Leave **Automatically manage signing** on. If Xcode says the
bundle identifier is already used, change it to another unique identifier.
Select your iPhone near the top of Xcode and press the **Run** (▶) button.
Enable **Developer Mode** on your iPhone if Xcode asks you to. The app installs
on the phone and runs without the Mac development server; current Pokémon data
and artwork still require internet access.

After editing the React code, run `npm run ios:sync` again before pressing Run
in Xcode. Rebuilding in Xcode alone will not copy the new React files.
The Eggs filter should show **1 km** between All eggs and 2 km.

The Hunt filters now also include **Research**, **Breakthrough**, and **Rocket**.
Field Research and Rocket rewards load live. Rocket cards only show catchable
rewards that the lineup feed explicitly marks as shiny-capable. Field Research
shows every Pokémon reward because the current feed marks even shiny species
as unavailable; check each encounter's shiny status before hunting. Research
Breakthrough has its own published Twilight Trails list (Sep 8–Dec 1, 2026),
separate from individual Field Research tasks. Because the seasonal pool source
does not supply a per-Pokémon shiny flag in a feed, the app asks you to check
each species before treating it as a shiny target. The list stops displaying
after the season ends.

Max Mondays have their own weekly-rotation section. The family comparison shows
Mega and Gigantamax forms even outside the current raid rotation, plus known
Dynamax family members and currently featured Max forms. A form in the family
comparison does not imply that its battle is currently available.

Current raid cards show a live "Leaves raid pool in" countdown when a dated,
active raid rotation explicitly lists that boss. The end date is displayed in
your local time. If the feed does not publish a matching rotation, the card says
the end is not listed instead of guessing. Refresh raids after a rotation ends.

```bash
npm run build     # production build to dist/
npm run preview   # serve that build locally
```

Requires Node 18+ and an internet connection — like the original, this app
has no bundled Pokémon data. Everything loads live from:

- **ScrapedDuck** (`raw.githubusercontent.com/bigfoott/ScrapedDuck`) — raids, eggs, field research, events
- **Leak Duck** (`raw.githubusercontent.com/zhenga8533/leak-duck`) — Team GO Rocket encounter slots and shiny availability
- **Leek Duck** (`leekduck.com/research/`) — dated Research Breakthrough pool snapshot
- **PogoAPI** — evolution requirements
- **PokéAPI** — species info, forms, and shiny artwork for mega/regional/Gigantamax forms
- **Leek Duck's CDN** — most normal-form sprites

The last successful copy of each feed is cached in `localStorage` so the app
still shows something if a feed request fails.

## What maps to what

| Original concept | Where it lives now |
|---|---|
| `state` + inline DOM rendering | `App.jsx` (feeds/status/appearance/search) + local `useState` in each page |
| Shiny odds table & raid tier logic | `data/raids.js` |
| Event parsing (Spotlight/Community Day/Hatch Day/Max Battles/ICS export) | `data/events.js` |
| PokéAPI/PogoAPI species, form & evolution lookups | `data/pokemon.js` |
| Name → form-slug / shiny-sprite-URL parsing | `utils/pokemonForms.js` |
| Raid list filtering | `utils/raidFilters.js` |
| Raid list sorting | `utils/raidSorting.js` |
| Date/countdown formatting | `utils/dates.js` |
| Live countdown text, local clock | `hooks/useCountdown.js` |
| `tracked-hunt-v1` active hunt + new persistent "checked off" list | `hooks/useChecklist.js` |
| Raid card | `components/RaidCard.jsx` |
| Egg / research / event / Max Battle card | `components/PokemonCard.jsx` |
| Calendar event card | `components/EventCard.jsx` |
| Raid/egg/research/event/Max detail modal | `components/PokemonDetail.jsx` |
| Evolution-family comparison strip | `components/EvolutionLine.jsx` |
| Normal/Shiny artwork switch | `components/ShinyToggle.jsx` |
| Raid scope/type/sort/shiny-only controls | `components/RaidFilters.jsx` |
| Sprite rendering + shiny fallback (new shared helper, not in your list) | `components/Sprite.jsx` |
| "Hunt" view (raids + eggs + events + Max filters) | `App.jsx`, `pages/Raids.jsx`, and `pages/Research.jsx` |
| Bottom Calendar view | `pages/Events.jsx` |
| Dashboard / active hunt / trackable list | `pages/Checklist.jsx` (now also lets you check off multiple targets, not just pin one) |

## Notes on the rebuild

- **Checklist is expanded, not just renamed.** The original only supported one
  "tracked hunt" at a time. That's preserved as the pinned "Active hunt" card,
  but the Checklist page adds a second, independent feature: a persistent
  set of checked-off targets (`shiny-checklist-v1` in localStorage) so you can
  tick off things you've already caught across all categories.
- **Sprite.jsx** is a small shared component that isn't in the structure you
  listed — every card and the detail modal needed the same shiny/normal
  fallback logic, so it was pulled out once rather than copy-pasted five times.
- Type match-ups, evolution families, and shiny-form artwork are fetched
  on demand and cached in memory (see `data/pokemon.js`), same as the
  original's lazy hydration — nothing blocks the initial render.
- No CSS framework — `styles/index.css` is one file using the original app's
  dark palette (`#0b1425` background, lime `#d2ef6e` accent, teal `#78e1d0`
  links) so it still feels like the same app.
