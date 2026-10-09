package dev.diego.guiforge;

import org.bukkit.entity.Player;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.BiConsumer;

/** Custom action prefixes registered by plugins. Built-in actions are handled by GuiSession. */
final class ActionRegistry {

    /** Prefixes the runtime handles itself; plugins cannot register them. */
    static final Set<String> BUILT_IN_PREFIXES = Set.of("open:", "sound:", "message:");

    private final Map<String, BiConsumer<Player, String>> handlers = new LinkedHashMap<>();

    void register(String prefix, BiConsumer<Player, String> handler) {
        Objects.requireNonNull(prefix, "prefix");
        Objects.requireNonNull(handler, "handler");
        if (!prefix.endsWith(":") || BUILT_IN_PREFIXES.contains(prefix)) {
            throw new IllegalArgumentException("Action prefix must end with ':' and must not be built-in: " + prefix);
        }
        handlers.put(prefix, handler);
    }

    /** Runs the handler whose prefix matches. Returns false if none does. */
    boolean run(String action, Player player) {
        for (Map.Entry<String, BiConsumer<Player, String>> entry : handlers.entrySet()) {
            if (action.startsWith(entry.getKey())) {
                entry.getValue().accept(player, action.substring(entry.getKey().length()));
                return true;
            }
        }
        return false;
    }
}
