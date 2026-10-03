// 综合判断（判断层）：把水分余额、照片观察结果、光照、温度放在一起，按规则给出建议。
// 三条原则：1. 谁看得见，听谁的；2. 两者一致，结论更可靠；3. 两者矛盾，选更安全的做法。

const LEVEL_ORDER = { danger: 0, warn: 1, info: 2, ok: 3 };

// 照片里和水分有关的症状：sick 萎蔫或发黄 / none 无症状 / unknown 没拍照或看不清
function symptomOf(obs) {
  if (!obs || (obs.wilt === '看不清' && obs.leaf === '看不清')) return 'unknown';
  const sick = obs.wilt === '轻度' || obs.wilt === '明显' || obs.leaf === '少量发黄' || obs.leaf === '大面积发黄';
  return sick ? 'sick' : 'none';
}

// 第一步：3×3 水分判断表
function judgeWater(plant, obs, p, weather) {
  const st = waterStatus(plant, p);
  const level3 = st.code === 'low' || st.code === 'empty' ? 'low' : (st.code === 'full' ? 'high' : 'normal');
  const sym = symptomOf(obs);
  const pct = Math.round(plant.balance) + '%';
  const when = daysText(daysToWater(plant, weather, p));
  const rule = { low: '余额低', normal: '余额正常', high: '余额高' }[level3] + ' + ' +
               { sick: '萎蔫或发黄', none: '照片无症状', unknown: '没有照片' }[sym];

  if (level3 === 'low') {
    if (st.code === 'empty' || sym === 'sick')
      return { level: 'danger', title: '缺水，立即浇透', rule: rule,
        detail: sym === 'sick' ? '水分只有' + pct + '，叶子也有点蔫或发黄，两个信息一致，说明缺水。' : '水分已经降到0%，植物喝不到水了。',
        steps: ['马上浇透，浇到盆底有水流出'] };
    return { level: 'warn', title: '今天该浇水了', rule: rule, detail: '水分' + pct + '，低于提醒线。', steps: ['今天浇透'] };
  }
  if (level3 === 'normal') {
    if (sym === 'sick')
      return { level: 'warn', title: '不确定，请测一下土', rule: rule,
        detail: '水分推算是' + pct + '，但叶子有点蔫或发黄。', steps: ['用手指插进土里2到3厘米感觉干湿', '点“我摸了一下土”校正后再决定'] };
    return { level: 'ok', title: sym === 'none' ? '状态良好' : '正常', rule: rule, detail: '水分' + pct + '，' + when + '。', steps: [] };
  }
  if (sym === 'sick')
    return { level: 'warn', title: '可能浇水过多', rule: rule,
      detail: '水分还有' + pct + '，叶子却有点蔫或发黄。土里的水很多却还蔫，问题可能不是缺水，再浇水会让根更难受。',
      steps: ['先暂停浇水，等水分降到提醒线再浇', '检查盆底排水孔有没有堵住', '两三天后再拍照看看'] };
  return { level: 'ok', title: '水分充足，不用浇', rule: rule, detail: '水分' + pct + '，' + when + '。', steps: [] };
}

// 第二步：独立的检查，有问题就追加一条
function judgeExtras(plant, obs, p, days) {
  const sp = p.plants[plant.species];
  const out = [];
  const dim = plant.bright === 'lt3' && plant.sun === 'none';

  if (obs && obs.pest === '有')
    out.push({ level: 'danger', title: '可能有病虫害', detail: '照片里看到斑点、霉斑或虫子。', steps: ['和其他植物隔开', '仔细检查叶子背面'], rule: '照片：斑点或虫子' });

  if (obs && obs.tip === '有' && sp.noSun && plant.sun === 's3')
    out.push({ level: 'warn', title: '可能晒伤', detail: sp.name + '怕暴晒，每天直射超过3小时，叶尖已经焦枯。', steps: ['移到散射光的地方'], rule: '叶尖焦枯 + 怕暴晒 + 直射时间长' });
  else if (sp.noSun && plant.sun === 's3')
    out.push({ level: 'warn', title: '小心晒伤', detail: sp.name + '怕暴晒，每天直射超过3小时。', steps: ['移到散射光的地方'], rule: '怕暴晒 + 直射时间长' });

  if (obs && obs.leggy === '疑似' && dim)
    out.push({ level: 'warn', title: '光照不够', detail: '茎细长、叶子稀疏，光照时间也短。', steps: ['移到更亮的位置'], rule: '徒长 + 光照不足' });
  else if (sp.likeLight && dim)
    out.push({ level: 'warn', title: '光照可能不足', detail: sp.name + '喜欢光，现在每天明亮光照少于3小时。', steps: ['移到更亮的位置'], rule: '喜光植物 + 光照不足' });

  if (days) {
    const list = [['今天', todayStr()], ['明天', addDays(todayStr(), 1)]];
    for (const [label, d] of list) {
      const w = days[d];
      if (!w) continue;
      if (w.tmin < sp.tmin) {
        out.push({ level: 'warn', title: label + '最低' + Math.round(w.tmin) + '℃，注意防寒', detail: sp.name + '适宜温度不低于' + sp.tmin + '℃。',
          steps: [plant.env === 'outdoor' ? '搬进室内' : '离开窗边，放到暖和的地方'], rule: '预报低于适宜温度' });
        break;
      }
      if (w.tmax > sp.tmax && plant.sun !== 'none') {
        out.push({ level: 'warn', title: label + '最高' + Math.round(w.tmax) + '℃，注意遮阴', detail: sp.name + '适宜温度不高于' + sp.tmax + '℃，又有阳光直射。',
          steps: ['中午挪到阴凉处或拉上纱帘'], rule: '预报高于适宜温度 + 有直射' });
        break;
      }
    }
  }

  // 照片反过来检查水分模型（表土总比下层先干，所以“土表干”只在余额很高时才检查）
  if (obs && plant.balance >= p.fullLine && obs.soil === '干')
    out.push({ level: 'info', title: '推算可能不准，请测一下土', detail: '推算水分很多，照片里的土却是干的。', steps: ['点“我摸了一下土”校正'], rule: '余额高 + 土表干' });
  if (obs && plant.balance < sp.line && obs.soil === '湿')
    out.push({ level: 'info', title: '推算可能不准，请测一下土', detail: '推算水分不多，照片里的土却是湿的。', steps: ['点“我摸了一下土”校正'], rule: '余额低 + 土表湿' });

  if (plant.needCalib)
    out.push({ level: 'info', title: '很久没更新了，请测一下土', detail: '超过30天没有打开，水分推算误差会很大。', steps: ['点“我摸了一下土”重新开始'], rule: '超过30天未更新' });
  return out;
}

// 完整判断：返回按紧急程度排好的建议列表；照片太差时只提示重拍
function judgePlant(plant, obs, p, days) {
  if (obs && obs.quality !== '清晰')
    return [{ level: 'info', title: '请重新拍照', detail: '照片太暗、太模糊或看不到植物，无法判断。', steps: ['白天在自然光下重拍'], rule: '照片质量差' }];
  const today = days ? days[todayStr()] : null;
  const list = [judgeWater(plant, obs, p, today)].concat(judgeExtras(plant, obs, p, days));
  return list.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

// 最近3天内的诊断结果，用于首页和详情页
function recentObs(plant) {
  const d = plant.lastDiag;
  if (!d) return null;
  return daysBetween(d.date, todayStr()) <= 3 ? d.obs : null;
}
