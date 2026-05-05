/* eslint-disable */
/**
 * Generates all PWA assets (icons + install screenshots) using only Node built-ins.
 *
 * Outputs to src/assets/icons/ and src/assets/screenshots/.
 *
 * Run: `node scripts/generate-pwa-assets.js`  (or `npm run generate:assets`)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'src', 'assets', 'icons');
const SHOTS_DIR = path.join(ROOT, 'src', 'assets', 'screenshots');

// ============================================================
// Low-level PNG encoder (no deps)
// ============================================================
const CRC_TABLE = (() => {
	const t = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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

const encodePngRGBA = (w, h, px) => encodePng(w, h, px, 4, 6);
const encodePngRGB = (w, h, px) => encodePng(w, h, px, 3, 2);

// ============================================================
// Drawing primitives (operating on a typed pixel buffer)
// ============================================================
const COLOR_BRAND = [0x63, 0x66, 0xf1];
const COLOR_ACCENT = [0xec, 0x48, 0x99];
const COLOR_DARK_BG = [0x0b, 0x11, 0x20];
const COLOR_DARK_SURFACE = [0x1f, 0x29, 0x37];
const COLOR_BORDER = [0x33, 0x3d, 0x4d];
const COLOR_TEXT = [0xf8, 0xfa, 0xfc];
const COLOR_MUTED = [0x94, 0xa3, 0xb8];
const WHITE = [0xff, 0xff, 0xff];

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function setPixel(buf, channels, w, x, y, color, alpha) {
	const idx = (y * w + x) * channels;
	buf[idx] = color[0];
	buf[idx + 1] = color[1];
	buf[idx + 2] = color[2];
	if (channels === 4) buf[idx + 3] = alpha == null ? 255 : alpha;
}

function fillRect(buf, channels, w, h, x0, y0, rw, rh, color, alpha) {
	const x1 = Math.max(0, Math.floor(x0));
	const y1 = Math.max(0, Math.floor(y0));
	const x2 = Math.min(w, Math.floor(x0 + rw));
	const y2 = Math.min(h, Math.floor(y0 + rh));
	for (let y = y1; y < y2; y++) {
		for (let x = x1; x < x2; x++) setPixel(buf, channels, w, x, y, color, alpha);
	}
}

// Cheap rounded rect via a circular distance check on the corners
function fillRoundedRect(buf, channels, w, h, x0, y0, rw, rh, radius, color, alpha) {
	const r = Math.max(0, Math.min(radius, Math.min(rw, rh) / 2));
	const x1 = Math.max(0, Math.floor(x0));
	const y1 = Math.max(0, Math.floor(y0));
	const x2 = Math.min(w, Math.floor(x0 + rw));
	const y2 = Math.min(h, Math.floor(y0 + rh));
	for (let y = y1; y < y2; y++) {
		for (let x = x1; x < x2; x++) {
			let inside = true;
			if (x < x0 + r && y < y0 + r) {
				inside = (x0 + r - x) ** 2 + (y0 + r - y) ** 2 <= r * r;
			} else if (x >= x0 + rw - r && y < y0 + r) {
				inside = (x - (x0 + rw - r - 1)) ** 2 + (y0 + r - y) ** 2 <= r * r;
			} else if (x < x0 + r && y >= y0 + rh - r) {
				inside = (x0 + r - x) ** 2 + (y - (y0 + rh - r - 1)) ** 2 <= r * r;
			} else if (x >= x0 + rw - r && y >= y0 + rh - r) {
				inside = (x - (x0 + rw - r - 1)) ** 2 + (y - (y0 + rh - r - 1)) ** 2 <= r * r;
			}
			if (inside) setPixel(buf, channels, w, x, y, color, alpha);
		}
	}
}

function fillGradient(buf, channels, w, h, c1, c2) {
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const t = (x / (w - 1) + y / (h - 1)) / 2;
			const color = [
				lerp(c1[0], c2[0], t),
				lerp(c1[1], c2[1], t),
				lerp(c1[2], c2[2], t),
			];
			setPixel(buf, channels, w, x, y, color, 255);
		}
	}
}

function fillSolid(buf, channels, w, h, color) {
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) setPixel(buf, channels, w, x, y, color, 255);
	}
}

// 10x12 pixel-art "P" mask
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

function drawLetterP(buf, channels, w, h, opts) {
	const { centerX, centerY, sizeFraction = 0.55, color = WHITE, alpha = 255 } = opts;
	const maskW = P_MASK[0].length;
	const maskH = P_MASK.length;
	const target = Math.min(w, h) * sizeFraction;
	const scale = Math.max(1, Math.floor(target / maskH));
	const drawW = maskW * scale;
	const drawH = maskH * scale;
	const startX = Math.round(centerX - drawW / 2);
	const startY = Math.round(centerY - drawH / 2);

	for (let my = 0; my < maskH; my++) {
		for (let mx = 0; mx < maskW; mx++) {
			if (P_MASK[my][mx] !== '1') continue;
			fillRect(buf, channels, w, h, startX + mx * scale, startY + my * scale, scale, scale, color, alpha);
		}
	}
}

function makeBuffer(w, h, channels) {
	return Buffer.alloc(w * h * channels);
}

// ============================================================
// Icons
// ============================================================
function buildIconRGBA(size, letterFraction) {
	const buf = makeBuffer(size, size, 4);
	fillGradient(buf, 4, size, size, COLOR_BRAND, COLOR_ACCENT);
	drawLetterP(buf, 4, size, size, {
		centerX: size / 2,
		centerY: size / 2,
		sizeFraction: letterFraction,
	});
	return buf;
}

function buildIconRGB(size, letterFraction) {
	const buf = makeBuffer(size, size, 3);
	fillGradient(buf, 3, size, size, COLOR_BRAND, COLOR_ACCENT);
	drawLetterP(buf, 3, size, size, {
		centerX: size / 2,
		centerY: size / 2,
		sizeFraction: letterFraction,
	});
	return buf;
}

// ============================================================
// Screenshots
// ============================================================
function buildHeroScreenshot(w, h) {
	const buf = makeBuffer(w, h, 4);
	fillSolid(buf, 4, w, h, COLOR_DARK_BG);

	// Subtle gradient overlay at the top
	const overlayH = Math.floor(h * 0.55);
	for (let y = 0; y < overlayH; y++) {
		for (let x = 0; x < w; x++) {
			const t = y / overlayH;
			const tx = x / (w - 1);
			const r = lerp(COLOR_BRAND[0], COLOR_ACCENT[0], tx);
			const g = lerp(COLOR_BRAND[1], COLOR_ACCENT[1], tx);
			const b = lerp(COLOR_BRAND[2], COLOR_ACCENT[2], tx);
			const blend = (1 - t) * 0.45;
			setPixel(buf, 4, w, x, y, [
				lerp(COLOR_DARK_BG[0], r, blend),
				lerp(COLOR_DARK_BG[1], g, blend),
				lerp(COLOR_DARK_BG[2], b, blend),
			], 255);
		}
	}

	// Top bar
	const padX = Math.round(w * 0.06);
	const barTop = Math.round(h * 0.04);
	const barH = Math.round(h * 0.045);
	fillRoundedRect(buf, 4, w, h, padX, barTop, Math.round(w * 0.12), barH, 8, WHITE, 230);

	// Eyebrow chip
	const eyebrowY = Math.round(h * 0.18);
	fillRoundedRect(buf, 4, w, h, padX, eyebrowY, Math.round(w * 0.34), Math.round(h * 0.035), 14, COLOR_BRAND, 255);

	// Title block (large)
	const titleY = eyebrowY + Math.round(h * 0.07);
	const titleH = Math.round(h * 0.075);
	fillRoundedRect(buf, 4, w, h, padX, titleY, w - padX * 2, titleH, 8, WHITE, 240);
	fillRoundedRect(buf, 4, w, h, padX, titleY + titleH + 14, Math.round((w - padX * 2) * 0.85), titleH, 8, WHITE, 240);
	fillRoundedRect(buf, 4, w, h, padX, titleY + (titleH + 14) * 2, Math.round((w - padX * 2) * 0.55), titleH, 8, COLOR_ACCENT, 255);

	// Subtitle
	const subY = titleY + (titleH + 14) * 3 + 24;
	fillRoundedRect(buf, 4, w, h, padX, subY, Math.round((w - padX * 2) * 0.95), Math.round(h * 0.03), 6, COLOR_MUTED, 255);
	fillRoundedRect(buf, 4, w, h, padX, subY + Math.round(h * 0.045), Math.round((w - padX * 2) * 0.7), Math.round(h * 0.03), 6, COLOR_MUTED, 255);

	// CTA buttons
	const btnY = subY + Math.round(h * 0.13);
	const btnH = Math.round(h * 0.075);
	const primaryW = Math.round(w * 0.36);
	fillRoundedRect(buf, 4, w, h, padX, btnY, primaryW, btnH, 18, COLOR_BRAND, 255);
	fillRoundedRect(buf, 4, w, h, padX + primaryW + 18, btnY, Math.round(w * 0.28), btnH, 18, COLOR_DARK_SURFACE, 255);

	// "P" mark inside primary button
	drawLetterP(buf, 4, w, h, {
		centerX: padX + primaryW * 0.18,
		centerY: btnY + btnH / 2,
		sizeFraction: 0.04,
		color: WHITE,
	});

	// Footer P watermark big
	drawLetterP(buf, 4, w, h, {
		centerX: w * 0.82,
		centerY: h * 0.85,
		sizeFraction: 0.18,
		color: COLOR_BRAND,
		alpha: 90,
	});

	return buf;
}

function buildFeaturesScreenshot(w, h) {
	const buf = makeBuffer(w, h, 4);
	fillSolid(buf, 4, w, h, COLOR_DARK_BG);

	// Top bar
	const padX = Math.round(w * 0.06);
	fillRoundedRect(buf, 4, w, h, padX, Math.round(h * 0.04), Math.round(w * 0.12), Math.round(h * 0.045), 8, WHITE, 230);

	// Section title
	const titleY = Math.round(h * 0.14);
	fillRoundedRect(buf, 4, w, h, padX, titleY, Math.round((w - padX * 2) * 0.45), Math.round(h * 0.05), 8, WHITE, 240);
	fillRoundedRect(buf, 4, w, h, padX, titleY + Math.round(h * 0.07), Math.round((w - padX * 2) * 0.7), Math.round(h * 0.022), 6, COLOR_MUTED, 255);

	// Decide grid layout based on aspect ratio
	const isWide = w > h;
	const cardsTop = Math.round(h * 0.34);
	const cardGap = Math.round((isWide ? w : h) * 0.025);

	if (isWide) {
		const cardW = Math.round((w - padX * 2 - cardGap * 2) / 3);
		const cardH = Math.round(h * 0.5);
		for (let i = 0; i < 3; i++) {
			const cx = padX + i * (cardW + cardGap);
			fillRoundedRect(buf, 4, w, h, cx, cardsTop, cardW, cardH, 16, COLOR_DARK_SURFACE, 255);
			fillRoundedRect(buf, 4, w, h, cx + 24, cardsTop + 28, 60, 60, 14, COLOR_BRAND, 255);
			fillRoundedRect(buf, 4, w, h, cx + 24, cardsTop + 110, cardW - 48, Math.round(h * 0.04), 6, WHITE, 235);
			fillRoundedRect(buf, 4, w, h, cx + 24, cardsTop + 110 + Math.round(h * 0.07), cardW - 60, Math.round(h * 0.022), 5, COLOR_MUTED, 255);
			fillRoundedRect(buf, 4, w, h, cx + 24, cardsTop + 110 + Math.round(h * 0.10), cardW - 90, Math.round(h * 0.022), 5, COLOR_MUTED, 255);
			fillRoundedRect(buf, 4, w, h, cx + 24, cardsTop + 110 + Math.round(h * 0.13), cardW - 120, Math.round(h * 0.022), 5, COLOR_MUTED, 255);
		}
	} else {
		const cardH = Math.round((h - cardsTop - padX) / 3 - cardGap);
		for (let i = 0; i < 3; i++) {
			const cy = cardsTop + i * (cardH + cardGap);
			fillRoundedRect(buf, 4, w, h, padX, cy, w - padX * 2, cardH, 16, COLOR_DARK_SURFACE, 255);
			fillRoundedRect(buf, 4, w, h, padX + 22, cy + 22, 56, 56, 12, COLOR_BRAND, 255);
			fillRoundedRect(buf, 4, w, h, padX + 100, cy + 28, Math.round((w - padX * 2) * 0.55), 18, 6, WHITE, 235);
			fillRoundedRect(buf, 4, w, h, padX + 100, cy + 56, Math.round((w - padX * 2) * 0.65), 12, 4, COLOR_MUTED, 255);
			fillRoundedRect(buf, 4, w, h, padX + 100, cy + 78, Math.round((w - padX * 2) * 0.45), 12, 4, COLOR_MUTED, 255);
		}
	}

	return buf;
}

// ============================================================
// Main
// ============================================================
function ensureDir(dir) {
	fs.mkdirSync(dir, { recursive: true });
}

function writeFile(absPath, png) {
	fs.writeFileSync(absPath, png);
	console.log(`  wrote ${path.relative(process.cwd(), absPath)}  (${png.length.toLocaleString()} bytes)`);
}

function main() {
	ensureDir(ICONS_DIR);
	ensureDir(SHOTS_DIR);

	console.log(`Generating icons -> ${ICONS_DIR}`);
	const iconJobs = [
		{ name: 'icon-192.png', size: 192, frac: 0.55, fmt: 'rgba' },
		{ name: 'icon-512.png', size: 512, frac: 0.55, fmt: 'rgba' },
		{ name: 'icon-1024.png', size: 1024, frac: 0.55, fmt: 'rgba' },
		{ name: 'icon-maskable-512.png', size: 512, frac: 0.42, fmt: 'rgba' },
		{ name: 'icon-maskable-1024.png', size: 1024, frac: 0.42, fmt: 'rgba' },
		{ name: 'apple-touch-icon-180.png', size: 180, frac: 0.55, fmt: 'rgb' },
	];
	for (const j of iconJobs) {
		const px = j.fmt === 'rgb' ? buildIconRGB(j.size, j.frac) : buildIconRGBA(j.size, j.frac);
		const png = j.fmt === 'rgb' ? encodePngRGB(j.size, j.size, px) : encodePngRGBA(j.size, j.size, px);
		writeFile(path.join(ICONS_DIR, j.name), png);
	}

	console.log(`Generating screenshots -> ${SHOTS_DIR}`);
	const shotJobs = [
		{ name: 'mobile-hero.png', w: 540, h: 720, kind: 'hero' },
		{ name: 'mobile-features.png', w: 540, h: 720, kind: 'features' },
		{ name: 'wide-hero.png', w: 1280, h: 720, kind: 'hero' },
		{ name: 'wide-features.png', w: 1280, h: 720, kind: 'features' },
	];
	for (const j of shotJobs) {
		const px = j.kind === 'hero' ? buildHeroScreenshot(j.w, j.h) : buildFeaturesScreenshot(j.w, j.h);
		writeFile(path.join(SHOTS_DIR, j.name), encodePngRGBA(j.w, j.h, px));
	}

	console.log('Done.');
}

main();
