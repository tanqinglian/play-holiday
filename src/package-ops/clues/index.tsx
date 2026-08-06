import { useMemo, useState } from 'react';
import { Button, Input, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import type {
  ExternalFishingClue,
  ExternalSourcePlatform,
  HistoricalSeedPlace,
} from '@/types/product';
import seedPayload from '@/data/seed/wuhan-fishing-places.v1.json';
import {
  createExternalClue,
  deleteExternalClue,
  getExternalClues,
  saveExternalClue,
} from '@/services/external-clues';
import './index.less';

const PLATFORM_LABEL: Record<ExternalSourcePlatform, string> = {
  xiaohongshu: '小红书',
  douyin: '抖音',
  fishing_app: '钓鱼 App',
  other_public: '其他公开来源',
};

const SEED_PLACES = seedPayload.records as HistoricalSeedPlace[];

export default function ExternalCluesPage() {
  const [shareText, setShareText] = useState('');
  const [placeHint, setPlaceHint] = useState('');
  const [clues, setClues] = useState<ExternalFishingClue[]>([]);
  const [seedQuery, setSeedQuery] = useState('');

  useDidShow(() => setClues(getExternalClues()));

  const visibleSeeds = useMemo(() => {
    const query = seedQuery.trim().toLocaleLowerCase();
    const matched = query
      ? SEED_PLACES.filter((place) =>
          [place.name, place.district, place.address, ...place.placeTypes, ...place.species]
            .some((value) => value.toLocaleLowerCase().includes(query)),
        )
      : SEED_PLACES;
    return { total: matched.length, places: matched.slice(0, 30) };
  }, [seedQuery]);

  const submit = () => {
    try {
      const clue = createExternalClue(shareText, placeHint);
      setClues(saveExternalClue(clue));
      setShareText('');
      setPlaceHint('');
      Taro.showToast({ title: '已存入待核实线索', icon: 'success' });
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '无法保存线索',
        icon: 'none',
      });
    }
  };

  const remove = async (id: string) => {
    const result = await Taro.showModal({
      title: '删除线索',
      content: '仅删除本机保存的这条来源线索。',
      confirmText: '删除',
      confirmColor: '#B42318',
    });
    if (result.confirm) setClues(deleteExternalClue(id));
  };

  return (
    <View className='clues-page'>
      <View className='clues-hero'>
        <Text id='e2e-clues-title' className='clues-eyebrow'>武汉钓点资料</Text>
        <Text className='clues-title'>钓点资料库</Text>
        <Text className='clues-subtitle'>收录武汉水域与钓场信息，并持续汇入钓友提供的最新变化。</Text>
      </View>

      <View className='guardrail-card'>
        <Text className='guardrail-card__title'>地点资料与实时鱼情分开</Text>
        <Text className='guardrail-card__text'>地点名称、地址和基础资料来自公开收录；近 7 日趟次和口况只使用钓友的新记录。</Text>
      </View>

      <View className='seed-section'>
        <View className='seed-summary'>
          <View>
            <Text className='seed-summary__value'>{SEED_PLACES.length}</Text>
          <Text className='seed-summary__label'>个武汉初始收录地点</Text>
          </View>
          <Text className='seed-summary__status'>版本 0</Text>
        </View>
        <Text className='field-label'>搜索存量地点</Text>
        <Text className='field-help'>可按名称、区域、类型或鱼种搜索；目前没有坐标的地点暂不生成地图标点。</Text>
        <Input
          id='e2e-seed-search'
          className='place-input'
          placeholder='例如：江夏、黑坑、鲫鱼'
          value={seedQuery}
          onInput={(event) => setSeedQuery(event.detail.value)}
        />
        <Text id='e2e-seed-count' className='seed-result-count'>匹配 {visibleSeeds.total} 条，当前展示前 {visibleSeeds.places.length} 条</Text>
        <View className='seed-list'>
          {visibleSeeds.places.map((place, index) => (
            <View id={index === 0 ? 'e2e-first-seed' : undefined} key={place.id} className='seed-card'>
              <View className='clue-card__head'>
                <Text className='seed-card__name'>{place.name}</Text>
                <Text className='seed-card__status'>初始收录</Text>
              </View>
              <Text className='seed-card__address'>{place.district} · {place.address}</Text>
              <Text className='seed-card__facts'>
                {[...place.placeTypes, place.chargeText, ...place.species.slice(0, 4)].filter(Boolean).join(' · ') || '暂无更多字段'}
              </Text>
              <Text className='seed-card__source'>来源：钓鱼之家公开钓场目录 · 后续用户更新会追加新记录，不覆盖此版本</Text>
            </View>
          ))}
        </View>
      </View>

      <View className='clue-form'>
        <Text className='clue-form__title'>补充钓点资料</Text>
        <Text className='field-label'>公开分享文本</Text>
        <Text className='field-help'>支持包含小红书、抖音、钓鱼 App 或网页 URL 的分享文本。</Text>
        <Textarea
          id='e2e-clue-share-text'
          className='share-textarea'
          maxlength={1000}
          placeholder='粘贴分享文本或公开链接'
          value={shareText}
          onInput={(event) => setShareText(event.detail.value)}
        />

        <Text className='field-label field-label--spaced'>地点线索</Text>
        <Text className='field-help'>只写水域、钓场或大致区域，不录入个人站位。</Text>
        <Input
          id='e2e-clue-place'
          className='place-input'
          maxlength={60}
          placeholder='例如：武汉市江夏区某钓场'
          value={placeHint}
          onInput={(event) => setPlaceHint(event.detail.value)}
        />

        <Button
          id='e2e-save-clue'
          className='save-clue'
          hoverClass='save-clue--pressed'
          disabled={!shareText.trim() || !placeHint.trim()}
          onClick={submit}
        >
          存入待核实线索
        </Button>
      </View>

      <View className='clue-list-section'>
        <View className='clue-list-heading'>
          <Text className='clue-list-title'>手动补充线索</Text>
          <Text id='e2e-clue-count' className='clue-list-count'>{clues.length} 条</Text>
        </View>
        {clues.length === 0 ? (
          <View className='clue-empty'>还没有线索。先从一条公开分享链接开始。</View>
        ) : clues.map((clue, index) => (
          <View id={index === 0 ? 'e2e-first-clue' : undefined} key={clue.id} className='clue-card'>
            <View className='clue-card__head'>
              <Text className='clue-card__platform'>{PLATFORM_LABEL[clue.sourcePlatform]}</Text>
              <Text className='clue-card__status'>待核实</Text>
            </View>
            <Text className='clue-card__place'>{clue.placeHint}</Text>
            <Text className='clue-card__meta'>仅保留来源链接 · 不计入趟次统计</Text>
            <Button
              id={index === 0 ? 'e2e-delete-clue' : undefined}
              className='delete-clue'
              hoverClass='delete-clue--pressed'
              onClick={() => remove(clue.id)}
            >
              删除本机线索
            </Button>
          </View>
        ))}
      </View>
    </View>
  );
}
