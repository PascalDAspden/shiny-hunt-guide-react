import CostumeArtwork from './CostumeArtwork.jsx';
import { costumeEvolutionLabel } from '../data/costumes.js';

export default function CostumeEvolution({ costume }) {
  return (
    <section className="costume-evolution" aria-label={`${costume.variants[0].name} costume evolution`}>
      <div className="costume-evolution-heading"><h4>Costume evolution &amp; shiny comparison</h4><span className={`badge ${costume.evolutionStatus === 'locked' ? 'locked' : ''}`}>{costumeEvolutionLabel(costume)}</span></div>
      <p className="meta">{costume.note}</p>
      <div className="costume-chain">
        {costume.variants.map((member, index) => (
          <article className="costume-stage" key={member.id}>
            <span className="stage-label">{index === 0 ? 'Encounter form' : 'Evolution only'}</span>
            <div className="costume-pair">
              <figure><CostumeArtwork variant={member} costume={costume} /><figcaption>Normal</figcaption></figure>
              <figure><CostumeArtwork variant={member} costume={costume} shiny /><figcaption>Shiny ✦</figcaption></figure>
            </div>
            <strong>{member.name}</strong>
            <small>{costume.label}</small>
            {index > 0 && <span className="costume-candy">{member.candy} {costume.variants[0].name} Candy<br /><small>from {costume.variants[index - 1].name}</small></span>}
          </article>
        ))}
      </div>
      <div className="costume-sources">{costume.sources.map((source, index) => <a key={source} href={source} target="_blank" rel="noopener noreferrer">{index === 0 ? 'Evolution / release source' : 'Supporting source'} ↗</a>)}</div>
    </section>
  );
}
