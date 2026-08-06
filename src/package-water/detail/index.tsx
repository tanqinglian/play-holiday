import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { getPlaceDetail, getWeatherDecision, resolvePlaceImage, submitLiveReport } from '@/services/places-api';
import type { BiteStatus, CrowdLevel, PlaceDetail, WeatherDecision } from '@/types/product';
import { windForceRange } from '@/utils/weather';
import './index.less';

const FAVORITES_KEY = 'ph.favorites.v1';

const CATEGORY_LABEL: Record<PlaceDetail['category'], string> = {
  wild_spot: '野钓',
  fishery: '收费场',
  water_body: '水域',
  tackle_shop: '钓具店',
  private_spot: '私人点',
};

const SOURCE_LABEL: Record<string, string> = {
  diaoyu: '钓鱼之家',
  baohu_toolbox: '爆护工具箱 · CC BY 4.0',
};

function getStringList(key: string): string[] {
  const value = Taro.getStorageSync<unknown>(key);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export default function PlaceDetailPage() {
  const router = useRouter();
  const placeId = router.params.id;
  const [place, setPlace] = useState<PlaceDetail>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [weather, setWeather] = useState<WeatherDecision>();
  const [weatherError, setWeatherError] = useState('');
  const [showLiveForm, setShowLiveForm] = useState(false);
  const [biteStatus, setBiteStatus] = useState<BiteStatus>();
  const [crowdLevel, setCrowdLevel] = useState<CrowdLevel>();
  const [submittingLive, setSubmittingLive] = useState(false);
  const [liveSubmissionKey, setLiveSubmissionKey] = useState('');

  const load = async () => {
    if (!placeId) {
      setError('缺少钓点 ID，无法查看详情');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await getPlaceDetail(placeId);
      setPlace(result.data);
      setWeather(undefined);
      setWeatherError('');
      if (result.data.mapAvailable && result.data.latitude !== null && result.data.longitude !== null) {
        try {
          const weatherResult = await getWeatherDecision(result.data.latitude, result.data.longitude);
          setWeather(weatherResult.data);
        } catch (weatherLoadError) {
          setWeatherError(weatherLoadError instanceof Error ? weatherLoadError.message : '天气暂时未更新');
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '钓点详情暂时无法加载');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // The route id is the complete detail request identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeId]);

  useDidShow(() => {
    if (placeId) setIsFavorite(getStringList(FAVORITES_KEY).includes(placeId));
  });

  const toggleFavorite = () => {
    if (!place) return;
    const favorites = getStringList(FAVORITES_KEY);
    const next = favorites.includes(place.id)
      ? favorites.filter((id) => id !== place.id)
      : [...favorites, place.id];
    Taro.setStorageSync(FAVORITES_KEY, next);
    setIsFavorite(next.includes(place.id));
    Taro.showToast({ title: next.includes(place.id) ? '已收藏到本机' : '已取消收藏', icon: 'none' });
  };

  const navigate = () => {
    if (!place?.mapAvailable || place.latitude === null || place.longitude === null) return;
    Taro.openLocation({
      latitude: place.latitude,
      longitude: place.longitude,
      name: place.name,
      address: place.address,
      scale: 16,
    });
  };

  const submitCondition = async () => {
    if (!place || !biteStatus || !crowdLevel || submittingLive) return;
    const idempotencyKey = liveSubmissionKey || `live-client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setLiveSubmissionKey(idempotencyKey);
    setSubmittingLive(true);
    try {
      const result = await submitLiveReport(place.id, { idempotencyKey, biteStatus, crowdLevel });
      setPlace((current) => current ? { ...current, liveCondition: result.data } : current);
      setShowLiveForm(false);
      setBiteStatus(undefined);
      setCrowdLevel(undefined);
      setLiveSubmissionKey('');
      Taro.showToast({ title: '钓情已更新', icon: 'success' });
    } catch (submitError) {
      Taro.showToast({ title: submitError instanceof Error ? submitError.message : '提交失败，请重试', icon: 'none' });
    } finally {
      setSubmittingLive(false);
    }
  };

  if (loading) {
    return <View id='e2e-detail-loading' className='detail-state'><Text>正在加载真实钓点资料…</Text></View>;
  }

  if (error || !place) {
    return (
      <View id='e2e-detail-error' className='detail-state'>
        <Text className='detail-state__title'>这条钓点资料不可用</Text>
        <Text className='detail-state__text'>{error || '钓点不存在'}</Text>
        <Button className='detail-state__action' onClick={() => void load()}>重新加载</Button>
        <Button className='detail-state__back' onClick={() => Taro.navigateBack()}>返回列表</Button>
      </View>
    );
  }

  const tags = [CATEGORY_LABEL[place.category], ...place.sceneTags, ...place.methodTags, ...place.speciesTags];

  return (
    <View className='place-detail-page'>
      <View className='detail-hero'>
        <Text className='detail-eyebrow'>{place.district} · {CATEGORY_LABEL[place.category]}</Text>
        <Text id='e2e-water-detail-title' className='detail-title'>{place.name}</Text>
        <Text className='detail-address'>{place.address || '暂无详细地址'}</Text>
        <View className='tag-row'>
          {tags.slice(0, 10).map((tag) => <Text key={tag} className='detail-tag'>{tag}</Text>)}
        </View>
      </View>

      {weather ? (
        <View id='e2e-place-weather' className={`weather-card weather-card--${weather.advice.level}`}>
          <View className='weather-card__head'>
            <View>
              <Text className='weather-card__eyebrow'>该钓点实时天气</Text>
              <Text className='weather-card__title'>{weather.advice.title}</Text>
            </View>
            <Text className='weather-card__score'>{weather.advice.score}分</Text>
          </View>
          <View className='weather-facts'>
            <View><Text className='weather-facts__value'>{Math.round(weather.current.temperatureC)}°</Text><Text className='weather-facts__label'>{weather.current.weatherLabel}</Text></View>
            <View><Text className='weather-facts__value'>{Math.round(weather.current.pressureHpa)}</Text><Text className='weather-facts__label'>气压 hPa</Text></View>
            <View><Text className='weather-facts__value'>{windForceRange(weather.current.windSpeedKmh)}</Text><Text className='weather-facts__label'>{weather.current.windDirectionLabel}</Text></View>
          </View>
          <Text className='weather-card__summary'>{weather.advice.summary}</Text>
          <View className='tactic-list'>
            {weather.advice.tactics.map((tactic) => <Text key={tactic} className='tactic-item'>{tactic}</Text>)}
          </View>
          {weather.advice.cautions.length > 0 ? <Text className='weather-caution'>{weather.advice.cautions.join('；')}</Text> : null}
        </View>
      ) : (
        <View className='weather-unavailable'>
          <Text className='weather-unavailable__title'>该钓点天气暂时不可用</Text>
          <Text className='weather-unavailable__text'>{place.mapAvailable ? (weatherError || '正在更新…') : '原始资料没有坐标，无法匹配该地点天气。'}</Text>
        </View>
      )}

      <View id='e2e-live-condition' className='live-card'>
        <View className='section-head'>
          <View>
            <Text className='section-title'>现场钓情</Text>
            <Text className='live-card__window'>仅统计近 6 小时结构化更新</Text>
          </View>
          <Text className='live-card__count'>{place.liveCondition.sampleCount6h} 人更新</Text>
        </View>
        <View className='live-status-row'>
          <View><Text className='live-status__label'>鱼口</Text><Text className='live-status__value'>{place.liveCondition.biteLabel}</Text></View>
          <View><Text className='live-status__label'>拥挤度</Text><Text className='live-status__value'>{place.liveCondition.crowdLabel}</Text></View>
        </View>
        {place.liveCondition.latestObservedAt ? <Text className='live-card__time'>最近更新：{new Date(place.liveCondition.latestObservedAt).toLocaleString()}</Text> : null}
        <Button id='e2e-open-live-form' className='live-update-action' hoverClass='live-update-action--pressed' onClick={() => setShowLiveForm((current) => !current)}>{showLiveForm ? '收起' : '我在这里，更新钓情'}</Button>

        {showLiveForm ? (
          <View id='e2e-live-form' className='live-form'>
            <Text className='live-form__label'>1. 现在鱼口怎么样？</Text>
            <View className='live-options'>
              {([['no_bite', '暂时无口'], ['occasional', '偶尔有口'], ['active', '鱼口活跃']] as Array<[BiteStatus, string]>).map(([value, label]) => (
                <Button key={value} id={`e2e-bite-${value}`} className={`live-option ${biteStatus === value ? 'live-option--active' : ''}`} onClick={() => setBiteStatus(value)}>{label}</Button>
              ))}
            </View>
            <Text className='live-form__label'>2. 现在人多吗？</Text>
            <View className='live-options'>
              {([['quiet', '人少'], ['normal', '人数一般'], ['crowded', '较拥挤']] as Array<[CrowdLevel, string]>).map(([value, label]) => (
                <Button key={value} id={`e2e-crowd-${value}`} className={`live-option ${crowdLevel === value ? 'live-option--active' : ''}`} onClick={() => setCrowdLevel(value)}>{label}</Button>
              ))}
            </View>
            <Text className='live-form__privacy'>仅提交钓点 ID 和上述状态，不上传你的精准站位。</Text>
            <Button id='e2e-submit-live' className='live-submit' loading={submittingLive} disabled={!biteStatus || !crowdLevel || submittingLive} onClick={() => void submitCondition()}>提交实况</Button>
          </View>
        ) : null}
      </View>

      {place.images.length > 0 ? (
        <View className='detail-section'>
          <Text className='section-title'>钓点图片</Text>
          <View className='image-grid'>
            {place.images.slice(0, 6).map((item, index) => (
              <Image
                key={item.id}
                className='place-image'
                src={resolvePlaceImage(item.thumbnailUrl || item.sourceUrl)}
                mode='aspectFill'
                lazyLoad
                showMenuByLongpress
                onClick={() => Taro.previewImage({
                  current: resolvePlaceImage(item.sourceUrl),
                  urls: place.images.slice(0, 12).map((image) => resolvePlaceImage(image.sourceUrl)),
                })}
                ariaLabel={`${place.name}图片 ${index + 1}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View className='detail-card'>
        <Text className='section-title'>基本信息</Text>
        <View className='fact-row'><Text className='fact-label'>收费</Text><Text className='fact-value'>{place.feeText || '暂无收费信息'}</Text></View>
        <View className='fact-row'><Text className='fact-label'>定位</Text><Text className='fact-value'>{place.mapAvailable ? '已有可导航坐标' : '原始资料未提供经纬度'}</Text></View>
        <View className='fact-row'><Text className='fact-label'>鱼种</Text><Text className='fact-value'>{place.speciesTags.join('、') || '暂无记录'}</Text></View>
      </View>

      <View className='detail-section'>
        <View className='section-head'>
          <Text className='section-title'>历史评论</Text>
          <Text className='section-meta'>{place.comments.length} 条</Text>
        </View>
        {place.comments.length > 0 ? place.comments.map((comment) => (
          <View key={comment.id} className='comment-card'>
            <View className='comment-card__head'>
              <Text className='comment-card__source'>{comment.contentType === 'external_historical' ? '公开来源历史评论' : '用户提交'}</Text>
              <Text className='comment-card__time'>{comment.publishedLabel}</Text>
            </View>
            <Text className='comment-card__text'>{comment.text}</Text>
            {comment.rating ? <Text className='comment-card__rating'>评分 {comment.rating}/5</Text> : null}
          </View>
        )) : <Text className='empty-copy'>暂无历史评论</Text>}
        <Button id='e2e-submit-comment' className='disabled-submit' disabled>发表评论（审核功能即将开放）</Button>
      </View>

      <View className='detail-card source-card'>
        <Text className='section-title'>来源与时效</Text>
        <Text className='source-card__text'>本页为公开钓点存量资料，不等同于当前可钓、安全或营业状态。</Text>
        <Text className='source-card__meta'>来源：{SOURCE_LABEL[place.source.platform] || place.source.platform} · 收录于 {place.source.capturedAt}</Text>
        {place.source.url ? <Button className='source-copy' onClick={() => {
          Taro.setClipboardData({ data: place.source.url });
        }}>复制原始来源链接</Button> : null}
      </View>

      <View className='sticky-actions'>
        <Button className={`favorite-action ${isFavorite ? 'favorite-action--active' : ''}`} onClick={toggleFavorite}>{isFavorite ? '已收藏' : '收藏'}</Button>
        <Button id='e2e-open-location' className='navigate-action' disabled={!place.mapAvailable} onClick={navigate}>{place.mapAvailable ? '导航到钓点' : '暂无坐标，无法导航'}</Button>
      </View>
    </View>
  );
}
