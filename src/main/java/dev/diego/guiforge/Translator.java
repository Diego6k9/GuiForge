package dev.diego.guiforge;

import org.bukkit.entity.Player;

import java.util.Optional;

/**
 * Looks up translated text for {@code {key}} tokens in item names, lore, GUI titles and messages.
 * The plugin decides where its texts come from, e.g. a language file.
 */
@FunctionalInterface
public interface Translator {

    /**
     * Returns the MiniMessage text for a key in the given language. The text may contain {@code {token}}s of its own,
     * which are filled in like any other token. Return an empty optional for unknown keys; the token then stays visible.
     *
     * @param viewer the player the text is rendered for; its {@link Player#locale()} is the default language
     * @param key the token name without braces, e.g. {@code shop.welcome}
     * @return the MiniMessage template, or empty if the key is unknown
     */
    Optional<String> translate(Player viewer, String key);
}
