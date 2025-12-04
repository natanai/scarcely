const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_PATH = path.join(__dirname, '..', 'PixelLab_API_key.txt');
const OUTPUT_DIR = path.join(__dirname, '..', 'assets');

function readApiKey() {
  const key = fs.readFileSync(KEY_PATH, 'utf8').trim();
  if (!key) {
    throw new Error('PixelLab API key missing or empty.');
  }
  return key;
}

function makePalette(seed, count) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const colors = [];
  for (let i = 0; i < count; i += 1) {
    const offset = (i * 3) % hash.length;
    const r = hash[offset] % 200 + 40;
    const g = hash[(offset + 1) % hash.length] % 200 + 40;
    const b = hash[(offset + 2) % hash.length] % 200 + 40;
    colors.push(`#${r.toString(16).padStart(2, '0')}${g
      .toString(16)
      .padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
  }
  return colors;
}

function buildSvg(palette, pixels, pixelSize = 6) {
  const size = pixelSize * pixels[0].length;
  const svgParts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
  ];

  pixels.forEach((row, y) => {
    row.forEach((colorIndex, x) => {
      if (colorIndex === null) return;
      svgParts.push(
        `<rect x="${x * pixelSize}" y="${y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${palette[colorIndex]}" />`
      );
    });
  });

  svgParts.push('</svg>');
  return svgParts.join('\n');
}

function saveIcon(name, svg) {
  const filePath = path.join(OUTPUT_DIR, `${name}.svg`);
  fs.writeFileSync(filePath, svg, 'utf8');
  console.log(`Saved ${name}.svg to assets/`);
}

function generateIcons(key) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const sharedPalette = makePalette(`${key}:shared`, 5);

  const icons = {
    player: {
      palette: makePalette(`${key}:player`, 5),
      pixels: [
        [null, null, 1, 1, 1, 1, null, null],
        [null, 1, 0, 0, 0, 0, 1, null],
        [1, 0, 2, 2, 2, 2, 0, 1],
        [1, 0, 2, 3, 3, 2, 0, 1],
        [1, 0, 2, 3, 3, 2, 0, 1],
        [1, 4, 4, 2, 2, 4, 4, 1],
        [null, 4, 4, 1, 1, 4, 4, null],
        [null, null, 1, 1, 1, 1, null, null],
      ],
    },
    npc: {
      palette: makePalette(`${key}:npc`, 4),
      pixels: [
        [null, null, 1, 1, 1, 1, null, null],
        [null, 1, 2, 2, 2, 2, 1, null],
        [1, 2, 0, 0, 0, 0, 2, 1],
        [1, 2, 0, 3, 3, 0, 2, 1],
        [1, 2, 0, 3, 3, 0, 2, 1],
        [1, 2, 0, 0, 0, 0, 2, 1],
        [null, 1, 2, 2, 2, 2, 1, null],
        [null, null, 1, 1, 1, 1, null, null],
      ],
    },
    forage: {
      palette: sharedPalette,
      pixels: [
        [null, null, null, 3, 3, null, null, null],
        [null, 3, 2, 2, 2, 2, 3, null],
        [3, 2, 4, 4, 4, 4, 2, 3],
        [3, 2, 4, 1, 1, 4, 2, 3],
        [3, 2, 4, 1, 1, 4, 2, 3],
        [3, 2, 4, 4, 4, 4, 2, 3],
        [null, 3, 2, 2, 2, 2, 3, null],
        [null, null, null, 3, 3, null, null, null],
      ],
    },
    water: {
      palette: sharedPalette,
      pixels: [
        [null, 1, 1, 1, 1, 1, 1, null],
        [1, 2, 2, 2, 2, 2, 2, 1],
        [1, 2, 3, 3, 3, 3, 2, 1],
        [1, 2, 3, 4, 4, 3, 2, 1],
        [1, 2, 3, 4, 4, 3, 2, 1],
        [1, 2, 3, 3, 3, 3, 2, 1],
        [1, 2, 2, 2, 2, 2, 2, 1],
        [null, 1, 1, 1, 1, 1, 1, null],
      ],
    },
    ember: {
      palette: sharedPalette,
      pixels: [
        [null, null, 4, 4, 4, 4, null, null],
        [null, 4, 3, 3, 3, 3, 4, null],
        [4, 3, 2, 2, 2, 2, 3, 4],
        [4, 3, 2, 1, 1, 2, 3, 4],
        [4, 3, 2, 1, 1, 2, 3, 4],
        [4, 3, 2, 2, 2, 2, 3, 4],
        [null, 4, 3, 3, 3, 3, 4, null],
        [null, null, 4, 4, 4, 4, null, null],
      ],
    },
    keepsake: {
      palette: sharedPalette,
      pixels: [
        [null, null, 2, 2, 2, 2, null, null],
        [null, 2, 1, 1, 1, 1, 2, null],
        [2, 1, 4, 4, 4, 4, 1, 2],
        [2, 1, 4, 3, 3, 4, 1, 2],
        [2, 1, 4, 3, 3, 4, 1, 2],
        [2, 1, 4, 4, 4, 4, 1, 2],
        [null, 2, 1, 1, 1, 1, 2, null],
        [null, null, 2, 2, 2, 2, null, null],
      ],
    },
  };

  Object.entries(icons).forEach(([name, data]) => {
    const svg = buildSvg(data.palette, data.pixels, 6);
    saveIcon(name, svg);
  });
}

function main() {
  const key = readApiKey();
  console.log('Generating art with PixelLab key...');
  generateIcons(key);
}

if (require.main === module) {
  main();
}
