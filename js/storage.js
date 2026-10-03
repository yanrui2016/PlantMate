// 本地存储：所有数据保存在本机浏览器的 localStorage 里。

const STORE_KEY = 'zhiwu-data-v1';

function emptyData() {
  return {
    nextId: 1,
    plants: [],
    settings: { province: '', city: '', lat: null, lon: null, apiKey: '', model: 'glm-4.6v-flash', demo: false },
    overrides: {},          // 用户在高级设置里改过的参数
    customPlants: {},       // 用户自己添加的植物品种
    weatherCache: null      // 最近一次获取的天气（首页天气卡片用）
  };
}

function loadData() {
  try {
    const text = localStorage.getItem(STORE_KEY);
    if (!text) return emptyData();
    const data = JSON.parse(text);
    const base = emptyData();
    data.settings = Object.assign(base.settings, data.settings || {});
    return Object.assign(base, data);
  } catch (e) {
    console.error('读取数据失败', e);
    return emptyData();
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    alert('保存失败：浏览器存储空间可能已满。');
    return false;
  }
}

// 取得实际使用的参数：初始值 + 用户修改
function getParams(data) {
  const p = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  const o = (data && data.overrides) || {};
  ['base', 'hydroDays'].forEach(k => { if (typeof o[k] === 'number') p[k] = o[k]; });
  ['tempK', 'humK', 'lightK'].forEach(g => { if (o[g]) Object.assign(p[g], o[g]); });
  if (o.plants) for (const id in o.plants) if (p.plants[id]) Object.assign(p.plants[id], o.plants[id]);
  if (o.soils) for (const id in o.soils) if (p.soils[id] && !p.soils[id].hydro) Object.assign(p.soils[id], o.soils[id]);
  const custom = (data && data.customPlants) || {};
  for (const id in custom) p.plants[id] = Object.assign({}, custom[id], { likeLight: custom[id].light === '喜光', custom: true });
  return p;
}

function findPlant(data, id) {
  return data.plants.find(pl => pl.id === Number(id));
}

// 给植物添加一条记录（最新的在前，最多保留100条）
function addLog(plant, type, text) {
  plant.logs = plant.logs || [];
  plant.logs.unshift({ date: todayStr(), type: type, text: text });
  if (plant.logs.length > 100) plant.logs.length = 100;
}

// 记录某天的水分余额（画折线图用，最多保留60条）
function addHistory(plant, date, value) {
  plant.history = plant.history || [];
  const last = plant.history[plant.history.length - 1];
  if (last && last.date === date && last.v === value) return;
  plant.history.push({ date: date, v: Math.round(value) });
  if (plant.history.length > 60) plant.history.shift();
}

// 导出数据：下载一个备份文件（不包含密钥）
function exportData(data) {
  const copy = JSON.parse(JSON.stringify(data));
  copy.settings.apiKey = '';
  const blob = new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '植物养植助手-备份-' + todayStr() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// 导入数据：读取备份文件，保留当前密钥
function importData(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if (!Array.isArray(incoming.plants)) throw new Error('格式不对');
      const current = loadData();
      incoming.settings = Object.assign({}, incoming.settings, { apiKey: current.settings.apiKey });
      saveData(Object.assign(emptyData(), incoming));
      done(true);
    } catch (e) {
      done(false, '这个文件不是植物养植助手的备份文件。');
    }
  };
  reader.readAsText(file);
}

// ---------- 日期小工具 ----------
function dateStr(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return d.getFullYear() + '-' + m + '-' + day;
}
function todayStr() { return dateStr(new Date()); }
function daysBetween(a, b) {   // b - a，单位：天
  const da = new Date(a + 'T00:00:00'), db = new Date(b + 'T00:00:00');
  return Math.round((db - da) / 86400000);
}
function addDays(s, n) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateStr(d);
}
function shortDate(s) {
  const parts = s.split('-');
  return Number(parts[1]) + '月' + Number(parts[2]) + '日';
}
