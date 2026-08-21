import { BlockPermutation, BlockVolume, system, world, } from "@minecraft/server";
const HEART_ID = "dark_castle:ddx56";
const LEVER_ID = "minecraft:lever";
const activeBuilds = new Set();
let buildSequence = 0;
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.block.typeId !== LEVER_ID || !event.isFirstEvent)
        return;
    const heart = findAdjacentHeart(event.block.dimension, event.block.location);
    if (!heart)
        return;
    event.cancel = true;
    const key = `${event.block.dimension.id}:${heart.x}:${heart.y}:${heart.z}`;
    if (activeBuilds.has(key)) {
        event.player.onScreenDisplay.setActionBar("§4The Castle Heart is already awakening…");
        return;
    }
    activeBuilds.add(key);
    const player = event.player;
    const rotation = rotationFromView(player.getViewDirection());
    system.run(() => {
        void constructCastle(player, event.block.dimension, heart, rotation)
            .catch((error) => {
            try {
                player.sendMessage(`§cCastle construction failed: ${formatError(error)}`);
            }
            catch {
                // The player may have left the world during construction.
            }
        })
            .finally(() => activeBuilds.delete(key));
    });
});
world.afterEvents.playerPlaceBlock.subscribe((event) => {
    if (event.block.typeId !== HEART_ID)
        return;
    event.player.sendMessage("§4§lDDX56 Castle Heart placed.§r");
    event.player.sendMessage("§7Attach a normal §flever§7 to the top or side, then pull it while facing the direction the castle should extend.");
    event.player.sendMessage("§cWarning: the castle replaces blocks in a 69 × 75 × 52 area.");
});
function findAdjacentHeart(dimension, lever) {
    const offsets = [
        { x: 0, y: -1, z: 0 },
        { x: 0, y: 1, z: 0 },
        { x: -1, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: -1 },
        { x: 0, y: 0, z: 1 },
    ];
    for (const offset of offsets) {
        const location = { x: lever.x + offset.x, y: lever.y + offset.y, z: lever.z + offset.z };
        if (dimension.getBlock(location)?.typeId === HEART_ID)
            return location;
    }
    return undefined;
}
function rotationFromView(view) {
    if (Math.abs(view.x) > Math.abs(view.z))
        return view.x >= 0 ? 1 : 3;
    return view.z >= 0 ? 0 : 2;
}
async function constructCastle(player, dimension, origin, rotation) {
    const builder = new CastleBuilder(dimension, origin, rotation);
    const areaId = `dark_castle_${buildSequence++}`;
    const cornerA = builder.worldPoint({ x: -36, y: -3, z: -2 });
    const cornerB = builder.worldPoint({ x: 36, y: 52, z: 77 });
    player.sendMessage("§8The ancient mechanism accepts your command…");
    player.onScreenDisplay.setTitle("§4§lTHE DARK CASTLE RISES", {
        subtitle: "§7Stone, iron, and dragonfire answer the DDX56",
        fadeInDuration: 5,
        stayDuration: 55,
        fadeOutDuration: 15,
    });
    await world.tickingAreaManager.createTickingArea(areaId, {
        dimension,
        from: {
            x: Math.min(cornerA.x, cornerB.x),
            y: Math.min(cornerA.y, cornerB.y),
            z: Math.min(cornerA.z, cornerB.z),
        },
        to: {
            x: Math.max(cornerA.x, cornerB.x),
            y: Math.max(cornerA.y, cornerB.y),
            z: Math.max(cornerA.z, cornerB.z),
        },
    });
    try {
        builder.set({ x: 0, y: 0, z: 0 }, "minecraft:crying_obsidian");
        await runBuildJob(buildRoyalCastle(builder, player));
    }
    finally {
        world.tickingAreaManager.removeTickingArea(areaId);
    }
    player.playSound("beacon.activate", { volume: 1, pitch: 0.55 });
    player.onScreenDisplay.setTitle("§6§lCASTLE COMPLETE", {
        subtitle: "§7The Black Dragon now watches from above",
        fadeInDuration: 5,
        stayDuration: 70,
        fadeOutDuration: 20,
    });
    player.sendMessage("§6Your furnished royal fortress is complete. §7Enter through the gate behind the Castle Heart.");
}
class CastleBuilder {
    constructor(dimension, origin, rotation) {
        this.dimension = dimension;
        this.origin = origin;
        this.rotation = rotation;
        this.permutations = new Map();
    }
    worldPoint(point) {
        const y = this.origin.y + point.y;
        switch (this.rotation) {
            case 1: return { x: this.origin.x + point.z, y, z: this.origin.z - point.x };
            case 2: return { x: this.origin.x - point.x, y, z: this.origin.z - point.z };
            case 3: return { x: this.origin.x - point.z, y, z: this.origin.z + point.x };
            default: return { x: this.origin.x + point.x, y, z: this.origin.z + point.z };
        }
    }
    permutation(typeId) {
        let value = this.permutations.get(typeId);
        if (!value) {
            value = BlockPermutation.resolve(typeId);
            this.permutations.set(typeId, value);
        }
        return value;
    }
    set(point, typeId) {
        this.dimension.getBlock(this.worldPoint(point))?.setPermutation(this.permutation(typeId));
    }
    fill(a, b, typeId) {
        const wa = this.worldPoint(a);
        const wb = this.worldPoint(b);
        this.dimension.fillBlocks(new BlockVolume({ x: Math.min(wa.x, wb.x), y: Math.min(wa.y, wb.y), z: Math.min(wa.z, wb.z) }, { x: Math.max(wa.x, wb.x), y: Math.max(wa.y, wb.y), z: Math.max(wa.z, wb.z) }), this.permutation(typeId));
    }
    hollow(a, b, wall, floor = wall) {
        this.fill({ x: a.x, y: a.y, z: a.z }, { x: b.x, y: a.y, z: b.z }, floor);
        this.fill({ x: a.x, y: b.y, z: a.z }, { x: b.x, y: b.y, z: b.z }, wall);
        this.fill({ x: a.x, y: a.y + 1, z: a.z }, { x: a.x, y: b.y - 1, z: b.z }, wall);
        this.fill({ x: b.x, y: a.y + 1, z: a.z }, { x: b.x, y: b.y - 1, z: b.z }, wall);
        this.fill({ x: a.x + 1, y: a.y + 1, z: a.z }, { x: b.x - 1, y: b.y - 1, z: a.z }, wall);
        this.fill({ x: a.x + 1, y: a.y + 1, z: b.z }, { x: b.x - 1, y: b.y - 1, z: b.z }, wall);
        if (b.x - a.x > 1 && b.z - a.z > 1 && b.y - a.y > 1) {
            this.fill({ x: a.x + 1, y: a.y + 1, z: a.z + 1 }, { x: b.x - 1, y: b.y - 1, z: b.z - 1 }, "minecraft:air");
        }
    }
}
function* buildRoyalCastle(b, player) {
    const stone = "minecraft:deepslate_bricks";
    const trim = "minecraft:polished_blackstone_bricks";
    const roof = "minecraft:blackstone";
    const floor = "minecraft:polished_deepslate";
    const red = "minecraft:red_nether_bricks";
    const gold = "minecraft:gold_block";
    let stage = 0;
    const progress = (message) => {
        player.onScreenDisplay.setActionBar(`§4DDX56 §8• §7${message}`);
    };
    progress("raising the foundations");
    b.fill({ x: -34, y: -2, z: 3 }, { x: 34, y: -1, z: 75 }, "minecraft:cobbled_deepslate");
    b.fill({ x: -33, y: 0, z: 4 }, { x: 33, y: 0, z: 74 }, floor);
    b.fill({ x: -4, y: 0, z: -1 }, { x: 4, y: 0, z: 27 }, "minecraft:polished_blackstone");
    yield;
    // Outer curtain walls and crenellations.
    progress("raising the curtain walls");
    b.fill({ x: -33, y: 1, z: 4 }, { x: -29, y: 13, z: 74 }, stone);
    b.fill({ x: 29, y: 1, z: 4 }, { x: 33, y: 13, z: 74 }, stone);
    b.fill({ x: -29, y: 1, z: 70 }, { x: 29, y: 13, z: 74 }, stone);
    b.fill({ x: -29, y: 1, z: 4 }, { x: 29, y: 13, z: 8 }, stone);
    b.fill({ x: -4, y: 1, z: 3 }, { x: 4, y: 11, z: 9 }, "minecraft:air");
    b.fill({ x: -5, y: 11, z: 4 }, { x: 5, y: 13, z: 8 }, trim);
    b.fill({ x: -3, y: 1, z: 7 }, { x: 3, y: 8, z: 7 }, "minecraft:iron_bars");
    for (let x = -33; x <= 33; x += 4) {
        b.fill({ x, y: 14, z: 4 }, { x: x + 1, y: 16, z: 7 }, trim);
        b.fill({ x, y: 14, z: 71 }, { x: x + 1, y: 16, z: 74 }, trim);
        if (++stage % 8 === 0)
            yield;
    }
    for (let z = 8; z <= 70; z += 4) {
        b.fill({ x: -33, y: 14, z }, { x: -30, y: 16, z: z + 1 }, trim);
        b.fill({ x: 30, y: 14, z }, { x: 33, y: 16, z: z + 1 }, trim);
        if (++stage % 8 === 0)
            yield;
    }
    // Four massive corner towers.
    progress("forming the four watchtowers");
    for (const [cx, cz] of [[-28, 11], [28, 11], [-28, 67], [28, 67]]) {
        b.hollow({ x: cx - 6, y: 0, z: cz - 6 }, { x: cx + 6, y: 22, z: cz + 6 }, stone, floor);
        b.fill({ x: cx - 7, y: 22, z: cz - 7 }, { x: cx + 7, y: 24, z: cz + 7 }, trim);
        b.fill({ x: cx - 5, y: 24, z: cz - 5 }, { x: cx + 5, y: 26, z: cz + 5 }, roof);
        for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
            b.fill({ x: cx + dx - 1, y: 25, z: cz + dz - 1 }, { x: cx + dx + 1, y: 28, z: cz + dz + 1 }, trim);
            b.set({ x: cx + dx, y: 29, z: cz + dz }, "minecraft:soul_lantern");
        }
        // Arrow-slit windows and internal floors.
        b.fill({ x: cx - 5, y: 10, z: cz - 5 }, { x: cx + 5, y: 10, z: cz + 5 }, floor);
        b.fill({ x: cx - 5, y: 17, z: cz - 5 }, { x: cx + 5, y: 17, z: cz + 5 }, floor);
        b.fill({ x: cx - 1, y: 5, z: cz - 6 }, { x: cx + 1, y: 8, z: cz - 6 }, "minecraft:iron_bars");
        b.fill({ x: cx - 1, y: 13, z: cz - 6 }, { x: cx + 1, y: 15, z: cz - 6 }, "minecraft:iron_bars");
        yield;
    }
    // Great keep: three furnished floors and a high throne hall.
    progress("building the royal keep");
    b.hollow({ x: -23, y: 1, z: 27 }, { x: 23, y: 31, z: 66 }, stone, floor);
    b.fill({ x: -22, y: 10, z: 28 }, { x: 22, y: 10, z: 65 }, floor);
    b.fill({ x: -22, y: 20, z: 28 }, { x: 22, y: 20, z: 65 }, floor);
    // Grand entrance and red carpet.
    b.fill({ x: -3, y: 1, z: 27 }, { x: 3, y: 8, z: 29 }, "minecraft:air");
    b.fill({ x: -2, y: 1, z: 28 }, { x: 2, y: 1, z: 62 }, red);
    for (let y = 4; y <= 28; y += 6) {
        for (const x of [-23, 23]) {
            for (const z of [34, 46, 58]) {
                b.fill({ x, y, z: z - 1 }, { x, y: y + 2, z: z + 1 }, "minecraft:iron_bars");
                b.set({ x: x + (x < 0 ? 1 : -1), y: y + 1, z }, "minecraft:soul_lantern");
            }
        }
        yield;
    }
    // Throne hall columns, chandeliers, dais, and throne.
    progress("furnishing the throne hall");
    for (const x of [-15, -8, 8, 15]) {
        b.fill({ x, y: 1, z: 31 }, { x: x + 1, y: 9, z: 32 }, trim);
        b.fill({ x, y: 1, z: 48 }, { x: x + 1, y: 9, z: 49 }, trim);
    }
    b.fill({ x: -7, y: 1, z: 58 }, { x: 7, y: 3, z: 64 }, trim);
    b.fill({ x: -4, y: 4, z: 61 }, { x: 4, y: 8, z: 64 }, red);
    b.fill({ x: -3, y: 4, z: 60 }, { x: 3, y: 5, z: 63 }, gold);
    b.fill({ x: -2, y: 6, z: 62 }, { x: 2, y: 9, z: 63 }, gold);
    b.set({ x: 0, y: 8, z: 61 }, "minecraft:dragon_head");
    for (const [x, z] of [[-12, 39], [12, 39], [-12, 54], [12, 54]]) {
        b.fill({ x, y: 7, z }, { x, y: 9, z }, "minecraft:chain");
        b.set({ x, y: 6, z }, "minecraft:soul_lantern");
    }
    yield;
    // Ground-floor survival workshop, armory, kitchen, dining room, and storage.
    progress("stocking workshops and royal chambers");
    b.fill({ x: -22, y: 1, z: 42 }, { x: -5, y: 9, z: 42 }, stone);
    b.fill({ x: 5, y: 1, z: 42 }, { x: 22, y: 9, z: 42 }, stone);
    for (const [x, y, z, block] of [
        [-20, 2, 31, "minecraft:crafting_table"], [-18, 2, 31, "minecraft:stonecutter_block"],
        [-16, 2, 31, "minecraft:anvil"], [-14, 2, 31, "minecraft:smithing_table"],
        [-20, 2, 34, "minecraft:furnace"], [-18, 2, 34, "minecraft:blast_furnace"],
        [-16, 2, 34, "minecraft:grindstone"], [-14, 2, 34, "minecraft:chest"],
        [14, 2, 31, "minecraft:smoker"], [16, 2, 31, "minecraft:furnace"],
        [18, 2, 31, "minecraft:barrel"], [20, 2, 31, "minecraft:crafting_table"],
        [14, 2, 38, "minecraft:cauldron"], [20, 2, 38, "minecraft:chest"],
        [-20, 2, 45, "minecraft:chest"], [-18, 2, 45, "minecraft:barrel"],
        [-16, 2, 45, "minecraft:chest"], [-14, 2, 45, "minecraft:barrel"],
    ])
        b.set({ x, y, z }, block);
    // Dining tables and benches.
    b.fill({ x: 9, y: 2, z: 46 }, { x: 19, y: 2, z: 48 }, "minecraft:dark_oak_planks");
    b.fill({ x: 9, y: 1, z: 45 }, { x: 19, y: 1, z: 45 }, "minecraft:dark_oak_stairs");
    b.fill({ x: 9, y: 1, z: 49 }, { x: 19, y: 1, z: 49 }, "minecraft:dark_oak_stairs");
    yield;
    // Second-floor library, enchanting, brewing, bedrooms, and map chamber.
    b.fill({ x: 0, y: 11, z: 28 }, { x: 0, y: 19, z: 65 }, stone);
    b.fill({ x: -22, y: 11, z: 47 }, { x: 22, y: 19, z: 47 }, stone);
    for (let x = -20; x <= -3; x += 3) {
        b.fill({ x, y: 11, z: 30 }, { x: x + 1, y: 14, z: 30 }, "minecraft:bookshelf");
        b.fill({ x, y: 11, z: 44 }, { x: x + 1, y: 14, z: 44 }, "minecraft:bookshelf");
    }
    b.set({ x: -11, y: 11, z: 37 }, "minecraft:enchanting_table");
    for (const [x, z] of [[-14, 35], [-14, 39], [-8, 35], [-8, 39]])
        b.set({ x, y: 11, z }, "minecraft:bookshelf");
    b.set({ x: 10, y: 11, z: 34 }, "minecraft:brewing_stand");
    b.set({ x: 13, y: 11, z: 34 }, "minecraft:cauldron");
    b.set({ x: 16, y: 11, z: 34 }, "minecraft:chest");
    // Royal and guest beds.
    for (const [x, z] of [[-15, 54], [-8, 54], [8, 54], [15, 54]]) {
        b.fill({ x: x - 2, y: 11, z: z - 2 }, { x: x + 2, y: 11, z: z + 4 }, "minecraft:dark_oak_planks");
        b.fill({ x: x - 1, y: 12, z }, { x: x + 1, y: 12, z: z + 2 }, "minecraft:red_wool");
        b.set({ x, y: 13, z: z + 3 }, "minecraft:soul_lantern");
    }
    yield;
    // Treasury and secure upper armory.
    b.fill({ x: -21, y: 21, z: 29 }, { x: 21, y: 21, z: 64 }, "minecraft:dark_oak_planks");
    b.fill({ x: -2, y: 21, z: 48 }, { x: 2, y: 21, z: 61 }, red);
    b.fill({ x: -18, y: 22, z: 52 }, { x: -8, y: 24, z: 62 }, "minecraft:iron_block");
    b.fill({ x: -17, y: 25, z: 53 }, { x: -9, y: 27, z: 61 }, "minecraft:air");
    for (const [x, z, block] of [
        [-16, 55, "minecraft:chest"], [-13, 55, "minecraft:barrel"], [-10, 55, "minecraft:chest"],
        [-16, 59, gold], [-13, 59, "minecraft:emerald_block"], [-10, 59, "minecraft:diamond_block"],
    ])
        b.set({ x, y: 25, z }, block);
    // War room table and banner-like wall strips.
    b.fill({ x: 6, y: 22, z: 34 }, { x: 18, y: 23, z: 43 }, "minecraft:dark_oak_planks");
    b.fill({ x: 8, y: 24, z: 36 }, { x: 16, y: 24, z: 41 }, "minecraft:green_wool");
    for (const x of [-18, -6, 6, 18])
        b.fill({ x, y: 24, z: 65 }, { x: x + 2, y: 29, z: 65 }, red);
    yield;
    // Keep roof, central crown, chimneys, and roof lanterns.
    progress("crowning the keep");
    b.fill({ x: -24, y: 31, z: 26 }, { x: 24, y: 33, z: 67 }, trim);
    b.fill({ x: -20, y: 34, z: 30 }, { x: 20, y: 34, z: 63 }, roof);
    b.fill({ x: -16, y: 35, z: 34 }, { x: 16, y: 35, z: 59 }, roof);
    for (const [x, z] of [[-20, 30], [20, 30], [-20, 63], [20, 63]]) {
        b.fill({ x: x - 1, y: 34, z: z - 1 }, { x: x + 1, y: 39, z: z + 1 }, "minecraft:bricks");
        b.set({ x, y: 40, z }, "minecraft:campfire");
    }
    yield;
    // Chapel and rear portal crypt.
    progress("sealing the crypt and portal chamber");
    b.hollow({ x: -12, y: 1, z: 66 }, { x: 12, y: 15, z: 74 }, stone, floor);
    b.fill({ x: -3, y: 1, z: 66 }, { x: 3, y: 7, z: 67 }, "minecraft:air");
    b.fill({ x: -4, y: 1, z: 71 }, { x: 4, y: 8, z: 73 }, "minecraft:obsidian");
    b.fill({ x: -2, y: 2, z: 71 }, { x: 2, y: 7, z: 73 }, "minecraft:air");
    b.set({ x: -8, y: 2, z: 70 }, "minecraft:respawn_anchor");
    b.set({ x: 8, y: 2, z: 70 }, "minecraft:ender_chest");
    b.fill({ x: -11, y: -1, z: 48 }, { x: -5, y: -1, z: 62 }, "minecraft:iron_block");
    b.fill({ x: -10, y: 0, z: 49 }, { x: -6, y: 0, z: 61 }, "minecraft:air");
    b.fill({ x: -10, y: 0, z: 52 }, { x: -6, y: 0, z: 52 }, "minecraft:iron_bars");
    yield;
    // Courtyard fountain, forge, stable, hay, and compact survival farm.
    progress("finishing the royal courtyard");
    b.fill({ x: -7, y: 1, z: 14 }, { x: 7, y: 1, z: 24 }, trim);
    b.fill({ x: -5, y: 2, z: 16 }, { x: 5, y: 2, z: 22 }, "minecraft:water");
    b.fill({ x: -1, y: 2, z: 18 }, { x: 1, y: 7, z: 20 }, trim);
    b.set({ x: 0, y: 8, z: 19 }, "minecraft:water");
    b.hollow({ x: -27, y: 1, z: 24 }, { x: -16, y: 8, z: 43 }, "minecraft:dark_oak_planks", "minecraft:coarse_dirt");
    b.fill({ x: -26, y: 2, z: 24 }, { x: -17, y: 6, z: 24 }, "minecraft:air");
    b.fill({ x: -26, y: 2, z: 35 }, { x: -17, y: 3, z: 35 }, "minecraft:dark_oak_fence");
    b.fill({ x: -25, y: 2, z: 40 }, { x: -18, y: 4, z: 42 }, "minecraft:hay_block");
    b.hollow({ x: 16, y: 1, z: 14 }, { x: 27, y: 8, z: 25 }, stone, floor);
    b.fill({ x: 19, y: 1, z: 17 }, { x: 24, y: 1, z: 22 }, "minecraft:magma");
    b.set({ x: 18, y: 2, z: 16 }, "minecraft:anvil");
    b.set({ x: 20, y: 2, z: 16 }, "minecraft:smithing_table");
    b.set({ x: 22, y: 2, z: 16 }, "minecraft:blast_furnace");
    b.set({ x: 24, y: 2, z: 16 }, "minecraft:chest");
    // Farm beds separated by irrigation.
    b.fill({ x: 15, y: 1, z: 10 }, { x: 26, y: 1, z: 12 }, "minecraft:farmland");
    b.fill({ x: 20, y: 1, z: 10 }, { x: 21, y: 1, z: 12 }, "minecraft:water");
    for (let x = 15; x <= 26; x++) {
        if (x === 20 || x === 21)
            continue;
        for (let z = 10; z <= 12; z++)
            b.set({ x, y: 2, z }, "minecraft:wheat");
    }
    yield;
    // The enormous Black Dragon sculpture: body, head, horns, tail, legs, and broad wings.
    progress("awakening the rooftop dragon");
    const dragon = "minecraft:black_concrete";
    const scale = "minecraft:polished_blackstone";
    // Body and armored spine.
    for (let z = 39; z <= 57; z++) {
        const width = z < 44 ? 2 : z < 53 ? 3 : 2;
        const y = 39 + Math.floor((z - 39) / 7);
        b.fill({ x: -width, y, z }, { x: width, y: y + 3, z: z + 1 }, dragon);
        b.fill({ x: -1, y: y + 4, z }, { x: 1, y: y + 4, z: z + 1 }, scale);
        if (z % 3 === 0)
            yield;
    }
    // Neck, horned head, jaws, eyes, and teeth.
    b.fill({ x: -2, y: 40, z: 34 }, { x: 2, y: 48, z: 41 }, dragon);
    b.fill({ x: -4, y: 45, z: 29 }, { x: 4, y: 49, z: 36 }, dragon);
    b.fill({ x: -3, y: 43, z: 27 }, { x: 3, y: 45, z: 34 }, scale);
    b.fill({ x: -2, y: 44, z: 26 }, { x: 2, y: 44, z: 29 }, "minecraft:air");
    b.set({ x: -4, y: 47, z: 28 }, "minecraft:redstone_block");
    b.set({ x: 4, y: 47, z: 28 }, "minecraft:redstone_block");
    for (const x of [-3, -1, 1, 3])
        b.set({ x, y: 43, z: 28 }, "minecraft:quartz_block");
    b.fill({ x: -5, y: 49, z: 34 }, { x: -3, y: 53, z: 36 }, "minecraft:deepslate_tile_wall");
    b.fill({ x: 3, y: 49, z: 34 }, { x: 5, y: 53, z: 36 }, "minecraft:deepslate_tile_wall");
    // Long curling tail.
    const tail = [
        { x: 0, y: 42, z: 58 }, { x: 1, y: 42, z: 61 }, { x: 3, y: 41, z: 64 },
        { x: 6, y: 40, z: 66 }, { x: 9, y: 39, z: 67 }, { x: 12, y: 38, z: 66 },
        { x: 14, y: 37, z: 64 }, { x: 15, y: 37, z: 61 },
    ];
    for (let i = 0; i < tail.length - 1; i++)
        b.fill(tail[i], tail[i + 1], i < 4 ? dragon : scale);
    // Powerful legs and gold claws.
    for (const [x, z] of [[-5, 48], [5, 48], [-5, 57], [5, 57]]) {
        b.fill({ x: x - 1, y: 35, z: z - 1 }, { x: x + 1, y: 41, z: z + 1 }, dragon);
        b.fill({ x: x - 2, y: 35, z: z - 2 }, { x: x + 2, y: 35, z: z + 2 }, scale);
        b.set({ x: x - 2, y: 35, z: z - 3 }, "minecraft:gold_block");
        b.set({ x: x + 2, y: 35, z: z - 3 }, "minecraft:gold_block");
    }
    yield;
    // Giant spread wings with thick ribs and layered dark membranes.
    for (const side of [-1, 1]) {
        for (let span = 4; span <= 29; span++) {
            const x = side * span;
            const front = 39 + Math.floor(span * 0.42);
            const back = 58 - Math.floor(span * 0.55);
            const wingY = 47 - Math.floor(span * 0.22);
            if (front <= back)
                b.fill({ x, y: wingY, z: front }, { x, y: wingY, z: back }, "minecraft:black_wool");
            if (span % 5 === 0) {
                b.fill({ x: side * 3, y: 46, z: 46 }, { x, y: wingY + 1, z: front }, scale);
                b.fill({ x, y: wingY, z: front }, { x, y: wingY + 2, z: back }, scale);
            }
            if (span % 3 === 0)
                yield;
        }
        // Wing-tip talons.
        b.fill({ x: side * 30, y: 40, z: 49 }, { x: side * 32, y: 43, z: 51 }, "minecraft:deepslate_tile_wall");
    }
    // Soul-fire braziers and final lighting throughout the courtyard.
    progress("lighting the final braziers");
    for (const [x, z] of [[-12, 10], [12, 10], [-12, 24], [12, 24], [-26, 47], [26, 47], [-26, 60], [26, 60]]) {
        b.fill({ x, y: 1, z }, { x, y: 3, z }, trim);
        b.set({ x, y: 4, z }, "minecraft:soul_campfire");
    }
    // A fiery breath plume suspended over the front roof.
    b.fill({ x: -1, y: 43, z: 22 }, { x: 1, y: 44, z: 26 }, "minecraft:magma");
    b.fill({ x: 0, y: 42, z: 18 }, { x: 0, y: 43, z: 21 }, "minecraft:shroomlight");
    progress("construction complete");
}
function runBuildJob(job) {
    return new Promise((resolve, reject) => {
        function* guardedJob() {
            try {
                yield* job;
                resolve();
            }
            catch (error) {
                reject(error);
            }
        }
        system.runJob(guardedJob());
    });
}
function formatError(error) {
    return error instanceof Error ? error.message : String(error);
}
