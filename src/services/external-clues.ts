import Taro from '@tarojs/taro';
import type { ExternalFishingClue, ExternalSourcePlatform } from '@/types/product';

export const EXTERNAL_CLUE_STORAGE_KEY = 'ph.external.clues.v1';

const PLATFORM_HOSTS: Array<[ExternalSourcePlatform, RegExp]> = [
  ['xiaohongshu', /(?:xiaohongshu\.com|xhslink\.com)/i],
  ['douyin', /(?:douyin\.com|iesdouyin\.com)/i],
  ['fishing_app', /(?:diaoyu\.com|catches\.com)/i],
];

export function extractFirstHttpUrl(value: string): string | undefined {
  return value.match(/https?:\/\/[^\s，。；;）)]+/i)?.[0];
}

export function inferExternalPlatform(value: string): ExternalSourcePlatform {
  return PLATFORM_HOSTS.find(([, pattern]) => pattern.test(value))?.[0] ?? 'other_public';
}

export function sanitizeSourceExcerpt(value: string, sourceUrl: string): string {
  return value
    .replace(sourceUrl, '')
    .replace(/@[\w\u4e00-\u9fa5-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function createExternalClue(shareText: string, placeHint: string): ExternalFishingClue {
  const normalizedText = shareText.trim();
  const normalizedPlace = placeHint.trim();
  const sourceUrl = extractFirstHttpUrl(normalizedText);

  if (!sourceUrl) throw new Error('请粘贴包含公开链接的分享文本');
  if (!normalizedPlace) throw new Error('请填写可核实的地点线索');

  const capturedAt = new Date().toISOString();
  return {
    id: `external-clue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourcePlatform: inferExternalPlatform(sourceUrl),
    sourceUrl,
    placeHint: normalizedPlace.slice(0, 60),
    sourceExcerpt: sanitizeSourceExcerpt(normalizedText, sourceUrl),
    capturedAt,
    reviewStatus: 'pending_review',
    countsTowardTripStats: false,
    preciseLocationIncluded: false,
    sourceRights: 'link_only',
    syncStatus: 'local',
  };
}

export function getExternalClues(): ExternalFishingClue[] {
  return Taro.getStorageSync<ExternalFishingClue[]>(EXTERNAL_CLUE_STORAGE_KEY) || [];
}

export function saveExternalClue(clue: ExternalFishingClue): ExternalFishingClue[] {
  const next = [clue, ...getExternalClues()];
  Taro.setStorageSync(EXTERNAL_CLUE_STORAGE_KEY, next);
  return next;
}

export function deleteExternalClue(id: string): ExternalFishingClue[] {
  const next = getExternalClues().filter((clue) => clue.id !== id);
  Taro.setStorageSync(EXTERNAL_CLUE_STORAGE_KEY, next);
  return next;
}
