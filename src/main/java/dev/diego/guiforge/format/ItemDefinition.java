package dev.diego.guiforge.format;

import java.util.List;

/** A fixed item inside a GUI. Null means "not set"; defaults are applied at use site. */
public final class ItemDefinition {
    public String key;
    public int[] slots;
    public String material;
    public Integer amount;
    public String name;
    public List<String> lore;
    public Integer customModelData;
    public Boolean glint;
    public Boolean hideTooltip;
    public Boolean locked;
    public String action;
}
