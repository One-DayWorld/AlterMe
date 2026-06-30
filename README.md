<div align="center">

# 🪞 AlterMe

### Your own AI companion — with a personality, a memory of *you*, and your keys never leaving the phone.

**[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)**

![Platform](https://img.shields.io/badge/platform-Android%20%7C%20HarmonyOS%204.2-3DDC84)
![Stack](https://img.shields.io/badge/stack-Capacitor%20%2B%20vanilla%20JS-blue)
![Models](https://img.shields.io/badge/models-Qwen%20%7C%20DeepSeek-7C3AED)
![No backend](https://img.shields.io/badge/backend-none%20·%20100%25%20on--device-success)
![License](https://img.shields.io/badge/license-MIT-black)

*A pocket AI friend that role-plays the personality you give it, quietly learns who you are, and runs entirely on your device. No server. No tracking. Bring your own API key.*

⭐ **If this resonates, a star helps a lot — it's how others find the project.** ⭐

</div>

---

## ✨ Why AlterMe?

Most AI chat apps are a thin skin over someone else's server — your messages and keys pass through *their* backend. **AlterMe has no backend at all.** It's a pure on-device WebView that talks directly to the model API with *your* key. What it remembers about you stays on your phone.

It's also tiny and hackable: ~6 small JS files, no framework, no build pipeline. Read the whole brain in ten minutes.

## 🎯 Features

- 🎭 **Custom persona** — Write one paragraph and it *becomes* that character: tone, how it refers to itself, how it calls you. Cold queen, cheerful sidekick, terse senpai — your call. Yet when you ask "what model are you?" it answers honestly (no fake "I'm GPT").
- 🧠 **Real memory** — It quietly distills a profile of you from your conversations, and you can **feed it articles** (paste a link or the text) to shape what it understands about your interests.
- 💞 **Bond & levels** — Your relationship gains XP and levels up the more you talk. Small touch, surprisingly sticky.
- 🔀 **Two models, one tap** — Qwen-Plus (Alibaba) and DeepSeek, both OpenAI-compatible. Switch anytime.
- 🔒 **Privacy by architecture** — API key is stored locally only; nothing is uploaded to any server of ours (there isn't one). Wipe all memory with one button.
- 📱 **Runs where Google can't** — Pure WebView, zero Google Mobile Services dependency, so it installs cleanly on Huawei / HarmonyOS 4.2 as a normal APK.
- 🪶 **Hackable by design** — Static HTML/CSS/JS, no toolchain. Open `www/` and start editing.

## 📸 Screenshots

> _Add a couple of screenshots or a GIF here — it's the single biggest driver of stars._
>
> | Chat | Persona | Memory |
> |:---:|:---:|:---:|
> | _(screenshot)_ | _(screenshot)_ | _(screenshot)_ |

## 🚀 Quick Start

### Try it in your browser (dev)

`www/` is a plain static site:

```bash
cd www
python3 -m http.server 8080
# open http://localhost:8080
```

> In a desktop browser, direct calls to the model may hit CORS — that's a dev-only quirk. On the phone it routes through CapacitorHttp and works fine.

### Build the APK (Android / HarmonyOS)

Requires **Node + Android Studio + Android SDK**.

```bash
npm install
npx cap add android      # first time only
npx cap sync
npx cap open android     # opens Android Studio → Build → Build APK(s)
```

The APK lands in `android/app/build/outputs/apk/`. Copy it to your phone, allow "install from unknown sources", and tap to install. No Google services needed.

## 📖 Usage

1. Open the app → **⚙ Settings** → pick a model (Qwen / DeepSeek) and paste its **API key** (stored locally, never uploaded).
2. Just chat. After a few turns it starts distilling a profile of you in the background.
3. **Persona** — write a personality and it instantly talks that way. Leave it blank for a warm, neutral friend.
4. **Memory** — see what it remembers (and delete anything). **Feed articles** by link or pasted text to shape its sense of your interests.

> 🔑 You need your own API key from [Alibaba DashScope (Qwen)](https://dashscope.console.aliyun.com/) or [DeepSeek](https://platform.deepseek.com/).

## 🗺️ Roadmap

- [ ] File import (docx / txt) for feeding articles
- [ ] More model providers (OpenAI / Anthropic / local)
- [ ] Optional relay backend for safer key handling when distributing
- [ ] Voice in / out

## 🤝 Contributing

Issues and PRs welcome. The codebase is small on purpose — a great place to make your first open-source contribution.

If AlterMe is useful or just fun, **drop a ⭐ and follow along** — it genuinely helps.

## 📄 License

MIT — do what you like, no warranty.

---

<div align="center">
<sub>Built for people who want an AI that's <b>theirs</b>.</sub>
</div>
