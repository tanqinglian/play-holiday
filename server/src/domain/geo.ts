const EARTH_RADIUS_KM = 6371;

function radians(value: number) {
  return value * Math.PI / 180;
}

export function distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function boundingBox(latitude: number, longitude: number, radiusKm: number) {
  const latitudeDelta = radiusKm / 110.574;
  const longitudeDelta = radiusKm / (111.320 * Math.max(0.01, Math.cos(radians(latitude))));
  return {
    north: latitude + latitudeDelta,
    south: latitude - latitudeDelta,
    east: longitude + longitudeDelta,
    west: longitude - longitudeDelta,
  };
}
