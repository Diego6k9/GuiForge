package dev.diego.guiforge.format;

import com.google.gson.JsonElement;

import java.util.List;

/**
 * A fixed item inside a GUI. Null means "not set"; defaults are applied at use site.
 */
public final class ItemDefinition {
    public String key;
    /**
     * Either an array of slot indices, or a pattern name: "border" or "empty". Resolved by GuiLoader.
     */
    public JsonElement slots;
    /**
     * Concrete slots after validation. Never read from JSON.
     */
    public transient int[] resolvedSlots;
    public String material;
    public Integer amount;
    public String name;
    public List<String> lore;
    public Integer customModelData;
    public Boolean glint;
    public Boolean hideTooltip;
    /**
     * Hides the vanilla attribute lines (damage, armor, attack speed) in the tooltip. Null means true.
     */
    public Boolean hideAttributes;
    /**
     * Skin of a player head: texture hash or textures.minecraft.net URL. Only valid for player_head.
     */
    public String skin;
    public Boolean locked;
    public String action;
}
