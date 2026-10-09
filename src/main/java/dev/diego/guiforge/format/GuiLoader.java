package dev.diego.guiforge.format;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonSyntaxException;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Parses and validates GUI definitions (format v1). Pure Java, no server needed.
 */
public final class GuiLoader {

    public static final int FORMAT_VERSION = 1;
    private static final Gson GSON = new Gson();
    private static final Set<String> PATTERNS = Set.of("border", "empty");

    private GuiLoader() {
    }

    public static GuiDefinition parse(Reader reader) {
        GuiDefinition def;
        try {
            def = GSON.fromJson(reader, GuiDefinition.class);
        } catch (JsonSyntaxException e) {
            throw new IllegalArgumentException("Invalid GUI JSON: " + e.getMessage(), e);
        }
        if (def == null) {
            throw new IllegalArgumentException("Empty GUI definition");
        }
        validate(def);
        return def;
    }

    public static GuiDefinition parse(String json) {
        return parse(new StringReader(json));
    }

    public static GuiDefinition loadResource(ClassLoader loader, String path) throws IOException {
        try (InputStream in = loader.getResourceAsStream(path)) {
            if (in == null) {
                throw new IOException("GUI resource not found: " + path);
            }
            return parse(new InputStreamReader(in, StandardCharsets.UTF_8));
        }
    }

    /**
     * Validates a definition, applies defaults and resolves slot patterns into {@code resolvedSlots}.
     * Throws IllegalArgumentException with a readable message on any error.
     *
     * <p>Slot rules: explicit arrays always win. Pattern items ("border", "empty") only take slots
     * that are still free and are not content slots, in the order they are defined.
     */
    public static void validate(GuiDefinition def) {
        require(def.formatVersion == FORMAT_VERSION,
                "unsupported formatVersion " + def.formatVersion + " (expected " + FORMAT_VERSION + ")");
        require(def.id != null && !def.id.isBlank(), "GUI 'id' is required");
        if (def.type == null) {
            def.type = "chest";
        }
        require("chest".equals(def.type), "GUI '" + def.id + "': type must be 'chest' in format v1");
        require(def.rows >= 1 && def.rows <= 6, "GUI '" + def.id + "': rows must be between 1 and 6");
        if (def.items == null) {
            def.items = new ArrayList<>();
        }

        String gui = "GUI '" + def.id + "'";
        int size = def.rows * 9;
        Set<String> keys = new HashSet<>();
        Set<Integer> taken = new HashSet<>();

        // Pass 1: explicit slot lists, keys, and pattern names.
        for (ItemDefinition item : def.items) {
            String where = gui + ", item " + describe(item);
            require(item.material != null && !item.material.isBlank(), where + ": 'material' is required");
            require(item.slots != null, where + ": 'slots' is required");
            if (item.skin != null) {
                require("minecraft:player_head".equals(item.material) || "player_head".equals(item.material),
                        where + ": 'skin' is only allowed for minecraft:player_head");
                try {
                    SkinTexture.hashOf(item.skin);
                } catch (IllegalArgumentException e) {
                    throw new IllegalArgumentException(where + ": " + e.getMessage(), e);
                }
            }
            if (item.key != null) {
                require(keys.add(item.key), gui + ": duplicate key '" + item.key + "'");
            }
            if (item.slots.isJsonArray()) {
                int[] explicit = readSlots(item.slots, where);
                for (int slot : explicit) {
                    require(slot >= 0 && slot < size, where + ": slot " + slot + " is out of range 0.." + (size - 1));
                    require(taken.add(slot), where + ": slot " + slot + " is used by more than one item");
                }
                item.resolvedSlots = explicit;
            } else {
                require(isPattern(item.slots),
                        where + ": 'slots' must be an array of integers or one of " + PATTERNS);
            }
        }

        // Content area checks.
        Set<Integer> contentSlots = new HashSet<>();
        if (def.content != null) {
            ContentDefinition c = def.content;
            require(c.slots != null && c.slots.length > 0,
                    gui + ": content.slots is required for paginated GUIs");
            for (int slot : c.slots) {
                require(slot >= 0 && slot < size, gui + ": content slot " + slot + " is out of range");
                require(!taken.contains(slot), gui + ": content slot " + slot + " overlaps a fixed item");
                contentSlots.add(slot);
            }
            if (c.fill == null) {
                c.fill = "empty";
            }
            require("empty".equals(c.fill) || "filler".equals(c.fill),
                    gui + ": content.fill must be 'empty' or 'filler'");
            if ("filler".equals(c.fill)) {
                require(c.filler != null && keys.contains(c.filler),
                        gui + ": content.fill 'filler' needs content.filler to reference an existing item key");
            }
            if (c.filler != null) {
                require(keys.contains(c.filler), gui + ": content.filler '" + c.filler + "' not found");
            }
            if (c.navOnEdge == null) {
                c.navOnEdge = "hide";
            }
            require("hide".equals(c.navOnEdge) || "keep".equals(c.navOnEdge),
                    gui + ": content.navOnEdge must be 'hide' or 'keep'");
            if (c.nav != null) {
                if (c.nav.prev != null) {
                    require(keys.contains(c.nav.prev), gui + ": nav.prev '" + c.nav.prev + "' not found");
                }
                if (c.nav.next != null) {
                    require(keys.contains(c.nav.next), gui + ": nav.next '" + c.nav.next + "' not found");
                }
            }
        }

        // Pass 2: pattern items take only the slots that are still free, in definition order.
        for (ItemDefinition item : def.items) {
            if (item.slots.isJsonArray()) {
                continue;
            }
            Set<Integer> candidates = "border".equals(item.slots.getAsString()) ? border(def.rows) : all(size);
            List<Integer> free = new ArrayList<>();
            for (int slot : candidates) {
                if (!taken.contains(slot) && !contentSlots.contains(slot)) {
                    free.add(slot);
                }
            }
            item.resolvedSlots = free.stream().mapToInt(Integer::intValue).toArray();
            taken.addAll(free);
        }
    }

    private static int[] readSlots(JsonElement array, String where) {
        List<Integer> out = new ArrayList<>();
        for (JsonElement element : array.getAsJsonArray()) {
            require(element.isJsonPrimitive() && element.getAsJsonPrimitive().isNumber(),
                    where + ": 'slots' entries must be integers");
            out.add(element.getAsInt());
        }
        require(!out.isEmpty(), where + ": 'slots' must not be empty");
        return out.stream().mapToInt(Integer::intValue).toArray();
    }

    private static boolean isPattern(JsonElement element) {
        return element.isJsonPrimitive()
                && element.getAsJsonPrimitive().isString()
                && PATTERNS.contains(element.getAsString());
    }

    private static Set<Integer> border(int rows) {
        Set<Integer> out = new TreeSet<>();
        for (int row = 0; row < rows; row++) {
            for (int col = 0; col < 9; col++) {
                if (row == 0 || row == rows - 1 || col == 0 || col == 8) {
                    out.add(row * 9 + col);
                }
            }
        }
        return out;
    }

    private static Set<Integer> all(int size) {
        Set<Integer> out = new TreeSet<>();
        for (int slot = 0; slot < size; slot++) {
            out.add(slot);
        }
        return out;
    }

    private static String describe(ItemDefinition item) {
        return item.key != null ? "'" + item.key + "'" : "(no key)";
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }
}
