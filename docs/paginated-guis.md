# Paginated GUIs

A paginated GUI shows a list that does not fit into one inventory. Your code supplies the list. GuiForge takes care of the slots, the navigation buttons and page changes.

## Definition

A paginated GUI has a `content` block. The navigation buttons and the filler are normal items with a `key`, and the block refers to them by key. This is `shop-list.json`, which is bundled with the plugin:

    {
      "formatVersion": 1,
      "id": "shop-list",
      "type": "chest",
      "rows": 6,
      "title": "<gradient:#ffd166:#ef476f>Products</gradient>",
      "items": [
        { "key": "filler", "slots": "border", "material": "minecraft:black_stained_glass_pane",
          "name": " ", "locked": true, "hideTooltip": true },
        { "key": "btn-prev", "slots": [46], "material": "minecraft:arrow",
          "name": "<yellow>« Zurück</yellow>", "locked": true, "action": "prev-page" },
        { "key": "btn-next", "slots": [52], "material": "minecraft:arrow",
          "name": "<yellow>Weiter »</yellow>", "locked": true, "action": "next-page" },
        { "key": "btn-back", "slots": [49], "material": "minecraft:barrier",
          "name": "<red>Schließen</red>", "locked": true, "action": "close" }
      ],
      "content": {
        "slots": [10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 25, 28, 29, 30, 31, 32, 33, 34, 37, 38, 39, 40, 41, 42, 43],
        "fill": "filler",
        "filler": "filler",
        "navOnEdge": "hide",
        "nav": { "prev": "btn-prev", "next": "btn-next" }
      }
    }

Fields of `content`:

| Field | Meaning |
| --- | --- |
| `slots` | Required. The slots that show list entries, in order. A list of numbers only, ranges are not supported. |
| `fill` | `"empty"` (default) leaves unused content slots open. `"filler"` fills them with the item named in `filler`. |
| `filler` | Key of an item in `items`. Required when `fill` is `"filler"`. Also used for hidden navigation slots, see below. |
| `navOnEdge` | `"hide"` (default) hides a navigation button on the first or last page, where it leads nowhere. `"keep"` always shows it. |
| `nav.prev` / `nav.next` | Keys of items in `items`. |

Content slots must not overlap fixed items. The loader rejects the definition otherwise.

When a navigation button is hidden, its slot shows the `filler` item. Without a `filler`, the slot stays empty.

## Code

Set the list, then handle clicks on it. The handler receives the object behind the clicked entry, not a slot number:

    record Offer(String name, Material material, int price) {}

    Gui<Offer> shop = guis.load("gui/shop-list.json");

    shop.setContents(offers, offer -> {
        ItemStack stack = new ItemStack(offer.material());
        // set name and lore on stack.getItemMeta() as you need
        return stack;
    });

    shop.onContentClick((player, offer) -> buy(player, offer));

    shop.open(player);

`setContents` throws an `IllegalStateException` if the definition has no `content` block.

## Updating the list while it is open

`setContents` replaces the list, but open inventories are not redrawn. Call `refresh()` after it, on the main thread:

    shop.setContents(newOffers, this::render);
    shop.refresh();

`refresh()` redraws the current page for every viewer who has the GUI open. A viewer stays on their page. If the page count shrank, they move to the last page.

## Page tokens

Page tokens show the current page in item names and lore, and in `message:` actions:

| Token | Value |
| --- | --- |
| `{page}` | Current page, starting at 1. |
| `{pages}` | Total number of pages, at least 1. |
| `{prevPage}` | Previous page number, never less than 1. |
| `{nextPage}` | Next page number, never more than `{pages}`. |

Example from `shop-paginated.json`: `"name": "<yellow>Previous <gray>({prevPage}/{pages})"`.

Page tokens are not available in the GUI title. The title is rendered once, when the GUI opens, before a page is shown. For the same reason, placeholders registered with `placeholderComponent` cannot use these names. See [placeholders and translations](placeholders-and-translations.md).
