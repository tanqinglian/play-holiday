# 初始数据采集脚本

本目录保存 Play Holiday 各试点城市的**一次性存量数据采集与规范化脚本**。脚本输出地点的版本 0 基线；产品上线后，用户提交的变化以新记录追加，不覆盖基线。

## 当前已接入来源

### 爆护工具箱公开武汉钓点目录

- 入口：<https://www.baohugongjuxiang.cn/fishing>
- 来源声明：CC BY 4.0，脚本遵守 `robots.txt` 且每次请求间隔至少 2 秒
- 本次采集日期：2026-08-04
- 结果：182 个带来源坐标的武汉地点，作为独立新钓点导入
- 输出：`initdata-script/data/wuhan-coordinate-places.v1.json`

重新采集：

```bash
pnpm seed:collect:wuhan:coordinates
```

只读取公开目录和详情页，不绕过登录、验证码或访问控制，不采集用户身份。来源未明示坐标系，数据中保守标记为 `gcj02_unverified`，上线前需抽样校验导航偏差。

### 钓鱼之家公开武汉钓场目录

- 入口：<https://m.diaoyu.com/diaochang/wuhan/>
- 分页形式：`https://m.diaoyu.com/diaochang/wuhan/list-0-0-0-{page}.html`
- 本次采集日期：2026-08-04
- 本次页面数：49
- 本次规范化结果：482 个武汉地点
- 输出：`src/data/seed/wuhan-fishing-places.v1.json`

仅提取列表页公开展示的地点事实：

- 地点名称；
- 行政区与文字地址；
- 钓场类型；
- 鱼种；
- 收费文本；
- 来源记录 ID、来源 URL 和采集时间。

详情增强会额外采集评论正文和详情页公开图片，但不采集用户昵称、头像、用户主页、电话和个人精准位置。

## 运行

项目根目录执行：

```bash
pnpm seed:collect:wuhan
```

抓取详情页评论，并将每个地点最多 3 张公开图片下载到本地原始数据层：

```bash
pnpm seed:enrich:wuhan
```

详情输出：

- `initdata-script/data/wuhan-place-details.v1.json`；
- `initdata-script/data/wuhan-images/{placeId}/`。

只保存图片 URL、不下载二进制文件：

```bash
node initdata-script/enrich-wuhan-details.mjs --urls-only
```

默认读取 49 页，每次请求间隔至少 600ms。调试解析器时可以只读少量页面：

```bash
node initdata-script/collect-wuhan-seeds.mjs --pages=2 --delay=600
```

注意：执行少量页面命令也会覆盖正式 JSON，因此只应用于本地调试，完成后需重新运行全量命令。

## 数据语义

- `recordKind: place_baseline`：地点初始基线；
- `baselineStatus: imported`：通过外部公开来源导入；
- `countsTowardTripStats: false`：地点基线不是用户趟次；
- `coordinateStatus: missing`：来源只有地址时不得伪造经纬度；
- 后续用户更新写入 `ph.place.updates.v1`，与初始 JSON 分开保存。
- 评论不保存作者身份；图片与评论必须保留地点级来源 URL，正式公开前仍需做内容与授权审查。

## 尚未批量接入

小红书和抖音目前只有小程序内的公开分享链接手动导入能力，**尚未运行批量采集脚本，也没有数据混入已有来源记录**。后续如接入，应单独建立来源适配器，继续输出同一基线/更新模型，并保留来源链接和采集时间。
