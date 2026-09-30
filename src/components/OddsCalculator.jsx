import { useState } from 'react';
import { atLeastOneShiny, rateDenominator } from '../utils/odds.js';

const COMMON_RATES = [
  { label: 'Base / Spotlight', value: 512 },
  { label: 'Boosted / Mega / Egg', value: 64 },
  { label: 'Community Day', value: 25 },
  { label: 'Legendary raid', value: 20 },
  { label: 'Hatch Day', value: 10 }
];

/** All values are typed locally; this does not read or import Pokémon GO data. */
export default function OddsCalculator({ odds }) {
  const initialRate = rateDenominator(odds?.value);
  const [rate, setRate] = useState(initialRate ? String(initialRate) : '');
  const [attempts, setAttempts] = useState('0');
  const count = Number(attempts);
  const denominator = Number(rate);
  const validCount = /^\d+$/.test(attempts) && Number.isSafeInteger(count) && count <= 1000000;
  const validRate = /^\d+$/.test(rate) && Number.isSafeInteger(denominator) && denominator >= 2 && denominator <= 1000000000;
  const chance = validCount && validRate ? atLeastOneShiny(count, denominator) : null;
  const percent = chance === null ? null : new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(chance * 100);

  return (
    <section className="odds-calculator" aria-label="Shiny odds calculator">
      <div className="detail-label">Odds calculator</div>
      <p className="meta">Enter how many encounters you want to estimate. No game data is imported or saved.</p>
      <div className="odds-fields">
        <label>Encounters
          <input type="number" inputMode="numeric" min="0" max="1000000" step="1" value={attempts} onChange={(e) => setAttempts(e.target.value)} />
        </label>
        <label>Shiny rate · 1 in
          <input type="number" inputMode="numeric" min="2" max="1000000000" step="1" placeholder="Enter a rate" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
      </div>
      <div className="odds-presets" aria-label="Example shiny rates">
        {COMMON_RATES.map(({ label, value }) => (
          <button type="button" key={label} aria-pressed={rate === String(value)} onClick={() => setRate(String(value))}>{label} · 1/{value}</button>
        ))}
      </div>
      {chance === null ? (
        <p className="meta" role="status">Enter 0–1,000,000 encounters and a rate of at least 1 in 2.</p>
      ) : (
        <div className="odds-result" role="status">
          <strong>{percent}%</strong>
          <span>estimated chance of at least one shiny in {count.toLocaleString()} {count === 1 ? 'encounter' : 'encounters'}</span>
        </div>
      )}
      <p className="meta odds-caveat">Assumes each encounter is independent and has the same 1/{validRate ? denominator : '?'} chance. Rates shown here are community estimates, not guaranteed Pokémon GO rates. A {percent || '0'}% chance does not guarantee a shiny.</p>
    </section>
  );
}
