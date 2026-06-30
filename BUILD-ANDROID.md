# 打包 APK 装到华为(鸿蒙 4.2)— Android Studio 路线

工程已就绪(依赖已装、`android/` 原生工程已生成、联网与 CapacitorHttp 已配好)。
下面只剩"装工具链 → 构建 → 装机"。全程跟着点即可,不用懂安卓开发。

---

## 第 1 步:安装 Android Studio(自带 JDK + SDK + Gradle)

1. 打开官网下载(Apple 芯片选 **Mac with Apple chip**,Intel 选 Intel):
   https://developer.android.com/studio
2. 下载的 `.dmg` 双击 → 把 **Android Studio** 拖进"应用程序"。
3. 首次打开 → 选 **Standard** 标准安装 → 它会自动下载 Android SDK(约 1–2G,需联网,耐心等)。
4. 装完看到欢迎界面即可,先别管。

> 这一步把 JDK、Android SDK、Gradle 一次性都装好了,不用你单独装 Java。

## 第 2 步:打开本工程

终端里执行:

```bash
cd AlterMe        # 进入工程根目录
npx cap open android
```

这会用 Android Studio 打开 `android/` 工程。
(若提示找不到 Studio,手动打开 Studio → Open → 选工程下的 `android` 文件夹。)

## 第 3 步:等 Gradle Sync

- Studio 打开后右下角会跑 **Gradle Sync**(首次会下载 Gradle 和依赖,**需联网,可能几分钟到十几分钟**)。
- 进度条跑完、底部显示 `Sync finished` / 无红色报错,即可继续。

## 第 4 步:构建 APK

菜单栏:**Build → Build Bundle(s) / APK(s) → Build APK(s)**

- 构建完成右下角弹通知 **"APK(s) generated successfully"**,点 **locate** 打开产物目录。
- 产物路径:
  ```
  android/app/build/outputs/apk/debug/app-debug.apk
  ```

> 这是 **debug 版**,可直接安装自用,不需要签名/上架。

## 第 5 步:装到华为手机

1. 把 `app-debug.apk` 传到手机(微信文件传输助手 / 数据线 / 网盘均可)。
2. 手机用文件管理器点开这个 APK。
3. 首次会提示"禁止安装未知应用" → 去 **设置 → 允许该来源安装** → 返回再装。
4. 装好后桌面出现 **AlterMe** 图标。

## 第 6 步:首次使用

1. 打开 AlterMe → 右上 **⚙ 设置**。
2. 选模型(通义千问 / DeepSeek)→ 填对应 **API Key**(本地保存,不上传)→ 保存。
3. 返回开聊。多聊几句它会在后台提炼对你的画像。
4. **性格**:写一段人设,聊天立刻按它说话。
5. **喂文章**:贴链接或粘正文,塑造它对你兴趣的理解。

---

## 改了代码后怎么重新打包

以后你或我改了 `www/` 里的前端代码,只需:

```bash
cd AlterMe        # 进入工程根目录
npx cap sync android      # 把最新 www 同步进原生工程
```

然后回 Android Studio 重新 **Build → Build APK(s)** 即可。

## 常见卡点

- **Gradle Sync 卡住/失败**:基本都是网络问题(要下 Gradle 和依赖)。挂个稳定网络重试 **File → Sync Project with Gradle Files**。
- **`npx cap open android` 报找不到 Studio**:手动在 Studio 里 Open 那个 `android` 文件夹即可。
- **API 调不通**:确认 Key 填对、手机能上网;千问/DeepSeek 是国内服务,正常网络可直连。
