"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import Supercluster from "supercluster";
import { useTheme } from "next-themes";
import { Check, Maximize2, Shapes as PolygonIcon, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PlannerOutlet } from "@/lib/api/field";
import { clusterHue, type PlannedGroup } from "./clustering";

const LIGHT_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILES = "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const DEFAULT_CENTER: [number, number] = [27.7172, 85.324];
const DEFAULT_ZOOM = 11;
const POLYGON_COLOR = "#6366f1";

export interface MapClick {
  lat: number;
  lng: number;
}

interface PlannerMapProps {
  outlets: PlannerOutlet[];
  pool: PlannerOutlet[];
  groups: PlannedGroup[];
  selectedGroupId: string | null;
  selectedOutletId: string | null;
  drawing: boolean;
  vertices: Array<[number, number]>;
  onPointClick: (id: string) => void;
  onSelectGroup: (id: string | null) => void;
  onMapClick: (latlng: MapClick) => void;
  onToggleDrawing: () => void;
  onUndoVertex: () => void;
  onFinishPolygon: () => void;
  onClearPolygon: () => void;
}

interface ClusterItem {
  kind: "cluster";
  id: string;
  count: number;
  lat: number;
  lng: number;
  bbox: [number, number, number, number];
}

interface PointItem {
  kind: "point";
  id: string;
  name: string;
  lat: number;
  lng: number;
}

type MapItem = ClusterItem | PointItem;

interface PointsLayerProps {
  points: PlannerOutlet[];
  color: string;
  individual: boolean;
  selectedId?: string | null;
  interactive?: boolean;
  onPointClick?: (id: string) => void;
  onClusterSelect?: () => void;
}

function PointsLayer({
  points,
  color,
  individual,
  selectedId,
  interactive = true,
  onPointClick,
  onClusterSelect,
}: PointsLayerProps) {
  const map = useMap();

  const index = useMemo(() => {
    if (points.length === 0 || individual) return null;
    const sc = new Supercluster({ radius: 45, maxZoom: 16, minZoom: 2 });
    sc.load(
      points.map((point) => ({
        type: "Feature" as const,
        properties: { id: point.id, name: point.name },
        geometry: {
          type: "Point" as const,
          coordinates: [point.longitude, point.latitude],
        },
      })),
    );
    return sc;
  }, [points, individual]);

  const individualItems = useMemo<MapItem[]>(() => {
    if (!individual) return [];
    return points.map((point) => ({
      kind: "point" as const,
      id: point.id,
      name: point.name,
      lat: point.latitude,
      lng: point.longitude,
    }));
  }, [individual, points]);

  const [clusterItems, setClusterItems] = useState<MapItem[]>([]);

  useEffect(() => {
    if (individual || !index) return;
    const update = () => {
      const bounds = map.getBounds();
      const clusters = index.getClusters(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        Math.floor(map.getZoom()),
      );
      const next: MapItem[] = clusters.map((feature) => {
        const props = feature.properties;
        const [lng, lat] = feature.geometry.coordinates as [number, number];
        if (props.cluster) {
          return {
            kind: "cluster" as const,
            id: String(props.cluster_id),
            count: props.point_count,
            lat,
            lng,
            bbox: (feature.bbox?.slice(0, 4) as [number, number, number, number]) ??
              [lng, lat, lng, lat],
          };
        }
        return {
          kind: "point" as const,
          id: props.id,
          name: props.name,
          lat,
          lng,
        };
      });
      setClusterItems(next);
    };
    map.on("move", update);
    map.on("zoom", update);
    update();
    return () => {
      map.off("move", update);
      map.off("zoom", update);
    };
  }, [index, individual, map]);

  const items = individual ? individualItems : index ? clusterItems : [];

  return (
    <>
      {items.map((item) => {
        if (item.kind === "cluster") {
          const radius = 10 + Math.min(10, Math.log10(item.count) * 6);
          return (
            <CircleMarker
              key={`cluster-${item.id}`}
              center={[item.lat, item.lng]}
              radius={radius}
              interactive={interactive}
              pathOptions={{
                color: "#ffffff",
                fillColor: color,
                fillOpacity: 0.55,
                weight: 2,
                opacity: 0.9,
              }}
              eventHandlers={{
                click: () => {
                  map.flyToBounds(
                    [
                      [item.bbox[1], item.bbox[0]],
                      [item.bbox[3], item.bbox[2]],
                    ],
                    { maxZoom: 14 },
                  );
                  onClusterSelect?.();
                },
              }}
            >
              <Tooltip>{item.count} outlet{item.count === 1 ? "" : "s"}</Tooltip>
            </CircleMarker>
          );
        }
        const isSelected = item.id === selectedId;
        return (
          <CircleMarker
            key={`point-${item.id}`}
            center={[item.lat, item.lng]}
            radius={isSelected ? 7 : 5}
            interactive={interactive}
            pathOptions={{
              color: "#ffffff",
              fillColor: color,
              fillOpacity: isSelected ? 1 : 0.9,
              weight: isSelected ? 2.5 : 1.5,
              opacity: 1,
            }}
            eventHandlers={{
              click: () => onPointClick?.(item.id),
            }}
          >
            <Tooltip>{item.name}</Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

/** Pans the map to the currently selected outlet when it changes. */
function FlyToOutlet({
  outletId,
  outlets,
}: {
  outletId: string | null;
  outlets: PlannerOutlet[];
}) {
  const map = useMap();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!outletId || outletId === previous.current) return;
    previous.current = outletId;
    const outlet = outlets.find((item) => item.id === outletId);
    if (!outlet) return;
    map.flyTo(
      [outlet.latitude, outlet.longitude],
      Math.max(map.getZoom(), 14),
      { duration: 0.6 },
    );
  }, [outletId, outlets, map]);

  return null;
}

/** Captures map clicks only while polygon drawing is active. */
function MapClickHandler({
  enabled,
  onMapClick,
}: {
  enabled: boolean;
  onMapClick: (latlng: MapClick) => void;
}) {
  useMapEvents({
    click: (event) => {
      if (enabled) onMapClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function PolygonLayer({ vertices }: { vertices: Array<[number, number]> }) {
  if (vertices.length === 0) return null;
  const positions = vertices.map(
    ([lat, lng]) => [lat, lng] as [number, number],
  );
  if (vertices.length === 1) {
    return (
      <CircleMarker
        center={positions[0]}
        radius={6}
        pathOptions={{
          color: "#ffffff",
          fillColor: POLYGON_COLOR,
          fillOpacity: 0.7,
          weight: 2,
        }}
      />
    );
  }
  if (vertices.length === 2) {
    return (
      <Polyline
        positions={positions}
        pathOptions={{ color: POLYGON_COLOR, weight: 2, dashArray: "6 4" }}
      />
    );
  }
  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: POLYGON_COLOR,
        fillColor: POLYGON_COLOR,
        fillOpacity: 0.12,
        weight: 2,
      }}
    />
  );
}

function MapToolbar({
  drawing,
  vertexCount,
  fitBounds,
  outletsCount,
  onToggleDrawing,
  onUndoVertex,
  onFinishPolygon,
  onClearPolygon,
}: {
  drawing: boolean;
  vertexCount: number;
  fitBounds: [[number, number], [number, number]] | null;
  outletsCount: number;
  onToggleDrawing: () => void;
  onUndoVertex: () => void;
  onFinishPolygon: () => void;
  onClearPolygon: () => void;
}) {
  const map = useMap();
  return (
    <div className="flex flex-col gap-2">
      {drawing ? (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-9 w-9 shadow-md"
            title="Finish polygon"
            onClick={onFinishPolygon}
          >
            <Check className="size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-9 w-9 shadow-md"
            title="Undo last point"
            disabled={vertexCount === 0}
            onClick={onUndoVertex}
          >
            <Undo2 className="size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-9 w-9 shadow-md"
            title="Cancel drawing"
            onClick={onClearPolygon}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-9 w-9 shadow-md"
            title="Draw a polygon to plan only the outlets inside it"
            onClick={onToggleDrawing}
          >
            <PolygonIcon className="size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-9 w-9 shadow-md"
            title="Fit all outlets"
            disabled={outletsCount === 0}
            onClick={() => {
              if (fitBounds) map.flyToBounds(fitBounds, { maxZoom: 15 });
            }}
          >
            <Maximize2 className="size-4" aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}

export function PlannerMap({
  outlets,
  pool,
  groups,
  selectedGroupId,
  selectedOutletId,
  drawing,
  vertices,
  onPointClick,
  onSelectGroup,
  onMapClick,
  onToggleDrawing,
  onUndoVertex,
  onFinishPolygon,
  onClearPolygon,
}: PlannerMapProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const byId = useMemo(
    () => new Map(outlets.map((outlet) => [outlet.id, outlet])),
    [outlets],
  );

  const routed = useMemo(
    () => outlets.filter((outlet) => outlet.routeId !== null),
    [outlets],
  );

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  const selectedGroupPoints = useMemo(
    () =>
      selectedGroup
        ? selectedGroup.outletIds
            .map((id) => byId.get(id))
            .filter((outlet): outlet is PlannerOutlet => Boolean(outlet))
        : [],
    [selectedGroup, byId],
  );

  const groupPoints = useMemo(
    () =>
      groups
        .filter((group) => group.id !== selectedGroupId)
        .map((group) => ({
          id: group.id,
          points: group.outletIds
            .map((id) => byId.get(id))
            .filter((outlet): outlet is PlannerOutlet => Boolean(outlet)),
          hue: clusterHue(groups.indexOf(group)),
        })),
    [groups, selectedGroupId, byId],
  );

  const fitBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    if (outlets.length === 0) return null;
    let minLat = Infinity;
    let minLng = Infinity;
    let maxLat = -Infinity;
    let maxLng = -Infinity;
    for (const outlet of outlets) {
      minLat = Math.min(minLat, outlet.latitude);
      minLng = Math.min(minLng, outlet.longitude);
      maxLat = Math.max(maxLat, outlet.latitude);
      maxLng = Math.max(maxLng, outlet.longitude);
    }
    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [outlets]);

  return (
    <MapContainer
      className="z-0 h-full w-full"
      {...(fitBounds
        ? { bounds: fitBounds }
        : { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM })}
      scrollWheelZoom
      preferCanvas
      zoomControl
    >
      <TileLayer
        key={dark ? "dark" : "light"}
        url={dark ? DARK_TILES : LIGHT_TILES}
        attribution={ATTRIBUTION}
      />

      <MapClickHandler enabled={drawing} onMapClick={onMapClick} />
      <FlyToOutlet outletId={selectedOutletId} outlets={outlets} />

      {routed.length > 0 && (
        <PointsLayer
          points={routed}
          color="#94a3b8"
          individual={false}
          interactive={!drawing}
        />
      )}

      {pool.length > 0 && (
        <PointsLayer
          points={pool}
          color="#64748b"
          individual={false}
          selectedId={selectedOutletId}
          interactive={!drawing}
          onPointClick={onPointClick}
        />
      )}

      {selectedGroup && (
        <PointsLayer
          points={selectedGroupPoints}
          color={`hsl(${clusterHue(groups.indexOf(selectedGroup))} 70% 45%)`}
          individual
          selectedId={selectedOutletId}
          interactive={!drawing}
          onPointClick={onPointClick}
        />
      )}

      {groupPoints.map((group) => (
        <PointsLayer
          key={group.id}
          points={group.points}
          color={`hsl(${group.hue} 70% 45%)`}
          individual={false}
          interactive={!drawing}
          onPointClick={onPointClick}
          onClusterSelect={() => onSelectGroup(group.id)}
        />
      ))}

      {vertices.length > 0 && <PolygonLayer vertices={vertices} />}

      <div className="pointer-events-none absolute top-3 left-3 z-[1000]">
        <MapToolbar
          drawing={drawing}
          vertexCount={vertices.length}
          fitBounds={fitBounds}
          outletsCount={outlets.length}
          onToggleDrawing={onToggleDrawing}
          onUndoVertex={onUndoVertex}
          onFinishPolygon={onFinishPolygon}
          onClearPolygon={onClearPolygon}
        />
      </div>
    </MapContainer>
  );
}
