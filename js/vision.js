// 照片识别：把照片交给智谱视觉大模型，让它像做选择题一样填写观察表。
// 三道保险：1. 提示词限定选项；2. 程序逐项检查答案；3. 用户确认（在拍照诊断页）。

// 压缩照片：长边不超过1024像素，减少等待时间
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('这个文件不是图片'));
    img.src = URL.createObjectURL(file);
  });
}

// 第一道保险：提示词
function obsItems(hydro) { return hydro ? OBS_ITEMS.filter(it => it.key !== 'soil') : OBS_ITEMS; }

function buildPrompt(plantName, hydro) {
  const lines = obsItems(hydro).map(it => '"' + it.name + '"：' + it.opts.join(' / '));
  return '你是一位植物观察员。这是一盆' + (hydro ? '水培的' : '') + plantName + '的照片。请仔细观察，只按下面的格式回答，' +
    '每一项只能从给出的选项中选择一个，看不清楚就选"看不清"。不要给出任何养护建议，不要写其他文字。\n' +
    '观察项和选项：\n' + lines.join('\n') + '\n' +
    '只输出一个JSON对象，例如：{"照片质量":"清晰","叶片颜色":"正常","萎蔫":"无","叶尖焦枯":"无","斑点或虫子":"无","徒长":"无"' + (hydro ? '' : ',"土壤表面":"干"') + '}';
}

// 第二道保险：逐项检查AI的答案
function checkAnswer(text, hydro) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;                  // 完全读不懂
  let raw;
  try { raw = JSON.parse(m[0]); } catch (e) { return null; }
  const obs = { soil: '看不清' }, fixed = [];   // 水培没有土，土壤表面固定为“看不清”
  obsItems(hydro).forEach(it => {
    const v = typeof raw[it.name] === 'string' ? raw[it.name].trim() : '';
    if (it.opts.indexOf(v) >= 0) obs[it.key] = v;
    else {
      obs[it.key] = it.key === 'quality' ? '模糊或太暗' : '看不清';
      fixed.push(it.name);
    }
  });
  return { obs: obs, fixed: fixed };
}

async function callZhipu(apiKey, model, content) {
  let res;
  try {
    res = await fetchWithTimeout(AI_URL, 60000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: model, messages: [{ role: 'user', content: content }], temperature: 0.1, max_tokens: 1024 })
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('AI识别超时，请稍后再试');
    throw new Error('浏览器无法连接智谱（可能是网络问题，或浏览器不允许直接调用）');
  }
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('密钥不正确，请到设置页检查');
  if (!res.ok) throw new Error('智谱返回错误：' + ((j.error && j.error.message) || res.status));
  return j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : '';
}

// 识别一张照片，返回 { obs, fixed }
async function analyzePhoto(dataUrl, plantName, settings, hydro) {
  if (!settings.apiKey) throw new Error('还没有填写智谱密钥，请到设置页填写');
  const text = { type: 'text', text: buildPrompt(plantName, hydro) };
  const pure = dataUrl.split(',')[1];
  // 先用完整的图片地址；如果接口不接受，再试只传 Base64
  const tries = [dataUrl, pure, dataUrl];
  let lastErr = null;
  for (const img of tries) {
    try {
      const answer = await callZhipu(settings.apiKey, settings.model, [{ type: 'image_url', image_url: { url: img } }, text]);
      const checked = checkAnswer(answer, hydro);
      if (checked) return checked;
      lastErr = new Error('AI的回答格式不对');
    } catch (e) {
      lastErr = e;
      if (/密钥|无法连接|超时/.test(e.message)) break;
    }
  }
  throw lastErr;
}

// 设置页的“测试AI连接”
async function testAI(apiKey, model) {
  const answer = await callZhipu(apiKey, model, [{ type: 'text', text: '请只回复两个字：连通' }]);
  return answer;
}

// ---------- AI 帮忙填写新品种的习性 ----------
// 只问园艺上通用的说法（类型、温度、光照），植物系数和提醒线由我们的规则按类型换算
function buildSpeciesPrompt(name) {
  return '你是一位园艺专家。请根据常见的家庭养护经验，判断盆栽植物"' + name + '"的习性。每一项只能从给出的选项中选择，不要写其他文字。\n' +
    '1. 类型（只能选一个）：喜湿＝需要保持土壤微湿，土稍干就要浇水；中等＝表层土干2到3厘米再浇水；耐旱＝等整盆土干透再浇水\n' +
    '2. 最低温度：最低适宜温度，一个整数（℃）\n3. 最高温度：最高适宜温度，一个整数（℃）\n' +
    '4. 光照需求（只能选一个）：' + LIGHT_NEEDS.join(' / ') + '\n5. 怕暴晒：是 / 否\n6. 依据：用一句话说明你的判断\n' +
    '如果你不确定这是什么植物，"类型"填"不认识"。\n' +
    '只输出一个JSON对象，例如：{"类型":"中等","最低温度":15,"最高温度":30,"光照需求":"散射光","怕暴晒":"是","依据":"……"}';
}

// 程序检查：不合格的项不采用，交给用户自己填
function checkSpecies(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let r;
  try { r = JSON.parse(m[0]); } catch (e) { return null; }
  if (r['类型'] === '不认识') return { unknown: true };
  const out = { fixed: [] };
  if (TYPE_DEFAULTS[r['类型']]) out.type = r['类型']; else out.fixed.push('类型');
  const lo = Number(r['最低温度']), hi = Number(r['最高温度']);
  if (isFinite(lo) && isFinite(hi) && lo >= -10 && hi <= 45 && lo < hi) { out.tmin = Math.round(lo); out.tmax = Math.round(hi); }
  else out.fixed.push('适宜温度');
  if (LIGHT_NEEDS.indexOf(r['光照需求']) >= 0) out.light = r['光照需求']; else out.fixed.push('光照需求');
  if (r['怕暴晒'] === '是' || r['怕暴晒'] === '否') out.noSun = r['怕暴晒'] === '是'; else out.fixed.push('怕暴晒');
  out.reason = typeof r['依据'] === 'string' ? r['依据'].slice(0, 80) : '';
  return out;
}

async function suggestSpecies(name, settings) {
  if (settings.demo) return demoSpecies(name);
  if (!settings.apiKey) throw new Error('还没有填写智谱密钥，请到设置页填写');
  for (let i = 0; i < 2; i++) {          // 回答格式不对时重试一次
    const answer = await callZhipu(settings.apiKey, settings.model, [{ type: 'text', text: buildSpeciesPrompt(name) }]);
    const r = checkSpecies(answer);
    if (r) return r;
  }
  throw new Error('AI的回答格式不对，请自己填写');
}
