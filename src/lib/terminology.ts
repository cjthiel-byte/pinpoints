export interface SubdivisionTerm {
	name: string;
	plural: string;
}

interface CountryTerminology {
	level1: SubdivisionTerm;
	level2?: SubdivisionTerm;
}

const DEFAULT_TERM: SubdivisionTerm = { name: 'Region', plural: 'Regions' };

// Keyed by ISO Alpha-3 country code, matching the locationId scheme. Countries
// not listed here default to the generic "Region"/"Regions" term. This is the
// single source of truth for subdivision naming — apply it everywhere a
// subdivision name is shown rather than hardcoding per-country strings.
const TERMINOLOGY: Record<string, CountryTerminology> = {
	USA: {
		level1: { name: 'State', plural: 'States' },
		level2: { name: 'County', plural: 'Counties' },
	},
	CAN: { level1: { name: 'Province', plural: 'Provinces' } },
	JPN: { level1: { name: 'Prefecture', plural: 'Prefectures' } },
	GBR: { level1: { name: 'Country', plural: 'Countries' } },
	DEU: { level1: { name: 'State', plural: 'Bundesländer' } },
	FRA: { level1: { name: 'Region', plural: 'Regions' } },
	AUS: { level1: { name: 'State/Territory', plural: 'States/Territories' } },
	MEX: { level1: { name: 'State', plural: 'States' } },
	ITA: { level1: { name: 'Region', plural: 'Regions' } },
	ESP: { level1: { name: 'Autonomous Community', plural: 'Autonomous Communities' } },
};

export function getSubdivisionTerm(countryCode: string, level: 'level1' | 'level2'): SubdivisionTerm {
	return TERMINOLOGY[countryCode]?.[level] ?? DEFAULT_TERM;
}
