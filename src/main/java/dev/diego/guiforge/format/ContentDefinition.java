package dev.diego.guiforge.format;

/**
 * Paginated content area of a GUI.
 */
public final class ContentDefinition {
    public int[] slots;
    public String fill;
    public String filler;
    public String navOnEdge;
    public NavDefinition nav;

    public static final class NavDefinition {
        public String prev;
        public String next;
    }
}
