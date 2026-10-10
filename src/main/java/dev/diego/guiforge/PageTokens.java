package dev.diego.guiforge;

import java.util.Map;
import java.util.Set;

/**
 * Built-in placeholders for paginated GUIs: {@code {page}}, {@code {pages}}, {@code {prevPage}} and
 * {@code {nextPage}}. Page numbers start at 1 and are clamped to the valid range.
 */
final class PageTokens {

    /** Names reserved for the built-in page tokens. A custom placeholder cannot use them. */
    static final Set<String> NAMES = Set.of("page", "pages", "prevPage", "nextPage");

    private PageTokens() {
    }

    /**
     * Values for the page tokens.
     *
     * @param page  the current page, 0-based
     * @param pages the total number of pages, at least 1
     * @return token name to value
     */
    static Map<String, String> of(int page, int pages) {
        return Map.of(
                "page", String.valueOf(page + 1),
                "pages", String.valueOf(pages),
                "prevPage", String.valueOf(Math.max(1, page)),
                "nextPage", String.valueOf(Math.min(pages, page + 2)));
    }
}
