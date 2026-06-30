<div align="center">

# 🪞 AlterMe

### 属于你自己的 AI 伙伴们 —— 按心情切换不同性格的角色，共享同一份对*你*的记忆，密钥永远不离开手机。

**[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)**

![Platform](https://img.shields.io/badge/平台-Android%20%7C%20鸿蒙%204.2-3DDC84)
![Stack](https://img.shields.io/badge/技术栈-Capacitor%20%2B%20原生%20JS-blue)
![Models](https://img.shields.io/badge/模型-千问%20%7C%20DeepSeek-7C3AED)
![No backend](https://img.shields.io/badge/后端-无%20·%20100%25%20本地-success)
![License](https://img.shields.io/badge/许可证-MIT-black)

*一口袋 AI 伙伴：每种心情配一个性格各异的角色，悄悄记住你是谁，全程跑在你自己的设备上。没有服务器，不做追踪，用你自己的 API Key。*

⭐ **如果这戳中了你，点个 Star 会很有帮助 —— 这是别人发现它的方式。** ⭐

</div>

---

## ✨ 为什么是 AlterMe？

市面上多数 AI 聊天 App 只是别人服务器外面套了层皮 —— 你的消息和密钥都要过**他们的**后端。**AlterMe 根本没有后端。** 它是一个纯本地 WebView，拿**你自己的**密钥直连模型接口。它记住的关于你的一切，都留在你手机里。

它还很小、很好改：约 6 个小 JS 文件，无框架、无构建流程，十分钟就能把整个"大脑"读完。

## 🎯 功能特性

- 🎭 **多个可切换角色** —— 不再只有一个人设：内置女王 / 树洞 / 玩伴 / 理性等模板，可自由增删改。每个角色有自己的人设、专属铁律、对话历史和羁绊等级，顶部一键切换，还能给角色设图片头像。你问"你是什么模型"时它仍如实回答，不会假装是 GPT。
- 🧠 **真正的记忆（跨角色共享）** —— 它从聊天里悄悄提炼一份对你的长期"画像"，所有角色共享这份"懂你"；也可以**喂文章**（贴链接或正文）塑造它对你兴趣的理解。
- 💞 **羁绊与等级（各角色独立）** —— 你和每个角色各自积累经验值、各自升级。小设计，却意外地让人想回来。
- 🔀 **双模型，一键切换** —— 通义千问 Qwen-Plus（阿里云）与 DeepSeek，均为 OpenAI 兼容接口，随时切。
- 🔒 **隐私写进架构** —— API Key 只存本地；不会上传到任何我们的服务器（压根没有）。一键清空全部记忆。
- 📱 **谷歌进不去的地方也能跑** —— 纯 WebView，零 GMS 依赖，能作为普通 APK 干净地装到华为 / 鸿蒙 4.2 上。
- 🪶 **天生易改** —— 纯 HTML/CSS/JS，无工具链。打开 `www/` 就能动手。

## 📸 截图

> _在这里放两张截图或一段 GIF —— 这是涨 Star 最有效的单一因素。_
>
> | 聊天 | 性格 | 记忆 |
> |:---:|:---:|:---:|
> | _(截图)_ | _(截图)_ | _(截图)_ |

## 🚀 快速开始

### 先在浏览器里跑（开发期）

`www/` 是纯静态页：

```bash
cd www
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> 桌面浏览器里直连模型可能遇到跨域 —— 这只是开发期现象。装到手机后走 CapacitorHttp，没有此问题。

### 打包 APK（Android / 鸿蒙）

需先装 **Node + Android Studio + Android SDK**。

```bash
npm install
npx cap add android      # 仅首次
npx cap sync
npx cap open android     # 打开 Android Studio → Build → Build APK(s)
```

产物在 `android/app/build/outputs/apk/`。传到手机 → 允许"安装未知应用" → 点击安装。华为无 GMS 不影响。

## 📖 用法

1. 打开 App → **⚙ 设置** → 选模型（千问 / DeepSeek），填对应 **API Key**（本地保存，不上传）。
2. 直接聊。聊到几轮后会在后台自动提炼对你的"画像"。
3. **角色** —— 在 设置 → 陪伴角色 里，用内置模板或新建你自己的角色：名字、emoji 或图片头像、人设、专属铁律。顶部随时切换角色，各自保留独立对话；点 **清屏** 只清当前屏、不删聊天历史。
4. **记忆** —— 查看它记住了什么（可逐条删），这份记忆由所有角色共享。**喂文章**：贴链接或正文，塑造它对你兴趣的理解。

> 🔑 你需要自备 API Key：[阿里云百炼（千问）](https://dashscope.console.aliyun.com/) 或 [DeepSeek](https://platform.deepseek.com/)。

## 🗺️ 路线图

- [ ] 按时间 / 场景自动切换角色
- [ ] 文件导入（docx / txt）喂文章
- [ ] 更多模型供应商（OpenAI / Anthropic / 本地模型）
- [ ] 可选中转后端，分发时更安全地处理密钥
- [ ] 语音输入 / 输出

## 🤝 参与贡献

欢迎 Issue 和 PR。代码刻意保持精简 —— 很适合作为你的第一个开源贡献。

如果 AlterMe 对你有用、或只是好玩，**点个 ⭐ 并关注一下** —— 这真的很有帮助。

## 📄 许可证

MIT —— 随便用，不附带任何担保。

---

<div align="center">
<sub>为想要一个<b>真正属于自己</b>的 AI 的人而做。</sub>
</div>
