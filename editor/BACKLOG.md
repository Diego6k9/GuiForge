# GuiForge Editor – UX-Backlog

Schrittweise Umsetzung. Status: ✅ umgesetzt · 🟡 in Arbeit · ⬜ offen · ⏸ geparkt

## Phase 1 – Grundlagen (aktuell)

| # | Feature                                               | Status | Notizen                                                                                   |
|---|-------------------------------------------------------|--------|-------------------------------------------------------------------------------------------|
| 1 | Undo / Redo (Buttons + Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y) | ✅     | Reducer-Historie, max. 100 Schritte, Tipp-Eingaben werden innerhalb 1,2 s zusammengefasst |
| 2 | Werkzeug-Modell mit Rechteck-Malen                    | ✅     | Werkzeuge „Zuweisen“ und „Content malen“, Drag über Slots füllt ein Rechteck              |
| 3 | GUI / Item Tabs im Inspector                          | ✅     | Behebt das Problem, dass GUI-Einstellungen bei gewähltem Item nicht erreichbar waren      |
| 4 | Rollenfarben (Rahmen / Button / Item)                 | ✅     | Gleiche Farben in Grid, Vorschau und Itemliste; Legende im Grid                           |
| 5 | Klickbare Fehler                                      | ✅     | Probleme im Footer wählen das betroffene Item aus; Fehler-Badge in der Itemliste          |
| 6 | Export-Hinweis bei Fehlern                            | 🟡     | Anzahl der Fehler steht am Export-Button; Erklärung im Tooltip ausstehend                 |

## Phase 2 – Bedienkomfort

| #  | Feature                                                                    | Status | Notizen                                                     |
|----|----------------------------------------------------------------------------|--------|-------------------------------------------------------------|
| 7  | Rechtsklick-Verknüpfung (Item → GUI öffnen: neu / bestehend)               | ⬜     | Gehört zum Multi-GUI-Projekt, siehe Phase 3                 |
| 8  | Keys aus Namen ableiten                                                    | ⬜     | Vorschlag nur, solange der Key nicht manuell geändert wurde |
| 9  | Material-Icon-Picker statt Freitext-Datalist                               | ⬜     | Mit Suche und Vorschau                                      |
| 10 | MiniMessage-Farbpalette für Namen und Lore                                 | ⬜     | Erzeugt nur gültige Tags                                    |
| 11 | Mehr Tastenkürzel (Entfernen, Duplizieren, Pfeiltasten, Alt+Klick Pipette) | ⬜     |                                                             |
| 12 | Autosave-Status anzeigen („gespeichert“ / „ungespeichert“)                 | ⬜     | Autosave läuft bereits über localStorage                    |
| 13 | Vorlagen (leeres Shop-Raster, Paginierte Liste, Bestätigungs-Dialog)       | ⬜     |                                                             |
| 14 | File System Access API für Export/Import                                   | ⬜     | Fallback: Download wie bisher                               |

## Phase 3 – Projekte

| #  | Feature                                                | Status | Notizen                         |
|----|--------------------------------------------------------|--------|---------------------------------|
| 15 | Mehrere GUIs in einem Projekt                          | ⬜     | Voraussetzung für Verknüpfungen |
| 16 | Verknüpfungsansicht (GUI-Graph mit `open:<id>`-Kanten) | ⬜     |                                 |
| 17 | Thumbnails der GUIs in der Projektliste                | ⏸      | Hängt an der Texturfrage        |

## Geparkt

| Thema                                 | Status | Notizen                                         |
|---------------------------------------|--------|-------------------------------------------------|
| Texturen / Mojang-Assets für Vorschau | ⏸      | Lizenzfrage offen, bewusst nach hinten gestellt |
| Pro/Lite-Aufteilung im Editor         | ⏸      | Entscheidung nach Feature-Stand                 |

## Konventionen

- Jede Phase-1-Änderung bekommt einen Test in `model.test.ts`, wo reine Logik betroffen ist.
- Änderungen am Format (`docs/format-v1.md`) nur mit Abstimmung, da das Format eingefroren werden soll.
