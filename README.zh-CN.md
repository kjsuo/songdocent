<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="SongDocent 图标" />
</p>

<h1 align="center">SongDocent</h1>

<p align="center">
  <strong>让听见的音乐，成为读懂的音乐。</strong><br />
  在桌面端阅读当前歌曲的歌词、AI 翻译和相关背景。
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kjsuo/songdocent/ci.yml?branch=main&amp;style=plastic&amp;label=build" alt="Build status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=plastic" alt="License: MIT" /></a>
  <a href="https://github.com/kjsuo/songdocent"><img src="https://img.shields.io/github/stars/kjsuo/songdocent?style=plastic" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/releases">下载</a> ·
  <a href="#getting-started">开始使用</a> ·
  <a href="#development">开发</a> ·
  <a href="https://github.com/kjsuo/songdocent/issues">报告问题</a>
</p>

<p align="center">
  macOS · Windows (Beta) &nbsp;|&nbsp; Tauri 2 · React · Rust &nbsp;|&nbsp; MIT
</p>

<p align="center">
  <a href="README.ko.md"><kbd>한국어</kbd></a>
  ·
  <a href="README.md"><kbd>English</kbd></a>
  ·
  <a href="README.ja.md"><kbd>日本語</kbd></a>
  ·
  <a href="README.es.md"><kbd>Español</kbd></a>
  ·
  <a href="README.fr.md"><kbd>Français</kbd></a>
  ·
  <a href="README.de.md"><kbd>Deutsch</kbd></a>
  ·
  <a href="README.pt-BR.md"><kbd>Português (Brasil)</kbd></a>
  ·
  <a href="README.zh-CN.md"><strong><kbd>简体中文</kbd></strong></a>
</p>

---

SongDocent 是你在 Spotify 和 Apple Music 上听歌时的私人音乐导赏。它会检测当前播放的歌曲，在同一屏幕上显示原文歌词和翻译。**AI Annotation** 会说明陌生人物或文化典故，你也可以直接选中想进一步了解的歌词，获取解释。

音乐由你平常使用的 Spotify 或 Apple Music 应用播放。SongDocent 会根据播放状态显示歌词，并提供翻译和解释。

## 介绍视频

https://github.com/user-attachments/assets/f8017c97-470a-4ff9-aa55-8ef45ebfbb02

[视频素材说明](docs/media/v7-credits.md)

## 截图

在同一屏幕上阅读 Spotify 或 Apple Music 当前歌曲的原文歌词、翻译，以及介绍文化背景的 AI 注释。

> [!WARNING]
> SongDocent 的歌词连接采用非官方访问方式，而非官方 API。SongDocent 并非 Spotify 或 Apple 的官方产品。服务变更可能导致功能停止工作，供应商的政策也可能导致账号受到使用限制或被停用。

![SongDocent 中播放 Creepy Nuts 的 Otonoke，同时显示日语歌词、英语翻译和 AI 注释](docs/screenshots/lyrics-translation.png)

### 歌词中的文化背景

AI 注释会显示在陌生表达的下方，让你在阅读歌词时了解相关背景。

![用英语 AI 注释说明日语表达 Kuwa-bara 的文化背景](docs/screenshots/ai-annotation.png)

### 直接选中想了解的歌词

拖动选中部分歌词后，会出现 **AI Annotation** 按钮。你可以请求解释选中的歌词。

![选中部分日语歌词后显示 AI Annotation 按钮](docs/screenshots/lyric-selection.png)

### 选择 AI 连接方式

在**设置 → AI** 中，选择 CLI、API 密钥或本地模型。在 CLI 标签页中，你可以检查已安装的工具、设置模型和网页搜索，并测试连接。

![AI 设置界面，显示 CLI、API 密钥和本地模型标签页，以及 Codex CLI 的模型选择和连接测试](docs/screenshots/ai-settings.png)

## 主要功能

| 功能 | 说明 |
| --- | --- |
| **检测当前播放的歌曲** | 获取 Spotify 和 Apple Music 桌面应用的歌曲信息、专辑封面和播放状态。 |
| **歌词同步** | 对于带有时间信息的歌词，高亮当前歌词并自动滚动。 |
| **AI 歌词翻译** | 同时阅读原文和翻译，并搜索、选择所需的翻译语言。 |
| **AI Annotation** | 为歌词中的专有名词和陌生文化典故添加简短背景说明。还可以调整注释密度。 |
| **解释选中的歌词** | 选中部分歌词，请求解释表达的细微含义、双关语和上下文。 |
| **选择 AI 连接方式** | 可以使用 CLI、API 密钥或本地 LLM。详情请参阅下方的[连接选项表](#ai-connection-options)。 |
| **搜索补充信息** | 在支持此功能的 API 和 CLI 连接中，可以设置在翻译或解释请求中使用网页搜索。 |
| **翻译缓存** | 根据歌曲和语言重新读取已保存的翻译。 |
| **应用内更新** | 在已配置更新的发行版中，可以在设置中检查并安装新版本。 |

应用界面支持韩语、英语、日语、西班牙语、法语、德语、巴西葡萄牙语和简体中文。**应用显示语言和歌词翻译语言可以分别设置。**

## 下载

请在 [GitHub Releases](https://github.com/kjsuo/songdocent/releases) 中查找适合你的操作系统和 CPU 的安装文件。如果尚未提供安装文件，可以[从源码运行](#development)。

| 环境 | 发布目标 | 安装格式 |
| --- | --- | --- |
| macOS · Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS · Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows · x64 (Beta) | `x86_64-pc-windows-msvc` | NSIS `.exe` 安装程序 |

**Windows 测试版：** Windows 版本尚未经过充分测试，部分功能可能无法正常运行。如遇问题，请向我们反馈。

当前发布配置在 macOS 上使用 ad-hoc 签名，不包含 Apple 公证。如果下载的应用被阻止，请先确认来源，再使用**系统设置 → 隐私与安全性 → 仍要打开**。Windows 安装程序也未进行代码签名。

<a id="getting-started"></a>

## 开始使用

1. **在 Spotify 或 Apple Music 桌面应用中播放歌曲。**
2. **打开 SongDocent，选择应用语言。**
3. **连接歌词供应商。** 选择 Spotify 或 Apple Music，并按照应用中的连接指引操作。身份验证会在单独的登录窗口中进行。如果无法自动连接，可以使用高级设置中的手动输入指引。
4. **配置 AI 供应商。** 在设置中选择 API 密钥、CLI 或本地模型。使用 CLI 时，先在终端安装并登录，再回到应用中重新扫描并测试连接。使用 API 时，输入你自己的密钥。使用本地模型时，指定 Ollama 或 LM Studio 的服务器地址和模型。
5. **选择翻译语言，完成设置。** 当歌曲和歌词显示后，执行**翻译**。选中想了解的歌词，即可请求解释。

API 和 CLI 的费用、使用限额及可用模型，取决于所选供应商、账号的身份验证方式和套餐。即使使用 CLI，请求仍会发送至该工具中配置的 AI 服务。本地模型的质量和速度取决于模型和电脑配置。

<a id="ai-connection-options"></a>

### AI 连接选项

| 连接方式 | 支持的工具和供应商 | 需要准备的内容 |
| --- | --- | --- |
| CLI | Codex CLI, Claude Code, Gemini CLI, Antigravity CLI, OpenCode | 电脑上已安装的 CLI，以及该工具的登录或供应商身份验证配置 |
| API 密钥 | Gemini, OpenAI, Claude | 你自己的 API 密钥和要使用的模型 |
| API 密钥 | OpenAI 兼容 API | 服务的基础 URL、模型名称，以及必要时的 API 密钥 |
| 本地模型 | Ollama | 正在运行的 Ollama 服务器、已安装的模型名称和服务器地址 |
| 本地模型 | LM Studio | 正在运行的 LM Studio 服务器、已加载的模型和服务器地址 |

### 通过 CLI 连接

1. 按照所用 CLI 的官方指引，在终端中完成安装和登录。你也可以从应用的**可安装的 CLI** 列表中打开安装和登录指引。
2. 在**设置 → AI → CLI** 中，点击**重新扫描**，选择已安装的 CLI。
3. 选择模型。选择 **CLI 默认值** 时，将使用该 CLI 的默认模型。你可以手动输入列表中没有的模型。
4. 点击**测试连接**。测试会按照所选设置发送真实请求，可能消耗账号用量。更改模型或网页搜索设置后，请重新测试。

如果没有显示 CLI，请在**高级：可执行文件路径**中指定路径，再重新扫描。安装和登录需在终端中完成，SongDocent 会运行已连接的 CLI，请求翻译和注释。

| CLI | 安装指引 | 登录指引 |
| --- | --- | --- |
| Codex CLI | [安装](https://developers.openai.com/codex/cli/) | [身份验证](https://developers.openai.com/codex/auth/) |
| Claude Code | [安装](https://code.claude.com/docs/en/setup) | [身份验证](https://code.claude.com/docs/en/authentication) |
| Gemini CLI | [安装](https://geminicli.com/docs/get-started/installation/) | [身份验证](https://geminicli.com/docs/get-started/authentication/) |
| Antigravity CLI | [安装](https://antigravity.google/docs/cli/install/) | [身份验证](https://antigravity.google/docs/install/) |
| OpenCode | [安装](https://opencode.ai/docs/) | [连接供应商](https://opencode.ai/docs/providers/) |

网页搜索可用于支持此功能的 API 和 CLI 连接。如果在 CLI 中启用搜索，请通过连接测试确认搜索是否正常，以及是否提供来源。可用模型和搜索功能取决于 CLI 版本和账号。如果响应格式不符合要求，翻译或注释请求可能失败。

## 数据与账号信息

- **凭据存储：** API 密钥和歌词服务的会话信息保存在 macOS Keychain 或 Windows Credential Manager 中。
- **CLI 身份验证：** CLI 连接使用该工具现有的身份验证配置。登录需在终端完成，无需在 SongDocent 中另行输入 API 密钥。CLI 自身的凭据和请求记录如何处理，取决于各工具的设置。
- **歌词服务连接：** 使用 Spotify 的 `sp_dc` 或 Apple Music 的 `media-user-token` 会话值。自动连接时，Rust 代码会验证并存储这些值，仅向界面传递连接状态。
- **请求发送：** 歌词请求会将会话信息发送到所选歌词服务。执行翻译或解释时，歌词、歌曲信息和请求所需的上下文会发送到所选 API 供应商、CLI 中配置的 AI 服务或你自行配置的服务器。即使选择本地 AI，连接歌词服务仍需要网络。
- **本地缓存：** 翻译结果保存在设备上的缓存文件中，与凭据存储分开管理。
- **运营服务器：** SongDocent 不运营收集歌词服务会话 Cookie 的自有服务器。

> **歌词连接是一项非官方功能。** SongDocent 并非 Spotify 或 Apple 的官方产品，歌词连接也不是官方 API 集成。服务变更可能导致功能停止工作，供应商的政策也可能导致账号受到使用限制或被停用。请先阅读连接页面的说明，再使用此功能。

AI 翻译和解释可能存在错误。使用搜索也不能保证结果准确。歌词是否可用及时间同步情况，取决于歌曲和供应商。

<a id="development"></a>

## 开发

### 准备工作

- Node.js 22 LTS
- pnpm — 使用 `package.json` 中 `packageManager` 指定的版本
- Rust stable
- **macOS：** Xcode Command Line Tools
- **Windows：** Visual Studio Build Tools 的 C++ 桌面开发工作负载、MSVC 工具和 WebView2

### 从源码运行

```sh
git clone https://github.com/kjsuo/songdocent.git
cd songdocent
pnpm install --frozen-lockfile
pnpm run tauri dev
```

如果只开发前端界面，请使用以下命令。

```sh
pnpm run dev
```

开发服务器地址为 `http://127.0.0.1:1420`。原生播放器连接、凭据存储等 Tauri 功能需要在桌面应用中验证。

### 验证

```sh
pnpm test
pnpm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

单元测试、组件测试和构建检查，与真实 Spotify 和 Apple Music 登录、CLI 身份验证及请求、操作系统权限和原生播放行为的验证是不同的。公开发布前，请在 macOS 和 Windows 上使用专用测试账号，验证真实登录流程和所用 CLI 的连接。

### 构建

```sh
pnpm run tauri build
```

系统会自动选择适合当前主机的配置。

| 平台 | 原生集成 | 打包配置 |
| --- | --- | --- |
| macOS | AppleScript/JXA, distributed player events | `src-tauri/tauri.macos.conf.json` |
| Windows | GSMTC/WinRT, media session events | `src-tauri/tauri.windows.conf.json` |

### 项目结构

```text
src/
  App.tsx                  歌词、翻译和播放器界面
  SettingsModal.tsx        AI、歌词和语言设置
  ai/                      AI 连接方式、CLI 检测和连接测试
  setup/                   首次启动设置和连接指引
  platform/                各操作系统的显示文本和指引
src-tauri/
  src/
    player.rs              通用播放器命令
    player_macos.rs        macOS 播放器集成
    player_windows.rs      Windows 播放器集成
    lyrics.rs              获取歌词
    translation.rs         AI 翻译和解释
    cli_ai/                CLI 检测、执行和响应处理
    grounding.rs           搜索补充信息
    cache.rs               本地翻译缓存
    secrets.rs             操作系统凭据存储
    provider_connection.rs 歌词服务登录连接
    app_updates.rs         应用更新
.github/workflows/         验证、安装程序和发布自动化
```

## 更新

发行版应用会在启动后检查更新。你也可以在**设置 → 更新**中手动检查、下载、安装并重启。应用会等待正在进行的翻译或解释结束后，再安装并重启。macOS 会在安装后提示重启，Windows 安装程序旨在关闭并重启应用，但此行为尚未经过充分测试。

## 贡献与问题报告

请在 [Issues](https://github.com/kjsuo/songdocent/issues) 中提交错误报告和改进建议。报告错误时，请附上操作系统、应用版本、音乐应用、AI 供应商、复现步骤，以及预期行为和实际行为。

一般咨询和不便公开的安全问题，请联系 [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com)。报告 CLI 连接问题时，也请提供所用 CLI 的名称和版本。

请勿上传包含 API 密钥、会话 Cookie、电子邮箱等个人信息的日志或截图。提出代码修改建议时，请同时提供相关测试和构建结果。

## 许可证

[MIT License](LICENSE)。所包含的字体、图标等外部资源各自适用相应许可证。相关声明见[字体许可证](public/fonts/Geist-LICENSE.txt)、[供应商标志说明](public/provider-logos/README.md)和[其他许可证](public/licenses/)。
