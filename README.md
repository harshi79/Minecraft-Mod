# Crystal Void — Minecraft Bedrock Add-On

Crystal Void is a small, from-scratch Bedrock add-on for **Minecraft 1.26.40+** (including Android `1.26.44.3`). It adds a real script-created dimension, a craftable **Dimension Crystal**, a **Void Anchor**, custom blocks, original pixel-art textures, and a safe way home.

## Download and install on Android

The ready-to-import file is:

**[`release/CrystalVoid-v1.0.0.mcaddon`](release/CrystalVoid-v1.0.0.mcaddon)**

1. Move or download that `.mcaddon` file onto the phone.
2. Tap the file and choose **Minecraft** if Android asks which app should open it.
3. Wait for Minecraft to report that both packs imported successfully.
4. Create a new world (recommended for the first test).
5. Open **Add-Ons → Behavior Packs → My Packs** and activate **Crystal Void — Behavior**. Its resource pack should activate with it.
6. Enter the world and craft the two items below.

No experimental toggle is required on Minecraft 1.26.40+; custom dimensions moved to the stable Script API before this target version. Back up an important world before testing any new add-on.

## How to play

### 1. Craft a Dimension Crystal

At a crafting table:

```text
. A .
A E A
. C .
```

- `A` — Amethyst Shard
- `E` — Ender Pearl
- `C` — Crying Obsidian

The crystal is reusable and does not get consumed during travel.

### 2. Craft a Void Anchor

```text
O O O
O A O
O C O
```

- `O` — Obsidian
- `A` — Amethyst Block
- `C` — Crying Obsidian

### 3. Open the dimension

1. Place the **Void Anchor**.
2. Hold the **Dimension Crystal**.
3. Tap the Void Anchor.
4. The first trip builds a floating island, so it can take a moment on a slower phone.
5. In the Crystal Void, use the crystal on the central anchor to return to the exact place you left.

### Quick Creative-mode test

Enable cheats only if you want to skip crafting, then run:

```mcfunction
/give @s crystal_void:dimension_crystal
/give @s crystal_void:void_anchor
```

Place the anchor, hold the crystal, and tap the anchor.

## Features in v1.0.0

- Real custom void dimension: `crystal_void:realm`
- Reusable glowing Dimension Crystal
- Craftable Void Anchor portal block
- Return-point memory for each player and each vanilla dimension
- Procedurally built floating island with amethyst runes, crystal spires, lighting, and custom Voidstone
- Safe arrival protection and clear mobile-friendly messages
- Original 16×16 pixel-art textures and pack icon
- Behavior and resource packs bundled into one Android-friendly `.mcaddon`

## Project layout

```text
packs/
  CrystalVoid_BP/       Behavior pack (items, blocks, recipes, compiled script)
  CrystalVoid_RP/       Resource pack (textures and language files)
src/main.ts             Dimension registration, island generation, and travel logic
tools/                   Asset generation, validation, and packaging scripts
release/                 Ready-to-import .mcaddon
```

## Build from source

Install Node.js 18 or newer, then run:

```bash
npm install
npm run build
```

The build:

1. regenerates all PNG assets,
2. compiles TypeScript,
3. validates manifests, JSON, UUIDs, textures, and identifiers,
4. creates `release/CrystalVoid-v1.0.0.mcaddon`.

Run checks without repackaging:

```bash
npm test
```

## Compatibility notes

- Target: Minecraft Bedrock `1.26.40+`
- Tested statically against `@minecraft/server` `2.9.0`
- Intended phone version: Android `1.26.44.3`
- The current custom-dimension API creates a void world; the add-on builds its terrain with script when first entered.

## License

MIT — see [LICENSE](LICENSE).
