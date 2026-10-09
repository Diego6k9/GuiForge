import { MATERIALS, type EditorGui, type EditorItem, type Pattern } from '../format/model';

interface ItemPanelProps {
  item: EditorItem;
  gui: EditorGui;
  onChange: (patch: Partial<EditorItem>) => void;
  onDelete: () => void;
}

const ACTIONS = ['', 'close', 'next-page', 'prev-page', 'open:'];

export function ItemPanel({ item, gui, onChange, onDelete }: ItemPanelProps) {
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
        Key
        <input value={item.key} onChange={(e) => onChange({ key: e.target.value.trim() })} />
        {keyTaken && <small className="error-text">Key wird doppelt verwendet.</small>}
      </label>

      <label>
        Material
        <input
          list="materials"
          value={item.material}
          onChange={(e) => onChange({ material: e.target.value.trim() })}
        />
        <datalist id="materials">
          {MATERIALS.map((m) => <option key={m} value={m} />)}
        </datalist>
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

      <label>
        Slots
        <select value={slotMode} onChange={(e) => setSlotMode(e.target.value)}>
          <option value="manual">Manuell (Raster anklicken)</option>
          <option value="border">Rahmen (border)</option>
          <option value="empty">Hintergrund (empty)</option>
        </select>
        {item.pattern && <small className="muted">Muster belegen nur freie Slots. Feste Slots haben Vorrang.</small>}
      </label>

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
