import {
  BlockPermutation,
  BlockVolume,
  Dimension,
  DimensionLocation,
  Player,
  Vector3,
  system,
  world,
} from "@minecraft/server";

const REALM_ID = "crystal_void:realm";
const CRYSTAL_ID = "crystal_void:dimension_crystal";
const ANCHOR_ID = "crystal_void:void_anchor";
const VOIDSTONE_ID = "crystal_void:voidstone";

const REALM_FLOOR_Y = 80;
const REALM_ARRIVAL: Vector3 = { x: 0.5, y: REALM_FLOOR_Y + 1, z: 5.5 };
const REALM_CENTER: Vector3 = { x: 0.5, y: REALM_FLOOR_Y + 1, z: 0.5 };
const MARKER_LOCATION: Vector3 = { x: 0, y: 60, z: 0 };

const RETURN_DIMENSION = "crystal_void:return_dimension";
const RETURN_X = "crystal_void:return_x";
const RETURN_Y = "crystal_void:return_y";
const RETURN_Z = "crystal_void:return_z";

const busyPlayers = new Set<string>();
let realmBuildPromise: Promise<void> | undefined;
let tickingAreaSequence = 0;

// Script-created dimensions must be registered during startup.
system.beforeEvents.startup.subscribe((event) => {
  event.dimensionRegistry.registerCustomDimension(REALM_ID);
});

// A Dimension Crystal activates any Void Anchor. The same interaction returns
// the player when it is performed inside the Crystal Void.
world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  const heldItem = event.beforeItemStack ?? event.itemStack;
  if (event.block.typeId !== ANCHOR_ID || heldItem?.typeId !== CRYSTAL_ID) {
    return;
  }

  const player = event.player;
  if (busyPlayers.has(player.id)) {
    player.onScreenDisplay.setActionBar("§dThe anchor is already responding…");
    return;
  }

  busyPlayers.add(player.id);
  system.run(() => {
    void useVoidAnchor(player)
      .catch((error: unknown) => {
        try {
          player.sendMessage(`§cThe Void Anchor failed: ${formatError(error)}`);
        } catch {
          // The player may have left while the asynchronous teleport was running.
        }
      })
      .finally(() => busyPlayers.delete(player.id));
  });
});

world.afterEvents.playerPlaceBlock.subscribe((event) => {
  if (event.block.typeId === ANCHOR_ID) {
    event.player.sendMessage("§5Void Anchor placed. §rHold a §dDimension Crystal§r and tap the anchor.");
  }
});

async function useVoidAnchor(player: Player): Promise<void> {
  playPortalSound(player, 0.7);

  if (player.dimension.id === REALM_ID) {
    await returnFromRealm(player);
    return;
  }

  rememberReturnPoint(player);
  player.sendMessage("§5The crystal hums as a new realm takes shape…");
  player.onScreenDisplay.setActionBar("§dOpening the Crystal Void…");

  await ensureRealmBuilt();
  const realm = world.getDimension(REALM_ID);
  await teleportWithLoadedArea(player, realm, REALM_ARRIVAL, REALM_CENTER);

  protectArrival(player);
  playPortalSound(player, 1.2);
  player.onScreenDisplay.setTitle("§5§lThe Crystal Void§r", {
    subtitle: "§dA world between worlds",
    fadeInDuration: 10,
    stayDuration: 60,
    fadeOutDuration: 20,
  });
  player.sendMessage("§7Use the §dDimension Crystal§7 on the central §5Void Anchor§7 to return.");
}

async function returnFromRealm(player: Player): Promise<void> {
  const destination = getReturnPoint(player);
  player.onScreenDisplay.setActionBar("§dThe anchor remembers your world…");

  await teleportWithLoadedArea(
    player,
    destination.dimension,
    destination,
    { x: destination.x, y: destination.y, z: destination.z + 1 },
  );

  protectArrival(player);
  playPortalSound(player, 0.9);
  player.onScreenDisplay.setTitle("§aReturned", {
    subtitle: "§7The Crystal Void fades behind you",
    fadeInDuration: 5,
    stayDuration: 35,
    fadeOutDuration: 15,
  });
}

function rememberReturnPoint(player: Player): void {
  player.setDynamicProperty(RETURN_DIMENSION, player.dimension.id);
  player.setDynamicProperty(RETURN_X, player.location.x);
  player.setDynamicProperty(RETURN_Y, player.location.y);
  player.setDynamicProperty(RETURN_Z, player.location.z);
}

function getReturnPoint(player: Player): DimensionLocation {
  const dimensionId = player.getDynamicProperty(RETURN_DIMENSION);
  const x = player.getDynamicProperty(RETURN_X);
  const y = player.getDynamicProperty(RETURN_Y);
  const z = player.getDynamicProperty(RETURN_Z);

  if (
    typeof dimensionId === "string" &&
    typeof x === "number" &&
    typeof y === "number" &&
    typeof z === "number"
  ) {
    return { dimension: world.getDimension(dimensionId), x, y, z };
  }

  const personalSpawn = player.getSpawnPoint();
  if (personalSpawn) {
    return {
      dimension: personalSpawn.dimension,
      x: personalSpawn.x + 0.5,
      y: personalSpawn.y + 1,
      z: personalSpawn.z + 0.5,
    };
  }

  const worldSpawn = world.getDefaultSpawnLocation();
  return {
    dimension: world.getDimension("minecraft:overworld"),
    x: worldSpawn.x + 0.5,
    y: worldSpawn.y > 320 ? 100 : worldSpawn.y + 1,
    z: worldSpawn.z + 0.5,
  };
}

async function teleportWithLoadedArea(
  player: Player,
  dimension: Dimension,
  destination: Vector3,
  facingLocation: Vector3,
): Promise<void> {
  const areaId = `crystal_void_travel_${tickingAreaSequence++}`;
  const from = {
    x: Math.floor(destination.x) - 4,
    y: Math.floor(destination.y) - 4,
    z: Math.floor(destination.z) - 4,
  };
  const to = {
    x: Math.floor(destination.x) + 4,
    y: Math.floor(destination.y) + 4,
    z: Math.floor(destination.z) + 4,
  };

  await world.tickingAreaManager.createTickingArea(areaId, { dimension, from, to });
  try {
    player.teleport(destination, { dimension, facingLocation });
  } finally {
    world.tickingAreaManager.removeTickingArea(areaId);
  }
}

function ensureRealmBuilt(): Promise<void> {
  if (!realmBuildPromise) {
    realmBuildPromise = buildRealmIfNeeded().catch((error: unknown) => {
      realmBuildPromise = undefined;
      throw error;
    });
  }
  return realmBuildPromise;
}

async function buildRealmIfNeeded(): Promise<void> {
  const realm = world.getDimension(REALM_ID);
  const areaId = "crystal_void_realm_setup";

  await world.tickingAreaManager.createTickingArea(areaId, {
    dimension: realm,
    from: { x: -20, y: 58, z: -20 },
    to: { x: 20, y: 90, z: 20 },
  });

  try {
    const marker = realm.getBlock(MARKER_LOCATION);
    if (marker?.typeId === "minecraft:bedrock") {
      return;
    }

    await runBuildJob(createRealmBuildSteps(realm));
  } finally {
    world.tickingAreaManager.removeTickingArea(areaId);
  }
}

function* createRealmBuildSteps(realm: Dimension): Generator<void, void, void> {
  const voidstone = BlockPermutation.resolve(VOIDSTONE_ID);
  const cryingObsidian = BlockPermutation.resolve("minecraft:crying_obsidian");
  const obsidian = BlockPermutation.resolve("minecraft:obsidian");
  const amethyst = BlockPermutation.resolve("minecraft:amethyst_block");
  const buddingAmethyst = BlockPermutation.resolve("minecraft:budding_amethyst");
  const glowstone = BlockPermutation.resolve("minecraft:glowstone");
  const endRod = BlockPermutation.resolve("minecraft:end_rod");
  const anchor = BlockPermutation.resolve(ANCHOR_ID);
  const bedrock = BlockPermutation.resolve("minecraft:bedrock");

  let operations = 0;

  // Build a tapered floating island one horizontal strip at a time.
  const radii = [16, 15, 14, 13, 12, 11, 9, 8, 7, 6, 5, 4, 2];
  for (let depth = 0; depth < radii.length; depth++) {
    const y = REALM_FLOOR_Y - depth;
    const radius = radii[depth];
    const layerBlock = depth === 3 || depth === 7 ? cryingObsidian : voidstone;

    for (let z = -radius; z <= radius; z++) {
      const halfWidth = Math.floor(Math.sqrt(radius * radius - z * z));
      realm.fillBlocks(
        new BlockVolume({ x: -halfWidth, y, z }, { x: halfWidth, y, z }),
        layerBlock,
      );

      operations++;
      if (operations % 18 === 0) {
        yield;
      }
    }
  }

  // Etch an amethyst ring and four runes into the top surface.
  for (let x = -15; x <= 15; x++) {
    for (let z = -15; z <= 15; z++) {
      const distanceSquared = x * x + z * z;
      if (distanceSquared >= 18 && distanceSquared <= 27) {
        setBlock(realm, { x, y: REALM_FLOOR_Y, z }, amethyst);
      } else if ((Math.abs(x) === Math.abs(z) && Math.abs(x) <= 3) || (x === 0 && Math.abs(z) <= 3)) {
        setBlock(realm, { x, y: REALM_FLOOR_Y, z }, cryingObsidian);
      }
    }
    if (x % 4 === 0) {
      yield;
    }
  }

  // The return anchor sits in the center of the island.
  setBlock(realm, { x: 0, y: REALM_FLOOR_Y + 1, z: 0 }, anchor);

  // Hand-built crystal spires make the otherwise empty realm feel alive.
  const spires = [
    { x: -10, z: -8, height: 5 },
    { x: 10, z: -7, height: 7 },
    { x: -9, z: 9, height: 6 },
    { x: 10, z: 8, height: 4 },
    { x: 0, z: -12, height: 5 },
    { x: -13, z: 1, height: 3 },
    { x: 13, z: 2, height: 3 },
  ];

  for (const spire of spires) {
    setBlock(realm, { x: spire.x, y: REALM_FLOOR_Y, z: spire.z }, obsidian);
    setBlock(realm, { x: spire.x + 1, y: REALM_FLOOR_Y, z: spire.z }, amethyst);
    setBlock(realm, { x: spire.x - 1, y: REALM_FLOOR_Y, z: spire.z }, amethyst);
    setBlock(realm, { x: spire.x, y: REALM_FLOOR_Y, z: spire.z + 1 }, buddingAmethyst);
    setBlock(realm, { x: spire.x, y: REALM_FLOOR_Y, z: spire.z - 1 }, amethyst);

    for (let y = 1; y <= spire.height; y++) {
      const material = y === spire.height ? glowstone : y % 2 === 0 ? buddingAmethyst : amethyst;
      setBlock(realm, { x: spire.x, y: REALM_FLOOR_Y + y, z: spire.z }, material);
    }
    yield;
  }

  // Four lights mark the safe arrival area.
  for (const [x, z] of [
    [-4, -4],
    [4, -4],
    [-4, 4],
    [4, 4],
  ] as const) {
    setBlock(realm, { x, y: REALM_FLOOR_Y + 1, z }, cryingObsidian);
    setBlock(realm, { x, y: REALM_FLOOR_Y + 2, z }, endRod);
  }

  // A hidden marker prevents rebuilding the island every time the world opens.
  setBlock(realm, MARKER_LOCATION, bedrock);
}

function setBlock(dimension: Dimension, location: Vector3, permutation: BlockPermutation): void {
  dimension.getBlock(location)?.setPermutation(permutation);
}

function runBuildJob(job: Generator<void, void, void>): Promise<void> {
  return new Promise((resolve, reject) => {
    function* guardedJob(): Generator<void, void, void> {
      try {
        yield* job;
        resolve();
      } catch (error: unknown) {
        reject(error);
      }
    }

    system.runJob(guardedJob());
  });
}

function protectArrival(player: Player): void {
  try {
    player.addEffect("resistance", 80, { amplifier: 4, showParticles: false });
  } catch {
    // Teleporting still succeeds if an effect cannot be applied.
  }
}

function playPortalSound(player: Player, pitch: number): void {
  try {
    player.playSound("portal.travel", { volume: 0.65, pitch });
  } catch {
    // Sound availability can vary across game builds; travel should not.
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
