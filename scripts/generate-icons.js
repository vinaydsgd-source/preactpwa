/* eslint-disable */
/**
 * Generates placeholder PWA icons into src/assets/icons/ using only Node built-ins.
 * Outputs:
 *   icon-192.png             (192x192, RGBA, gradient + "P")
 *   icon-512.png             (512x512, RGBA, gradient + "P")
 *   icon-maskable-512.png    (512x512, RGBA, full-bleed background, "P" inside safe zone)
 *   apple-touch-icon-180.png (180x180, RGB,  opaque - iOS requirement)
 *
 * Re-run with: `node scripts/generate-icons.js`
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'icons');

// ---------- CRC32 (PNG spec) ----------
const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		t[n] = c >>> 0;
	}
	return t;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const typeBuf = Buffer.from(type, 'ascii');
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
	return Buffer.concat([len, typeBuf, data, crc]);
}

// ---------- PNG encoders ----------
function encodePngRGBA(width, height, pixels /* Buffer length=w*h*4 */) {
	return encodePng(width, height, pixels, 4, 6);
}
function encodePngRGB(width, height, pixels /* Buffer length=w*h*3 */) {
	return encodePng(width, height, pixels, 3, 2);
}

function encodePng(width, height, pixels, channels, colorType) {
	const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8;
	ihdr[9] = colorType;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	const stride = width * channels;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0;
		pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	}
	const idat = zlib.deflateSync(raw, { level: 9 });

	return Buffer.concat([
		sig,
		chunk('IHDR', ihdr),
		chunk('IDAT', idat),
		chunk('IEND', Buffer.alloc(0)),
	]);
}

// ---------- Drawing primitives ----------
const COLOR_A = [0x63, 0x66, 0xf1]; // brand
const COLOR_B = [0xec, 0x48, 0x99]; // accent
const COLOR_BG_OPAQUE = [0x0f, 0x17, 0x2a]; // dark background for opaque icons

function lerp(a, b, t) {
	return Math.round(a + (b - a) * t);
}

function gradientPixel(x, y, w, h) {
	// Diagonal gradient top-left -> bottom-right
	const t = (x / (w - 1) + y / (h - 1)) / 2;
	return [
		lerp(COLOR_A[0], COLOR_B[0], t),
		lerp(COLOR_A[1], COLOR_B[1], t),
		lerp(COLOR_A[2], COLOR_B[2], t),
	];
}

// Pixel-art mask of letter "P" (1 = letter, 0 = background) on a 10x12 grid
const P_MASK = [
	'1111111000',
	'1111111100',
	'1100001110',
	'1100001110',
	'1100001110',
	'1100001110',
	'1100001110',
	'1111111100',
	'1111111000',
	'1100000000',
	'1100000000',
	'1100000000',
];

function drawLetterP(buffer, channels, canvasW, canvasH, opts) {
	const { centerX, centerY, sizeFraction = 0.55, color = [255, 255, 255], alpha = 255 } = opts;
	const maskW = P_MASK[0].length;
	const maskH = P_MASK.length;
	const target = Math.min(canvasW, canvasH) * sizeFraction;
	const scale = Math.floor(target / maskH);
	const drawW = maskW * scale;
	const drawH = maskH * scale;
	const startX = Math.round(centerX - drawW / 2);
	const startY = Math.round(centerY - drawH / 2);

	for (let my = 0; my < maskH; my++) {
		for (let mx = 0; mx < maskW; mx++) {
			if (P_MASK[my][mx] !== '1') continue;
			for (let dy = 0; dy < scale; dy++) {
				for (let dx = 0; dx < scale; dx++) {
					const x = startX + mx * scale + dx;
					const y = startY + my * scale + dy;
					if (x < 0 || y < 0 || x >= canvasW || y >= canvasH) continue;
					const idx = (y * canvasW + x) * channels;
					buffer[idx] = color[0];
					buffer[idx + 1] = color[1];
					buffer[idx + 2] = color[2];
					if (channels === 4) buffer[idx + 3] = alpha;
				}
			}
		}
	}
}

// ---------- Icon builders ----------
function buildRgbaIcon(size, { fullBleed = true, letterFraction = 0.55 } = {}) {
	const buf = Buffer.alloc(size * size * 4);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const idx = (y * size + x) * 4;
			const [r, g, b] = gradientPixel(x, y, size, size);
			buf[idx] = r;
			buf[idx + 1] = g;
			buf[idx + 2] = b;
			buf[idx + 3] = 255;
		}
	}
	drawLetterP(buf, 4, size, size, {
		centerX: size / 2,
		centerY: size / 2,
		sizeFraction: letterFraction,
	});
	return buf;
}

function buildRgbIcon(size, { letterFraction = 0.55 } = {}) {
	const buf = Buffer.alloc(size * size * 3);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const idx = (y * size + x) * 3;
			const [r, g, b] = gradientPixel(x, y, size, size);
			buf[idx] = r;
			buf[idx + 1] = g;
			buf[idx + 2] = b;
		}
	}
	drawLetterP(buf, 3, size, size, {
		centerX: size / 2,
		centerY: size / 2,
		sizeFraction: letterFraction,
	});
	return buf;
}

function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function writeIcon(file, png) {
	const full = path.join(OUT_DIR, file);
	fs.writeFileSync(full, png);
	console.log(`  wrote ${path.relative(process.cwd(), full)}  (${png.length.toLocaleString()} bytes)`);
}

function main() {
	ensureDir(OUT_DIR);
	console.log(`Generating PWA icons -> ${OUT_DIR}`);

	const px192 = buildRgbaIcon(192, { letterFraction: 0.55 });
	writeIcon('icon-192.png', encodePngRGBA(192, 192, px192));

	const px512 = buildRgbaIcon(512, { letterFraction: 0.55 });
	writeIcon('icon-512.png', encodePngRGBA(512, 512, px512));

	// Maskable: keep letter inside ~80% safe zone (smaller fraction)
	const pxMask = buildRgbaIcon(512, { letterFraction: 0.42 });
	writeIcon('icon-maskable-512.png', encodePngRGBA(512, 512, pxMask));

	// iOS apple-touch-icon: opaque RGB, 180x180
	const pxApple = buildRgbIcon(180, { letterFraction: 0.55 });
	writeIcon('apple-touch-icon-180.png', encodePngRGB(180, 180, pxApple));

	console.log('Done.');
}

main();
