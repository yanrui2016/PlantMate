// 天气：从 Open-Meteo 获取过去N天和未来几天的天气。
// 返回一个“按日期查天气”的表：{ '2026-10-03': { tmean, tmax, tmin, hum, rain, code } }

const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';

async function fetchWeather(lat, lon, pastDays) {
  if (isDemo()) return demoWeather(pastDays);
  const past = Math.max(0, Math.min(92, pastDays));
  const url = WEATHER_URL + '?latitude=' + lat + '&longitude=' + lon +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code' +
    '&hourly=temperature_2m,relative_humidity_2m' +
    '&past_days=' + past + '&forecast_days=3&timezone=auto';
  const res = await fetchWithTimeout(url, 15000);
  if (!res.ok) throw new Error('天气服务返回错误：' + res.status);
  const j = await res.json();
  return parseWeather(j);
}

function parseWeather(j) {
  const days = {};
  j.daily.time.forEach((d, i) => {
    days[d] = {
      tmax: j.daily.temperature_2m_max[i],
      tmin: j.daily.temperature_2m_min[i],
      rain: j.daily.precipitation_sum[i] || 0,
      code: j.daily.weather_code[i]
    };
  });
  // 用每小时数据算出日平均气温和日平均湿度
  const sum = {};
  j.hourly.time.forEach((t, i) => {
    const d = t.slice(0, 10);
    const T = j.hourly.temperature_2m[i], H = j.hourly.relative_humidity_2m[i];
    if (T == null || H == null) return;
    sum[d] = sum[d] || { t: 0, h: 0, n: 0 };
    sum[d].t += T; sum[d].h += H; sum[d].n++;
  });
  for (const d in days) {
    const s = sum[d];
    days[d].tmean = s ? s.t / s.n : (days[d].tmax + days[d].tmin) / 2;
    days[d].hum = s ? s.h / s.n : 55;
  }
  return days;
}

function fetchWithTimeout(url, ms, options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, Object.assign({}, options, { signal: ctrl.signal })).finally(() => clearTimeout(timer));
}

// 城市名换算成经纬度
async function geocodeCity(province, city) {
  const name = city.replace(/(市|地区|盟|自治州)$/, '');
  const res = await fetchWithTimeout(GEO_URL + '?name=' + encodeURIComponent(name) + '&count=10&language=zh&format=json', 15000);
  const j = await res.json();
  const list = (j.results || []).filter(r => r.country_code === 'CN');
  if (!list.length) throw new Error('找不到这个城市的位置');
  const prov = province.replace(/(省|市|自治区|壮族|回族|维吾尔|特别行政区)/g, '');
  const best = list.find(r => (r.admin1 || '').indexOf(prov) >= 0) || list[0];
  return { lat: best.latitude, lon: best.longitude };
}

// 天气代码转文字（WMO 国际天气代码）
function weatherText(code) {
  const map = {
    0: '晴', 1: '晴间多云', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇',
    51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨', 56: '冻毛毛雨', 57: '冻毛毛雨',
    61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '强冻雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '米雪',
    80: '小阵雨', 81: '阵雨', 82: '强阵雨', 85: '阵雪', 86: '强阵雪',
    95: '雷雨', 96: '雷雨伴冰雹', 99: '强雷雨伴冰雹'
  };
  return map[code] || '未知';
}

// 按24小时降水量分级（我国气象部门的划分标准）
function rainLevel(mm) {
  if (!mm || mm < 0.1) return '';
  if (mm < 10) return '小雨';
  if (mm < 25) return '中雨';
  if (mm < 50) return '大雨';
  if (mm < 100) return '暴雨';
  if (mm < 250) return '大暴雨';
  return '特大暴雨';
}

// 天气描述：天气现象 + 降水量。两种说法不一样时，再注明按雨量算的等级
// 例如：“中雨，降水12.4毫米”“阵雨，降水30毫米，按雨量算是大雨”
function weatherDesc(w) {
  const text = weatherText(w.code);
  if (!(w.rain >= 0.1)) return text;
  const level = rainLevel(w.rain);
  return text + '，降水' + (Math.round(w.rain * 10) / 10) + '毫米' + (level === text ? '' : '，按雨量算是' + level);
}
