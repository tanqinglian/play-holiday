export type BiteStatus = 'no_bite' | 'occasional' | 'active';
export type CrowdLevel = 'quiet' | 'normal' | 'crowded';

export interface LiveReportView {
  biteStatus: BiteStatus;
  crowdLevel: CrowdLevel;
  observedAt: Date;
}

export interface LiveConditionSummary {
  sampleCount6h: number;
  biteLabel: string;
  crowdLabel: string;
  latestObservedAt?: string;
}

const BITE_LABEL: Record<BiteStatus, string> = {
  no_bite: '暂时无口',
  occasional: '偶尔有口',
  active: '鱼口活跃',
};

const CROWD_LABEL: Record<CrowdLevel, string> = {
  quiet: '人少',
  normal: '人数一般',
  crowded: '较拥挤',
};

export function summarizeLiveReports(reports: LiveReportView[]): LiveConditionSummary {
  const latest = [...reports].sort((left, right) => right.observedAt.getTime() - left.observedAt.getTime())[0];
  if (!latest) return { sampleCount6h: 0, biteLabel: '暂无钓友实况', crowdLabel: '未知' };
  return {
    sampleCount6h: reports.length,
    biteLabel: BITE_LABEL[latest.biteStatus],
    crowdLabel: CROWD_LABEL[latest.crowdLevel],
    latestObservedAt: latest.observedAt.toISOString(),
  };
}
