package dev.diego.guiforge;

import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.GuiLoader;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.*;
import java.util.function.BiConsumer;
import java.util.logging.Logger;

/**
 * Entry point of GuiForge. Create one per plugin, load GUIs from resources, and open them.
 */
public final class GuiManager {

    /**
     * Plugins that already have a manager. Weak, so unloaded plugins do not stay referenced.
     */
    private static final Set<JavaPlugin> ACTIVE = Collections.newSetFromMap(new WeakHashMap<>());

    private final JavaPlugin plugin;
    private final Map<String, Gui<?>> guis = new HashMap<>();
    private final ActionRegistry actions = new ActionRegistry();
    private volatile Translator translator;

    /**
     * Creates the manager for a plugin. Create exactly one per plugin and reuse it: a second manager would
     * register a second click listener, and every click would then be handled twice.
     *
     * @param plugin the plugin that owns the GUIs; its class loader is used to find layout resources
     * @throws IllegalStateException if the plugin already has a manager
     */
    public GuiManager(JavaPlugin plugin) {
        if (!ACTIVE.add(plugin)) {
            throw new IllegalStateException("A GuiManager already exists for plugin '" + plugin.getName()
                    + "'. Create one per plugin and reuse it.");
        }
        this.plugin = plugin;
        plugin.getServer().getPluginManager().registerEvents(new ClickListener(), plugin);
    }

    /**
     * Loads a GUI definition from a plugin resource, e.g. {@code "gui/shop-main.json"}, and registers it under its id.
     *
     * @param <T> type of the paginated content objects; {@code Object} for non-paginated GUIs
     * @param resourcePath path of the layout inside the plugin's resources
     * @return the loaded GUI
     * @throws UncheckedIOException if the resource is missing or cannot be read
     * @throws IllegalArgumentException if the layout is invalid
     */
    public <T> Gui<T> load(String resourcePath) {
        try {
            return create(GuiLoader.loadResource(plugin.getClass().getClassLoader(), resourcePath));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    /**
     * Creates a GUI from a parsed definition and registers it under its id (for {@code open:<id>}).
     *
     * @param <T> type of the paginated content objects; {@code Object} for non-paginated GUIs
     * @param definition a parsed layout, e.g. from {@link GuiLoader#parse(String)}
     * @return the GUI
     * @throws IllegalArgumentException if the layout is invalid
     */
    public <T> Gui<T> create(GuiDefinition definition) {
        GuiLoader.validate(definition);
        Gui<T> gui = new Gui<>(this, definition);
        guis.put(definition.id, gui);
        return gui;
    }

    /**
     * Returns the GUI registered under this id, if any.
     *
     * @param id the id from the layout
     * @return the GUI, or empty if no GUI has this id
     */
    public Optional<Gui<?>> find(String id) {
        return Optional.ofNullable(guis.get(id));
    }

    /**
     * Opens a registered GUI by id. Logs a warning and does nothing if the id is unknown.
     *
     * @param player the viewer
     * @param id the id of a registered GUI
     */
    public void open(Player player, String id) {
        Gui<?> gui = guis.get(id);
        if (gui == null) {
            logger().warning("Cannot open GUI '" + id + "': not registered");
            return;
        }
        gui.open(player);
    }

    /**
     * Registers an action for JSON strings that start with {@code prefix}, e.g. {@code "shop:"} for
     * {@code "shop:buy"}. The handler receives the text after the prefix.
     *
     * @param prefix the prefix, ending with ':'; built-in prefixes cannot be used
     * @param handler receives the player and the text after the prefix
     * @throws IllegalArgumentException if the prefix does not end with ':' or is built-in
     */
    public void registerAction(String prefix, BiConsumer<Player, String> handler) {
        actions.register(prefix, handler);
    }

    /**
     * Sets where {@code {key}} tokens without a registered placeholder get their text from, e.g. a language file.
     * The translator is asked with the viewer's language on every render. Pass {@code null} to remove it.
     *
     * @param translator the translator, or null
     */
    public void setTranslator(Translator translator) {
        this.translator = translator;
    }

    Translator translator() {
        return translator;
    }

    boolean runCustomAction(String action, Player player) {
        return actions.run(action, player);
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
            // A double click fires an extra click event. Ignore it so one click means one action,
            // e.g. one page turn or one purchase.
            if (event.getClick() == ClickType.DOUBLE_CLICK) {
                return;
            }
            if (event.getClickedInventory() == null
                    || !event.getClickedInventory().equals(event.getView().getTopInventory())) {
                return;
            }
            if (session.isUnlocked(event.getSlot())) {
                event.setCancelled(false);
            }
            session.handleClick(event);
        }

        @EventHandler(priority = EventPriority.MONITOR)
        void onClose(InventoryCloseEvent event) {
            if (event.getInventory().getHolder() instanceof GuiSession session) {
                session.handleClose();
            }
        }

        @EventHandler(priority = EventPriority.LOW, ignoreCancelled = false)
        void onDrag(InventoryDragEvent event) {
            if (event.getView().getTopInventory().getHolder() instanceof GuiSession) {
                event.setCancelled(true);
            }
        }
    }
}
