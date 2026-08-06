import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Button, CoverView, Input, Map, ScrollView, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { listMapPlaces, listNearbyPlaces, listPlaces, type PlaceFilters } from '@/services/places-api';
import type { PlaceFeeType, PlaceSummary, PrivateSpot } from '@/types/product';
import './index.less';

type ViewMode = 'map' | 'list';
type FilterId = 'all' | 'free' | 'paid' | 'wild' | 'black_pit';
type MapScope = 'nearby' | 'viewport' | 'focused' | 'fallback';

const WUHAN_CENTER = { latitude: 30.5928, longitude: 114.3055 };
const DEFAULT_RADIUS_KM = 10;
const PRIVATE_SPOT_STORAGE_KEY = 'ph.private.spots.v1';
const PRIVATE_MARKER_OFFSET = 100_000;

const FILTERS: Array<{ id: FilterId; label: string; feeType?: PlaceFeeType; sceneTag?: string }> = [
  { id: 'all', label: '全部' },
  { id: 'free', label: '免费' , feeType: 'free' },
  { id: 'paid', label: '收费', feeType: 'paid' },
  { id: 'wild', label: '野钓', sceneTag: '湖库' },
  { id: 'black_pit', label: '黑坑', sceneTag: '黑坑' },
];

const CATEGORY_LABEL: Record<PlaceSummary['category'], string> = {
  wild_spot: '野钓',
  fishery: '收费场',
  water_body: '水域',
  tackle_shop: '钓具店',
  private_spot: '私人点',
};

interface MapRegion {
  northeast: { latitude: number; longitude: number };
  southwest: { latitude: number; longitude: number };
}

function selectedFilters(filter: FilterId, query?: string): PlaceFilters {
  const current = FILTERS.find((item) => item.id === filter);
  return { query, feeType: current?.feeType, sceneTag: current?.sceneTag };
}

function distanceKm(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export default function FishingMapPage() {
  const [mode, setMode] = useState<ViewMode>('map');
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [list, setList] = useState<PlaceSummary[]>([]);
  const [mapPlaces, setMapPlaces] = useState<PlaceSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [center, setCenter] = useState(WUHAN_CENTER);
  const [userCoordinate, setUserCoordinate] = useState<typeof WUHAN_CENTER>();
  const [mapScale, setMapScale] = useState(11);
  const [mapScope, setMapScope] = useState<MapScope>('nearby');
  const [locating, setLocating] = useState(false);
  const [privateSpots, setPrivateSpots] = useState<PrivateSpot[]>([]);
  const mapInitialized = useRef(false);

  const activeFilters = useMemo(
    () => selectedFilters(filter, deferredSearch || undefined),
    [deferredSearch, filter],
  );

  const loadList = async (targetPage = 1, append = false) => {
    if (loading && append) return;
    setLoading(true);
    setError('');
    try {
      const result = await listPlaces({ ...activeFilters, page: targetPage, pageSize: 20 });
      setList((current) => append ? [...current, ...result.data] : result.data);
      setTotal(result.meta.total);
      setHasMore(result.meta.hasMore);
      setPage(targetPage);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '钓点列表暂时无法加载');
    } finally {
      setLoading(false);
    }
  };

  const loadMap = async (bounds: { north: number; south: number; east: number; west: number }) => {
    setLoading(true);
    setError('');
    try {
      const result = await listMapPlaces({ ...bounds, ...activeFilters, query: undefined });
      setMapPlaces(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '地图钓点暂时无法加载');
    } finally {
      setLoading(false);
    }
  };

  const loadNearby = async (target: { latitude: number; longitude: number }) => {
    setLoading(true);
    setError('');
    try {
      const result = await listNearbyPlaces({
        ...target,
        radiusKm: DEFAULT_RADIUS_KM,
        ...activeFilters,
        query: undefined,
      });
      setMapPlaces(result.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '附近钓点暂时无法加载');
    } finally {
      setLoading(false);
    }
  };

  const locateAndLoadNearby = async (showFailureModal = true) => {
    setLocating(true);
    setLoading(true);
    setError('');
    try {
      const location = await Taro.getLocation({ type: 'gcj02', isHighAccuracy: true });
      const target = { latitude: location.latitude, longitude: location.longitude };
      mapInitialized.current = true;
      setUserCoordinate(target);
      setCenter(target);
      setMapScale(11);
      setMapScope('nearby');
      setSelectedId(undefined);
      await loadNearby(target);
    } catch {
      mapInitialized.current = true;
      setUserCoordinate(undefined);
      setCenter(WUHAN_CENTER);
      setMapScale(11);
      setMapScope('fallback');
      await loadNearby(WUHAN_CENTER);
      if (showFailureModal) {
        Taro.showModal({
          title: '未能获取当前位置',
          content: '已暂时显示武汉中心 10km 钓点。在小程序设置中开启定位后，点击“定位”重试。',
          showCancel: false,
        });
      }
    } finally {
      setLocating(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'list') void loadList(1, false);
    else if (!mapInitialized.current) void locateAndLoadNearby();
    else if (mapScope === 'nearby' && userCoordinate) void loadNearby(userCoordinate);
    else if (mapScope === 'fallback') void loadNearby(WUHAN_CENTER);
    else if (mapScope === 'viewport') refreshViewport();
    // activeFilters is intentionally the complete request dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, activeFilters]);

  useDidShow(() => {
    setPrivateSpots(Taro.getStorageSync<PrivateSpot[]>(PRIVATE_SPOT_STORAGE_KEY) || []);
    const pendingId = Taro.getStorageSync<string>('ph.map.selected-place.v1');
    const pendingCoordinate = Taro.getStorageSync<{ latitude: number; longitude: number }>('ph.map.selected-coordinate.v1');
    if (pendingId && pendingCoordinate) {
      setMode('map');
      mapInitialized.current = true;
      setMapScope('focused');
      setMapScale(14);
      setSelectedId(pendingId);
      setCenter(pendingCoordinate);
      Taro.removeStorageSync('ph.map.selected-place.v1');
      Taro.removeStorageSync('ph.map.selected-coordinate.v1');
    }
  });

  const visiblePrivateSpots = useMemo(() => mapScope === 'nearby' && userCoordinate
    ? privateSpots.filter((spot) => distanceKm(userCoordinate.latitude, userCoordinate.longitude, spot.latitude, spot.longitude) <= DEFAULT_RADIUS_KM)
    : mapScope === 'fallback'
      ? privateSpots.filter((spot) => distanceKm(WUHAN_CENTER.latitude, WUHAN_CENTER.longitude, spot.latitude, spot.longitude) <= DEFAULT_RADIUS_KM)
      : privateSpots, [mapScope, privateSpots, userCoordinate]);

  const markers = useMemo(() => {
    const publicMarkers = mapPlaces.map((place, index) => ({
      id: index + 1,
      latitude: place.latitude!,
      longitude: place.longitude!,
      width: selectedId === place.id ? 48 : 40,
      height: selectedId === place.id ? 48 : 40,
      iconPath: place.feeType === 'paid'
        ? '/assets/markers/water-conditional.png'
        : '/assets/markers/water-open.png',
      ariaLabel: `${place.name}，${CATEGORY_LABEL[place.category]}，${place.feeText}`,
    }));
    const privateMarkers = visiblePrivateSpots.map((spot, index) => ({
      id: PRIVATE_MARKER_OFFSET + index,
      latitude: spot.latitude,
      longitude: spot.longitude,
      width: 40,
      height: 40,
      iconPath: '/assets/markers/water-unknown.png',
      label: { content: '私', color: '#126B57', fontSize: 12, anchorX: -5, anchorY: -42 },
      ariaLabel: `${spot.name}，私人点`,
    }));
    return [...publicMarkers, ...privateMarkers];
  }, [mapPlaces, selectedId, visiblePrivateSpots]);

  const selected = mapPlaces.find((place) => place.id === selectedId);

  const refreshViewport = () => {
    const context = Taro.createMapContext('e2e-map') as unknown as {
      getRegion(options: { success: (region: MapRegion) => void; fail?: () => void }): void;
    };
    context.getRegion({
      success: (region) => {
        setMapScope('viewport');
        void loadMap({
          north: region.northeast.latitude,
          east: region.northeast.longitude,
          south: region.southwest.latitude,
          west: region.southwest.longitude,
        });
      },
    });
  };

  const focusOnMap = (place: PlaceSummary) => {
    if (!place.mapAvailable || place.latitude === null || place.longitude === null) return;
    setMode('map');
    mapInitialized.current = true;
    setMapScope('focused');
    setMapScale(14);
    setCenter({ latitude: place.latitude, longitude: place.longitude });
    setSelectedId(place.id);
    setMapPlaces((current) => current.some((item) => item.id === place.id) ? current : [place, ...current]);
  };

  const openDetail = (place: PlaceSummary) => {
    if (!place.detailAvailable) return;
    Taro.navigateTo({ url: `/package-water/detail/index?id=${encodeURIComponent(place.id)}` });
  };

  const scopeLabel = loading
    ? locating ? '正在定位并加载 10km…' : '正在加载钓点…'
    : mapScope === 'nearby'
      ? `当前位置 10km 内 ${mapPlaces.length} 个钓点`
      : mapScope === 'fallback'
        ? `未定位 · 武汉中心 10km 内 ${mapPlaces.length} 个`
        : mapScope === 'focused'
          ? '已定位到所选钓点'
          : `当前视野 ${mapPlaces.length} 个钓点`;

  return (
    <View className='places-page'>
      <View className={`places-toolbar places-toolbar--${mode}`}>
        <View className='places-toolbar__primary'>
          {mode === 'list' ? (
          <Input
            id='e2e-place-search'
            className='place-search'
            value={search}
            placeholder='搜索名称、区域、标签或鱼种'
            confirmType='search'
            onInput={(event) => setSearch(event.detail.value)}
          />
          ) : (
            <ScrollView className='filter-scroll' scrollX enhanced showScrollbar={false}>
              <View className='filter-row'>
                {FILTERS.map((item) => (
                  <Button key={item.id} className={`filter-chip ${filter === item.id ? 'filter-chip--active' : ''}`} onClick={() => setFilter(item.id)}>{item.label}</Button>
                ))}
              </View>
            </ScrollView>
          )}
          <Button
            id={mode === 'list' ? 'e2e-view-map' : 'e2e-view-list'}
            className='view-mode-button'
            onClick={() => setMode(mode === 'list' ? 'map' : 'list')}
          >
            {mode === 'list' ? '地图' : '列表'}
          </Button>
        </View>
        {mode === 'list' ? (
          <View className='places-toolbar__secondary'>
            <ScrollView className='filter-scroll' scrollX enhanced showScrollbar={false}>
              <View className='filter-row'>
                {FILTERS.map((item) => (
                  <Button key={item.id} className={`filter-chip ${filter === item.id ? 'filter-chip--active' : ''}`} onClick={() => setFilter(item.id)}>{item.label}</Button>
                ))}
              </View>
            </ScrollView>
            <Text className='toolbar-result-count'>{total}个</Text>
          </View>
        ) : null}
      </View>

      {mode === 'map' ? (
        <Map
          id='e2e-map'
          className='places-map'
          latitude={center.latitude}
          longitude={center.longitude}
          scale={mapScale}
          markers={markers}
          circles={(mapScope === 'nearby' && userCoordinate) || mapScope === 'fallback' ? [{
            latitude: (userCoordinate || WUHAN_CENTER).latitude,
            longitude: (userCoordinate || WUHAN_CENTER).longitude,
            radius: DEFAULT_RADIUS_KM * 1000,
            color: '#126B5799',
            fillColor: '#126B5710',
            strokeWidth: 2,
          }] : []}
          showLocation
          onError={() => setError('地图组件加载失败，可切换列表继续浏览')}
          onRegionChange={(event) => {
            if (event.detail.type === 'end' && (event.detail.causedBy === 'drag' || event.detail.causedBy === 'scale')) refreshViewport();
          }}
          onMarkerTap={(event) => {
            const markerId = Number(event.detail.markerId);
            if (markerId >= PRIVATE_MARKER_OFFSET) {
              const spot = visiblePrivateSpots[markerId - PRIVATE_MARKER_OFFSET];
              if (spot) Taro.showToast({ title: `${spot.name} · 仅本机可见`, icon: 'none' });
              return;
            }
            setSelectedId(mapPlaces[markerId - 1]?.id);
          }}
        >
          <CoverView id='e2e-map-scope' className='map-count'>{scopeLabel}</CoverView>
          <CoverView id='e2e-map-locate' className='locate-button' ariaLabel='回到我的位置并加载半径 10km 钓点' onClick={() => void locateAndLoadNearby()}>{locating ? '定位中' : '定位'}</CoverView>
          {!loading && mapPlaces.length === 0 ? (
            <CoverView className='map-empty'>当前视野暂无带坐标钓点，可切换列表查看全部收录</CoverView>
          ) : null}
          {selected ? (
            <CoverView id='e2e-map-sheet' className='map-sheet'>
              <CoverView className='map-sheet__name'>{selected.name}</CoverView>
              <CoverView className='map-sheet__meta'>{selected.district} · {CATEGORY_LABEL[selected.category]} · {selected.feeText}</CoverView>
              <CoverView className='map-sheet__live'>{selected.liveCondition.sampleCount6h > 0 ? `${selected.liveCondition.biteLabel} · ${selected.liveCondition.crowdLabel} · ${selected.liveCondition.sampleCount6h} 人更新` : '近 6 小时暂无钓友实况'}</CoverView>
              <CoverView className='map-sheet__tags'>{[...selected.sceneTags, ...selected.speciesTags.slice(0, 3)].join(' · ') || '暂无更多标签'}</CoverView>
              <CoverView id='e2e-map-open-detail' className='map-sheet__action' onClick={() => openDetail(selected)}>查看钓点详情</CoverView>
            </CoverView>
          ) : null}
        </Map>
      ) : (
        <ScrollView
          id='e2e-place-list'
          className='places-list'
          scrollY
          enhanced
          showScrollbar={false}
          lowerThreshold={160}
          onScrollToLower={() => hasMore && !loading && void loadList(page + 1, true)}
        >
          {error ? (
            <View className='load-state'>
              <Text>{error}</Text>
              <Button className='retry-button' onClick={() => void loadList(1, false)}>重新加载</Button>
            </View>
          ) : null}
          {!error && list.map((place, index) => (
            <View id={index === 0 ? 'e2e-first-place' : undefined} key={place.id} className='place-card'>
              <Button
                id={index === 0 ? 'e2e-first-place-detail' : undefined}
                className='place-card__content'
                disabled={!place.detailAvailable}
                hoverClass='place-card__content--pressed'
                onClick={() => openDetail(place)}
              >
                <View className='place-card__head'>
                  <Text className='place-card__title'>{place.name}</Text>
                  <Text className='place-card__detail-cue'>详情 ›</Text>
                </View>
                <Text className='place-card__address'>{place.district} · {place.address}</Text>
                <Text className='place-card__facts'>{[CATEGORY_LABEL[place.category], ...place.sceneTags, ...place.speciesTags.slice(0, 3)].join(' · ')}</Text>
                <View className={`place-card__status ${place.liveCondition.sampleCount6h > 0 ? 'place-card__status--fresh' : ''}`}>
                  <View className='place-card__waterline' />
                  <Text>{place.liveCondition.sampleCount6h > 0 ? `${place.liveCondition.biteLabel} · ${place.liveCondition.crowdLabel} · ${place.liveCondition.sampleCount6h} 人更新` : '近 6 小时暂无钓友实况'}</Text>
                </View>
              </Button>
              <View className='place-card__aside'>
                <Text className={`fee-badge fee-badge--${place.feeType}`}>{place.feeType === 'free' ? '免费' : place.feeType === 'paid' ? '收费' : '未知'}</Text>
                {place.feeText && !['免费', '收费', '费用未知'].includes(place.feeText) ? <Text className='place-card__fee-detail'>{place.feeText}</Text> : null}
                <Button
                  id={index === 0 ? 'e2e-first-place-map' : undefined}
                  className='place-card__map-action'
                  disabled={!place.mapAvailable}
                  onClick={() => focusOnMap(place)}
                >
                  {place.mapAvailable ? '看地图' : '无坐标'}
                </Button>
              </View>
            </View>
          ))}
          {loading ? <View id='e2e-list-loading' className='load-state'>正在加载钓点…</View> : null}
          {!loading && !error && list.length === 0 ? <View className='load-state'>没有匹配的钓点，换个关键词试试。</View> : null}
          {!loading && !hasMore && list.length > 0 ? <View className='list-end'>已显示全部 {total} 条</View> : null}
        </ScrollView>
      )}
    </View>
  );
}
