import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { addVisit, removeVisit, subscribeToUserVisits } from '../lib/visits';
import { getSubdivisionTerm } from '../lib/terminology';

declare global {
	interface Window {
		CESIUM_BASE_URL: string;
	}
}

window.CESIUM_BASE_URL = '/cesium/';

const FILL_COLOR = Cesium.Color.fromCssColorString('#1e293b').withAlpha(0.45);
const STROKE_COLOR = Cesium.Color.fromCssColorString('#64748b');
const VISITED_COLOR = Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.75);

// Below this camera height, clicking targets a country's first-level
// subdivisions instead of the country itself.
const ADMIN1_ZOOM_HEIGHT = 2_500_000;
// Below this camera height, clicking within the US targets counties instead
// of the state. US-only, per the brief's MVP scope for level2 data.
const COUNTY_ZOOM_HEIGHT = 400_000;

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
	const countyCacheRef = useRef<Map<string, Cesium.GeoJsonDataSource>>(new Map());
	const activeDrillCountryRef = useRef<string | null>(null);
	const activeDrillStateRef = useRef<string | null>(null);
	const visitedIdsRef = useRef<Set<string>>(new Set());
	const userIdRef = useRef<string | null>(null);

	const [userId, setUserId] = useState<string | null>(null);
	const [showSignInHint, setShowSignInHint] = useState(false);
	const [drillCountry, setDrillCountry] = useState<{ code: string; name: string } | null>(null);
	const [drillState, setDrillState] = useState<{ code: string; name: string } | null>(null);

	useEffect(() => {
		return onAuthStateChanged(auth, (user) => setUserId(user?.uid ?? null));
	}, []);

	useEffect(() => {
		if (!showSignInHint) return;
		const timeout = setTimeout(() => setShowSignInHint(false), 2500);
		return () => clearTimeout(timeout);
	}, [showSignInHint]);

	useEffect(() => {
		userIdRef.current = userId;
	}, [userId]);

	function applyVisitedColors() {
		const countriesDS = countriesDataSourceRef.current;
		if (countriesDS) {
			for (const entity of countriesDS.entities.values) {
				if (!entity.polygon) continue;
				const iso = entity.properties?.ISO_A3?.getValue();
				const isVisited = !!iso && visitedIdsRef.current.has(iso);
				entity.polygon.material = new Cesium.ColorMaterialProperty(isVisited ? VISITED_COLOR : FILL_COLOR);
			}
		}
		for (const dataSource of admin1CacheRef.current.values()) {
			for (const entity of dataSource.entities.values) {
				if (!entity.polygon) continue;
				const locationId = entity.properties?.LOCATION_ID?.getValue();
				const isVisited = !!locationId && visitedIdsRef.current.has(locationId);
				entity.polygon.material = new Cesium.ColorMaterialProperty(isVisited ? VISITED_COLOR : FILL_COLOR);
			}
		}
		for (const dataSource of countyCacheRef.current.values()) {
			for (const entity of dataSource.entities.values) {
				if (!entity.polygon) continue;
				const locationId = entity.properties?.LOCATION_ID?.getValue();
				const isVisited = !!locationId && visitedIdsRef.current.has(locationId);
				entity.polygon.material = new Cesium.ColorMaterialProperty(isVisited ? VISITED_COLOR : FILL_COLOR);
			}
		}
	}

	useEffect(() => {
		if (!userId) {
			visitedIdsRef.current = new Set();
			applyVisitedColors();
			return;
		}

		return subscribeToUserVisits(userId, (locationIds) => {
			visitedIdsRef.current = locationIds;
			applyVisitedColors();
		});
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

		function setCountryEntityVisible(countryCode: string, visible: boolean) {
			const countriesDS = countriesDataSourceRef.current;
			if (!countriesDS) return;
			for (const entity of countriesDS.entities.values) {
				if (entity.properties?.ISO_A3?.getValue() === countryCode) {
					entity.show = visible;
				}
			}
		}

		function getCountryDisplayName(countryCode: string): string {
			const countriesDS = countriesDataSourceRef.current;
			if (countriesDS) {
				for (const entity of countriesDS.entities.values) {
					if (entity.properties?.ISO_A3?.getValue() === countryCode) {
						return entity.properties?.NAME?.getValue() ?? countryCode;
					}
				}
			}
			return countryCode;
		}

		function setStateEntityVisible(stateCode: string, visible: boolean) {
			const usaAdmin1DS = admin1CacheRef.current.get('USA');
			if (!usaAdmin1DS) return;
			for (const entity of usaAdmin1DS.entities.values) {
				if (entity.properties?.LOCATION_ID?.getValue() === `USA-${stateCode}`) {
					entity.show = visible;
				}
			}
		}

		function getStateDisplayName(stateCode: string): string {
			const usaAdmin1DS = admin1CacheRef.current.get('USA');
			if (usaAdmin1DS) {
				for (const entity of usaAdmin1DS.entities.values) {
					if (entity.properties?.LOCATION_ID?.getValue() === `USA-${stateCode}`) {
						return entity.properties?.NAME?.getValue() ?? stateCode;
					}
				}
			}
			return stateCode;
		}

		function exitCountyMode() {
			const active = activeDrillStateRef.current;
			if (!active) return;
			const activeDS = countyCacheRef.current.get(active);
			if (activeDS) activeDS.show = false;
			setStateEntityVisible(active, true);
			activeDrillStateRef.current = null;
			setDrillState(null);
		}

		async function drillIntoState(stateCode: string) {
			const previous = activeDrillStateRef.current;
			if (previous === stateCode) return;

			if (previous) {
				const previousDS = countyCacheRef.current.get(previous);
				if (previousDS) previousDS.show = false;
				setStateEntityVisible(previous, true);
			}
			setDrillState(null);

			activeDrillStateRef.current = stateCode;
			setStateEntityVisible(stateCode, false);

			let dataSource = countyCacheRef.current.get(stateCode);
			if (!dataSource) {
				try {
					dataSource = preparePolygonEntities(
						await Cesium.GeoJsonDataSource.load(`/geo/counties/${stateCode}.geojson`, {
							stroke: STROKE_COLOR,
							fill: FILL_COLOR,
							strokeWidth: 1,
							clampToGround: false,
						}),
					);
				} catch {
					setStateEntityVisible(stateCode, true);
					activeDrillStateRef.current = null;
					return;
				}
				if (cancelled) return;
				countyCacheRef.current.set(stateCode, dataSource);
				viewer.dataSources.add(dataSource);
			}

			dataSource.show = true;
			applyVisitedColors();
			setDrillState({ code: stateCode, name: getStateDisplayName(stateCode) });
		}

		async function drillIntoCountry(countryCode: string) {
			const previous = activeDrillCountryRef.current;
			if (previous === countryCode) return;

			exitCountyMode();

			if (previous) {
				const previousDS = admin1CacheRef.current.get(previous);
				if (previousDS) previousDS.show = false;
				setCountryEntityVisible(previous, true);
			}
			setDrillCountry(null);

			activeDrillCountryRef.current = countryCode;
			setCountryEntityVisible(countryCode, false);

			let dataSource = admin1CacheRef.current.get(countryCode);
			if (!dataSource) {
				try {
					dataSource = preparePolygonEntities(
						await Cesium.GeoJsonDataSource.load(`/geo/admin1/${countryCode}.geojson`, {
							stroke: STROKE_COLOR,
							fill: FILL_COLOR,
							strokeWidth: 1,
							clampToGround: false,
						}),
					);
				} catch {
					// No admin-1 data for this country (e.g. Vatican City) — keep its flat polygon visible.
					setCountryEntityVisible(countryCode, true);
					activeDrillCountryRef.current = null;
					return;
				}
				if (cancelled) return;
				admin1CacheRef.current.set(countryCode, dataSource);
				viewer.dataSources.add(dataSource);
			}

			dataSource.show = true;
			applyVisitedColors();
			setDrillCountry({ code: countryCode, name: getCountryDisplayName(countryCode) });
		}

		function exitDrillMode() {
			exitCountyMode();
			const active = activeDrillCountryRef.current;
			if (!active) return;
			const activeDS = admin1CacheRef.current.get(active);
			if (activeDS) activeDS.show = false;
			setCountryEntityVisible(active, true);
			activeDrillCountryRef.current = null;
			setDrillCountry(null);
		}

		function pickEntityAtCenter(): Cesium.Entity | undefined {
			const canvas = viewer.scene.canvas;
			const center = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
			const picked = viewer.scene.pick(center);
			return Cesium.defined(picked) && picked.id instanceof Cesium.Entity ? picked.id : undefined;
		}

		function handleZoomChange() {
			const height = viewer.camera.positionCartographic.height;

			if (height >= ADMIN1_ZOOM_HEIGHT) {
				exitDrillMode();
				return;
			}

			const centerEntity = pickEntityAtCenter();
			const props = centerEntity?.properties;
			const locationType = props?.LOCATION_TYPE?.getValue();

			const countryCode =
				locationType === 'level2'
					? 'USA'
					: locationType === 'level1'
						? props?.ADM0_A3?.getValue()
						: props?.ISO_A3?.getValue();

			if (countryCode && countryCode !== activeDrillCountryRef.current) {
				drillIntoCountry(countryCode);
			}

			if (height >= COUNTY_ZOOM_HEIGHT || activeDrillCountryRef.current !== 'USA') {
				exitCountyMode();
				return;
			}

			const stateCode =
				locationType === 'level1'
					? props?.LOCATION_ID?.getValue()?.split('-')[1]
					: locationType === 'level2'
						? props?.STATE?.getValue()
						: undefined;

			if (stateCode && stateCode !== activeDrillStateRef.current) {
				drillIntoState(stateCode);
			}
		}

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
			applyVisitedColors();

			viewer.camera.moveEnd.addEventListener(handleZoomChange);
			if (import.meta.env.DEV) {
				(window as any).__viewer = viewer;
				(window as any).__Cesium = Cesium;
			}

			handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
			handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
				const currentUserId = userIdRef.current;
				if (!currentUserId) {
					setShowSignInHint(true);
					return;
				}

				const picked = viewer.scene.pick(movement.position);
				if (!Cesium.defined(picked) || !(picked.id instanceof Cesium.Entity)) return;

				const entity = picked.id;
				if (!entity.polygon) return;

				const props = entity.properties;
				const locationType = props?.LOCATION_TYPE?.getValue();

				let locationId: string;
				let visitLocationType: 'country' | 'level1' | 'level2';
				let countryCode: string;
				let displayName: string;

				if (locationType === 'level2') {
					locationId = props?.LOCATION_ID?.getValue();
					countryCode = 'USA';
					visitLocationType = 'level2';
					displayName = props?.NAME?.getValue() ?? locationId;
				} else if (locationType === 'level1') {
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

				if (visitedIdsRef.current.has(locationId)) {
					removeVisit(currentUserId, locationId);
				} else {
					addVisit(currentUserId, { locationId, locationType: visitLocationType, countryCode, displayName });
				}
			}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
		});

		return () => {
			cancelled = true;
			viewer.camera.moveEnd.removeEventListener(handleZoomChange);
			handler?.destroy();
			viewer.destroy();
			viewerRef.current = null;
			countriesDataSourceRef.current = null;
			admin1CacheRef.current.clear();
			countyCacheRef.current.clear();
			activeDrillCountryRef.current = null;
			activeDrillStateRef.current = null;
		};
	}, []);

	return (
		<div className="relative h-full w-full">
			<div ref={containerRef} className="h-full w-full" />
			<button
				onClick={() => viewerRef.current?.camera.flyHome(1.5)}
				className="absolute bottom-4 right-4 rounded-md bg-slate-950/80 px-3 py-2 text-sm font-medium text-slate-200 backdrop-blur hover:bg-slate-900"
			>
				Reset view
			</button>
			{showSignInHint && (
				<div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-slate-950/90 px-4 py-2 text-sm text-slate-200 backdrop-blur">
					Sign in to start tracking your visits
				</div>
			)}
			{drillState ? (
				<div className="pointer-events-none absolute left-6 top-16 rounded-md bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 backdrop-blur">
					{drillState.name} — {getSubdivisionTerm('USA', 'level2').plural}
				</div>
			) : (
				drillCountry && (
					<div className="pointer-events-none absolute left-6 top-16 rounded-md bg-slate-950/80 px-3 py-1.5 text-sm text-slate-200 backdrop-blur">
						{drillCountry.name} — {getSubdivisionTerm(drillCountry.code, 'level1').plural}
					</div>
				)
			)}
		</div>
	);
}
