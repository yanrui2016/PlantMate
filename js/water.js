// 水分计算（计算层）：推算花盆土壤里还剩多少水。
// 今日消耗 = 基础消耗 × 植物系数 × 温度系数 × 湿度系数 × 光照系数 × 土壤系数

function tempFactor(t, p) {
  if (t < 15) return p.tempK.cold;
  if (t <= 25) return p.tempK.mild;
  if (t <= 30) return p.tempK.warm;
  return p.tempK.hot;
}

function humFactor(h, p) {
  if (h < 40) return p.humK.dry;
  if (h <= 70) return p.humK.normal;
  return p.humK.wet;
}

function lightFactor(plant, p) {
  if (plant.sun === 's3') return p.lightK.sun3;
  if (plant.sun === 's1') return p.lightK.sun1;
  if (plant.bright === 'lt3') return p.lightK.dim;
  return p.lightK.bright;
}

// 计算一天的消耗。weather 为 null 时按“标准天气”（温度、湿度系数都取1.0）
function dailyUse(plant, weather, p) {
  const sp = p.plants[plant.species];
  const soil = p.soils[plant.soil];
  const tk = weather ? tempFactor(weather.tmean, p) : 1.0;
  const hk = weather ? humFactor(weather.hum, p) : 1.0;
  return p.base * sp.k * tk * hk * lightFactor(plant, p) * soil.k;
}

// 冬季供暖：室内、选了“有暖气”、日期在供暖期内
function inHeatSeason(date, p) {
  const md = date.slice(5);
  return p.heatStart > p.heatEnd ? (md >= p.heatStart || md <= p.heatEnd) : (md >= p.heatStart && md <= p.heatEnd);
}
function isHeated(plant, date, p) {
  return plant.env === 'indoor' && plant.heating === 'yes' && inHeatSeason(date, p);
}
// 这盆植物某一天实际用的天气：供暖期的室内植物用“室内供暖条件”，其他用室外天气
function weatherFor(plant, weather, date, p) {
  if (isHeated(plant, date, p)) return { tmean: p.heatTemp, hum: p.heatHum, rain: 0, heated: true };
  return weather;
}

function isHydro(plant, p) { return !!p.soils[plant.soil].hydro; }
function daysSinceChange(plant) { return daysBetween(plant.lastChange || todayStr(), todayStr()); }

function clamp(v) { return Math.max(0, Math.min(100, v)); }

// 过一天：扣除消耗；露天植物下大雨就加满
function applyDay(plant, weather, p) {
  if (isHydro(plant, p)) return plant.balance;   // 水培不算水分余额
  plant.balance = clamp(plant.balance - dailyUse(plant, weather, p));
  if (plant.env === 'outdoor' && weather && weather.rain > p.rainMM) plant.balance = 100;
  return plant.balance;
}

// 状态：full 水分充足 / ok 正常 / low 该浇水了 / empty 严重缺水
function waterStatus(plant, p) {
  if (isHydro(plant, p)) {                  // 水培：按换水天数判断
    const d = daysSinceChange(plant);
    if (d >= p.hydroDays * 2) return { code: 'empty', text: '很久没换水' };
    if (d >= p.hydroDays) return { code: 'low', text: '该换水了' };
    return { code: 'ok', text: '正常' };
  }
  const line = p.plants[plant.species].line;
  const b = plant.balance;
  if (b <= 0) return { code: 'empty', text: '严重缺水' };
  if (b < line) return { code: 'low', text: '该浇水了' };
  if (b >= p.fullLine) return { code: 'full', text: '水分充足' };
  return { code: 'ok', text: '正常' };
}

// 预计几天后浇水 =（当前余额 − 提醒线）÷ 今日消耗，取整（还没到提醒线时至少是1天）
function daysToWater(plant, weather, p) {
  const line = p.plants[plant.species].line;
  if (plant.balance < line) return 0;
  return Math.max(1, Math.floor((plant.balance - line) / dailyUse(plant, weatherFor(plant, weather, todayStr(), p), p)));
}

// 下次浇水或换水的提示文字（水培和土培通用）
function nextText(plant, weather, p) {
  if (isHydro(plant, p)) {
    const n = p.hydroDays - daysSinceChange(plant);
    return n <= 0 ? '今天换水' : (n === 1 ? '明天该换水' : '约' + n + '天后换水');
  }
  return daysText(daysToWater(plant, weather, p));
}

function daysText(n) {
  if (n <= 0) return '今天浇透';
  if (n === 1) return '明天该浇水';
  return '约' + n + '天后浇水';
}

// 浇水：full 浇透 / little 浇了一点
function waterPlant(plant, kind, p) {
  if (kind === 'full') {
    plant.balance = 100;
    addLog(plant, 'water', '浇透');
  } else {
    plant.balance = clamp(plant.balance + p.littleWater);
    addLog(plant, 'water', '浇了一点');
  }
  plant.lastUpdate = todayStr();
  addHistory(plant, todayStr(), plant.balance);
}

// 水培：换水 / 加水
function changeWater(plant) {
  plant.lastChange = todayStr();
  addLog(plant, 'water', '换水');
}
function addWaterHydro(plant) {
  addLog(plant, 'water', '加了点水');
}

// 测土校正：wet 还很湿 / some 有点干 / dry 很干
function calibrate(plant, feel, p) {
  const names = { wet: '还很湿', some: '有点干', dry: '很干' };
  plant.balance = p.calib[feel];
  plant.lastUpdate = todayStr();
  plant.needCalib = false;
  addLog(plant, 'calib', '我摸了一下土：' + names[feel]);
  addHistory(plant, todayStr(), plant.balance);
}
