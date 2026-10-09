package dev.diego.guiforge;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SoundSpecTest {

    @Test
    void bareNameUsesMinecraftNamespaceAndDefaults() {
        SoundSpec spec = SoundSpec.parse("entity.experience_orb.pickup").orElseThrow();
        assertEquals("minecraft:entity.experience_orb.pickup", spec.key());
        assertEquals(1f, spec.volume());
        assertEquals(1f, spec.pitch());
    }

    @Test
    void readsVolumeAndPitch() {
        SoundSpec spec = SoundSpec.parse("entity.experience_orb.pickup:0.8:1.2").orElseThrow();
        assertEquals("minecraft:entity.experience_orb.pickup", spec.key());
        assertEquals(0.8f, spec.volume(), 1e-6f);
        assertEquals(1.2f, spec.pitch(), 1e-6f);
    }

    @Test
    void keepsExplicitNamespace() {
        SoundSpec spec = SoundSpec.parse("minecraft:block.note_block.harp:0.5:1").orElseThrow();
        assertEquals("minecraft:block.note_block.harp", spec.key());
    }

    @Test
    void clampsPitchToTheGameRange() {
        assertEquals(2f, SoundSpec.parse("entity.x:1:9").orElseThrow().pitch());
        assertEquals(0.5f, SoundSpec.parse("entity.x:1:0.1").orElseThrow().pitch());
    }

    @Test
    void rejectsInvalidKeys() {
        assertTrue(SoundSpec.parse("Entity Pickup").isEmpty());
        assertTrue(SoundSpec.parse("entity.x:").isEmpty());
    }
}
