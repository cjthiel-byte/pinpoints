import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
	email: string;
	displayName: string;
	color: string;
}

export async function createUserProfile(userId: string, profile: UserProfile) {
	await setDoc(doc(db, 'users', userId), {
		...profile,
		joinedAt: serverTimestamp(),
	});
}

export function subscribeToUserProfile(userId: string, onChange: (profile: UserProfile | null) => void) {
	return onSnapshot(doc(db, 'users', userId), (snap) => {
		onChange(snap.exists() ? (snap.data() as UserProfile) : null);
	});
}

export function subscribeToAllUsers(onChange: (users: Map<string, UserProfile>) => void) {
	return onSnapshot(collection(db, 'users'), (snapshot) => {
		const users = new Map<string, UserProfile>();
		snapshot.forEach((docSnap) => {
			const data = docSnap.data();
			users.set(docSnap.id, {
				email: data.email,
				displayName: data.displayName,
				color: data.color,
			});
		});
		onChange(users);
	});
}
