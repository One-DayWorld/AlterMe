// storage.js — 本地存储 + 羁绊/等级逻辑
// 移植自原工程 store.js + memory.js 的存储部分。
// 优先用 Capacitor Preferences(原生持久化)，浏览器开发期回退 localStorage。

const Store = (() => {
  const Prefs = window.Capacitor?.Plugins?.Preferences || null;
  const clone = (o) => JSON.parse(JSON.stringify(o));   // 比 structuredClone 更兼容老 WebView

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

  const DEFAULT_PET = { name: '朋友', xp: 0, level: 1 };

  async function getPet()      { const p = await getJSON('pet', DEFAULT_PET); p.level = calcLevelFromXP(p.xp || 0); return p; }
  async function savePet(pet)  { pet.level = calcLevelFromXP(pet.xp || 0); await setJSON('pet', pet); return pet; }
  async function addXP(amount) { const p = await getPet(); p.xp = (p.xp || 0) + amount; return await savePet(p); }

  async function getProvider() { return (await getRaw('provider')) || 'qwen'; }
  async function setProvider(p){ await setRaw('provider', p); }
  async function getApiKey(provider) { return (await getRaw('apiKey_' + provider)) || ''; }
  async function setApiKey(provider, key) { await setRaw('apiKey_' + provider, key || ''); }

  async function getPersona()  { return (await getRaw('persona')) || ''; }
  async function setPersona(t) { await setRaw('persona', String(t || '').trim().slice(0, 2000)); }

  // 本场规则:用户为当前这场对话设的硬性铁律。钉在 system prompt 最顶端、永远随每次请求发送,
  // 绝不会被对话历史挤掉 —— 无论聊多长都不会忘规则。短小为宜。
  async function getRules()  { return (await getRaw('sessionRules')) || ''; }
  async function setRules(t) { await setRaw('sessionRules', String(t || '').trim().slice(0, 1000)); }

  async function getHistory()  { return await getJSON('chatHistory', []); }
  async function saveHistory(h){ if (h.length > HISTORY_MAX) h = h.slice(-HISTORY_MAX); await setJSON('chatHistory', h); }

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
    getPersona, setPersona, getRules, setRules, getHistory, saveHistory,
    exportAll, importAll,
  };
})();
