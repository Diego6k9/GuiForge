package dev.diego.guiforge;

import com.destroystokyo.paper.profile.PlayerProfile;
import dev.diego.guiforge.format.ContentDefinition;
import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.ItemDefinition;
import com.destroystokyo.paper.profile.ProfileProperty;
import dev.diego.guiforge.format.SkinTexture;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

/**
 * A GUI template loaded from a definition. Holds handlers, placeholders and (for paginated GUIs) the content.
 * Each opened inventory gets its own {@link GuiSession}, so viewers never share page state.
 *
 * @param <T> type of the paginated content objects; use {@code Object} for non-paginated GUIs
 */
public final class Gui<T> {

    private static final MiniMessage MINI = MiniMessage.miniMessage();
    private static final Pattern TOKEN = Pattern.compile("\\{([A-Za-z0-9_.\\-]+)\\}");

    record FixedItem(ItemDefinition def, ItemStack template) {}

    private final GuiManager manager;
    private final GuiDefinition definition;
    private final List<FixedItem> fixedItems = new ArrayList<>();
    private final Map<String, FixedItem> fixedByKey = new HashMap<>();
    private final Map<String, Consumer<ClickContext>> handlers = new HashMap<>();
    private final Map<String, Function<Player, ItemStack>> itemRenderers = new HashMap<>();
    private final Map<String, Function<Player, String>> placeholders = new HashMap<>();
    private List<T> contents = List.of();
    private Function<T, ItemStack> renderer;
    private BiConsumer<Player, T> contentClickHandler;

    Gui(GuiManager manager, GuiDefinition definition) {
        this.manager = manager;
        this.definition = definition;
        for (ItemDefinition item : definition.items) {
            FixedItem fixed = new FixedItem(item, buildStack(item, null));
            fixedItems.add(fixed);
            if (item.key != null) {
                fixedByKey.put(item.key, fixed);
            }
        }
    }

    /** Binds a click handler to the item with the given key. Fails fast on unknown keys. */
    public Gui<T> onClick(String key, Consumer<ClickContext> handler) {
        requireKey(key);
        handlers.put(key, handler);
        return this;
    }

    /**
     * Replaces the item with the given key with whatever this returns, computed per viewer on each render.
     * Use it for items whose content depends on the player (balance, rank, owned state, ...).
     */
    public Gui<T> itemFor(String key, Function<Player, ItemStack> renderer) {
        requireKey(key);
        itemRenderers.put(key, Objects.requireNonNull(renderer, "renderer"));
        return this;
    }

    /**
     * Registers a value for {@code {token}} in item names and lore. The value is inserted as plain text,
     * so player input cannot inject MiniMessage tags. Unknown tokens are left as they are.
     */
    public Gui<T> placeholder(String token, Function<Player, String> value) {
        placeholders.put(token, Objects.requireNonNull(value, "value"));
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

    /** Converts MiniMessage to a component without Minecraft's default italics for names and lore. */
    public static Component text(String miniMessage) {
        return MINI.deserialize(miniMessage).decoration(TextDecoration.ITALIC, false);
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

    /** The stack a viewer sees for a fixed item: custom renderer, then placeholders, then the cached template. */
    ItemStack stackFor(FixedItem fixed, Player viewer) {
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
        return buildStack(def, viewer);
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

    private static boolean hasTokens(ItemDefinition def) {
        if (def.name != null && TOKEN.matcher(def.name).find()) {
            return true;
        }
        return def.lore != null && def.lore.stream().anyMatch(line -> TOKEN.matcher(line).find());
    }

    private ItemStack buildStack(ItemDefinition item, Player viewer) {
        Material material = Material.matchMaterial(item.material);
        if (material == null) {
            throw new IllegalArgumentException("Unknown material '" + item.material + "' in item "
                    + (item.key != null ? "'" + item.key + "'" : "(no key)"));
        }
        ItemStack stack = new ItemStack(material, item.amount == null ? 1 : item.amount);
        ItemMeta meta = stack.getItemMeta();
        if (meta != null) {
            if (item.name != null) {
                meta.displayName(text(resolve(item.name, viewer)));
            }
            if (item.lore != null && !item.lore.isEmpty()) {
                meta.lore(item.lore.stream().map(line -> text(resolve(line, viewer))).toList());
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

    private String resolve(String template, Player viewer) {
        if (viewer == null || placeholders.isEmpty()) {
            return template;
        }
        Matcher matcher = TOKEN.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            Function<Player, String> value = placeholders.get(matcher.group(1));
            String replacement = value == null
                    ? matcher.group(0)
                    : MINI.escapeTags(Objects.toString(value.apply(viewer), ""));
            matcher.appendReplacement(out, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
