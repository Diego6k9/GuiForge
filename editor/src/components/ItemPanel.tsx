import { useState } from 'react';
import {
  displayMaterial, MATERIALS, normalizeMaterial, skinHashOf, skinUrl, type EditorGui, type EditorItem, type Pattern,
} from '../format/model';

interface ItemPanelProps {
  item: EditorItem;
  gui: EditorGui;
  onChange: (patch: Partial<EditorItem>) => void;
  onDelete: () => void;
}

const ACTIONS = ['', 'close', 'next-page', 'prev-page', 'open:'];

export function ItemPanel({ item, gui, onChange, onDelete }: ItemPanelProps) {
  const [materialFocus, setMaterialFocus] = useState(false);
  const materialQuery = displayMaterial(item.material).toLowerCase();
  const materialHits = MATERIALS.filter((m) => displayMaterial(m).includes(materialQuery)).slice(0, 8);
  const slotMode = item.pattern ?? 'manual';
  const setSlotMode = (value: string) => {
    if (value === 'manual') onChange({ pattern: null });
    else onChange({ pattern: value as Pattern, slots: [] });
  };
  const keyTaken = gui.items.some((other) => other.id !== item.id && other.key === item.key);

  return (
    <div className="form">
      <h3>Item „{item.key}“</h3>

      <label>
        Rolle
        <select value={slotMode} onChange={(e) => setSlotMode(e.target.value)}>
          <option value="manual">Item – Slots im Raster markieren</option>
          <option value="empty">Rahmen – füllt automatisch alle freien Slots</option>
          <option value="border">Außenrahmen – nur der äußere Ring</option>
        </select>
        {item.pattern ? (
          <small className="muted">
            Rahmen-Items brauchen keine Klicks: Sie belegen automatisch alle freien Slots. Feste Item-Slots haben Vorrang.
          </small>
        ) : (
          <small className="muted">Im Raster markierte Slots gehören diesem Item.</small>
        )}
      </label>

      <label>
        Key
        <input value={item.key} onChange={(e) => onChange({ key: e.target.value.trim() })} />
        {keyTaken && <small className="error-text">Key wird doppelt verwendet.</small>}
      </label>

      <label className="material-picker">
        Material
        <input
          value={displayMaterial(item.material)}
          placeholder="z. B. diamond"
          onFocus={() => setMaterialFocus(true)}
          onBlur={() => setMaterialFocus(false)}
          onChange={(e) => onChange({ material: normalizeMaterial(e.target.value) })}
        />
        {materialFocus && materialHits.length > 0 && (
          <ul className="material-hits" role="listbox">
            {materialHits.map((m) => (
              <li key={m}>
                {/* onMouseDown fires before the input blurs, so the pick lands. */}
                <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange({ material: m }); setMaterialFocus(false); }}>
                  {displayMaterial(m)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <small className="muted">Tippen zum Suchen, „minecraft:“ wird automatisch ergänzt.</small>
      </label>

      <div className="row">
        <label>
          Anzahl
          <input
            type="number"
            min={1}
            max={64}
            value={item.amount}
            onChange={(e) => onChange({ amount: Math.min(64, Math.max(1, Number(e.target.value) || 1)) })}
          />
        </label>
        <label>
          Glint
          <select
            value={item.glint === null ? 'unset' : item.glint ? 'on' : 'off'}
            onChange={(e) => onChange({ glint: e.target.value === 'unset' ? null : e.target.value === 'on' })}
          >
            <option value="unset">Standard</option>
            <option value="on">An</option>
            <option value="off">Aus</option>
          </select>
        </label>
      </div>

      <label>
        Name (MiniMessage)
        <input value={item.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>

      <label>
        Lore (eine Zeile pro Eintrag)
        <textarea
          rows={4}
          value={item.lore.join('\n')}
          onChange={(e) => onChange({ lore: e.target.value.split('\n') })}
        />
      </label>

      {item.material.trim() === 'minecraft:player_head' || item.skin ? (
        <label>
          Kopf-Textur (URL oder Hash)
          <input
            value={item.skin}
            placeholder="http://textures.minecraft.net/texture/…"
            onChange={(e) => onChange({ skin: e.target.value.trim() })}
          />
          {item.skin && skinHashOf(item.skin) && (
            <img className="skin-preview" alt="Kopf-Vorschau" src={skinUrl(skinHashOf(item.skin) ?? '')} width={64} height={64} />
          )}
          <small className="muted">Die Textur wird vom Spieler-Client geladen, der Server speichert nur die URL.</small>
        </label>
      ) : null}

      <label>
        Aktion
        <input
          list="actions"
          value={item.action}
          placeholder="close, next-page, prev-page, open:<id>"
          onChange={(e) => onChange({ action: e.target.value.trim() })}
        />
        <datalist id="actions">
          {ACTIONS.map((a) => <option key={a} value={a} />)}
        </datalist>
      </label>

      <div className="checks">
        <label><input type="checkbox" checked={item.locked} onChange={(e) => onChange({ locked: e.target.checked })} /> Gesperrt (Spieler kann nichts entnehmen)</label>
        <label><input type="checkbox" checked={item.hideTooltip} onChange={(e) => onChange({ hideTooltip: e.target.checked })} /> Tooltip ausblenden</label>
      </div>

      <button type="button" className="btn danger" onClick={onDelete}>Item löschen</button>
    </div>
  );
}
