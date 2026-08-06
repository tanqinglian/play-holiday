import { request } from '@/services/request';

/** 单条鱼类识别结果 */
export interface FishInfo {
  /** 鱼类名称 */
  name: string;
  /** 学名 */
  scientificName: string;
  /** 可能性(0-100) */
  probability: number;
  /** 外观特征 */
  features: string;
  /** 栖息地 */
  habitat: string;
  /** 用途 */
  usage: string;
}

export interface IdentifyFishData {
  /** 图中是否检测到鱼 */
  isFish: boolean;
  /** 识别到的鱼类列表(可能多条,按可能性排列) */
  fishList: FishInfo[];
  /** 未检测到鱼时的说明文案 */
  note?: string;
}

export interface IdentifyFishResponse {
  success: boolean;
  data?: IdentifyFishData;
  /** 失败时后端返回 */
  error?: string;
}

/**
 * 识别鱼类。
 * @param image base64(可带 `data:image/...;base64,` 前缀)或公网图片 URL
 */
export function identifyFish(image: string): Promise<IdentifyFishResponse> {
  return request<IdentifyFishResponse>({
    url: '/api/identify-fish',
    method: 'POST',
    data: { image },
  });
}
