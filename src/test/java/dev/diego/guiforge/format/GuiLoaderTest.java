package dev.diego.guiforge.format;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GuiLoaderTest {

    private static final String HEAD = "{\"formatVersion\":1,\"id\":\"test\",\"rows\":3,";
    private static final String STONE = "\"material\":\"minecraft:stone\"";
    private static final String HASH = "2cdca1d7d7e27132a805af3a5f9d3f29b78f22e31eb97db406cd37be0e2d6e77";

    private static IllegalArgumentException invalid(String json) {
        return assertThrows(IllegalArgumentException.class, () -> GuiLoader.parse(json));
    }

    private static boolean contains(int[] slots, int value) {
        for (int slot : slots) {
            if (slot == value) {
                return true;
            }
        }
        return false;
    }

    @Test
    void parsesMinimalGuiAndDefaultsType() {
        GuiDefinition def = GuiLoader.parse(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[4]," + STONE + "}]}");
        assertEquals("chest", def.type);
        assertArrayEquals(new int[]{4}, def.items.getFirst().resolvedSlots);
    }

    @Test
    void rejectsUnknownFormatVersion() {
        String json = "{\"formatVersion\":2,\"id\":\"t\",\"rows\":1,\"items\":[]}";
        assertTrue(invalid(json).getMessage().contains("formatVersion"));
    }

    @Test
    void rejectsRowsOutOfRange() {
        String json = "{\"formatVersion\":1,\"id\":\"t\",\"rows\":7,\"items\":[]}";
        assertTrue(invalid(json).getMessage().contains("rows"));
    }

    @Test
    void rejectsSlotOutOfRange() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[27]," + STONE + "}]}");
        assertTrue(e.getMessage().contains("out of range"));
    }

    @Test
    void rejectsOverlappingSlots() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":["
                + "{\"key\":\"a\",\"slots\":[4]," + STONE + "},"
                + "{\"key\":\"b\",\"slots\":[4]," + STONE + "}]}");
        assertTrue(e.getMessage().contains("more than one item"));
    }

    @Test
    void rejectsDuplicateKeys() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":["
                + "{\"key\":\"a\",\"slots\":[1]," + STONE + "},"
                + "{\"key\":\"a\",\"slots\":[2]," + STONE + "}]}");
        assertTrue(e.getMessage().contains("duplicate key"));
    }

    @Test
    void rejectsContentOverlappingFixedItem() {
        IllegalArgumentException e = invalid(HEAD
                + "\"items\":[{\"key\":\"a\",\"slots\":[4]," + STONE + "}],"
                + "\"content\":{\"slots\":[4,5]}}");
        assertTrue(e.getMessage().contains("overlaps"));
    }

    @Test
    void rejectsUnknownNavKey() {
        IllegalArgumentException e = invalid(HEAD
                + "\"items\":[{\"key\":\"a\",\"slots\":[0]," + STONE + "}],"
                + "\"content\":{\"slots\":[10,11],\"nav\":{\"next\":\"missing\"}}}");
        assertTrue(e.getMessage().contains("missing"));
    }

    @Test
    void rejectsFillFillerWithoutFillerKey() {
        IllegalArgumentException e = invalid(HEAD
                + "\"items\":[],\"content\":{\"slots\":[10],\"fill\":\"filler\"}}");
        assertTrue(e.getMessage().contains("filler"));
    }

    @Test
    void rejectsMissingMaterial() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[0]}]}");
        assertTrue(e.getMessage().contains("material"));
    }

    @Test
    void rejectsUnknownSlotPattern() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":\"sides\"," + STONE + "}]}");
        assertTrue(e.getMessage().contains("border"));
    }

    @Test
    void rejectsNonIntegerSlotEntries() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[\"x\"]," + STONE + "}]}");
        assertTrue(e.getMessage().contains("integers"));
    }

    @Test
    void borderPatternFillsOuterRingOnly() {
        // 3 rows: 27 slots, interior is row 1, columns 1..7 = 7 slots, so the ring has 20.
        GuiDefinition def = GuiLoader.parse(HEAD
                + "\"items\":[{\"key\":\"frame\",\"slots\":\"border\"," + STONE + "}]}");
        int[] slots = def.items.getFirst().resolvedSlots;
        assertEquals(20, slots.length);
        for (int slot : new int[]{0, 8, 9, 17, 18, 26}) {
            assertTrue(contains(slots, slot), "expected border slot " + slot);
        }
        assertFalse(contains(slots, 13), "interior slot 13 must not be in the border");
    }

    @Test
    void explicitSlotsWinOverPattern() {
        GuiDefinition def = GuiLoader.parse(HEAD + "\"items\":["
                + "{\"key\":\"a\",\"slots\":[0]," + STONE + "},"
                + "{\"key\":\"frame\",\"slots\":\"border\"," + STONE + "}]}");
        int[] frame = def.items.get(1).resolvedSlots;
        assertEquals(19, frame.length);
        assertFalse(contains(frame, 0), "slot 0 is explicitly taken and must not be given to the pattern");
    }

    @Test
    void emptyPatternSkipsContentSlots() {
        // 1 row = 9 slots, content takes 2 and 3, so the background gets the other 7.
        GuiDefinition def = GuiLoader.parse("{\"formatVersion\":1,\"id\":\"t\",\"rows\":1,"
                + "\"items\":[{\"key\":\"bg\",\"slots\":\"empty\"," + STONE + "}],"
                + "\"content\":{\"slots\":[2,3]}}");
        int[] bg = def.items.getFirst().resolvedSlots;
        assertEquals(7, bg.length);
        assertTrue(!contains(bg, 2) && !contains(bg, 3), "content slots must stay free of background items");
    }

    @Test
    void fillerPatternSkipsContentSlots() {
        // 1 row = 9 slots, content takes 2 and 3, so the filler gets the other 7.
        GuiDefinition def = GuiLoader.parse("{\"formatVersion\":1,\"id\":\"t\",\"rows\":1,"
                + "\"items\":[{\"key\":\"bg\",\"slots\":\"filler\"," + STONE + "}],"
                + "\"content\":{\"slots\":[2,3]}}");
        int[] bg = def.items.getFirst().resolvedSlots;
        assertEquals(7, bg.length);
        assertFalse(contains(bg, 2) || contains(bg, 3), "content slots must stay free of filler items");
    }

    @Test
    void acceptsSkinHashAndUrlOnPlayerHead() {
        GuiDefinition url = GuiLoader.parse(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[0],\"material\":\"minecraft:player_head\","
                + "\"skin\":\"http://textures.minecraft.net/texture/" + HASH + "\"}]}");
        assertEquals(HASH, SkinTexture.hashOf(url.items.get(0).skin));
        GuiDefinition bare = GuiLoader.parse(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[0],\"material\":\"minecraft:player_head\","
                + "\"skin\":\"" + HASH + "\"}]}");
        assertEquals(HASH, SkinTexture.hashOf(bare.items.get(0).skin));
    }

    @Test
    void rejectsSkinOnNonHeadMaterial() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[0],\"material\":\"minecraft:stone\","
                + "\"skin\":\"" + HASH + "\"}]}");
        assertTrue(e.getMessage().contains("player_head"));
    }

    @Test
    void rejectsMalformedSkin() {
        IllegalArgumentException e = invalid(HEAD + "\"items\":[{\"key\":\"a\",\"slots\":[0],\"material\":\"minecraft:player_head\","
                + "\"skin\":\"https://example.com/skin.png\"}]}");
        assertTrue(e.getMessage().contains("skin"));
    }
}
