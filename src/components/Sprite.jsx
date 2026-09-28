import { useEffect, useState } from 'react';
import { safeUrl, normalizedSpriteUrl, shinySource } from '../utils/pokemonForms.js';

/**
 * Renders a Pokémon's artwork.
 *
 * - shiny=true keeps the Pokémon shiny (used by your existing shiny toggle).
 * - Matches the working guide's normal/shiny artwork behaviour.
 * - Falls back from shiny to normal and from the crop URL to the feed URL.
 * - Falls back to ✦ if normal art also fails.
 */
export default function Sprite({
  src,
  name,
  shiny = false,
  shinyFormArt = {},
  size,
}) {
  const normalized = normalizedSpriteUrl(src);
  const normalUrl = safeUrl(normalized);
  const originalUrl = safeUrl(src);
  const shinyUrl = shiny ? safeUrl(shinySource(name, normalized, shinyFormArt)) : '';
  const candidates = [...new Set([shinyUrl, normalUrl, originalUrl].filter(Boolean))];
  const [failedUrl, setFailedUrl] = useState('');

  useEffect(() => setFailedUrl(''), [src, name, shiny, shinyUrl]);

  const failedIndex = candidates.indexOf(failedUrl);
  const url = candidates[failedIndex < 0 ? 0 : failedIndex + 1] || '';
  const shadow = /^shadow\s/i.test(String(name || ''));

  return (
    <div
      className={`sprite-box${shadow ? ' shadow-aura' : ''}`}
      style={size ? { width: size, height: size } : undefined}
    >
      {url ? (
        <img
          className={url === shinyUrl && shiny ? 'shiny-art' : ''}
          src={url}
          alt={url === shinyUrl && shiny ? `Shiny ${name}` : name}
          loading="lazy"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <span className="fallback">✦</span>
      )}
    </div>
  );
}
