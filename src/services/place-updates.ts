import Taro from '@tarojs/taro';
import type { LocalPlaceUpdateRecord, PlaceUpdateType } from '@/types/product';

export const PLACE_UPDATE_STORAGE_KEY = 'ph.place.updates.v1';

export function getPlaceUpdates(placeId?: string): LocalPlaceUpdateRecord[] {
  const updates = Taro.getStorageSync<LocalPlaceUpdateRecord[]>(PLACE_UPDATE_STORAGE_KEY) || [];
  return placeId ? updates.filter((update) => update.placeId === placeId) : updates;
}

export function appendPlaceUpdate(input: {
  placeId: string;
  updateType: PlaceUpdateType;
  value: string;
  note?: string;
  observedAt?: string;
}): LocalPlaceUpdateRecord[] {
  const createdAt = new Date().toISOString();
  const update: LocalPlaceUpdateRecord = {
    id: `place-update-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    idempotencyKey: `place-update-local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    placeId: input.placeId,
    updateType: input.updateType,
    value: input.value.trim(),
    note: input.note?.trim() || undefined,
    observedAt: input.observedAt ?? createdAt,
    createdAt,
    sourceType: 'user_update',
    preciseLocationIncluded: false,
    syncStatus: 'local',
  };
  const next = [update, ...getPlaceUpdates()];
  Taro.setStorageSync(PLACE_UPDATE_STORAGE_KEY, next);
  return next;
}
