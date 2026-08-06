const WUHAN_DISTRICTS = [
  '江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区',
  '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区',
];

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(value = '') {
  return decodeHtml(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function classText(block, className) {
  const match = block.match(
    new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`, 'i'),
  );
  return cleanText(match?.[1]);
}

function splitChineseList(value) {
  return value.split(/[、,，/]/).map((item) => item.trim()).filter(Boolean);
}

function extractDistrict(address) {
  return WUHAN_DISTRICTS.find((district) => address.includes(district)) ?? '武汉市';
}

export function parseDiaoyuListPage(html, collectedAt = new Date().toISOString()) {
  const places = [];
  const itemPattern = /<li>\s*<a\s+href=["'](https:\/\/m\.diaoyu\.com\/diaochang\/wuhan\/(\d+)\.html)["'][^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;

  for (const match of html.matchAll(itemPattern)) {
    const [, sourceUrl, sourceId, block] = match;
    const name = classText(block, 'title');
    const address = classText(block, 'address').replace(/\d+(?:\.\d+)?(?:m|km)$/i, '').trim();
    if (!name || !address) continue;

    const tagBlock = block.match(/<div\s+class=["']tag["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
    const allTags = [...tagBlock.matchAll(/<em>([\s\S]*?)<\/em>/gi)].map((tag) => cleanText(tag[1]));
    const placeTypes = allTags.filter((tag) => tag && tag !== '电话认证');
    const verifiedBySource = allTags.includes('电话认证');

    places.push({
      id: `diaoyu-wuhan-${sourceId}`,
      name,
      district: extractDistrict(address),
      address,
      placeTypes,
      species: splitChineseList(classText(block, 'fishes')),
      chargeText: classText(block, 'charge').replace(/^收费[：:]?\s*/, ''),
      verifiedBySource,
      sourcePlatform: 'diaoyu',
      sourceUrl,
      sourceRecordId: sourceId,
      sourceCapturedAt: collectedAt,
      recordKind: 'place_baseline',
      baselineStatus: 'imported',
      countsTowardTripStats: false,
      coordinateStatus: 'missing',
      latitude: null,
      longitude: null,
    });
  }

  return places;
}

export function mergeSeedPlaces(places) {
  return [...new Map(places.map((place) => [place.id, place])).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function parseBaohuDirectoryPage(html) {
  const records = [];
  const cardPattern = /<article[^>]+class=["'][^"']*\bfishing-place-card\b[^"']*["'][^>]*data-lat=["']([^"']+)["'][^>]*data-lng=["']([^"']+)["'][^>]*>([\s\S]*?)<\/article>/gi;
  for (const match of html.matchAll(cardPattern)) {
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    const block = match[3];
    const href = block.match(/href=["'](\/fishing\/spot\/([a-f0-9-]+))["']/i);
    const name = classText(block, 'place-name');
    const addressBlock = block.match(/<p[^>]+class=["'][^"']*\bplace-address\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
    const address = cleanText(addressBlock).replace(/^[📍\s]+/u, '').trim();
    const imageUrl = block.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i)?.[1];
    if (!href || !name || !address || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    records.push({
      sourceRecordId: href[2],
      sourceUrl: `https://www.baohugongjuxiang.cn${href[1]}`,
      name,
      address,
      latitude,
      longitude,
      ...(imageUrl ? { imageUrl: decodeHtml(imageUrl) } : {}),
    });
  }
  return records;
}

export function parseBaohuDetailPage(html) {
  const detailField = (label) => {
    const emphasized = html.match(new RegExp(`<li[^>]*>\\s*<strong[^>]*>${label}[：:]<\\/strong>([\\s\\S]*?)<\\/li>`, 'i'))?.[1];
    const plain = html.match(new RegExp(`<li[^>]*>\\s*${label}[：:]([\\s\\S]*?)<\\/li>`, 'i'))?.[1];
    return cleanText(emphasized ?? plain ?? '');
  };
  const heading = cleanText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const region = detailField('地区');
  const address = detailField('地址');
  const coordinateText = detailField('坐标');
  const regionMatch = region.match(/^([^\s-]+)\s*-\s*(.+)$/);
  const coordinateMatch = coordinateText.match(/([\d.]+)\s*°?\s*N\s*,\s*([\d.]+)\s*°?\s*E/i);
  if (!heading || !regionMatch || regionMatch[1] !== '武汉市' || !address || !coordinateMatch) return null;
  const latitude = Number(coordinateMatch[1]);
  const longitude = Number(coordinateMatch[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < 29.8 || latitude > 31.5 || longitude < 113.6 || longitude > 115.2) return null;
  return {
    name: heading.replace(/钓点详情[\s\S]*$/, '').trim(),
    city: regionMatch[1],
    district: regionMatch[2].trim(),
    address,
    latitude,
    longitude,
  };
}

export function parseDiaoyuDetailPage(html) {
  const gallery = html.match(/<ul[^>]+class=["'][^"']*\bslide-img\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  const imageUrls = [...gallery.matchAll(/\bdiaoyuimg=["'](https?:\/\/[^"']+)["']/gi)]
    .map((match) => decodeHtml(match[1]))
    .filter((url, index, values) => values.indexOf(url) === index);

  const commentSection = html.match(/<dl[^>]+class=["'][^"']*\bcommon\b[^"']*["'][^>]*>([\s\S]*?)<\/dl>/i)?.[1] ?? '';
  const comments = [];
  for (const match of commentSection.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/gi)) {
    const block = match[1];
    const text = cleanText(block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]).slice(0, 800);
    if (!text) continue;
    const ratingText = cleanText(block.match(/<div[^>]+class=["'][^"']*\bscore\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]);
    const rating = Number.parseFloat(ratingText.match(/\d+(?:\.\d+)?/)?.[0] ?? '');
    const publishedLabel = cleanText(block.match(/<div[^>]+class=["'][^"']*\btime\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
      .replace(/和Ta沟通/g, '')
      .trim();
    comments.push({
      text,
      ...(Number.isFinite(rating) ? { rating } : {}),
      publishedLabel,
    });
  }

  return { imageUrls, comments };
}
