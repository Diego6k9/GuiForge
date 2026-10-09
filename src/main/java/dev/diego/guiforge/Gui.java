package dev.diego.guiforge;

import dev.diego.guiforge.format.ContentDefinition;
import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.ItemDefinition;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

/**
 * A GUI template loaded from a definition. Holds handlers and (for paginated GUIs) the content list.
 * Each opened inventory gets its own {@link GuiSession}, so viewers never share page state.
 *
 * @param <T> type of the paginated content objects; use {@code Object} for non-paginated GUIs
 */
public final class Gui<T> {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    record FixedItem(ItemDefinition def, ItemStack template) {}

    private final GuiManager manager;
    private final GuiDefinition definition;
    private final List<FixedItem> fixedItems = new ArrayList<>();
    private final Map<String, FixedItem> fixedByKey = new HashMap<>();
    private final Map<String, Consumer<ClickContext>> handlers = new HashMap<>();
    private List<T> contents = List.of();
    private Function<T, ItemStack> renderer;
    private BiConsumer<Player, T> contentClickHandler;

    Gui(GuiManager manager, GuiDefinition definition) {
        this.manager = manager;
        this.definition = definition;
        for (ItemDefinition item : definition.items) {
            FixedItem fixed = new FixedItem(item, buildStack(item));
            fixedItems.add(fixed);
            if (item.key != null) {
                fixedByKey.put(item.key, fixed);
            }
        }
    }

    /** Binds a click handler to the item with the given key. Fails fast on unknown keys. */
    public Gui<T> onClick(String key, Consumer<ClickContext> handler) {
        if (!fixedByKey.containsKey(key)) {
            throw new IllegalArgumentException("GUI '" + definition.id + "' has no item with key '" + key + "'");
        }
        handlers.put(key, handler);
        return this;
    }

    /** Sets the paginated content. Requires a {@code content} block in the definition. */
    public Gui<T> setContents(List<T> items, Function<T, ItemStack> renderer) {
        if (definition.content == null) {
            throw new IllegalStateException(
                    "GUI '" + definition.id + "' is not paginated (no 'content' block in its definition)");
        }
        this.contents = List.copyOf(items);
        this.renderer = renderer;
        return this;
    }

    /** Handles clicks on a content item, receiving the backing object instead of a slot number. */
    public Gui<T> onContentClick(BiConsumer<Player, T> handler) {
        this.contentClickHandler = handler;
        return this;
    }

    /** Opens this GUI for a player with fresh state (page 0). */
    public void open(Player player) {
        new GuiSession(this, manager, player).open();
    }

    public String id() {
        return definition.id;
    }

    GuiDefinition definition() {
        return definition;
    }

    List<FixedItem> fixedItems() {
        return fixedItems;
    }

    FixedItem fixedByKey(String key) {
        return fixedByKey.get(key);
    }

    boolean isPaginated() {
        return definition.content != null;
    }

    int[] contentSlots() {
        return definition.content == null || definition.content.slots == null
                ? new int[0]
                : definition.content.slots;
    }

    ContentDefinition content() {
        return definition.content;
    }

    List<T> contents() {
        return contents;
    }

    @SuppressWarnings("unchecked")
    ItemStack renderContent(Object item) {
        if (renderer == null) {
            throw new IllegalStateException("GUI '" + definition.id + "' has content but no renderer; call setContents");
        }
        return renderer.apply((T) item);
    }

    void dispatchClick(String key, ClickContext context) {
        Consumer<ClickContext> handler = handlers.get(key);
        if (handler != null) {
            handler.accept(context);
        }
    }

    @SuppressWarnings("unchecked")
    void dispatchContentClick(Player player, Object item) {
        if (contentClickHandler != null) {
            contentClickHandler.accept(player, (T) item);
        }
    }

    /** Parses MiniMessage and turns off Minecraft's default italics for names and lore. */
    public static Component text(String miniMessage) {
        return MINI.deserialize(miniMessage).decoration(TextDecoration.ITALIC, false);
    }

    static ItemStack buildStack(ItemDefinition item) {
        Material material = Material.matchMaterial(item.material);
        if (material == null) {
            throw new IllegalArgumentException("Unknown material '" + item.material + "' in item "
                    + (item.key != null ? "'" + item.key + "'" : "(no key)"));
        }
        ItemStack stack = new ItemStack(material, item.amount == null ? 1 : item.amount);
        ItemMeta meta = stack.getItemMeta();
        if (meta != null) {
            if (item.name != null) {
                meta.displayName(text(item.name));
            }
            if (item.lore != null && !item.lore.isEmpty()) {
                meta.lore(item.lore.stream().map(Gui::text).toList());
            }
            if (item.customModelData != null) {
                meta.setCustomModelData(item.customModelData);
            }
            if (item.glint != null) {
                meta.setEnchantmentGlintOverride(item.glint);
            }
            stack.setItemMeta(meta);
        }
        return stack;
    }
}
