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
  if (isHydro(plant, p)) return judgeHydro(plant, obs, p);
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

// 水培植物：按换水天数 × 叶片症状判断
function judgeHydro(plant, obs, p) {
  const st = waterStatus(plant, p);
  const d = daysSinceChange(plant);
  const sick = symptomOf(obs) === 'sick';
  const rule = '水培：' + st.text + (sick ? ' + 萎蔫或发黄' : '');
  const root = ['看看根是不是发黑发软，有烂根就剪掉', '倒掉旧水，清洗容器，换上干净的水'];
  if (st.code === 'empty') return { level: 'danger', title: '很久没换水了，马上换水', rule: rule, detail: '已经' + d + '天没换水，水容易变质、根容易烂。', steps: root };
  if (st.code === 'low') {
    if (sick) return { level: 'danger', title: '该换水了，并检查根部', rule: rule, detail: d + '天没换水，叶子也有点蔫或发黄。', steps: root };
    return { level: 'warn', title: '该换水了', rule: rule, detail: '已经' + d + '天没换水，建议每' + p.hydroDays + '天换一次。', steps: ['倒掉旧水，换上干净的水', '水位不要淹没全部的根'] };
  }
  if (sick) return { level: 'warn', title: '叶子有点蔫或发黄，检查根部', rule: rule, detail: '换水时间还没到，但叶子状态不好，可能是烂根或水位太高。', steps: root };
  return { level: 'ok', title: '状态良好', rule: rule, detail: '距上次换水' + d + '天，' + nextText(plant, null, p) + '。', steps: [] };
}

// 用户确认“土壤表面干”时，按植物类型给出浇水建议（照片看得见土表，听照片的）
function judgeSoil(plant, obs, p, weather) {
  if (!obs || isHydro(plant, p) || (obs.soil !== '干' && obs.soil !== '很干')) return null;
  const sp = p.plants[plant.species];
  const very = obs.soil === '很干';
  const sick = symptomOf(obs) === 'sick';
  const rule = '用户确认：土表' + obs.soil + ' + ' + sp.type + '植物' + (sick ? ' + 萎蔫或发黄' : '');
  if (sp.type !== '耐旱' || very) {
    if (sick)
      return { level: 'danger', title: '缺水，立即浇透', rule: rule,
        detail: '照片里土' + (very ? '很干' : '是干的') + '，叶子也有点蔫或发黄，说明缺水。', steps: ['马上浇透，浇到盆底有水流出', '浇完点“我浇透了”'] };
    if (sp.type === '喜湿' || very)
      return { level: 'warn', title: (very ? '土很干' : '表土干了') + '，该浇水了', rule: rule,
        detail: sp.type === '耐旱' ? sp.name + '耐旱，但土已经很干了。' : (sp.type === '喜湿' ? sp.name + '喜欢湿润，表土干了就该浇水。' : '照片里的土已经很干了。'),
        steps: sp.type === '耐旱' ? ['手指插进土里，如果整盆都干透了就浇透', '浇完点“我浇透了”'] : ['今天浇透', '浇完点“我浇透了”'] };
    return { level: 'warn', title: '表土干了，可以浇水了', rule: rule,
      detail: sp.name + '适合表土干2到3厘米再浇。', steps: ['手指插进土里2到3厘米，如果也是干的就浇透', '浇完点“我浇透了”'] };
  }
  return { level: 'ok', title: '表土干了，但先不浇', rule: rule,
    detail: sp.name + '耐旱，要等整盆土干透再浇，' + daysText(daysToWater(plant, weather, p)) + '。', steps: [] };
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

  const heated = isHeated(plant, todayStr(), p);
  if (heated && sp.type === '喜湿')
    out.push({ level: 'info', title: '暖气房空气干燥', detail: sp.name + '喜欢湿润，暖气房里空气湿度低，叶子容易干尖。', steps: ['不要放在暖气片旁边', '可以在旁边放一盆水，或经常向周围喷水'], rule: '冬季供暖 + 喜湿植物' });
  if (days && !heated) {   // 供暖期的室内植物不受室外温度影响，不做防寒和遮阴提醒
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

  // 照片反过来检查水分模型（表土总比下层先干，所以“土表干”只在余额很高时才检查）；水培不检查
  const soilPlant = !isHydro(plant, p);
  if (soilPlant && obs && plant.balance >= p.fullLine && (obs.soil === '干' || obs.soil === '很干'))
    out.push({ level: 'info', title: '推算和照片对不上', detail: '程序算出来水分还很多，但照片里的土是干的。', steps: ['用手指插进土里2到3厘米摸一下', '点这个页面上的“我摸了一下土”按钮，按实际感觉选择'], rule: '余额高 + 土表干' });
  if (soilPlant && obs && plant.balance < sp.line && obs.soil === '湿')
    out.push({ level: 'info', title: '推算和照片对不上', detail: '程序算出来水分不多，但照片里的土是湿的。', steps: ['用手指插进土里2到3厘米摸一下', '点这个页面上的“我摸了一下土”按钮，按实际感觉选择'], rule: '余额低 + 土表湿' });

  if (soilPlant && plant.needCalib)
    out.push({ level: 'info', title: '很久没更新了，请测一下土', detail: '超过30天没有打开，水分推算误差会很大。', steps: ['点“我摸了一下土”重新开始'], rule: '超过30天未更新' });
  return out;
}

// 完整判断：返回按紧急程度排好的建议列表；照片太差时只提示重拍
function judgePlant(plant, obs, p, days) {
  if (obs && obs.quality !== '清晰')
    return [{ level: 'info', title: '请重新拍照', detail: '照片太暗、太模糊或看不到植物，无法判断。', steps: ['白天在自然光下重拍'], rule: '照片质量差' }];
  const today = days ? days[todayStr()] : null;
  let main = judgeWater(plant, obs, p, today);
  const soil = judgeSoil(plant, obs, p, today);
  // 用户确认的土表情况：比推算结论更紧急、或与“可能浇水过多”矛盾、或推算结论只是正常时，以照片为准
  if (soil && (LEVEL_ORDER[soil.level] < LEVEL_ORDER[main.level] || main.title === '可能浇水过多' || main.level === 'ok')) main = soil;
  const list = [main].concat(judgeExtras(plant, obs, p, days));
  return list.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}

// 最近3天内的诊断结果，用于首页和详情页；拍照后又浇水、测土或换水，照片就过时了，不再参考
function recentObs(plant) {
  const d = plant.lastDiag;
  if (!d || d.stale) return null;
  return daysBetween(d.date, todayStr()) <= 3 ? d.obs : null;
}
