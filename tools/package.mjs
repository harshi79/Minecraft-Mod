import { createWriteStream } from "node:fs";
import { mkdir, rename, rm } from "node:fs/promises";
import { resolve } from "node:path";
import archiver from "archiver";

const root = resolve(import.meta.dirname, "..");
const releaseDir = resolve(root, "release");
const outputPath = resolve(releaseDir, "DarkMedievalCastle-v1.0.0.mcaddon");
const temporaryPath = `${outputPath}.tmp`;
await mkdir(releaseDir, { recursive: true });
await rm(temporaryPath, { force: true });
await new Promise((resolvePromise, rejectPromise) => {
  const output = createWriteStream(temporaryPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  output.on("close", resolvePromise);
  output.on("error", rejectPromise);
  archive.on("warning", (error) => error.code === "ENOENT" ? console.warn(error.message) : rejectPromise(error));
  archive.on("error", rejectPromise);
  archive.pipe(output);
  archive.directory(resolve(root, "packs/DarkCastle_BP"), "DarkCastle_BP");
  archive.directory(resolve(root, "packs/DarkCastle_RP"), "DarkCastle_RP");
  void archive.finalize();
});
await rm(outputPath, { force: true });
await rename(temporaryPath, outputPath);
console.log(`created ${outputPath}`);
