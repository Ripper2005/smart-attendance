/**
 * lib/security/geofence.ts
 * Haversine formula to calculate the great-circle distance between two GPS coordinates.
 * Used in the Verification Engine (Lock 2: Location).
 */

const EARTH_RADIUS_METERS = 6_371_000; // Mean radius of Earth in metres

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the distance in metres between two GPS coordinates.
 * Uses the Haversine formula which accounts for Earth's curvature.
 *
 * @param point1 - First coordinate {latitude, longitude}
 * @param point2 - Second coordinate {latitude, longitude}
 * @returns Distance in metres (float)
 */
export function haversineDistance(point1: Coordinates, point2: Coordinates): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRad(point2.latitude  - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);

  const lat1Rad = toRad(point1.latitude);
  const lat2Rad = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Checks if a student's coordinates are within the classroom geofence.
 *
 * @param studentCoords  - GPS from student device
 * @param classroomCoords - GPS stored for the classroom
 * @param radiusMeters   - Allowed radius (default 10m)
 * @returns true if within geofence
 */
export function isWithinGeofence(
  studentCoords: Coordinates,
  classroomCoords: Coordinates,
  radiusMeters: number = 10
): { withinFence: boolean; distanceMeters: number } {
  const distanceMeters = haversineDistance(studentCoords, classroomCoords);
  return {
    withinFence: distanceMeters <= radiusMeters,
    distanceMeters,
  };
}
