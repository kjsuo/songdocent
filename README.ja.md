<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="SongDocentのアイコン" />
</p>

<h1 align="center">SongDocent</h1>

<p align="center">
  <strong>聴く音楽を、理解する音楽へ。</strong><br />
  再生中の曲の歌詞、AI翻訳、その背景を一緒に読めるデスクトップアプリ。
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kjsuo/songdocent/ci.yml?branch=main&amp;style=plastic&amp;label=build" alt="Build status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=plastic" alt="License: MIT" /></a>
  <a href="https://github.com/kjsuo/songdocent"><img src="https://img.shields.io/github/stars/kjsuo/songdocent?style=plastic" alt="GitHub stars" /></a>
  <a href="https://buymeacoffee.com/kjsuo"><img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-ffdd00?style=plastic&amp;logo=buymeacoffee&amp;logoColor=white" alt="Support on Buy Me a Coffee" /></a>
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/releases">ダウンロード</a> ·
  <a href="#getting-started">はじめに</a> ·
  <a href="#development">開発</a> ·
  <a href="https://github.com/kjsuo/songdocent/issues">問題を報告</a>
</p>

<p align="center">
  macOS · Windows (Beta) &nbsp;|&nbsp; Tauri 2 · React · Rust &nbsp;|&nbsp; MIT
</p>

<p align="center">
  <a href="README.ko.md"><kbd>한국어</kbd></a>
  ·
  <a href="README.md"><kbd>English</kbd></a>
  ·
  <a href="README.ja.md"><strong><kbd>日本語</kbd></strong></a>
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

---

SongDocentは、SpotifyやApple Musicで音楽を聴くときに寄り添う、個人向けの音楽ガイドです。再生中の曲を検出し、原文の歌詞と翻訳を1つの画面に表示します。なじみのない人物や文化的な言及は **AI Annotation** で説明し、気になるフレーズを選択して解説をリクエストすることもできます。

音楽は、普段お使いのSpotifyまたはApple Musicアプリで再生します。SongDocentはその再生状況に合わせて歌詞を表示し、翻訳と解説を加えます。

## 紹介動画

https://github.com/user-attachments/assets/f8017c97-470a-4ff9-aa55-8ef45ebfbb02

[動画クレジット](docs/media/v7-credits.md)

## スクリーンショット

SpotifyやApple Musicで再生中の曲について、原文の歌詞、翻訳、文化的背景を説明するAI注釈を1つの画面で読めます。

> [!WARNING]
> SongDocentの歌詞連携には、公式APIではなく非公式のアクセス方法を使用しています。SpotifyまたはAppleの公式製品ではありません。サービスの変更により機能が停止したり、プロバイダーのポリシーによりアカウントの利用が制限・停止されたりする可能性があります。

![SongDocentでCreepy NutsのOtonokeを再生し、日本語の歌詞、英語の翻訳、AI注釈を一緒に表示した画面](docs/screenshots/lyrics-translation.png)

### 歌詞の文化的背景

なじみのない表現の下にAI注釈を表示するので、歌詞を読みながらその背景も理解できます。

![日本語の表現Kuwa-baraの文化的背景を英語のAI注釈で説明した画面](docs/screenshots/ai-annotation.png)

### 気になるフレーズを選択

歌詞の一部をドラッグして選択すると、**AI Annotation** ボタンが表示されます。選択したフレーズの解説をリクエストできます。

![日本語の歌詞の一部を選択し、AI Annotationボタンが表示された画面](docs/screenshots/lyric-selection.png)

### AIの接続方法を選択

**設定 → AI** で、CLI、APIキー、ローカルモデルから接続方法を選びます。CLIタブでは、インストール済みのツールを確認し、モデルやウェブ検索を設定して接続をテストできます。

![CLI・APIキー・ローカルモデルのタブと、Codex CLIのモデル選択、接続テストを表示したAI設定画面](docs/screenshots/ai-settings.png)

## 主な機能

| 機能 | 説明 |
| --- | --- |
| **再生中の曲を検出** | Spotify・Apple Musicのデスクトップアプリから、曲情報、アルバムアート、再生状況を取得します。 |
| **歌詞の同期** | タイムスタンプ付きの歌詞では、再生中の行を強調し、自動でスクロールします。 |
| **AIによる歌詞翻訳** | 原文と翻訳を一緒に読み、希望する翻訳言語を検索して選択できます。 |
| **AI Annotation** | 歌詞に登場する固有名詞や、なじみのない文化的な言及に短い背景説明を付けます。注釈の密度も調整できます。 |
| **選択したフレーズの解説** | 歌詞の一部を選択して、表現のニュアンス、言葉遊び、文脈の解説をリクエストできます。 |
| **AIの接続方法を選択** | CLI、APIキー、ローカルLLMを利用できます。詳しくは以下の[接続オプションの表](#ai-connection-options)をご覧ください。 |
| **検索による補足** | 対応するAPI・CLI接続では、翻訳や解説のリクエストにウェブ検索を使うよう設定できます。 |
| **翻訳キャッシュ** | 保存済みの翻訳を、曲と言語に合わせて読み込みます。 |
| **アプリ内アップデート** | アップデートが設定されたリリースビルドでは、設定から新しいバージョンを確認してインストールできます。 |

アプリのインターフェースは、韓国語、英語、日本語、スペイン語、フランス語、ドイツ語、ブラジルポルトガル語、簡体字中国語に対応しています。**アプリの表示言語と歌詞の翻訳言語は別々に設定**できます。

## ダウンロード

[GitHub Releases](https://github.com/kjsuo/songdocent/releases)で、お使いのOSとCPUに合うインストーラーを確認してください。インストーラーがまだ表示されていない場合は、[ソースから実行](#development)できます。

| 環境 | ビルドターゲット | 配布形式 |
| --- | --- | --- |
| macOS · Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS · Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows · x64 (Beta) | `x86_64-pc-windows-msvc` | NSIS `.exe` インストーラー |

**Windowsベータ版:** Windows版はまだ十分にテストされていないため、一部の機能が想定どおりに動作しない場合があります。問題が発生した場合はお知らせください。

現在の配布設定では、macOSにアドホック署名を使用しており、Appleの公証は含まれません。ダウンロードしたアプリがブロックされた場合は、入手元を確認したうえで、**システム設定 → プライバシーとセキュリティ → このまま開く** を使用できます。Windowsのインストーラーにもコード署名は適用されていません。

<a id="getting-started"></a>

## はじめに

1. **SpotifyまたはApple Musicのデスクトップアプリで曲を再生します。**
2. **SongDocentを開き、アプリの言語を選択します。**
3. **歌詞プロバイダーに接続します。** SpotifyまたはApple Musicを選び、アプリ内の接続手順に従ってください。認証は別のログインウィンドウで行います。自動接続が難しい場合は、詳細設定にある手動入力の案内を利用できます。
4. **AIプロバイダーを設定します。** 設定でAPIキー・CLI・ローカルモデルから接続方法を選びます。CLIはターミナルでインストールとログインを済ませてから、アプリで再スキャンして接続をテストします。APIはご自身のキーを入力し、ローカルモデルはOllamaまたはLM Studioのサーバーアドレスとモデルを指定します。
5. **翻訳言語を選び、設定を完了します。** 曲と歌詞が表示されたら、**翻訳** を実行します。気になるフレーズを選択して、解説をリクエストしてください。

APIとCLIの料金、利用上限、利用可能なモデルは、選択したプロバイダーとアカウントの認証方法・料金プランによって異なります。CLIを使う場合も、リクエストはそのツールに設定されたAIサービスへ送信されます。ローカルモデルの品質と速度は、モデルとコンピューターの性能によって異なります。

<a id="ai-connection-options"></a>

### AIの接続オプション

| 接続方法 | 対応ツール・プロバイダー | 必要なもの |
| --- | --- | --- |
| CLI | Codex CLI, Claude Code, Gemini CLI, Antigravity CLI, OpenCode | コンピューターにインストールしたCLIと、そのツールのログインまたはプロバイダー認証設定 |
| APIキー | Gemini, OpenAI, Claude | ご自身のAPIキーと使用するモデル |
| APIキー | OpenAI互換API | サービスのベースURL、モデル名、必要に応じてAPIキー |
| ローカルモデル | Ollama | 起動中のOllamaサーバー、インストール済みのモデル名、サーバーアドレス |
| ローカルモデル | LM Studio | 起動中のLM Studioサーバー、読み込み済みのモデル、サーバーアドレス |

### CLIで接続

1. 使用するCLIの公式ガイドに従い、ターミナルでインストールとログインを完了します。アプリの **インストール可能なCLI** 一覧からも、インストールとログインの案内を開けます。
2. **設定 → AI → CLI** で **再スキャン** を押し、インストール済みのCLIを選択します。
3. モデルを選択します。**CLIのデフォルト** を選ぶと、そのCLIのデフォルトモデルを使用します。一覧にないモデルは直接入力できます。
4. **接続テスト** を押します。テストでは選択した設定で実際のリクエストを送信するため、アカウントの利用量に加算される場合があります。モデルやウェブ検索の設定を変更したら、再度テストしてください。

CLIが表示されない場合は、**詳細設定: 実行ファイルのパス** でパスを指定し、再スキャンします。インストールとログインはターミナルで行います。SongDocentは接続したCLIを実行して、翻訳と注釈をリクエストします。

| CLI | インストール案内 | ログイン案内 |
| --- | --- | --- |
| Codex CLI | [インストール](https://developers.openai.com/codex/cli/) | [認証](https://developers.openai.com/codex/auth/) |
| Claude Code | [インストール](https://code.claude.com/docs/en/setup) | [認証](https://code.claude.com/docs/en/authentication) |
| Gemini CLI | [インストール](https://geminicli.com/docs/get-started/installation/) | [認証](https://geminicli.com/docs/get-started/authentication/) |
| Antigravity CLI | [インストール](https://antigravity.google/docs/cli/install/) | [認証](https://antigravity.google/docs/install/) |
| OpenCode | [インストール](https://opencode.ai/docs/) | [プロバイダー接続](https://opencode.ai/docs/providers/) |

ウェブ検索は、その機能に対応するAPI・CLI接続で利用できます。CLIで検索を有効にした場合は、接続テストで検索の動作と出典の表示を確認してください。利用可能なモデルと検索機能は、CLIのバージョンとアカウントによって異なります。応答形式が合わないと、翻訳や注釈のリクエストが失敗する場合があります。

## データとアカウント情報

- **認証情報の保存:** APIキーと歌詞サービスのセッション情報は、macOS KeychainまたはWindows Credential Managerに保存します。
- **CLI認証:** CLI接続には、そのツールの既存の認証設定を使用します。ログインはターミナルで行うため、SongDocentに別途APIキーを入力する必要はありません。CLI自体の認証情報とリクエスト履歴の扱いは、各ツールの設定に従います。
- **歌詞サービスへの接続:** Spotifyの `sp_dc` またはApple Musicの `media-user-token` のセッション値を使用します。自動接続ではRust側で値を検証・保存し、画面には接続状況のみを渡します。
- **リクエストの送信:** 歌詞のリクエストでは、選択した歌詞サービスへセッション情報を送信します。翻訳や解説を実行すると、歌詞、曲情報、リクエストに必要な文脈を、選択したAPIプロバイダー、CLIに設定されたAIサービス、またはご自身で設定したサーバーに送信します。ローカルAIを選択しても、歌詞サービスへの接続にはネットワークが必要です。
- **ローカルキャッシュ:** 翻訳結果はデバイス上のキャッシュファイルに保存します。認証情報の保存先とは別に管理します。
- **運営サーバー:** SongDocentは、歌詞サービスのセッションクッキーを収集する独自のサーバーを運営していません。

> **歌詞連携は非公式の機能です。** SongDocentはSpotifyまたはAppleの公式製品ではなく、歌詞接続は公式APIによる連携ではありません。サービスの変更により動作が停止したり、プロバイダーのポリシーによりアカウントの利用が制限・停止されたりする可能性があります。接続画面の案内を確認してから使用してください。

AIによる翻訳と解説には、誤りが含まれる可能性があります。検索を利用した結果も正確性を保証するものではありません。歌詞の提供状況とタイムスタンプによる同期は、曲とプロバイダーによって異なります。

<a id="development"></a>

## 開発

### 必要なもの

- Node.js 22 LTS
- pnpm。`package.json` の `packageManager` に指定されたバージョンを使用
- Rust stable
- **macOS:** Xcode Command Line Tools
- **Windows:** Visual Studio Build Toolsの「C++によるデスクトップ開発」ワークロード、MSVCツール、WebView2

### ソースから実行

```sh
git clone https://github.com/kjsuo/songdocent.git
cd songdocent
pnpm install --frozen-lockfile
pnpm run tauri dev
```

フロントエンドの画面のみを開発する場合は、次のコマンドを使用します。

```sh
pnpm run dev
```

開発サーバーは `http://127.0.0.1:1420` で起動します。ネイティブプレーヤー連携や認証情報の保存など、Tauriの機能はデスクトップアプリで確認してください。

### 検証

```sh
pnpm test
pnpm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

ユニットテスト、コンポーネントテスト、ビルド確認は、実際のSpotify・Apple Musicのログイン、CLIの認証とリクエスト、OSの権限、ネイティブ再生動作の検証とは区別します。一般公開の前に、macOSとWindowsで専用のテストアカウントを使い、実際のログインフローと使用するCLIの接続を確認してください。

### ビルド

```sh
pnpm run tauri build
```

現在のホストに合った設定が自動で選択されます。

| プラットフォーム | ネイティブ連携 | バンドル設定 |
| --- | --- | --- |
| macOS | AppleScript/JXA, distributed player events | `src-tauri/tauri.macos.conf.json` |
| Windows | GSMTC/WinRT, media session events | `src-tauri/tauri.windows.conf.json` |

### プロジェクト構成

```text
src/
  App.tsx                  歌詞・翻訳・プレーヤー画面
  SettingsModal.tsx        AI・歌詞・言語の設定
  ai/                      AIの接続方法・CLI検出・接続テスト
  setup/                   初回設定と接続案内
  platform/                OS別の表示文言と案内
src-tauri/
  src/
    player.rs              共通のプレーヤーコマンド
    player_macos.rs        macOSプレーヤー連携
    player_windows.rs      Windowsプレーヤー連携
    lyrics.rs              歌詞の取得
    translation.rs         AI翻訳・解説
    cli_ai/                CLIの検出・実行・応答処理
    grounding.rs           検索による補足
    cache.rs               ローカル翻訳キャッシュ
    secrets.rs             OSの認証情報ストア
    provider_connection.rs 歌詞サービスのログイン接続
    app_updates.rs         アプリのアップデート
.github/workflows/         検証・インストーラー・リリースの自動化
```

## アップデート

リリース版アプリは、起動後にアップデートを確認します。**設定 → アップデート** から手動で確認し、ダウンロード・インストール・再起動することもできます。進行中の翻訳や解説が完了してから、インストールと再起動を行います。macOSではインストール後に再起動を案内し、Windowsではインストーラーがアプリを終了して再起動するよう設計されていますが、この動作はまだ十分にテストされていません。

## 貢献と問題報告

バグや改善の提案は [Issues](https://github.com/kjsuo/songdocent/issues) にお寄せください。バグを報告する際は、OS、アプリのバージョン、音楽アプリ、AIプロバイダー、再現手順、期待した動作、実際の動作を記載してください。

一般のお問い合わせや、公開しにくいセキュリティ上の問題は [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com) へご連絡ください。CLI接続の問題を報告する場合は、使用しているCLIの名前とバージョンもお知らせください。

APIキー、セッションクッキー、メールアドレスなどの個人情報を含むログやスクリーンショットは投稿しないでください。コードの変更を提案する場合は、関連するテストとビルドの結果も記載してください。

## ライセンス

[MIT License](LICENSE)。同梱のフォントやアイコンなどの外部アセットには、それぞれのライセンスが適用されます。関連する表記は、[フォントライセンス](public/fonts/Geist-LICENSE.txt)、[プロバイダーロゴの案内](public/provider-logos/README.md)、[その他のライセンス](public/licenses/)で確認できます。
