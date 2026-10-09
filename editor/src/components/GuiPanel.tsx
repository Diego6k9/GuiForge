import type {EditorGui} from '../format/model';

interface GuiPanelProps {
    gui: EditorGui;
    onChange: (patch: Partial<EditorGui>) => void;
}

export function GuiPanel({gui, onChange}: GuiPanelProps) {
    const keys = gui.items.map((i) => i.key).filter(Boolean);
    const keyOptions = (
        <>
            <option value="">– keiner –</option>
            {keys.map((k) => <option key={k} value={k}>{k}</option>)}
        </>
    );

    return (
        <div className="form">
            <h3>GUI-Einstellungen</h3>

            <label>
                GUI-ID
                <input value={gui.id} onChange={(e) => onChange({id: e.target.value.trim()})}/>
                <small className="muted">Ziel für „open:&lt;id&gt;“ im Code.</small>
            </label>

            <label>
                Titel (MiniMessage)
                <input value={gui.title} onChange={(e) => onChange({title: e.target.value})}/>
            </label>

            <label>
                Zeilen
                <select value={gui.rows} onChange={(e) => onChange({rows: Number(e.target.value)})}>
                    {[1, 2, 3, 4, 5, 6].map((r) => <option key={r} value={r}>{r} ({r * 9} Slots)</option>)}
                </select>
            </label>

            <label className="checks">
                <span><input type="checkbox" checked={gui.paginated}
                             onChange={(e) => onChange({paginated: e.target.checked})}/> Paginiert</span>
            </label>

            {gui.paginated && (
                <>
                    <p className="muted">Im Raster unter „Content-Bereich malen“ markierst du die Slots für die
                        Laufzeit-Inhalte.</p>

                    <label>
                        Ungenutzte Content-Slots
                        <select value={gui.fill}
                                onChange={(e) => onChange({fill: e.target.value as 'empty' | 'filler'})}>
                            <option value="empty">Leer lassen</option>
                            <option value="filler">Mit Rahmen-Item auffüllen</option>
                        </select>
                    </label>

                    <label>
                        Rahmen-Item (filler)
                        <select value={gui.filler}
                                onChange={(e) => onChange({filler: e.target.value})}>{keyOptions}</select>
                        <small className="muted">Wird für Füllung und für ausgeblendete Nav-Buttons genutzt.</small>
                    </label>

                    <label>
                        Nav-Buttons am Rand
                        <select value={gui.navOnEdge}
                                onChange={(e) => onChange({navOnEdge: e.target.value as 'hide' | 'keep'})}>
                            <option value="hide">Ausblenden (durch Rahmen ersetzen)</option>
                            <option value="keep">Inaktiv anzeigen</option>
                        </select>
                    </label>

                    <label>
                        Zurück-Button
                        <select value={gui.navPrev}
                                onChange={(e) => onChange({navPrev: e.target.value})}>{keyOptions}</select>
                    </label>

                    <label>
                        Weiter-Button
                        <select value={gui.navNext}
                                onChange={(e) => onChange({navNext: e.target.value})}>{keyOptions}</select>
                    </label>
                </>
            )}
        </div>
    );
}
