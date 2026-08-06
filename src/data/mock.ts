import type { WaterBodyDetail, WaterBodySummary } from '@/types/product';

/**
 * M1 交互验证数据：不是公开钓点，也不代表现场允许垂钓。
 * 生产数据接入前必须经过来源与规则审核。
 */
export const MOCK_WATERS: WaterBodySummary[] = [
  {
    id: 'demo-jiangxia-a',
    markerId: 101,
    name: '演示水域 A',
    district: '江夏区 · 粗粒度位置',
    latitude: 30.375,
    longitude: 114.31,
    distanceKm: 18.6,
    status: 'conditional',
    statusLabel: '条件参考',
    ruleSummary: '规则待运营复核，出发前请查看现场公告',
    tripCount7d: 8,
    biteCount7d: 3,
    latestUpdate: '今天 07:40',
    freshnessHours: 4,
    tags: ['近 7 天有更新', '台钓'],
  },
  {
    id: 'demo-caidian-b',
    markerId: 102,
    name: '演示水域 B',
    district: '蔡甸区 · 粗粒度位置',
    latitude: 30.51,
    longitude: 114.09,
    distanceKm: 24.2,
    status: 'open',
    statusLabel: '运营样例',
    ruleSummary: '仅演示“规则已核实”界面，不代表真实可钓',
    tripCount7d: 5,
    biteCount7d: 2,
    latestUpdate: '昨天 18:20',
    freshnessHours: 17,
    tags: ['样本不足', '道路可达'],
  },
  {
    id: 'demo-huangpi-c',
    markerId: 103,
    name: '演示水域 C',
    district: '黄陂区 · 粗粒度位置',
    latitude: 30.82,
    longitude: 114.37,
    distanceKm: 31.4,
    status: 'unknown',
    statusLabel: '待核实',
    ruleSummary: '暂无可靠规则来源，不建议据此直接出发',
    tripCount7d: 0,
    biteCount7d: 0,
    latestUpdate: '暂无近期贡献',
    freshnessHours: 999,
    tags: ['无近期数据'],
  },
];

export const WUHAN_CENTER = {
  latitude: 30.5928,
  longitude: 114.3055,
};

/**
 * M2 详情结构演示：来源、限制和现场状态都用于验证信息架构，
 * 不构成对任何真实水域的规则判断或出钓建议。
 */
export const MOCK_WATER_DETAILS: WaterBodyDetail[] = [
  {
    ...MOCK_WATERS[0],
    methodFitStatus: 'conditional',
    methodFitLabel: '台钓需先核实线组',
    methodFitSummary: '水域状态与钓法合规分开判断；杆数、钩数未核实前不能直接按常用双钩线组出发。',
    sampleMinimum: 6,
    lastBiteAt: '今天 07:10',
    primarySpecies: ['鲫鱼（演示）', '鳊鱼（演示）'],
    primaryMethods: ['台钓（演示）'],
    fieldStatuses: [
      { id: 'water', label: '水情', state: 'warning', detail: '用户样例：轻微走水，待核实' },
      { id: 'road', label: '道路', state: 'unknown', detail: '近期无可靠报告' },
      { id: 'safety', label: '安全', state: 'normal', detail: '未收到风险报告，不等于现场安全' },
    ],
    constraint: {
      rodLimit: '待运营核实',
      hooksPerLineLimit: '待运营核实',
      baitRestrictions: ['暂未取得适用于该演示水域的可靠来源'],
      equipmentRestrictions: ['出发前查看现场公告和主管部门要求'],
      note: '信息不完整时按更谨慎状态展示。',
    },
    sources: [
      {
        id: 'demo-source-a',
        authority: '演示运营台账',
        title: '规则来源字段演示（非真实水域依据）',
        scope: '演示水域 A · 粗粒度范围',
        publishedAt: '未接入',
        effectivePeriod: '待核实',
        lastCheckedAt: '2026-08-04 08:00',
        sourceType: 'operator_sample',
      },
    ],
  },
  {
    ...MOCK_WATERS[1],
    methodFitStatus: 'compatible',
    methodFitLabel: '台钓结构适配',
    methodFitSummary: '仅用于演示“水域状态”和“钓法适配”可以分别确认，不代表真实可钓。',
    sampleMinimum: 6,
    lastBiteAt: '昨天 17:45',
    primarySpecies: ['鲫鱼（演示）'],
    primaryMethods: ['台钓（演示）'],
    fieldStatuses: [
      { id: 'water', label: '水情', state: 'normal', detail: '演示状态：平稳' },
      { id: 'road', label: '道路', state: 'normal', detail: '演示状态：可达' },
      { id: 'safety', label: '安全', state: 'unknown', detail: '现场风险待复核' },
    ],
    constraint: {
      rodLimit: '演示：1 人 1 杆',
      hooksPerLineLimit: '演示：每线 1 钩',
      baitRestrictions: ['演示字段，不作为真实规则'],
      equipmentRestrictions: ['演示字段，不作为真实规则'],
      note: '正式数据必须关联主管机关原文和适用范围。',
    },
    sources: [
      {
        id: 'demo-source-b',
        authority: '演示运营台账',
        title: '已核实状态界面样例（非真实水域依据）',
        scope: '演示水域 B · 粗粒度范围',
        publishedAt: '未接入',
        effectivePeriod: '演示',
        lastCheckedAt: '2026-08-03 18:20',
        sourceType: 'operator_sample',
      },
    ],
  },
  {
    ...MOCK_WATERS[2],
    methodFitStatus: 'unknown',
    methodFitLabel: '台钓适配待核实',
    methodFitSummary: '没有可靠水域规则时，也无法判断常用台钓线组和装备是否适用。',
    sampleMinimum: 6,
    primarySpecies: [],
    primaryMethods: [],
    fieldStatuses: [
      { id: 'water', label: '水情', state: 'unknown', detail: '近期无人贡献' },
      { id: 'road', label: '道路', state: 'unknown', detail: '近期无人贡献' },
      { id: 'safety', label: '安全', state: 'unknown', detail: '无可靠来源，请勿据此出发' },
    ],
    constraint: {
      rodLimit: '未知',
      hooksPerLineLimit: '未知',
      baitRestrictions: ['未知'],
      equipmentRestrictions: ['未知'],
      note: '规则和现场状态均待核实。',
    },
    sources: [
      {
        id: 'demo-source-c',
        authority: '用户报告样例',
        title: '待核实占位来源',
        scope: '演示水域 C · 粗粒度范围',
        publishedAt: '未知',
        effectivePeriod: '未知',
        lastCheckedAt: '尚未完成运营复核',
        sourceType: 'user_report',
      },
    ],
  },
];
