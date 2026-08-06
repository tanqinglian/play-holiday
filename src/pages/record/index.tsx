import { useState } from 'react';
import { Button, Image, Text, Textarea, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import TripTagPicker, { getAccessModeFromTags } from '@/components/trip-tag-picker';
import { uploadTripImage } from '@/services/places-api';
import type { LocalTripDraft, TripCoordinate, TripPurpose, TripResult, TripTag } from '@/types/product';
import './index.less';

const STORAGE_KEY = 'ph.trip.drafts.v1';
const RESULTS: Array<{ id: TripResult; label: string }> = [
  { id: 'empty', label: '空军' },
  { id: 'bite', label: '有口' },
  { id: 'great', label: '爆护' },
];

export default function RecordPage() {
  const [result, setResult] = useState<TripResult>();
  const [coordinate, setCoordinate] = useState<TripCoordinate | undefined>(undefined);
  const [locationDescription, setLocationDescription] = useState('');
  const [photoPaths, setPhotoPaths] = useState<string[]>([]);
  const [tags, setTags] = useState<TripTag[]>([]);
  const [purpose, setPurpose] = useState<TripPurpose>('private');
  const [saving, setSaving] = useState(false);

  const chooseCoordinate = async () => {
    try {
      const selected = await Taro.chooseLocation({});
      if (!selected.latitude || !selected.longitude) return;
      setCoordinate({
        latitude: selected.latitude,
        longitude: selected.longitude,
        name: selected.name || '地图选点',
        address: selected.address || '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message && !/cancel/i.test(message)) Taro.showToast({ title: '地图选点失败', icon: 'none' });
    }
  };

  const clearCoordinate = () => {
    setCoordinate(undefined);
    setPurpose('private');
  };

  const choosePhotos = async () => {
    try {
      const result = await Taro.chooseMedia({
        count: Math.max(1, 6 - photoPaths.length),
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
      });
      const additions = result.tempFiles.map((file) => file.tempFilePath);
      setPhotoPaths((current) => [...current, ...additions].slice(0, 6));
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message && !/cancel/i.test(message)) Taro.showToast({ title: '照片选择失败', icon: 'none' });
    }
  };

  const saveLocalDraft = async () => {
    if (!result || saving) return;
    setSaving(true);
    try {
      const drafts = Taro.getStorageSync<LocalTripDraft[]>(STORAGE_KEY) || [];
      const localId = `local-${Date.now()}`;
      const savedPhotoPaths = await Promise.all(photoPaths.map(async (tempFilePath) => {
        if (purpose === 'anonymous_water') {
          const uploaded = await uploadTripImage(tempFilePath, localId);
          return uploaded.url;
        }
        const response = await Taro.saveFile({ tempFilePath });
        if (!('savedFilePath' in response)) throw new Error('照片保存失败');
        return response.savedFilePath;
      }));
      const draft: LocalTripDraft = {
        id: localId,
        idempotencyKey: `trip-${localId}`,
        coordinate,
        locationDescription: locationDescription.trim() || undefined,
        photoPaths: savedPhotoPaths,
        accessMode: getAccessModeFromTags(tags),
        tags,
        result,
        siteStatuses: tags.filter((tag) => tag.category !== 'access').map((tag) => tag.label),
        purpose,
        preciseLocationIncluded: Boolean(coordinate),
        createdAt: new Date().toISOString(),
        syncStatus: purpose === 'anonymous_water' ? 'queued' : 'local',
      };
      Taro.setStorageSync(STORAGE_KEY, [draft, ...drafts]);
      setResult(undefined);
      setCoordinate(undefined);
      setLocationDescription('');
      setPhotoPaths([]);
      setTags([]);
      setPurpose('private');
      Taro.showToast({ title: purpose === 'anonymous_water' ? '已加入待同步' : '已保存', icon: 'success' });
    } catch {
      Taro.showToast({ title: '照片保存失败，请重试', icon: 'none' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className='record-page'>
      <View className='record-section record-section--first'>
        <Text className='record-section-title'>渔获</Text>
        <View className='result-grid'>
          {RESULTS.map((item) => (
            <Button
              key={item.id}
              id={`e2e-trip-result-${item.id}`}
              className={`result-choice ${result === item.id ? 'result-choice--active' : ''}`}
              hoverClass='record-control--pressed'
              onClick={() => setResult(item.id)}
            >{item.label}</Button>
          ))}
        </View>
      </View>

      <View className='record-section'>
        <Text className='record-section-title'>钓点坐标</Text>
        <Button id='e2e-coordinate-picker' className={`coordinate-picker ${coordinate ? 'coordinate-picker--selected' : ''}`} hoverClass='record-control--pressed' onClick={() => void chooseCoordinate()}>
          <View className='coordinate-picker__copy'>
            <Text className='coordinate-picker__name'>{coordinate?.name || '地图选点'}</Text>
            {coordinate ? <Text className='coordinate-picker__address'>{coordinate.address || `${coordinate.latitude.toFixed(5)}, ${coordinate.longitude.toFixed(5)}`}</Text> : null}
          </View>
          <Text className='coordinate-picker__action'>{coordinate ? '重选' : '选择'}</Text>
        </Button>
        {coordinate ? <Button className='clear-coordinate' onClick={clearCoordinate}>清除坐标</Button> : null}
      </View>

      <TripTagPicker value={tags} onChange={setTags} />

      <View className='record-section'>
        <Text className='record-section-title'>位置描述</Text>
        <Textarea
          id='e2e-location-description'
          className='location-description'
          maxlength={300}
          autoHeight
          value={locationDescription}
          placeholder='例如：沿堤到第二个闸口，下坡后右转'
          onInput={(event) => setLocationDescription(event.detail.value)}
        />
      </View>

      <View className='record-section'>
        <View className='record-section-head'>
          <Text className='record-section-title'>现场照片</Text>
          <Text className='record-section-count'>{photoPaths.length}/6</Text>
        </View>
        <View className='photo-grid'>
          {photoPaths.map((path, index) => (
            <View key={path} className='photo-item'>
              <Image className='photo-preview' src={path} mode='aspectFill' onClick={() => Taro.previewImage({ current: path, urls: photoPaths })} ariaLabel={`现场照片 ${index + 1}`} />
              <Button className='photo-remove' ariaLabel={`删除现场照片 ${index + 1}`} onClick={() => setPhotoPaths((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</Button>
            </View>
          ))}
          {photoPaths.length < 6 ? <Button id='e2e-photo-picker' className='photo-picker' hoverClass='record-control--pressed' onClick={() => void choosePhotos()}>添加照片</Button> : null}
        </View>
      </View>

      <View className='record-section'>
        <Text className='record-section-title'>保存到</Text>
        <View className='purpose-options'>
          <Button id='e2e-purpose-private' className={`purpose-option ${purpose === 'private' ? 'purpose-option--active' : ''}`} onClick={() => setPurpose('private')}>私人记录</Button>
          <Button id='e2e-purpose-anonymous' className={`purpose-option ${purpose === 'anonymous_water' ? 'purpose-option--active' : ''}`} disabled={!coordinate} onClick={() => setPurpose('anonymous_water')}>匿名共享</Button>
        </View>
      </View>

      <Button id='e2e-save-trip' className='save-trip' hoverClass='save-trip--pressed' loading={saving} disabled={!result || saving} onClick={() => void saveLocalDraft()}>保存记录</Button>

      <View className='fish-entry'>
        <Text className='fish-entry__title'>拍照识鱼</Text>
        <Button id='e2e-open-fish' className='fish-entry__button' onClick={() => Taro.navigateTo({ url: '/pages/fish/index' })}>去识鱼</Button>
      </View>
    </View>
  );
}
