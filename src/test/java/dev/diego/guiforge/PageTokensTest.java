package dev.diego.guiforge;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class PageTokensTest {

    @Test
    void firstPageOfThree() {
        var t = PageTokens.of(0, 3);
        assertEquals("1", t.get("page"));
        assertEquals("3", t.get("pages"));
        assertEquals("1", t.get("prevPage"));
        assertEquals("2", t.get("nextPage"));
    }

    @Test
    void middlePageOfThree() {
        var t = PageTokens.of(1, 3);
        assertEquals("2", t.get("page"));
        assertEquals("1", t.get("prevPage"));
        assertEquals("3", t.get("nextPage"));
    }

    @Test
    void lastPageClampsNext() {
        var t = PageTokens.of(2, 3);
        assertEquals("3", t.get("page"));
        assertEquals("2", t.get("prevPage"));
        assertEquals("3", t.get("nextPage"));
    }

    @Test
    void singlePageClampsBothSides() {
        var t = PageTokens.of(0, 1);
        assertEquals("1", t.get("page"));
        assertEquals("1", t.get("pages"));
        assertEquals("1", t.get("prevPage"));
        assertEquals("1", t.get("nextPage"));
    }
}
