package dev.diego.guiforge;

import dev.diego.guiforge.format.ContentDefinition;
import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.ItemDefinition;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;

/** One opened inventory for one viewer. Owns the page state and the slot-to-item mapping. */
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
        String title = def.title == null ? "" : def.title;
        this.inventory = Bukkit.createInventory(this, def.rows * 9, MINI.deserialize(title));
    }

    void open() {
        page = 0;
        render();
        viewer.openInventory(inventory);
    }

    @Override
    public Inventory getInventory() {
        return inventory;
    }

    boolean isUnlocked(int slot) {
        ItemDefinition item = definitionBySlot.get(slot);
        return item != null && Boolean.FALSE.equals(item.locked);
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
                } else {
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
        page = Math.max(0, Math.min(page, pages - 1));

        for (Gui.FixedItem fixed : gui.fixedItems()) {
            if (isHiddenNav(fixed.def(), content, pages)) {
                continue;
            }
            for (int slot : fixed.def().slots) {
                inventory.setItem(slot, fixed.template().clone());
                definitionBySlot.put(slot, fixed.def());
            }
        }
        if (content != null) {
            renderContent(content);
        }
    }

    private void renderContent(ContentDefinition content) {
        int[] slots = gui.contentSlots();
        int perPage = slots.length;
        List<?> items = gui.contents();
        Gui.FixedItem filler = "filler".equals(content.fill) && content.filler != null
                ? gui.fixedByKey(content.filler)
                : null;

        for (int i = 0; i < perPage; i++) {
            int index = page * perPage + i;
            int slot = slots[i];
            if (index < items.size()) {
                inventory.setItem(slot, gui.renderContent(items.get(index)));
                contentIndexBySlot.put(slot, index);
            } else if (filler != null) {
                inventory.setItem(slot, filler.template().clone());
            }
        }
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
