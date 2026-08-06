# 小程序 E2E 与功能完善度

## 原则

功能是否完成以“需求条目有验证方式”为准，不以页面存在或人工主观判断为准。验证分为四层：

1. `typecheck`：类型和接口约束；
2. `smoke`：编译产物、页面、权限和资源完整性；
3. `e2e`：微信开发者工具中的真实路由、交互、存储和原生组件属性；
4. `device/manual`：相机、相册、真实定位授权、地图瓦片、弱网和真机性能。

只有适合自动化的功能才进入 E2E 通过率；相机或第三方服务未验证时必须保持“待真机／集成验证”，不能用模拟结果冒充完成。

## M1 覆盖矩阵

| 能力 | 自动化层级 | 状态 | 证据 |
| --- | --- | --- | --- |
| 四个 Tab 和五个页面进入产物 | Smoke | 已通过 | `tests/smoke/build.test.mjs` |
| 定位权限与拒绝后的降级说明 | Smoke | 已通过 | `dist/app.json` 断言 |
| Tab 图标、地图标记资源完整 | Smoke | 已通过 | 产物文件断言 |
| 首页展示演示数据声明 | E2E | 已通过 | `home-to-record` |
| 首页“记一趟”进入记录页 | E2E | 已通过 | `home-to-record` |
| 主 CTA ≥48px | E2E | 已通过 | 元素尺寸断言 |
| 地图初始 3 个标记、筛选后 2 个 | E2E | 已通过 | `map-filter-location` |
| 主动定位后地图中心更新 | E2E（模拟定位） | 已通过 | `map-filter-location` |
| 有口趟次保存为本机草稿 | E2E | 已通过 | `save-local-trip` |
| “我的”读取本机趟次数量 | E2E | 已通过 | `mine-local-trip-count` |
| 记录页进入识鱼页 | E2E | 已通过 | `record-to-fish` |
| 真实定位授权弹窗和拒绝流程 | 真机 | 发版前验证 | 权限场景；自动化已覆盖成功定位和代码级降级说明 |
| 地图瓦片、CoverView 层叠和主要页面视觉 | 开发者工具视觉 | 已通过 | `.artifacts/e2e/visual-*.png` |
| 相机／相册选图 | 真机 | M4 验证 | 微信权限与临时文件 |
| 识鱼真实接口 | 集成测试 | M4 验证 | 可控测试图片与接口响应 |

## M2 覆盖矩阵

| 能力 | 自动化层级 | 状态 | 证据 |
| --- | --- | --- | --- |
| 水域详情位于独立分包 | Smoke | 已通过 | `m2-water-detail.test.mjs` |
| 水域状态与台钓适配分开表达 | Smoke | 已通过 | 页面结构断言 |
| 样本不足与近期无人贡献分开展示 | Smoke | 已通过 | 页面文案与分支断言 |
| 规则来源、复核时间和纠错入口 | Smoke | 已通过 | 页面结构断言 |
| 收藏写入本机并可取消 | E2E | 已通过 | `water-detail-favorite-correction` |
| 纠错草稿写入本机离线队列 | E2E | 已通过 | `water-detail-favorite-correction` |
| 返回地图后保留筛选状态 | E2E | 已通过 | `water-detail-favorite-correction` |
| 水域详情视觉与长页滚动 | 开发者工具视觉 | 已通过 | `visual-water-detail-ui.png`、`visual-water-detail-lower-ui.png` |

M2 原生场景已于 2026-08-04 在微信开发者工具 Stable v2.01.2510290 通过。E2E 运行器优先复用健康的 9420 自动化端口；只有连接不可恢复时才重启开发者工具，避免每次测试都出现“CLI/HTTP 调用正在关闭工具”的倒计时弹窗。无场景执行的失败尝试写入 `m1-attempt.json`／`m2-attempt.json`，不会覆盖最后一次有效通过报告。

## M3 当前切片

| 能力 | 自动化层级 | 状态 | 证据 |
| --- | --- | --- | --- |
| 趟次默认只存私人记录 | E2E | 已通过 | `private-trip-default` |
| 未关联水域时禁止匿名贡献 | E2E | 已通过 | 匿名按钮 `disabled` 属性断言 |
| 本机草稿明确不含精准位置 | E2E | 已通过 | `preciseLocationIncluded === false` |
| 匿名水域贡献进入离线队列 | Smoke | 已通过，E2E 待补完整选择流程 | `syncStatus: queued` 分支断言 |
| 离线提交具有幂等键 | Smoke + E2E | 已通过 | `idempotencyKey` 结构与值断言 |
| 私人点、历史列表、编辑删除 | — | 待开发 | M3 后续切片 |

## 命令

```bash
# 类型、构建与不依赖登录的冒烟测试
pnpm verify

# 微信开发者工具真实 E2E；运行前需要开发者工具已登录
pnpm test:e2e
```

E2E 预检结果写入 `.artifacts/e2e/preflight.json`；默认回归为单开发者工具连接内顺序执行 M1–M3，结果写入 `.artifacts/e2e/summary.json`。里程碑独立文件保留作定向诊断，不作为默认多进程回归入口。

## 里程碑闸门

- 自动化可覆盖的 P0 核心场景必须全部通过；
- 运行期间不得出现未处理的小程序异常；
- 真机／外部服务场景必须有明确负责人和验证记录；
- 任何“待验证”项不得在 `TASKS.md` 中标记为完成。
