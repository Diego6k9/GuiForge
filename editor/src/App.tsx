import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  emptyGui, fromFormat, newItem, resolveSlots, toFormat, validate,
  type EditorGui, type EditorItem,
} from './format/model';
import { Grid, type CellView } from './components/Grid';
import { ItemPanel } from './components/ItemPanel';
import { GuiPanel } from './components/GuiPanel';
import { Preview } from './components/Preview';

const STORAGE_KEY = 'guiforge-editor-v1';

function loadInitial(): EditorGui {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return fromFormat(JSON.parse(raw));
  } catch {
    // Broken or unavailable storage: start with an empty GUI.
  }
  return emptyGui();
}

function colorFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 38%)`;
}

function shortMaterial(material: string): string {
  return material
    .replace('minecraft:', '')
    .split('_')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

export default function App() {
  const [gui, setGui] = useState<EditorGui>(loadInitial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'select' | 'content'>('select');
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toFormat(gui)));
    } catch {
      // Storage unavailable: the editor keeps working, just without autosave.
    }
  }, [gui]);

  const resolved = useMemo(() => resolveSlots(gui), [gui]);
  const errors = useMemo(() => validate(gui), [gui]);
  const itemById = useMemo(() => new Map(gui.items.map((i) => [i.id, i])), [gui.items]);
  const occupant = useMemo(() => {
    const map = new Map<number, string>();
    for (const [id, slots] of resolved) slots.forEach((s) => map.set(s, id));
    return map;
  }, [resolved]);
  const selected = selectedId ? itemById.get(selectedId) ?? null : null;
  const contentSet = new Set(gui.paginated ? gui.contentSlots : []);
  const size = gui.rows * 9;

  const cells: CellView[] = Array.from({ length: size }, (_, slot) => {
    const ownerId = occupant.get(slot);
    const owner: EditorItem | undefined = ownerId ? itemById.get(ownerId) : undefined;
    return {
      slot,
      label: owner ? shortMaterial(owner.material) : '',
      color: owner ? colorFor(owner.key) : undefined,
      title: owner ? `${owner.key} (Slot ${slot})` : `Slot ${slot}`,
      selected: !!owner && owner.id === selectedId,
      content: contentSet.has(slot),
      pattern: !!owner?.pattern,
    };
  });

  function commit(next: EditorGui) {
    setGui(next);
  }

  function patchGui(patch: Partial<EditorGui>) {
    const next = { ...gui, ...patch };
    if (patch.rows !== undefined && patch.rows !== gui.rows) {
      // Shrinking the grid drops slots that no longer exist.
      const size = next.rows * 9;
      next.items = next.items.map((i) => ({ ...i, slots: i.slots.filter((s) => s < size) }));
      next.contentSlots = next.contentSlots.filter((s) => s < size);
    }
    commit(next);
  }

  function patchItem(id: string, patch: Partial<EditorItem>) {
    const old = gui.items.find((i) => i.id === id);
    let next: EditorGui = {
      ...gui,
      items: gui.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    };
    // Keep references in sync when a key is renamed.
    if (old && patch.key !== undefined && patch.key !== old.key) {
      next = {
        ...next,
        filler: next.filler === old.key ? patch.key : next.filler,
        navPrev: next.navPrev === old.key ? patch.key : next.navPrev,
        navNext: next.navNext === old.key ? patch.key : next.navNext,
      };
    }
    commit(next);
  }

  function addItem() {
    const item = newItem(gui);
    commit({ ...gui, items: [...gui.items, item] });
    setSelectedId(item.id);
    setMode('select');
  }

  function removeItem(id: string) {
    const item = gui.items.find((i) => i.id === id);
    if (!item) return;
    commit({
      ...gui,
      items: gui.items.filter((i) => i.id !== id),
      filler: gui.filler === item.key ? '' : gui.filler,
      navPrev: gui.navPrev === item.key ? '' : gui.navPrev,
      navNext: gui.navNext === item.key ? '' : gui.navNext,
    });
    setSelectedId(null);
  }

  function onCell(slot: number) {
    if (mode === 'content') {
      if (!gui.paginated) return;
      const inContent = gui.contentSlots.includes(slot);
      commit({
        ...gui,
        // A slot is either a fixed item or content, never both.
        items: gui.items.map((i) => ({ ...i, slots: i.slots.filter((s) => s !== slot) })),
        contentSlots: inContent
          ? gui.contentSlots.filter((s) => s !== slot)
          : [...gui.contentSlots, slot].sort((a, b) => a - b),
      });
      return;
    }
    if (selected && !selected.pattern) {
      const isMine = selected.slots.includes(slot);
      commit({
        ...gui,
        items: gui.items.map((i) => {
          const without = i.slots.filter((s) => s !== slot);
          if (i.id !== selected.id) return { ...i, slots: without };
          return { ...i, slots: isMine ? without : [...without, slot].sort((a, b) => a - b) };
        }),
        contentSlots: gui.contentSlots.filter((s) => s !== slot),
      });
      return;
    }
    const ownerId = occupant.get(slot);
    if (ownerId) setSelectedId(ownerId);
  }

  function exportFile() {
    if (errors.length) return;
    const blob = new Blob([JSON.stringify(toFormat(gui), null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${gui.id || 'gui'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const json = JSON.parse(await file.text());
      commit(fromFormat(json));
      setSelectedId(null);
      setImportError(null);
    } catch (err) {
      setImportError(`Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function reset() {
    if (!window.confirm('Die aktuelle GUI verwerfen und neu beginnen?')) return;
    commit(emptyGui());
    setSelectedId(null);
  }

  return (
    <div className="app">
      <header className="topbar">
        <strong>GuiForge Editor</strong>
        <span className="muted">{gui.id} · {gui.rows} Zeilen{gui.paginated ? ' · paginiert' : ''}</span>
        <div className="spacer" />
        <label className="btn">
          Importieren
          <input type="file" accept=".json,application/json" hidden onChange={importFile} />
        </label>
        <button type="button" className="btn primary" disabled={errors.length > 0} onClick={exportFile}>
          Exportieren (.json)
        </button>
        <button type="button" className="btn" onClick={reset}>Neu</button>
      </header>

      {importError && <div className="banner error">{importError}</div>}

      <main className="workspace">
        <aside className="panel">
          <button type="button" className={selected ? 'btn' : 'btn on-panel'} onClick={() => setSelectedId(null)}>
            GUI-Einstellungen
          </button>
          <h3>Items</h3>
          <button type="button" className="btn" onClick={addItem}>+ Item</button>
          <ul className="itemlist">
            {gui.items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  className={i.id === selectedId ? 'item on' : 'item'}
                  onClick={() => { setSelectedId(i.id); setMode('select'); }}
                >
                  <span className="swatch" style={{ background: colorFor(i.key) }} />
                  <span className="item-key">{i.key || '(ohne Key)'}</span>
                  <small>{i.pattern ?? `${i.slots.length} Slot${i.slots.length === 1 ? '' : 's'}`}</small>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="center">
          <div className="toolbar">
            <div className="seg">
              <button type="button" className={mode === 'select' ? 'on' : ''} onClick={() => setMode('select')}>
                Slots zuweisen
              </button>
              <button
                type="button"
                className={mode === 'content' ? 'on' : ''}
                disabled={!gui.paginated}
                onClick={() => setMode('content')}
                title={gui.paginated ? '' : 'Erst unter GUI-Einstellungen „Paginiert“ aktivieren'}
              >
                Content-Bereich malen
              </button>
            </div>
            <span className="muted hint">
              {mode === 'content'
                ? 'Klick markiert bzw. entfernt Content-Slots.'
                : selected && !selected.pattern
                  ? `Klicks fügen Slots zu „${selected.key}“ hinzu oder entfernen sie.`
                  : 'Item auswählen, dann Slots im Raster anklicken.'}
            </span>
          </div>

          <Grid cells={cells} onCell={onCell} />
          <Preview gui={gui} resolved={resolved} />
        </section>

        <aside className="panel">
          {selected
            ? (
              <ItemPanel
                item={selected}
                gui={gui}
                onChange={(patch) => patchItem(selected.id, patch)}
                onDelete={() => removeItem(selected.id)}
              />
            )
            : <GuiPanel gui={gui} onChange={patchGui} />}
        </aside>
      </main>

      <footer className="validation">
        {errors.length === 0
          ? <span className="ok">✓ Export-bereit (Format v1)</span>
          : (
            <ul className="errors">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          )}
      </footer>
    </div>
  );
}
