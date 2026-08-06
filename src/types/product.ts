export type WaterRuleStatus = 'open' | 'conditional' | 'unknown';

export interface WaterBodySummary {
  id: string;
  markerId: number;
  name: string;
  district: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  status: WaterRuleStatus;
  statusLabel: string;
  ruleSummary: string;
  tripCount7d: number;
  biteCount7d: number;
  latestUpdate: string;
  freshnessHours: number;
  tags: string[];
}

export type MethodFitStatus = 'compatible' | 'conditional' | 'unknown';

export interface FishingConstraint {
  rodLimit: string;
  hooksPerLineLimit: string;
  baitRestrictions: string[];
  equipmentRestrictions: string[];
  note: string;
}

export interface RuleSource {
  id: string;
  authority: string;
  title: string;
  scope: string;
  publishedAt: string;
  effectivePeriod: string;
  lastCheckedAt: string;
  url?: string;
  sourceType: 'authority' | 'operator_sample' | 'user_report';
}

export interface FieldStatus {
  id: 'water' | 'road' | 'safety';
  label: string;
  state: 'normal' | 'warning' | 'unknown';
  detail: string;
}

export interface WaterBodyDetail extends WaterBodySummary {
  methodFitStatus: MethodFitStatus;
  methodFitLabel: string;
  methodFitSummary: string;
  sampleMinimum: number;
  lastBiteAt?: string;
  primarySpecies: string[];
  primaryMethods: string[];
  fieldStatuses: FieldStatus[];
  constraint: FishingConstraint;
  sources: RuleSource[];
}

export type CorrectionReason = 'rule_outdated' | 'scope_incorrect' | 'safety_changed';

export interface LocalCorrectionDraft {
  id: string;
  waterBodyId: string;
  reason: CorrectionReason;
  createdAt: string;
  syncStatus: 'local';
}

export type TripResult = 'empty' | 'bite' | 'great';
export type TripPurpose = 'private' | 'anonymous_water';
export type TripAccessMode = 'car' | 'ebike' | 'walk' | 'difficult';
export type TripTagCategory = 'access' | 'water' | 'spot' | 'field' | 'facility' | 'custom';

export interface TripCoordinate {
  latitude: number;
  longitude: number;
  name: string;
  address: string;
}

export interface TripTag {
  id: string;
  label: string;
  category: TripTagCategory;
  source: 'system' | 'custom';
}

export interface LocalTripDraft {
  id: string;
  idempotencyKey: string;
  waterBodyId?: string;
  coordinate?: TripCoordinate;
  locationDescription?: string;
  photoPaths: string[];
  accessMode?: TripAccessMode;
  tags: TripTag[];
  result: TripResult;
  siteStatuses: string[];
  purpose: TripPurpose;
  preciseLocationIncluded: boolean;
  createdAt: string;
  syncStatus: 'local' | 'queued';
}

export interface PrivateSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  syncStatus: 'local';
}

export type ExternalSourcePlatform =
  | 'xiaohongshu'
  | 'douyin'
  | 'fishing_app'
  | 'other_public';

/**
 * 运营发现的公开内容线索。它不是站内用户趟次，也不能参与口况统计。
 */
export interface ExternalFishingClue {
  id: string;
  sourcePlatform: ExternalSourcePlatform;
  sourceUrl: string;
  placeHint: string;
  sourceExcerpt: string;
  capturedAt: string;
  reviewStatus: 'pending_review';
  countsTowardTripStats: false;
  preciseLocationIncluded: false;
  sourceRights: 'link_only';
  syncStatus: 'local';
}

export interface HistoricalSeedPlace {
  id: string;
  name: string;
  district: string;
  address: string;
  placeTypes: string[];
  species: string[];
  chargeText: string;
  sourcePlatform: 'diaoyu';
  sourceUrl: string;
  sourceRecordId: string;
  sourceCapturedAt: string;
  recordKind: 'place_baseline';
  baselineStatus: 'imported';
  countsTowardTripStats: false;
  coordinateStatus: 'missing' | 'geocoded' | 'user_confirmed';
  latitude: number | null;
  longitude: number | null;
}

export type PlaceUpdateType =
  | 'open_status'
  | 'charge'
  | 'species'
  | 'fishing_rule'
  | 'field_condition'
  | 'location'
  | 'other';

/** 用户对稳定地点实体追加的新版本；永远不覆盖初始来源快照。 */
export interface LocalPlaceUpdateRecord {
  id: string;
  idempotencyKey: string;
  placeId: string;
  updateType: PlaceUpdateType;
  value: string;
  note?: string;
  observedAt: string;
  createdAt: string;
  sourceType: 'user_update';
  preciseLocationIncluded: false;
  syncStatus: 'local' | 'queued';
}

export type PlaceCategory = 'wild_spot' | 'fishery' | 'water_body' | 'tackle_shop' | 'private_spot';
export type PlaceFeeType = 'free' | 'paid' | 'unknown';
export type PlaceCoordinateStatus = 'missing' | 'source_provided' | 'geocoded' | 'user_confirmed';
export type PlaceLocationPrecision = 'public_exact' | 'public_coarse' | 'private_exact';
export type BiteStatus = 'no_bite' | 'occasional' | 'active';
export type CrowdLevel = 'quiet' | 'normal' | 'crowded';

export interface LiveConditionSummary {
  sampleCount6h: number;
  biteLabel: string;
  crowdLabel: string;
  latestObservedAt?: string;
}

export interface PlaceSummary {
  id: string;
  name: string;
  district: string;
  address: string;
  category: PlaceCategory;
  feeType: PlaceFeeType;
  feeText: string;
  latitude: number | null;
  longitude: number | null;
  coordinateStatus: PlaceCoordinateStatus;
  locationPrecision: PlaceLocationPrecision;
  detailAvailable: boolean;
  mapAvailable: boolean;
  sceneTags: string[];
  methodTags: string[];
  speciesTags: string[];
  liveCondition: LiveConditionSummary;
}

export interface PlaceDetail extends PlaceSummary {
  source: {
    platform: string;
    url: string;
    capturedAt: string;
  };
  comments: Array<{
    id: string;
    text: string;
    rating?: number;
    publishedLabel: string;
    contentType: 'external_historical' | 'user_submission';
  }>;
  images: Array<{
    id: string;
    sourceUrl: string;
    thumbnailUrl?: string;
    bytes?: number;
  }>;
}

export interface WeatherDecision {
  location: { latitude: number; longitude: number; timezone: string };
  updatedAt: string;
  current: {
    observedAt: string;
    temperatureC: number;
    apparentTemperatureC: number;
    humidityPercent: number;
    pressureHpa: number;
    precipitationMm: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    windDirectionLabel: string;
    weatherCode: number;
    weatherLabel: string;
  };
  hourly: Array<{
    time: string;
    temperatureC: number;
    precipitationProbability: number;
    precipitationMm: number;
    windSpeedKmh: number;
  }>;
  advice: {
    score: number;
    level: 'recommended' | 'conditional' | 'avoid';
    title: string;
    summary: string;
    tactics: string[];
    reasons: string[];
    cautions: string[];
  };
  source: { provider: string; modelBased: true };
}
