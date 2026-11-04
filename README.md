<p align="center">
  <a href="README.ko.md"><kbd>한국어</kbd></a>
  ·
  <a href="README.md"><strong><kbd>English</kbd></strong></a>
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
  <a href="README.zh-CN.md"><kbd>简体中文</kbd></a>
</p>

<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="SongDocent icon" />
</p>

<h1 align="center">SongDocent</h1>

<p align="center">
  <strong>Understand the music you listen to.</strong><br />
  A desktop app for reading the lyrics, AI translations, and context of the song playing now.
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/releases">Download</a> ·
  <a href="#getting-started">Get started</a> ·
  <a href="#development">Development</a> ·
  <a href="https://github.com/kjsuo/songdocent/issues">Report an issue</a>
</p>

<p align="center">
  macOS · Windows (Beta) &nbsp;|&nbsp; Tauri 2 · React · Rust &nbsp;|&nbsp; MIT
</p>

---

SongDocent is a personal music docent to keep alongside Spotify and Apple Music. It detects the song playing now and shows the original lyrics and translation in one view. **AI Annotation** explains unfamiliar people and cultural references. You can also select a passage to request more explanation.

Play music in the Spotify or Apple Music app you normally use. SongDocent follows its playback state to display lyrics and add translations and explanations.

## Introduction video

https://github.com/user-attachments/assets/f8017c97-470a-4ff9-aa55-8ef45ebfbb02

30-second introduction · V7. Some UI transitions, translations, and annotations are illustrative. [Video credits](docs/media/v7-credits.md)

## Screenshots

Read the original lyrics, translations, and AI annotations explaining cultural background for the song playing in Spotify or Apple Music, all in one view.

> [!WARNING]
> SongDocent uses unofficial access methods for lyrics rather than official APIs. It is not an official Spotify or Apple product. Service changes may stop features from working, and provider policies may lead to account restrictions or suspension.

![SongDocent showing Japanese lyrics, English translations, and AI annotations while playing Otonoke by Creepy Nuts](docs/screenshots/lyrics-translation.png)

### Cultural context in the lyrics

AI annotations appear below unfamiliar expressions to help you understand their background as you read.

![An English AI annotation explaining the cultural background of the Japanese expression Kuwa-bara](docs/screenshots/ai-annotation.png)

### Select a passage to explore

Drag to select part of the lyrics to reveal the **AI Annotation** button. You can request an explanation of the selected passage.

![The AI Annotation button appearing after part of the Japanese lyrics is selected](docs/screenshots/lyric-selection.png)

### Choose how to connect to AI

In **Settings → AI**, choose a CLI, an API key, or a local model. In the CLI tab, you can check installed tools, configure the model and web search, and test the connection.

![AI settings with CLI, API key, and local model tabs, Codex CLI model selection, and a connection test](docs/screenshots/ai-settings.png)

## Main features

| Feature | Description |
| --- | --- |
| **Now-playing detection** | Gets song information, album artwork, and playback state from the Spotify and Apple Music desktop apps. |
| **Synchronized lyrics** | Highlights the current line and scrolls automatically when lyrics include timestamps. |
| **AI lyrics translation** | Read the original lyrics alongside the translation, and search for your preferred translation language. |
| **AI Annotation** | Adds brief background notes for proper names and unfamiliar cultural references in the lyrics. You can also adjust annotation density. |
| **Selected passage explanations** | Select part of the lyrics to request an explanation of nuances, wordplay, and context. |
| **AI connection options** | Use a CLI, an API key, or a local LLM. See the [connection options table](#ai-connection-options) below for details. |
| **Web search support** | Configure supported API and CLI connections to use web search for translation or explanation requests. |
| **Translation cache** | Loads saved translations for the matching song and language. |
| **In-app updates** | Release builds with updates configured let you check for and install new versions in Settings. |

The app interface supports Korean, English, Japanese, Spanish, French, German, Brazilian Portuguese, and Simplified Chinese. **You can set the app display language and lyrics translation language separately.**

## Download

Check [GitHub Releases](https://github.com/kjsuo/songdocent/releases) for an installer that matches your operating system and CPU. If no installer is available yet, you can [run from source](#development).

| Environment | Target | Installer format |
| --- | --- | --- |
| macOS · Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS · Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows · x64 (Beta) | `x86_64-pc-windows-msvc` | NSIS `.exe` installer |

**Windows beta:** The Windows version has not yet been thoroughly tested. Some features may not work as expected. Please report any issues.

The current distribution configuration uses ad-hoc signing on macOS and does not include Apple notarization. If macOS blocks the downloaded app, verify its source, then use **System Settings → Privacy & Security → Open Anyway**. The Windows installer is also unsigned.

<a id="getting-started"></a>

## Get started

1. **Play a song in the Spotify or Apple Music desktop app.**
2. **Open SongDocent and choose the app language.**
3. **Connect a lyrics provider.** Choose Spotify or Apple Music and follow the connection instructions in the app. Authentication opens in a separate login window. If automatic connection is difficult, use the manual entry instructions in advanced settings.
4. **Set up an AI provider.** In Settings, choose an API key, a CLI, or a local model. For a CLI, install it and log in through the terminal, then rescan in the app and test the connection. For an API, enter your own key. For a local model, specify the Ollama or LM Studio server address and model.
5. **Choose a translation language and finish setup.** Once the song and lyrics appear, run **Translate**. Select a passage to request an explanation.

API and CLI fees, usage limits, and available models depend on the provider, your account's authentication method, and its plan. CLI requests are also sent to the AI service configured in that tool. Local model quality and speed depend on the model and your computer's specifications.

<a id="ai-connection-options"></a>

### AI connection options

| Connection | Supported tools and providers | What you need |
| --- | --- | --- |
| CLI | Codex CLI, Claude Code, Gemini CLI, Antigravity CLI, OpenCode | A CLI installed on your computer, with login or provider authentication configured |
| API key | Gemini, OpenAI, Claude | Your own API key and the model to use |
| API key | OpenAI-compatible API | The service's base URL, model name, and API key if required |
| Local model | Ollama | A running Ollama server, the installed model name, and the server address |
| Local model | LM Studio | A running LM Studio server, a loaded model, and the server address |

### Connect with a CLI

1. Follow the CLI's official instructions to install it and log in through the terminal. You can also open installation and login instructions from the app's **Available CLIs** list.
2. In **Settings → AI → CLI**, click **Rescan** and select an installed CLI.
3. Choose a model. Select **CLI default** to use the CLI's default model. You can enter a model that does not appear in the list.
4. Click **Test connection**. The test sends a real request with the selected settings and may count toward your account's usage. Test again after changing the model or web search settings.

If the CLI does not appear, specify its path under **Advanced: Executable path**, then rescan. Install the CLI and log in through the terminal. SongDocent runs the connected CLI to request translations and annotations.

| CLI | Installation | Login |
| --- | --- | --- |
| Codex CLI | [Install](https://developers.openai.com/codex/cli/) | [Authentication](https://developers.openai.com/codex/auth/) |
| Claude Code | [Install](https://code.claude.com/docs/en/setup) | [Authentication](https://code.claude.com/docs/en/authentication) |
| Gemini CLI | [Install](https://geminicli.com/docs/get-started/installation/) | [Authentication](https://geminicli.com/docs/get-started/authentication/) |
| Antigravity CLI | [Install](https://antigravity.google/docs/cli/install/) | [Authentication](https://antigravity.google/docs/install/) |
| OpenCode | [Install](https://opencode.ai/docs/) | [Connect a provider](https://opencode.ai/docs/providers/) |

Web search is available with API and CLI connections that support it. If you enable search for a CLI, use the connection test to check that search works and sources appear. Available models and search capabilities depend on the CLI version and account. Translation and annotation requests may fail if the response format does not match expectations.

## Data and account information

- **Credential storage:** API keys and lyrics service session information are stored in macOS Keychain or Windows Credential Manager.
- **CLI authentication:** CLI connections use the tool's existing authentication settings. Log in through the terminal. You do not need to enter a separate API key in SongDocent. Each tool's settings govern how it handles its own credentials and request history.
- **Lyrics service connections:** Uses Spotify's `sp_dc` or Apple Music's `media-user-token` session value. During automatic connection, Rust validates and stores the value, and only the connection status is passed to the interface.
- **Requests:** Lyrics requests send session information to the selected lyrics service. When you run a translation or explanation, lyrics, song information, and the context needed for the request are sent to the selected API provider, the AI service configured in the CLI, or the server you configured. Lyrics service connections still require a network connection when you use local AI.
- **Local cache:** Translation results are stored in cache files on your device, separately from the credential store.
- **Servers:** SongDocent does not operate its own server to collect lyrics service session cookies.

> **Lyrics integration is unofficial.** SongDocent is not an official Spotify or Apple product, and its lyrics connections are not official API integrations. Service changes may stop them from working, and provider policies may lead to account restrictions or suspension. Read the notices on the connection screen before use.

AI translations and explanations may contain errors. Results that use search are not guaranteed to be accurate. Lyrics availability and timestamp synchronization vary by song and provider.

<a id="development"></a>

## Development

### Prerequisites

- Node.js 22 LTS
- pnpm, using the version specified by `packageManager` in `package.json`
- Rust stable
- **macOS:** Xcode Command Line Tools
- **Windows:** The Desktop development with C++ workload in Visual Studio Build Tools, MSVC tools, and WebView2

### Run from source

```sh
git clone https://github.com/kjsuo/songdocent.git
cd songdocent
pnpm install --frozen-lockfile
pnpm run tauri dev
```

To develop only the frontend interface, use:

```sh
pnpm run dev
```

The development server opens at `http://127.0.0.1:1420`. Test Tauri features, such as native player integration and credential storage, in the desktop app.

### Verification

```sh
pnpm test
pnpm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

See the [security policy](SECURITY.md) for private vulnerability reports and the [publication and release checklist](docs/RELEASING.md) before publishing source or installers.

Unit tests, component tests, and build checks are separate from verification of real Spotify and Apple Music login, CLI authentication and requests, operating system permissions, and native playback behavior. Before a public release, use dedicated test accounts on macOS and Windows to check the real login flows and the CLI connections you plan to use.

### Build

```sh
pnpm run tauri build
```

The configuration for the current host is selected automatically.

| Platform | Native integration | Bundle configuration |
| --- | --- | --- |
| macOS | AppleScript/JXA, distributed player events | `src-tauri/tauri.macos.conf.json` |
| Windows | GSMTC/WinRT, media session events | `src-tauri/tauri.windows.conf.json` |

### Project structure

```text
src/
  App.tsx                  Lyrics, translation, and player views
  SettingsModal.tsx        AI, lyrics, and language settings
  ai/                      AI connection options, CLI detection, and connection tests
  setup/                   First-run setup and connection instructions
  platform/                OS-specific text and instructions
src-tauri/
  src/
    player.rs              Shared player commands
    player_macos.rs        macOS player integration
    player_windows.rs      Windows player integration
    lyrics.rs              Lyrics retrieval
    translation.rs         AI translation and explanations
    cli_ai/                CLI detection, execution, and response processing
    grounding.rs           Web search support
    cache.rs               Local translation cache
    secrets.rs             Operating system credential store
    provider_connection.rs Lyrics service login connections
    app_updates.rs         App updates
.github/workflows/         Verification, installer, and release automation
```

## Updates

Release apps check for updates after startup. You can also check, download, install, and restart from **Settings → Updates**. Installation and restart wait for any translation or explanation in progress to finish. On macOS, the app prompts you to restart after installation. On Windows, the installer is intended to close and restart the app, but this behavior has not yet been thoroughly tested.

## Contributing and reporting issues

Report bugs and suggest improvements in [Issues](https://github.com/kjsuo/songdocent/issues). For bug reports, include your operating system, app version, music app, AI provider, steps to reproduce, expected behavior, and actual behavior.

For general inquiries or security issues that are difficult to disclose publicly, contact [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com). When reporting a CLI connection issue, include the CLI's name and version.

Do not upload logs or screenshots that contain personal information such as API keys, session cookies, or email addresses. When proposing a code change, include the relevant test and build results.

## License

[MIT License](LICENSE). External assets, including bundled fonts and icons, have their own licenses. See the [font license](public/fonts/Geist-LICENSE.txt), [provider logo notices](public/provider-logos/README.md), and [other licenses](public/licenses/) for the relevant notices.
