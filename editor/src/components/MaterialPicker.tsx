import { useMemo, useState } from 'react';
import { displayMaterial, MATERIALS, normalizeMaterial } from '../format/model';
import { searchMaterials, type MaterialEntry } from '../assets/search';
import type { ResourcePack } from '../assets/resourcePack';
import { useItemIcon } from './SlotIcon';

interface MaterialPickerProps {
  value: string;
  pack: ResourcePack | null;
  onChange: (material: string) => void;
}

/** Ids of everything the picker can offer: the pack's items and blocks, plus the built-in shortlist. */
function entriesFor(pack: ResourcePack | null): MaterialEntry[] {
  const ids = new Set<string>(MATERIALS.map(displayMaterial));
  if (pack) {
    pack.itemIds.forEach((id) => ids.add(id));
    pack.blockIds.forEach((id) => ids.add(id));
  }
  return [...ids].map((id) => {
    const name = pack?.names.get(id);
    const aliases = [id.replace(/_/g, ' ')];
    if (name?.de) aliases.push(name.de);
    if (name?.en) aliases.push(name.en);
    return { id, label: pack ? pack.nameOf(id) : id, aliases };
  });
}

function MaterialIcon({ pack, id }: { pack: ResourcePack | null; id: string }) {
  const url = useItemIcon(pack, id);
  return url ? <img className="material-icon" src={url} alt="" width={24} height={24} /> : <span className="material-icon empty" aria-hidden="true" />;
}

/** Material input with a searchable list. Typing works as before; the list shows icons and names when a pack is loaded. */
export function MaterialPicker({ value, pack, onChange }: MaterialPickerProps) {
  const [focused, setFocused] = useState(false);
  const entries = useMemo(() => entriesFor(pack), [pack]);
  const hits = useMemo(() => searchMaterials(entries, displayMaterial(value)), [entries, value]);

  return (
    <label className="material-picker">
      Material
      <input
        value={displayMaterial(value)}
        placeholder="z. B. diamond oder Diamant"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(normalizeMaterial(e.target.value))}
      />
      {focused && hits.length > 0 && (
        <ul className="material-hits" role="listbox">
          {hits.map((entry) => (
            <li key={entry.id}>
              {/* onMouseDown fires before the input blurs, so the pick lands. */}
              <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(`minecraft:${entry.id}`); setFocused(false); }}>
                <MaterialIcon pack={pack} id={entry.id} />
                <span className="material-name">{entry.label}</span>
                {entry.label !== entry.id && <small className="muted">{entry.id}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <small className="muted">
        {pack ? `Suche nach Name oder ID, Deutsch oder Englisch. Paket: ${pack.name}` : 'Tippen zum Suchen. Mit einem Resource Pack gibt es Icons und deutsche Namen.'}
      </small>
    </label>
  );
}
