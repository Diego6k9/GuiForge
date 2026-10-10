package dev.diego.guiforge.format;

import com.google.gson.JsonElement;

import java.util.List;

/**
 * A fixed item inside a GUI. Null means "not set"; defaults are applied at use site.
 */
public final class ItemDefinition {
    /** Created by Gson when a layout is parsed. */
    public ItemDefinition() {
    }

    /**
     * Identifier used by onClick, itemFor, item(key) and the nav and filler references. Optional for decorative items.
     */
    public String key;
    /**
     * Either an array of slot indices, or a pattern name: "border" or "filler" ("empty" is the older name of "filler"). Resolved by GuiLoader.
     */
    public JsonElement slots;
    /**
     * Concrete slots after validation. Never read from JSON.
     */
    public transient int[] resolvedSlots;
    /**
     * Bukkit material name, e.g. {@code minecraft:lime_dye}.
     */
    public String material;
    /**
     * Stack size. Null means 1.
     */
    public Integer amount;
    /**
     * Display name in MiniMessage, with optional {@code {token}} placeholders.
     */
    public String name;
    /**
     * Lore lines in MiniMessage, one entry per line.
     */
    public List<String> lore;
    /**
     * Custom model data for resource packs. Null means not set.
     */
    public Integer customModelData;
    /**
     * Forces the enchantment glint on or off. Null means the default.
     */
    public Boolean glint;
    /**
     * Hides the whole tooltip. Null means not set.
     */
    public Boolean hideTooltip;
    /**
     * Hides the vanilla attribute lines (damage, armor, attack speed) in the tooltip. Null means true.
     */
    public Boolean hideAttributes;
    /**
     * Skin of a player head: texture hash or textures.minecraft.net URL. Only valid for player_head.
     */
    public String skin;
    /**
     * Whether players can take or move this item. Null means locked; set false to make the item interactive.
     */
    public Boolean locked;
    /**
     * Action run on click, e.g. {@code close}, {@code open:<id>} or {@code message:<text>}.
     */
    public String action;
}
