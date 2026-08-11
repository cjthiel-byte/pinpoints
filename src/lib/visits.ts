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

export interface VisitRecord {
	userId: string;
	locationId: string;
	locationType: LocationType;
	countryCode: string;
}

export function subscribeToUserVisits(userId: string, onChange: (records: VisitRecord[]) => void) {
	const visitsQuery = query(collection(db, 'visits'), where('userId', '==', userId));
	return onSnapshot(visitsQuery, (snapshot) => {
		const records: VisitRecord[] = [];
		snapshot.forEach((docSnap) => {
			const data = docSnap.data();
			records.push({
				userId: data.userId,
				locationId: data.locationId,
				locationType: data.locationType,
				countryCode: data.countryCode,
			});
		});
		onChange(records);
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
