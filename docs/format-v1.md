# GuiForge Format v1

Layout-Daten für GUIs. Verhalten (Klick-Logik) gehört **nicht** ins Format, sondern wird im Code per `key` gebunden.

## GUI (Root)

| Feld            | Typ    | Pflicht | Beschreibung                                                          |
|-----------------|--------|---------|-----------------------------------------------------------------------|
| `formatVersion` | int    | ja      | Muss `1` sein.                                                        |
| `id`            | string | ja      | Eindeutige GUI-ID im Projekt, z.B. `shop-main`. Ziel für `open:<id>`. |
| `type`          | string | nein    | Nur `"chest"` in v1. Default `"chest"`.                               |
| `rows`          | int    | ja      | 1 bis 6. Inventargröße = `rows * 9`.                                  |
| `title`         | string | nein    | MiniMessage.                                                          |
| `items`         | array  | nein    | Feste Items (Rahmen, Buttons, Deko).                                  |
| `content`       | object | nein    | Nur bei paginierten GUIs. Siehe unten.                                |

## Item

| Feld              | Typ      | Default     | Beschreibung                                                                                                                                   |
|-------------------|----------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| `key`             | string   | –           | Stabile ID. Pflicht, wenn das Item Klick-Logik bekommt oder Nav-Button ist. Ohne `key` ist es reine Deko.                                      |
| `slots`           | int[]    | – (Pflicht) | Slots im Inventar, 0-basiert. Ein Item kann mehrere Slots belegen.                                                                             |
| `material`        | string   | – (Pflicht) | Bukkit/Minecraft-Material, z.B. `minecraft:lime_dye`.                                                                                          |
| `amount`          | int      | 1           | Stackgröße.                                                                                                                                    |
| `name`            | string   | –           | MiniMessage.                                                                                                                                   |
| `lore`            | string[] | –           | Jede Zeile MiniMessage.                                                                                                                        |
| `customModelData` | int      | –           |                                                                                                                                                |
| `glint`           | bool     | –           | Enchant-Glint erzwingen (`true`) oder unterdrücken (`false`). Ideal für Rahmen-Items.                                                          |
| `hideTooltip`     | bool     | `false`     | Blendet den Hover-Tooltip aus. Für dekorative Items, damit keine leere Box erscheint.                                                          |
| `hideAttributes`  | bool     | `true`      | Blendet die Attribut-Zeilen von Waffen und Rüstung (Schaden, Angriffstempo, Rüstung) im Tooltip aus. `false` zeigt sie wie im Spiel. |
| `skin`            | string   | –           | Nur für `minecraft:player_head`. Textur-Hash (64 Hex-Zeichen) oder `http://textures.minecraft.net/texture/<hash>`. Andere Materialien: Fehler. |
| `locked`          | bool     | `true`      | `false` = Spieler darf das Item aus dem Slot nehmen.                                                                                           |
| `action`          | string   | –           | `close`, `next-page`, `prev-page` (nur paginiert), `open:<gui-id>`, `sound:<name>[:<lautstärke>:<tonhöhe>]` (z. B. `sound:entity.experience_orb.pickup:0.8:1.2`, Tonhöhe 0,5–2), `message:<text>` (MiniMessage, `{token}` möglich). Eigene Aktionen per `registerAction("prefix:", …)` in Java. |

## Paginierung (`content`)

| Feld        | Typ    | Default     | Beschreibung                                                                                                                                                                                     |
|-------------|--------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `slots`     | int[]  | – (Pflicht) | Slots, in denen die Laufzeit-Inhalte erscheinen. Dürfen sich mit keinem festen Item überschneiden.                                                                                               |
| `fill`      | string | `"empty"`   | `"empty"` lässt die ungenutzten Content-Slots frei, `"filler"` füllt sie mit dem Rahmen-Item aus `filler`.                                                                                       |
| `filler`    | string | –           | `key` eines festen Rahmen-Items. Wird auf Seiten mit ausgeblendetem Prev/Next an deren Stelle gezeigt und bei `fill: "filler"` in ungenutzte Content-Slots gesetzt.                              |
| `navOnEdge` | string | `"hide"`    | Was auf der ersten/letzten Seite mit Prev/Next passiert: `"hide"` ersetzt den Button durch das Rahmen-Item aus `filler` (ohne `filler` bleibt der Slot leer), `"keep"` zeigt den Button inaktiv. |
| `nav`       | object | –           | `{ "prev": "<key>", "next": "<key>" }`. Verweist auf feste Items mit diesen Keys.                                                                                                                |

## Validierung

Der Loader prüft beim Laden: `formatVersion`, `rows`, Slot-Bereiche, doppelte Keys, Überschneidungen von Content-Slots
mit festen Items, und ob Nav-/Filler-Keys existieren. Fehler werfen eine `IllegalArgumentException` mit Klartext.

## Versionierung

Breaking Changes erhöhen `formatVersion`. Der Loader lehnt unbekannte Versionen ab, statt still falsch zu rendern. Lite-
und Premium-Editor schreiben dasselbe Schema.

## Platzhalter und Viewer-spezifische Items (nur Code)

Im Format steht `{token}` einfach als Text in `name` und `lore`. Der Code füllt die Werte pro Spieler:

    gui.placeholder("balance", p -> String.valueOf(economy.getBalance(p)));
    gui.itemFor("profile", p -> buildProfileHead(p));

Platzhalter-Werte werden als reiner Text eingesetzt, MiniMessage-Tags aus Spielerdaten werden also nicht interpretiert.
Unbekannte Tokens bleiben stehen.

## Slot-Muster

`"slots": "border"` belegt den äußeren Rahmen der Kiste, `"slots": "empty"` alle Slots. Muster sind Hintergrund: Sie
nehmen nur Slots, die noch frei sind und nicht zur Content-Area gehören. Feste Slot-Listen werden immer zuerst vergeben.
