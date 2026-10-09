package dev.diego.guiforge.format;

import java.util.List;

/** Root of a GUI file (format v1). Public fields are filled by Gson. */
public final class GuiDefinition {
    public int formatVersion;
    public String id;
    public String type;
    public int rows;
    public String title;
    public List<ItemDefinition> items;
    public ContentDefinition content;
}
