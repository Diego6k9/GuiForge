package dev.diego.guiforge;

import dev.diego.guiforge.format.GuiDefinition;
import dev.diego.guiforge.format.GuiLoader;
import dev.diego.guiforge.format.ItemDefinition;
import net.kyori.adventure.text.minimessage.MiniMessage;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Test harness for custom GUIs. Put GUI JSON files into plugins/GuiForge/gui/ and test them in game:
 * <ul>
 *   <li>Right-click a stick: open the next GUI (in file-name order).</li>
 *   <li>Shift + right-click: reload the folder, no server restart needed.</li>
 * </ul>
 * Every keyed item reports its clicks in chat. Paginated GUIs get 40 sample entries.
 * Remove this class from the product once real commands exist.
 */
public final class GuiForgePlugin extends JavaPlugin implements Listener {
    /** Created by Paper when the plugin loads. */
    public GuiForgePlugin() {
    }


    private static final String[] BUNDLED = {"shop-main.json", "shop-list.json"};
    private final List<Gui<Object>> loaded = new ArrayList<>();
    private final List<String> loadErrors = new ArrayList<>();
    private GuiManager guis;
    private int cursor;

    private static ItemStack sampleItem(Object entry) {
        ItemStack stack = new ItemStack(Material.DIAMOND);
        ItemMeta meta = stack.getItemMeta();
        meta.displayName(Gui.text("<aqua>" + entry));
        meta.lore(List.of(Gui.text("<gray>Beispiel-Inhalt")));
        stack.setItemMeta(meta);
        return stack;
    }

    @Override
    public void onEnable() {
        guis = new GuiManager(this);
        for (String name : BUNDLED) {
            saveResource("gui/" + name, false);
        }
        getServer().getPluginManager().registerEvents(this, this);
        reload();
        getLogger().info("GuiForge enabled.");
    }

    @Override
    public void onDisable() {
        getLogger().info("GuiForge disabled.");
    }

    private void reload() {
        loaded.clear();
        loadErrors.clear();
        cursor = 0;
        File dir = new File(getDataFolder(), "gui");
        File[] files = dir.listFiles((d, name) -> name.endsWith(".json"));
        if (files == null) {
            return;
        }
        Arrays.sort(files);
        for (File file : files) {
            try {
                GuiDefinition def = GuiLoader.parse(Files.readString(file.toPath(), StandardCharsets.UTF_8));
                loaded.add(build(def));
            } catch (IOException | IllegalArgumentException e) {
                loadErrors.add(file.getName() + ": " + e.getMessage());
            }
        }
        getLogger().info("Loaded " + loaded.size() + " test GUI(s), " + loadErrors.size() + " error(s).");
    }

    private Gui<Object> build(GuiDefinition def) {
        Gui<Object> gui = guis.create(def);
        for (ItemDefinition item : def.items) {
            if (item.key == null) {
                continue;
            }
            gui.onClick(item.key, ctx -> ctx.player().sendMessage(Gui.text(
                    "<gray>Clicked: <white>" + ctx.key() + "</white> (page " + (ctx.page() + 1) + ")")));
        }
        if (def.content != null) {
            List<Object> samples = new ArrayList<>();
            for (int i = 1; i <= 40; i++) {
                samples.add("Entry " + i);
            }
            gui.setContents(samples, GuiForgePlugin::sampleItem)
                    .onContentClick((player, entry) -> player.sendMessage(
                            Gui.text("<gray>Selected: <white>" + entry)));
        }
        return gui;
    }

    /**
     * Handles right-clicks with a stick for the demo plugin.
 *
 * @param event the interaction event
     */
    @EventHandler
    public void onStick(PlayerInteractEvent event) {
        if (event.getHand() != EquipmentSlot.HAND) {
            return;
        }
        if (event.getAction() != Action.RIGHT_CLICK_AIR && event.getAction() != Action.RIGHT_CLICK_BLOCK) {
            return;
        }
        ItemStack held = event.getItem();
        if (held == null || held.getType() != Material.STICK) {
            return;
        }
        event.setCancelled(true);
        Player player = event.getPlayer();

        if (player.isSneaking()) {
            reload();
            player.sendMessage(Gui.text("<green>Reloaded: " + loaded.size() + " GUI(s)."));
            showErrors(player);
            return;
        }
        if (loaded.isEmpty()) {
            player.sendMessage(Gui.text("<red>No GUIs found in plugins/GuiForge/gui/."));
            showErrors(player);
            return;
        }
        int index = cursor;
        cursor = (cursor + 1) % loaded.size();
        Gui<Object> gui = loaded.get(index);
        player.sendMessage(Gui.text("<gray>Opening <white>" + gui.id() + "</white> ("
                + (index + 1) + "/" + loaded.size() + ")"));
        gui.open(player);
        showErrors(player);
    }

    private void showErrors(Player player) {
        for (String error : loadErrors) {
            player.sendMessage(Gui.text("<red>Error: " + MiniMessage.miniMessage().escapeTags(error)));
        }
    }
}
