# AlterMe — 带性格与记忆的双模型聊天 App(华为/鸿蒙 4.2)

把 VF-1 桌宠里的「聊天 + 性格 + 记忆」抽出来，做成能装到华为手机(鸿蒙 4.2，安卓底，可装 APK)的独立 App。

- **不依赖** 原 `VF-1-DesktopPet` 工程，二者互不影响。
- **两个模型**：通义千问(qwen) / DeepSeek，均为 OpenAI 兼容接口，一套代码同时吃。
- **无工具调用**：去掉了实时搜索/开应用/文件管理等桌面工具，纯对话。
- **保留记忆**：① 从聊天自动提炼画像；② 喂文章(链接/粘贴正文)塑造兴趣。
- **保留性格**：自定义 persona，聊天里完全接管语气/自称/称呼。
- **无 Metaso**：核实过，聊天+性格+记忆都用不到 Metaso，故不装载。

---

## 一、目录结构

```
AlterMe/
  package.json              # Capacitor 依赖声明
  capacitor.config.json     # App id / 名称 / webDir
  www/                      # 纯前端，WebView 加载
    index.html              # 聊天界面 + 设置(性格/记忆/喂文章/API Key)
    css/style.css
    js/
      storage.js            # 本地存储(Capacitor Preferences，回退 localStorage)
      http.js               # 统一 HTTP(优先 CapacitorHttp，绕过跨域)
      brain.js              # 移植自 main.js: 系统提示组装 + persona + callModel
      memory.js             # 移植自 main.js/memory.js: 画像 + 提炼 + XP/羁绊
      article.js            # 喂文章: CapacitorHttp 抓正文 / 粘贴正文
      app.js                # UI 接线
  README.md                 # 本文件 = 迁移地图 + 上手步骤
```

## 二、从原工程移植了什么(对照表)

| 原 `VF-1-DesktopPet` | AlterMe 里的位置 | 改动 |
|---|---|---|
| `main.js` callAI 非 Anthropic 分支(~1915) | `js/brain.js` `callModel` | 删 Anthropic、删整个 tools 循环 |
| `main.js` 系统提示组装(openingLine/identityBlock/toneBlock，~1842) | `js/brain.js` `buildSystemPrompt` | 原样；反幻觉精简为「无搜索」版 |
| `main.js` `buildProfileInject`(~1989) | `js/brain.js` `buildProfileInject` | 原样 |
| `main.js` `refineProfile`(~2056) | `js/memory.js` `refineProfile` | 原样 |
| `main.js` `refineFromArticle`/`ingestArticle`(~2145) | `js/memory.js` 同名 | 原样 |
| `main.js` `commitRefinedProfile`(~2098) | `js/memory.js` 同名 | 原样 |
| `main.js` `fetchUrlText` 正则提正文(~2214) | `js/article.js` | curl → CapacitorHttp.get |
| `memory.js` profile load/save | `js/memory.js` + `js/storage.js` | 文件 → Preferences |
| `store.js` XP/等级(`XP_THRESHOLDS`/`calcLevelFromXP`) | `js/storage.js` | 原样 |
| `panel.html` 聊天 tab + persona 折叠 UI | `www/index.html` | 扒下来精简 |

## 三、本地先在浏览器里跑(开发期)

`www/` 是纯静态页，直接用任意静态服务器打开即可联调(浏览器里 CapacitorHttp 不可用，会回退到 `fetch`；直连模型可能遇到跨域，**仅开发期**，装到手机后走 CapacitorHttp 无此问题)：

```bash
cd "AlterMe/www"
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 四、打包成 APK 装到华为(鸿蒙 4.2)

需先装 **Node + Android Studio + Android SDK**。

```bash
cd AlterMe
npm install
npx cap init AlterMe com.alterme.app --web-dir=www   # 若 capacitor.config.json 已配好可跳过
npx cap add android
npx cap sync
npx cap open android        # 打开 Android Studio
# 在 Android Studio 里 Build → Build APK(s)，产物在 android/app/build/outputs/apk/
```

把 APK 传到手机 → 设置里允许「安装未知应用」→ 点击安装。华为无 GMS 不影响(纯 WebView，不依赖谷歌服务)。

## 五、用法

1. 首次打开 → 右上「设置」→ 选模型(千问/DeepSeek)、填对应 API Key。
2. 直接聊天。聊到一定轮次会自动在后台提炼对你的「画像」。
3. 「性格」里写一段人设，聊天立即按它说话。留空 = 中性助手。
4. 「记忆」里看它记住了什么，可删；「喂文章」贴链接或正文，塑造它对你兴趣的理解。

## 六、已知边界 / 下一步

- **文件导入(docx/txt)未做**：移动端 MVP 用「贴链接 + 粘贴正文」覆盖喂文章。要支持选文件，加 `@capacitor/filesystem` + 文件选择 + `mammoth.browser`(docx) 即可。
- **API Key 明文存本地**：个人自用可接受。要分发就得架中转后端。
- **OpenAI/Anthropic 未纳入**：按需求只保留国内可直连的千问/DeepSeek。
</content>
