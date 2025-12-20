export interface LocationSettingsInput {
  locationEnabled?: boolean | number | null;
  locationLabel?: string | null;
  locationLat?: number | null;
  locationLon?: number | null;
}

export interface LocationBucketResult {
  bucket: string;
  lat: number;
  lon: number;
  label?: string | null;
  source: 'manual' | 'auto';
}

const AUTO_LOCATION_URL = 'https://ipwho.is/';
const AUTO_LOCATION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_BUCKET_STEP = 0.5; // ~55km at equator

let cachedAutoLocation: { lat: number; lon: number; label?: string; fetchedAt: number } | null = null;

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function formatBucket(lat: number, lon: number): string {
  return `${lat.toFixed(1)},${lon.toFixed(1)}`;
}

function isValidCoordinate(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

async function fetchAutoLocation(): Promise<{ lat: number; lon: number; label?: string } | null> {
  try {
    const response = await fetch(AUTO_LOCATION_URL, {
      headers: {
        'User-Agent': 'truebit-node-monitor'
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as {
      success?: boolean;
      latitude?: number;
      longitude?: number;
      city?: string;
      region?: string;
      country_code?: string;
    };

    if (payload.success === false) {
      return null;
    }

    const lat = payload.latitude;
    const lon = payload.longitude;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      return null;
    }

    const label = payload.city || payload.region || payload.country_code;
    return { lat, lon, label };
  } catch {
    return null;
  }
}

async function getAutoLocation(): Promise<{ lat: number; lon: number; label?: string } | null> {
  const now = Date.now();
  if (cachedAutoLocation && (now - cachedAutoLocation.fetchedAt) < AUTO_LOCATION_TTL_MS) {
    return cachedAutoLocation;
  }

  const fresh = await fetchAutoLocation();
  if (!fresh) {
    return cachedAutoLocation;
  }

  cachedAutoLocation = { ...fresh, fetchedAt: now };
  return cachedAutoLocation;
}

export async function resolveLocationBucket(settings?: LocationSettingsInput | null): Promise<LocationBucketResult | null> {
  const enabled = settings?.locationEnabled;
  const isEnabled = enabled === undefined || enabled === null ? true : !!enabled;
  if (!isEnabled) return null;

  const manualLat = settings?.locationLat;
  const manualLon = settings?.locationLon;

  if (typeof manualLat === 'number' && typeof manualLon === 'number' && isValidCoordinate(manualLat, manualLon)) {
    const lat = roundToStep(manualLat, DEFAULT_BUCKET_STEP);
    const lon = roundToStep(manualLon, DEFAULT_BUCKET_STEP);
    return {
      bucket: formatBucket(lat, lon),
      lat,
      lon,
      label: settings?.locationLabel || null,
      source: 'manual'
    };
  }

  const auto = await getAutoLocation();
  if (!auto || !isValidCoordinate(auto.lat, auto.lon)) {
    return null;
  }

  const lat = roundToStep(auto.lat, DEFAULT_BUCKET_STEP);
  const lon = roundToStep(auto.lon, DEFAULT_BUCKET_STEP);
  return {
    bucket: formatBucket(lat, lon),
    lat,
    lon,
    label: settings?.locationLabel || auto.label || null,
    source: 'auto'
  };
}
