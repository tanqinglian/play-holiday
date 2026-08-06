import Taro from '@tarojs/taro';
import type { BiteStatus, CrowdLevel, LiveConditionSummary, PlaceDetail, PlaceFeeType, PlaceSummary, WeatherDecision } from '@/types/product';

export interface PlaceFilters {
  query?: string;
  feeType?: PlaceFeeType;
  sceneTag?: string;
}

interface PlaceListResponse {
  data: PlaceSummary[];
  meta: { page: number; pageSize: number; total: number; hasMore: boolean };
}

interface PlaceMapResponse {
  data: PlaceSummary[];
  meta: { count: number };
}

interface PlaceNearbyResponse {
  data: Array<PlaceSummary & { distanceKm: number }>;
  meta: { count: number; radiusKm: number; center: { latitude: number; longitude: number } };
}

interface PlaceDetailResponse {
  data: PlaceDetail;
}

interface WeatherResponse {
  data: WeatherDecision;
}

interface LiveReportResponse {
  data: LiveConditionSummary;
}

interface ImageUploadResponse {
  data: {
    id: string;
    url: string;
    thumbnailUrl: string;
    mimeType: string;
    width: number;
    height: number;
    byteSize: number;
  };
}

function queryString(params: Record<string, string | number | undefined>) {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

async function transportRequest<T>(path: string, method: 'GET' | 'POST' = 'GET', data?: object): Promise<T> {
  if (PLAY_HOLIDAY_CLOUD_ENV_ID && PLAY_HOLIDAY_CLOUD_SERVICE) {
    const response = await Taro.cloud.callContainer<T>({
      config: { env: PLAY_HOLIDAY_CLOUD_ENV_ID },
      path,
      method,
      data,
      timeout: method === 'POST' ? 20_000 : 8_000,
      header: {
        'content-type': 'application/json',
        'X-WX-SERVICE': PLAY_HOLIDAY_CLOUD_SERVICE,
      },
    });
    if (response.statusCode >= 200 && response.statusCode < 300) return response.data;
    const payload = response.data as { message?: string };
    throw new Error(payload?.message || `钓点服务请求失败（${response.statusCode}）`);
  }
  const response = await Taro.request<T>({
    url: `${PLAY_HOLIDAY_API_BASE_URL}${path}`,
    method,
    data,
    timeout: method === 'POST' ? 20_000 : 8_000,
    header: { 'content-type': 'application/json' },
  });
  if (response.statusCode >= 200 && response.statusCode < 300) return response.data;
  const payload = response.data as { message?: string };
  throw new Error(payload?.message || `钓点服务请求失败（${response.statusCode}）`);
}

async function apiRequest<T>(path: string): Promise<T> {
  return transportRequest<T>(path);
}

export function listPlaces(filters: PlaceFilters & { page?: number; pageSize?: number } = {}) {
  return apiRequest<PlaceListResponse>(`/api/places${queryString({
    query: filters.query,
    feeType: filters.feeType,
    sceneTag: filters.sceneTag,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
  })}`);
}

export function listMapPlaces(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
} & PlaceFilters) {
  return apiRequest<PlaceMapResponse>(`/api/places/map${queryString({ ...bounds, limit: 500 })}`);
}

export function listNearbyPlaces(center: { latitude: number; longitude: number; radiusKm?: number } & PlaceFilters) {
  return apiRequest<PlaceNearbyResponse>(`/api/places/nearby${queryString({
    latitude: center.latitude,
    longitude: center.longitude,
    radiusKm: center.radiusKm ?? 10,
    feeType: center.feeType,
    sceneTag: center.sceneTag,
  })}`);
}

export function getPlaceDetail(id: string) {
  return apiRequest<PlaceDetailResponse>(`/api/places/${encodeURIComponent(id)}`);
}

export function getWeatherDecision(latitude: number, longitude: number) {
  return apiRequest<WeatherResponse>(`/api/weather${queryString({ latitude, longitude })}`);
}

export async function submitLiveReport(placeId: string, input: {
  idempotencyKey: string;
  biteStatus: BiteStatus;
  crowdLevel: CrowdLevel;
}) {
  return transportRequest<LiveReportResponse>(
    `/api/places/${encodeURIComponent(placeId)}/live-reports`,
    'POST',
    input,
  );
}

export async function uploadTripImage(filePath: string, tripId: string) {
  if (PLAY_HOLIDAY_CLOUD_ENV_ID && PLAY_HOLIDAY_CLOUD_SERVICE) {
    const compressed = await Taro.compressImage({ src: filePath, quality: 75, compressedWidth: 1600 });
    const contentBase64 = await new Promise<string>((resolve, reject) => {
      Taro.getFileSystemManager().readFile({
        filePath: compressed.tempFilePath,
        encoding: 'base64',
        success: (result) => resolve(String(result.data)),
        fail: reject,
      });
    });
    const payload = await transportRequest<ImageUploadResponse>('/api/images', 'POST', {
      ownerType: 'trip',
      ownerId: tripId,
      mimeType: 'image/jpeg',
      contentBase64,
    });
    return {
      ...payload.data,
      url: resolvePlaceImage(payload.data.url),
      thumbnailUrl: resolvePlaceImage(payload.data.thumbnailUrl),
    };
  }
  const response = await Taro.uploadFile({
    url: `${PLAY_HOLIDAY_API_BASE_URL}/api/images${queryString({ ownerType: 'trip', ownerId: tripId })}`,
    filePath,
    name: 'file',
    timeout: 20_000,
  });
  let payload: ImageUploadResponse | { message?: string };
  try {
    payload = JSON.parse(response.data) as ImageUploadResponse | { message?: string };
  } catch {
    throw new Error('图片服务返回无效数据');
  }
  if (response.statusCode >= 200 && response.statusCode < 300 && 'data' in payload) {
    return { ...payload.data, url: resolvePlaceImage(payload.data.url), thumbnailUrl: resolvePlaceImage(payload.data.thumbnailUrl) };
  }
  throw new Error(('message' in payload && payload.message) || `图片上传失败（${response.statusCode}）`);
}

export function resolvePlaceImage(url?: string) {
  if (!url) return '';
  return /^https?:\/\//.test(url) ? url : `${PLAY_HOLIDAY_API_BASE_URL}${url}`;
}
