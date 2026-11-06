# Sourced hunt-location feed

Production currently contains no location records and has no live provider.
The application cannot discover Pokémon GO gyms or Power Spots from MapKit.
Never populate this file by guessing coordinates or current bosses.

Top level: `version: 1`, UTC `updatedAt`, and `locations: []`.
Each reviewed location needs a unique string `id`, `name`, `kind` (`gym` or
`power-spot`), numeric `latitude`/`longitude`, an HTTPS `source`, and UTC
`checkedAt`. Temporary places additionally need UTC `expiresAt`; expired places
are removed, rather than retained as permanent Power Spots. Refresh/review a
Power Spot's validity before publishing it without an expiry.

An optional `encounter` needs `verified: true`, Pokémon `name`, `battleType`
(`raid`, `dynamax`, `gigantamax`), HTTPS `source`, UTC `checkedAt`, and absolute
UTC `start`/`end` timestamps with explicit offsets. Use ISO-8601 with `Z` and
milliseconds. Optional `image` must be an HTTPS Pokémon artwork URL (the native
renderer accepts cdn.leekduck.com and raw.githubusercontent.com); optional
`canBeShiny` is a boolean. Omit the shiny flag when it has not been checked.

`verified` is the publisher's assertion that the cited source was checked. The
app validates fields, timing and provenance presence; it cannot establish the
truth of an arbitrary third-party report. Only ingest a permitted, reliable feed
or reviewed records. A community rotation announcement alone is insufficient
proof that a particular Pokémon is battling at a particular location.

Location and encounter expiry are independent. An ended encounter disappears
from battle filters and loses its Pokémon/shiny/countdown details. Its known
location may remain in All locations, labelled without a verified active battle,
unless the location itself expired. Cached failures never extend either expiry.

Coordinates are sent to Apple for native maps/directions, or to OpenStreetMap
when the user explicitly loads the web basemap. User GPS history and manually
entered destinations are not written to storage. Public source-backed place
records can be cached locally for offline fallback. Map tiles and routes still
need connectivity. Radius distances are straight-line, not calculated walking
route lengths. The native map is presented full screen from the Map tab; close
it to return to the rest of the guide.
