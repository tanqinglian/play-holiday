import { useMemo, useState } from 'react';
import { Button, Input, ScrollView, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import type { TripAccessMode, TripTag, TripTagCategory } from '@/types/product';
import './index.less';

const CUSTOM_TAG_STORAGE_KEY = 'ph.custom.trip-tags.v1';
const MAX_SELECTED_TAGS = 20;

const CATEGORY_LABEL: Record<TripTagCategory | 'all', string> = {
  all: '全部',
  access: '到达',
  water: '水情',
  spot: '钓位',
  field: '现场',
  facility: '设施',
  custom: '自定义',
};

const SYSTEM_TAGS: TripTag[] = [
  { id: 'car', label: '汽车可达', category: 'access', source: 'system' },
  { id: 'ebike', label: '电动车可达', category: 'access', source: 'system' },
  { id: 'walk', label: '需步行一段', category: 'access', source: 'system' },
  { id: 'difficult', label: '路况困难', category: 'access', source: 'system' },
  { id: 'still-water', label: '静水', category: 'water', source: 'system' },
  { id: 'flowing', label: '走水', category: 'water', source: 'system' },
  { id: 'rising', label: '涨水', category: 'water', source: 'system' },
  { id: 'falling', label: '退水', category: 'water', source: 'system' },
  { id: 'shallow', label: '水浅', category: 'water', source: 'system' },
  { id: 'deep', label: '水深', category: 'water', source: 'system' },
  { id: 'weeds', label: '水草多', category: 'water', source: 'system' },
  { id: 'muddy', label: '水浑', category: 'water', source: 'system' },
  { id: 'point', label: '桦尖', category: 'spot', source: 'system' },
  { id: 'bay', label: '回湾', category: 'spot', source: 'system' },
  { id: 'inlet', label: '进水口', category: 'spot', source: 'system' },
  { id: 'sluice', label: '闸口', category: 'spot', source: 'system' },
  { id: 'bridge', label: '桥下', category: 'spot', source: 'system' },
  { id: 'grass-edge', label: '草边', category: 'spot', source: 'system' },
  { id: 'steep-bank', label: '陡坎', category: 'spot', source: 'system' },
  { id: 'snaggy', label: '易挂底', category: 'spot', source: 'system' },
  { id: 'quiet', label: '人少', category: 'field', source: 'system' },
  { id: 'crowded', label: '拥挤', category: 'field', source: 'system' },
  { id: 'sunny-bank', label: '晒', category: 'field', source: 'system' },
  { id: 'sheltered', label: '避风', category: 'field', source: 'system' },
  { id: 'weak-signal', label: '信号弱', category: 'field', source: 'system' },
  { id: 'rubbish', label: '垃圾多', category: 'field', source: 'system' },
  { id: 'parking', label: '好停车', category: 'facility', source: 'system' },
  { id: 'toilet', label: '有厕所', category: 'facility', source: 'system' },
  { id: 'food', label: '有餐饮', category: 'facility', source: 'system' },
  { id: 'platform', label: '可搭钓台', category: 'facility', source: 'system' },
  { id: 'night-light', label: '夜钓有照明', category: 'facility', source: 'system' },
];

const ACCESS_MODE_BY_TAG: Record<string, TripAccessMode> = {
  car: 'car',
  ebike: 'ebike',
  walk: 'walk',
  difficult: 'difficult',
};

export function getAccessModeFromTags(tags: TripTag[]) {
  const access = tags.find((tag) => tag.category === 'access');
  return access ? ACCESS_MODE_BY_TAG[access.id] : undefined;
}

interface TripTagPickerProps {
  value: TripTag[];
  onChange: (tags: TripTag[]) => void;
}

export default function TripTagPicker({ value, onChange }: TripTagPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TripTagCategory | 'all'>('access');
  const [query, setQuery] = useState('');
  const [customTags, setCustomTags] = useState<TripTag[]>(() => Taro.getStorageSync<TripTag[]>(CUSTOM_TAG_STORAGE_KEY) || []);

  const allTags = useMemo(() => [...SYSTEM_TAGS, ...customTags], [customTags]);
  const visibleTags = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return allTags.filter((tag) =>
      (activeCategory === 'all' || tag.category === activeCategory)
      && (!keyword || tag.label.toLocaleLowerCase().includes(keyword)),
    );
  }, [activeCategory, allTags, query]);

  const toggle = (tag: TripTag) => {
    const selected = value.some((item) => item.id === tag.id);
    if (selected) {
      onChange(value.filter((item) => item.id !== tag.id));
      return;
    }
    if (value.length >= MAX_SELECTED_TAGS) {
      Taro.showToast({ title: `最多选择 ${MAX_SELECTED_TAGS} 个标签`, icon: 'none' });
      return;
    }
    const withoutOldAccess = tag.category === 'access'
      ? value.filter((item) => item.category !== 'access')
      : value;
    onChange([...withoutOldAccess, tag]);
  };

  const addCustomTag = () => {
    const label = query.trim().replace(/\s+/g, ' ').slice(0, 12);
    if (!label) return;
    const existing = allTags.find((tag) => tag.label.toLocaleLowerCase() === label.toLocaleLowerCase());
    if (existing) {
      toggle(existing);
      return;
    }
    const tag: TripTag = {
      id: `custom-${Date.now()}`,
      label,
      category: 'custom',
      source: 'custom',
    };
    const nextCustomTags = [...customTags, tag];
    setCustomTags(nextCustomTags);
    Taro.setStorageSync(CUSTOM_TAG_STORAGE_KEY, nextCustomTags);
    toggle(tag);
    setQuery('');
  };

  return (
    <View className='trip-tags'>
      <View className='trip-tags__head'>
        <Text className='record-section-title'>标签</Text>
        <Button id='e2e-open-tags' className='trip-tags__toggle' hoverClass='trip-tags__toggle--pressed' onClick={() => setOpen((current) => !current)}>
          {open ? '收起' : value.length ? `已选 ${value.length}` : '添加标签'}
        </Button>
      </View>

      {value.length > 0 ? (
        <View className='selected-tags'>
          {value.map((tag) => <Button key={tag.id} className='selected-tag' ariaLabel={`移除标签${tag.label}`} onClick={() => toggle(tag)}>{tag.label} ×</Button>)}
        </View>
      ) : null}

      {open ? (
        <View id='e2e-tag-panel' className='tag-panel'>
          <View className='tag-search-row'>
            <Input id='e2e-custom-tag-input' className='tag-search' maxlength={12} value={query} placeholder='搜索或新建标签' onInput={(event) => setQuery(event.detail.value)} />
            <Button id='e2e-create-custom-tag' className='tag-create' disabled={!query.trim()} onClick={addCustomTag}>新增标签</Button>
          </View>
          <ScrollView className='tag-category-scroll' scrollX enhanced showScrollbar={false}>
            <View className='tag-categories'>
              {(Object.keys(CATEGORY_LABEL) as Array<TripTagCategory | 'all'>).map((category) => (
                <Button key={category} className={`tag-category ${activeCategory === category ? 'tag-category--active' : ''}`} onClick={() => setActiveCategory(category)}>{CATEGORY_LABEL[category]}</Button>
              ))}
            </View>
          </ScrollView>
          <View className='tag-options'>
            {visibleTags.map((tag) => (
              <Button
                key={tag.id}
                id={tag.id === 'car' || tag.id === 'ebike' || tag.id === 'walk' ? `e2e-tag-${tag.id}` : undefined}
                className={`tag-option ${value.some((item) => item.id === tag.id) ? 'tag-option--active' : ''}`}
                onClick={() => toggle(tag)}
              >{tag.label}</Button>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
