package dev.diego.guiforge;

import com.destroystokyo.paper.profile.PlayerProfile;
import com.destroystokyo.paper.profile.ProfileProperty;
import dev.diego.guiforge.format.ContentDefinition;
import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.ItemDefinition;
import dev.diego.guiforge.format.SkinTexture;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.format.TextDecoration;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.inventory.meta.SkullMeta;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A GUI template loaded from a definition. Holds handlers, placeholders and (for paginated GUIs) the content.
 * Each opened inventory gets its own {@link GuiSession}, so viewers never share page state.
 *
 * @param <T> type of the paginated content objects; use {@code Object} for non-paginated GUIs
 */
public final class Gui<T> {

    private static final MiniMessage MINI = MiniMessage.miniMessage();
    private static final Pattern TOKEN = Pattern.compile("\\{([A-Za-z0-9_.\\-]+)\\}");
    private final GuiManager manager;
    private final GuiDefinition definition;
    private final List<FixedItem> fixedItems = new ArrayList<>();
    private final Map<String, FixedItem> fixedByKey = new HashMap<>();
    private final Map<String, Consumer<ClickContext>> handlers = new HashMap<>();
    private final Map<String, Function<Player, ItemStack>> itemRenderers = new HashMap<>();
    private final Map<String, Function<Player, String>> placeholders = new HashMap<>();
    private final List<Consumer<Player>> openHandlers = new ArrayList<>();
    private final List<Consumer<Player>> closeHandlers = new ArrayList<>();
    private final Set<GuiSession> openSessions = new HashSet<>();
    private List<T> contents = List.of();
    private Function<T, ItemStack> renderer;
    private BiConsumer<Player, T> contentClickHandler;
    Gui(GuiManager manager, GuiDefinition definition) {
        this.manager = manager;
        this.definition = definition;
        for (ItemDefinition item : definition.items) {
            FixedItem fixed = new FixedItem(item, buildStack(item, null, Map.of()));
            fixedItems.add(fixed);
            if (item.key != null) {
                fixedByKey.put(item.key, fixed);
            }
        }
    }

    /**
     * Converts MiniMessage to a component, with Minecraft's default italics turned off.
     *
     * @param miniMessage the MiniMessage text
     * @return the component
     */
    public static Component text(String miniMessage) {
        return MINI.deserialize(miniMessage).decoration(TextDecoration.ITALIC, false);
    }

    private static boolean hasTokens(ItemDefinition def) {
        if (def.name != null && TOKEN.matcher(def.name).find()) {
            return true;
        }
        return def.lore != null && def.lore.stream().anyMatch(line -> TOKEN.matcher(line).find());
    }

    /**
     * Builds a profile that only carries the texture URL, so no session-server lookup happens.
     * The UUID comes from the hash, so equal skins produce equal profiles and stack together.
     */
    private static com.destroystokyo.paper.profile.PlayerProfile skinProfile(String skin) {
        String hash = SkinTexture.hashOf(skin);
        // Paper's SkullMeta takes its own PlayerProfile type; Bukkit.createProfile hands back the Paper
        // implementation, so the cast only narrows the static type.
        PlayerProfile profile = Bukkit.createProfile(UUID.nameUUIDFromBytes(hash.getBytes(StandardCharsets.UTF_8)), null);
        // Write the vanilla "textures" property ourselves. Without it Paper completes the profile from the
        // UUID, which yields a random default skin instead of the requested one.
        String json = "{\"textures\":{\"SKIN\":{\"url\":\"" + SkinTexture.urlOf(hash) + "\"}}}";
        String value = Base64.getEncoder().encodeToString(json.getBytes(StandardCharsets.UTF_8));
        profile.setProperty(new ProfileProperty("textures", value));
        return profile;
    }

    /**
     * Binds a click handler to the fixed item with the given key. Fails fast on unknown keys.
     *
     * @param key the key of a fixed item in the layout
     * @param handler called on each click on that item
     * @return this GUI, for chaining
     * @throws IllegalArgumentException if the layout has no item with this key
     */
    public Gui<T> onClick(String key, Consumer<ClickContext> handler) {
        requireKey(key);
        handlers.put(key, handler);
        return this;
    }

    /**
     * Replaces the item with the given key with whatever the renderer returns, computed per viewer on each render.
     * Use it for items whose content depends on the player, such as balance, rank or owned state.
     *
     * @param key the key of a fixed item in the layout
     * @param renderer computes the item for a viewer
     * @return this GUI, for chaining
     * @throws IllegalArgumentException if the layout has no item with this key
     */
    public Gui<T> itemFor(String key, Function<Player, ItemStack> renderer) {
        requireKey(key);
        itemRenderers.put(key, Objects.requireNonNull(renderer, "renderer"));
        return this;
    }

    /**
     * Registers a value for {@code {token}} in item names, lore and the GUI title. The value is inserted as plain text,
     * so player input cannot inject MiniMessage tags. Unknown tokens are left as they are.
     *
     * @param token the name without braces, e.g. {@code balance} for {@code {balance}}
     * @param value computes the text for a viewer
     * @return this GUI, for chaining
     */
    public Gui<T> placeholder(String token, Function<Player, String> value) {
        if (PageTokens.NAMES.contains(token)) {
            throw new IllegalArgumentException("'" + token + "' is a built-in page token and cannot be a custom placeholder");
        }
        placeholders.put(token, Objects.requireNonNull(value, "value"));
        return this;
    }

    /**
     * Sets the paginated content. Requires a {@code content} block in the definition.
     *
     * @param items the objects to show, one per content slot; the list is copied
     * @param renderer turns one object into the item shown in its slot
     * @return this GUI, for chaining
     * @throws IllegalStateException if the GUI is not paginated
     */
    public Gui<T> setContents(List<T> items, Function<T, ItemStack> renderer) {
        if (definition.content == null) {
            throw new IllegalStateException(
                    "GUI '" + definition.id + "' is not paginated (no 'content' block in its definition)");
        }
        this.contents = List.copyOf(items);
        this.renderer = renderer;
        return this;
    }

    /**
     * Handles clicks on a content item. The handler receives the backing object instead of a slot number.
     *
     * @param handler receives the viewer and the clicked object
     * @return this GUI, for chaining
     */
    public Gui<T> onContentClick(BiConsumer<Player, T> handler) {
        this.contentClickHandler = handler;
        return this;
    }

    /**
     * Runs when a viewer opens this GUI. Several handlers can be added.
     *
     * @param handler receives the viewer
     * @return this GUI, for chaining
     */
    public Gui<T> onOpen(Consumer<Player> handler) {
        openHandlers.add(Objects.requireNonNull(handler, "handler"));
        return this;
    }

    /**
     * Runs when a viewer closes this GUI, also when it is replaced by another GUI or the player leaves.
     * Several handlers can be added.
     *
     * @param handler receives the viewer
     * @return this GUI, for chaining
     */
    public Gui<T> onClose(Consumer<Player> handler) {
        closeHandlers.add(Objects.requireNonNull(handler, "handler"));
        return this;
    }

    /**
     * A copy of the fixed item with this key, as the layout defines it. Placeholders are not filled in;
     * use {@link #itemFor} for per-player content.
     *
     * @param key the key of a fixed item in the layout
     * @return a copy of the item, or empty if the GUI has no fixed item with this key
     */
    public Optional<ItemStack> item(String key) {
        FixedItem fixed = fixedByKey.get(key);
        return fixed == null ? Optional.empty() : Optional.of(fixed.template().clone());
    }

    /**
     * Re-renders the items for every viewer who has this GUI open. Call it on the main thread.
     */
    public void refresh() {
        for (GuiSession session : List.copyOf(openSessions)) {
            session.refresh();
        }
    }

    /**
     * Opens this GUI for a player with fresh state (page 0).
     *
     * @param player the viewer
     */
    public void open(Player player) {
        new GuiSession(this, manager, player).open();
    }

    /**
     * The id from the layout. Used by {@code open:<id>} actions and by {@link GuiManager#open}.
     *
     * @return the id
     */
    public String id() {
        return definition.id;
    }

    void dispatchOpen(Player player) {
        for (Consumer<Player> handler : openHandlers) {
            handler.accept(player);
        }
    }

    void dispatchClose(Player player) {
        for (Consumer<Player> handler : closeHandlers) {
            handler.accept(player);
        }
    }

    void track(GuiSession session) {
        openSessions.add(session);
    }

    void untrack(GuiSession session) {
        openSessions.remove(session);
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

    /**
     * The stack a viewer sees for a fixed item: custom renderer, then placeholders, then the cached template.
     */
    ItemStack stackFor(FixedItem fixed, Player viewer, Map<String, String> pageTokens) {
        ItemDefinition def = fixed.def();
        if (def.key != null) {
            Function<Player, ItemStack> custom = itemRenderers.get(def.key);
            if (custom != null) {
                return custom.apply(viewer);
            }
        }
        if (viewer == null || !hasTokens(def)) {
            return fixed.template().clone();
        }
        return buildStack(def, viewer, pageTokens);
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

    private void requireKey(String key) {
        if (!fixedByKey.containsKey(key)) {
            throw new IllegalArgumentException("GUI '" + definition.id + "' has no item with key '" + key + "'");
        }
    }

    private ItemStack buildStack(ItemDefinition item, Player viewer, Map<String, String> pageTokens) {
        Material material = Material.matchMaterial(item.material);
        if (material == null) {
            throw new IllegalArgumentException("Unknown material '" + item.material + "' in item "
                    + (item.key != null ? "'" + item.key + "'" : "(no key)"));
        }
        ItemStack stack = new ItemStack(material, item.amount == null ? 1 : item.amount);
        ItemMeta meta = stack.getItemMeta();
        if (meta != null) {
            if (item.name != null) {
                meta.displayName(text(resolve(item.name, viewer, pageTokens)));
            }
            if (item.lore != null && !item.lore.isEmpty()) {
                meta.lore(item.lore.stream().map(line -> text(resolve(line, viewer, pageTokens))).toList());
            }
            if (item.customModelData != null) {
                meta.setCustomModelData(item.customModelData);
            }
            if (item.glint != null) {
                meta.setEnchantmentGlintOverride(item.glint);
            }
            if (item.hideTooltip != null) {
                meta.setHideTooltip(item.hideTooltip);
            }
            // Menus should not show combat stats of weapons or armor unless the format asks for them.
            if (item.hideAttributes == null || item.hideAttributes) {
                meta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
            }
            if (item.skin != null && meta instanceof SkullMeta skull) {
                skull.setPlayerProfile(skinProfile(item.skin));
            }
            stack.setItemMeta(meta);
        }
        return stack;
    }

    /**
     * Fills {token}s with the values of this viewer. Also used for the GUI title, which has no page tokens.
     */
    String resolve(String template, Player viewer) {
        return resolve(template, viewer, Map.of());
    }

    /**
     * Fills {token}s with the values of this viewer and the current page. Page tokens win over custom placeholders.
     */
    String resolve(String template, Player viewer, Map<String, String> pageTokens) {
        if (viewer == null || (placeholders.isEmpty() && pageTokens.isEmpty())) {
            return template;
        }
        Matcher matcher = TOKEN.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String name = matcher.group(1);
            String replacement;
            if (pageTokens.containsKey(name)) {
                replacement = MINI.escapeTags(pageTokens.get(name));
            } else {
                Function<Player, String> value = placeholders.get(name);
                replacement = value == null
                        ? matcher.group(0)
                        : MINI.escapeTags(Objects.toString(value.apply(viewer), ""));
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    record FixedItem(ItemDefinition def, ItemStack template) {
    }
}
