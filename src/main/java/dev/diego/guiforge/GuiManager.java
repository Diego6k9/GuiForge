package dev.diego.guiforge;

import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.GuiLoader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.logging.Logger;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Entry point of GuiForge. Create one per plugin, load GUIs from resources, and open them.
 */
public final class GuiManager {

    private final JavaPlugin plugin;
    private final Map<String, Gui<?>> guis = new HashMap<>();

    public GuiManager(JavaPlugin plugin) {
        this.plugin = plugin;
        plugin.getServer().getPluginManager().registerEvents(new ClickListener(), plugin);
    }

    /** Loads a GUI definition from a plugin resource, e.g. {@code "gui/shop-main.json"}. */
    public <T> Gui<T> load(String resourcePath) throws IOException {
        return create(GuiLoader.loadResource(plugin.getClass().getClassLoader(), resourcePath));
    }

    /** Creates a GUI from a parsed definition and registers it under its id (for {@code open:<id>}). */
    public <T> Gui<T> create(GuiDefinition definition) {
        GuiLoader.validate(definition);
        Gui<T> gui = new Gui<>(this, definition);
        guis.put(definition.id, gui);
        return gui;
    }

    public Optional<Gui<?>> find(String id) {
        return Optional.ofNullable(guis.get(id));
    }

    /** Opens a registered GUI by id. Logs a warning and does nothing if the id is unknown. */
    public void open(Player player, String id) {
        Gui<?> gui = guis.get(id);
        if (gui == null) {
            logger().warning("Cannot open GUI '" + id + "': not registered");
            return;
        }
        gui.open(player);
    }

    Logger logger() {
        return plugin.getLogger();
    }

    private static final class ClickListener implements Listener {

        @EventHandler(priority = EventPriority.LOW, ignoreCancelled = false)
        void onClick(InventoryClickEvent event) {
            if (!(event.getView().getTopInventory().getHolder() instanceof GuiSession session)) {
                return;
            }
            // Default: nothing can be taken out or moved. Only explicitly unlocked fixed items pass.
            event.setCancelled(true);
            if (event.getClickedInventory() == null
                    || !event.getClickedInventory().equals(event.getView().getTopInventory())) {
                return;
            }
            if (session.isUnlocked(event.getSlot())) {
                event.setCancelled(false);
            }
            session.handleClick(event);
        }

        @EventHandler(priority = EventPriority.LOW, ignoreCancelled = false)
        void onDrag(InventoryDragEvent event) {
            if (event.getView().getTopInventory().getHolder() instanceof GuiSession) {
                event.setCancelled(true);
            }
        }
    }
}
