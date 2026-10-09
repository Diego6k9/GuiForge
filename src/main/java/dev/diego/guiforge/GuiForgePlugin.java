package dev.diego.guiforge;

import org.bukkit.plugin.java.JavaPlugin;

public final class GuiForgePlugin extends JavaPlugin {

    @Override
    public void onEnable() {
        getLogger().info("GuiForge enabled.");
    }

    @Override
    public void onDisable() {
        getLogger().info("GuiForge disabled.");
    }
}
