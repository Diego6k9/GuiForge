# GuiForge

Data-driven GUIs for Paper plugins: design a menu visually, load it at runtime, bind click handlers by key.

Status: early scaffold (v0.1.0-SNAPSHOT).

## Build

Requires JDK 25 (see `maven.compiler.release` in `pom.xml`) and Maven 3.9+.

    mvn clean package

The shaded jar lands in `target/`. To write it straight into a Paper server's `plugins` folder, set `paper.plugins.dir`:

    mvn clean package -Dpaper.plugins.dir="C:\Users\<you>\Documents\MC\Paper Servers\Paper Server 26.3\plugins"

To make this permanent for your machine, add a profile to `~/.m2/settings.xml` (on Windows: `C:\Users\<you>\.m2\settings.xml`):

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
