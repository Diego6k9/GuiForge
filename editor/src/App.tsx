import {type ChangeEvent, useEffect, useMemo, useReducer, useState} from 'react';
import {
    type EditorGui,
    type EditorItem,
    emptyGui,
    fromFormat,
    newItem,
    problems,
    resolveSlots,
    ROLE_COLORS,
    roleOf,
    toFormat,
} from './format/model';
import {type History, historyReducer} from './history';
import {type CellView, Grid} from './components/Grid';
import {ItemPanel} from './components/ItemPanel';
import {GuiPanel} from './components/GuiPanel';
import {Preview} from './components/Preview';

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

type Tool = 'assign' | 'content';
type Inspector = 'gui' | 'item';

export default function App() {
    const [history, dispatch] = useReducer(historyReducer, undefined, (): History => ({
        past: [], present: loadInitial(), future: [],
    }));
    const gui = history.present;
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [inspector, setInspector] = useState<Inspector>('gui');
    const [tool, setTool] = useState<Tool>('assign');
    const [drag, setDrag] = useState<{ start: number; current: number } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);

    const selected = selectedId ? gui.items.find((i) => i.id === selectedId) ?? null : null;
    const resolved = useMemo(() => resolveSlots(gui), [gui]);
    const found = useMemo(() => problems(gui), [gui]);
    const errorCount = found.length;
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
            localStorage.setItem(STORAGE_KEY, JSON.stringify(toFormat(gui)));
        } catch {
            // Storage unavailable: editing still works, just without autosave.
        }
    }, [gui]);

    function commit(next: EditorGui, coalesceKey?: string) {
        dispatch({type: 'set', next, coalesceKey, at: Date.now()});
    }

    function select(id: string | null) {
        setSelectedId(id);
        setInspector(id ? 'item' : 'gui');
    }

    // Keyboard: undo/redo, unless the user is typing in a field (then the browser handles it).
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
            const mod = e.ctrlKey || e.metaKey;
            if (!mod) return;
            if (e.key.toLowerCase() === 'z' && !e.shiftKey) {
                e.preventDefault();
                dispatch({type: 'undo'});
            } else if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') {
                e.preventDefault();
                dispatch({type: 'redo'});
            }
        }

        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    function patchGui(patch: Partial<EditorGui>) {
        const next = {...gui, ...patch};
        if (patch.rows !== undefined && patch.rows !== gui.rows) {
            const limit = next.rows * 9;
            next.items = next.items.map((i) => ({...i, slots: i.slots.filter((s) => s < limit)}));
            next.contentSlots = next.contentSlots.filter((s) => s < limit);
        }
        commit(next, `gui:${Object.keys(patch).join(',')}`);
    }

    function patchItem(id: string, patch: Partial<EditorItem>) {
        const old = gui.items.find((i) => i.id === id);
        let next: EditorGui = {...gui, items: gui.items.map((i) => (i.id === id ? {...i, ...patch} : i))};
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
        commit({...gui, items: [...gui.items, item]});
        select(item.id);
        setTool('assign');
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
                items: gui.items.map((i) => ({...i, slots: i.slots.filter((s) => !set.has(s))})),
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
                    if (i.id !== selected.id) return {...i, slots: without};
                    const slotsNext = remove ? without : [...new Set([...without, ...slots])].sort((a, b) => a - b);
                    return {...i, slots: slotsNext};
                }),
                contentSlots: gui.contentSlots.filter((s) => !set.has(s)),
            });
        }
    }

    function onCellDown(slot: number) {
        const canPaint = tool === 'content' || (selected !== null && !selected.pattern);
        if (canPaint) {
            setDrag({start: slot, current: slot});
            return;
        }
        const ownerId = occupant.get(slot);
        if (ownerId) select(ownerId);
    }

    function onCellEnter(slot: number) {
        if (drag) setDrag({...drag, current: slot});
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

    function exportFile() {
        if (errorCount) return;
        const blob = new Blob([JSON.stringify(toFormat(gui), null, 2) + '\n'], {type: 'application/json'});
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
            commit(fromFormat(JSON.parse(await file.text())));
            select(null);
            setImportError(null);
        } catch (err) {
            setImportError(`Import fehlgeschlagen: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    function reset() {
        if (!window.confirm('Die aktuelle GUI verwerfen und neu beginnen? (Rückgängig ist danach über Strg+Z möglich.)')) return;
        commit(emptyGui());
        select(null);
    }

    const cells: CellView[] = Array.from({length: size}, (_, slot) => {
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
                <span className="muted">{gui.id} · {gui.rows} Zeilen{gui.paginated ? ' · paginiert' : ''}</span>
                <div className="spacer"/>
                <button type="button" className="btn" disabled={history.past.length === 0}
                        onClick={() => dispatch({type: 'undo'})} title="Rückgängig (Strg+Z)">↶ Undo
                </button>
                <button type="button" className="btn" disabled={history.future.length === 0}
                        onClick={() => dispatch({type: 'redo'})} title="Wiederholen (Strg+Shift+Z)">↷ Redo
                </button>
                <label className="btn">
                    Importieren
                    <input type="file" accept=".json,application/json" hidden onChange={importFile}/>
                </label>
                <button type="button" className="btn primary" disabled={errorCount > 0} onClick={exportFile}
                        title={errorCount ? `${errorCount} Problem(e) beheben, dann exportieren` : 'Als Format-v1-JSON exportieren'}>
                    {errorCount ? `Exportieren (${errorCount} Fehler)` : 'Exportieren (.json)'}
                </button>
                <button type="button" className="btn" onClick={reset}>Neu</button>
            </header>

            {importError && <div className="banner error">{importError}</div>}

            <main className="workspace">
                <aside className="panel">
                    <h3>Items</h3>
                    <button type="button" className="btn" onClick={addItem}>+ Item</button>
                    <ul className="itemlist">
                        {gui.items.map((i) => (
                            <li key={i.id}>
                                <button type="button" className={i.id === selectedId ? 'item on' : 'item'}
                                        onClick={() => select(i.id)}>
                                    <span className="swatch" style={{background: ROLE_COLORS[roleOf(i, gui)]}}/>
                                    <span className="item-key">{i.key || '(ohne Key)'}</span>
                                    {errorItemIds.has(i.id) && <span className="badge" title="Hat Probleme">!</span>}
                                    <small>{i.pattern ?? `${i.slots.length} Slot${i.slots.length === 1 ? '' : 's'}`}</small>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <div className="legend">
                        <span><i style={{background: ROLE_COLORS.frame}}/> Rahmen</span>
                        <span><i style={{background: ROLE_COLORS.button}}/> Button</span>
                        <span><i style={{background: ROLE_COLORS.item}}/> Item</span>
                    </div>
                </aside>

                <section className="center">
                    <div className="toolbar">
                        <div className="seg">
                            <button type="button" className={tool === 'assign' ? 'on' : ''}
                                    onClick={() => setTool('assign')}>
                                Zuweisen
                            </button>
                            <button type="button" className={tool === 'content' ? 'on' : ''} disabled={!gui.paginated}
                                    onClick={() => setTool('content')}
                                    title={gui.paginated ? '' : 'Erst unter GUI „Paginiert“ aktivieren'}>
                                Content malen
                            </button>
                        </div>
                        <span className="muted hint">{hint}</span>
                    </div>

                    <Grid cells={cells} onCellDown={onCellDown} onCellEnter={onCellEnter}/>
                    <Preview gui={gui} resolved={resolved}/>
                </section>

                <aside className="panel">
                    <div className="tabs">
                        <button type="button" className={inspector === 'gui' ? 'on' : ''}
                                onClick={() => setInspector('gui')}>GUI
                        </button>
                        <button type="button" className={inspector === 'item' ? 'on' : ''} disabled={!selected}
                                onClick={() => setInspector('item')}>Item
                        </button>
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
                        : <GuiPanel gui={gui} onChange={patchGui}/>}
                </aside>
            </main>

            <footer className="validation">
                {errorCount === 0
                    ? <span className="ok">✓ Export-bereit (Format v1)</span>
                    : (
                        <ul className="errors">
                            {found.map((p) => (
                                <li key={p.message}>
                                    {p.itemId
                                        ? <button type="button" className="link"
                                                  onClick={() => select(p.itemId!)}>{p.message}</button>
                                        : p.message}
                                </li>
                            ))}
                        </ul>
                    )}
            </footer>
        </div>
    );
}
