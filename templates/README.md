# Templates

Ready-to-use GuiForge layouts, one JSON file each. Copy a file into your plugin's `src/main/resources/gui/` folder,
then load and bind it in Java:

    Gui<Object> shop = guis.load("gui/shop-paginated.json");
    shop.setContents(items, item -> ...);
    shop.onContentClick((player, item) -> ...);

| File                   | Layout                                   | Keys to bind in Java                                  |
|------------------------|------------------------------------------|-------------------------------------------------------|
| `shop-paginated.json`  | Paginated shop, 14 items per page         | `setContents`, `onContentClick`                       |
| `confirm-dialog.json`  | Yes/no dialog                            | `confirm` (onClick)                                   |
| `category-menu.json`   | Four categories plus close               | `cat-weapons`, `cat-food`, `cat-tools`, `cat-blocks`  |
| `admin-toggles.json`   | Three toggles, set state with `itemFor`  | `toggle-pvp`, `toggle-flight`, `toggle-chat`          |
| `auction-listing.json` | Paginated list, 28 items per page        | `setContents`, `onContentClick`                       |

The templates only define the layout. Behaviour (what a click does, what a toggle shows) is up to your plugin.
