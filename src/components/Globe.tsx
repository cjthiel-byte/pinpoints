import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { addCountryVisit, removeCountryVisit, subscribeToUserVisits } from '../lib/visits';

declare global {
	interface Window {
		CESIUM_BASE_URL: string;
	}
}

window.CESIUM_BASE_URL = '/cesium/';

const FILL_COLOR = Cesium.Color.fromCssColorString('#1e293b').withAlpha(0.45);
const STROKE_COLOR = Cesium.Color.fromCssColorString('#64748b');
const VISITED_COLOR = Cesium.Color.fromCssColorString('#3b82f6').withAlpha(0.75);

export default function Globe() {
	const containerRef = useRef<HTMLDivElement>(null);
	const dataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null);
	const visitedIdsRef = useRef<Set<string>>(new Set());
	const userIdRef = useRef<string | null>(null);

	const [userId, setUserId] = useState<string | null>(null);

	useEffect(() => {
		return onAuthStateChanged(auth, (user) => setUserId(user?.uid ?? null));
	}, []);

	useEffect(() => {
		userIdRef.current = userId;
	}, [userId]);

	function applyVisitedColors() {
		const dataSource = dataSourceRef.current;
		if (!dataSource) return;
		for (const entity of dataSource.entities.values) {
			if (!entity.polygon) continue;
			const iso = entity.properties?.ISO_A3?.getValue();
			const isVisited = !!iso && visitedIdsRef.current.has(iso);
			entity.polygon.material = new Cesium.ColorMaterialProperty(isVisited ? VISITED_COLOR : FILL_COLOR);
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

		let handler: Cesium.ScreenSpaceEventHandler | undefined;
		let cancelled = false;

		Cesium.GeoJsonDataSource.load('/geo/countries.geojson', {
			stroke: STROKE_COLOR,
			fill: FILL_COLOR,
			strokeWidth: 1,
			clampToGround: false,
		}).then((dataSource) => {
			for (const entity of dataSource.entities.values) {
				if (entity.polygon) {
					entity.polygon.perPositionHeight = new Cesium.ConstantProperty(true);
				}
			}
			if (cancelled) return;
			viewer.dataSources.add(dataSource);
			dataSourceRef.current = dataSource;
			applyVisitedColors();

			handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
			handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
				const currentUserId = userIdRef.current;
				if (!currentUserId) return;

				const picked = viewer.scene.pick(movement.position);
				if (!Cesium.defined(picked) || !(picked.id instanceof Cesium.Entity)) return;

				const entity = picked.id;
				const iso = entity.properties?.ISO_A3?.getValue();
				if (!iso || !entity.polygon) return;

				const displayName = entity.properties?.NAME?.getValue() ?? iso;

				if (visitedIdsRef.current.has(iso)) {
					removeCountryVisit(currentUserId, iso);
				} else {
					addCountryVisit(currentUserId, iso, displayName);
				}
			}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
		});

		return () => {
			cancelled = true;
			handler?.destroy();
			viewer.destroy();
			dataSourceRef.current = null;
		};
	}, []);

	return <div ref={containerRef} className="h-full w-full" />;
}
