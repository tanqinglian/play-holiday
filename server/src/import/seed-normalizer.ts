import type {
  CoordinateStatus,
  FeeType,
  LocationPrecision,
  PlaceCategory,
  PlaceDetail,
} from '../domain/place.js';

export interface RawSeedPlace {
  id: string;
  name: string;
  district: string;
  address: string;
  placeTypes: string[];
  species: string[];
  chargeText: string;
  sourcePlatform: string;
  sourceUrl: string;
  sourceRecordId: string;
  sourceCapturedAt: string;
  coordinateStatus: string;
  latitude: number | null;
  longitude: number | null;
}

export interface RawSeedDetail {
  comments: Array<{ text: string; rating?: number; publishedLabel?: string }>;
  images: Array<{ sourceUrl: string; localPath?: string; bytes?: number }>;
}

export interface RawCoordinateSeedPlace {
  id: string;
  name: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  sourcePlatform: string;
  sourceUrl: string;
  sourceRecordId: string;
  sourceCapturedAt: string;
}

const FISHERY_TYPES = new Set(['黑坑', '斤塘', '农家乐']);
const WATER_TYPES = new Set(['湖库', '江河', '野塘']);

function inferCategory(types: string[]): PlaceCategory {
  if (types.some((type) => FISHERY_TYPES.has(type))) return 'fishery';
  if (types.some((type) => WATER_TYPES.has(type))) return 'wild_spot';
  return 'water_body';
}

function inferFeeType(chargeText: string): FeeType {
  const normalized = chargeText.trim();
  if (/免费/.test(normalized)) return 'free';
  if (normalized && !/未知|暂无|不详/.test(normalized)) return 'paid';
  return 'unknown';
}

function normalizeCoordinateStatus(value: string, latitude: number | null, longitude: number | null): CoordinateStatus {
  if (latitude === null || longitude === null) return 'missing';
  if (value === 'source_provided' || value === 'geocoded' || value === 'user_confirmed') return value;
  return 'geocoded';
}

export function normalizeSeedPlace(raw: RawSeedPlace, detail?: RawSeedDetail) {
  const category = inferCategory(raw.placeTypes);
  const coordinateStatus = normalizeCoordinateStatus(raw.coordinateStatus, raw.latitude, raw.longitude);
  const locationPrecision: LocationPrecision = category === 'fishery' ? 'public_exact' : 'public_coarse';
  const comments = (detail?.comments ?? []).map((comment, index) => ({
    id: `${raw.id}:comment:${index + 1}`,
    text: comment.text.trim(),
    rating: comment.rating,
    publishedLabel: comment.publishedLabel?.trim() || '时间未知',
    contentType: 'external_historical' as const,
  }));
  const images = (detail?.images ?? []).map((image, index) => ({
    id: `${raw.id}:image:${index + 1}`,
    sourceUrl: image.sourceUrl,
    thumbnailUrl: image.localPath ? `/media/${image.localPath}` : undefined,
    bytes: image.bytes,
  }));

  const place: PlaceDetail & { mapAvailable: boolean; sourceRecordId: string } = {
    id: raw.id,
    name: raw.name.trim(),
    district: raw.district.trim(),
    address: raw.address.trim(),
    category,
    feeType: inferFeeType(raw.chargeText),
    feeText: raw.chargeText.trim() || '收费未知',
    latitude: raw.latitude,
    longitude: raw.longitude,
    coordinateStatus,
    locationPrecision,
    detailAvailable: true,
    sceneTags: [...new Set(raw.placeTypes.map((tag) => tag.trim()).filter(Boolean))],
    methodTags: raw.placeTypes.includes('路亚') ? ['路亚'] : [],
    speciesTags: [...new Set(raw.species.map((tag) => tag.trim()).filter(Boolean))],
    liveCondition: { sampleCount6h: 0, biteLabel: '暂无钓友实况', crowdLabel: '未知' },
    source: {
      platform: raw.sourcePlatform,
      url: raw.sourceUrl,
      capturedAt: raw.sourceCapturedAt,
    },
    sourceRecordId: raw.sourceRecordId,
    comments,
    images,
    mapAvailable: coordinateStatus !== 'missing',
  };
  return place;
}
