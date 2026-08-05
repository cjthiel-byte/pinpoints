import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

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

		const visited = new Set<string>();
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

			handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
			handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
				const picked = viewer.scene.pick(movement.position);
				if (!Cesium.defined(picked) || !(picked.id instanceof Cesium.Entity)) return;

				const entity = picked.id;
				const iso = entity.properties?.ISO_A3?.getValue();
				if (!iso || !entity.polygon) return;

				if (visited.has(iso)) {
					visited.delete(iso);
					entity.polygon.material = new Cesium.ColorMaterialProperty(FILL_COLOR);
				} else {
					visited.add(iso);
					entity.polygon.material = new Cesium.ColorMaterialProperty(VISITED_COLOR);
				}
			}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
		});

		return () => {
			cancelled = true;
			handler?.destroy();
			viewer.destroy();
		};
	}, []);

	return <div ref={containerRef} className="h-full w-full" />;
}
