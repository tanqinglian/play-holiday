export interface FishingAdviceInput {
  temperatureC: number;
  pressureHpa: number;
  pressureChange3hHpa: number;
  windSpeedKmh: number;
  precipitationMm: number;
  maxPrecipitationProbability3h: number;
  localHour: number;
}

export interface FishingAdvice {
  score: number;
  level: 'recommended' | 'conditional' | 'avoid';
  title: string;
  summary: string;
  tactics: string[];
  reasons: string[];
  cautions: string[];
}

export function buildFishingAdvice(input: FishingAdviceInput): FishingAdvice {
  let score = 62;
  const reasons: string[] = [];
  const cautions: string[] = [];
  const tactics: string[] = [];

  if (input.windSpeedKmh <= 12) {
    score += 10;
    reasons.push('风力较小，抛竿和观漂条件较稳定');
  } else if (input.windSpeedKmh >= 25) {
    score -= 28;
    cautions.push('风力较大，注意抛竿、岸边落物和水面风浪');
  } else {
    score -= 5;
    reasons.push('风力中等，建议选背风岸或使用稳定性更高的漂组');
  }

  if (Math.abs(input.pressureChange3hHpa) <= 2) {
    score += 8;
    reasons.push('未来 3 小时气压变化较平稳');
  } else if (input.pressureChange3hHpa <= -3) {
    score -= 12;
    cautions.push('气压下降较快，鱼口可能变弱');
  }

  if (input.precipitationMm >= 5 || input.maxPrecipitationProbability3h >= 80) {
    score -= 25;
    cautions.push('降雨风险较高，注意雷电、涨水和湿滑岸线');
  } else if (input.maxPrecipitationProbability3h <= 30) {
    score += 8;
    reasons.push('未来 3 小时明显降雨概率较低');
  } else {
    cautions.push('未来 3 小时可能有雨，建议带雨具并留意雷电预警');
  }

  if (input.temperatureC >= 12 && input.temperatureC <= 30) {
    score += 6;
    reasons.push('气温处于常见台钓活动区间');
  } else if (input.temperatureC >= 33) {
    score -= 8;
    cautions.push('气温较高，避开午后暴晒并注意补水');
  }

  if (input.localHour <= 9 || input.localHour >= 17) {
    tactics.push('优先试钓浅水、草边或近岸结构区');
  } else if (input.temperatureC >= 30) {
    tactics.push('日间偏热，可试阴影、深浅交界或有流动水体的位置');
  } else {
    tactics.push('先探底并从深浅交界开始找鱼层');
  }
  tactics.push(input.windSpeedKmh > 12 ? '选背风位，适当增大浮漂吃铅量' : '可从细线组、小钩和轻口漂调开始试钓');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 75 ? 'recommended' : score >= 45 ? 'conditional' : 'avoid';
  const title = level === 'recommended' ? '较适合出钓' : level === 'conditional' ? '条件一般，可调整钓法' : '建议暂缓出钓';
  const summary = (reasons[0] || cautions[0] || '当前样本有限，建议结合现场水情判断');
  return { score, level, title, summary, tactics, reasons, cautions };
}
