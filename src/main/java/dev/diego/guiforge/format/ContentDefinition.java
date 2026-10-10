package dev.diego.guiforge.format;

/**
 * Paginated content area of a GUI.
 */
public final class ContentDefinition {
    /** Created by Gson when a layout is parsed. */
    public ContentDefinition() {
    }

    /**
     * Slots where the runtime content appears. Must not overlap any fixed item.
     */
    public int[] slots;
    /**
     * {@code "empty"} (default) leaves unused content slots free. {@code "filler"} fills them with the item
     * referenced by {@link #filler}.
     */
    public String fill;
    /**
     * Key of a fixed frame item. Shown where prev/next is hidden, and for unused slots when fill is {@code filler}.
     */
    public String filler;
    /**
     * What happens to prev/next on the first and last page: {@code "hide"} (default) or {@code "keep"} (shown inactive).
     */
    public String navOnEdge;
    /**
     * Keys of the previous and next buttons, pointing to fixed items.
     */
    public NavDefinition nav;

    /**
     * Keys of the previous and next page buttons.
     */
    public static final class NavDefinition {
        /** Created by Gson when a layout is parsed. */
        public NavDefinition() {
        }

        /**
         * Key of the fixed item used as the previous-page button.
         */
        public String prev;
        /**
         * Key of the fixed item used as the next-page button.
         */
        public String next;
    }
}
