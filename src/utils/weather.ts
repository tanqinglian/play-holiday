const BEAUFORT_UPPER_KMH = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];

export function beaufortLevel(speedKmh: number) {
  const speed = Math.max(0, speedKmh);
  const matched = BEAUFORT_UPPER_KMH.findIndex((upper) => speed < upper);
  return matched === -1 ? 12 : matched;
}

/**
 * 模型风速是瞬时估计值，面向钓友展示为相邻风级区间，避免伪精确。
 */
export function windForceRange(speedKmh: number) {
  const lower = beaufortLevel(speedKmh);
  const upper = Math.min(12, lower + 1);
  return lower === upper ? `${lower}级` : `${lower}～${upper}级`;
}
