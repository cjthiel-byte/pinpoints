import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
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

export function subscribeToUserVisits(userId: string, onChange: (locationIds: Set<string>) => void) {
	const visitsQuery = query(collection(db, 'visits'), where('userId', '==', userId));
	return onSnapshot(visitsQuery, (snapshot) => {
		const locationIds = new Set<string>();
		snapshot.forEach((docSnap) => locationIds.add(docSnap.data().locationId as string));
		onChange(locationIds);
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
