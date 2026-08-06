import assert from 'node:assert/strict';
import test from 'node:test';
import {
  mergeSeedPlaces,
  parseBaohuDetailPage,
  parseBaohuDirectoryPage,
  parseDiaoyuDetailPage,
  parseDiaoyuListPage,
} from '../../initdata-script/lib/seed-source.mjs';

const BAOHU_DIRECTORY_HTML = `
<article class="fishing-place-card" data-lat="30.2837" data-lng="114.1141">
  <img src="https://www.baohugongjuxiang.cn/images/example" />
  <h3 class="place-name">武汉鸿博巨物钓场</h3>
  <p class="place-address"><span>📍</span>金康南路118号</p>
  <a href="/fishing/spot/2b5da985-7e64-11f0-ae87-525400d5df8f">查看详情 →</a>
</article>`;

test('爆护公开目录解析坐标和详情链接', () => {
  assert.deepEqual(parseBaohuDirectoryPage(BAOHU_DIRECTORY_HTML), [{
    sourceRecordId: '2b5da985-7e64-11f0-ae87-525400d5df8f',
    sourceUrl: 'https://www.baohugongjuxiang.cn/fishing/spot/2b5da985-7e64-11f0-ae87-525400d5df8f',
    name: '武汉鸿博巨物钓场',
    address: '金康南路118号',
    latitude: 30.2837,
    longitude: 114.1141,
    imageUrl: 'https://www.baohugongjuxiang.cn/images/example',
  }]);
});

const BAOHU_DETAIL_HTML = `
<h1>武汉鸿博巨物钓场钓点详情 - 武汉市优质钓鱼地点</h1>
<li>地址：金康南路118号</li>
<li>地区：武汉市 - 汉南区</li>
<li>坐标： 30.2837°N, 114.1141°E</li>`;

test('爆护详情只接受武汉市且保留公开来源坐标', () => {
  assert.deepEqual(parseBaohuDetailPage(BAOHU_DETAIL_HTML), {
    name: '武汉鸿博巨物钓场',
    city: '武汉市',
    district: '汉南区',
    address: '金康南路118号',
    latitude: 30.2837,
    longitude: 114.1141,
  });
  assert.equal(parseBaohuDetailPage(BAOHU_DETAIL_HTML.replace('武汉市 - 汉南区', '鄂州市 - 华容区')), null);
});

const LIST_HTML = `
<ul class="fishing">
  <li>
    <a href="https://m.diaoyu.com/diaochang/wuhan/201805.html">
      <div class="img"><img src="avatar.jpg" /></div>
      <div class="info">
        <div class="title">老蔡钓场</div>
        <div class="tag"><span><em>黑坑</em></span><i><em>电话认证</em></i></div>
        <div class="address"><span>湖北省武汉市黄陂区胜海大道</span></div>
        <div class="fishes">鲤鱼、草鱼、青鱼</div>
        <div class="charge">收费：80-300元/天</div>
        <p><span>简介：</span>不应进入种子包的长篇宣传正文</p>
      </div>
    </a>
  </li>
</ul>`;

test('钓场目录解析为地点的初始基线版本', () => {
  const [place] = parseDiaoyuListPage(LIST_HTML, '2026-08-04T08:00:00.000Z');

  assert.equal(place.id, 'diaoyu-wuhan-201805');
  assert.equal(place.name, '老蔡钓场');
  assert.equal(place.district, '黄陂区');
  assert.deepEqual(place.placeTypes, ['黑坑']);
  assert.deepEqual(place.species, ['鲤鱼', '草鱼', '青鱼']);
  assert.equal(place.recordKind, 'place_baseline');
  assert.equal(place.baselineStatus, 'imported');
  assert.equal(place.countsTowardTripStats, false);
  assert.equal(place.coordinateStatus, 'missing');
  assert.equal(place.sourceUrl, 'https://m.diaoyu.com/diaochang/wuhan/201805.html');
  assert.equal('description' in place, false);
  assert.equal('imageUrl' in place, false);
  assert.equal('author' in place, false);
});

test('合并分页结果按稳定来源 ID 去重', () => {
  const parsed = parseDiaoyuListPage(LIST_HTML, '2026-08-04T08:00:00.000Z');
  const merged = mergeSeedPlaces([...parsed, ...parsed]);
  assert.equal(merged.length, 1);
});

const DETAIL_HTML = `
<ul class="slide-img">
  <li><img src="placeholder.png" diaoyuimg="https://img.example.com/a.jpg" /></li>
  <li><img src="placeholder.png" diaoyuimg="https://img.example.com/b.jpg" /></li>
</ul>
<dl class="common">
  <dt>评论<span>（2条）</span></dt>
  <dd>
    <div class="user"><img src="avatar.jpg"><div class="name"><em>不应采集的昵称</em></div></div>
    <div class="score"><i class="full"></i><span><em>4.0分</em></span></div>
    <p>最近去过，收费已经调整。</p>
    <div class="time">3天前<a>和Ta沟通</a></div>
  </dd>
  <dd><div class="app-load">打开 App 查看更多</div></dd>
</dl>`;

test('详情页只提取原图与评论内容，不提取评论者身份', () => {
  const detail = parseDiaoyuDetailPage(DETAIL_HTML);
  assert.deepEqual(detail.imageUrls, [
    'https://img.example.com/a.jpg',
    'https://img.example.com/b.jpg',
  ]);
  assert.deepEqual(detail.comments, [
    { text: '最近去过，收费已经调整。', rating: 4, publishedLabel: '3天前' },
  ]);
  assert.equal(JSON.stringify(detail).includes('不应采集的昵称'), false);
  assert.equal(JSON.stringify(detail).includes('avatar.jpg'), false);
});
