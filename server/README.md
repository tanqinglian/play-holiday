# Play Holiday API 运行与运维

## 配置

复制 `.env.example` 为 `.env`，并设置两个连接串：

- `DATABASE_URL`：Prisma 迁移连接，本地可使用有 DDL 权限的账号。
- `DATABASE_HOST/DATABASE_PORT/DATABASE_USER/DATABASE_PASSWORD/DATABASE_NAME`：API 运行连接，这个账号只授予 `SELECT/INSERT/UPDATE/DELETE`。

其他可选项：`HOST`、`PORT`、`LOG_LEVEL`、`PRISMA_QUERY_LOG=1`、`WEATHER_API_BASE_URL`、`WEATHER_API_KEY`。天气默认使用 Open-Meteo 非商业原型端点；正式商用需切换到已订阅的商业端点。生产环境不建议开启 SQL 查询日志。

## 建库与导入

```bash
pnpm --dir server db:deploy
pnpm --dir server db:seed
```

Seed 是幂等的：地点按稳定 ID upsert，标签、评论和图片按唯一键跳过重复。当前预期为 664 个地点（其中 182 个可地图展示）、1,587 条评论和 964 条图片记录；重复执行不会翻倍。

## 启动与健康检查

```bash
pnpm --dir server dev
curl -fsS http://127.0.0.1:3100/api/health
```

正常响应为 `{"status":"ok","database":"up"}`。每个响应都包含 `x-request-id`；异常响应同时返回 `requestId`，可直接用来检索 JSON 日志。授权头和 Cookie 默认脱敏。

现场钓情使用 `POST /api/places/:id/live-reports`，只接收 `idempotencyKey`、`biteStatus`和 `crowdLevel`，不接收自由文本或用户精准坐标。各钓点列表与详情响应的 `liveCondition` 只统计近 6 小时数据。

用户附近钓点使用 `GET /api/places/nearby?latitude=...&longitude=...&radiusKm=10`。服务端先用边界框缩小数据库查询，再用 Haversine 球面距离做严格半径过滤，不会将矩形四角超过 10km 的钓点混入。

生产构建：

```bash
pnpm --dir server build
pnpm --dir server start
```

容器构建（构建上下文必须是项目根目录）：

```bash
docker build -t play-holiday-api .
docker run --rm -p 8080:8080 \
  --env-file server/.env \
  -e SERVER_HOST=0.0.0.0 -e PORT=8080 \
  play-holiday-api
```

腾讯云部署时通过环境变量注入数据库配置，禁止上传 `server/.env`。数据库迁移应在发布新版本前单独执行 `pnpm --dir server db:deploy`，不要让每个弹性实例启动时重复运行迁移。

进程监管可使用 systemd、Docker 或 PM2；应配置进程崩溃重启和 `/api/health` 存活检查。服务已处理 `SIGINT/SIGTERM`，会先关闭 HTTP 和数据库连接。

## 测试

```bash
pnpm --dir server typecheck
pnpm --dir server test
```

测试覆盖分页、筛选、地图边界、无坐标排除、详情 404、旧评论时间原样保留、Seed 归一化及真实 MySQL 连接。

## 备份和恢复

上线前和迁移前执行逻辑备份：

```bash
mysqldump --single-transaction --set-gtid-purged=OFF play_holiday > play_holiday-backup.sql
mysql play_holiday < play_holiday-backup.sql
```

备份文件不应提交到代码库，且要定期执行恢复演练。

## 兼容性提示

当前本机 MySQL 9.6 已通过迁移、Seed、Prisma Adapter 连接和 API 实测。Prisma 的官方支持矩阵仍主要列出 MySQL 8.x，部署环境建议优先 MySQL 8.4 LTS，或在升级 Prisma/MySQL 前完整跑一次数据库集成测试。
