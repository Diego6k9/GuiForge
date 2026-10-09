# GuiForge

Data-driven GUIs for Paper plugins: design a menu visually, load it at runtime, bind click handlers by key.

Status: first release (v0.1.0). Licensed under the MIT License, see `LICENSE`.

## Usage

Add GuiForge as a dependency (once published to Maven Central):

    <dependency>
      <groupId>io.github.diego6k9</groupId>
      <artifactId>guiforge</artifactId>
      <version>0.1.0</version>
    </dependency>

Then load a layout from your plugin's resources and bind click handlers by item key:

    GuiManager guis = new GuiManager(this);
    Gui<Object> shop = guis.load("gui/shop.json");
    shop.onClick("buy", ctx -> ctx.player().sendMessage("Bought!"));
    shop.placeholder("balance", player -> "100");
    shop.open(player);

Layouts follow the format described in `docs/format-v1.md`.

## Build

Requires JDK 25 (see `maven.compiler.release` in `pom.xml`) and Maven 3.9+.

    mvn clean package

This produces the library jar in `target/`, without bundled dependencies. Gson is a normal dependency.

For a Paper test server, build the shaded jar with the `server` profile. It bundles and relocates Gson and can write straight into a server's `plugins` folder:

    mvn clean package -Pserver -Dpaper.plugins.dir="C:\Users\<you>\Documents\MC\Paper Servers\Paper Server 26.3\plugins"

To make this permanent for your machine, add a profile to `~/.m2/settings.xml` (on Windows:
`C:\Users\<you>\.m2\settings.xml`):

    <settings>
      <profiles>
        <profile>
          <id>local-server</id>
          <properties>
            <paper.plugins.dir>C:\Users\<you>\Documents\MC\Paper Servers\Paper Server 26.3\plugins</paper.plugins.dir>
          </properties>
        </profile>
      </profiles>
      <activeProfiles>
        <activeProfile>local-server</activeProfile>
      </activeProfiles>
    </settings>
