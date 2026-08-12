import { useEffect, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { addVisit, removeVisit, subscribeToUserVisits, type VisitRecord } from '../lib/visits';
import { getSubdivisionTerm } from '../lib/terminology';
import { DEFAULT_COLOR } from '../lib/colors';
import { subscribeToUserProfile } from '../lib/users';
import { computeStats } from '../lib/stats';
import geoCounts from '../data/geoCounts.json';

declare global {
	interface Window {
		CESIUM_BASE_URL: string;
	}
}

window.CESIUM_BASE_URL = '/cesium/';

const FILL_COLOR = Cesium.Color.fromCssColorString('#1e293b').withAlpha(0.45);
const STROKE_COLOR = Cesium.Color.fromCssColorString('#64748b');

type ViewMode = 'country' | 'state';

function StatBar({
	label,
	visited,
	total,
	color,
}: {
	label: string;
	visited: number;
	total: number;
	color: string;
}) {
	const pct = total > 0 ? Math.min(100, (visited / total) * 100) : 0;
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-baseline justify-between text-xs">
				<span className="text-slate-400">{label}</span>
				<span className="font-medium text-white">
					{visited} / {total}
				</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
				<div
					className="h-full rounded-full transition-all duration-500"
					style={{ width: `${pct}%`, backgroundColor: color }}
				/>
			</div>
		</div>
	);
}

function preparePolygonEntities(dataSource: Cesium.GeoJsonDataSource) {
	for (const entity of dataSource.entities.values) {
		if (entity.polygon) {
			entity.polygon.perPositionHeight = new Cesium.ConstantProperty(true);
		}
	}
	return dataSource;
}

export default function Globe() {
	const containerRef = useRef<HTMLDivElement>(null);
	const viewerRef = useRef<Cesium.Viewer | null>(null);
	const countriesDataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);
	const admin1CacheRef = useRef<Map<string, Cesium.GeoJsonDataSource>>(new Map());
	const myVisitedIdsRef = useRef<Set<string>>(new Set());
	const myColorRef = useRef<string>(DEFAULT_COLOR);
	const countryNamesRef = useRef<Map<string, string>>(new Map());
	const userIdRef = useRef<string | null>(null);
	const modeRef = useRef<ViewMode>('country');
	const applyModeVisibilityRef = useRef<(mode: ViewMode) => void>(() => {});
	const loadAllAdmin1Ref = useRef<() => Promise<void>>(() => Promise.resolve());

	const [userId, setUserId] = useState<string | null>(null);
	const [hasProfile, setHasProfile] = useState(false);
	const [myColor, setMyColor] = useState(DEFAULT_COLOR);
	const [visitRecords, setVisitRecords] = useState<VisitRecord[]>([]);
	const [toastMessage, setToastMessage] = useState<string | null>(null);
	const [showStats, setShowStats] = useState(false);
	const [mode, setMode] = useState<ViewMode>('country');
	const [loadingStates, setLoadingStates] = useState(false);

	useEffect(() => {
		return onAuthStateChanged(auth, (user) => setUserId(user?.uid ?? null));
	}, []);

	useEffect(() => {
		if (!toastMessage) return;
		const timeout = setTimeout(() => setToastMessage(null), 2500);
		return () => clearTimeout(timeout);
	}, [toastMessage]);

	useEffect(() => {
		userIdRef.current = userId;
	}, [userId]);

	useEffect(() => {
		modeRef.current = mode;
		applyModeVisibilityRef.current(mode);
		if (mode === 'state') {
			setLoadingStates(true);
			loadAllAdmin1Ref.current().finally(() => setLoadingStates(false));
		}
	}, [mode]);

	const stats = useMemo(() => computeStats(visitRecords), [visitRecords]);

	function colorForLocation(locationId: string): Cesium.Color {
		if (!myVisitedIdsRef.current.has(locationId)) return FILL_COLOR;
		return Cesium.Color.fromCssColorString(myColorRef.current).withAlpha(0.75);
	}

	function applyVisitedColors() {
		const countriesDS = countriesDataSourceRef.current;
		if (countriesDS) {
			for (const entity of countriesDS.entities.values) {
				if (!entity.polygon) continue;
				const iso = entity.properties?.ISO_A3?.getValue();
				if (!iso) continue;
				entity.polygon.material = new Cesium.ColorMaterialProperty(colorForLocation(iso));
			}
		}
		for (const dataSource of admin1CacheRef.current.values()) {
			for (const entity of dataSource.entities.values) {
				if (!entity.polygon) continue;
				const locationId = entity.properties?.LOCATION_ID?.getValue();
				if (!locationId) continue;
				entity.polygon.material = new Cesium.ColorMaterialProperty(colorForLocation(locationId));
			}
		}
	}

	useEffect(() => {
		if (!userId) {
			myVisitedIdsRef.current = new Set();
			myColorRef.current = DEFAULT_COLOR;
			setHasProfile(false);
			setMyColor(DEFAULT_COLOR);
			setVisitRecords([]);
			applyVisitedColors();
			return;
		}

		const unsubVisits = subscribeToUserVisits(userId, (records) => {
			myVisitedIdsRef.current = new Set(records.map((r) => r.locationId));
			setVisitRecords(records);
			applyVisitedColors();
		});
		const unsubProfile = subscribeToUserProfile(userId, (profile) => {
			const color = profile?.color ?? DEFAULT_COLOR;
			myColorRef.current = color;
			setMyColor(color);
			setHasProfile(!!profile);
			applyVisitedColors();
		});

		return () => {
			unsubVisits();
			unsubProfile();
		};
	}, [userId]);

	useEffect(() => {
		if (!containerRef.current) return;

		Cesium.Ion.defaultAccessToken = import.meta.env.PUBLIC_CESIUM_ION_TOKEN;

		const viewer = new Cesium.Viewer(containerRef.current, {
			animation: false,
			timeline: false,
			geocoder: false,
			homeButton: false,
			sceneModePicker: false,
			baseLayerPicker: false,
			navigationHelpButton: false,
			fullscreenButton: false,
			selectionIndicator: false,
			infoBox: false,
		});

		viewerRef.current = viewer;
		// Tilting into a near-horizon view is disorienting for a click-to-toggle map and
		// easy to trigger accidentally (a slightly-dragged click both tilts the camera and
		// gets swallowed as a drag instead of registering as a click). Rotate/pan/zoom stay on.
		viewer.scene.screenSpaceCameraController.enableTilt = false;
		// The Viewer widget registers its own default double-click handler that tracks
		// (flies to and follows) whatever entity was double-clicked — not something this
		// click-to-toggle map wants, and it reads as the camera randomly reorienting itself.
		viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

		let handler: Cesium.ScreenSpaceEventHandler | undefined;
		let cancelled = false;

		// Country mode shows only flat country polygons; state mode shows every
		// country's first-level subdivisions instead. A country whose admin-1 data
		// failed to load (or doesn't exist) keeps its flat polygon visible in state
		// mode too, so it stays clickable as a country-level fallback.
		function applyModeVisibility(currentMode: ViewMode) {
			const countriesDS = countriesDataSourceRef.current;
			if (countriesDS) {
				for (const entity of countriesDS.entities.values) {
					const iso = entity.properties?.ISO_A3?.getValue();
					const hasAdmin1 = iso ? admin1CacheRef.current.has(iso) : false;
					entity.show = currentMode === 'country' || !hasAdmin1;
				}
			}
			for (const dataSource of admin1CacheRef.current.values()) {
				dataSource.show = currentMode === 'state';
			}
		}
		applyModeVisibilityRef.current = applyModeVisibility;

		let admin1LoadPromise: Promise<void> | null = null;
		function loadAllAdmin1(): Promise<void> {
			if (admin1LoadPromise) return admin1LoadPromise;
			const codes = Object.keys(geoCounts.admin1);
			admin1LoadPromise = Promise.allSettled(
				codes.map(async (code) => {
					if (admin1CacheRef.current.has(code)) return;
					const dataSource = preparePolygonEntities(
						await Cesium.GeoJsonDataSource.load(`/geo/admin1/${code}.geojson`, {
							stroke: STROKE_COLOR,
							fill: FILL_COLOR,
							strokeWidth: 1,
							clampToGround: false,
						}),
					);
					if (cancelled) return;
					admin1CacheRef.current.set(code, dataSource);
					dataSource.show = false;
					viewer.dataSources.add(dataSource);
				}),
			).then(() => {
				if (cancelled) return;
				applyModeVisibility(modeRef.current);
				applyVisitedColors();
			});
			return admin1LoadPromise;
		}
		loadAllAdmin1Ref.current = loadAllAdmin1;

		Cesium.GeoJsonDataSource.load('/geo/countries.geojson', {
			stroke: STROKE_COLOR,
			fill: FILL_COLOR,
			strokeWidth: 1,
			clampToGround: false,
		}).then((dataSource) => {
			preparePolygonEntities(dataSource);
			if (cancelled) return;
			viewer.dataSources.add(dataSource);
			countriesDataSourceRef.current = dataSource;
			for (const entity of dataSource.entities.values) {
				const iso = entity.properties?.ISO_A3?.getValue();
				const name = entity.properties?.NAME?.getValue();
				if (iso && name && !countryNamesRef.current.has(iso)) countryNamesRef.current.set(iso, name);
			}
			applyModeVisibility(modeRef.current);
			applyVisitedColors();

			if (import.meta.env.DEV) {
				(window as any).__viewer = viewer;
				(window as any).__Cesium = Cesium;
			}

			handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
			handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
				const currentUserId = userIdRef.current;
				if (!currentUserId) {
					setToastMessage('Sign in to start tracking your visits');
					return;
				}

				const picked = viewer.scene.pick(movement.position);
				if (!Cesium.defined(picked) || !(picked.id instanceof Cesium.Entity)) return;

				const entity = picked.id;
				if (!entity.polygon) return;

				const props = entity.properties;
				const locationType = props?.LOCATION_TYPE?.getValue();

				let locationId: string;
				let visitLocationType: 'country' | 'level1';
				let countryCode: string;
				let displayName: string;

				if (locationType === 'level1') {
					locationId = props?.LOCATION_ID?.getValue();
					countryCode = props?.ADM0_A3?.getValue();
					visitLocationType = 'level1';
					displayName = props?.NAME?.getValue() ?? locationId;
				} else {
					const iso = props?.ISO_A3?.getValue();
					if (!iso) return;
					locationId = iso;
					countryCode = iso;
					visitLocationType = 'country';
					displayName = props?.NAME?.getValue() ?? iso;
				}
				if (!locationId || !countryCode) return;

				if (myVisitedIdsRef.current.has(locationId)) {
					removeVisit(currentUserId, locationId);
				} else {
					addVisit(currentUserId, { locationId, locationType: visitLocationType, countryCode, displayName });
				}
			}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
		});

		return () => {
			cancelled = true;
			handler?.destroy();
			viewer.destroy();
			viewerRef.current = null;
			countriesDataSourceRef.current = null;
			admin1CacheRef.current.clear();
		};
	}, []);

	return (
		<div className="relative h-full w-full">
			<div ref={containerRef} className="h-full w-full" />
			<button
				onClick={() => viewerRef.current?.camera.flyHome(1.5)}
				className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg shadow-black/40 backdrop-blur-md transition-colors hover:bg-slate-900 active:bg-slate-800"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-4 w-4">
					<circle cx="12" cy="12" r="7.5" />
					<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
					<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" strokeLinecap="round" />
				</svg>
				Reset view
			</button>
			{userId && hasProfile && (
				<button
					onClick={() => setShowStats((s) => !s)}
					className="absolute bottom-16 right-4 flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 shadow-lg shadow-black/40 backdrop-blur-md transition-colors hover:bg-slate-900 active:bg-slate-800"
				>
					<svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
						<rect x="4" y="13" width="3.5" height="7" rx="0.5" />
						<rect x="10.25" y="9" width="3.5" height="11" rx="0.5" />
						<rect x="16.5" y="4" width="3.5" height="16" rx="0.5" />
					</svg>
					Stats
				</button>
			)}
			{showStats && userId && hasProfile && (
				<div className="absolute bottom-28 right-4 flex max-h-[55vh] w-72 max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/90 p-4 text-sm text-slate-200 shadow-2xl shadow-black/50 backdrop-blur-md animate-fade-in">
					<div>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-bold tabular-nums text-white">{stats.countriesVisited}</span>
							<span className="text-sm text-slate-400">/ {stats.countryTotal} countries</span>
						</div>
						<p className="mt-0.5 text-xs text-slate-500">
							{((stats.countriesVisited / stats.countryTotal) * 100).toFixed(1)}% of the world
						</p>
						<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
							<div
								className="h-full rounded-full transition-all duration-500"
								style={{ width: `${(stats.countriesVisited / stats.countryTotal) * 100}%`, backgroundColor: myColor }}
							/>
						</div>
					</div>
					<div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
						<StatBar label="US States" visited={stats.statesVisited} total={stats.stateTotal} color={myColor} />
					</div>
					{stats.subdivisionsByCountry.length > 0 && (
						<div className="flex flex-col gap-1 border-t border-slate-800 pt-3">
							<p className="mb-1 text-xs uppercase tracking-wide text-slate-400">By country</p>
							<ul className="flex flex-col gap-1">
								{stats.subdivisionsByCountry.map((s) => (
									<li key={s.countryCode} className="flex justify-between gap-2">
										<span className="truncate">{countryNamesRef.current.get(s.countryCode) ?? s.countryCode}</span>
										<span className="shrink-0 text-slate-300">
											{s.visited} of {s.total} {getSubdivisionTerm(s.countryCode, 'level1').plural}
										</span>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			)}
			{toastMessage && (
				<div className="pointer-events-none absolute bottom-6 left-1/2 max-w-[calc(100vw-3rem)] -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/90 px-4 py-2 text-sm text-slate-200 shadow-xl shadow-black/40 backdrop-blur-md animate-fade-in">
					{toastMessage}
				</div>
			)}
			<div className="pointer-events-auto absolute left-3 top-14 flex overflow-hidden rounded-lg border border-white/10 bg-slate-950/80 text-sm font-medium shadow-lg shadow-black/40 backdrop-blur-md sm:left-6 sm:top-16">
				<button
					onClick={() => setMode('country')}
					className={`px-3 py-2 transition-colors ${
						mode === 'country' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-900'
					}`}
				>
					Country
				</button>
				<button
					onClick={() => setMode('state')}
					disabled={loadingStates}
					className={`px-3 py-2 transition-colors disabled:cursor-wait disabled:opacity-70 ${
						mode === 'state' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-900'
					}`}
				>
					{loadingStates ? 'Loading…' : 'State'}
				</button>
			</div>
		</div>
	);
}
