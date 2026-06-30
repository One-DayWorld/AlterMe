// app.js — UI 接线
// 对应原 main.js 的 ipcMain.handle('chat') 流程：组装画像注入 → callModel → 入历史 → 提炼缓冲 → 加羁绊。

const $ = (id) => document.getElementById(id);

let provider = 'qwen';
let busy = false;

// ── 渲染 ──
function addMsg(role, text, cls) {
  const el = document.createElement('div');
  el.className = 'msg ' + (cls || role);
  el.textContent = text;
  $('messages').appendChild(el);
  $('messages').scrollTop = $('messages').scrollHeight;
  return el;
}

async function refreshBond() {
  const pet = await Store.getPet();
  const prof = await Memory.loadProfile();
  const ac = prof.articleCount || 0;
  $('bond').textContent = `羁绊 Lv.${pet.level} · ${Store.bondTitle(pet.level)}` + (ac ? ` · 读过 ${ac} 篇` : '');
}

// 去掉模型偶尔输出的括号情绪描写（移植自原 stripBrackets 思路，可选）
function clean(text) { return String(text || '').trim(); }

// ── 发送消息（移植 chat 处理流程，去掉实时搜索/工具） ──
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
    const history = await Store.getHistory();
    const persona = await Store.getPersona();
    const rules = await Store.getRules();
    const pet = await Store.getPet();
    const profile = await Memory.loadProfile();
    const profileInject = Brain.buildProfileInject(profile, pet.level || 1, !!persona);
    const systemPrompt = Brain.buildSystemPrompt(provider, persona, profileInject, rules);

    const reply = clean(await Brain.callModel(provider, apiKey, systemPrompt, history, message));
    typing.classList.remove('typing'); typing.textContent = reply || '（没有内容）';

    // 入历史（与原版一样保留最近 40 条）
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: reply });
    await Store.saveHistory(history);

    // 提炼缓冲 + 羁绊（聊天 +8；提炼出新理解再 +15）
    Memory.pushTurn(message, reply);
    await Store.addXP(8);
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

// ── 设置：模型/Key/性格 ──
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
  await refreshBond();

  // 历史回填
  const history = await Store.getHistory();
  if (!history.length) addMsg('sys', '嗨，我是你的 AlterMe。聊几句，我会慢慢记住你。', 'sys');
  else history.forEach(m => addMsg(m.role === 'user' ? 'me' : 'ai', m.content));

  // 输入框自适应高度 + 回车发送（Shift+Enter 换行）
  const input = $('chat-input');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  $('send-btn').onclick = send;

  // 设置开关
  $('open-settings').onclick = async () => { await loadKeyField(); $('persona').value = await Store.getPersona(); $('rules').value = await Store.getRules(); await renderMemory(); $('settings-overlay').classList.add('open'); };
  $('close-settings').onclick = () => $('settings-overlay').classList.remove('open');

  $('provider').onchange = async () => { provider = $('provider').value; await Store.setProvider(provider); await loadKeyField(); await refreshBond(); };
  $('save-key').onclick = async () => { await Store.setApiKey(provider, $('api-key').value.trim()); flash('key-ok'); };
  $('save-persona').onclick = async () => { await Store.setPersona($('persona').value); $('persona').value = await Store.getPersona(); flash('persona-ok'); };
  $('save-rules').onclick = async () => { await Store.setRules($('rules').value); $('rules').value = await Store.getRules(); flash('rules-ok'); };

  $('feed-url').onclick = () => feed(async () => await Article.fetchUrl($('article-url').value.trim()), '链接');
  $('feed-text').onclick = () => feed(async () => {
    const t = $('article-text').value.trim();
    if (t.length < 80) throw new Error('正文太短（至少 80 字）');
    return { title: t.slice(0, 30), text: t };
  }, '正文');

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
    if ($('import-mem').dataset.armed !== '1') {   // 二次确认：导入会覆盖当前数据
      $('import-mem').dataset.armed = '1'; $('import-mem').textContent = '⚠ 再点确认（覆盖当前）';
      setTimeout(() => { $('import-mem').dataset.armed = '0'; $('import-mem').textContent = '导入'; }, 3000); return;
    }
    $('import-mem').dataset.armed = '0'; $('import-mem').textContent = '导入';
    try {
      const n = await Store.importAll(JSON.parse(t));
      // 用恢复后的数据刷新整个界面
      provider = await Store.getProvider();
      $('messages').innerHTML = '';
      const history = await Store.getHistory();
      if (!history.length) addMsg('sys', '（备份里没有对话历史）', 'sys');
      else history.forEach(m => addMsg(m.role === 'user' ? 'me' : 'ai', m.content));
      await loadKeyField(); $('persona').value = await Store.getPersona(); $('rules').value = await Store.getRules();
      await renderMemory(); await refreshBond();
      flash('backup-ok'); $('backup-status').textContent = `已恢复 ${n} 项并刷新。`;
    } catch (e) { $('backup-status').textContent = '导入失败：' + (e.message || 'JSON 格式不对'); }
  };
}

document.addEventListener('DOMContentLoaded', init);
