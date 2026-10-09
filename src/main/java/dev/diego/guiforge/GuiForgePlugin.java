package dev.diego.guiforge;

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

import java.io.IOException;
import java.util.List;
import java.util.stream.IntStream;

/**
 * Test harness: right-click with a stick to open the paginated product list,
 * shift + right-click for the normal shop. Remove once real commands exist.
 */
public final class GuiForgePlugin extends JavaPlugin implements Listener {

    private Gui<Object> shop;
    private Gui<String> productList;

    private static ItemStack productItem(String name) {
        ItemStack stack = new ItemStack(Material.DIAMOND);
        ItemMeta meta = stack.getItemMeta();
        meta.displayName(Gui.text("<aqua>" + name));
        meta.lore(List.of(Gui.text("<gray>Klick zum Auswählen")));
        stack.setItemMeta(meta);
        return stack;
    }

    @Override
    public void onEnable() {
        GuiManager guis = new GuiManager(this);
        try {
            shop = guis.load("gui/shop-main.json");
            productList = guis.load("gui/shop-list.json");
        } catch (IOException | IllegalArgumentException e) {
            getLogger().severe("Could not load GUIs: " + e.getMessage());
            getServer().getPluginManager().disablePlugin(this);
            return;
        }

        shop.onClick("confirm", ctx -> ctx.player().sendMessage(Gui.text("<green>Kauf bestätigt (Test)")));

        List<String> products = IntStream.rangeClosed(1, 60).mapToObj(i -> "Produkt #" + i).toList();
        productList.setContents(products, GuiForgePlugin::productItem)
                .onContentClick((player, name) -> player.sendMessage(Gui.text("<gray>Gewählt: " + name)));

        getServer().getPluginManager().registerEvents(this, this);
        getLogger().info("GuiForge enabled.");
    }

    @Override
    public void onDisable() {
        getLogger().info("GuiForge disabled.");
    }

    @EventHandler
    public void onStickUse(PlayerInteractEvent event) {
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
            shop.open(player);
        } else {
            productList.open(player);
        }
    }
}
