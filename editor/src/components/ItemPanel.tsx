import { RichField } from './RichField';
import { MaterialPicker } from './MaterialPicker';
import type { ResourcePack } from '../assets/resourcePack';
import {
  derivedKey, isAutoKey, skinHashOf, skinUrl, type EditorGui, type EditorItem, type Pattern,
} from '../format/model';

interface ItemPanelProps {
  item: EditorItem;
  gui: EditorGui;
  /** Ids of the other GUIs in the project, offered as open:<id> actions. */
  otherGuiIds: string[];
  pack: ResourcePack | null;
  onChange: (patch: Partial<EditorItem>) => void;
  onDelete: () => void;
}

/** Page actions only mean something in a paginated GUI; open:<id> points at one of the other GUIs. */
function actionsFor(gui: EditorGui, otherGuiIds: string[]): string[] {
  const base = gui.paginated ? ['', 'close', 'next-page', 'prev-page'] : ['', 'close'];
  return [...base, ...otherGuiIds.map((id) => `open:${id}`)];
}

export function ItemPanel({ item, gui, otherGuiIds, pack, onChange, onDelete }: ItemPanelProps) {
  const slotMode = item.pattern ?? 'manual';
  const setSlotMode = (value: string) => {
    if (value === 'manual') onChange({ pattern: null });
    else onChange({ pattern: value as Pattern, slots: [] });
  };
  // While the key is still automatic, it follows the name; a key typed by hand stays as it is.
  const changeName = (name: string) => {
    const patch: Partial<EditorItem> = { name };
    if (isAutoKey(item.key, item.name)) {
      const key = derivedKey(name, gui.items, item.id);
      if (key) patch.key = key;
    }
    onChange(patch);
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

      <MaterialPicker value={item.material} pack={pack} onChange={(material) => onChange({ material })} />

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

      <RichField label="Name" value={item.name} onChange={changeName} />

      <RichField
        label="Lore (eine Zeile pro Eintrag)"
        multiline
        value={item.lore.join('\n')}
        onChange={(text) => onChange({ lore: text.split('\n') })}
      />

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
          placeholder={gui.paginated ? 'close, next-page, prev-page, open:<id>' : 'close, open:<id>'}
          onChange={(e) => onChange({ action: e.target.value.trim() })}
        />
        <datalist id="actions">
          {actionsFor(gui, otherGuiIds).map((a) => <option key={a} value={a} />)}
        </datalist>
      </label>

      <div className="checks">
        <label><input type="checkbox" checked={item.locked} onChange={(e) => onChange({ locked: e.target.checked })} /> Gesperrt (Spieler kann nichts entnehmen)</label>
        <label><input type="checkbox" checked={item.hideTooltip} onChange={(e) => onChange({ hideTooltip: e.target.checked })} /> Tooltip ausblenden</label>
        <label><input type="checkbox" checked={item.hideAttributes} onChange={(e) => onChange({ hideAttributes: e.target.checked })} /> Attribute ausblenden</label>
      </div>

      <button type="button" className="btn danger" onClick={onDelete}>Item löschen</button>
    </div>
  );
}
