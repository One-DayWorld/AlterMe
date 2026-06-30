# 多类型陪伴 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AlterMe 从单一陪伴升级为多个可切换的陪伴角色,各自独立的人设/历史/羁绊,共享长期画像,并加图片头像、一键清屏、人称纪律修正。

**Architecture:** 纯前端 vanilla JS(IIFE 模块,无构建步骤)。新增「角色」为一等数据:`roles` 列表 + `activeRoleId`;对话历史与羁绊按 `chatHistory_<id>` / `pet_<id>` 分角色存;长期画像 `profile` 保持共享。首次启动一次性迁移旧数据进「女王」角色。

**Tech Stack:** HTML + CSS + 原生 JS;存储走 Capacitor Preferences(浏览器回退 localStorage);无测试框架,验证用 `npm run dev` 起本地服务器在浏览器手测。

**测试约定:** 本工程无 JS 测试框架,且用户选定浏览器手测。每个任务用 `npm run dev`(`cd www && python3 -m http.server 8080`)起服务,浏览器开 `http://localhost:8080`,DevTools 控制台跑断言或肉眼验收。`Store`/`Brain` 等模块在控制台全局可访问。

**参考规格:** `docs/superpowers/specs/2026-06-30-multi-role-companion-design.md`

---

### Task 1: storage.js — 角色模型 + 模板 + CRUD + 激活 + 迁移

**Files:**
- Modify: `www/js/storage.js`

- [ ] **Step 1: 在 `clone` 定义之后、`getRaw` 之前,加入角色模板常量**

在 `www/js/storage.js` 第 7 行 `const clone = ...` 那一行之后插入:

```js
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
```

- [ ] **Step 2: 加入 `removeRaw`(deleteRole 清理键要用)**

在 `setRaw` 函数(约第 21-24 行)之后插入:

```js
  async function removeRaw(key) {
    if (Prefs) { await Prefs.remove({ key }); return; }
    localStorage.removeItem(key);
  }
```

- [ ] **Step 3: 加入角色 CRUD + 迁移函数**

在 `bondTitle` 函数(约第 41-45 行)之后、`const DEFAULT_PET` 之前插入:

```js
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
```

- [ ] **Step 4: 把新函数加进末尾 `return { ... }` 导出**

把文件末尾 `return { ... }`(约第 95-102 行)替换为(本步只加角色相关,history/pet 在 Task 2 改):

```js
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
```

> 注意:此处已删去 `getPersona, setPersona, getRules, setRules`(改为角色内的字段,Task 7 不再调用它们)。其函数定义会在 Task 2 一并删除。

- [ ] **Step 5: 起服务并在控制台验证角色与迁移**

Run:
```bash
cd "/Users/ace/AI Folder/AlterMe" && npm run dev
```
浏览器打开 `http://localhost:8080`,DevTools 控制台执行:
```js
// (A) 全新用户:无旧数据
localStorage.clear(); location.reload();
// reload 后:
(await Store.getRoles()).map(r => r.id)   // 预期 ["tree","buddy","rational","queen"]
await Store.getActiveRoleId()             // 预期 "queen"

// (B) 老用户迁移:塞旧数据再 reload
localStorage.clear();
localStorage.setItem('persona', '测试旧人设');
localStorage.setItem('sessionRules', '旧铁律');
localStorage.setItem('chatHistory', JSON.stringify([{role:'user',content:'hi'},{role:'assistant',content:'yo'}]));
localStorage.setItem('pet', JSON.stringify({xp:120, level:1}));
location.reload();
// reload 后:
(await Store.getRoles()).find(r=>r.id==='queen').persona  // 预期 "测试旧人设"
(await Store.getRoles()).find(r=>r.id==='queen').rules     // 预期 "旧铁律"
JSON.parse(localStorage.getItem('chatHistory_queen')).length // 预期 2
JSON.parse(localStorage.getItem('pet_queen')).xp            // 预期 120
```
Expected: 各断言输出与"预期"一致。

- [ ] **Step 6: 提交**

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add www/js/storage.js
git commit -m "feat(storage): 角色模型/模板/CRUD + 旧数据迁入女王"
```

---

### Task 2: storage.js — 历史与羁绊按角色存,删除旧 persona/rules 访问器

**Files:**
- Modify: `www/js/storage.js`

- [ ] **Step 1: 改 `getPet` / `savePet` / `addXP` 为按角色(默认当前激活角色)**

把现有(约第 49-51 行):
```js
  async function getPet()      { const p = await getJSON('pet', DEFAULT_PET); p.level = calcLevelFromXP(p.xp || 0); return p; }
  async function savePet(pet)  { pet.level = calcLevelFromXP(pet.xp || 0); await setJSON('pet', pet); return pet; }
  async function addXP(amount) { const p = await getPet(); p.xp = (p.xp || 0) + amount; return await savePet(p); }
```
替换为:
```js
  // 羁绊按角色存:pet_<roleId>。roleId 省略 → 当前激活角色(聊天/提炼/喂文章的 XP 都记给激活角色)。
  async function getPet(roleId)      { const id = roleId || await getActiveRoleId(); const p = await getJSON('pet_' + id, DEFAULT_PET); p.level = calcLevelFromXP(p.xp || 0); return p; }
  async function savePet(roleId, pet){ const id = roleId || await getActiveRoleId(); pet.level = calcLevelFromXP(pet.xp || 0); await setJSON('pet_' + id, pet); return pet; }
  async function addXP(amount)       { const id = await getActiveRoleId(); const p = await getPet(id); p.xp = (p.xp || 0) + amount; return await savePet(id, p); }
```

- [ ] **Step 2: 改 `getHistory` / `saveHistory` 为按角色**

把现有(约第 66-67 行):
```js
  async function getHistory()  { return await getJSON('chatHistory', []); }
  async function saveHistory(h){ if (h.length > HISTORY_MAX) h = h.slice(-HISTORY_MAX); await setJSON('chatHistory', h); }
```
替换为:
```js
  async function getHistory(roleId)   { const id = roleId || await getActiveRoleId(); return await getJSON('chatHistory_' + id, []); }
  async function saveHistory(roleId, h){ const id = roleId || await getActiveRoleId(); if (h.length > HISTORY_MAX) h = h.slice(-HISTORY_MAX); await setJSON('chatHistory_' + id, h); }
```

- [ ] **Step 3: 删除旧 persona/rules 访问器**

删除现有(约第 58-64 行)这几段:
```js
  async function getPersona()  { return (await getRaw('persona')) || ''; }
  async function setPersona(t) { await setRaw('persona', String(t || '').trim().slice(0, 2000)); }

  async function getRules()  { return (await getRaw('sessionRules')) || ''; }
  async function setRules(t) { await setRaw('sessionRules', String(t || '').trim().slice(0, 1000)); }
```
(连同上方那段「本场规则」注释一并删除。)

- [ ] **Step 4: 控制台验证按角色读写**

Run: 服务若已停,`cd "/Users/ace/AI Folder/AlterMe" && npm run dev`;浏览器控制台:
```js
location.reload();
await Store.addXP(8);                          // 记给当前激活角色
(await Store.getPet()).xp                       // 预期比之前多 8(默认=激活角色)
await Store.saveHistory('tree', [{role:'user',content:'a'}]);
(await Store.getHistory('tree')).length         // 预期 1
(await Store.getHistory('buddy')).length        // 预期 0(各角色互不串台)
typeof Store.getPersona                          // 预期 "undefined"(已删除)
```
Expected: 各断言与"预期"一致。

- [ ] **Step 5: 提交**

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add www/js/storage.js
git commit -m "feat(storage): 历史与羁绊按角色存,移除全局 persona/rules 访问器"
```

---

### Task 3: storage.js — 备份/恢复改为动态键

**Files:**
- Modify: `www/js/storage.js`

- [ ] **Step 1: 替换 `EXPORT_KEYS` 注释段与 `exportAll` / `importAll`**

把现有(约第 69-93 行,从 `// ── 备份 / 恢复 ──` 注释到 `importAll` 结束)整段替换为:

```js
  // ── 备份 / 恢复 ──
  // 固定键 + 按 roles 动态拼出每个角色的 chatHistory_<id> / pet_<id>,全部原样搬运。
  async function exportAll() {
    const fixed = ['profile', 'provider', 'apiKey_qwen', 'apiKey_deepseek', 'roles', 'activeRoleId'];
    const roles = await getRoles();
    const dynamic = [];
    for (const r of roles) dynamic.push('chatHistory_' + r.id, 'pet_' + r.id);
    const data = {};
    for (const k of [...fixed, ...dynamic]) {
      const v = await getRaw(k);
      if (v != null) data[k] = v;
    }
    return { _app: 'AlterMe', _ver: 2, _at: new Date().toISOString(), data };
  }
  // 原样写回 data 里的所有键。兼容旧备份(_ver 1):旧备份无 roles,导入后下次 getRoles 触发迁移,
  // 把旧 persona/chatHistory/pet 自动并入女王。
  async function importAll(obj) {
    if (!obj || obj._app !== 'AlterMe' || !obj.data || typeof obj.data !== 'object')
      throw new Error('不是有效的 AlterMe 备份');
    let n = 0;
    for (const k of Object.keys(obj.data)) {
      if (obj.data[k] != null) { await setRaw(k, String(obj.data[k])); n++; }
    }
    return n;
  }
```

- [ ] **Step 2: 控制台验证导出/导入往返**

Run: 浏览器控制台:
```js
location.reload();
const bak = await Store.exportAll();
Object.keys(bak.data).filter(k => k.startsWith('chatHistory_')) // 预期含每个角色,如 chatHistory_tree...
bak._ver                                                         // 预期 2
const n = await Store.importAll(bak);                            // 不抛错
n > 0                                                            // 预期 true
```
Expected: 导出含各角色动态键、`_ver` 为 2、导入返回正整数且不报错。

- [ ] **Step 3: 提交**

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add www/js/storage.js
git commit -m "feat(storage): 备份/恢复动态纳入各角色历史与羁绊"
```

---

### Task 4: brain.js — 人称纪律永久块

**Files:**
- Modify: `www/js/brain.js`

- [ ] **Step 1: 在 `factsRule` 定义之后加入 `pronounRule`**

在 `www/js/brain.js` 的 `factsRule`(约第 47-49 行)那段之后插入:

```js
    // 人称纪律:修正模型在中文角色扮演里常把"你/我""你的/我的"说反。永久块,任何角色都钉住。
    const pronounRule = `【人称纪律——必须严格遵守】
- "我"永远指你(当前这个 AI 角色);"你"永远指正在跟你说话的用户,绝不可说反。
- "我的"是属于你(AI)的;"你的"是属于用户的。
- 复述用户讲过的事,主语要用"你"(指用户),不要错说成"我"。
- 每次回答前快速自检:人称有没有指对人。`;
```

- [ ] **Step 2: 把 `pronounRule` 拼进 prompt**

把现有(约第 60-68 行)的 prompt 拼接:
```js
    let prompt = `${rulesBlock}${openingLine}

${identityBlock}

${toneBlock}

${factsRule}

只回答用户实际问的，不要主动堆砌无关信息。`;
```
替换为:
```js
    let prompt = `${rulesBlock}${openingLine}

${identityBlock}

${toneBlock}

${factsRule}

${pronounRule}

只回答用户实际问的，不要主动堆砌无关信息。`;
```

- [ ] **Step 3: 控制台验证 prompt 含人称纪律**

Run: 浏览器控制台:
```js
Brain.buildSystemPrompt('qwen', '女王人设', '', '').includes('人称纪律')  // 预期 true
```
Expected: `true`。

- [ ] **Step 4: 提交**

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add www/js/brain.js
git commit -m "feat(brain): system prompt 加入人称纪律永久块"
```

---

### Task 5: index.html — 切换条 + 清屏按钮 + 角色管理区

**Files:**
- Modify: `www/index.html`

- [ ] **Step 1: 在顶栏与 `#messages` 之间插入角色切换条**

把现有(约第 10-17 行):
```html
  <div class="topbar">
    <span class="title">AlterMe</span>
    <span class="bond" id="bond">羁绊 Lv.1 · 新朋友</span>
    <span class="spacer"></span>
    <button class="icon-btn" id="open-settings">⚙ 设置</button>
  </div>

  <div id="messages"></div>
```
替换为:
```html
  <div class="topbar">
    <span class="title">AlterMe</span>
    <span class="bond" id="bond">羁绊 Lv.1 · 新朋友</span>
    <span class="spacer"></span>
    <button class="icon-btn" id="open-settings">⚙ 设置</button>
  </div>

  <div class="rolebar" id="rolebar"></div>

  <div id="messages"></div>
```

- [ ] **Step 2: 在输入栏加入「清屏」按钮**

把现有(约第 19-22 行):
```html
  <div class="inputbar">
    <textarea id="chat-input" rows="1" placeholder="说点什么…"></textarea>
    <button class="send-btn" id="send-btn">发送</button>
  </div>
```
替换为:
```html
  <div class="inputbar">
    <button class="clear-screen" id="clear-screen" title="只清当前屏,不删聊天历史">清屏</button>
    <textarea id="chat-input" rows="1" placeholder="说点什么…"></textarea>
    <button class="send-btn" id="send-btn">发送</button>
  </div>
```

- [ ] **Step 3: 用「角色管理 + 角色编辑」替换原「本场规则」「性格人设」两个 group**

把现有(约第 44-58 行)这两段 group:
```html
      <div class="group">
        <h3>本场规则（置顶 · 永不遗忘）</h3>
        <div class="note">为这场对话设几条硬性铁律。它会被钉在最顶端、随每条消息一起发送，优先级高于性格人设，无论聊多长都不会被挤掉、不会忘。建议简短（如：始终保持角色不跳戏 / 只用第二人称称呼我 / 不准说教）。</div>
        <textarea class="txt" id="rules" placeholder="例：① 全程保持角色，绝不跳戏或自称 AI；② 用『你』称呼我，自称『本王』；③ 回答简短，不说教。"></textarea>
        <button class="btn" id="save-rules">保存规则</button>
        <span class="ok" id="rules-ok">✓ 已保存</span>
      </div>

      <div class="group">
        <h3>性格人设</h3>
        <div class="note">写一段性格描述，聊天时它会完全照此说话（语气 / 自称 / 怎么称呼你）。留空＝中性亲切的朋友。模型身份如实回答、不编造事实不受影响。</div>
        <textarea class="txt" id="persona" placeholder="例：高冷女王风的女性 AI，说话简短克制，带点居高临下的慵懒，偶尔毒舌但其实在意你。自称『本王』，叫你『你』。"></textarea>
        <button class="btn" id="save-persona">保存性格</button>
        <span class="ok" id="persona-ok">✓ 已保存</span>
      </div>
```
替换为:
```html
      <div class="group">
        <h3>陪伴角色</h3>
        <div class="note">管理你的陪伴角色:编辑人设/专属铁律、设头像,或新建/删除。聊天页顶部可快速切换。专属铁律会钉在该角色对话最顶端、永不遗忘。</div>
        <div id="role-list"></div>
        <button class="btn ghost" id="add-role" style="margin-top:6px">＋ 新建角色</button>
      </div>

      <div class="group" id="role-editor" style="display:none">
        <h3 id="role-editor-title">编辑角色</h3>
        <label class="row">名字 <input class="txt" id="role-name" style="width:60%;margin:0" maxlength="12" placeholder="如 女王"></label>
        <label class="row">Emoji 头像 <input class="txt" id="role-emoji" style="width:60%;margin:0" maxlength="4" placeholder="如 👑"></label>
        <div class="note">图片头像(可选,优先于 emoji 显示):</div>
        <input type="file" id="role-avatar-file" accept="image/*">
        <div id="role-avatar-preview" class="note">（无图片头像,将用 emoji）</div>
        <div class="note" style="margin-top:10px">性格人设(聊天完全照此语气/自称/称呼):</div>
        <textarea class="txt" id="role-persona" placeholder="例：高冷女王风,说话简短克制,偶尔毒舌但其实在意你。自称『本王』,叫你『你』。"></textarea>
        <div class="note">专属铁律(可空):</div>
        <textarea class="txt" id="role-rules" placeholder="例：① 全程保持角色不跳戏；② 用『你』称呼我；③ 回答简短不说教。"></textarea>
        <button class="btn" id="role-save">保存角色</button>
        <button class="btn ghost" id="role-cancel">取消</button>
        <span class="ok" id="role-ok">✓ 已保存</span>
      </div>
```

- [ ] **Step 4: 肉眼验证页面结构(不报错)**

Run: 浏览器刷新 `http://localhost:8080`,DevTools 控制台:
```js
['rolebar','clear-screen','role-list','role-editor','role-name','role-avatar-file','add-role']
  .every(id => !!document.getElementById(id))   // 预期 true
document.getElementById('persona')               // 预期 null(旧元素已移除)
```
Expected: 第一行 `true`,第二行 `null`。(注:此时切换条还是空的、按钮未接线,Task 7 接线。)

- [ ] **Step 5: 提交**

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add www/index.html
git commit -m "feat(ui): 加角色切换条/清屏按钮/角色管理区,移除旧人设规则区"
```

---

### Task 6: style.css — 切换条 / 头像 / 清屏 / 角色管理样式

**Files:**
- Modify: `www/css/style.css`

- [ ] **Step 1: 在文件末尾追加样式**

在 `www/css/style.css` 末尾(第 91 行 `.mem-empty` 之后)追加:

```css
/* 角色切换条 */
.rolebar {
  display:flex; align-items:center; gap:8px; padding:8px 12px; overflow-x:auto;
  background:var(--panel); border-bottom:1px solid var(--line);
}
.role-chip {
  flex:0 0 auto; width:38px; height:38px; border-radius:50%; padding:0;
  border:2px solid transparent; background:var(--ai); color:var(--text);
  display:flex; align-items:center; justify-content:center; font-size:20px;
  cursor:pointer; overflow:hidden;
}
.role-chip img { width:100%; height:100%; object-fit:cover; }
.role-chip.active { border-color:var(--accent); }
.role-chip.add { border:1px dashed var(--line); color:var(--accent); font-size:22px; }

/* AI 头像 + 气泡行 */
.airow { display:flex; align-items:flex-end; gap:8px; align-self:flex-start; max-width:84%; }
.airow .avatar {
  flex:0 0 auto; width:30px; height:30px; border-radius:50%; background:var(--ai);
  display:flex; align-items:center; justify-content:center; font-size:17px; overflow:hidden;
}
.airow .avatar img { width:100%; height:100%; object-fit:cover; }
.airow .msg.ai { align-self:auto; max-width:100%; }

/* 清屏按钮 */
.clear-screen {
  flex:0 0 auto; background:none; border:1px solid var(--line); color:var(--muted);
  border-radius:10px; padding:0 12px; cursor:pointer; font-size:13px;
}

/* 角色管理列表 */
.role-list-item {
  display:flex; align-items:center; gap:10px; margin-bottom:8px; padding:8px 10px;
  background:rgba(0,18,40,.6); border:1px solid rgba(0,145,185,.18); border-radius:8px;
}
.role-list-item .ravatar {
  flex:0 0 auto; width:32px; height:32px; border-radius:50%; background:var(--ai);
  display:flex; align-items:center; justify-content:center; font-size:18px; overflow:hidden;
}
.role-list-item .ravatar img { width:100%; height:100%; object-fit:cover; }
.role-list-item .rname { flex:1; word-break:break-word; }
.role-list-item .btn { padding:6px 10px; font-size:13px; }
```

- [ ] **Step 2: 肉眼验证(切换条与清屏按钮就位)**

Run: 浏览器刷新。预期:顶栏下方出现一条空的横条(切换条容器,Task 7 才填内容)、输入框左侧出现「清屏」按钮、样式与整体深色风一致、无错位。
Expected: 布局正常,清屏按钮可见。

- [ ] **Step 3: 提交**

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add www/css/style.css
git commit -m "style: 切换条/AI头像/清屏/角色管理样式"
```

---

### Task 7: app.js — 角色状态、头像渲染、按角色对话、切换、清屏、角色管理、接线

**Files:**
- Modify: `www/js/app.js`

> 说明:app.js 仅 210 行且改动遍布全文,本任务整体重写。完成后 chat/切换/清屏/头像/角色管理全部可用。memory.js 无需改动(`Store.addXP(amount)` 现已默认记给激活角色)。

- [ ] **Step 1: 用下面的完整内容替换整个 `www/js/app.js`**

```js
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
```

- [ ] **Step 2: 浏览器手动验证核心交互(UI)**

Run: 浏览器刷新 `http://localhost:8080`,依次:
1. 顶部切换条显示 4 个头像(🌳🎒🧠👑)+ 末尾「＋」;当前(女王)高亮。
2. 点不同头像 → 高亮切换、消息区清空并显示该角色空提示、顶栏羁绊名字随之变化。
3. AI 气泡左侧显示当前角色 emoji 头像(发条消息看 typing 气泡也带头像;对话因 CORS 发不出属已知,看到「出错了」也算 UI 通)。
4. 点「清屏」→ 消息区清空并出现「已清屏…」;刷新页面后历史(若有)仍在。
5. 设置里「陪伴角色」列表显示 4 个;点「编辑」展开编辑器、字段回填;点「＋ 新建角色」字段为空。

Expected: 上述 1-5 全部表现正常。

- [ ] **Step 3: 浏览器验证头像上传与角色增删改**

Run: 在设置 → 陪伴角色:
1. 编辑「树洞」→ 选一张本地图片 → 预览出现圆形头像 → 保存 → 切换条与 AI 气泡处树洞头像变为该图片。
2. 新建一个角色(填名字+emoji+人设)→ 保存 → 切换条多出一个;切到它能聊(UI)。
3. 删除刚建的角色 → confirm 后消失;若删的是当前角色,自动切到第一个。
4. 控制台:`(await Store.getRoles()).find(r=>r.id==='tree').avatar.slice(0,11)` → 预期 `"data:image/"`。

Expected: 1-4 正常,头像以 dataURL 持久化。

- [ ] **Step 4: 提交**

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add www/js/app.js
git commit -m "feat(app): 多角色切换/按角色对话/图片头像/清屏/角色管理"
```

---

### Task 8: 全量验收 + 收尾

**Files:** 无(仅验证)

- [ ] **Step 1: 核对 memory.js 未受影响**

Run: 浏览器控制台:
```js
typeof Memory.runRefine === 'function' && typeof Memory.ingestArticle === 'function'   // 预期 true
```
说明:`Memory.runRefine` 内部 `Store.addXP(15)`、`ingestArticle` 内部 `Store.addXP(25)` 现都默认记给激活角色,无需改 memory.js。
Expected: `true`。

- [ ] **Step 2: 逐条跑 spec §13 验收要点**

在浏览器(`npm run dev`)逐条确认:
1. 老用户迁移(见 Task 1 Step 5 的 B 场景):旧人设/旧聊天进「女王」,记忆面板不丢。
2. 4 个角色间切换,各自历史互不串台(给 A 角色发消息后切 B,B 不含 A 的内容)。
3. 每个角色羁绊独立:`(await Store.getPet('tree')).xp` 与 `(await Store.getPet('queen')).xp` 互不影响。
4. AI 气泡显示对应角色头像(图优先、emoji 兜底)。
5. 清屏只清当前屏,刷新后历史还在。
6. (需真机/有 Key 时验证)切到任一角色问人称相关问题,"你/我"不再说反 —— 浏览器下至少确认 `Brain.buildSystemPrompt(...).includes('人称纪律')` 为 true。
7. 导出→清空→导入往返:角色、各自历史、各自羁绊、头像完整还原。
8. `npm run dev` 下 UI 全部可操作(对话因 CORS 不通,属已知限制)。

Expected: 1-8 通过(第 6 条对话部分留待真机)。

- [ ] **Step 3: 更新 spec 状态并提交**

把 `docs/superpowers/specs/2026-06-30-multi-role-companion-design.md` 第 4 行
`状态:已与用户确认设计,待评审后进入实现计划`
改为
`状态:已实现(2026-06-30)`

```bash
cd "/Users/ace/AI Folder/AlterMe"
git add docs/superpowers/specs/2026-06-30-multi-role-companion-design.md
git commit -m "docs: 标记多类型陪伴 spec 为已实现"
```

- [ ] **Step 4: 真机验证(可选,但建议)**

当你方便时,在真机或后续模拟器上 `npm run sync && npm run android` 打包,验证 spec §13 第 6 条:切到各角色聊几句,确认 AI 对话正常、人称不再说反、头像正确显示。

---

## 实现者备注

- **无测试框架是有意为之**:本工程为无构建的 vanilla JS,用户选定浏览器手测。验证靠 `npm run dev` + 控制台断言 + 肉眼,而非 Jest。
- **CORS 已知限制**:浏览器下 AI 对话发不出(千问/DeepSeek 不放行浏览器跨域),仅 UI 可测;真实对话需真机。这是设计决策,不是 bug。
- **画像共享、羁绊独立**:`profile` 单份共享;`pet_<id>` / `chatHistory_<id>` 按角色。`Store.addXP(amount)` 默认记给激活角色,故 memory.js 无需改。
- **PowerShell 红线无关**:本工程在 macOS/zsh 下开发,无相关风险。
```
