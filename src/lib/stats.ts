import geoCounts from '../data/geoCounts.json';
import type { VisitRecord } from './visits';

export const US_STATE_CODES = [
	'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
	'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
	'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV',
	'WI', 'WY',
];

export interface CountrySubdivisionStat {
	countryCode: string;
	visited: number;
	total: number;
}

export interface Stats {
	countriesVisited: number;
	countryTotal: number;
	statesVisited: number;
	stateTotal: number;
	subdivisionsByCountry: CountrySubdivisionStat[];
}

const admin1Counts: Record<string, number> = geoCounts.admin1;

export function computeStats(records: VisitRecord[]): Stats {
	const countries = new Set<string>();
	const states = new Set<string>();
	const subdivisionsByCountry = new Map<string, Set<string>>();

	for (const r of records) {
		if (r.locationType === 'country') {
			countries.add(r.locationId);
		} else if (r.locationType === 'level1') {
			if (!subdivisionsByCountry.has(r.countryCode)) subdivisionsByCountry.set(r.countryCode, new Set());
			subdivisionsByCountry.get(r.countryCode)!.add(r.locationId);
			if (r.countryCode === 'USA' && US_STATE_CODES.includes(r.locationId.replace('USA-', ''))) {
				states.add(r.locationId);
			}
		}
	}

	const subdivisionStats: CountrySubdivisionStat[] = [...subdivisionsByCountry.entries()]
		.map(([countryCode, visited]) =>
			countryCode === 'USA'
				? { countryCode, visited: states.size, total: US_STATE_CODES.length }
				: { countryCode, visited: visited.size, total: admin1Counts[countryCode] ?? visited.size },
		)
		.sort((a, b) => b.visited - a.visited);

	return {
		countriesVisited: countries.size,
		countryTotal: geoCounts.countryTotal,
		statesVisited: states.size,
		stateTotal: US_STATE_CODES.length,
		subdivisionsByCountry: subdivisionStats,
	};
}
