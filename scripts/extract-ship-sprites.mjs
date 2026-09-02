import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const source = path.resolve("scripts/assets/ship-sprite-sheet-transparent.png");
const outputDirectory = path.resolve("app/assets/ships");
const columns = 5;
const rows = 6;
const outputSize = 192;
const cellGutter = 18;

await fs.mkdir(outputDirectory, { recursive: true });
const metadata = await sharp(source).metadata();
if (!metadata.width || !metadata.height) throw new Error("Ship atlas has no dimensions.");

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const index = row * columns + column + 1;
    const left = Math.round(column * metadata.width / columns) + cellGutter;
    const top = Math.round(row * metadata.height / rows) + cellGutter;
    const right = Math.round((column + 1) * metadata.width / columns) - cellGutter;
    const bottom = Math.round((row + 1) * metadata.height / rows) - cellGutter;
    const width = right - left;
    const height = bottom - top;

    const cell = await sharp(source)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();
    const trimmed = await sharp(cell)
      .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
      .resize({ width: 164, height: 164, fit: "inside", withoutEnlargement: false })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer({ resolveWithObject: true });

    const horizontal = Math.max(0, Math.floor((outputSize - trimmed.info.width) / 2));
    const vertical = Math.max(0, Math.floor((outputSize - trimmed.info.height) / 2));
    await sharp({
      create: {
        width: outputSize,
        height: outputSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: trimmed.data, left: horizontal, top: vertical }])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path.join(outputDirectory, `ship-${String(index).padStart(2, "0")}.png`));
  }
}

console.log(`Extracted ${columns * rows} transparent ship sprites into ${outputDirectory}`);
