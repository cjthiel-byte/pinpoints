import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export type LocationType = 'country' | 'level1' | 'level2';

export interface VisitInput {
	locationId: string;
	locationType: LocationType;
	countryCode: string;
	displayName: string;
}

export function visitDocId(userId: string, locationId: string) {
	return `${userId}_${locationId}`;
}

// Subscribes to every visit across every user (allowed by the Firestore rules —
// any authenticated user can read all visits) rather than filtering to one
// user, so "My visits" / "All users" / "Individual user" view modes can all be
// derived from the same data without re-querying when the mode changes.
export function subscribeToAllVisits(onChange: (visitsByLocation: Map<string, Set<string>>) => void) {
	return onSnapshot(collection(db, 'visits'), (snapshot) => {
		const visitsByLocation = new Map<string, Set<string>>();
		snapshot.forEach((docSnap) => {
			const data = docSnap.data();
			const locationId = data.locationId as string;
			const userId = data.userId as string;
			if (!visitsByLocation.has(locationId)) visitsByLocation.set(locationId, new Set());
			visitsByLocation.get(locationId)!.add(userId);
		});
		onChange(visitsByLocation);
	});
}

export async function addVisit(userId: string, input: VisitInput) {
	await setDoc(doc(db, 'visits', visitDocId(userId, input.locationId)), {
		userId,
		countryCode: input.countryCode,
		locationType: input.locationType,
		locationId: input.locationId,
		displayName: input.displayName,
		createdAt: serverTimestamp(),
	});
}

export async function removeVisit(userId: string, locationId: string) {
	await deleteDoc(doc(db, 'visits', visitDocId(userId, locationId)));
}
