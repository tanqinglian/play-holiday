import Taro from '@tarojs/taro';

/** 识鱼服务域名(稳定可用) */
export const BASE_URL = 'https://31e9bde3-0f01-4d82-8518-14ffedea429c.dev.coze.site';

export interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST';
  data?: Record<string, unknown>;
  header?: Record<string, string>;
}

/**
 * 轻封装 Taro.request:
 * - 自动拼 BASE_URL(传完整 http(s) 链接则原样使用)
 * - 默认 JSON 头
 * - 非 2xx 抛错,错误信息优先取后端返回的 error 字段
 */
export function request<T = unknown>(options: RequestOptions): Promise<T> {
  const { url, method = 'GET', data, header } = options;
  return Taro.request({
    url: /^https?:/.test(url) ? url : `${BASE_URL}${url}`,
    method,
    data,
    header: { 'content-type': 'application/json', ...header },
  }).then((res) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data as T;
    }
    const msg =
      (res.data && (res.data as { error?: string }).error) || `请求失败 (${res.statusCode})`;
    throw new Error(msg);
  });
}
