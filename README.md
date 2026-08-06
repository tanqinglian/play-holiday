# Play Holiday

武汉台钓钓点、出钓记录与拍照识鱼微信小程序。当前已将 664 条武汉真实公开钓点资料导入本地 MySQL，其中 182 条带来源坐标；同时保留 1,587 条历史评论和 964 条图片记录。

## 技术栈

- 小程序：Taro 4.2、React 18、TypeScript、Less
- API：Fastify 5、Prisma 7
- 数据库：MySQL
- 天气：Open-Meteo Forecast API（后端代理，10 分钟坐标网格缓存）
- 测试：Node Test Runner、miniprogram-automator

## 本地运行

```bash
pnpm install --frozen-lockfile
pnpm server:db:migrate
pnpm server:db:seed
pnpm server:dev
pnpm dev:weapp
```

在微信开发者工具中导入项目根目录，工具会根据 `project.config.json` 加载 `dist/`。API 默认为 `http://127.0.0.1:3100`，可用 `PLAY_HOLIDAY_API_BASE_URL` 覆盖。

## 质量检查

```bash
pnpm verify
pnpm test:e2e
```

`verify` 覆盖前后端类型检查、小程序构建、单元/冒烟/API 测试。`test:e2e` 在本地 API 和微信开发者工具上验证真实数据列表、搜索、详情、无效 ID、无坐标禁用与记录离线队列。

## 数据边界

- 运行时核心页面不使用 Mock 钓点。
- 首页按用户定位展示附近钓点、实时天气和可解释钓法建议；未授权定位时降级为武汉城区。
- 地图 Tab 首次进入会定位用户，默认严格按球面距离渲染半径 10km 内钓点；只有用户拖动或缩放后才切换为当前可见视野查询。
- 钓点详情可提交结构化现场钓情（鱼口、拥挤度），幂等写入 MySQL；首页、列表、地图和详情只聚合近 6 小时样本。
- 原始来源未给出经纬度的记录只进入列表，地图和导航按钮禁用，不伪造坐标。带坐标的新数据作为独立钓点导入。
- 历史评论标记为外部历史内容，不计入站内用户趟次。
- 存量资料可能过期，不构成当前可钓、安全或营业承诺。
- 私人精准点默认只保存在本机。

数据采集脚本和可重复导入产物在 `initdata-script/`；后端运维详见 `server/README.md`。

天气数据归属 [Open-Meteo](https://open-meteo.com/)，数据按 CC BY 4.0 归属要求标注。默认免费端点仅供非商业原型；正式商用前需配置商业端点和 API Key。
