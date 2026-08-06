import type { BiteStatus, CrowdLevel, LiveConditionSummary } from './live-condition.js';

export type PlaceCategory = 'wild_spot' | 'fishery' | 'water_body' | 'tackle_shop' | 'private_spot';
export type FeeType = 'free' | 'paid' | 'unknown';
export type CoordinateStatus = 'missing' | 'source_provided' | 'geocoded' | 'user_confirmed';
export type LocationPrecision = 'public_exact' | 'public_coarse' | 'private_exact';

export interface PlaceSourceView {
  platform: string;
  url: string;
  capturedAt: string;
}

export interface PlaceCommentView {
  id: string;
  text: string;
  rating?: number;
  publishedLabel: string;
  contentType: 'external_historical' | 'user_submission';
}

export interface PlaceImageView {
  id: string;
  sourceUrl: string;
  thumbnailUrl?: string;
  bytes?: number;
}

export interface PlaceSummary {
  id: string;
  name: string;
  district: string;
  address: string;
  category: PlaceCategory;
  feeType: FeeType;
  feeText: string;
  latitude: number | null;
  longitude: number | null;
  coordinateStatus: CoordinateStatus;
  locationPrecision: LocationPrecision;
  detailAvailable: boolean;
  sceneTags: string[];
  methodTags: string[];
  speciesTags: string[];
  liveCondition: LiveConditionSummary;
}

export interface PlaceDetail extends PlaceSummary {
  source: PlaceSourceView;
  comments: PlaceCommentView[];
  images: PlaceImageView[];
}

export interface PlaceListQuery {
  query?: string;
  feeType?: FeeType;
  sceneTag?: string;
  offset: number;
  limit: number;
}

export interface PlaceMapQuery {
  north: number;
  south: number;
  east: number;
  west: number;
  feeType?: FeeType;
  sceneTag?: string;
  limit: number;
}

export interface PlaceRepository {
  health(): Promise<{ database: 'up' | 'down' }>;
  list(query: PlaceListQuery): Promise<{ items: PlaceSummary[]; total: number }>;
  map(query: PlaceMapQuery): Promise<PlaceSummary[]>;
  findById(id: string): Promise<PlaceDetail | null>;
  createLiveReport(input: {
    id: string;
    idempotencyKey: string;
    placeId: string;
    biteStatus: BiteStatus;
    crowdLevel: CrowdLevel;
    observedAt: Date;
  }): Promise<LiveConditionSummary>;
}

export function toPlaceListItem(place: PlaceSummary) {
  return {
    ...place,
    mapAvailable:
      place.latitude !== null &&
      place.longitude !== null &&
      place.coordinateStatus !== 'missing',
  };
}
