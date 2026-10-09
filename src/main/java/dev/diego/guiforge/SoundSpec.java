package dev.diego.guiforge;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** A parsed sound action: sound key, volume and pitch. */
record SoundSpec(String key, float volume, float pitch) {

    private static final Pattern SPEC = Pattern.compile("(.+?)(?::(\\d+(?:\\.\\d+)?):(\\d+(?:\\.\\d+)?))?");
    private static final Pattern KEY = Pattern.compile("[a-z0-9_.-]+:[a-z0-9_./-]+");

    /**
     * Accepts {@code name}, {@code name:volume:pitch} and {@code namespace:name:volume:pitch}.
     * A name without namespace means minecraft:. Pitch is limited to 0.5 to 2, volume to 0 or more.
     */
    static Optional<SoundSpec> parse(String spec) {
        Matcher m = SPEC.matcher(spec);
        if (!m.matches()) {
            return Optional.empty();
        }
        String name = m.group(1);
        String key = name.contains(":") ? name : "minecraft:" + name;
        if (!KEY.matcher(key).matches()) {
            return Optional.empty();
        }
        float volume = m.group(2) == null ? 1f : Math.max(0f, Float.parseFloat(m.group(2)));
        float pitch = m.group(3) == null ? 1f : Math.clamp(Float.parseFloat(m.group(3)), 0.5f, 2f);
        return Optional.of(new SoundSpec(key, volume, pitch));
    }
}
