import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

export async function updateUserColor(userId: string, color: string) {
	await updateDoc(doc(db, 'users', userId), { color });
}

export function subscribeToUserProfile(userId: string, onChange: (profile: UserProfile | null) => void) {
	return onSnapshot(doc(db, 'users', userId), (snap) => {
		onChange(snap.exists() ? (snap.data() as UserProfile) : null);
	});
}
