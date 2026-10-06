import { useEffect, useState } from 'react';
import bundledCodes from '../data/promo-codes.json';
import { fetchPromoCodes, initialCodes, isAvailable, readRedeemed, REDEEMED_CODES_KEY, saveLocal } from '../utils/promoCodes.js';

export default function PromoCodes() {
  const [codes, setCodes] = useState(() => initialCodes(bundledCodes));
  const [redeemed, setRedeemed] = useState(readRedeemed);
  const [filter, setFilter] = useState('available');
  const [feedback, setFeedback] = useState('');
  const [savedCopy, setSavedCopy] = useState(false);
  const [clock, setClock] = useState(Date.now);

  useEffect(() => {
    let cancelled = false;
    fetchPromoCodes().then((data) => { if (!cancelled) setCodes(data); })
      .catch(() => { if (!cancelled) setSavedCopy(true); });
    const timer = setInterval(() => setClock(Date.now()), 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); setFeedback(`Copied! ${code}`); }
    catch { setFeedback('Copy unavailable. Select and copy the code manually.'); }
  }

  function toggleRedeemed(id) {
    const next = new Set(redeemed);
    if (next.has(id)) next.delete(id); else next.add(id);
    setRedeemed(next);
    setFeedback(saveLocal(REDEEMED_CODES_KEY, [...next]) ? '' : 'Storage unavailable; this change is saved for this session only.');
  }

  const visible = codes.filter((promo) => filter === 'redeemed' ? redeemed.has(promo.id) : isAvailable(promo, clock) && !redeemed.has(promo.id));
  return (
    <section className="page promo-page">
      <div className="intro"><h2>Promo Codes</h2><p>Pokémon GO rewards, ready to redeem.</p></div>
      <div className="event-filter-row" role="group" aria-label="Promo code status">
        {['available', 'redeemed'].map((value) => <button key={value} type="button" className={`pill${filter === value ? ' active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'available' ? 'Available' : 'Redeemed'}</button>)}
      </div>
      <p className="meta promo-feedback" role="status" aria-live="polite">{feedback}</p>
      {savedCopy && <p className="meta">Showing saved promo information. The latest update is temporarily unavailable.</p>}
      {visible.length ? <div className="card-grid promo-grid">{visible.map((promo) => {
        const available = isAvailable(promo, clock);
        return <article key={promo.id} className="card promo-card">
          <h3>{promo.title || promo.code}</h3>
          {promo.rewards.length ? <><p className="meta">Rewards:</p><ul className="promo-rewards">{promo.rewards.map((reward) => <li key={reward}>{reward}</li>)}</ul></> : <p className="meta">Reward details not listed.</p>}
          <code className="promo-code">{promo.code}</code>
          <div className="event-actions">
            <button type="button" className="track-button" onClick={() => copyCode(promo.code)}>Copy Code</button>
            {available && <a className="calendar-button promo-redeem" href={promo.redeemUrl} target="_blank" rel="noopener noreferrer">Redeem</a>}
            <button type="button" className="link-button" onClick={() => toggleRedeemed(promo.id)}>{redeemed.has(promo.id) ? 'Mark as Available' : 'Mark as Redeemed'}</button>
          </div>
          <p className="meta">{!available ? 'Expired or no longer listed as available' : promo.expires ? `Expires: ${new Date(promo.expires).toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })} (your local time)` : 'Expires: Not listed'}</p>
        </article>;
      })}</div> : <div className="empty">{filter === 'redeemed' ? 'No codes marked as redeemed yet.' : codes.some((promo) => isAvailable(promo, clock)) ? 'All available codes are marked as redeemed.' : 'No active Pokémon GO promo codes found right now.'}</div>}
      <p className="meta promo-attribution">Promo code information sourced from <a href="https://leekduck.com/promo-codes/" target="_blank" rel="noopener noreferrer">Leek Duck</a>.<br />Redemption is handled by the official Pokémon GO Web Store.</p>
    </section>
  );
}
