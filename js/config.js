// 参数配置：所有系数和植物习性的初始值都放在这里。
// 程序只读取这些数值，用户在“高级设置”里修改后，会优先使用修改后的值。

const APP_NAME = '植物养植助手';

const DEFAULT_PARAMS = {
  base: 15,          // 每天基础消耗（%）
  fullLine: 80,      // 余额达到这个值算“水分充足”
  rainMM: 5,         // 露天植物：当天降雨超过这个毫米数，水分加满
  littleWater: 30,   // “浇了一点”增加的水分（%）
  maxGapDays: 30,    // 超过这么多天没打开，就不补算，请用户测土
  hydroDays: 7,      // 水培植物建议几天换一次水
  heatTemp: 22,      // 冬季供暖时室内的温度（℃）
  heatHum: 30,       // 冬季供暖时室内的空气湿度（%）
  heatStart: '11-15', heatEnd: '03-15',   // 供暖期（月-日），默认按北京
  calib: { wet: 70, some: 40, dry: 10 },   // 测土校正：还很湿 / 有点干 / 很干

  // 植物习性表（初始值，需查证）
  // k：植物系数；line：提醒线（%）；tmin/tmax：适宜温度；likeLight：喜光；noSun：怕暴晒
  plants: {
    mint:      { name: '薄荷',   type: '喜湿', k: 1.2, line: 50, tmin: 15, tmax: 28, light: '喜光',     likeLight: true,  noSun: false },
    asparagus: { name: '文竹',   type: '喜湿', k: 1.2, line: 45, tmin: 15, tmax: 25, light: '半阴',     likeLight: false, noSun: true },
    pothos:    { name: '绿萝',   type: '中等', k: 1.0, line: 40, tmin: 18, tmax: 30, light: '散射光',   likeLight: false, noSun: true },
    spider:    { name: '吊兰',   type: '中等', k: 1.0, line: 35, tmin: 15, tmax: 25, light: '散射光',   likeLight: false, noSun: true },
    snake:     { name: '虎皮兰', type: '耐旱', k: 0.6, line: 15, tmin: 18, tmax: 30, light: '耐阴也耐晒', likeLight: false, noSun: false },
    aloe:      { name: '芦荟',   type: '耐旱', k: 0.6, line: 15, tmin: 15, tmax: 35, light: '喜光',     likeLight: true,  noSun: false },
    succulent: { name: '多肉',   type: '耐旱', k: 0.6, line: 10, tmin: 15, tmax: 28, light: '喜光',     likeLight: true,  noSun: false }
  },

  // 土壤参数
  soils: {
    nutrient: { name: '营养土',     k: 0.8 },
    garden:   { name: '普通园土',   k: 1.0 },
    grit:     { name: '多肉颗粒土', k: 1.5 },
    hydro:    { name: '水培',       k: null, hydro: true }   // 水培不算水分余额，改为提醒换水
  },

  // 温度系数：当日平均气温 低于15℃ / 15–25℃ / 25–30℃ / 高于30℃
  tempK: { cold: 0.75, mild: 1.0, warm: 1.2, hot: 1.35 },
  // 湿度系数：低于40% / 40–70% / 高于70%
  humK: { dry: 1.2, normal: 1.0, wet: 0.8 },
  // 光照系数
  lightK: { dim: 0.7, bright: 1.0, sun1: 1.15, sun3: 1.3 }
};

// 新品种按类型给出默认的植物系数和提醒线
const TYPE_DEFAULTS = { '喜湿': { k: 1.2, line: 50 }, '中等': { k: 1.0, line: 40 }, '耐旱': { k: 0.6, line: 15 } };
const LIGHT_NEEDS = ['喜光', '散射光', '半阴', '耐阴也耐晒'];

// 添加植物时的选项
const BRIGHT_OPTIONS = { lt3: '少于3小时', mid: '3到6小时', gt6: '6小时以上' };
const SUN_OPTIONS = { none: '没有', s1: '1到3小时', s3: '3小时以上' };
const ENV_OPTIONS = { indoor: '室内', outdoor: '露天' };
const HEAT_OPTIONS = { yes: '有暖气', no: '没有' };
// 冬季集中供暖的省份：选这些省份时，“冬季供暖”默认选“有暖气”
const NORTH_PROVINCES = ['北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省', '山东省', '河南省', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区', '西藏自治区'];

// 照片观察项（AI只能从这些选项里选）
const OBS_ITEMS = [
  { key: 'quality', name: '照片质量',   opts: ['清晰', '模糊或太暗', '看不到植物'] },
  { key: 'leaf',    name: '叶片颜色',   opts: ['正常', '少量发黄', '大面积发黄', '发黑或褐色', '看不清'] },
  { key: 'wilt',    name: '萎蔫',       opts: ['无', '轻度', '明显', '看不清'] },
  { key: 'tip',     name: '叶尖焦枯',   opts: ['无', '有', '看不清'] },
  { key: 'pest',    name: '斑点或虫子', opts: ['无', '有', '看不清'] },
  { key: 'leggy',   name: '徒长',       opts: ['无', '疑似', '看不清'] },
  { key: 'soil',    name: '土壤表面',   opts: ['很干', '干', '湿', '看不清'] }
];

// 视觉大模型
const AI_MODELS = { 'glm-4.6v-flash': 'GLM-4.6V-Flash（推荐）', 'glm-4v-flash': 'GLM-4V-Flash（备用）' };
const AI_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
