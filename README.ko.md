<p align="center">
  <img src="src-tauri/icons/128x128@2x.png" width="96" height="96" alt="SongDocent 아이콘" />
</p>

<h1 align="center">SongDocent</h1>

<p align="center">
  <strong>듣는 음악을, 이해하는 음악으로.</strong><br />
  재생 중인 곡의 가사와 AI 번역, 그 안에 담긴 맥락을 함께 읽는 데스크톱 앱.
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/kjsuo/songdocent/ci.yml?branch=main&amp;style=plastic&amp;label=build" alt="Build status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=plastic" alt="License: MIT" /></a>
  <a href="https://github.com/kjsuo/songdocent"><img src="https://img.shields.io/github/stars/kjsuo/songdocent?style=plastic" alt="GitHub stars" /></a>
  <a href="https://buymeacoffee.com/kjsuo"><img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-ffdd00?style=plastic&amp;logo=buymeacoffee&amp;logoColor=white" alt="Support on Buy Me a Coffee" /></a>
</p>

<p align="center">
  <a href="https://github.com/kjsuo/songdocent/releases">다운로드</a> ·
  <a href="#getting-started">시작하기</a> ·
  <a href="#development">개발하기</a> ·
  <a href="https://github.com/kjsuo/songdocent/issues">문제 보고</a>
</p>

<p align="center">
  macOS · Windows (Beta) &nbsp;|&nbsp; Tauri 2 · React · Rust &nbsp;|&nbsp; MIT
</p>

<p align="center">
  <a href="README.ko.md"><strong><kbd>한국어</kbd></strong></a>
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
  <a href="README.zh-CN.md"><kbd>简体中文</kbd></a>
</p>

---

SongDocent는 Spotify와 Apple Music으로 음악을 들을 때 곁에 두는 개인 음악 도슨트입니다. 현재 재생 중인 곡을 감지하고, 원문 가사와 번역을 한 화면에서 보여줍니다. 낯선 인물이나 문화적 레퍼런스는 **AI Annotation**으로 짚고, 더 궁금한 구절은 직접 선택해 해설을 요청할 수 있습니다.

음악은 평소 사용하는 Spotify 또는 Apple Music 앱에서 재생합니다. SongDocent는 그 재생 상태에 맞춰 가사를 보여주고 번역과 해설을 더합니다.

## 소개 영상

https://github.com/user-attachments/assets/f8017c97-470a-4ff9-aa55-8ef45ebfbb02

[영상 크레딧](docs/media/v7-credits.md)

## 스크린샷

Spotify와 Apple music에서 재생하고 있는 곡의 원문 가사와 번역, 문화적 배경을 설명하는 AI 주석을 한 화면에서 읽을 수 있습니다.

> [!WARNING]
> SongDocent의 가사 연동은 공식 API가 아닌 비공식적인 접근 방식을 사용합니다. Spotify 또는 Apple의 공식 제품이 아니며, 서비스 변경으로 기능이 중단되거나 공급자의 정책에 따라 계정 이용이 제한·정지될 수 있습니다.

![SongDocent에서 Creepy Nuts의 Otonoke를 재생하며 일본어 가사, 영어 번역과 AI 주석을 함께 보는 화면](docs/screenshots/lyrics-translation.png)

### 가사 속 문화적 맥락

낯선 표현 아래에 AI 주석을 표시해, 가사를 읽으며 배경을 함께 이해할 수 있습니다.

![일본어 표현 Kuwa-bara의 문화적 배경을 영어 AI 주석으로 설명하는 화면](docs/screenshots/ai-annotation.png)

### 궁금한 구절 직접 선택

가사 일부를 드래그하면 **AI Annotation** 버튼이 나타납니다. 선택한 구절에 대한 해설을 요청할 수 있습니다.

![일본어 가사 일부를 선택해 AI Annotation 버튼이 나타난 화면](docs/screenshots/lyric-selection.png)

### AI 연결 방식 선택

**설정 → AI**에서 CLI, API 키, 로컬 모델 중 연결 방식을 선택합니다. CLI 탭에서는 설치된 도구를 확인하고, 모델과 웹 검색을 설정한 뒤 연결을 테스트할 수 있습니다.

![CLI·API 키·로컬 모델 탭과 Codex CLI의 모델 선택, 연결 테스트를 보여주는 AI 설정 화면](docs/screenshots/ai-settings.png)

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| **재생 중인 곡 감지** | Spotify·Apple Music 데스크톱 앱의 곡 정보, 앨범 아트와 재생 상태를 가져옵니다. |
| **가사 동기화** | 시간 정보가 있는 가사는 현재 구절을 강조하고 자동으로 스크롤합니다. |
| **AI 가사 번역** | 원문과 번역을 함께 읽고, 원하는 번역 언어를 검색해 선택할 수 있습니다. |
| **AI Annotation** | 가사 속 고유명사와 낯선 문화적 레퍼런스에 짧은 배경 설명을 붙입니다. 주석 밀도도 조절할 수 있습니다. |
| **선택한 구절 해설** | 가사 일부를 선택해 표현의 뉘앙스, 말장난, 문맥에 대한 해설을 요청합니다. |
| **AI 연결 방식 선택** | CLI, API 키 또는 로컬 LLM을 사용할 수 있습니다. 자세한 내용은 아래 [AI 연결 옵션 표](#ai-connection-options)를 참고하세요. |
| **검색을 활용한 보강** | 지원되는 API·CLI 연결에서는 번역 또는 해설 요청에 웹 검색을 활용하도록 설정할 수 있습니다. |
| **번역 캐시** | 저장한 번역을 곡과 언어에 맞춰 다시 불러옵니다. |
| **앱 내 업데이트** | 업데이트가 설정된 릴리스 빌드에서는 설정에서 새 버전을 확인하고 설치할 수 있습니다. |

앱 인터페이스는 한국어, 영어, 일본어, 스페인어, 프랑스어, 독일어, 브라질 포르투갈어, 중국어 간체를 지원합니다. **앱 표시 언어와 가사 번역 언어는 별도로 설정**할 수 있습니다.

## 다운로드

[GitHub Releases](https://github.com/kjsuo/songdocent/releases)에서 운영체제와 CPU에 맞는 설치 파일을 확인하세요. 설치 파일이 아직 표시되지 않으면 [소스에서 실행](#development)할 수 있습니다.

| 환경 | 배포 대상 | 설치 형식 |
| --- | --- | --- |
| macOS · Apple Silicon | `aarch64-apple-darwin` | `.dmg` |
| macOS · Intel | `x86_64-apple-darwin` | `.dmg` |
| Windows · x64 (Beta) | `x86_64-pc-windows-msvc` | NSIS `.exe` 설치 프로그램 |

**Windows 베타:** Windows 버전은 아직 충분히 테스트되지 않아 일부 기능이 예상대로 작동하지 않을 수 있습니다. 문제가 발생하면 알려주세요.

현재 배포 설정은 macOS의 ad-hoc 서명을 사용하며 Apple 공증은 포함하지 않습니다. 다운로드한 앱이 차단되면 출처를 확인한 뒤 **시스템 설정 → 개인정보 보호 및 보안 → 그래도 열기**를 이용할 수 있습니다. Windows 설치 프로그램에도 코드 서명이 적용되어 있지 않습니다.

<a id="getting-started"></a>

## 시작하기

1. **Spotify 또는 Apple Music 데스크톱 앱에서 곡을 재생합니다.**
2. **SongDocent를 열고 앱 언어를 선택합니다.**
3. **가사 공급자를 연결합니다.** Spotify 또는 Apple Music을 선택하고 앱의 연결 안내를 따릅니다. 별도 로그인 창에서 인증하며, 자동 연결이 어려우면 고급 설정의 수동 입력 안내를 사용할 수 있습니다.
4. **AI 공급자를 설정합니다.** 설정에서 API 키·CLI·로컬 모델 중 연결 방식을 선택합니다. CLI는 터미널에서 설치·로그인한 뒤 앱에서 다시 스캔하고 연결 테스트를 진행합니다. API는 본인의 키를 입력하고, 로컬 모델은 Ollama 또는 LM Studio 서버 주소와 모델을 지정합니다.
5. **번역 언어를 선택하고 설정을 완료합니다.** 곡과 가사가 표시되면 **번역**을 실행합니다. 궁금한 구절은 선택해서 해설을 요청하세요.

API와 CLI의 이용 요금, 사용 한도와 이용 가능한 모델은 선택한 공급자 및 계정의 인증 방식과 요금제에 따릅니다. CLI를 사용해도 요청은 해당 도구에 설정된 AI 서비스로 전송됩니다. 로컬 모델의 품질과 속도는 모델과 컴퓨터 사양에 따라 달라집니다.

<a id="ai-connection-options"></a>

### AI 연결 옵션

| 연결 방식 | 지원 도구·공급자 | 준비할 항목 |
| --- | --- | --- |
| CLI | Codex CLI, Claude Code, Gemini CLI, Antigravity CLI, OpenCode | 컴퓨터에 설치한 CLI와 해당 도구의 로그인 또는 공급자 인증 설정 |
| API 키 | Gemini, OpenAI, Claude | 본인의 API 키와 사용할 모델 |
| API 키 | OpenAI 호환 API | 서비스의 기본 URL, 모델 이름, 필요한 경우 API 키 |
| 로컬 모델 | Ollama | 실행 중인 Ollama 서버, 설치한 모델 이름과 서버 주소 |
| 로컬 모델 | LM Studio | 실행 중인 LM Studio 서버, 로드한 모델과 서버 주소 |

### CLI로 연결하기

1. 사용할 CLI의 공식 안내에 따라 터미널에서 설치와 로그인을 완료합니다. 앱의 **설치 가능한 CLI** 목록에서도 설치·로그인 안내를 열 수 있습니다.
2. **설정 → AI → CLI**에서 **다시 스캔**을 누르고 설치된 CLI를 선택합니다.
3. 모델을 선택합니다. **CLI 기본값**을 선택하면 해당 CLI의 기본 모델을 사용합니다. 모델 목록에 없는 모델은 직접 입력할 수 있습니다.
4. **연결 테스트**를 누릅니다. 테스트는 선택한 설정으로 실제 요청을 보내므로 계정의 사용량이 발생할 수 있습니다. 모델이나 웹 검색 설정을 바꾸면 다시 테스트합니다.

CLI가 표시되지 않으면 **고급: 실행 파일 경로**에서 경로를 지정하고 다시 스캔합니다. 설치와 로그인은 터미널에서 진행하며, SongDocent는 연결된 CLI를 실행해 번역과 주석을 요청합니다.

| CLI | 설치 안내 | 로그인 안내 |
| --- | --- | --- |
| Codex CLI | [설치](https://developers.openai.com/codex/cli/) | [인증](https://developers.openai.com/codex/auth/) |
| Claude Code | [설치](https://code.claude.com/docs/en/setup) | [인증](https://code.claude.com/docs/en/authentication) |
| Gemini CLI | [설치](https://geminicli.com/docs/get-started/installation/) | [인증](https://geminicli.com/docs/get-started/authentication/) |
| Antigravity CLI | [설치](https://antigravity.google/docs/cli/install/) | [인증](https://antigravity.google/docs/install/) |
| OpenCode | [설치](https://opencode.ai/docs/) | [공급자 연결](https://opencode.ai/docs/providers/) |

웹 검색은 해당 기능을 지원하는 API·CLI 연결에서 사용할 수 있습니다. CLI에서 검색을 켰다면 연결 테스트로 검색 동작과 출처가 확인되는지 확인하세요. 이용 가능한 모델과 검색 기능은 CLI 버전 및 계정에 따라 달라지며, 응답 형식이 맞지 않으면 번역·주석 요청이 실패할 수 있습니다.

## 데이터와 계정 정보

- **자격 증명 저장:** API 키와 가사 서비스 세션 정보는 macOS Keychain 또는 Windows Credential Manager에 저장합니다.
- **CLI 인증:** CLI 연결은 해당 도구의 기존 인증 설정을 사용합니다. 로그인은 터미널에서 진행하며, SongDocent에 별도 API 키를 입력할 필요는 없습니다. CLI 자체의 인증 정보와 요청 기록 처리는 각 도구의 설정에 따릅니다.
- **가사 서비스 연결:** Spotify의 `sp_dc` 또는 Apple Music의 `media-user-token` 세션 값을 사용합니다. 자동 연결 시 Rust에서 값을 검증·저장하고, 화면에는 연결 상태만 전달합니다.
- **요청 전송:** 가사 요청에는 선택한 가사 서비스로 세션 정보가 전송됩니다. 번역·해설을 실행하면 가사, 곡 정보와 요청에 필요한 문맥이 선택한 API 공급자, CLI에 설정된 AI 서비스 또는 직접 설정한 서버로 전송됩니다. 로컬 AI를 선택해도 가사 서비스 연결에는 네트워크가 필요합니다.
- **로컬 캐시:** 번역 결과는 기기의 캐시 파일에 저장합니다. 자격 증명 저장소와 별도로 관리됩니다.
- **운영 서버:** SongDocent는 가사 서비스의 세션 쿠키를 수집하는 자체 서버를 운영하지 않습니다.

> **가사 연동은 비공식 기능입니다.** SongDocent는 Spotify 또는 Apple의 공식 제품이 아니며, 가사 연결은 공식 API 통합이 아닙니다. 서비스 변경으로 작동이 중단될 수 있고, 공급자의 정책에 따라 계정 이용이 제한되거나 정지될 수 있습니다. 연결 화면의 안내를 확인한 뒤 사용하세요.

AI 번역과 해설에는 오류가 있을 수 있습니다. 검색을 활용한 결과도 정확성을 보장하지 않으며, 가사 제공 여부와 시간 동기화는 곡·공급자에 따라 달라집니다.

<a id="development"></a>

## 개발하기

### 준비 사항

- Node.js 22 LTS
- pnpm — `package.json`의 `packageManager`에 지정된 버전 사용
- Rust stable
- **macOS:** Xcode Command Line Tools
- **Windows:** Visual Studio Build Tools의 C++ 데스크톱 개발 워크로드, MSVC 도구 및 WebView2

### 소스에서 실행

```sh
git clone https://github.com/kjsuo/songdocent.git
cd songdocent
pnpm install --frozen-lockfile
pnpm run tauri dev
```

프런트엔드 화면만 개발하려면 다음 명령을 사용합니다.

```sh
pnpm run dev
```

개발 서버는 `http://127.0.0.1:1420`에서 열립니다. 네이티브 플레이어 연동, 자격 증명 저장 등 Tauri 기능은 데스크톱 앱에서 확인해야 합니다.

### 검증

```sh
pnpm test
pnpm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml --lib
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

단위·컴포넌트 테스트와 빌드 확인은 실제 Spotify·Apple Music 로그인, CLI 인증과 요청, 운영체제 권한, 네이티브 재생 동작의 검증과 구분합니다. 공개 배포 전에는 macOS와 Windows에서 전용 테스트 계정으로 실제 로그인 흐름과 사용할 CLI의 연결을 확인하세요.

### 빌드

```sh
pnpm run tauri build
```

현재 호스트에 맞는 설정이 자동으로 선택됩니다.

| 플랫폼 | 네이티브 연동 | 번들 설정 |
| --- | --- | --- |
| macOS | AppleScript/JXA, distributed player events | `src-tauri/tauri.macos.conf.json` |
| Windows | GSMTC/WinRT, media session events | `src-tauri/tauri.windows.conf.json` |

### 프로젝트 구조

```text
src/
  App.tsx                  가사·번역·플레이어 화면
  SettingsModal.tsx        AI·가사·언어 설정
  ai/                      AI 연결 방식·CLI 감지와 연결 테스트
  setup/                   첫 실행 설정과 연결 안내
  platform/                운영체제별 표시 문구와 안내
src-tauri/
  src/
    player.rs              공통 플레이어 명령
    player_macos.rs        macOS 플레이어 연동
    player_windows.rs      Windows 플레이어 연동
    lyrics.rs              가사 가져오기
    translation.rs         AI 번역·해설
    cli_ai/                CLI 감지·실행·응답 처리
    grounding.rs           검색 보강
    cache.rs               로컬 번역 캐시
    secrets.rs             운영체제 자격 증명 저장소
    provider_connection.rs 가사 서비스 로그인 연결
    app_updates.rs         앱 업데이트
.github/workflows/         검증·설치 프로그램·릴리스 자동화
```

## 업데이트

릴리스 앱은 시작 후 업데이트를 확인합니다. **설정 → 업데이트**에서 직접 확인하고 다운로드·설치·재시작할 수도 있습니다. 진행 중인 번역이나 해설이 끝난 뒤 설치와 재시작을 진행하며, macOS는 설치 후 재시작을 안내하고 Windows에서는 설치 프로그램이 앱을 종료하고 재시작하도록 되어 있지만, 이 동작은 아직 충분히 테스트되지 않았습니다.

## 기여와 문제 보고

버그와 개선 제안은 [Issues](https://github.com/kjsuo/songdocent/issues)에 남겨주세요. 버그를 보고할 때는 운영체제, 앱 버전, 음악 앱과 AI 공급자, 재현 순서, 기대한 동작과 실제 동작을 함께 적으면 도움이 됩니다.

일반 문의와 공개하기 어려운 보안 문제는 [kjsuo74@gmail.com](mailto:kjsuo74@gmail.com)으로 연락해 주세요. CLI 연결 문제를 보고할 때는 사용하는 CLI의 이름과 버전도 함께 알려주세요.

API 키, 세션 쿠키, 이메일 등 개인정보가 포함된 로그나 스크린샷은 올리지 마세요. 코드 변경을 제안할 때는 관련 테스트와 빌드 결과를 함께 남겨주세요.

## 라이선스

[MIT License](LICENSE). 포함된 폰트·아이콘 등 외부 자산에는 각각의 라이선스가 적용됩니다. 관련 고지는 [폰트 라이선스](public/fonts/Geist-LICENSE.txt), [공급자 로고 안내](public/provider-logos/README.md), [기타 라이선스](public/licenses/)에서 확인할 수 있습니다.
