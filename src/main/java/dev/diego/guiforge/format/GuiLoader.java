package dev.diego.guiforge.format;

import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;

/**
 * Parses and validates GUI definitions (format v1).
 */
public final class GuiLoader {

    public static final int FORMAT_VERSION = 1;
    private static final Gson GSON = new Gson();

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
     * Validates a definition and normalizes defaults. Throws IllegalArgumentException on errors.
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

        int size = def.rows * 9;
        Set<String> keys = new HashSet<>();
        Set<Integer> occupied = new HashSet<>();

        for (ItemDefinition item : def.items) {
            String where = "GUI '" + def.id + "', item " + (item.key != null ? "'" + item.key + "'" : "(no key)");
            require(item.material != null && !item.material.isBlank(), where + ": 'material' is required");
            require(item.slots != null && item.slots.length > 0, where + ": 'slots' is required");
            for (int slot : item.slots) {
                require(slot >= 0 && slot < size, where + ": slot " + slot + " is out of range 0.." + (size - 1));
                require(occupied.add(slot), where + ": slot " + slot + " is used by more than one item");
            }
            if (item.key != null) {
                require(keys.add(item.key), "GUI '" + def.id + "': duplicate key '" + item.key + "'");
            }
        }

        if (def.content != null) {
            ContentDefinition c = def.content;
            require(c.slots != null && c.slots.length > 0,
                    "GUI '" + def.id + "': content.slots is required for paginated GUIs");
            for (int slot : c.slots) {
                require(slot >= 0 && slot < size, "GUI '" + def.id + "': content slot " + slot + " is out of range");
                require(!occupied.contains(slot),
                        "GUI '" + def.id + "': content slot " + slot + " overlaps a fixed item");
            }
            if (c.fill == null) {
                c.fill = "empty";
            }
            require("empty".equals(c.fill) || "filler".equals(c.fill),
                    "GUI '" + def.id + "': content.fill must be 'empty' or 'filler'");
            if ("filler".equals(c.fill)) {
                require(c.filler != null && keys.contains(c.filler),
                        "GUI '" + def.id + "': content.filler must reference an existing item key");
            }
            if (c.navOnEdge == null) {
                c.navOnEdge = "hide";
            }
            require("hide".equals(c.navOnEdge) || "keep".equals(c.navOnEdge),
                    "GUI '" + def.id + "': content.navOnEdge must be 'hide' or 'keep'");
            if (c.nav != null) {
                if (c.nav.prev != null) {
                    require(keys.contains(c.nav.prev), "GUI '" + def.id + "': nav.prev '" + c.nav.prev + "' not found");
                }
                if (c.nav.next != null) {
                    require(keys.contains(c.nav.next), "GUI '" + def.id + "': nav.next '" + c.nav.next + "' not found");
                }
            }
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalArgumentException(message);
        }
    }
}
