export default function ShinyToggle({ value, onChange, label = 'Artwork' }) {
  return (
    <div className="shiny-toggle" role="group" aria-label={label}>
      <button
        type="button"
        className={`shiny-toggle-btn${value === 'normal' ? ' active' : ''}`}
        aria-pressed={value === 'normal'}
        onClick={() => onChange('normal')}
      >
        Normal
      </button>
      <button
        type="button"
        className={`shiny-toggle-btn${value === 'shiny' ? ' active' : ''}`}
        aria-pressed={value === 'shiny'}
        onClick={() => onChange('shiny')}
      >
        Shiny ✦
      </button>
    </div>
  );
}
