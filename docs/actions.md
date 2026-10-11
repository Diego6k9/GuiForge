# Actions

An item can have an `action`. It runs when the player clicks the item. GuiForge handles the built-in actions itself. You can add your own prefixes from code.

    {
      "key": "back",
      "slots": [45],
      "material": "minecraft:arrow",
      "name": "<yellow>Back</yellow>",
      "locked": true,
      "action": "open:main-menu"
    }

A click runs the item's `onClick` handler first (if the item has a `key` and a handler is bound), then its `action` (if it has one).

## Built-in actions

| Action | Effect |
| --- | --- |
| `close` | Closes the inventory. |
| `next-page` | Shows the next page of a paginated GUI. Does nothing on the last page. |
| `prev-page` | Shows the previous page. Does nothing on the first page. |
| `open:<gui-id>` | Opens another GUI by its `id`. The GUI must be loaded or created first. Otherwise a warning is logged. |
| `sound:<sound-spec>` | Plays a sound for the player. See below. |
| `message:<text>` | Sends the text to the player as MiniMessage. `{token}` placeholders are filled in, see [placeholders and translations](placeholders-and-translations.md). |

Examples, based on `shop-main.json`:

    { "key": "cancel", "slots": [15], "material": "minecraft:red_dye",
      "name": "<red>Abbrechen</red>", "locked": true, "action": "close" }

    { "key": "buy", "slots": [11], "material": "minecraft:lime_dye",
      "name": "<green><bold>Kaufen</bold></green>", "locked": true,
      "action": "sound:entity.experience_orb.pickup:0.8:1.2" }

    { "key": "info", "slots": [13], "material": "minecraft:book",
      "name": "<aqua>Info</aqua>", "locked": true,
      "action": "message:<gray>Hallo {player}, klick nochmal zum Bestätigen.</gray>" }

`{player}` only gets a value if you registered it with `placeholder("player", ...)`. Otherwise it stays visible as text.

### Sound specs

The text after `sound:` has one of these forms:

| Form | Example | Meaning |
| --- | --- | --- |
| `name` | `sound:entity.experience_orb.pickup` | `minecraft:` namespace, volume 1, pitch 1. |
| `name:volume:pitch` | `sound:entity.experience_orb.pickup:0.8:1.2` | Volume and pitch are set. |
| `namespace:name:volume:pitch` | `sound:mypack:ding:1:1` | A sound from another namespace. |

Pitch is clamped to 0.5 to 2. Volume is at least 0. The key must be lowercase and may use letters, digits, `_`, `.`, `-` and `/`. An invalid spec is not played, and a warning is logged.

## Custom actions

Register a prefix on the `GuiManager`. The prefix must end with `:`. The handler receives the player and the text after the prefix:

    guis.registerAction("teleport:", (player, target) -> {
        // for "teleport:spawn" the target is "spawn"
        teleports.to(player, target);
    });

Use it in a definition:

    { "key": "spawn", "slots": [4], "material": "minecraft:ender_pearl",
      "name": "<light_purple>Spawn</light_purple>", "locked": true, "action": "teleport:spawn" }

`open:`, `sound:` and `message:` are built in. Registering one of them throws an `IllegalArgumentException`. An action that matches neither a built-in nor a registered prefix is logged as unknown.

## Click handlers or actions

Use an `action` when the definition alone can describe the behaviour, such as closing, navigating or playing a sound. Use `onClick` when the click needs code, such as charging money:

    shop.onClick("buy", ctx -> {
        if (economy.withdraw(ctx.player(), 100)) {
            ctx.player().getInventory().addItem(new ItemStack(Material.DIAMOND));
        }
    });

`ClickContext` is a record with `player()`, `event()` (the Bukkit `InventoryClickEvent`), `key()` and `page()`. `page()` is 0-based and is 0 for GUIs that are not paginated.

## Locked items

Items are locked by default. Nothing can be taken out of the GUI or moved. Set `"locked": false` on an item to allow taking it. Use that only for items the player should be able to take, such as slots for input.
