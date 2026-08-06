import { useEffect, useMemo, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { getWeatherDecision, listMapPlaces } from '@/services/places-api';
import type { PlaceSummary, WeatherDecision } from '@/types/product';
import { windForceRange } from '@/utils/weather';
import './index.less';

const WUHAN_CENTER = { latitude: 30.5928, longitude: 114.3055 };

function distanceKm(latitude: number, longitude: number, place: PlaceSummary) {
  if (place.latitude === null || place.longitude === null) return Number.POSITIVE_INFINITY;
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6371;
  const deltaLatitude = toRadians(place.latitude - latitude);
  const deltaLongitude = toRadians(place.longitude - longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(place.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearbyBounds(latitude: number, longitude: number) {
  return { north: latitude + 0.22, south: latitude - 0.22, east: longitude + 0.27, west: longitude - 0.27 };
}

function liveConditionText(place: PlaceSummary) {
  if (place.liveCondition.sampleCount6h === 0) return '近 6 小时暂无钓友实况';
  return `${place.liveCondition.biteLabel} · ${place.liveCondition.crowdLabel} · ${place.liveCondition.sampleCount6h} 人更新`;
}

function pressureLabel(pressureHpa: number) {
  if (pressureHpa >= 1015) return '偏高';
  if (pressureHpa <= 1005) return '偏低';
  return '适中';
}

function districtLabel(district: string) {
  const normalized = district.replace(/^武汉市/, '').trim().replace(/[区县]$/, '');
  return normalized ? `${normalized}城区` : '所在城区';
}

export default function HomePage() {
  const navigationMetrics = useMemo(() => {
    const windowInfo = Taro.getWindowInfo();
    const capsule = Taro.getMenuButtonBoundingClientRect();
    const statusBarHeight = windowInfo.statusBarHeight || 20;
    const capsuleGap = Math.max(6, capsule.top - statusBarHeight);
    return {
      statusBarHeight,
      navigationHeight: capsule.height + capsuleGap * 2,
      capsuleInset: Math.max(16, windowInfo.windowWidth - capsule.left + 8),
    };
  }, []);
  const [coordinate, setCoordinate] = useState(WUHAN_CENTER);
  const [locationLabel, setLocationLabel] = useState('所在城区');
  const [located, setLocated] = useState(false);
  const [places, setPlaces] = useState<PlaceSummary[]>([]);
  const [weather, setWeather] = useState<WeatherDecision>();
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const loadDecision = async (latitude: number, longitude: number) => {
    setLoading(true);
    setError('');
    try {
      const [weatherResult, placeResult] = await Promise.all([
        getWeatherDecision(latitude, longitude),
        listMapPlaces({ ...nearbyBounds(latitude, longitude) }),
      ]);
      const sortedPlaces = placeResult.data
        .sort((left, right) => distanceKm(latitude, longitude, left) - distanceKm(latitude, longitude, right));
      setWeather(weatherResult.data);
      setPlaces(sortedPlaces.slice(0, 3));
      if (sortedPlaces[0]?.district) setLocationLabel(districtLabel(sortedPlaces[0].district));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '附近钓情暂时无法加载');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDecision(WUHAN_CENTER.latitude, WUHAN_CENTER.longitude); }, []);

  const locate = async () => {
    setLocating(true);
    try {
      const result = await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true });
      const next = { latitude: result.latitude, longitude: result.longitude };
      setCoordinate(next);
      setLocated(true);
      await loadDecision(next.latitude, next.longitude);
    } catch {
      Taro.showModal({
        title: '未能获取位置',
        content: `已继续显示${locationLabel}钓情。可在小程序设置中开启定位后重试。`,
        showCancel: false,
      });
    } finally {
      setLocating(false);
    }
  };

  const openDetail = (place: PlaceSummary) => {
    Taro.navigateTo({ url: `/package-water/detail/index?id=${encodeURIComponent(place.id)}` });
  };

  const maxRain = useMemo(() => Math.max(0, ...(weather?.hourly.slice(0, 3).map((item) => item.precipitationProbability) ?? [])), [weather]);
  const adviceLevel = weather?.advice.level ?? 'conditional';

  return (
    <View className='home-page'>
      <View className='home-navigation' style={{ paddingTop: `${navigationMetrics.statusBarHeight}px` }}>
        <View
          className='home-navigation__bar'
          style={{
            height: `${navigationMetrics.navigationHeight}px`,
            paddingLeft: `${navigationMetrics.capsuleInset}px`,
            paddingRight: `${navigationMetrics.capsuleInset}px`,
          }}
        >
          <View className='home-navigation__title-group'>
            <Text id='e2e-home-page-title' className='home-navigation__title'>出钓参考</Text>
            <Button id='e2e-home-info' className='info-cta' ariaLabel='查看出钓安全提示' hoverClass='info-cta--pressed' onClick={() => Taro.showModal({
              title: '出发前请二次核实',
              content: '钓点开放、收费、水位和禁钓规则以现场与主管部门信息为准。',
              showCancel: false,
              confirmText: '知道了',
            })}><Text className='info-cta__glyph'>i</Text></Button>
          </View>
        </View>
      </View>

      <View className={`decision-card decision-card--${adviceLevel}`}>
        <View className='decision-card__top'>
          <View>
            <Text className='home-eyebrow'>{locationLabel} · 出钓建议</Text>
            <Text id='e2e-weather-title' className='home-title'>{loading ? '正在更新钓情…' : weather?.advice.title || '天气暂时未更新'}</Text>
          </View>
          <Button id='e2e-home-locate' className='locate-cta' loading={locating} disabled={locating} hoverClass='locate-cta--pressed' onClick={() => void locate()}>{located ? '重新定位' : '定位到我'}</Button>
        </View>

        {weather ? (
          <>
            <View className='weather-main'>
              <Text className='weather-temperature'>{Math.round(weather.current.temperatureC)}°</Text>
              <View className='weather-copy'>
                <Text className='weather-state'>{weather.current.weatherLabel} · {weather.current.windDirectionLabel} · 风力{windForceRange(weather.current.windSpeedKmh)}</Text>
                <Text className='weather-meta'>气压{pressureLabel(weather.current.pressureHpa)} · 未来3小时降雨最高 {maxRain}%</Text>
              </View>
              <Text className='advice-score'>{weather.advice.score}分</Text>
            </View>
            <Text className='decision-summary'>{weather.advice.summary}</Text>
            <View className='advice-strip'>
              <Text className='advice-strip__text'>{weather.advice.tactics[0]}</Text>
            </View>
          </>
        ) : null}
      </View>

      {error ? (
        <View className='home-load-state'><Text>{error}</Text><Button onClick={() => void loadDecision(coordinate.latitude, coordinate.longitude)}>重试</Button></View>
      ) : null}

      <View className='section-head'>
        <View>
          <Text className='section-title'>附近钓情</Text>
          <Text className='section-subtitle'>{located ? `按${locationLabel}当前位置排序` : `当前按${locationLabel}排序，定位后更准`}</Text>
        </View>
        <Button className='section-link' onClick={() => Taro.switchTab({ url: '/pages/map/index' })}>查看地图</Button>
      </View>

      <View className='home-place-list'>
        {places.map((place) => (
          <Button key={place.id} className='home-place-card' hoverClass='home-place-card--pressed' onClick={() => openDetail(place)}>
            <View className='home-place-card__head'>
              <Text className='home-place-card__name'>{place.name}</Text>
              <Text className='distance-badge'>{distanceKm(coordinate.latitude, coordinate.longitude, place).toFixed(1)}km</Text>
            </View>
            <Text className='home-place-card__address'>{place.district} · {place.address}</Text>
            <View className='condition-line'>
              <Text className={`home-fee home-fee--${place.feeType}`}>{place.feeType === 'paid' ? '收费' : place.feeType === 'free' ? '免费' : '费用未知'}</Text>
              <Text className='condition-line__freshness'>{liveConditionText(place)}</Text>
            </View>
          </Button>
        ))}
        {!loading && places.length === 0 && !error ? <View className='home-load-state'>附近暂无带坐标钓点，可进入地图查看武汉全城。</View> : null}
      </View>

      <View className='home-actions'>
        <Button id='e2e-home-record-cta' className='primary-cta' onClick={() => Taro.switchTab({ url: '/pages/record/index' })}>记录现场钓情</Button>
        <Button className='secondary-cta' onClick={() => Taro.switchTab({ url: '/pages/map/index' })}>打开钓点地图</Button>
      </View>
    </View>
  );
}
