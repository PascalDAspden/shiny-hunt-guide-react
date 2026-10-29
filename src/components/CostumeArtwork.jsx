import { useState } from 'react';
import { costumeArtwork } from '../data/costumes.js';

/** A missing costume sprite stays missing; it must never become ordinary art. */
export default function CostumeArtwork({ variant, costume, shiny = false, size }) {
  const [failed, setFailed] = useState('');
  const url = costumeArtwork(variant, shiny);
  const available = !shiny || variant.shinyAvailable;
  const name = `${shiny ? 'Shiny ' : ''}${variant.name} — ${costume.label}`;
  return (
    <div className={`costume-art${shiny ? ' costume-art-shiny' : ''}`} style={size ? { width: size, height: size } : undefined}>
      {available && failed !== url ? <img src={url} alt={name} loading="lazy" onError={() => setFailed(url)} /> : (
        <span className="costume-art-missing" role="img" aria-label={`${name}: artwork unavailable`}>{available ? 'Artwork unavailable' : 'Shiny not released'}</span>
      )}
    </div>
  );
}
