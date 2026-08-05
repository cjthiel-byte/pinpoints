import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';

export type LocationType = 'country' | 'level1' | 'level2';

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

export async function addCountryVisit(userId: string, countryCode: string, displayName: string) {
	await setDoc(doc(db, 'visits', visitDocId(userId, countryCode)), {
		userId,
		countryCode,
		locationType: 'country' satisfies LocationType,
		locationId: countryCode,
		displayName,
		createdAt: serverTimestamp(),
	});
}

export async function removeCountryVisit(userId: string, countryCode: string) {
	await deleteDoc(doc(db, 'visits', visitDocId(userId, countryCode)));
}
