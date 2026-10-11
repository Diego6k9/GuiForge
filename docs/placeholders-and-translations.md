# Placeholders and translations

GuiForge replaces `{token}` markers in item names, lore, GUI titles, and `message:` actions. A token is `{name}`, where `name` uses letters, digits, `_`, `-` and `.`.

## Placeholders

Register a value with a function that receives the viewing player:

    shop.placeholder("player", Player::getName);
    shop.placeholder("balance", p -> economy.format(economy.getBalance(p)));

`placeholder` inserts plain text. The value is a text component, so a player name like `<red>` is shown literally and cannot change the formatting.

Placeholders are filled in for each viewer, every time the GUI renders. For a whole item that depends on the player, use `itemFor` instead.

Unknown tokens are left as they are. A missing value stays visible in-game (for example `{balance}`), which makes typos easy to spot.

Placeholders apply to names, lore, titles, and `message:` actions.

### Coloured values

`placeholderComponent` inserts an Adventure `Component`, so the value keeps its colours. Only use it with trusted content, because it is not escaped:

    shop.placeholderComponent("rank", p -> MiniMessage.miniMessage().deserialize(rankOf(p).coloredPrefix()));

The names of the page tokens (`page`, `pages`, `prevPage`, `nextPage`) are reserved. `placeholder` and `placeholderComponent` reject them with an `IllegalArgumentException`.

## Translations

Translations let a GUI use texts from language files. A token that is not a placeholder is looked up as a translation key.

Language files are YAML, one per language, under `src/main/resources/`. The name is `<base>_<language>.yml`, where the language is the two-letter code, such as `de` or `en`, not the region:

    # languages/messages_en.yml
    test:
      name: "<yellow>Hello</yellow> <red>{player}</red>"
      nested: "<green>Nested: {test.name}</green>"

Nested keys are flattened to dotted keys, so the first key above is `test.name`.

Register the translator once, for example in `onEnable`:

    guis.setTranslator(LangFiles.load(this, "languages/messages", "en"));

`LangFiles.load` takes the base path (without language and extension) and the fallback language. The language comes from the viewer's client language (`Player.locale()`). If a key is missing in that language, the fallback language is used. Files are read once, on first use.

Then reference the key in a layout. Keys can be used in names, lore, and titles:

    { "key": "name", "slots": [11], "material": "minecraft:name_tag", "name": "{test.name}", "locked": true }

### Custom translator

`setTranslator` takes any `Translator`. It receives the viewer and the key and returns an `Optional<String>`. Return `Optional.empty()` for an unknown key, and the token then stays visible:

    guis.setTranslator((player, key) ->
            Optional.ofNullable(myLanguageStore.lookup(player.getUniqueId(), key)));

The translator is asked on every render, so keep it fast. `LangFiles` only reads the files once, but any other translator should cache what it can.

### Resolution order

For each render, GuiForge does the following:

1. Every `{token}` that is not a placeholder or page token is looked up in the translator. The text found is inserted as MiniMessage, and the lookup is repeated for new tokens in it. This runs for at most five rounds.
2. The remaining tokens are filled in: placeholders first, then page tokens.
3. Tokens that are still unknown stay as they are.

This means a translation can use `{player}`, because placeholders are filled in last. A placeholder value is never parsed as MiniMessage, so a player cannot inject formatting through it.

### Cycles

Translations that refer to each other (`a` contains `{b}`, `b` contains `{a}`) are not detected. The expansion stops after five rounds, so the text shows the cycle a few times. Avoid cyclic keys.
