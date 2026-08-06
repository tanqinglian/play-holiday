import { useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { identifyFish, type FishInfo } from '@/api/fish';
import './index.less';

export default function FishPage() {
  const [imagePath, setImagePath] = useState('');
  const [loading, setLoading] = useState(false);
  const [fishList, setFishList] = useState<FishInfo[]>([]);
  const [note, setNote] = useState('');
  const [identified, setIdentified] = useState(false);

  const resetResult = () => {
    setFishList([]);
    setNote('');
    setIdentified(false);
  };

  const chooseImage = async () => {
    if (loading) return;
    try {
      const choose = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      });
      if (choose.tempFilePaths[0]) {
        setImagePath(choose.tempFilePaths[0]);
        resetResult();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message && !/cancel/i.test(message)) {
        Taro.showToast({ title: message, icon: 'none' });
      }
    }
  };

  const identify = async () => {
    if (!imagePath || loading) return;
    try {
      resetResult();
      setLoading(true);
      Taro.showLoading({ title: '识别中', mask: true });
      const base64 = await new Promise<string>((resolve, reject) => {
        Taro.getFileSystemManager().readFile({
          filePath: imagePath,
          encoding: 'base64',
          success: (response) => resolve(response.data as string),
          fail: reject,
        });
      });
      const response = await identifyFish(`data:image/jpeg;base64,${base64}`);
      if (!response.success || !response.data) {
        throw new Error(response.error || '识别失败，请重试');
      }
      const { isFish, fishList: candidates, note: responseNote } = response.data;
      setFishList(isFish ? [...candidates].sort((a, b) => b.probability - a.probability) : []);
      setNote(responseNote || '未检测到鱼类，换张更清晰的照片试试');
      setIdentified(true);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '识别失败，请重试',
        icon: 'none',
      });
    } finally {
      setLoading(false);
      Taro.hideLoading();
    }
  };

  return (
    <View className='fish-page'>
      <View className='fish-hero'>
        <Text className='fish-eyebrow'>候选结果需要你确认</Text>
        <Text id='e2e-fish-title' className='fish-title'>拍照识鱼</Text>
        <Text className='fish-subtitle'>这是现有能力的保留版，M4 会把确认结果写入私人趟次日志。</Text>
      </View>

      {imagePath ? (
        <Image className='fish-preview' src={imagePath} mode='aspectFit' ariaLabel='待识别的鱼类照片' />
      ) : (
        <View className='fish-placeholder'>
          <Text>还没有照片</Text>
          <Text className='fish-placeholder__helper'>尽量让鱼体完整、光线清晰</Text>
        </View>
      )}

      <Button className='fish-button fish-button--secondary' hoverClass='fish-button--pressed' disabled={loading} onClick={chooseImage}>
        {imagePath ? '换一张照片' : '拍照或从相册选择'}
      </Button>
      {imagePath ? (
        <Button className='fish-button fish-button--primary' hoverClass='fish-button--pressed' loading={loading} onClick={identify}>
          {identified ? '重新识别' : '开始识别'}
        </Button>
      ) : null}

      {fishList.length > 0 ? (
        <View className='fish-results'>
          <Text className='fish-results__heading'>可能的鱼种</Text>
          {fishList.map((fish, index) => (
            <View className='fish-result' key={`${fish.name}-${index}`}>
              <View className='fish-result__head'>
                <View className='fish-result__name-wrap'>
                  <Text className='fish-result__name'>{fish.name}</Text>
                  {fish.scientificName ? <Text className='fish-result__sci'>{fish.scientificName}</Text> : null}
                </View>
                <Text className='fish-result__probability'>{fish.probability}% 可能</Text>
              </View>
              {fish.features ? <Text className='fish-result__detail'>特征：{fish.features}</Text> : null}
              {index === 0 ? <Text className='fish-result__hint'>当前最可能，仍需人工确认</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      {identified && fishList.length === 0 ? (
        <View className='fish-empty'>
          <Text className='fish-empty__title'>暂时无法确定鱼种</Text>
          <Text className='fish-empty__text'>{note}</Text>
        </View>
      ) : null}
    </View>
  );
}
