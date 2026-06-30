// app.js — UI 接线(多角色版)
// 角色:currentRole 持有当前激活角色对象。对话历史/羁绊按角色,长期画像共享。

const $ = (id) => document.getElementById(id);

let provider = 'qwen';
let busy = false;
let currentRole = null;        // 当前激活角色对象
let editingRoleId = null;      // 角色编辑器:null=新建,否则=被编辑角色 id
let pendingAvatar = '';        // 编辑器里暂存的头像 dataURL('' 表示无图)

// ── 渲染消息 ── AI 气泡前带当前角色头像(图优先,emoji 兜底);me/sys 不带头像。
function addMsg(role, text, cls) {
  if (role === 'ai') {
    const row = document.createElement('div');
    row.className = 'airow';
    const av = document.createElement('div');
    av.className = 'avatar';
    if (currentRole && currentRole.avatar) {
      const im = document.createElement('img'); im.src = currentRole.avatar; av.appendChild(im);
    } else {
      av.textContent = (currentRole && currentRole.emoji) || '🙂';
    }
    const el = document.createElement('div');
    el.className = 'msg ' + (cls || 'ai');
    el.textContent = text;
    row.appendChild(av); row.appendChild(el);
    $('messages').appendChild(row);
    $('messages').scrollTop = $('messages').scrollHeight;
    return el;   // 返回气泡本体,沿用 typing.textContent 替换逻辑
  }
  const el = document.createElement('div');
  el.className = 'msg ' + (cls || role);
  el.textContent = text;
  $('messages').appendChild(el);
  $('messages').scrollTop = $('messages').scrollHeight;
  return el;
}

async function refreshBond() {
  const pet = await Store.getPet(currentRole.id);
  const prof = await Memory.loadProfile();
  const ac = prof.articleCount || 0;
  $('bond').textContent = `${currentRole.name} · 羁绊 Lv.${pet.level} · ${Store.bondTitle(pet.level)}` + (ac ? ` · 读过 ${ac} 篇` : '');
}

function clean(text) { return String(text || '').trim(); }

// ── 角色切换条 ──
async function renderRoleBar() {
  const roles = await Store.getRoles();
  const bar = $('rolebar'); bar.innerHTML = '';
  for (const r of roles) {
    const chip = document.createElement('button');
    chip.className = 'role-chip' + (r.id === currentRole.id ? ' active' : '');
    chip.title = r.name;
    if (r.avatar) { const im = document.createElement('img'); im.src = r.avatar; chip.appendChild(im); }
    else chip.textContent = r.emoji || '🙂';
    chip.onclick = () => switchRole(r.id);
    bar.appendChild(chip);
  }
  const add = document.createElement('button');
  add.className = 'role-chip add'; add.textContent = '＋'; add.title = '管理角色';
  add.onclick = () => $('open-settings').click();
  bar.appendChild(add);
}

async function switchRole(id) {
  if (busy) return;
  const roles = await Store.getRoles();
  const r = roles.find(x => x.id === id);
  if (!r) return;
  await Store.setActiveRoleId(id);
  currentRole = r;
  await loadMessagesForRole();
  await renderRoleBar();
  await refreshBond();
}

async function loadMessagesForRole() {
  $('messages').innerHTML = '';
  const history = await Store.getHistory(currentRole.id);
  if (!history.length) addMsg('sys', `「${currentRole.name}」在这儿。聊几句,我会慢慢记住你。`, 'sys');
  else history.forEach(m => addMsg(m.role === 'user' ? 'me' : 'ai', m.content));
}

// ── 发送消息(按当前角色) ──
async function send() {
  if (busy) return;
  const input = $('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const apiKey = await Store.getApiKey(provider);
  if (!apiKey) { addMsg('sys', `请先在「设置」里填 ${Brain.MODEL_DISPLAY[provider]} 的 API Key`, 'sys'); return; }

  busy = true; $('send-btn').disabled = true;
  input.value = ''; input.style.height = 'auto';
  addMsg('me', message);
  const typing = addMsg('ai', '正在思考…', 'ai typing');

  try {
    const history = await Store.getHistory(currentRole.id);
    const persona = currentRole.persona || '';
    const rules = currentRole.rules || '';
    const pet = await Store.getPet(currentRole.id);
    const profile = await Memory.loadProfile();
    const profileInject = Brain.buildProfileInject(profile, pet.level || 1, !!persona);
    const systemPrompt = Brain.buildSystemPrompt(provider, persona, profileInject, rules);

    const reply = clean(await Brain.callModel(provider, apiKey, systemPrompt, history, message));
    typing.classList.remove('typing'); typing.textContent = reply || '（没有内容）';

    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });
    await Store.saveHistory(currentRole.id, history);

    Memory.pushTurn(message, reply);
    await Store.addXP(8);                 // 记给当前激活角色
    await refreshBond();
    if (Memory.bufferFull()) {
      Memory.runRefine(provider, apiKey).then(r => { if (r.changed) refreshBond(); }).catch(() => {});
    }
  } catch (e) {
    typing.classList.remove('typing');
    typing.textContent = '出错了：' + (e.message || '请检查 API Key 或网络');
  } finally {
    busy = false; $('send-btn').disabled = false;
  }
}

// ── 记忆面板 ──
const MEM_GROUPS = [
  { key: 'facts',        title: '关于你的事实' },
  { key: 'interests',    title: '兴趣领域' },
  { key: 'toneContract', title: '语气契约（该怎么和你说话）' },
];

async function renderMemory() {
  const prof = await Memory.loadProfile();
  let html = '';
  for (const g of MEM_GROUPS) {
    const arr = Array.isArray(prof[g.key]) ? prof[g.key] : [];
    html += `<div class="mem-title">${g.title}</div>`;
    html += arr.length
      ? arr.map((it, i) => `<div class="mem-item"><span>${escapeHtml(String(it))}</span><button data-k="${g.key}" data-i="${i}">✕</button></div>`).join('')
      : `<div class="mem-empty">（暂无）</div>`;
  }
  const cs = prof.commStyle || {};
  const bits = [];
  if (cs.length) bits.push('详略: ' + cs.length);
  if (cs.tone)   bits.push('语气: ' + cs.tone);
  if (cs.emoji === true) bits.push('可用 emoji'); else if (cs.emoji === false) bits.push('不用 emoji');
  if ((cs.dislikes || []).length) bits.push('反感: ' + cs.dislikes.join('、'));
  html += `<div class="mem-title">沟通偏好（自动总结）</div>`;
  html += bits.length ? `<div class="mem-empty">${escapeHtml(bits.join(' · '))}</div>` : `<div class="mem-empty">（还在观察中）</div>`;
  $('memory-body').innerHTML = html;

  $('memory-body').querySelectorAll('button[data-k]').forEach(btn => {
    btn.onclick = async () => {
      const k = btn.dataset.k, i = +btn.dataset.i;
      const p = await Memory.loadProfile();
      if (Array.isArray(p[k])) { p[k].splice(i, 1); await Memory.saveProfile(p); renderMemory(); }
    };
  });
}

function escapeHtml(s) { return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function flash(id) { const el = $(id); if (!el) return; el.style.display = 'inline'; setTimeout(() => { el.style.display = 'none'; }, 1800); }

// ── 角色管理 ──
async function renderRoleList() {
  const roles = await Store.getRoles();
  const box = $('role-list'); box.innerHTML = '';
  roles.forEach(r => {
    const item = document.createElement('div'); item.className = 'role-list-item';
    const av = document.createElement('div'); av.className = 'ravatar';
    if (r.avatar) { const im = document.createElement('img'); im.src = r.avatar; av.appendChild(im); }
    else av.textContent = r.emoji || '🙂';
    const name = document.createElement('div'); name.className = 'rname';
    name.textContent = r.name + (r.id === currentRole.id ? ' · 当前' : '');
    const edit = document.createElement('button'); edit.className = 'btn ghost'; edit.textContent = '编辑'; edit.onclick = () => openRoleEditor(r);
    const del = document.createElement('button'); del.className = 'btn danger'; del.textContent = '删除'; del.onclick = () => removeRole(r.id);
    item.append(av, name, edit, del);
    box.appendChild(item);
  });
}

function renderAvatarPreview() {
  const box = $('role-avatar-preview'); box.innerHTML = '';
  if (pendingAvatar) {
    const im = document.createElement('img'); im.src = pendingAvatar;
    im.style.cssText = 'width:48px;height:48px;border-radius:50%;object-fit:cover;vertical-align:middle';
    box.appendChild(im);
    const clr = document.createElement('button'); clr.className = 'btn ghost'; clr.textContent = '移除图片';
    clr.style.marginLeft = '8px';
    clr.onclick = () => { pendingAvatar = ''; $('role-avatar-file').value = ''; renderAvatarPreview(); };
    box.appendChild(clr);
  } else {
    box.textContent = '（无图片头像,将用 emoji）';
  }
}

function openRoleEditor(role) {
  editingRoleId = role ? role.id : null;
  pendingAvatar = role ? (role.avatar || '') : '';
  $('role-editor-title').textContent = role ? `编辑「${role.name}」` : '新建角色';
  $('role-name').value = role ? role.name : '';
  $('role-emoji').value = role ? (role.emoji || '') : '';
  $('role-persona').value = role ? (role.persona || '') : '';
  $('role-rules').value = role ? (role.rules || '') : '';
  renderAvatarPreview();
  $('role-editor').style.display = 'block';
  $('role-editor').scrollIntoView({ behavior: 'smooth' });
}

async function saveRoleFromEditor() {
  const name = $('role-name').value.trim();
  if (!name) { alert('请填角色名字'); return; }
  const roles = await Store.getRoles();
  let role;
  if (editingRoleId) {
    role = roles.find(r => r.id === editingRoleId);
    if (!role) return;
  } else {
    role = { id: 'r' + Date.now().toString(36), name: '', emoji: '', avatar: '', persona: '', rules: '' };
  }
  role.name = name;
  role.emoji = $('role-emoji').value.trim();
  role.avatar = pendingAvatar;
  role.persona = $('role-persona').value.trim();
  role.rules = $('role-rules').value.trim();
  await Store.upsertRole(role);
  if (currentRole.id === role.id) currentRole = role;   // 编辑的是当前角色 → 更新内存
  $('role-editor').style.display = 'none';
  editingRoleId = null; pendingAvatar = '';
  flash('role-ok');
  await renderRoleList(); await renderRoleBar(); await refreshBond();
}

async function removeRole(id) {
  const roles = await Store.getRoles();
  if (roles.length <= 1) { alert('至少保留一个角色'); return; }
  if (!confirm('删除这个角色?它的对话历史和羁绊会一并删除(长期画像不受影响)。')) return;
  const wasActive = currentRole.id === id;
  await Store.deleteRole(id);
  if (wasActive) {
    const left = await Store.getRoles();
    currentRole = left[0];
    await Store.setActiveRoleId(currentRole.id);
    await loadMessagesForRole();
  }
  await renderRoleList(); await renderRoleBar(); await refreshBond();
}

// 头像上传:读图 → canvas 居中裁剪缩到 128×128 → JPEG dataURL,控制体积
function onAvatarFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      const s = Math.min(img.width, img.height);
      const sx = (img.width - s) / 2, sy = (img.height - s) / 2;
      ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      pendingAvatar = canvas.toDataURL('image/jpeg', 0.8);
      renderAvatarPreview();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

// ── 设置:模型/Key ──
async function loadKeyField() {
  $('provider').value = provider;
  $('api-key').value = await Store.getApiKey(provider);
  $('key-hint').textContent = `填入 ${Brain.MODEL_DISPLAY[provider]} 的 API Key（本地保存，不上传）。`;
}

// ── 喂文章 ──
async function feed(getContent, label) {
  const apiKey = await Store.getApiKey(provider);
  if (!apiKey) { $('feed-status').textContent = '请先填 API Key'; return; }
  $('feed-status').textContent = '处理中…';
  try {
    const { title, text } = await getContent();
    const r = await Memory.ingestArticle(provider, apiKey, title, text);
    if (!r.ok) { $('feed-status').textContent = '失败：' + r.error; return; }
    $('feed-status').textContent = r.changed ? `已从${label}更新了对你的理解` : `已记下${label}（无新增）`;
    flash('feed-ok'); await refreshBond(); await renderMemory();
  } catch (e) { $('feed-status').textContent = '失败：' + (e.message || ''); }
}

// ── 初始化 ──
async function init() {
  provider = await Store.getProvider();
  const roles = await Store.getRoles();                 // 触发首次迁移
  const activeId = await Store.getActiveRoleId();
  currentRole = roles.find(r => r.id === activeId) || roles[0];

  await renderRoleBar();
  await refreshBond();
  await loadMessagesForRole();

  // 输入框自适应高度 + 回车发送（Shift+Enter 换行）
  const input = $('chat-input');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $('send-btn').onclick = send;

  // 清屏:只清当前屏,不动历史
  $('clear-screen').onclick = () => { $('messages').innerHTML = ''; addMsg('sys', '（已清屏,聊天历史仍保留）', 'sys'); };

  // 设置开关
  $('open-settings').onclick = async () => { await loadKeyField(); await renderRoleList(); await renderMemory(); $('role-editor').style.display = 'none'; $('settings-overlay').classList.add('open'); };
  $('close-settings').onclick = () => $('settings-overlay').classList.remove('open');

  $('provider').onchange = async () => { provider = $('provider').value; await Store.setProvider(provider); await loadKeyField(); await refreshBond(); };
  $('save-key').onclick = async () => { await Store.setApiKey(provider, $('api-key').value.trim()); flash('key-ok'); };

  // 角色管理接线
  $('add-role').onclick = () => openRoleEditor(null);
  $('role-save').onclick = saveRoleFromEditor;
  $('role-cancel').onclick = () => { $('role-editor').style.display = 'none'; editingRoleId = null; pendingAvatar = ''; };
  $('role-avatar-file').onchange = onAvatarFile;

  // 喂文章
  $('feed-url').onclick = () => feed(async () => await Article.fetchUrl($('article-url').value.trim()), '链接');
  $('feed-text').onclick = () => feed(async () => {
    const t = $('article-text').value.trim();
    if (t.length < 80) throw new Error('正文太短（至少 80 字）');
    return { title: t.slice(0, 30), text: t };
  }, '正文');

  // 清空记忆(长期画像,与「清屏」不同)
  $('clear-memory').onclick = async () => {
    if ($('clear-memory').dataset.armed !== '1') { $('clear-memory').dataset.armed = '1'; $('clear-memory').textContent = '⚠ 再点一次确认清空'; setTimeout(() => { $('clear-memory').dataset.armed = '0'; $('clear-memory').textContent = '🗑 清空全部记忆'; }, 3000); return; }
    $('clear-memory').dataset.armed = '0'; $('clear-memory').textContent = '🗑 清空全部记忆';
    await Memory.clearProfile(); flash('clear-ok'); await renderMemory(); await refreshBond();
  };

  // ── 备份 / 恢复 ──
  $('export-mem').onclick = async () => {
    $('backup-box').value = JSON.stringify(await Store.exportAll());
    $('backup-status').textContent = '已生成备份，点「复制」保存到安全的地方。';
  };
  $('copy-backup').onclick = async () => {
    const t = $('backup-box').value.trim();
    if (!t) { $('backup-status').textContent = '先点「导出到下框」生成备份'; return; }
    try { await navigator.clipboard.writeText(t); }
    catch { $('backup-box').select(); document.execCommand('copy'); }
    flash('backup-ok'); $('backup-status').textContent = '已复制到剪贴板，妥善保存。';
  };
  $('import-mem').onclick = async () => {
    const t = $('backup-box').value.trim();
    if (!t) { $('backup-status').textContent = '请先把备份 JSON 粘到上面的框里'; return; }
    if ($('import-mem').dataset.armed !== '1') {
      $('import-mem').dataset.armed = '1'; $('import-mem').textContent = '⚠ 再点确认（覆盖当前）';
      setTimeout(() => { $('import-mem').dataset.armed = '0'; $('import-mem').textContent = '导入'; }, 3000); return;
    }
    $('import-mem').dataset.armed = '0'; $('import-mem').textContent = '导入';
    try {
      const n = await Store.importAll(JSON.parse(t));
      provider = await Store.getProvider();
      const roles2 = await Store.getRoles();
      const activeId2 = await Store.getActiveRoleId();
      currentRole = roles2.find(r => r.id === activeId2) || roles2[0];
      await renderRoleBar();
      await loadMessagesForRole();
      await loadKeyField(); await renderRoleList(); await renderMemory(); await refreshBond();
      flash('backup-ok'); $('backup-status').textContent = `已恢复 ${n} 项并刷新。`;
    } catch (e) { $('backup-status').textContent = '导入失败：' + (e.message || 'JSON 格式不对'); }
  };
}

document.addEventListener('DOMContentLoaded', init);
