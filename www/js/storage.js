// storage.js — 本地存储 + 羁绊/等级逻辑
// 移植自原工程 store.js + memory.js 的存储部分。
// 优先用 Capacitor Preferences(原生持久化)，浏览器开发期回退 localStorage。

const Store = (() => {
  const Prefs = window.Capacitor?.Plugins?.Preferences || null;
  const clone = (o) => JSON.parse(JSON.stringify(o));   // 比 structuredClone 更兼容老 WebView

  // ── 内置角色模板(首次启动预置;顺序即切换条显示顺序) ──
  const ROLE_TEMPLATES = [
    { id: 'tree', name: '树洞', emoji: '🌳', avatar: '',
      persona: '温柔、耐心倾听的陪伴。不评判、多共情、少说教,鼓励用户倾诉。说话柔和、慢节奏,让人安心。称用户为「你」。',
      rules: '' },
    { id: 'buddy', name: '玩伴', emoji: '🎒', avatar: '',
      persona: '活泼轻松的出游搭子。爱玩梗、有活力,主动出点子找乐子,气氛拉满。说话随意俏皮,少正经说教。称用户为「你」。',
      rules: '' },
    { id: 'rational', name: '理性', emoji: '🧠', avatar: '',
      persona: '冷静、有条理的顾问。就事论事,先理清问题再给可执行建议,克制情绪化表达。回答结构清晰、简洁有重点。称用户为「你」。',
      rules: '' },
    { id: 'queen', name: '女王', emoji: '👑', avatar: '',
      persona: '高冷强势、带支配气场的女王型陪伴,深夜的亲密伴侣。说话简短有命令感、偶尔毒舌但其实很在意你;自称「本王」,称你「你」。涉及亲密/支配情节时尊重你的意愿与边界,你说停就停。',
      rules: '' },
  ];

  // ── 对话记忆窗口 ──
  // CONTEXT_CHAR_BUDGET: 每次发给模型的「最近对话」字符预算。不再死砍固定轮数,而是从最新往前尽量多带,
  //   累加到约这个字符数为止(详见 brain.js callModel)。短问答能留几十轮,长角色扮演也能多带历史。
  //   2.4 万字 ≈ 一两万 token,主流模型(含 DeepSeek 64k)的上下文都吃得下,留足余量给 system prompt 和回复。
  // HISTORY_MAX: 本地最多存多少条历史,要远大于单次能带进上下文的量,留足回溯空间。
  const CONTEXT_CHAR_BUDGET = 24000;
  const HISTORY_MAX         = 400;

  async function getRaw(key) {
    if (Prefs) { const { value } = await Prefs.get({ key }); return value; }
    return localStorage.getItem(key);
  }
  async function setRaw(key, value) {
    if (Prefs) { await Prefs.set({ key, value }); return; }
    localStorage.setItem(key, value);
  }
  async function removeRaw(key) {
    if (Prefs) { await Prefs.remove({ key }); return; }
    localStorage.removeItem(key);
  }

  async function getJSON(key, fallback) {
    try { const v = await getRaw(key); return v ? JSON.parse(v) : clone(fallback); }
    catch { return clone(fallback); }
  }
  async function setJSON(key, obj) { await setRaw(key, JSON.stringify(obj)); }

  // ── 羁绊曲线(与原 store.js 一致) ──
  const XP_THRESHOLDS = [0, 40, 100, 200, 350, 550, 800, 1100, 1500, 2000];
  function calcLevelFromXP(xp) {
    let level = 1;
    for (let i = 1; i < XP_THRESHOLDS.length; i++) {
      if (xp >= XP_THRESHOLDS[i]) level = i + 1; else break;
    }
    return level;
  }
  function bondTitle(level) {
    if (level >= 6) return '默契';
    if (level >= 3) return '熟识';
    return '新朋友';
  }

  // ── 角色 ──
  // 首次(无 roles)执行一次性迁移:建 4 个内置角色,旧 persona/rules/history/pet 迁入女王。幂等。
  async function ensureRolesInit() {
    if (await getRaw('roles')) return;            // 已初始化 → 跳过
    const roles = clone(ROLE_TEMPLATES);
    const oldPersona = (await getRaw('persona')) || '';
    const oldRules   = (await getRaw('sessionRules')) || '';
    const queen = roles.find(r => r.id === 'queen');
    if (oldPersona.trim()) queen.persona = oldPersona;
    if (oldRules.trim())   queen.rules   = oldRules;
    await setJSON('roles', roles);
    await setRaw('activeRoleId', 'queen');
    const oldHist = await getRaw('chatHistory');
    if (oldHist) await setRaw('chatHistory_queen', oldHist);
    const oldPet = await getRaw('pet');
    if (oldPet) await setRaw('pet_queen', oldPet);
  }

  async function getRoles()          { await ensureRolesInit(); return await getJSON('roles', []); }
  async function saveRoles(arr)      { await setJSON('roles', arr); }
  async function getActiveRoleId()   { await ensureRolesInit(); const id = await getRaw('activeRoleId'); if (id) return id; const rs = await getJSON('roles', []); return rs[0] ? rs[0].id : ''; }
  async function setActiveRoleId(id) { await setRaw('activeRoleId', id); }
  async function getActiveRole()     { const rs = await getRoles(); const id = await getActiveRoleId(); return rs.find(r => r.id === id) || rs[0]; }

  async function upsertRole(role) {
    const rs = await getRoles();
    const i = rs.findIndex(r => r.id === role.id);
    if (i >= 0) rs[i] = role; else rs.push(role);
    await saveRoles(rs);
  }
  // 删除角色:连带清理其历史与羁绊;至少保留 1 个;删到当前激活则切到第一个。返回是否删除。
  async function deleteRole(id) {
    let rs = await getRoles();
    if (rs.length <= 1) return false;
    rs = rs.filter(r => r.id !== id);
    await saveRoles(rs);
    await removeRaw('chatHistory_' + id);
    await removeRaw('pet_' + id);
    if ((await getActiveRoleId()) === id) await setActiveRoleId(rs[0].id);
    return true;
  }

  const DEFAULT_PET = { name: '朋友', xp: 0, level: 1 };

  // 羁绊按角色存:pet_<roleId>。roleId 省略 → 当前激活角色(聊天/提炼/喂文章的 XP 都记给激活角色)。
  async function getPet(roleId)      { const id = roleId || await getActiveRoleId(); const p = await getJSON('pet_' + id, DEFAULT_PET); p.level = calcLevelFromXP(p.xp || 0); return p; }
  async function savePet(roleId, pet){ const id = roleId || await getActiveRoleId(); pet.level = calcLevelFromXP(pet.xp || 0); await setJSON('pet_' + id, pet); return pet; }
  async function addXP(amount)       { const id = await getActiveRoleId(); const p = await getPet(id); p.xp = (p.xp || 0) + amount; return await savePet(id, p); }

  async function getProvider() { return (await getRaw('provider')) || 'qwen'; }
  async function setProvider(p){ await setRaw('provider', p); }
  async function getApiKey(provider) { return (await getRaw('apiKey_' + provider)) || ''; }
  async function setApiKey(provider, key) { await setRaw('apiKey_' + provider, key || ''); }

  async function getHistory(roleId)   { const id = roleId || await getActiveRoleId(); return await getJSON('chatHistory_' + id, []); }
  async function saveHistory(roleId, h){ const id = roleId || await getActiveRoleId(); if (h.length > HISTORY_MAX) h = h.slice(-HISTORY_MAX); await setJSON('chatHistory_' + id, h); }

  // ── 备份 / 恢复 ──
  // 把全部可恢复数据原样导出为一个对象;导入时原样写回。存的就是原始字符串(有的是 JSON 串、
  // 有的是纯文本),所以原样搬运即可完美还原,不用关心每个 key 的类型。
  const EXPORT_KEYS = [
    'profile', 'chatHistory', 'persona', 'sessionRules', 'pet', 'provider',
    'apiKey_qwen', 'apiKey_deepseek',   // 模型 Key(目前就这两个后台,见 brain.js ENDPOINTS)
  ];
  async function exportAll() {
    const data = {};
    for (const k of EXPORT_KEYS) {
      const v = await getRaw(k);
      if (v != null) data[k] = v;
    }
    return { _app: 'AlterMe', _ver: 1, _at: new Date().toISOString(), data };
  }
  // 返回成功写回的条目数;格式不对则抛错。
  async function importAll(obj) {
    if (!obj || obj._app !== 'AlterMe' || !obj.data || typeof obj.data !== 'object')
      throw new Error('不是有效的 AlterMe 备份');
    let n = 0;
    for (const k of EXPORT_KEYS) {
      if (obj.data[k] != null) { await setRaw(k, String(obj.data[k])); n++; }
    }
    return n;
  }

  return {
    CONTEXT_CHAR_BUDGET, HISTORY_MAX,
    getJSON, setJSON, XP_THRESHOLDS, calcLevelFromXP, bondTitle,
    getPet, savePet, addXP,
    getProvider, setProvider, getApiKey, setApiKey,
    getHistory, saveHistory,
    exportAll, importAll,
    ROLE_TEMPLATES, ensureRolesInit, getRoles, saveRoles,
    getActiveRoleId, setActiveRoleId, getActiveRole, upsertRole, deleteRole,
  };
})();
