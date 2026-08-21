# Changelog

## 1.0.1 — 2026-08-21

- Fixed Dimension Crystal + Void Anchor activation on Android touch controls.
- Anchor detection now runs on `world.beforeEvents.playerInteractWithBlock` with `event.cancel = true`, guarded by `event.isFirstEvent` so holding the touch button does not re-trigger travel.
- Added the mobile `minecraft:interact_button` ("Open Crystal Void") action to the Dimension Crystal, with an English translation.
- Added official Mojang `@minecraft/creator-tools` validation (strict add-on suite and full suite) with zero errors and warnings.
- Bumped all pack, module, cross-dependency, package, and release versions to 1.0.1 so Minecraft replaces the installed pack.
- New release: `CrystalVoid-v1.0.1.mcaddon`.

## 1.0.0 — 2026-08-21

- Added the real `crystal_void:realm` custom dimension.
- Added the reusable Dimension Crystal item and crafting recipe.
- Added the craftable Void Anchor portal block.
- Added custom Voidstone terrain.
- Added a generated floating island with runes, spires, lights, and a return anchor.
- Added per-player return location memory.
- Added original item, block, and pack-icon textures.
- Added validation and `.mcaddon` packaging tools.

