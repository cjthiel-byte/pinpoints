export const COLOR_PALETTE = [
	{ name: 'Blue', hex: '#3b82f6' },
	{ name: 'Pink', hex: '#ec4899' },
	{ name: 'Green', hex: '#22c55e' },
	{ name: 'Purple', hex: '#a855f7' },
	{ name: 'Orange', hex: '#f97316' },
	{ name: 'Teal', hex: '#14b8a6' },
	{ name: 'Red', hex: '#ef4444' },
	{ name: 'Yellow', hex: '#eab308' },
] as const;

export const DEFAULT_COLOR: string = COLOR_PALETTE[0].hex;

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
	return (
		'#' +
		[r, g, b]
			.map((c) => Math.round(c).toString(16).padStart(2, '0'))
			.join('')
	);
}

// Simple linear RGB averaging. Not perceptually precise, but the mental model
// this app wants ("blue + pink visits show up purple") is a rough intuition,
// not a color-science requirement.
export function blendColors(hexColors: string[]): string {
	if (hexColors.length === 0) return DEFAULT_COLOR;
	if (hexColors.length === 1) return hexColors[0];

	const [r, g, b] = hexColors.reduce(
		(sum, hex) => {
			const [r, g, b] = hexToRgb(hex);
			return [sum[0] + r, sum[1] + g, sum[2] + b];
		},
		[0, 0, 0],
	);

	return rgbToHex(r / hexColors.length, g / hexColors.length, b / hexColors.length);
}
