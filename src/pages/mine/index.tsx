import { useMemo, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type { LocalTripDraft, PrivateSpot, TripAccessMode, TripResult } from '@/types/product';
import './index.less';

const TRIP_STORAGE_KEY = 'ph.trip.drafts.v1';
type HistoryFilter = 'all' | 'private' | 'queued';

const RESULT_LABEL: Record<TripResult, string> = {
  empty: '空军',
  bite: '有口',
  great: '爆护',
};

const NEXT_RESULT: Record<TripResult, TripResult> = {
  empty: 'bite',
  bite: 'great',
  great: 'empty',
};

const ACCESS_LABEL: Record<TripAccessMode, string> = {
  car: '汽车可达',
  ebike: '电动车可达',
  walk: '需步行一段',
  difficult: '路况困难',
};

export default function MinePage() {
  const [drafts, setDrafts] = useState<LocalTripDraft[]>([]);
  const [privateSpotCount, setPrivateSpotCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [filter, setFilter] = useState<HistoryFilter>('all');

  useDidShow(() => {
    setDrafts(Taro.getStorageSync<LocalTripDraft[]>(TRIP_STORAGE_KEY) || []);
    setPrivateSpotCount(
      (Taro.getStorageSync<PrivateSpot[]>('ph.private.spots.v1') || []).length,
    );
    setFavoriteCount((Taro.getStorageSync<string[]>('ph.favorites.v1') || []).length);
  });

  const visibleDrafts = useMemo(() => {
    if (filter === 'queued') return drafts.filter((draft) => draft.syncStatus === 'queued');
    if (filter === 'private') return drafts.filter((draft) => draft.syncStatus !== 'queued');
    return drafts;
  }, [drafts, filter]);

  const persistDrafts = (next: LocalTripDraft[]) => {
    Taro.setStorageSync(TRIP_STORAGE_KEY, next);
    setDrafts(next);
  };

  const updateTripResult = (id: string) => {
    persistDrafts(
      drafts.map((draft) =>
        draft.id === id ? { ...draft, result: NEXT_RESULT[draft.result] } : draft,
      ),
    );
    Taro.showToast({ title: '结果已更新', icon: 'none' });
  };

  const deleteTrip = async (id: string) => {
    const modal = await Taro.showModal({
      title: '删除记录',
      content: '确认删除这条私人日志？本机删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#B42318',
    });
    if (!modal.confirm) return;
    const draft = drafts.find((item) => item.id === id);
    await Promise.all((draft?.photoPaths || []).map((filePath) => Taro.removeSavedFile({ filePath }).catch(() => undefined)));
    persistDrafts(drafts.filter((draft) => draft.id !== id));
  };

  return (
    <View className='mine-page'>
      <View className='mine-stats'>
        <View className='mine-stat'>
          <Text id='e2e-local-trip-count' className='mine-stat__value'>{drafts.length}</Text>
          <Text className='mine-stat__label'>本机趟次</Text>
        </View>
        <View className='mine-stat'>
          <Text id='e2e-private-spot-count' className='mine-stat__value'>{privateSpotCount}</Text>
          <Text className='mine-stat__label'>私人标点</Text>
        </View>
        <View className='mine-stat'>
          <Text className='mine-stat__value'>{favoriteCount}</Text>
          <Text className='mine-stat__label'>收藏水域</Text>
        </View>
      </View>

      <View className='privacy-card'>
        <View className='privacy-card__mark'>✓</View>
        <View className='privacy-card__content'>
          <Text className='privacy-card__title'>精准位置默认留在本机</Text>
          <Text className='privacy-card__text'>公开地点和个人站位分开处理；没有主动选择，就不进入公共池。</Text>
        </View>
      </View>

      <View className='history-section'>
        <View className='history-heading'>
          <Text className='history-title'>我的趟次</Text>
          <Text className='history-meta'>{visibleDrafts.length} 条</Text>
        </View>
        <View className='history-filters'>
          {([
            ['all', '全部'],
            ['private', '仅私人'],
            ['queued', '待同步'],
          ] as Array<[HistoryFilter, string]>).map(([id, label]) => (
            <Button
              key={id}
              className={`history-filter ${filter === id ? 'history-filter--active' : ''}`}
              hoverClass='history-filter--pressed'
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
        </View>

        {visibleDrafts.length === 0 ? (
          <View className='history-empty'>还没有符合条件的趟次，先去记一趟。</View>
        ) : (
          <View className='trip-list'>
            {visibleDrafts.map((draft, index) => (
              <View key={draft.id} id={index === 0 ? 'e2e-trip-first' : undefined} className='trip-card'>
                <View className='trip-card__head'>
                  <Text className='trip-card__result'>{RESULT_LABEL[draft.result]}</Text>
                  <Text className={`trip-card__sync ${draft.syncStatus === 'queued' ? 'trip-card__sync--queued' : ''}`}>
                    {draft.syncStatus === 'queued' ? '待联网同步' : '仅存本机'}
                  </Text>
                </View>
                <Text className='trip-card__time'>{new Date(draft.createdAt).toLocaleString()}</Text>
                {draft.coordinate ? <Text className='trip-card__location'>{draft.coordinate.name || draft.coordinate.address || `${draft.coordinate.latitude.toFixed(5)}, ${draft.coordinate.longitude.toFixed(5)}`}</Text> : null}
                {draft.locationDescription ? <Text className='trip-card__description'>{draft.locationDescription}</Text> : null}
                {(draft.tags || []).length > 0 ? <View className='trip-card__tags'>
                  {(draft.tags || []).map((tag) => <Text key={tag.id} className='trip-card__tag'>{tag.label}</Text>)}
                </View> : draft.accessMode ? <Text className='trip-card__location'>{ACCESS_LABEL[draft.accessMode]}</Text> : null}
                {(draft.photoPaths || []).length > 0 ? <View className='trip-card__photos'>
                  {(draft.photoPaths || []).slice(0, 3).map((path, photoIndex) => <Image key={path} className='trip-card__photo' src={path} mode='aspectFill' ariaLabel={`现场照片 ${photoIndex + 1}`} onClick={() => Taro.previewImage({ current: path, urls: draft.photoPaths || [] })} />)}
                </View> : null}
                <View className='trip-card__actions'>
                  <Button
                    id={index === 0 ? 'e2e-edit-first-trip' : undefined}
                    className='trip-action'
                    hoverClass='trip-action--pressed'
                    onClick={() => updateTripResult(draft.id)}
                  >
                    修改结果
                  </Button>
                  <Button
                    id={index === 0 ? 'e2e-delete-first-trip' : undefined}
                    className='trip-action trip-action--danger'
                    hoverClass='trip-action--pressed'
                    onClick={() => deleteTrip(draft.id)}
                  >
                    删除
                  </Button>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
