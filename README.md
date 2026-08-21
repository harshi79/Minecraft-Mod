# DDX56 — Dark Medieval Castle (Minecraft Bedrock Add-On)

Build an enormous furnished royal fortress in moments. This Bedrock add-on targets **Minecraft 1.26.40+**, including Android **1.26.44.3**.

## Download

Import [`release/DarkMedievalCastle-v1.0.0.mcaddon`](release/DarkMedievalCastle-v1.0.0.mcaddon), then activate **Dark Medieval Castle — Behavior** in a world. The resource pack activates with it.

## Build the castle

### 1. Obtain the Castle Heart

For a quick Creative test:

```mcfunction
/give @s dark_castle:ddx56
/give @s lever
```

The **DDX56 — Castle Heart** also has a survival recipe:

```text
O N O
R B R
O D O
```

- `O` — Obsidian
- `N` — Nether Star
- `R` — Redstone Block
- `B` — Beacon
- `D` — Dragon's Breath

### 2. Choose the site

Find a large open area. The build replaces blocks in an area approximately **69 blocks wide, 75 blocks long, and 52 blocks high**. Back up an important world first.

Place DDX56 at the center of the future front gate. Attach a normal lever directly **on top or to any side** of DDX56. Face the direction in which the castle should extend, then pull the lever.

The Castle Heart becomes crying obsidian and the complete fortress rises in fast construction stages. It cannot accidentally regenerate from the same heart.

## Included in the fortress

- Symmetrical dark medieval curtain walls, battlements, gatehouse, and four huge watchtowers
- Three-floor royal keep and grand red-carpet throne hall with a golden throne
- Royal and guest bedrooms, dining hall, kitchen, library, enchanting room, brewery, map/war room, and chapel
- Furnaces, blast furnace, smoker, crafting, smithing, stonecutting, grinding, anvils, barrels, and storage
- Secure iron treasury with valuable display blocks
- Courtyard fountain, stable, hay loft, forge, irrigated wheat farm, and soul-fire braziers
- Rear crypt and protected Nether portal frame
- **Enormous Black Dragon rooftop sculpture** with a horned head, glowing red eyes, teeth, armored body, legs, claws, curling tail, fire breath, and wings spread nearly the full width of the castle
- Cardinal rotation: the fortress builds in the direction the player faces when activating the lever
- Chunk-safe staged construction with progress messages, designed for Android

The dragon is a permanent block sculpture, not a living mob, so it will not fly away or damage the palace.

## Build from source

Requires Node.js 18 or newer:

```bash
npm install
npm run build
```

Run all TypeScript, project, and official Mojang Creator Tools checks with:

```bash
npm test
```

## Project layout

```text
packs/DarkCastle_BP/   Behavior pack, DDX56 block, recipe, and compiled builder
packs/DarkCastle_RP/   Original DDX56 textures, icon, and language file
src/main.ts            Lever detection, rotation, castle, rooms, and dragon generator
tools/                 Asset generation, validation, and .mcaddon packaging
release/               Ready-to-import Android/Bedrock add-on
```

## Compatibility

- Minecraft Bedrock `1.26.40+`
- Intended Android build: `1.26.44.3`
- Script API: `@minecraft/server` `2.9.0`
- No experimental toggle is intended to be required

## License

MIT — see [LICENSE](LICENSE).
