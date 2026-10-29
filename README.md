# Shiny Hunt Guide — React source with restored field-guide design

This project keeps the editable Vite + React component/page/data/hooks/utils
folder structure, while restoring the field-guide frontend: the blue Mew icon,
Hunt and Calendar bottom navigation, featured event cards, calendar export,
local-time countdowns, and the original dark/lime visual design.

Card sprites now use the same Leek Duck icon path and 66px/75px card sizing
as the working static guide. The artwork switch remains the Normal/Shiny
control at the top of the Hunt page.

The Hunt page has an odds calculator. Enter a number of encounters and a
community-estimated 1-in-N rate to see the estimated chance of at least one
shiny. A Pokémon's detail view prefills a numeric rate when available; for an
unknown rate you must enter one yourself. This tool does not import Pokémon GO
data, save encounters, or guarantee a result.

## Adding events to Calendar on iPhone

The installed iOS app uses Apple's native event editor. Tap **Add to Calendar**,
choose a calendar, review the title, dates and 30-minute reminder, then tap
**Add**. **Cancel** saves nothing. iOS 17+ does not require access to existing
calendar entries for this editor; iOS 15/16 requests Calendar access.
Browsers retain the existing `.ics` export fallback. This fixes the former
iPhone behaviour where the button exported an `.ics` file to the share sheet.
After updating, run `npm run ios:sync`, reopen Xcode and rebuild/install: a
web-only refresh cannot install the new Swift bridge. Verify Add and Cancel
on an iPhone before release. Run `npm run test:calendar` for bridge routing
and date-conversion regression checks.

## Costume Pokémon gallery

On **Hunt**, tap **Costumes** beside Raids. The gallery compares normal and
shiny costume artwork, including each permitted evolved form. Search also
matches evolved names (for example, Crobat finds the top-hat Zubat family).
Filter by availability or evolution rule. Evolution-locked costumes never
inherit an ordinary species evolution chain; final evolutions and unconfirmed
costume rules have separate labels. Existing encounter detail views reuse
these costume rules when their name or artwork identifies a known outfit.

The initial reviewed catalogue covers Halloween 2026: 12 costume families,
22 forms, and 44 bundled normal/shiny images. It includes the separate Phony
and Antique Sinistea routes (50 versus 400 Candy), the top-hat Zubat family,
and evolution-locked Halloween Mischief Piplup. Pikachu's hat-and-capelet
evolution is unconfirmed rather than inferred from ordinary Pikachu.

Each card has **Where to find**, with compact Wild / Raids / Research / GO Pass
labels. Expand it for the exact task, free or paid track, pass rank, event dates
and a source link. Dates follow the device timezone unless the source provides
an explicit timezone. Expired routes stop appearing as available automatically.
The default Hunt tab is **Featured** rather than one long All page.

`.github/workflows/update-costumes.yml` checks published event pages about every
6 hours on the default branch and commits `public/data/costume-encounters.json`.
It discovers active/upcoming events from ScrapedDuck (within 90 days) and reads
Leek Duck's encounter, research and pass reward sections. GitHub Actions must
be enabled with permission to write repository contents. Schedules may be delayed
or disabled after extended repository inactivity. Run it manually through Actions
or locally with `npm run update:costumes`.

The installed app reads this generated JSON on opening Costumes, returning to the
app, pressing Refresh costumes and every 10 minutes while that page is open.
Successful reads are cached. Later data updates therefore reach installed copies
without a new Xcode build; installing this new UI still requires an iOS sync and
rebuild. Failed refreshes show the saved guide and its timestamp. Failed individual
source pages keep their previous routes, original check time and original expiry.
Complete network or recognisable layout failures leave the saved file untouched.
A guide older than 48 hours displays an out-of-date notice.

Coverage depends on published source details. A debut or shiny preview alone does
not establish an encounter method. Text-only Timed Research can match existing
reviewed costume aliases; entirely new text-only rewards need manual review.
Unpublished rewards, regional restrictions and unusual page layouts can be missed;
use the linked event guide for eligibility. GO Pass dates conservatively follow
the containing event unless a separate pass window has been reviewed in the
updater (Halloween 2026's pass spans both parts). Earning points and claiming
already-unlocked rewards can have different deadlines; check the event guide.

`src/data/costumes.js` remains the reviewed source for costume-specific evolution
rules and released shiny forms. A new costume from an event gets an unconfirmed
evolution label, a single form and only explicitly marked shiny artwork. It never
inherits the ordinary species evolution chain. To verify a new chain, add its
sources, evolution restrictions, Candy costs and matching costume artwork there.
The 44 reviewed images are bundled for offline use. New event artwork loads from
Leek Duck's CDN; missing images stay unavailable instead of becoming an ordinary
Pokémon image. This is an event guide, not a complete historical costume Pokédex.

Run `npm run test:costumes` for parser, update failure, cache, expiry, identity,
evolution restriction, navigation and UI interaction checks.

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

Requires Node 22+ for the development tools. Live encounters and event updates
need an internet connection; the costume gallery also includes a saved guide.
Data sources include:

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

## Pokémon GO Promo Codes

The new **Promo Codes** navigation item has **Available** and **Redeemed** filters,
reward details, **Copy Code**, and **Redeem**. Expired or removed codes never appear
in Available. Redeemed marks are saved on this device in localStorage under
`redeemed-promo-codes-v1`; the button does not verify an actual redemption.

```bash
npm run scrape:codes   # One Leek Duck page request, writes src/data/promo-codes.json
npm run test:codes     # Parser, failure, filtering, and DOM interaction tests
npm run build
npm run ios:sync       # Build and copy the web app into the existing iOS project
npm run ios:open       # Open Xcode on your Mac
```

`scripts/scrape-promo-codes.js` uses Node fetch and Cheerio. It matches the actual
Leek Duck HTML inspected on 6 October 2026, including reward quantities and
`data-expires`. Hidden dates displayed as `???` become `null`. Published timezone
offsets are preserved; dates without an offset are interpreted as device-local
time, matching the source's local-time offers. Dates are displayed in your local
time. A missing title or reward does not discard the code. Duplicate codes are
merged case-insensitively, and previously seen removed/expired codes are archived
with `active: false` so redeemed history can still display them. Network/HTTP or
recognizable layout failures leave the previous JSON untouched. JSON writes are
atomic, sorted, and contain no changing run timestamp.

The workflow `.github/workflows/update-promo-codes.yml` runs approximately every
8 hours (00:23, 08:23, and 16:23 UTC) on the default branch. It installs dependencies,
runs the scraper, and commits **only** `src/data/promo-codes.json` when changed,
with the message `Update Pokémon GO promo codes`. It can also be run manually
from GitHub's Actions tab. GitHub Actions must be enabled and allowed to write
repository contents; scheduled runs can be delayed, and public repositories'
schedules can be disabled after 60 days without activity.

On opening the Promo Codes page, the app loads the generated JSON from this public
repository's raw GitHub URL. It never contacts Leek Duck from the frontend. The
React build includes a bundled fallback; successful feed reads are also cached
locally. The hosted static guide reads the same generated feed with its own
bundled fallback. This lets scheduled data updates reach installed iOS copies
without rebuilding the app. Changes to React code still require `git pull`,
`npm install`, `npm run ios:sync`, and a new Xcode build.

Redeem opens a new tab/window at
`https://store.pokemongo.com/offer-redemption?passcode=ENCODED_CODE`.
The user signs in and confirms on the official store; this app never logs in,
submits a redemption, or accesses Pokémon GO credentials.

Limitations: Leek Duck may change its HTML, publish outdated availability, omit
expiry/rewards, or stop responding. Unknown expiry cannot be checked locally;
redemption eligibility is ultimately determined by the official store. When a
feed refresh fails, the last saved information remains visible with a notice.
Copy needs clipboard access (normally HTTPS or localhost); failure shows manual
copy instructions. Redeemed marks persist only where localStorage is available.
The DOM tests simulate clipboard and page reload/remount; real Safari/iPhone and
native Xcode signing/build were not tested in the Linux workspace.
