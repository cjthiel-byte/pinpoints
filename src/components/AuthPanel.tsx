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

const inputClasses =
	'rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50';

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
		return (
			<div className="flex items-center gap-2 text-sm text-slate-400">
				<span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
				Loading…
			</div>
		);
	}

	if (user && !profile) {
		return (
			<div className="flex w-full max-w-[220px] animate-fade-in flex-col gap-3 sm:max-w-xs">
				<p className="text-sm text-slate-300">Pick a color for your pins</p>
				<div className="grid grid-cols-4 gap-2.5">
					{COLOR_PALETTE.map((c) => (
						<button
							key={c.hex}
							type="button"
							onClick={() => handlePickColor(c.hex)}
							title={c.name}
							aria-label={c.name}
							style={{ backgroundColor: c.hex }}
							className="h-9 w-9 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-slate-950 transition-all hover:scale-110 hover:ring-white/70 active:scale-95"
						/>
					))}
				</div>
				{error && <p className="text-xs text-red-400">{error}</p>}
			</div>
		);
	}

	if (user && profile) {
		return (
			<div className="flex w-full max-w-[220px] animate-fade-in flex-col items-center gap-3 sm:max-w-xs">
				<p className="flex w-full items-center justify-center gap-2 text-sm text-slate-300">
					<span
						className="h-3 w-3 shrink-0 rounded-full"
						style={{ backgroundColor: profile.color, boxShadow: `0 0 6px ${profile.color}` }}
					/>
					<span className="min-w-0 truncate">
						Signed in as <span className="font-medium text-white">{profile.displayName}</span>
					</span>
				</p>
				<button
					onClick={() => signOut(auth)}
					className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-700 active:bg-slate-600"
				>
					Sign out
				</button>
			</div>
		);
	}

	return (
		<div className="flex w-full max-w-[220px] animate-fade-in flex-col gap-4 sm:max-w-xs">
			<button
				onClick={handleGoogleSignIn}
				className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm transition-colors hover:bg-slate-200 active:bg-slate-300"
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
					className={inputClasses}
				/>
				<input
					type="password"
					required
					minLength={6}
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					className={inputClasses}
				/>
				<button
					type="submit"
					className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium shadow-sm shadow-blue-950 transition-colors hover:bg-blue-500 active:bg-blue-700"
				>
					{mode === 'sign-up' ? 'Sign up' : 'Sign in'}
				</button>
			</form>

			{error && <p className="text-xs text-red-400">{error}</p>}

			<button
				onClick={() => setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up')}
				className="text-xs text-slate-400 transition-colors hover:text-slate-300"
			>
				{mode === 'sign-up' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
			</button>
		</div>
	);
}
