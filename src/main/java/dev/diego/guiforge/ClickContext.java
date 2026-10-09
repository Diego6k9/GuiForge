package dev.diego.guiforge;

import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;

/**
 * Passed to click handlers bound by key.
 *
 * @param player the viewer
 * @param event  the underlying Bukkit click event
 * @param key    the key of the clicked item
 * @param page   the current page (0 for non-paginated GUIs)
 */
public record ClickContext(Player player, InventoryClickEvent event, String key, int page) {}
