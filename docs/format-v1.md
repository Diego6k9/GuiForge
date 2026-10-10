# GuiForge Format v1

Layout data for GUIs. Behaviour (click logic) does **not** belong in the format. It is bound in code by `key`.

## GUI (root)

| Field           | Type   | Required | Description                                                             |
|-----------------|--------|----------|-------------------------------------------------------------------------|
| `formatVersion` | int    | yes      | Must be `1`.                                                            |
| `id`            | string | yes      | Unique GUI ID in the project, e.g. `shop-main`. Target for `open:<id>`. |
| `type`          | string | no       | Only `"chest"` in v1. Default `"chest"`.                                |
| `rows`          | int    | yes      | 1 to 6. Inventory size = `rows * 9`.                                    |
| `title`         | string | no       | MiniMessage. Supports `{token}` placeholders.                           |
| `items`         | array  | no       | Fixed items (frames, buttons, decoration).                              |
| `content`       | object | no       | Only for paginated GUIs. See below.                                     |

## Item

| Field             | Type     | Default      | Description                                                                                                                                                                                                                                                                               |
|-------------------|----------|--------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `key`             | string   | –            | Stable ID. Required if the item has click logic or is a navigation button. Without a `key` the item is decoration only.                                                                                                                                                                   |
| `slots`           | int[]    | – (required) | Inventory slots, 0-based. An item can occupy several slots.                                                                                                                                                                                                                               |
| `material`        | string   | – (required) | Bukkit/Minecraft material, e.g. `minecraft:lime_dye`.                                                                                                                                                                                                                                     |
| `amount`          | int      | 1            | Stack size.                                                                                                                                                                                                                                                                               |
| `name`            | string   | –            | MiniMessage. Supports `{token}` placeholders.                                                                                                                                                                                                                                             |
| `lore`            | string[] | –            | One MiniMessage entry per line. Supports `{token}` placeholders.                                                                                                                                                                                                                          |
| `customModelData` | int      | –            | Custom model data for resource packs.                                                                                                                                                                                                                                                     |
| `glint`           | bool     | –            | Force the enchantment glint (`true`) or suppress it (`false`). Useful for frame items.                                                                                                                                                                                                    |
| `hideTooltip`     | bool     | `false`      | Hides the hover tooltip. For decorative items, so no empty box appears.                                                                                                                                                                                                                   |
| `hideAttributes`  | bool     | `true`       | Hides the attribute lines of weapons and armor (damage, attack speed, armor) in the tooltip. `false` shows them as in the game.                                                                                                                                                           |
| `skin`            | string   | –            | Only for `minecraft:player_head`. Texture hash (1 to 64 hex characters) or `http://textures.minecraft.net/texture/<hash>`. Error for other materials.                                                                                                                                          |
| `locked`          | bool     | `true`       | `false` lets the player take the item out of its slot.                                                                                                                                                                                                                                    |
| `action`          | string   | –            | `close`, `next-page`, `prev-page` (paginated only), `open:<gui-id>`, `sound:<name>[:<volume>:<pitch>]` (e.g. `sound:entity.experience_orb.pickup:0.8:1.2`, pitch 0.5 to 2), `message:<text>` (MiniMessage, `{token}` allowed). Custom actions via `registerAction("prefix:", …)` in Java. |

## Pagination (`content`)

| Field       | Type   | Default      | Description                                                                                                                                                                                      |
|-------------|--------|--------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `slots`     | int[]  | – (required) | Slots where the runtime content appears. Must not overlap any fixed item.                                                                                                                        |
| `fill`      | string | `"empty"`    | `"empty"` leaves unused content slots free. `"filler"` fills them with the frame item from `filler`.                                                                                             |
| `filler`    | string | –            | `key` of a fixed frame item. Shown in place of the prev/next button on pages where it is hidden, and used for unused content slots when `fill: "filler"`.                                        |
| `navOnEdge` | string | `"hide"`     | What happens to prev/next on the first/last page: `"hide"` replaces the button with the frame item from `filler` (without `filler` the slot stays empty), `"keep"` shows the button as inactive. |
| `nav`       | object | –            | `{ "prev": "<key>", "next": "<key>" }`. Points to fixed items with these keys.                                                                                                                   |

## Validation

On load, the loader checks: `formatVersion`, `rows`, slot ranges, duplicate keys, overlaps between content slots and
fixed items, and whether the nav and filler keys exist. Errors throw an `IllegalArgumentException` with a plain message.

## Versioning

Breaking changes increase `formatVersion`. The loader rejects unknown versions instead of silently rendering them
wrongly. Any editor or tool that writes this format must follow the same schema.

## Placeholders and per-viewer items (code only)

In the format, `{token}` is plain text in `name`, `title` and `lore`. The code fills in the values per player:

    gui.placeholder("balance", p -> String.valueOf(economy.getBalance(p)));
    gui.itemFor("profile", p -> buildProfileHead(p));

Placeholder values are inserted as plain text, so MiniMessage tags in player data are not interpreted.
Unknown tokens are left as they are.

## Page tokens (paginated GUIs)

Paginated GUIs have built-in tokens in item `name` and `lore`, and in `message:` actions. Page numbers start at 1 and are clamped to the valid range:

| Token        | Value                                   |
|--------------|-----------------------------------------|
| `{page}`     | current page                            |
| `{pages}`    | total number of pages                   |
| `{prevPage}` | previous page (1 on the first page)     |
| `{nextPage}` | next page (last page on the last page)  |

Example: `"name": "<yellow>Next page <gold>({nextPage}/{pages})</gold>"`

The GUI title is set when the menu opens and does not change while paging, so page tokens are not filled in the title.
These names are reserved: `placeholder("page", …)` in Java throws an `IllegalArgumentException`.

## Slot patterns

`"slots": "border"` covers the outer frame of the chest, `"slots": "filler"` covers all free slots. The older spelling `"empty"` is still accepted. Patterns are background:
they
only take slots that are still free and do not belong to the content area. Explicit slot lists are always assigned
first.
