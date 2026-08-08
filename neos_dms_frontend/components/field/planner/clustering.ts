import type { PlannerOutlet } from "@/lib/api/field";

export interface PlannedGroup {
  id: string;
  name: string;
  outletIds: string[];
  center: [number, number];
}

/** Ceiling on the number of routes produced by one auto-cluster pass. */
export const MAX_PLANNED_GROUPS = 60;

const EARTH_RADIUS_M = 6371000;
const KMEANS_ITERATIONS = 12;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters between two lat/lng points. */
export function haversine(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Seeded PRNG (mulberry32) so re-clustering the same pool is deterministic. */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function centroid(points: PlannerOutlet[]): [number, number] {
  let lat = 0;
  let lng = 0;
  for (const point of points) {
    lat += point.latitude;
    lng += point.longitude;
  }
  return [lat / points.length, lng / points.length];
}

function closestCentroid(
  point: PlannerOutlet,
  centers: Array<[number, number]>,
): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < centers.length; i += 1) {
    const distance = haversine(
      point.latitude,
      point.longitude,
      centers[i][0],
      centers[i][1],
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

function kmeans(
  points: PlannerOutlet[],
  k: number,
  iterations = KMEANS_ITERATIONS,
  rng: () => number,
): PlannerOutlet[][] {
  if (points.length === 0) return [];
  if (points.length <= k) return points.map((point) => [point]);

  const centers: Array<[number, number]> = [];
  const first = points[Math.floor(rng() * points.length)];
  centers.push([first.latitude, first.longitude]);
  while (centers.length < k) {
    const weights = points.map((point) => {
      let min = Infinity;
      for (const center of centers) {
        min = Math.min(
          min,
          haversine(point.latitude, point.longitude, center[0], center[1]),
        );
      }
      return min;
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = rng() * total;
    let index = points.length - 1;
    for (let i = 0; i < points.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) {
        index = i;
        break;
      }
    }
    centers.push([points[index].latitude, points[index].longitude]);
  }

  const assignment = new Array<number>(points.length).fill(0);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let i = 0; i < points.length; i += 1) {
      assignment[i] = closestCentroid(points[i], centers);
    }
    for (let c = 0; c < centers.length; c += 1) {
      const members: PlannerOutlet[] = [];
      for (let i = 0; i < points.length; i += 1) {
        if (assignment[i] === c) members.push(points[i]);
      }
      if (members.length > 0) centers[c] = centroid(members);
    }
  }

  const result = Array.from({ length: k }, () => [] as PlannerOutlet[]);
  for (let i = 0; i < points.length; i += 1) {
    result[assignment[i]].push(points[i]);
  }
  return result.filter((group) => group.length > 0);
}

/** Recursively splits a group with 2-means until every part is within `cap`. */
function splitOversized(
  group: PlannerOutlet[],
  cap: number,
  rng: () => number,
): PlannerOutlet[][] {
  const parts = kmeans(group, 2, KMEANS_ITERATIONS, rng);
  const result: PlannerOutlet[][] = [];
  for (const part of parts) {
    if (part.length > cap) result.push(...splitOversized(part, cap, rng));
    else result.push(part);
  }
  return result;
}

/**
 * Operational clustering: groups outlets into route-sized clusters via
 * k-means++ on haversine distance, then splits any oversized cluster so each
 * group respects `perRoute`. Deterministic for a given pool + target size.
 */
export function clusterOutlets(
  outlets: PlannerOutlet[],
  perRoute: number,
): PlannedGroup[] {
  const cap = Math.max(1, Math.round(perRoute));
  const k = Math.max(
    1,
    Math.min(
      MAX_PLANNED_GROUPS,
      Math.ceil(outlets.length / cap),
    ),
  );
  const rng = mulberry32(0x9e3779b9);

  const initial = kmeans(outlets, k, KMEANS_ITERATIONS, rng);
  const groups: PlannerOutlet[][] = [];
  for (const group of initial) {
    if (group.length > cap) groups.push(...splitOversized(group, cap, rng));
    else groups.push(group);
  }

  return groups
    .filter((group) => group.length > 0)
    .map((group, index) => ({
      id: `plan-${index + 1}`,
      name: `Route ${index + 1}`,
      outletIds: group.map((outlet) => outlet.id),
      center: centroid(group),
    }));
}

/** Deterministic, well-spread hue for a cluster index (golden-angle). */
export function clusterHue(index: number): number {
  return (index * 137.508) % 360;
}

/**
 * Ray-casting point-in-polygon test (lat/lng treated as y/x). The polygon is
 * treated as closed (last vertex connects back to the first).
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: Array<[number, number]>,
): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersects =
      lngI > lng !== lngJ > lng &&
      lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Bounding box of a closed polygon: [[minLat, minLng], [maxLat, maxLng]]. */
export function polygonBounds(
  polygon: Array<[number, number]>,
): [[number, number], [number, number]] | null {
  if (polygon.length === 0) return null;
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of polygon) {
    minLat = Math.min(minLat, lat);
    minLng = Math.min(minLng, lng);
    maxLat = Math.max(maxLat, lat);
    maxLng = Math.max(maxLng, lng);
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ];
}
