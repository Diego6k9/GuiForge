# GuiForge Format v1

Layout-Daten für GUIs. Verhalten (Klick-Logik) gehört **nicht** ins Format, sondern wird im Code per `key` gebunden.

## GUI (Root)

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `formatVersion` | int | ja | Muss `1` sein. |
| `id` | string | ja | Eindeutige GUI-ID im Projekt, z.B. `shop-main`. Ziel für `open:<id>`. |
| `type` | string | nein | Nur `"chest"` in v1. Default `"chest"`. |
| `rows` | int | ja | 1 bis 6. Inventargröße = `rows * 9`. |
| `title` | string | nein | MiniMessage. |
| `items` | array | nein | Feste Items (Rahmen, Buttons, Deko). |
| `content` | object | nein | Nur bei paginierten GUIs. Siehe unten. |

## Item

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `key` | string | – | Stabile ID. Pflicht, wenn das Item Klick-Logik bekommt oder Nav-Button ist. Ohne `key` ist es reine Deko. |
| `slots` | int[] | – (Pflicht) | Slots im Inventar, 0-basiert. Ein Item kann mehrere Slots belegen. |
| `material` | string | – (Pflicht) | Bukkit/Minecraft-Material, z.B. `minecraft:lime_dye`. |
| `amount` | int | 1 | Stackgröße. |
| `name` | string | – | MiniMessage. |
| `lore` | string[] | – | Jede Zeile MiniMessage. |
| `customModelData` | int | – | |
| `glint` | bool | – | Enchant-Glint erzwingen (`true`) oder unterdrücken (`false`). Ideal für Rahmen-Items. |
| `hideTooltip` | bool | `false` | Blendet den Hover-Tooltip aus. Für dekorative Items, damit keine leere Box erscheint. |
| `locked` | bool | `true` | `false` = Spieler darf das Item aus dem Slot nehmen. |
| `action` | string | – | Nur geschlossene Navigation: `close`, `next-page`, `prev-page`, `open:<gui-id>`. |

## Paginierung (`content`)

| Feld | Typ | Default | Beschreibung |
|---|---|---|---|
| `slots` | int[] | – (Pflicht) | Slots, in denen die Laufzeit-Inhalte erscheinen. Dürfen sich mit keinem festen Item überschneiden. |
| `fill` | string | `"empty"` | `"empty"` lässt leere Slots frei, `"filler"` füllt sie mit `filler`. |
| `filler` | string | – | `key` eines festen Items, das als Füllung dient (Pflicht bei `fill: "filler"`). |
| `navOnEdge` | string | `"hide"` | Was auf der ersten/letzten Seite mit Prev/Next passiert: `"hide"` blendet aus, `"keep"` zeigt sie inaktiv. |
| `nav` | object | – | `{ "prev": "<key>", "next": "<key>" }`. Verweist auf feste Items mit diesen Keys. |

## Validierung

Der Loader prüft beim Laden: `formatVersion`, `rows`, Slot-Bereiche, doppelte Keys, Überschneidungen von Content-Slots mit festen Items, und ob Nav-/Filler-Keys existieren. Fehler werfen eine `IllegalArgumentException` mit Klartext.

## Versionierung

Breaking Changes erhöhen `formatVersion`. Der Loader lehnt unbekannte Versionen ab, statt still falsch zu rendern. Lite- und Premium-Editor schreiben dasselbe Schema.
