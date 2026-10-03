// 每日更新：打开网页时，从每盆植物“上次更新那天”开始，逐天补算水分。

async function updateAll(data) {
  const p = getParams(data);
  const today = todayStr();
  const s = data.settings;
  const result = { days: 0, missing: false, error: '' };

  // 需要补算的最多天数
  let need = 0;
  data.plants.forEach(pl => {
    const gap = daysBetween(pl.lastUpdate, today);
    if (!isHydro(pl, p) && gap > 0 && gap <= p.maxGapDays) need = Math.max(need, gap);
  });

  // 获取天气（顺便更新首页天气卡片）
  let days = null;
  if (s.demo || s.lat != null) {
    try {
      days = await fetchWeather(s.lat, s.lon, need);
      data.weatherCache = { date: today, days: days };
    } catch (e) {
      result.error = e.name === 'AbortError' ? '天气服务连接超时' : e.message;
    }
  } else {
    result.error = '还没有设置所在城市';
  }

  // 逐盆、逐天补算
  data.plants.forEach(pl => {
    const gap = daysBetween(pl.lastUpdate, today);
    if (gap <= 0) return;
    if (isHydro(pl, p)) { pl.lastUpdate = today; return; }   // 水培只看换水天数，不补算
    if (gap > p.maxGapDays) {        // 太久没打开，推算误差太大，请用户测土
      pl.needCalib = true;
      pl.lastUpdate = today;
      return;
    }
    for (let i = 1; i <= gap; i++) {
      const d = addDays(pl.lastUpdate, i);
      const w = days ? days[d] : null;
      if (!w) result.missing = true;
      applyDay(pl, w || null, p);
      addHistory(pl, d, pl.balance);
    }
    pl.lastUpdate = today;
    result.days = Math.max(result.days, gap);
  });

  saveData(data);
  return result;
}

// 今天的天气（没有就返回 null）
function todayWeather(data) {
  const c = data.weatherCache;
  if (!c || !c.days) return null;
  return c.days[todayStr()] || null;
}
