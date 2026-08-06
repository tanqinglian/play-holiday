import { Button, Text, View } from '@tarojs/components';
import type { WaterBodySummary } from '@/types/product';
import './index.less';

interface WaterCardProps {
  water: WaterBodySummary;
  onClick?: (water: WaterBodySummary) => void;
}

const STATUS_SYMBOL: Record<WaterBodySummary['status'], string> = {
  open: '✓',
  conditional: '!',
  unknown: '?',
};

export function WaterCard({ water, onClick }: WaterCardProps) {
  const sampleText =
    water.tripCount7d >= 6
      ? `近 7 天 ${water.tripCount7d} 趟 · ${water.biteCount7d} 趟有口`
      : water.tripCount7d > 0
        ? `近 7 天 ${water.tripCount7d} 趟 · 样本不足`
        : '近 7 天暂无有效趟次';

  return (
    <Button
      id={`e2e-water-${water.id}`}
      className='water-card'
      hoverClass='water-card--pressed'
      ariaLabel={`查看${water.name}，${water.statusLabel}，${sampleText}`}
      onClick={() => onClick?.(water)}
    >
      <View className='water-card__head'>
        <View className='water-card__title-wrap'>
          <Text className='water-card__title'>{water.name}</Text>
          <Text className='water-card__district'>{water.district}</Text>
        </View>
        <View className={`status-badge status-badge--${water.status}`}>
          <Text className='status-badge__symbol'>{STATUS_SYMBOL[water.status]}</Text>
          <Text>{water.statusLabel}</Text>
        </View>
      </View>

      <View className={`waterline waterline--${water.status}`}>
        <View className='waterline__fill' style={{ width: `${Math.min(100, Math.max(12, 100 - water.freshnessHours * 2))}%` }} />
      </View>

      <View className='water-card__meta'>
        <Text>{sampleText}</Text>
        <Text>{water.distanceKm.toFixed(1)} km</Text>
      </View>
      <Text className='water-card__update'>{water.latestUpdate}</Text>
    </Button>
  );
}
