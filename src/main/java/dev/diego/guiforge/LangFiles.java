package dev.diego.guiforge;

import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * A {@link Translator} that reads language files from the plugin's resources, one per language:
 * {@code <basePath>_<language>.yml}, e.g. {@code languages/messages_de.yml}.
 *
 * <p>Nested YAML keys become dotted keys: {@code shop: welcome: "..."} is looked up as {@code shop.welcome}.
 * Only string values are used. A key missing in the viewer's language falls back to the fallback language.
 * Files are read once, on first use.
 */
public final class LangFiles {

    private LangFiles() {
    }

    /**
     * Creates a translator for the plugin's language files.
     *
     * @param plugin the plugin whose resources hold the files
     * @param basePath path without language and extension, e.g. {@code "languages/messages"}
     * @param fallbackLanguage language code used when the viewer's language lacks a key, e.g. {@code "en"}
     * @return the translator, for {@link GuiManager#setTranslator(Translator)}
     */
    public static Translator load(JavaPlugin plugin, String basePath, String fallbackLanguage) {
        Map<String, Map<String, String>> tables = new ConcurrentHashMap<>();
        return (viewer, key) -> {
            String language = viewer.locale().getLanguage();
            Optional<String> hit = lookup(plugin, basePath, tables, language, key);
            if (hit.isEmpty() && !fallbackLanguage.equals(language)) {
                hit = lookup(plugin, basePath, tables, fallbackLanguage, key);
            }
            return hit;
        };
    }

    private static Optional<String> lookup(JavaPlugin plugin, String basePath,
                                           Map<String, Map<String, String>> tables, String language, String key) {
        Map<String, String> table = tables.computeIfAbsent(language,
                lang -> read(plugin, basePath + "_" + lang + ".yml"));
        return Optional.ofNullable(table.get(key));
    }

    private static Map<String, String> read(JavaPlugin plugin, String path) {
        try (InputStream in = plugin.getResource(path)) {
            if (in == null) {
                return Map.of();
            }
            YamlConfiguration yaml = YamlConfiguration.loadConfiguration(new InputStreamReader(in, StandardCharsets.UTF_8));
            Map<String, String> table = new HashMap<>();
            for (String key : yaml.getKeys(true)) {
                if (yaml.isString(key)) {
                    table.put(key, yaml.getString(key));
                }
            }
            return table;
        } catch (IOException e) {
            plugin.getLogger().warning("Could not read language file " + path + ": " + e.getMessage());
            return Map.of();
        }
    }
}
