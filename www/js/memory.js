// memory.js — 长期画像 + 提炼 + 羁绊
// 移植自原 main.js(refineProfile / refineFromArticle / commitRefinedProfile / runRefine / ingestArticle)
// 与 memory.js(画像结构 / load / save)。存储改走 Store(Preferences)。

const Memory = (() => {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const DEFAULT_PROFILE = {
    facts: [], interests: [],
    commStyle: { length: '', tone: '', emoji: null, dislikes: [] },
    toneContract: [], articleCount: 0, updatedAt: '',
  };

  async function loadProfile() {
    const p = await Store.getJSON('profile', DEFAULT_PROFILE);
    p.commStyle = Object.assign({}, DEFAULT_PROFILE.commStyle, p.commStyle || {});
    return Object.assign({}, clone(DEFAULT_PROFILE), p);
  }
  async function saveProfile(profile) {
    profile.updatedAt = new Date().toISOString().slice(0, 10);
    await Store.setJSON('profile', profile);
  }
  async function clearProfile() { await saveProfile(clone(DEFAULT_PROFILE)); }

  // 合并提炼结果(移植 commitRefinedProfile)，返回是否真有变化。
  async function commitRefined(refined) {
    if (!refined) return false;
    const prof = await loadProfile();
    const before = JSON.stringify({ f: prof.facts, i: prof.interests, c: prof.commStyle, t: prof.toneContract });
    if (Array.isArray(refined.facts))     prof.facts = refined.facts.slice(0, 12);
    if (Array.isArray(refined.interests)) prof.interests = refined.interests.slice(0, 12);
    if (refined.commStyle && typeof refined.commStyle === 'object')
      prof.commStyle = Object.assign({}, prof.commStyle, refined.commStyle);
    if (Array.isArray(refined.toneContract)) prof.toneContract = refined.toneContract.slice(0, 10);
    const after = JSON.stringify({ f: prof.facts, i: prof.interests, c: prof.commStyle, t: prof.toneContract });
    await saveProfile(prof);
    return before !== after;
  }

  function parseProfileJSON(raw) {
    let txt = String(raw || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const s = txt.indexOf('{'), e = txt.lastIndexOf('}');
    if (s < 0 || e < 0) return null;
    try { const p = JSON.parse(txt.slice(s, e + 1)); return (p && typeof p === 'object') ? p : null; }
    catch { return null; }
  }

  // 从对话提炼(移植 refineProfile)
  async function refineFromChat(provider, apiKey, oldProfile, turns) {
    if (!apiKey || !turns || !turns.length) return null;
    const system = `你是一个"用户画像提炼器", 负责从对话里沉淀出对用户的长期理解。
输入: 一份旧画像(JSON) + 最近的对话记录。
输出: **只输出**一个更新后的画像 JSON 对象, 不要任何解释、不要 markdown 代码块。

画像 JSON 结构:
{
  "facts": [],
  "interests": [],
  "commStyle": { "length": "简短|适中|详细", "tone": "正式|随意|...", "emoji": true|false|null, "dislikes": [] },
  "toneContract": []
}

铁律:
- **只记真正稳定的**事实与偏好, 不要把一次性的提问内容当成长期事实; 不确定就不记。
- **保留**旧画像里仍然成立的条目, 增量补充新发现, 同类去重。
- 用户的**语气纠正/明确偏好**优先写进 toneContract。
- 数组各项简洁, 每类不超过 12 条; 控制总量, 宁缺毋滥。
- 严禁臆测用户没表达过的隐私(收入/健康/政治立场等)。`;
    const convo = turns.map(t => `[用户] ${t.user}\n[AI] ${t.reply}`).join('\n\n').slice(0, 8000);
    const userPrompt = `旧画像 JSON:\n${JSON.stringify(oldProfile || {}, null, 2)}\n\n最近对话:\n${convo}\n\n请输出更新后的画像 JSON。`;
    try {
      const raw = await Brain.callModel(provider, apiKey, system, [], userPrompt, { temperature: 0.3 });
      return parseProfileJSON(raw);
    } catch (e) { console.warn('[MEMORY] refineFromChat failed:', e.message); return null; }
  }

  // 从文章提炼(移植 refineFromArticle)
  async function refineFromArticle(provider, apiKey, oldProfile, title, text) {
    if (!apiKey || !text) return null;
    const system = `你是一个"用户画像提炼器"。输入: 一份旧画像(JSON) + 一篇**用户阅读过**的文章。
任务: 从这篇文章推断用户**关注/感兴趣的领域和话题**, 更新画像。

**只输出**更新后的画像 JSON 对象, 不要解释、不要 markdown 代码块。结构:
{
  "facts": [], "interests": [],
  "commStyle": { "length": "", "tone": "", "emoji": null, "dislikes": [] },
  "toneContract": []
}

铁律:
- 文章**内容/观点不等于用户的观点或事实**, 不要把文章里的主张写进 facts。
- 只从"用户选择读了这篇文章"这一行为, 谨慎推断其 **interests**(兴趣领域/关注话题)。
- **保留**旧画像所有仍成立的条目, 增量补充, 同类去重; interests 不超过 12 条。
- commStyle / toneContract 一般保持旧值不变。
- 拿不准就不加, 宁缺毋滥。`;
    const body = String(text).slice(0, 8000);
    const userPrompt = `旧画像 JSON:\n${JSON.stringify(oldProfile || {}, null, 2)}\n\n用户阅读的文章《${title || '无题'}》正文:\n${body}\n\n请输出更新后的画像 JSON。`;
    try {
      const raw = await Brain.callModel(provider, apiKey, system, [], userPrompt, { temperature: 0.3 });
      return parseProfileJSON(raw);
    } catch (e) { console.warn('[MEMORY] refineFromArticle failed:', e.message); return null; }
  }

  // ── 提炼缓冲: 聊够 N 轮触发后台提炼(移植 _turnsSinceRefine / runRefine) ──
  let _turns = [];
  let _inFlight = false;
  const REFINE_EVERY = 10;

  function pushTurn(user, reply) { _turns.push({ user, reply }); }
  function bufferFull() { return _turns.length >= REFINE_EVERY; }

  // reason: 'buffer-full' | 'manual'。返回 {changed}。
  async function runRefine(provider, apiKey) {
    if (_inFlight || !_turns.length) return { changed: false };
    _inFlight = true;
    const turns = _turns; _turns = [];
    try {
      const oldProfile = await loadProfile();
      const refined = await refineFromChat(provider, apiKey, oldProfile, turns);
      const changed = await commitRefined(refined);
      if (changed) await Store.addXP(15);
      return { changed };
    } catch (e) {
      _turns = turns.concat(_turns);   // 失败还回缓冲
      console.warn('[MEMORY] runRefine error:', e.message);
      return { changed: false, error: e.message };
    } finally { _inFlight = false; }
  }

  // 摄取一篇文章(移植 ingestArticle)。返回 {ok, changed}。
  async function ingestArticle(provider, apiKey, title, text) {
    if (!text || !text.trim()) return { ok: false, error: '文章内容为空' };
    if (!apiKey) return { ok: false, error: '请先在设置中填写 API Key' };
    try {
      const oldProfile = await loadProfile();
      const refined = await refineFromArticle(provider, apiKey, oldProfile, title, text);
      const changed = await commitRefined(refined);
      const prof = await loadProfile();
      prof.articleCount = (prof.articleCount || 0) + 1;
      await saveProfile(prof);
      await Store.addXP(25);
      return { ok: true, changed };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  return {
    DEFAULT_PROFILE, loadProfile, saveProfile, clearProfile, commitRefined,
    pushTurn, bufferFull, runRefine, ingestArticle,
  };
})();
