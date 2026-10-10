package dev.diego.guiforge.format;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Turns a player-head skin reference into its texture hash.
 * Accepts the bare 64-character hash or a {@code textures.minecraft.net/texture/<hash>} URL.
 */
public final class SkinTexture {
    private static final Pattern HASH = Pattern.compile("[0-9a-f]{64}");
    private static final Pattern URL = Pattern.compile(
            "^https?://textures\\.minecraft\\.net/texture/([0-9a-fA-F]{64})/?$");

    private SkinTexture() {
    }

    /**
     * Returns the lowercase texture hash for a skin reference.
     *
     * @param value the bare 64-character hash or a textures.minecraft.net URL
     * @return the lowercase texture hash
     * @throws IllegalArgumentException if the value is not a skin reference
     */
    public static String hashOf(String value) {
        String trimmed = value == null ? "" : value.trim();
        var url = URL.matcher(trimmed);
        if (url.matches()) {
            return url.group(1).toLowerCase(Locale.ROOT);
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (HASH.matcher(lower).matches()) {
            return lower;
        }
        throw new IllegalArgumentException("'" + value + "' is not a skin hash or textures.minecraft.net URL");
    }

    /**
     * The canonical URL Paper expects for the skin texture.
     *
     * @param hash the texture hash
     * @return the texture URL
     */
    public static String urlOf(String hash) {
        return "http://textures.minecraft.net/texture/" + hash;
    }
}
