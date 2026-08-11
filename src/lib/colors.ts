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
