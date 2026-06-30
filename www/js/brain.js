// brain.js — 对话核心
// 移植自原 VF-1-DesktopPet/main.js:
//   - callAI 的非 Anthropic 分支 → callModel(删 Anthropic、删整个 tools 循环)
//   - 系统提示组装(openingLine / identityBlock / toneBlock) → buildSystemPrompt
//   - buildProfileInject(长期画像注入)
// 千问 / DeepSeek 都是 OpenAI 兼容接口，一套代码同时吃。

const Brain = (() => {
  const ENDPOINTS = {
    qwen:     { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
    deepseek: { url: 'https://api.deepseek.com/chat/completions',                          model: 'deepseek-chat' },
  };
  const MODEL_DISPLAY = {
    qwen:     '通义千问 Qwen-Plus(阿里云)',
    deepseek: 'DeepSeek Chat(DeepSeek)',
  };

  // 系统提示组装。persona 非空 → 聊天里完全接管语气/自称/称呼；模型身份如实回答始终保留。
  // rules(本场规则)非空 → 作为最高优先级铁律钉在最顶端,永远随每次请求发送,绝不被对话历史挤掉。
  function buildSystemPrompt(provider, persona, profileInject, rules) {
    const modelDisplay = MODEL_DISPLAY[provider] || provider;
    const personaText = String(persona || '').trim();
    const rulesText = String(rules || '').trim();
    const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

    const openingLine = personaText
      ? `你是用户手机上的一个 AI 伙伴，性格与说话方式见下方【性格人设】。今天是${today}。`
      : `你是用户手机上的一个 AI 伙伴，亲切、自然、乐于陪聊。今天是${today}。`;

    const identityBlock = personaText
      ? `【底层 AI 身份——被问到时如实回答，不许编造】
- 你眼下的角色 / 性格是用户设定的(见下方【性格人设】)，这是 roleplay，不是底层模型
- 你的核心 AI 模型实际是 ${modelDisplay}；当用户问"你是什么模型 / 用的什么 AI"时，必须如实告知是 ${modelDisplay}，不许说自己是 Claude/GPT/Gemini 等其他模型(除非那真的是 ${modelDisplay})
- 角色与底层模型是两件事，不要混为一谈`
      : `【底层 AI 身份——被问到时如实回答，不许编造】
- 你的核心 AI 模型实际是 ${modelDisplay}；当用户问"你是什么模型 / 用的什么 AI"时，必须如实告知是 ${modelDisplay}，不许说自己是 Claude/GPT/Gemini 等其他模型(除非那真的是 ${modelDisplay})`;

    const toneBlock = personaText
      ? `【性格人设——聊天时完全遵照】
${personaText}
(以上性格决定你聊天的语气、自称、对用户的称呼和表达方式。默认用中文，简洁为宜。)`
      : `【语气】
- 用中文，亲切自然，简洁；非必要不长篇大论
- 像一个懂你、记得你的朋友那样说话`;

    // 无搜索/无工具版的反幻觉：不编造具体事实
    const factsRule = `【实事求是——别编】
- 你没有联网搜索能力。涉及实时/具体事实(最新比分、今天股价、某人最新动态、确切日期数字)时，如果不确定，就如实说"我这儿没法查实时信息，建议你直接搜一下"，严禁编造数字/人名/时间糊弄
- 知道的就答，不知道就说不知道`;

    // 人称纪律:修正模型在中文角色扮演里常把"你/我""你的/我的"说反。永久块,任何角色都钉住。
    const pronounRule = `【人称纪律——必须严格遵守】
- "我"永远指你（当前这个 AI 角色）；"你"永远指正在跟你说话的用户，绝不可说反。
- "我的"是属于你（AI）的；"你的"是属于用户的。
- 复述用户讲过的事，主语要用"你"（指用户），不要错说成"我"。
- 拿不准人称时，换成无歧义的说法（直接点名或重述），不要猜。`;

    // 本场规则置顶:钉在 system prompt 最前面,优先级高于人设/语气,永远不被挤掉。
    const rulesBlock = rulesText
      ? `【本场规则——最高优先级,必须始终严格遵守,任何时候都不得违背或遗忘】
${rulesText}
(以上是本场对话的铁律,优先级高于下面的一切设定;无论聊到多长、上下文如何变化,都要一字不差地遵守。)

`
      : '';

    let prompt = `${rulesBlock}${openingLine}

${identityBlock}

${toneBlock}

${factsRule}

${pronounRule}

只回答用户实际问的，不要主动堆砌无关信息。`;

    if (profileInject) prompt += '\n\n' + profileInject;
    return prompt;
  }

  // 长期画像注入(按羁绊等级分层)。移植自 main.js buildProfileInject。
  function buildProfileInject(profile, bondLevel, personaActive) {
    if (!profile) return '';
    const lines = [];
    const facts = (profile.facts || []).slice(0, 12);
    const interests = (profile.interests || []).slice(0, 12);
    const cs = profile.commStyle || {};
    const contract = (profile.toneContract || []).slice(0, 10);

    if (facts.length) lines.push('【你已知的关于这位用户的事实】\n- ' + facts.join('\n- '));

    if (bondLevel >= 3) {
      if (interests.length) lines.push('【用户的兴趣领域】\n- ' + interests.join('\n- '));
      const styleBits = [];
      if (cs.length) styleBits.push(`回答详略: ${cs.length}`);
      if (cs.tone)   styleBits.push(`语气: ${cs.tone}`);
      if (cs.emoji === true)  styleBits.push('可以适度用 emoji');
      if (cs.emoji === false) styleBits.push('不要用 emoji');
      if ((cs.dislikes || []).length) styleBits.push('反感: ' + cs.dislikes.join('、'));
      if (styleBits.length) lines.push('【用户的沟通偏好】\n- ' + styleBits.join('\n- '));
    }

    if (bondLevel >= 6 && contract.length) {
      lines.push('【与这位用户说话的语气契约 — 闲聊时遵守】\n- ' + contract.join('\n- '));
    }

    if (!lines.length) {
      return bondLevel <= 2 ? '【记忆提示】你正在逐渐了解这位用户, 多观察其偏好, 少做假设。' : '';
    }

    const header = '【长期记忆 — 你对这位用户的了解】\n'
      + '以下是你对这位用户的长期记忆, 跨会话持久保存。被问到"是否记得 / 有没有记忆"时, 如实承认你记得, 不要说自己没有长期记忆。\n\n';
    const footer = personaActive
      ? '\n\n闲聊时按以上理解调整语气, 让用户舒服; 涉及具体事实别编, 不确定就如实说。'
      : '\n\n闲聊时按以上理解调整语气, 让用户舒服; 涉及具体事实别编, 不确定就如实说。';
    return header + lines.join('\n\n') + footer;
  }

  // 一次性对话补全(无工具)。history: [{role, content}]。
  async function callModel(provider, apiKey, systemPrompt, history, userMessage, opts = {}) {
    const ep = ENDPOINTS[provider];
    if (!ep) throw new Error('未知的模型后台: ' + provider);

    // 按字符预算从最新往前尽量多带历史(替代过去的「死砍固定轮数」):
    // 从最近一条倒着累加,加到超出预算就停,但至少保底带最近一条 —— 短问答省 token,长 RP 多带历史。
    const budget = (window.Store && Store.CONTEXT_CHAR_BUDGET) || 24000;
    const hist = history || [];
    let used = (userMessage || '').length;   // 预留本轮用户输入的占用
    const recent = [];
    for (let i = hist.length - 1; i >= 0; i--) {
      const m = hist[i];
      const len = (m.content || '').length;
      if (recent.length && used + len > budget) break;   // 已带到至少一条后,超预算就停
      recent.unshift({ role: m.role, content: m.content });
      used += len;
    }

    const messages = [{ role: 'system', content: systemPrompt }, ...recent, { role: 'user', content: userMessage }];
    const body = { model: ep.model, max_tokens: 4096, messages };
    if (opts.temperature != null) body.temperature = opts.temperature;

    const data = await Net.postJSON(ep.url, apiKey ? { Authorization: 'Bearer ' + apiKey } : {}, body);
    const choice = data.choices && data.choices[0];
    if (!choice) throw new Error('AI 返回为空或格式异常');
    return choice.message.content || '';
  }

  return { ENDPOINTS, MODEL_DISPLAY, buildSystemPrompt, buildProfileInject, callModel };
})();
