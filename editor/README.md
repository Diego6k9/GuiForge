# GuiForge Editor

Visual editor for GuiForge GUI definitions (format v1). Runs locally in the browser, no account, no server.

## Develop

    npm install
    npm run dev        # http://localhost:5173
    npm test           # model and format tests
    npm run build      # type-check and production build into dist/

## What it does

- Grid editor for 1 to 6 rows; assign slots by clicking, or set a slot pattern (`border`, `empty`).
- Item properties: key, material, amount, name, lore, glint, tooltip, locked, action.
- Pagination: mark the content area, pick the filler item, and the prev/next buttons.
- Live preview that follows the runtime rules (nav hiding, filler, content paging).
- Validation before export, export to format v1 JSON, import of existing JSON.
- Autosave to the browser's local storage.

## Not yet

- Real Minecraft textures and font. The preview uses simplified tiles.
- Multiple GUIs per project and "open GUI" links between them.
- Drag and drop placement.
