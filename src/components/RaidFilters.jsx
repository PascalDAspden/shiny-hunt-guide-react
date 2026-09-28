const SCOPES = [
  { value: 'current', label: 'Current' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'both', label: 'Both' }
];

const TYPES = [
  { value: 'all', label: 'All types' },
  { value: 'legendary', label: 'Legendary' },
  { value: 'shadow', label: 'Shadow' },
  { value: 'mega', label: 'Mega' },
  { value: 'three', label: '3-Star' },
  { value: 'one', label: '1-Star' }
];

export default function RaidFilters({ scope, onScopeChange, raidType, onRaidTypeChange, sortKey, onSortChange, shinyOnly, onShinyOnlyChange }) {
  return (
    <div className="raid-controls">
      <div className="raid-scope-row" role="group" aria-label="Raid scope">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`pill raid-scope${scope === s.value ? ' active' : ''}`}
            aria-pressed={scope === s.value}
            onClick={() => onScopeChange(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="raid-select-row">
        <select value={raidType} onChange={(e) => onRaidTypeChange(e.target.value)} aria-label="Raid type">
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => onSortChange(e.target.value)} aria-label="Sort raids by">
          <option value="tier">Sort: Tier</option>
          <option value="name">Sort: Name</option>
          <option value="odds">Sort: Best odds</option>
          <option value="soonest">Sort: Soonest</option>
        </select>
        <label className="shiny-only-toggle">
          <input type="checkbox" checked={shinyOnly} onChange={(e) => onShinyOnlyChange(e.target.checked)} />
          Shiny-capable only
        </label>
      </div>
    </div>
  );
}
