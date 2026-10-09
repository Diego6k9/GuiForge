package dev.diego.guiforge;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ActionRegistryTest {

    @Test
    void runsTheHandlerForItsPrefixWithTheRestOfTheAction() {
        ActionRegistry registry = new ActionRegistry();
        List<String> seen = new ArrayList<>();
        registry.register("shop:", (player, arg) -> seen.add(arg));

        assertTrue(registry.run("shop:buy", null));
        assertEquals(List.of("buy"), seen);
    }

    @Test
    void returnsFalseWhenNoPrefixMatches() {
        ActionRegistry registry = new ActionRegistry();
        registry.register("shop:", (player, arg) -> fail("should not run"));

        assertFalse(registry.run("other:thing", null));
    }

    @Test
    void rejectsBuiltInPrefixesAndPrefixesWithoutColon() {
        ActionRegistry registry = new ActionRegistry();
        for (String prefix : ActionRegistry.BUILT_IN_PREFIXES) {
            assertThrows(IllegalArgumentException.class, () -> registry.register(prefix, (player, arg) -> {
            }));
        }
        assertThrows(IllegalArgumentException.class, () -> registry.register("shop", (player, arg) -> {
        }));
    }
}
