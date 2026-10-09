import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  emptyGui, emptyProject, fromFormat, linkProblems, linkTarget, newId, newItem, problems, projectFromStorage,
  projectToStorage, renameGuiEverywhere, resolveSlots, roleOf, TEMPLATES, uniqueGuiId, ROLE_COLORS,
  type EditorGui, type EditorItem, type Project,
} from './format/model';
import { historyReducer, type History } from './history';
import {
  canPickFolder, canUseFileDialogs, downloadFiles, exportFiles, pickJsonText, projectProblemCount, saveFile, saveToFolder,
} from './exportFiles';
import { Grid, type CellView } from './components/Grid';
import { ItemPanel } from './components/ItemPanel';
import { GuiPanel } from './components/GuiPanel';
import { Preview } from './components/Preview';
import { LinkView } from './components/LinkView';

const STORAGE_KEY = 'guiforge-project-v2';
const LEGACY_KEY = 'guiforge-editor-v1';

function loadInitial(): Project {
  for (const key of [STORAGE_KEY, LEGACY_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return projectFromStorage(JSON.parse(raw));
    } catch {
      // Broken or unavailable storage: try the next source, then start empty.
    }
  }
  return emptyProject();
}

function plainText(miniMessage: string): string {
  return miniMessage.replace(/<[^>]*>/g, '').trim();
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

/** All slots in the rectangle spanned by two grid indices. */
function rectSlots(a: number, b: number): number[] {
  const r1 = Math.min(Math.floor(a / 9), Math.floor(b / 9));
  const r2 = Math.max(Math.floor(a / 9), Math.floor(b / 9));
  const c1 = Math.min(a % 9, b % 9);
  const c2 = Math.max(a % 9, b % 9);
  const out: number[] = [];
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) out.push(r * 9 + c);
  return out;
}

const TITLE_LIMIT = 32;

type Tool = 'assign' | 'content';
type Inspector = 'gui' | 'item';

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, (): History => ({
    past: [], present: loadInitial(), future: [],
  }));
  const project = history.present;
  const [activeIndex, setActiveIndex] = useState(0);
  const [view, setView] = useState<'edit' | 'links'>('edit');
  const index = Math.min(activeIndex, project.guis.length - 1);
  const gui = project.guis[index];
  const [menu, setMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspector, setInspector] = useState<Inspector>('gui');
  const [tool, setTool] = useState<Tool>('assign');
  const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [tabDrag, setTabDrag] = useState<{ from: number; over: number | null } | null>(null);

  // Status messages disappear on their own; errors that need action stay until the next change.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const [saveState, setSaveState] = useState<{ ok: boolean; at: Date | null }>({ ok: true, at: null });

  const selected = selectedId ? gui.items.find((i) => i.id === selectedId) ?? null : null;
  const resolved = useMemo(() => resolveSlots(gui), [gui]);
  const found = useMemo(() => [...problems(gui), ...linkProblems(project, gui)], [gui, project]);
  const errorCount = found.length;
  const projectErrors = useMemo(() => projectProblemCount(project), [project]);
  const errorItemIds = useMemo(() => new Set(found.flatMap((p) => (p.itemId ? [p.itemId] : []))), [found]);
  const itemById = useMemo(() => new Map(gui.items.map((i) => [i.id, i])), [gui.items]);
  const occupant = useMemo(() => {
    const map = new Map<number, string>();
    for (const [id, slots] of resolved) slots.forEach((s) => map.set(s, id));
    return map;
  }, [resolved]);
  const contentSet = new Set(gui.paginated ? gui.contentSlots : []);
  const size = gui.rows * 9;
  const dragSlots = drag ? new Set(rectSlots(drag.start, drag.current)) : new Set<number>();

  // Autosave the present state; storage failures never block editing.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projectToStorage(project)));
      setSaveState({ ok: true, at: new Date() });
    } catch {
      // Storage unavailable: editing still works, just without autosave.
      setSaveState({ ok: false, at: null });
    }
  }, [project]);

  function commit(next: EditorGui, coalesceKey?: string) {
    const guis = project.guis.map((g, i) => (i === index ? next : g));
    dispatch({ type: 'set', next: { guis }, coalesceKey, at: Date.now() });
  }

  function commitProject(next: Project) {
    dispatch({ type: 'set', next, at: Date.now() });
  }

  function select(id: string | null) {
    setSelectedId(id);
    setInspector(id ? 'item' : 'gui');
  }

  // Keyboard shortcuts, unless the user is typing in a field (then the browser handles it).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
          e.preventDefault();
          removeItem(selectedId);
        } else if (e.key === 'Escape') {
          if (menu) setMenu(null);
          else if (selectedId) select(null);
        }
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key.toLowerCase() === 'd' && selectedId) {
        e.preventDefault();
        duplicateItem(selectedId);
        return;
      }
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'undo' });
      } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, gui, project, index, menu]);

  function patchGui(patch: Partial<EditorGui>) {
    const next = { ...gui, ...patch };
    if (patch.rows !== undefined && patch.rows !== gui.rows) {
      const limit = next.rows * 9;
      next.items = next.items.map((i) => ({ ...i, slots: i.slots.filter((s) => s < limit) }));
      next.contentSlots = next.contentSlots.filter((s) => s < limit);
    }
    if (patch.id !== undefined && patch.id !== gui.id) {
      // Renaming a GUI also rewrites every link that points at it.
      const guis = project.guis.map((g, i) => (i === index ? next : g));
      commitProject({ guis: renameGuiEverywhere(guis, index, patch.id, gui.id) });
      return;
    }
    commit(next, `gui:${Object.keys(patch).join(',')}`);
  }

  // --- GUIs in the project -------------------------------------------------------------

  /** Moves a GUI tab to another position. The GUI that is open stays open. */
  function moveGui(from: number, to: number) {
    if (from === to) return;
    const current = project.guis[index];
    const guis = [...project.guis];
    const [moved] = guis.splice(from, 1);
    guis.splice(to, 0, moved);
    commitProject({ guis });
    setActiveIndex(guis.indexOf(current));
  }

  function switchGui(i: number) {
    setActiveIndex(i);
    select(null);
    setMenu(null);
  }

  function addGui() {
    const id = uniqueGuiId(project.guis, 'gui');
    commitProject({ guis: [...project.guis, { ...emptyGui(), id, title: id }] });
    switchGui(project.guis.length);
  }

  function deleteGui(i: number) {
    if (project.guis.length <= 1) return;
    const removed = project.guis[i];
    if (!window.confirm(`GUI „${removed.id}“ löschen? Verknüpfungen zu ihr werden entfernt. (Rückgängig über Strg+Z.)`)) return;
    const guis = project.guis
      .filter((_, k) => k !== i)
      .map((g) => ({
        ...g,
        items: g.items.map((item) => (linkTarget(item.action) === removed.id ? { ...item, action: '' } : item)),
      }));
    commitProject({ guis });
    switchGui(Math.max(0, i - 1));
  }

  // --- Links between items and GUIs ---------------------------------------------------

  /** A link replaces a plain action such as next-page; ask first so nothing is lost silently. */
  function mayReplaceAction(item: EditorItem): boolean {
    if (!item.action.trim() || linkTarget(item.action) !== null) return true;
    return window.confirm(`Die Aktion „${item.action}“ wird durch die Verknüpfung ersetzt. Fortfahren?`);
  }

  function setItemAction(itemId: string, action: string) {
    commit({ ...gui, items: gui.items.map((i) => (i.id === itemId ? { ...i, action } : i)) });
    setMenu(null);
  }

  /** Creates a new GUI, links the item to it, and switches to the new GUI. */
  function linkToNewGui(itemId: string) {
    const item = gui.items.find((i) => i.id === itemId);
    if (!item || !mayReplaceAction(item)) return;
    const id = uniqueGuiId(project.guis, item.key || 'gui');
    const target: EditorGui = { ...emptyGui(), id, title: plainText(item.name) || id };
    const guis = project.guis.map((g, i) => (i === index
      ? { ...g, items: g.items.map((it) => (it.id === itemId ? { ...it, action: `open:${id}` } : it)) }
      : g));
    commitProject({ guis: [...guis, target] });
    switchGui(guis.length);
  }

  function openLinked(targetId: string) {
    const i = project.guis.findIndex((g) => g.id === targetId);
    if (i >= 0) switchGui(i);
    setMenu(null);
  }

  function onItemContext(e: ReactMouseEvent, itemId: string) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, itemId });
  }

  function onCellContext(slot: number, x: number, y: number) {
    const ownerId = occupant.get(slot);
    if (ownerId) setMenu({ x, y, itemId: ownerId });
    else setMenu(null);
  }

  // A click anywhere outside the menu closes it.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  function patchItem(id: string, patch: Partial<EditorItem>) {
    const old = gui.items.find((i) => i.id === id);
    let next: EditorGui = { ...gui, items: gui.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
    if (old && patch.key !== undefined && patch.key !== old.key) {
      next = {
        ...next,
        filler: next.filler === old.key ? patch.key : next.filler,
        navPrev: next.navPrev === old.key ? patch.key : next.navPrev,
        navNext: next.navNext === old.key ? patch.key : next.navNext,
      };
    }
    commit(next, `item:${id}:${Object.keys(patch).join(',')}`);
  }

  function addItem() {
    const item = newItem(gui);
    commit({ ...gui, items: [...gui.items, item] });
    select(item.id);
    setTool('assign');
  }

  /** Copies an item with a fresh key. Fixed slots are cleared so the copy never overlaps the original. */
  function duplicateItem(id: string) {
    const original = gui.items.find((i) => i.id === id);
    if (!original) return;
    const taken = new Set(gui.items.map((i) => i.key));
    let n = 2;
    while (taken.has(`${original.key}-${n}`)) n += 1;
    const copy: EditorItem = { ...original, id: newId('item'), key: `${original.key}-${n}`, slots: [] };
    commit({ ...gui, items: [...gui.items, copy] });
    select(copy.id);
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
    select(null);
  }

  /** Applies the active tool to a set of slots. The first slot decides whether it adds or removes. */
  function paint(slots: number[], first: number) {
    const set = new Set(slots);
    if (tool === 'content') {
      if (!gui.paginated) return;
      const remove = gui.contentSlots.includes(first);
      const content = remove
        ? gui.contentSlots.filter((s) => !set.has(s))
        : [...new Set([...gui.contentSlots, ...slots])].sort((a, b) => a - b);
      // A slot is either a fixed item or content, never both.
      commit({
        ...gui,
        items: gui.items.map((i) => ({ ...i, slots: i.slots.filter((s) => !set.has(s)) })),
        contentSlots: content,
      });
      return;
    }
    if (selected && !selected.pattern) {
      const remove = selected.slots.includes(first);
      commit({
        ...gui,
        items: gui.items.map((i) => {
          const without = i.slots.filter((s) => !set.has(s));
          if (i.id !== selected.id) return { ...i, slots: without };
          const slotsNext = remove ? without : [...new Set([...without, ...slots])].sort((a, b) => a - b);
          return { ...i, slots: slotsNext };
        }),
        contentSlots: gui.contentSlots.filter((s) => !set.has(s)),
      });
    }
  }

  function onCellDown(slot: number) {
    const canPaint = tool === 'content' || (selected !== null && !selected.pattern);
    if (canPaint) {
      setDrag({ start: slot, current: slot });
      return;
    }
    const ownerId = occupant.get(slot);
    if (ownerId) select(ownerId);
  }

  function onCellEnter(slot: number) {
    if (drag) setDrag({ ...drag, current: slot });
  }

  // Finish a paint stroke when the mouse button is released anywhere.
  useEffect(() => {
    if (!drag) return;
    function finish() {
      if (drag) paint(rectSlots(drag.start, drag.current), drag.start);
      setDrag(null);
    }
    window.addEventListener('mouseup', finish);
    return () => window.removeEventListener('mouseup', finish);
  });

  async function exportFile() {
    if (errorCount) return;
    const [file] = exportFiles({ guis: [gui] });
    try {
      if (await saveFile(file)) setNotice(`Gespeichert: ${file.name}`);
    } catch (err) {
      setNotice(`Export fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** All GUIs of the project as separate files: into a chosen folder, or as downloads as a fallback. */
  async function exportAll() {
    if (projectProblemCount(project) > 0) return;
    const files = exportFiles(project);
    try {
      if (canPickFolder()) {
        const saved = await saveToFolder(files);
        if (saved) setNotice(`${files.length} GUI-Dateien gespeichert.`);
      } else {
        downloadFiles(files);
        setNotice(`${files.length} Dateien werden heruntergeladen.`);
      }
    } catch (err) {
      setNotice(`Export fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Imports a GUI from JSON text as an additional GUI of the project and opens it. Nothing is replaced. */
  function importText(text: string) {
    try {
      const imported = fromFormat(JSON.parse(text));
      const id = uniqueGuiId(project.guis, imported.id);
      // Renaming also rewrites open: links that point at the imported GUI's own id.
      const guis = renameGuiEverywhere([...project.guis, imported], project.guis.length, id, imported.id);
      commitProject({ guis });
      setActiveIndex(guis.length - 1);
      setView('edit');
      select(null);
      setImportError(null);
      setNotice(id === imported.id ? `GUI „${id}“ importiert.` : `GUI als „${id}“ importiert, weil „${imported.id}“ schon existiert.`);
    } catch (err) {
      setImportError(`Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Opens a file dialog where the browser supports it; otherwise the hidden file input does the job. */
  async function importFromDisk() {
    if (!canUseFileDialogs()) {
      fileInput.current?.click();
      return;
    }
    try {
      const text = await pickJsonText();
      if (text !== null) importText(text);
    } catch (err) {
      setImportError(`Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    importText(await file.text());
  }

  function applyTemplate(id: string) {
    const template = TEMPLATES.find((t) => t.id === id);
    if (!template) return;
    if (gui.items.length > 0 && !window.confirm('Die aktuelle GUI wird durch die Vorlage ersetzt. (Rückgängig über Strg+Z.)')) return;
    commit(template.build());
    select(null);
  }

  function reset() {
    if (!window.confirm('Die aktuelle GUI verwerfen und neu beginnen? (Rückgängig ist danach über Strg+Z möglich.)')) return;
    commit(emptyGui());
    select(null);
  }

  const cells: CellView[] = Array.from({ length: size }, (_, slot) => {
    const ownerId = occupant.get(slot);
    const owner: EditorItem | undefined = ownerId ? itemById.get(ownerId) : undefined;
    return {
      slot,
      label: owner ? shortMaterial(owner.material) : '',
      color: owner ? ROLE_COLORS[roleOf(owner, gui)] : undefined,
      title: owner ? `${owner.key} (Slot ${slot})` : `Slot ${slot}`,
      selected: !!owner && owner.id === selectedId,
      content: contentSet.has(slot),
      pattern: !!owner?.pattern,
      error: !!owner && errorItemIds.has(owner.id),
      inDrag: dragSlots.has(slot),
    };
  });

  const hint = tool === 'content'
    ? 'Ziehen markiert einen Rechteckbereich als Content. Klick auf markierte Slots entfernt sie.'
    : selected && !selected.pattern
      ? `Ziehen weist „${selected.key}“ ein Rechteck zu. Klick auf eigene Slots entfernt sie.`
      : 'Item in der Liste wählen oder ein Slot anklicken, dann zuweisen.';

  return (
    <div className="app">
      <header className="topbar">
        <strong>GuiForge Editor</strong>
        <div className="spacer" />
        <span className={`save-state${saveState.ok ? '' : ' is-error'}`} role="status">
          {saveState.ok
            ? saveState.at ? `✓ Gespeichert ${saveState.at.toLocaleTimeString('de-DE')}` : 'Gespeichert'
            : '⚠ Speichern fehlgeschlagen (Browser-Speicher voll oder gesperrt)'}
        </span>
        <button type="button" className="btn" disabled={history.past.length === 0}
          onClick={() => dispatch({ type: 'undo' })} title="Rückgängig (Strg+Z)">↶ Undo</button>
        <button type="button" className="btn" disabled={history.future.length === 0}
          onClick={() => dispatch({ type: 'redo' })} title="Wiederholen (Strg+Shift+Z)">↷ Redo</button>
        <button type="button" className="btn" onClick={() => void importFromDisk()} title="GUI aus einer .json-Datei laden">
          Importieren
        </button>
        <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={importFile} />
        {/* aria-disabled instead of disabled: disabled buttons swallow the title tooltip that explains why. */}
        {project.guis.length > 1 && (
          <button type="button" className={`btn${projectErrors ? ' is-blocked' : ''}`} aria-disabled={projectErrors > 0}
            onClick={() => { if (!projectErrors) void exportAll(); }}
            title={projectErrors
              ? `Export gesperrt: ${projectErrors} Problem(e) in den GUIs beheben`
              : canPickFolder() ? 'Jede GUI als eigene .json in einen Ordner speichern' : 'Jede GUI als eigene .json herunterladen'}>
            Alle exportieren ({project.guis.length})
          </button>
        )}
        <button type="button" className={`btn primary${errorCount ? ' is-blocked' : ''}`} aria-disabled={errorCount > 0}
          onClick={() => { if (!errorCount) void exportFile(); }}
          title={errorCount ? `Export gesperrt: ${errorCount} Problem(e) beheben (siehe Liste unten)` : 'Als Format-v1-JSON exportieren'}>
          {errorCount ? `Exportieren (${errorCount} Fehler)` : 'Exportieren (.json)'}
        </button>
        <select className="btn" value="" aria-label="Aus Vorlage beginnen" title="Mit einer Vorlage neu beginnen"
          onChange={(e) => applyTemplate(e.target.value)}>
          <option value="">Vorlage…</option>
          {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button type="button" className="btn" onClick={reset}>Neu</button>
      </header>

      {importError && <div className="banner error">{importError}</div>}
      {notice && <div className="banner info" role="status">{notice}</div>}

      <main className="workspace">
        <aside className="panel">
          <h3>Items</h3>
          <button type="button" className="btn" onClick={addItem}>+ Item</button>
          <ul className="itemlist">
            {gui.items.map((i) => (
              <li key={i.id} onContextMenu={(e) => onItemContext(e, i.id)}>
                <button type="button" className={i.id === selectedId ? 'item on' : 'item'} onClick={() => select(i.id)}>
                  <span className="swatch" style={{ background: ROLE_COLORS[roleOf(i, gui)] }} />
                  <span className="item-key">{i.key || '(ohne Key)'}</span>
                  {linkTarget(i.action) !== null && <span className="link-badge" title="Verlinkt">↗ {linkTarget(i.action)}</span>}
                  {errorItemIds.has(i.id) && <span className="badge" title="Hat Probleme">!</span>}
                  <small>{i.pattern ?? `${i.slots.length} Slot${i.slots.length === 1 ? '' : 's'}`}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="legend">
            <span><i style={{ background: ROLE_COLORS.frame }} /> Rahmen</span>
            <span><i style={{ background: ROLE_COLORS.button }} /> Button</span>
            <span><i style={{ background: ROLE_COLORS.item }} /> Item</span>
          </div>
        </aside>

        <section className="center">
        <nav className="gui-bar" aria-label="GUIs im Projekt">
          <div className="gui-tabs">
            {project.guis.map((g, i) => (
              <span key={i} className={`gui-tab${i === index ? ' on' : ''}${tabDrag?.over === i ? ' drop-target' : ''}${tabDrag?.from === i ? ' dragging' : ''}`}
                draggable
                onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', g.id); setTabDrag({ from: i, over: null }); }}
                onDragOver={(e) => { if (tabDrag) { e.preventDefault(); if (tabDrag.over !== i) setTabDrag({ ...tabDrag, over: i }); } }}
                onDrop={(e) => { e.preventDefault(); if (tabDrag) moveGui(tabDrag.from, i); setTabDrag(null); }}
                onDragEnd={() => setTabDrag(null)}>
                <button type="button" onClick={() => switchGui(i)} aria-current={i === index ? 'true' : undefined}
                  title={`GUI „${g.id}“: ${g.rows} Zeilen${g.paginated ? ', paginiert' : ''} (zum Verschieben ziehen)`}>
                  <span className="gui-tab-icon" aria-hidden="true">▦</span>
                  <span className="gui-tab-name">{g.id}</span>
                  <small className="gui-tab-meta">{g.rows}×9{g.paginated ? ' · pag.' : ''}</small>
                </button>
                {project.guis.length > 1 && (
                  <button type="button" className="x" title={`GUI „${g.id}“ löschen`} aria-label={`GUI ${g.id} löschen`}
                    onClick={() => deleteGui(i)}>×</button>
                )}
              </span>
            ))}
            <span className="gui-tab gui-tab-new">
              <button type="button" onClick={addGui} title="Neue GUI im Projekt anlegen">+ Neue GUI</button>
            </span>
          </div>
          {project.guis.length > 1 && (
            <button type="button" className={`btn small links-toggle${view === 'links' ? ' on-panel' : ''}`}
              aria-pressed={view === 'links'} onClick={() => setView(view === 'links' ? 'edit' : 'links')}
              title="Zeigt, welche GUIs per open:-Aktion aufeinander verweisen">
              Verknüpfungen
            </button>
          )}
        </nav>
        {view === 'links' ? (
          <LinkView project={project} onOpen={(i) => { switchGui(i); setView('edit'); }} />
        ) : (
          <>
          <div className="section">
            <div className="section-head">
              <span>Bearbeiten</span>
              <span className={gui.title.length > TITLE_LIMIT ? 'error-text' : 'muted'}
                title="Der Spieltitel wird ab etwa 32 Zeichen abgeschnitten">
                Titel {gui.title.length}/{TITLE_LIMIT}
              </span>
            </div>
            <div className="toolbar">
              <div className="seg">
                <button type="button" className={tool === 'assign' ? 'on' : ''} onClick={() => setTool('assign')}>
                  Zuweisen
                </button>
                <button type="button" className={tool === 'content' ? 'on' : ''} disabled={!gui.paginated}
                  onClick={() => setTool('content')}
                  title={gui.paginated ? '' : 'Erst unter GUI „Paginiert“ aktivieren'}>
                  Content malen
                </button>
              </div>
            </div>
            <div className="mc-window">
              <input className="mc-title mc-title-input" value={gui.title} placeholder={gui.id}
                aria-label="Titel der GUI (wird im Spiel oben angezeigt)"
                onChange={(e) => patchGui({ title: e.target.value })} />
              <Grid cells={cells} onCellDown={onCellDown} onCellEnter={onCellEnter} onCellContext={onCellContext} />
            </div>
            <p className="muted hint section-note">{hint}</p>
          </div>
          <Preview gui={gui} resolved={resolved} />
          </>
        )}
        </section>

        <aside className="panel">
          <div className="tabs">
            <button type="button" className={inspector === 'gui' ? 'on' : ''} onClick={() => setInspector('gui')}>GUI</button>
            <button type="button" className={inspector === 'item' ? 'on' : ''} disabled={!selected}
              onClick={() => setInspector('item')}>Item</button>
          </div>
          {inspector === 'item' && selected
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

      {menu && (() => {
        const item = gui.items.find((i) => i.id === menu.itemId);
        if (!item) return null;
        const target = linkTarget(item.action);
        const targetExists = target !== null && project.guis.some((g) => g.id === target);
        const others = project.guis.filter((g) => g !== gui);
        return (
          <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} role="menu"
            onMouseDown={(e) => e.stopPropagation()}>
            <div className="ctx-title">„{item.key}“ verlinken</div>
            {targetExists && (
              <button type="button" role="menuitem" onClick={() => openLinked(target)}>↗ GUI „{target}“ öffnen</button>
            )}
            {target !== null && (
              <button type="button" role="menuitem" onClick={() => setItemAction(item.id, '')}>Verknüpfung entfernen</button>
            )}
            <button type="button" role="menuitem" onClick={() => linkToNewGui(item.id)}>Neue GUI erstellen und verlinken</button>
            {others.map((g) => (
              <button type="button" role="menuitem" key={g.id}
                onClick={() => { if (mayReplaceAction(item)) setItemAction(item.id, `open:${g.id}`); }}>
                Bestehende GUI „{g.id}“ verlinken
              </button>
            ))}
          </div>
        );
      })()}

      <footer className="validation">
        {errorCount === 0
          ? <span className="ok">✓ Export-bereit (Format v1)</span>
          : (
            <ul className="errors">
              {found.map((p) => (
                <li key={p.message}>
                  {p.itemId
                    ? <button type="button" className="link" onClick={() => select(p.itemId!)}>{p.message}</button>
                    : p.message}
                </li>
              ))}
            </ul>
          )}
      </footer>
    </div>
  );
}
