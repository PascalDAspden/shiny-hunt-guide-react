import { rate } from './raids.js';

/** Only catchable Rocket rewards explicitly marked shiny by the lineup feed. */
export function shinyRocketEncounters(lineups) {
  return Object.entries(lineups || {}).flatMap(([trainer, slots]) =>
    (Array.isArray(slots) ? slots : []).filter((slot) => slot.is_encounter === true).flatMap((slot) =>
      (Array.isArray(slot.pokemons) ? slot.pokemons : [])
        .filter((pokemon) => pokemon?.name && pokemon.shiny_available === true)
        .map((pokemon) => ({
          name: `Shadow ${pokemon.name.replace(/^shadow\s+/i, '')}`,
          image: pokemon.asset_url,
          trainer,
          slot: slot.slot,
          canBeShiny: true,
          odds: rate('Rate varies', 'unverified', 'Catchable Team GO Rocket Shadow reward')
        }))
    )
  ).filter((pokemon, index, all) => all.findIndex((other) => other.name === pokemon.name && other.trainer === pokemon.trainer) === index);
}
