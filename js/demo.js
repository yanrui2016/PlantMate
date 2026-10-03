// 演示模式：打开后，天气和照片识别都使用预先准备好的数据，不需要联网。

function isDemo() {
  return !!loadData().settings.demo;
}

// 演示天气：根据日期算出一组固定的“秋天天气”，每次结果都一样
function demoWeather(pastDays) {
  const days = {};
  const start = addDays(todayStr(), -Math.max(0, pastDays));
  const end = addDays(todayStr(), 2);
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const n = Number(d.slice(8, 10));
    const tmean = 20 + (n % 7);                 // 20–26℃
    days[d] = {
      tmean: tmean, tmax: tmean + 5, tmin: tmean - 5,
      hum: 45 + (n % 5) * 5,                    // 45–65%
      rain: n % 9 === 0 ? 8 : 0,                // 偶尔下雨
      code: n % 9 === 0 ? 61 : (n % 3 === 0 ? 2 : 0)
    };
  }
  // 明天特别热，用来演示温度提醒
  days[addDays(todayStr(), 1)].tmax = 32;
  return days;
}

// 演示照片识别的几种场景
const DEMO_SCENES = {
  wilt:    { name: '叶子有点蔫、少量发黄', obs: { quality: '清晰', leaf: '少量发黄', wilt: '轻度', tip: '无', pest: '无', leggy: '无', soil: '湿' } },
  healthy: { name: '健康',                 obs: { quality: '清晰', leaf: '正常',     wilt: '无',   tip: '无', pest: '无', leggy: '无', soil: '干' } },
  pest:    { name: '叶片有斑点',           obs: { quality: '清晰', leaf: '少量发黄', wilt: '无',   tip: '无', pest: '有', leggy: '无', soil: '看不清' } },
  leggy:   { name: '茎细长（徒长）',       obs: { quality: '清晰', leaf: '正常',     wilt: '无',   tip: '无', pest: '无', leggy: '疑似', soil: '干' } },
  blurry:  { name: '照片太暗',             obs: { quality: '模糊或太暗', leaf: '看不清', wilt: '看不清', tip: '看不清', pest: '看不清', leggy: '看不清', soil: '看不清' } }
};

function demoVision(scene) {
  return new Promise(resolve => {
    setTimeout(() => resolve(Object.assign({}, DEMO_SCENES[scene].obs)), 900);   // 假装在识别
  });
}

// 演示用的示意图（没有真实照片时显示）
function demoPicture(scene) {
  const droop = scene === 'wilt';
  const leaf = droop ? '#b9b25a' : '#4f8a3c';
  const stem = scene === 'leggy' ? 150 : 90;
  const leaves = droop
    ? '<path d="M120 ' + (190 - stem) + ' q-40 30 -50 70" stroke="' + leaf + '" stroke-width="14" fill="none" stroke-linecap="round"/>' +
      '<path d="M120 ' + (190 - stem) + ' q40 30 50 70" stroke="' + leaf + '" stroke-width="14" fill="none" stroke-linecap="round"/>'
    : '<ellipse cx="90" cy="' + (195 - stem) + '" rx="32" ry="14" fill="' + leaf + '" transform="rotate(-25 90 ' + (195 - stem) + ')"/>' +
      '<ellipse cx="150" cy="' + (195 - stem) + '" rx="32" ry="14" fill="' + leaf + '" transform="rotate(25 150 ' + (195 - stem) + ')"/>';
  const spots = scene === 'pest' ? '<circle cx="85" cy="' + (192 - stem) + '" r="4" fill="#5a3a1a"/><circle cx="155" cy="' + (190 - stem) + '" r="4" fill="#5a3a1a"/>' : '';
  const dark = scene === 'blurry' ? '<rect width="240" height="240" fill="#000" opacity="0.6"/>' : '';
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="#eef4ea"/>' +
    '<line x1="120" y1="190" x2="120" y2="' + (190 - stem) + '" stroke="#3d6b32" stroke-width="6"/>' + leaves + spots +
    '<path d="M70 185 h100 l-12 45 h-76 z" fill="#b5764a"/><rect x="64" y="180" width="112" height="12" rx="4" fill="#8f5a36"/>' + dark + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
