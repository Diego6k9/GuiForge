package dev.diego.guiforge.format;

import java.util.List;

/**
 * Root of a GUI file (format v1). Public fields are filled by Gson.
 */
public final class GuiDefinition {
    /** Created by Gson when a layout is parsed. */
    public GuiDefinition() {
    }

    /**
     * Layout format version. Must be 1.
     */
    public int formatVersion;
    /**
     * Unique id. Used by {@code open:<id>} actions and by {@code GuiManager.open}.
     */
    public String id;
    /**
     * Inventory type, e.g. {@code chest}.
     */
    public String type;
    /**
     * Number of rows for a chest inventory.
     */
    public int rows;
    /**
     * Title in MiniMessage, with optional {@code {token}} placeholders.
     */
    public String title;
    /**
     * Fixed items of the GUI.
     */
    public List<ItemDefinition> items;
    /**
     * Paginated content area, or null for a non-paginated GUI.
     */
    public ContentDefinition content;
}
