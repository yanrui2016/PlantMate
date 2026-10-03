// 界面小工具：导航栏、弹窗、提示、图标等，所有页面共用。

const ICONS = {
  leaf: '<path d="M12 21v-8"/><path d="M12 13c0-4 3-7 7-7 0 4-3 7-7 7z"/><path d="M12 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z"/>',
  drop: '<path d="M12 3s-6 7-6 11a6 6 0 0 0 12 0c0-4-6-11-6-11z"/>',
  hand: '<path d="M9 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M12 10V4a1.5 1.5 0 0 1 3 0v7"/><path d="M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a5 5 0 0 1-4-2l-3-4a1.5 1.5 0 0 1 2.3-1.9L9 15"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.2 5.2l1.8 1.8M17 17l1.8 1.8M5.2 18.8 7 17M17 7l1.8-1.8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};

function icon(name, size) {
  const s = size || 20;
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getQuery(name) {
  return new URLSearchParams(location.search).get(name);
}

// 顶部导航栏
function renderNav(active) {
  const demo = loadData().settings.demo ? '<span class="demo-badge">演示模式</span>' : '';
  document.getElementById('nav').innerHTML =
    '<a class="brand" href="index.html">' + icon('leaf', 26) + '<span>' + APP_NAME + '</span></a>' + demo +
    '<div class="nav-links">' +
    '<a href="index.html"' + (active === 'home' ? ' class="active" aria-current="page"' : '') + '>首页</a>' +
    '<a href="settings.html"' + (active === 'settings' ? ' class="active" aria-current="page"' : '') + '>设置</a></div>';
}

// 底部短暂提示
function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// 弹窗：buttons = [{ text, value, primary }]，返回用户点的 value
function dialog(title, bodyHtml, buttons) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'dialog-wrap';
    wrap.innerHTML = '<div class="dialog card" role="dialog" aria-modal="true" aria-labelledby="dlg-title">' +
      '<h2 id="dlg-title">' + esc(title) + '</h2><div class="dialog-body">' + bodyHtml + '</div>' +
      '<div class="btn-row">' + buttons.map((b, i) =>
        '<button type="button" class="btn ' + (b.primary ? 'btn-primary' : '') + '" data-i="' + i + '">' + esc(b.text) + '</button>').join('') +
      '</div></div>';
    document.body.appendChild(wrap);
    const close = v => { wrap.remove(); resolve(v); };
    wrap.querySelectorAll('button[data-i]').forEach(btn =>
      btn.addEventListener('click', () => close(buttons[Number(btn.dataset.i)].value)));
    wrap.addEventListener('click', e => { if (e.target === wrap) close(null); });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') close(null); });
    wrap.querySelector('button').focus();
  });
}

// 一条建议的HTML
function adviceHtml(a, showRule) {
  const steps = a.steps && a.steps.length ? '<ol class="steps">' + a.steps.map(s => '<li>' + esc(s) + '</li>').join('') + '</ol>' : '';
  const rule = showRule && a.rule ? '<p class="rule">用到的规则：' + esc(a.rule) + '</p>' : '';
  return '<div class="advice level-' + a.level + '"><h3>' + esc(a.title) + '</h3><p>' + esc(a.detail) + '</p>' + steps + rule + '</div>';
}

// 水分条
function waterBar(plant, p, big) {
  const line = p.plants[plant.species].line;
  return '<div class="wbar' + (big ? ' big' : '') + '" role="img" aria-label="水分' + Math.round(plant.balance) + '%，提醒线' + line + '%">' +
    '<div class="wfill" style="width:' + plant.balance + '%"></div><div class="wline" style="left:' + line + '%"></div></div>';
}

function statusChip(st) {
  return '<span class="chip-status st-' + st.code + '">' + st.text + '</span>';
}

// 植物头像：有照片就显示照片，没有就显示小嫩芽
function avatarHtml(plant, size) {
  const s = size || 48;
  if (plant.photo) return '<img class="avatar" src="' + plant.photo + '" alt="" width="' + s + '" height="' + s + '" style="width:' + s + 'px;height:' + s + 'px;object-fit:cover">';
  return '<span class="avatar" style="width:' + s + 'px;height:' + s + 'px">' + icon('leaf', Math.round(s * 0.55)) + '</span>';
}

// 把照片做成正方形小图（边长240像素），存进浏览器占用空间很小
function makeThumb(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = 240;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 240, 240);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('这个文件不是图片'));
    img.src = src;
  });
}

function plantDesc(plant, p) {
  return p.plants[plant.species].name + '，' + ENV_OPTIONS[plant.env] + '，' + p.soils[plant.soil].name;
}
