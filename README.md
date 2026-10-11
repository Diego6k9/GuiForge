# GuiForge

Data-driven GUIs for Paper plugins: design a menu visually, load it at runtime, bind click handlers by key.

Status: v0.3.0 (first public release was v0.1.0). Licensed under the MIT License, see `LICENSE`.

## Usage

Add GuiForge as a dependency (once published to Maven Central):

    <dependency>
      <groupId>io.github.diego6k9</groupId>
      <artifactId>guiforge</artifactId>
      <version>0.3.0</version>
    </dependency>

Then load a layout from your plugin's resources and bind click handlers by item key:

    GuiManager guis = new GuiManager(this);
    Gui<Object> shop = guis.load("gui/shop.json");
    shop.onClick("buy", ctx -> ctx.player().sendMessage("Bought!"));
    shop.placeholder("balance", player -> "100");
    shop.open(player);

Create one `GuiManager` per plugin and reuse it. A second one for the same plugin throws an `IllegalStateException`.

Layouts follow the format described in `docs/format-v1.md`.

## Features

- **Click handlers** bound by item key with `onClick`, see [format](docs/format-v1.md).
- **Per-player items** with `itemFor`, see [format](docs/format-v1.md).
- **Placeholders** `{token}` in names, lore, titles and messages, with `placeholder` and `placeholderComponent`. See [placeholders and translations](docs/placeholders-and-translations.md).
- **Translations** from YAML language files with per-player language and fallback. See [placeholders and translations](docs/placeholders-and-translations.md).
- **Paginated GUIs** with `setContents`, `onContentClick` and page tokens. See [paginated GUIs](docs/paginated-guis.md).
- **Actions** `close`, `next-page`, `prev-page`, `open:`, `sound:`, `message:`, and your own prefixes with `registerAction`. See [actions](docs/actions.md).

## Editor

Layouts can be designed in the GuiForge web editor. The editor is coming soon, and this section will get a link at launch.
Layouts are plain JSON files, so you can also write them by hand, see `docs/format-v1.md`.

## Templates

The `templates/` folder contains ready-to-use layouts, one JSON file each. Copy a file into your plugin's
`src/main/resources/gui/` folder, load it with `guis.load("gui/<name>.json")`, and bind its click handlers.

## Feedback

Found a bug or have an idea? Open an issue at https://github.com/Diego6k9/GuiForge/issues.

## Support

GuiForge is free and open source. If it saves you time, you can support its development with
[GitHub Sponsors](https://github.com/sponsors/Diego6k9). Thank you!

## License

MIT, see `LICENSE`.

## Build

Requires JDK 25 (see `maven.compiler.release` in `pom.xml`) and Maven 3.9+.

    mvn clean package

This produces the library jar in `target/`, without bundled dependencies. Gson is a normal dependency.

For a Paper test server, build the shaded jar with the `server` profile. It bundles and relocates Gson and can write
straight into a server's `plugins` folder:

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
