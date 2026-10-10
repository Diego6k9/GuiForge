package dev.diego.guiforge;

import dev.diego.guiforge.format.ContentDefinition;
import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.ItemDefinition;
import net.kyori.adventure.key.Key;
import net.kyori.adventure.sound.Sound;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jspecify.annotations.NonNull;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * One opened inventory for one viewer. Owns the page state and the slot-to-item mapping.
 */
final class GuiSession implements InventoryHolder {

    private static final MiniMessage MINI = MiniMessage.miniMessage();

    private final Gui<?> gui;
    private final GuiManager manager;
    private final Player viewer;
    private final Inventory inventory;
    private final Map<Integer, ItemDefinition> definitionBySlot = new HashMap<>();
    private final Map<Integer, Integer> contentIndexBySlot = new HashMap<>();
    private int page;

    GuiSession(Gui<?> gui, GuiManager manager, Player viewer) {
        this.gui = gui;
        this.manager = manager;
        this.viewer = viewer;
        GuiDefinition def = gui.definition();
        String title = gui.resolve(def.title == null ? "" : def.title, viewer);
        this.inventory = Bukkit.createInventory(this, def.rows * 9, MINI.deserialize(title));
    }

    void open() {
        page = 0;
        render();
        viewer.openInventory(inventory);
        gui.track(this);
        gui.dispatchOpen(viewer);
    }

    @Override
    public @NonNull Inventory getInventory() {
        return inventory;
    }

    boolean isUnlocked(int slot) {
        ItemDefinition item = definitionBySlot.get(slot);
        return item != null && Boolean.FALSE.equals(item.locked);
    }

    /**
     * Called when the viewer closes this inventory, for whatever reason.
     */
    void handleClose() {
        gui.untrack(this);
        gui.dispatchClose(viewer);
    }

    /**
     * Re-renders items if this inventory is still the one the viewer has open.
     */
    void refresh() {
        if (viewer.getOpenInventory().getTopInventory() == inventory) {
            render();
        }
    }

    void handleClick(InventoryClickEvent event) {
        int slot = event.getSlot();
        Integer contentIndex = contentIndexBySlot.get(slot);
        if (contentIndex != null) {
            gui.dispatchContentClick(viewer, gui.contents().get(contentIndex));
        }
        ItemDefinition item = definitionBySlot.get(slot);
        if (item == null) {
            return;
        }
        if (item.key != null) {
            gui.dispatchClick(item.key, new ClickContext(viewer, event, item.key, page));
        }
        if (item.action != null) {
            runAction(item.action);
        }
    }

    private void playSound(String spec) {
        SoundSpec.parse(spec).ifPresentOrElse(
                sound -> viewer.playSound(Sound.sound(Key.key(sound.key()), Sound.Source.MASTER, sound.volume(), sound.pitch())),
                () -> manager.logger().warning("Invalid sound '" + spec + "' in GUI '" + gui.id() + "'"));
    }

    private void runAction(String action) {
        switch (action) {
            case "close" -> viewer.closeInventory();
            case "next-page" -> {
                if (page < pageCount() - 1) {
                    page++;
                    render();
                }
            }
            case "prev-page" -> {
                if (page > 0) {
                    page--;
                    render();
                }
            }
            default -> {
                if (action.startsWith("open:")) {
                    manager.open(viewer, action.substring("open:".length()));
                } else if (action.startsWith("sound:")) {
                    playSound(action.substring("sound:".length()));
                } else if (action.startsWith("message:")) {
                    viewer.sendMessage(Gui.text(gui.resolve(action.substring("message:".length()), viewer,
                            PageTokens.of(page, pageCount()))));
                } else if (!manager.runCustomAction(action, viewer)) {
                    manager.logger().warning("Unknown action '" + action + "' in GUI '" + gui.id() + "'");
                }
            }
        }
    }

    private void render() {
        inventory.clear();
        definitionBySlot.clear();
        contentIndexBySlot.clear();

        ContentDefinition content = gui.content();
        int pages = pageCount();
        page = Math.clamp(page, 0, pages - 1);
        Map<String, String> tokens = PageTokens.of(page, pages);

        for (Gui.FixedItem fixed : gui.fixedItems()) {
            if (isHiddenNav(fixed.def(), content, pages)) {
                // Hidden nav slots show the frame item instead of air, so the border stays closed.
                Gui.FixedItem frame = frameItem(content);
                if (frame != null) {
                    place(frame, fixed.def().resolvedSlots, tokens);
                }
                continue;
            }
            place(fixed, fixed.def().resolvedSlots, tokens);
        }
        if (content != null) {
            renderContent(content, tokens);
        }
    }

    private void place(Gui.FixedItem item, int[] slots, Map<String, String> tokens) {
        for (int slot : slots) {
            inventory.setItem(slot, gui.stackFor(item, viewer, tokens));
            definitionBySlot.put(slot, item.def());
        }
    }

    private void renderContent(ContentDefinition content, Map<String, String> tokens) {
        int[] slots = gui.contentSlots();
        int perPage = slots.length;
        List<?> items = gui.contents();
        // Only "fill: filler" pads the unused content slots. The default "empty" leaves them open.
        Gui.FixedItem padding = "filler".equals(content.fill) ? frameItem(content) : null;

        for (int i = 0; i < perPage; i++) {
            int index = page * perPage + i;
            int slot = slots[i];
            if (index < items.size()) {
                inventory.setItem(slot, gui.renderContent(items.get(index)));
                contentIndexBySlot.put(slot, index);
            } else if (padding != null) {
                inventory.setItem(slot, gui.stackFor(padding, viewer, tokens));
            }
        }
    }

    private Gui.FixedItem frameItem(ContentDefinition content) {
        return content == null || content.filler == null ? null : gui.fixedByKey(content.filler);
    }

    private boolean isHiddenNav(ItemDefinition item, ContentDefinition content, int pages) {
        if (item.key == null || content == null || content.nav == null) {
            return false;
        }
        if (!"hide".equals(content.navOnEdge)) {
            return false;
        }
        boolean prevOnFirstPage = item.key.equals(content.nav.prev) && page == 0;
        boolean nextOnLastPage = item.key.equals(content.nav.next) && page == pages - 1;
        return prevOnFirstPage || nextOnLastPage;
    }

    private int pageCount() {
        if (!gui.isPaginated()) {
            return 1;
        }
        int perPage = gui.contentSlots().length;
        return Math.max(1, (gui.contents().size() + perPage - 1) / perPage);
    }
}
