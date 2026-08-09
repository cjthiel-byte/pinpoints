import { useEffect, useState } from 'react';
import {
	GoogleAuthProvider,
	createUserWithEmailAndPassword,
	onAuthStateChanged,
	signInWithEmailAndPassword,
	signInWithPopup,
	signOut,
	type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { COLOR_PALETTE } from '../lib/colors';
import { createUserProfile, subscribeToUserProfile, type UserProfile } from '../lib/users';

export default function AuthPanel() {
	const [user, setUser] = useState<User | null>(null);
	const [loading, setLoading] = useState(true);
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [profileLoading, setProfileLoading] = useState(true);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		return onAuthStateChanged(auth, (nextUser) => {
			setUser(nextUser);
			setLoading(false);
		});
	}, []);

	useEffect(() => {
		if (!user) {
			setProfile(null);
			setProfileLoading(false);
			return;
		}
		setProfileLoading(true);
		return subscribeToUserProfile(user.uid, (nextProfile) => {
			setProfile(nextProfile);
			setProfileLoading(false);
		});
	}, [user]);

	async function handleGoogleSignIn() {
		setError(null);
		try {
			await signInWithPopup(auth, new GoogleAuthProvider());
		} catch (err) {
			setError((err as Error).message);
		}
	}

	async function handleEmailSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		try {
			if (mode === 'sign-up') {
				await createUserWithEmailAndPassword(auth, email, password);
			} else {
				await signInWithEmailAndPassword(auth, email, password);
			}
		} catch (err) {
			setError((err as Error).message);
		}
	}

	async function handlePickColor(color: string) {
		if (!user) return;
		setError(null);
		try {
			await createUserProfile(user.uid, {
				email: user.email ?? '',
				displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Traveler',
				color,
			});
		} catch (err) {
			setError((err as Error).message);
		}
	}

	if (loading || profileLoading) {
		return <div className="text-sm text-slate-400">Loading…</div>;
	}

	if (user && !profile) {
		return (
			<div className="flex w-full max-w-xs flex-col gap-3">
				<p className="text-sm text-slate-300">Pick a color for your pins</p>
				<div className="grid grid-cols-4 gap-2">
					{COLOR_PALETTE.map((c) => (
						<button
							key={c.hex}
							type="button"
							onClick={() => handlePickColor(c.hex)}
							title={c.name}
							aria-label={c.name}
							style={{ backgroundColor: c.hex }}
							className="h-10 w-10 rounded-full border-2 border-transparent transition hover:border-white"
						/>
					))}
				</div>
				{error && <p className="text-xs text-red-400">{error}</p>}
			</div>
		);
	}

	if (user && profile) {
		return (
			<div className="flex flex-col items-center gap-3">
				<p className="flex items-center gap-2 text-sm text-slate-300">
					<span className="h-3 w-3 rounded-full" style={{ backgroundColor: profile.color }} />
					Signed in as <span className="font-medium text-white">{profile.displayName}</span>
				</p>
				<button
					onClick={() => signOut(auth)}
					className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium hover:bg-slate-700"
				>
					Sign out
				</button>
			</div>
		);
	}

	return (
		<div className="flex w-full max-w-xs flex-col gap-4">
			<button
				onClick={handleGoogleSignIn}
				className="rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
			>
				Continue with Google
			</button>

			<div className="flex items-center gap-2 text-xs text-slate-500">
				<div className="h-px flex-1 bg-slate-800" />
				or
				<div className="h-px flex-1 bg-slate-800" />
			</div>

			<form onSubmit={handleEmailSubmit} className="flex flex-col gap-2">
				<input
					type="email"
					required
					placeholder="Email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
				/>
				<input
					type="password"
					required
					minLength={6}
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
				/>
				<button
					type="submit"
					className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
				>
					{mode === 'sign-up' ? 'Sign up' : 'Sign in'}
				</button>
			</form>

			{error && <p className="text-xs text-red-400">{error}</p>}

			<button
				onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
				className="text-xs text-slate-400 hover:text-slate-300"
			>
				{mode === 'sign-up' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
			</button>
		</div>
	);
}
