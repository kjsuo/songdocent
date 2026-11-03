import type { LangCode } from "../i18n";
import {
  browserOptionsForPlatform,
  platformCopyFor,
  type DesktopPlatform,
  type SetupBrowser,
} from "../platform/platformCopy.ts";
import type {
  OfficialSetupDestinationId,
  SetupLinkGuideId,
} from "./guideLinks";
import type { SetupStep } from "./setupState";

export type SetupGuideId = SetupLinkGuideId;

export type SetupGuideMetadata = {
  provider: "spotify" | "appleMusic" | "gemini" | "openai" | "claude";
  browser: "chrome" | "safari" | null;
  destinationIds: readonly OfficialSetupDestinationId[];
  assets: readonly `/onboarding/${string}.webp`[];
};

export type SetupGuideCopy = {
  title: string;
  body: string;
  alts: readonly string[];
  steps: readonly string[];
};

export type SetupCopy = {
  screens: Record<SetupStep, { title: string; body: string }>;
  onboardingKeychain: {
    body: string;
    sensitiveInformationWarning: string;
  };
  accessibility: {
    progressLabel: string;
    appLanguageLabel: string;
    aiModelLabel: string;
    selectedOption: string;
    currentStep: string;
    completedStep: string;
    upcomingStep: string;
  };
  keychainBullets: {
    systemAuth: string;
    localStorage: string;
    noSongDocentServer: string;
    directHttps: string;
    systemPrompt: string;
    sensitiveCredentials: string;
  };
  settingsGuide: {
    title: string;
    body: string;
    button: string;
  };
  buttons: {
    back: string;
    continue: string;
    skip: string;
    complete: string;
    validate: string;
    retry: string;
    saveAnyway: string;
    localLlmLater: string;
    cancel: string;
  };
  providerLabels: {
    spotify: string;
    appleMusic: string;
    gemini: string;
    openai: string;
    claude: string;
    localLlm: string;
  };
  providerDescriptions: {
    lyricsChoice: string;
    aiChoice: string;
  };
  validation: {
    valid: string;
    saved: string;
    invalid: string;
    unavailable: string;
    saveAnyway: string;
    cancelled: string;
    retry: string;
  };
  browserTabs: {
    chrome: string;
    safari: string;
  };
  guideLinks: {
    openLabel: string;
    openFailed: string;
  };
  localLlmExplanation: string;
  language: {
    targetLabel: string;
    targetDescription: string;
  };
  reviewLabels: {
    lyricsProvider: string;
    aiProvider: string;
    targetLanguage: string;
    connectionStatus: string;
    ready: string;
    notConfigured: string;
  };
  guides: Record<SetupGuideId, SetupGuideCopy>;
};

export const SETUP_GUIDES = {
  spotifyChrome: {
    provider: "spotify",
    browser: "chrome",
    destinationIds: ["spotifyWeb"],
    assets: [
      "/onboarding/browser/chrome-cookies.webp",
      "/onboarding/spotify/chrome-sp-dc.webp",
    ],
  },
  spotifySafari: {
    provider: "spotify",
    browser: "safari",
    destinationIds: ["spotifyWeb"],
    assets: [
      "/onboarding/browser/safari-cookies.webp",
      "/onboarding/spotify/safari-sp-dc.webp",
    ],
  },
  appleMusicChrome: {
    provider: "appleMusic",
    browser: "chrome",
    destinationIds: ["appleMusicWeb"],
    assets: [
      "/onboarding/browser/chrome-cookies.webp",
      "/onboarding/apple-music/chrome-media-user-token.webp",
    ],
  },
  appleMusicSafari: {
    provider: "appleMusic",
    browser: "safari",
    destinationIds: ["appleMusicWeb"],
    assets: [
      "/onboarding/browser/safari-cookies.webp",
      "/onboarding/apple-music/safari-media-user-token.webp",
    ],
  },
  geminiApiKey: {
    provider: "gemini",
    browser: null,
    destinationIds: ["geminiApiKeyDocs", "geminiApiKeyConsole"],
    assets: ["/onboarding/ai/gemini-api-key.webp"],
  },
  claudeApiKey: {
    provider: "claude",
    browser: null,
    destinationIds: ["claudeApiKeys", "claudeApiKeyDocs"],
    assets: [],
  },
  openAiApiKey: {
    provider: "openai",
    browser: null,
    destinationIds: ["openAiApiKeys", "openAiApiKeyHelp"],
    assets: ["/onboarding/ai/openai-api-key.webp"],
  },
} as const satisfies Record<SetupGuideId, SetupGuideMetadata>;

const CLAUDE_GUIDE_COPY: Record<LangCode, SetupGuideCopy> = {
  en: { title: "Create a Claude API key", body: "Use the official Claude Console to create a key.", alts: [], steps: ["Open the Claude Console API keys page and sign in.", "Create an API key for your workspace.", "Copy only the key value and paste it into SongDocent."] },
  ko: { title: "Claude API 키 만들기", body: "공식 Claude Console에서 키를 만드세요.", alts: [], steps: ["Claude Console의 API 키 페이지를 열고 로그인하세요.", "워크스페이스에서 API 키를 만드세요.", "키 값만 복사해 SongDocent에 붙여 넣으세요."] },
  ja: { title: "Claude APIキーを作成", body: "公式Claude Consoleでキーを作成します。", alts: [], steps: ["Claude ConsoleのAPIキーページにサインインします。", "ワークスペースでAPIキーを作成します。", "キーの値だけをコピーしてSongDocentに貼り付けます。"] },
  es: { title: "Crear una clave API de Claude", body: "Crea una clave en Claude Console.", alts: [], steps: ["Inicia sesión en la página de claves API de Claude Console.", "Crea una clave API para tu espacio de trabajo.", "Copia solo el valor de la clave y pégalo en SongDocent."] },
  fr: { title: "Créer une clé API Claude", body: "Créez une clé dans Claude Console.", alts: [], steps: ["Connectez-vous à la page des clés API de Claude Console.", "Créez une clé API pour votre espace de travail.", "Copiez uniquement la valeur de la clé dans SongDocent."] },
  de: { title: "Claude API-Schlüssel erstellen", body: "Erstelle einen Schlüssel in der Claude Console.", alts: [], steps: ["Melde dich auf der API-Schlüsselseite der Claude Console an.", "Erstelle einen API-Schlüssel für deinen Workspace.", "Kopiere nur den Schlüsselwert und füge ihn in SongDocent ein."] },
  "pt-BR": { title: "Criar chave de API Claude", body: "Crie uma chave no Claude Console.", alts: [], steps: ["Entre na página de chaves de API do Claude Console.", "Crie uma chave de API para seu workspace.", "Copie apenas o valor da chave e cole no SongDocent."] },
  "zh-CN": { title: "创建 Claude API 密钥", body: "在 Claude Console 中创建密钥。", alts: [], steps: ["登录 Claude Console 的 API 密钥页面。", "为工作区创建 API 密钥。", "只复制密钥值并粘贴到 SongDocent。"] },
};

export const SETUP_COPY = {
  en: {
    screens: {
      welcome: {
        title: "Welcome to SongDocent",
        body: "Choose the app language, then set up lyrics and translation in six short steps.",
      },
      keychain: {
        title: "Keep credentials in macOS Keychain",
        body: "Review where credentials are stored and sent before SongDocent asks macOS for Keychain access.",
      },
      lyrics: {
        title: "Choose a lyrics provider",
        body: "Set up either Spotify or Apple Music and follow the Chrome or Safari cookie guide.",
      },
      ai: {
        title: "Choose an AI provider",
        body: "Use Gemini, OpenAI, or Claude for lyric translation.",
      },
      language: {
        title: "Choose a translation language",
        body: "Select the language SongDocent should use when translating lyrics.",
      },
      review: {
        title: "Review and finish",
        body: "Check your providers, connection states, and translation language before opening the player.",
      },
    },
    onboardingKeychain: {
      body: "SongDocent uses macOS Keychain to securely store the information required to run the application.\nReview the details before SongDocent requests Keychain access from macOS.",
      sensitiveInformationWarning: "AI API keys and music streaming service cookies are sensitive information. Please do not share them with anyone.",
    },
    accessibility: {
      progressLabel: "Setup progress",
      appLanguageLabel: "App language",
      aiModelLabel: "AI model",
      selectedOption: "Selected",
      currentStep: "Current",
      completedStep: "Completed",
      upcomingStep: "Upcoming",
    },
    keychainBullets: {
      systemAuth: "Your macOS password or Touch ID is handled only by Apple's system UI. SongDocent cannot see or store it.",
      localStorage: "Credentials are stored locally in the macOS Keychain item SongDocent / secrets_v1.",
      noSongDocentServer: "No server owned by SongDocent receives your credentials.",
      directHttps: "For lyrics or translation, credentials go directly over HTTPS only to the selected Spotify, Apple Music, Gemini, OpenAI, or Claude service.",
      systemPrompt: "A macOS authentication prompt may appear, depending on your system settings.",
      sensitiveCredentials: "SP_DC and media-user-token are sensitive session credentials. Do not share them; replace expired values in Settings.",
    },
    settingsGuide: {
      title: "Setup guide",
      body: "Run the full setup guide again without resetting whether setup is completed or skipped.",
      button: "Reopen setup guide",
    },
    buttons: {
      back: "Back",
      continue: "Continue",
      skip: "Skip setup",
      complete: "Complete setup",
      validate: "Verify credential",
      retry: "Try again",
      saveAnyway: "Save anyway and continue",
      localLlmLater: "Set up a local LLM later",
      cancel: "Cancel",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini (default)",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "Local LLM",
    },
    providerDescriptions: {
      lyricsChoice: "Choose one initial lyrics source: Spotify or Apple Music.",
      aiChoice: "Use Gemini by default, or choose OpenAI or Claude.",
    },
    validation: {
      valid: "Credential verified.",
      saved: "Credential saved.",
      invalid: "This credential is invalid. Check it and try again.",
      unavailable: "Verification is temporarily unavailable because of a network or service problem.",
      saveAnyway: "You can save this credential without verification and continue.",
      cancelled: "Keychain access was cancelled. Nothing was saved.",
      retry: "Try the save again and approve the macOS prompt if it appears.",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "Open official page",
      openFailed: "The official page could not be opened. Please try again in a moment.",
    },
    localLlmExplanation: "Using Ollama, LM Studio, or another local LLM? Skip this wizard and configure it later in Settings.",
    language: {
      targetLabel: "Translation target",
      targetDescription: "Lyrics will be translated into this language.",
    },
    reviewLabels: {
      lyricsProvider: "Lyrics provider",
      aiProvider: "AI provider",
      targetLanguage: "Translation language",
      connectionStatus: "Connection status",
      ready: "Ready",
      notConfigured: "Not configured",
    },
    guides: {
      spotifyChrome: {
        title: "Find Spotify SP_DC in Chrome",
        body: "Copy only the SP_DC cookie value from Spotify's web player.",
        alts: [
          "Chrome DevTools Application panel with the Storage and Cookies navigation marked; all cookie values are hidden.",
          "Spotify cookies table with the sp_dc row marked; its value and all other cookie values are hidden.",
        ],
        steps: [
          "Open Spotify Web Player and sign in to the account you want to use.",
          "Press Command–Option–I, then open the Application tab in DevTools. Use the double-chevron menu if the tab is hidden.",
          "Under Storage, expand Cookies and select https://open.spotify.com.",
          "Find the row named sp_dc.",
          "Copy only its Value and paste it into SongDocent. Never share this value.",
        ],
      },
      spotifySafari: {
        title: "Find Spotify SP_DC in Safari",
        body: "Use Safari Web Inspector to copy only the SP_DC cookie value.",
        alts: [
          "Safari Web Inspector Storage panel with the Cookies navigation marked; all cookie values are hidden.",
          "Spotify cookies table with the sp_dc row marked; its value and all other cookie values are hidden.",
        ],
        steps: [
          "In Safari Settings, enable web developer features under Advanced if the Develop menu is not visible.",
          "Open Spotify Web Player and sign in to the account you want to use.",
          "Choose Develop > Show Web Inspector, then open the Storage tab.",
          "Select Cookies and https://open.spotify.com.",
          "Find sp_dc, copy only its Value, and paste it into SongDocent. Never share this value.",
        ],
      },
      appleMusicChrome: {
        title: "Find Apple Music media-user-token in Chrome",
        body: "Copy only the media-user-token cookie value from Apple Music.",
        alts: [
          "Chrome DevTools Application panel with the Storage and Cookies navigation marked; all cookie values are hidden.",
          "Apple Music cookies table with the media-user-token row marked; its value and all other cookie values are hidden.",
        ],
        steps: [
          "Open Apple Music on the web and sign in to the account you want to use.",
          "Press Command–Option–I, then open the Application tab in DevTools. Use the double-chevron menu if needed.",
          "Under Storage, expand Cookies and select https://music.apple.com.",
          "Find the row named media-user-token.",
          "Copy only its Value and paste it into SongDocent. Never share this value.",
        ],
      },
      appleMusicSafari: {
        title: "Find Apple Music media-user-token in Safari",
        body: "Use Safari Web Inspector to copy only the media-user-token cookie value.",
        alts: [
          "Safari Web Inspector Storage panel with the Cookies navigation marked; all cookie values are hidden.",
          "Apple Music cookies table with the media-user-token row marked; its value and all other cookie values are hidden.",
        ],
        steps: [
          "In Safari Settings, enable web developer features under Advanced if the Develop menu is not visible.",
          "Open Apple Music on the web and sign in to the account you want to use.",
          "Choose Develop > Show Web Inspector, then open the Storage tab.",
          "Select Cookies and https://music.apple.com, then find media-user-token.",
          "Copy only its Value and paste it into SongDocent. Never share this value.",
        ],
      },
      geminiApiKey: {
        title: "Create a Gemini API key",
        body: "Use Google's official documentation and Google AI Studio to create a key.",
        alts: [
          "Google AI Studio API key page with the create-key control marked and all key values hidden.",
        ],
        steps: [
          "Open the official Gemini API key documentation and review account and billing requirements.",
          "Open Google AI Studio's API key page and sign in.",
          "Create or select an API key for the appropriate Google Cloud project.",
          "Copy the key once, keep it private, and paste it into SongDocent.",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["en"],
      openAiApiKey: {
        title: "Create an OpenAI API key",
        body: "Use OpenAI's official API key page and help article to create a key.",
        alts: [
          "OpenAI API keys page with the create-secret-key control marked and all key values hidden.",
        ],
        steps: [
          "Open OpenAI's official API key help article and review account and billing requirements.",
          "Open the API keys page and sign in to the correct project.",
          "Create a new secret key with the access your project needs.",
          "Copy the key when it is shown, keep it private, and paste it into SongDocent.",
        ],
      },
    },
  },
  ko: {
    screens: {
      welcome: {
        title: "SongDocent에 오신 것을 환영해요",
        body: "앱 언어를 고른 뒤 여섯 단계로 가사와 번역을 설정하세요.",
      },
      keychain: {
        title: "자격 증명을 macOS Keychain에 안전하게 보관",
        body: "SongDocent이 macOS에 Keychain 접근을 요청하기 전에 저장 위치와 전송 범위를 확인하세요.",
      },
      lyrics: {
        title: "가사 공급자 선택",
        body: "Spotify 또는 Apple Music 하나를 설정하고 Chrome이나 Safari의 쿠키 안내를 따라가세요.",
      },
      ai: {
        title: "AI 공급자 선택",
        body: "가사 번역에 Gemini, OpenAI 또는 Claude를 사용할 수 있어요.",
      },
      language: {
        title: "번역 언어 선택",
        body: "SongDocent이 가사를 번역할 대상 언어를 선택하세요.",
      },
      review: {
        title: "검토하고 완료",
        body: "플레이어를 열기 전에 공급자, 연결 상태, 번역 언어를 확인하세요.",
      },
    },
    onboardingKeychain: {
      body: "SongDocent은 어플리케이션 구동에 필요한 사용자의 정보를 안전하게 보관하기 위해 macos의 keychain을 사용합니다.\nSongDocent이 macOS에 Keychain 접근을 요청하기 전에 세부사항을 확인해보세요.",
      sensitiveInformationWarning: "AI api key와 음악 스트리밍 서비스 쿠키는 민감한 정보입니다. 타인과의 공유는 삼가해주세요.",
    },
    accessibility: {
      progressLabel: "설정 진행 상황",
      appLanguageLabel: "앱 언어",
      aiModelLabel: "AI 모델",
      selectedOption: "선택됨",
      currentStep: "현재",
      completedStep: "완료",
      upcomingStep: "예정",
    },
    keychainBullets: {
      systemAuth: "macOS 암호나 Touch ID는 Apple 시스템 화면에서만 처리됩니다. SongDocent은 이를 보거나 저장할 수 없어요.",
      localStorage: "자격 증명은 macOS Keychain의 SongDocent / secrets_v1 항목에 로컬로 저장됩니다.",
      noSongDocentServer: "SongDocent이 운영하는 서버는 자격 증명을 받지 않습니다.",
      directHttps: "가사나 번역 요청 시 선택한 Spotify, Apple Music, Gemini, OpenAI 또는 Claude 서비스로만 HTTPS를 통해 직접 전송됩니다.",
      systemPrompt: "시스템 설정에 따라 macOS 인증창이 나타날 수 있습니다.",
      sensitiveCredentials: "SP_DC와 media-user-token은 민감한 세션 자격 증명입니다. 공유하지 말고, 만료되면 설정에서 교체하세요.",
    },
    settingsGuide: {
      title: "설정 가이드",
      body: "완료 또는 건너뜀 상태를 초기화하지 않고 전체 설정 가이드를 다시 실행합니다.",
      button: "설정 가이드 다시 열기",
    },
    buttons: {
      back: "이전",
      continue: "계속",
      skip: "설정 건너뛰기",
      complete: "설정 완료",
      validate: "확인",
      retry: "다시 시도",
      saveAnyway: "그래도 저장하고 계속",
      localLlmLater: "로컬 LLM은 나중에 설정",
      cancel: "취소",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini (기본값)",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "로컬 LLM",
    },
    providerDescriptions: {
      lyricsChoice: "초기 가사 공급자로 Spotify 또는 Apple Music 중 하나를 선택하세요.",
      aiChoice: "기본 Gemini를 사용하거나 OpenAI 또는 Claude를 선택하세요.",
    },
    validation: {
      valid: "자격 증명을 확인했어요.",
      saved: "자격 증명을 저장했어요.",
      invalid: "올바르지 않은 자격 증명입니다. 확인한 뒤 다시 시도하세요.",
      unavailable: "네트워크 또는 서비스 문제로 지금은 검증할 수 없어요.",
      saveAnyway: "검증 없이 자격 증명을 저장하고 계속할 수 있어요.",
      cancelled: "Keychain 접근이 취소되어 아무것도 저장하지 않았어요.",
      retry: "저장을 다시 시도하고 macOS 인증창이 나타나면 승인하세요.",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "공식 페이지 열기",
      openFailed: "공식 페이지를 열 수 없어요. 잠시 후 다시 시도해 주세요.",
    },
    localLlmExplanation: "Ollama, LM Studio 또는 다른 로컬 LLM을 사용하나요? 이 마법사를 건너뛰고 나중에 설정에서 설정하세요.",
    language: {
      targetLabel: "번역 대상",
      targetDescription: "가사를 이 언어로 번역합니다.",
    },
    reviewLabels: {
      lyricsProvider: "가사 공급자",
      aiProvider: "AI 공급자",
      targetLanguage: "번역 언어",
      connectionStatus: "연결 상태",
      ready: "준비됨",
      notConfigured: "설정 안 됨",
    },
    guides: {
      spotifyChrome: {
        title: "Chrome에서 Spotify SP_DC 찾기",
        body: "Spotify 웹 플레이어에서 SP_DC 쿠키 값만 복사하세요.",
        alts: [
          "Storage와 Cookies 탐색 위치가 표시된 Chrome DevTools Application 패널. 모든 쿠키 값은 가려져 있습니다.",
          "sp_dc 행이 표시된 Spotify 쿠키 표. 해당 값과 다른 모든 쿠키 값은 가려져 있습니다.",
        ],
        steps: [
          "Spotify 웹 플레이어를 열고 사용할 계정으로 로그인하세요.",
          "Command–Option–I를 누르고 DevTools의 Application 탭을 여세요. 탭이 숨겨졌다면 이중 화살표 메뉴를 사용하세요.",
          "Storage 아래에서 Cookies를 펼치고 https://open.spotify.com을 선택하세요.",
          "이름이 sp_dc인 행을 찾으세요.",
          "Value만 복사해 SongDocent에 붙여 넣으세요. 이 값은 절대 공유하지 마세요.",
        ],
      },
      spotifySafari: {
        title: "Safari에서 Spotify SP_DC 찾기",
        body: "Safari 웹 속성에서 SP_DC 쿠키 값만 복사하세요.",
        alts: [
          "Cookies 탐색 위치가 표시된 Safari 웹 속성 Storage 패널. 모든 쿠키 값은 가려져 있습니다.",
          "sp_dc 행이 표시된 Spotify 쿠키 표. 해당 값과 다른 모든 쿠키 값은 가려져 있습니다.",
        ],
        steps: [
          "개발자용 메뉴가 보이지 않으면 Safari 설정의 고급에서 웹 개발자용 기능을 켜세요.",
          "Spotify 웹 플레이어를 열고 사용할 계정으로 로그인하세요.",
          "개발자용 > 웹 속성 보기를 선택하고 Storage 탭을 여세요.",
          "Cookies와 https://open.spotify.com을 선택하세요.",
          "sp_dc를 찾아 Value만 복사해 SongDocent에 붙여 넣으세요. 이 값은 공유하지 마세요.",
        ],
      },
      appleMusicChrome: {
        title: "Chrome에서 Apple Music media-user-token 찾기",
        body: "Apple Music에서 media-user-token 쿠키 값만 복사하세요.",
        alts: [
          "Storage와 Cookies 탐색 위치가 표시된 Chrome DevTools Application 패널. 모든 쿠키 값은 가려져 있습니다.",
          "media-user-token 행이 표시된 Apple Music 쿠키 표. 해당 값과 다른 모든 쿠키 값은 가려져 있습니다.",
        ],
        steps: [
          "웹 Apple Music을 열고 사용할 계정으로 로그인하세요.",
          "Command–Option–I를 누르고 DevTools의 Application 탭을 여세요. 필요하면 이중 화살표 메뉴를 사용하세요.",
          "Storage 아래에서 Cookies를 펼치고 https://music.apple.com을 선택하세요.",
          "이름이 media-user-token인 행을 찾으세요.",
          "Value만 복사해 SongDocent에 붙여 넣으세요. 이 값은 절대 공유하지 마세요.",
        ],
      },
      appleMusicSafari: {
        title: "Safari에서 Apple Music media-user-token 찾기",
        body: "Safari 웹 속성에서 media-user-token 쿠키 값만 복사하세요.",
        alts: [
          "Cookies 탐색 위치가 표시된 Safari 웹 속성 Storage 패널. 모든 쿠키 값은 가려져 있습니다.",
          "media-user-token 행이 표시된 Apple Music 쿠키 표. 해당 값과 다른 모든 쿠키 값은 가려져 있습니다.",
        ],
        steps: [
          "개발자용 메뉴가 보이지 않으면 Safari 설정의 고급에서 웹 개발자용 기능을 켜세요.",
          "웹 Apple Music을 열고 사용할 계정으로 로그인하세요.",
          "개발자용 > 웹 속성 보기를 선택하고 Storage 탭을 여세요.",
          "Cookies와 https://music.apple.com을 선택한 뒤 media-user-token을 찾으세요.",
          "Value만 복사해 SongDocent에 붙여 넣으세요. 이 값은 공유하지 마세요.",
        ],
      },
      geminiApiKey: {
        title: "Gemini API 키 만들기",
        body: "Google 공식 문서와 Google AI Studio에서 키를 만드세요.",
        alts: [
          "키 만들기 위치가 표시되고 모든 키 값이 가려진 Google AI Studio API 키 페이지.",
        ],
        steps: [
          "Gemini API 키 공식 문서를 열고 계정과 결제 요구 사항을 확인하세요.",
          "Google AI Studio API 키 페이지를 열고 로그인하세요.",
          "알맞은 Google Cloud 프로젝트에서 API 키를 만들거나 선택하세요.",
          "키를 한 번 복사해 안전하게 보관하고 SongDocent에 붙여 넣으세요.",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["ko"],
      openAiApiKey: {
        title: "OpenAI API 키 만들기",
        body: "OpenAI 공식 API 키 페이지와 도움말을 이용해 키를 만드세요.",
        alts: [
          "비밀 키 만들기 위치가 표시되고 모든 키 값이 가려진 OpenAI API 키 페이지.",
        ],
        steps: [
          "OpenAI 공식 API 키 도움말을 열고 계정과 결제 요구 사항을 확인하세요.",
          "API 키 페이지를 열고 올바른 프로젝트에 로그인하세요.",
          "프로젝트에 필요한 권한으로 새 비밀 키를 만드세요.",
          "표시된 키를 복사해 비공개로 보관하고 SongDocent에 붙여 넣으세요.",
        ],
      },
    },
  },
  ja: {
    screens: {
      welcome: {
        title: "SongDocentへようこそ",
        body: "アプリの言語を選び、6つの短いステップで歌詞と翻訳を設定します。",
      },
      keychain: {
        title: "認証情報をmacOS Keychainに安全に保存",
        body: "SongDocentがmacOSにKeychainアクセスを求める前に、保存先と送信範囲を確認してください。",
      },
      lyrics: {
        title: "歌詞プロバイダーを選択",
        body: "SpotifyまたはApple Musicを設定し、ChromeかSafariのCookie手順に従います。",
      },
      ai: {
        title: "AIプロバイダーを選択",
        body: "歌詞の翻訳にはGemini、OpenAI、Claudeを利用できます。",
      },
      language: {
        title: "翻訳言語を選択",
        body: "SongDocentが歌詞を翻訳する言語を選んでください。",
      },
      review: {
        title: "確認して完了",
        body: "プレイヤーを開く前に、プロバイダー、接続状態、翻訳言語を確認します。",
      },
    },
    onboardingKeychain: {
      body: "SongDocentは、アプリケーションの動作に必要なユーザー情報を安全に保管するためにmacOSのKeychainを使用します。\nSongDocentがmacOSにKeychainへのアクセスを要求する前に、詳細をご確認ください。",
      sensitiveInformationWarning: "AI APIキーと音楽ストリーミングサービスのCookieは機密情報です。他人と共有しないでください。",
    },
    accessibility: {
      progressLabel: "セットアップの進行状況",
      appLanguageLabel: "アプリの言語",
      aiModelLabel: "AIモデル",
      selectedOption: "選択済み",
      currentStep: "現在",
      completedStep: "完了",
      upcomingStep: "予定",
    },
    keychainBullets: {
      systemAuth: "macOSのパスワードまたはTouch IDはAppleのシステム画面だけで処理されます。SongDocentが見たり保存したりすることはできません。",
      localStorage: "認証情報はmacOS KeychainのSongDocent / secrets_v1項目にローカル保存されます。",
      noSongDocentServer: "SongDocentが所有するサーバーへ認証情報が送られることはありません。",
      directHttps: "歌詞や翻訳の要求時に限り、選択したSpotify、Apple Music、Gemini、OpenAI、ClaudeへHTTPSで直接送信されます。",
      systemPrompt: "システム設定によってはmacOSの認証画面が表示される場合があります。",
      sensitiveCredentials: "SP_DCとmedia-user-tokenは機密性の高いセッション認証情報です。共有せず、期限切れ時は設定で交換してください。",
    },
    settingsGuide: {
      title: "セットアップガイド",
      body: "セットアップの完了またはスキップ状態をリセットせずに、ガイド全体をもう一度実行します。",
      button: "セットアップガイドを再度開く",
    },
    buttons: {
      back: "戻る",
      continue: "続ける",
      skip: "設定をスキップ",
      complete: "設定を完了",
      validate: "認証情報を確認",
      retry: "もう一度試す",
      saveAnyway: "検証せず保存して続ける",
      localLlmLater: "ローカルLLMは後で設定",
      cancel: "キャンセル",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini（既定）",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "ローカルLLM",
    },
    providerDescriptions: {
      lyricsChoice: "最初の歌詞ソースとしてSpotifyかApple Musicのどちらかを選びます。",
      aiChoice: "既定のGeminiを使うか、OpenAIまたはClaudeを選びます。",
    },
    validation: {
      valid: "認証情報を確認しました。",
      saved: "認証情報を保存しました。",
      invalid: "認証情報が無効です。内容を確認して再試行してください。",
      unavailable: "ネットワークまたはサービスの問題により、現在は検証できません。",
      saveAnyway: "検証せずに認証情報を保存して続けることもできます。",
      cancelled: "Keychainアクセスがキャンセルされました。何も保存されていません。",
      retry: "もう一度保存し、macOSの認証画面が表示された場合は承認してください。",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "公式ページを開く",
      openFailed: "公式ページを開けませんでした。しばらくしてからもう一度お試しください。",
    },
    localLlmExplanation: "Ollama、LM StudioなどのローカルLLMを使いますか？このウィザードをスキップし、後で設定から設定してください。",
    language: {
      targetLabel: "翻訳先",
      targetDescription: "歌詞はこの言語に翻訳されます。",
    },
    reviewLabels: {
      lyricsProvider: "歌詞プロバイダー",
      aiProvider: "AIプロバイダー",
      targetLanguage: "翻訳言語",
      connectionStatus: "接続状態",
      ready: "準備完了",
      notConfigured: "未設定",
    },
    guides: {
      spotifyChrome: {
        title: "ChromeでSpotifyのSP_DCを探す",
        body: "SpotifyウェブプレイヤーからSP_DC Cookieの値だけをコピーします。",
        alts: [
          "StorageとCookiesの操作箇所が示されたChrome DevToolsのApplicationパネル。すべてのCookie値は隠されています。",
          "sp_dc行が示されたSpotifyのCookie一覧。その値とほかのCookie値はすべて隠されています。",
        ],
        steps: [
          "Spotifyウェブプレイヤーを開き、利用するアカウントでログインします。",
          "Command–Option–Iを押し、DevToolsのApplicationタブを開きます。隠れている場合は二重山括弧メニューを使います。",
          "StorageのCookiesを展開し、https://open.spotify.comを選びます。",
          "名前がsp_dcの行を探します。",
          "ValueだけをコピーしてSongDocentに貼り付けます。この値は絶対に共有しないでください。",
        ],
      },
      spotifySafari: {
        title: "SafariでSpotifyのSP_DCを探す",
        body: "Safari Web InspectorでSP_DC Cookieの値だけをコピーします。",
        alts: [
          "Cookiesの操作箇所が示されたSafari Web InspectorのStorageパネル。すべてのCookie値は隠されています。",
          "sp_dc行が示されたSpotifyのCookie一覧。その値とほかのCookie値はすべて隠されています。",
        ],
        steps: [
          "開発メニューがない場合、Safari設定の詳細からWebデベロッパ用機能を有効にします。",
          "Spotifyウェブプレイヤーを開き、利用するアカウントでログインします。",
          "開発 > Webインスペクタを表示を選び、Storageタブを開きます。",
          "Cookiesとhttps://open.spotify.comを選びます。",
          "sp_dcを探し、ValueだけをコピーしてSongDocentに貼り付けます。この値は共有しないでください。",
        ],
      },
      appleMusicChrome: {
        title: "ChromeでApple Musicのmedia-user-tokenを探す",
        body: "Apple Musicからmedia-user-token Cookieの値だけをコピーします。",
        alts: [
          "StorageとCookiesの操作箇所が示されたChrome DevToolsのApplicationパネル。すべてのCookie値は隠されています。",
          "media-user-token行が示されたApple MusicのCookie一覧。その値とほかのCookie値はすべて隠されています。",
        ],
        steps: [
          "Web版Apple Musicを開き、利用するアカウントでログインします。",
          "Command–Option–Iを押し、DevToolsのApplicationタブを開きます。必要なら二重山括弧メニューを使います。",
          "StorageのCookiesを展開し、https://music.apple.comを選びます。",
          "名前がmedia-user-tokenの行を探します。",
          "ValueだけをコピーしてSongDocentに貼り付けます。この値は絶対に共有しないでください。",
        ],
      },
      appleMusicSafari: {
        title: "SafariでApple Musicのmedia-user-tokenを探す",
        body: "Safari Web Inspectorでmedia-user-token Cookieの値だけをコピーします。",
        alts: [
          "Cookiesの操作箇所が示されたSafari Web InspectorのStorageパネル。すべてのCookie値は隠されています。",
          "media-user-token行が示されたApple MusicのCookie一覧。その値とほかのCookie値はすべて隠されています。",
        ],
        steps: [
          "開発メニューがない場合、Safari設定の詳細からWebデベロッパ用機能を有効にします。",
          "Web版Apple Musicを開き、利用するアカウントでログインします。",
          "開発 > Webインスペクタを表示を選び、Storageタブを開きます。",
          "Cookiesとhttps://music.apple.comを選び、media-user-tokenを探します。",
          "ValueだけをコピーしてSongDocentに貼り付けます。この値は共有しないでください。",
        ],
      },
      geminiApiKey: {
        title: "Gemini APIキーを作成",
        body: "Googleの公式ドキュメントとGoogle AI Studioでキーを作成します。",
        alts: [
          "キー作成位置に印があり、すべてのキー値が隠されたGoogle AI Studio APIキーページ。",
        ],
        steps: [
          "Gemini APIキーの公式ドキュメントを開き、アカウントと請求要件を確認します。",
          "Google AI StudioのAPIキーページを開いてログインします。",
          "適切なGoogle CloudプロジェクトでAPIキーを作成または選択します。",
          "キーを一度コピーして非公開で保管し、SongDocentに貼り付けます。",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["ja"],
      openAiApiKey: {
        title: "OpenAI APIキーを作成",
        body: "OpenAI公式のAPIキーページとヘルプ記事でキーを作成します。",
        alts: [
          "シークレットキー作成位置に印があり、すべてのキー値が隠されたOpenAI APIキーページ。",
        ],
        steps: [
          "OpenAI公式のAPIキーヘルプを開き、アカウントと請求要件を確認します。",
          "APIキーページを開き、正しいプロジェクトにログインします。",
          "プロジェクトに必要な権限で新しいシークレットキーを作成します。",
          "表示されたキーをコピーして非公開で保管し、SongDocentに貼り付けます。",
        ],
      },
    },
  },
  es: {
    screens: {
      welcome: {
        title: "Te damos la bienvenida a SongDocent",
        body: "Elige el idioma de la app y configura las letras y la traducción en seis pasos breves.",
      },
      keychain: {
        title: "Guarda tus credenciales en Keychain de macOS",
        body: "Revisa dónde se guardan y envían las credenciales antes de que SongDocent solicite acceso a Keychain.",
      },
      lyrics: {
        title: "Elige un proveedor de letras",
        body: "Configura Spotify o Apple Music y sigue la guía de cookies para Chrome o Safari.",
      },
      ai: {
        title: "Elige un proveedor de IA",
        body: "Puedes usar Gemini, OpenAI o Claude para traducir letras.",
      },
      language: {
        title: "Elige el idioma de traducción",
        body: "Selecciona el idioma al que SongDocent debe traducir las letras.",
      },
      review: {
        title: "Revisa y finaliza",
        body: "Comprueba los proveedores, los estados de conexión y el idioma antes de abrir el reproductor.",
      },
    },
    onboardingKeychain: {
      body: "SongDocent utiliza Keychain de macOS para guardar de forma segura la información necesaria para ejecutar la aplicación.\nRevisa los detalles antes de que SongDocent solicite acceso a Keychain en macOS.",
      sensitiveInformationWarning: "Las claves de API de IA y las cookies de los servicios de música en streaming son información confidencial. No las compartas con nadie.",
    },
    accessibility: {
      progressLabel: "Progreso de configuración",
      appLanguageLabel: "Idioma de la aplicación",
      aiModelLabel: "Modelo de IA",
      selectedOption: "Seleccionado",
      currentStep: "Actual",
      completedStep: "Completado",
      upcomingStep: "Próximo",
    },
    keychainBullets: {
      systemAuth: "Tu contraseña de macOS o Touch ID solo se procesa en la interfaz del sistema de Apple. SongDocent no puede verla ni guardarla.",
      localStorage: "Las credenciales se guardan localmente en el elemento SongDocent / secrets_v1 de Keychain de macOS.",
      noSongDocentServer: "Ningún servidor propiedad de SongDocent recibe tus credenciales.",
      directHttps: "Para letras o traducciones, se envían directamente por HTTPS solo al servicio elegido: Spotify, Apple Music, Gemini, OpenAI o Claude.",
      systemPrompt: "Según la configuración del sistema, puede aparecer una solicitud de autenticación de macOS.",
      sensitiveCredentials: "SP_DC y media-user-token son credenciales de sesión confidenciales. No las compartas; reemplázalas en Ajustes cuando caduquen.",
    },
    settingsGuide: {
      title: "Guía de configuración",
      body: "Vuelve a ejecutar toda la guía de configuración sin restablecer el estado completado u omitido.",
      button: "Volver a abrir la guía",
    },
    buttons: {
      back: "Atrás",
      continue: "Continuar",
      skip: "Omitir configuración",
      complete: "Completar configuración",
      validate: "Verificar credencial",
      retry: "Reintentar",
      saveAnyway: "Guardar de todos modos y continuar",
      localLlmLater: "Configurar un LLM local después",
      cancel: "Cancelar",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini (predeterminado)",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "LLM local",
    },
    providerDescriptions: {
      lyricsChoice: "Elige una fuente inicial de letras: Spotify o Apple Music.",
      aiChoice: "Usa Gemini de forma predeterminada o elige OpenAI o Claude.",
    },
    validation: {
      valid: "Credencial verificada.",
      saved: "Credencial guardada.",
      invalid: "La credencial no es válida. Compruébala e inténtalo de nuevo.",
      unavailable: "La verificación no está disponible temporalmente por un problema de red o del servicio.",
      saveAnyway: "Puedes guardar la credencial sin verificarla y continuar.",
      cancelled: "Se canceló el acceso a Keychain. No se guardó nada.",
      retry: "Vuelve a guardar y aprueba la solicitud de macOS si aparece.",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "Abrir página oficial",
      openFailed: "No se pudo abrir la página oficial. Inténtalo de nuevo en un momento.",
    },
    localLlmExplanation: "¿Usas Ollama, LM Studio u otro LLM local? Omite este asistente y configúralo más tarde en Ajustes.",
    language: {
      targetLabel: "Idioma de destino",
      targetDescription: "Las letras se traducirán a este idioma.",
    },
    reviewLabels: {
      lyricsProvider: "Proveedor de letras",
      aiProvider: "Proveedor de IA",
      targetLanguage: "Idioma de traducción",
      connectionStatus: "Estado de conexión",
      ready: "Listo",
      notConfigured: "Sin configurar",
    },
    guides: {
      spotifyChrome: {
        title: "Busca SP_DC de Spotify en Chrome",
        body: "Copia solo el valor de la cookie SP_DC del reproductor web de Spotify.",
        alts: [
          "Panel Application de DevTools de Chrome con la navegación Storage y Cookies señalada; todos los valores están ocultos.",
          "Tabla de cookies de Spotify con la fila sp_dc señalada; su valor y los demás valores están ocultos.",
        ],
        steps: [
          "Abre el reproductor web de Spotify e inicia sesión con la cuenta que quieras usar.",
          "Pulsa Command–Option–I y abre la pestaña Application de DevTools. Usa el menú de doble flecha si está oculta.",
          "En Storage, despliega Cookies y selecciona https://open.spotify.com.",
          "Busca la fila llamada sp_dc.",
          "Copia solo su Value y pégalo en SongDocent. No compartas nunca este valor.",
        ],
      },
      spotifySafari: {
        title: "Busca SP_DC de Spotify en Safari",
        body: "Usa el inspector web de Safari para copiar solo el valor de la cookie SP_DC.",
        alts: [
          "Panel Storage del inspector web de Safari con la navegación Cookies señalada; todos los valores están ocultos.",
          "Tabla de cookies de Spotify con la fila sp_dc señalada; su valor y los demás valores están ocultos.",
        ],
        steps: [
          "Si no aparece el menú Desarrollo, activa las funciones para desarrolladores web en los ajustes avanzados de Safari.",
          "Abre el reproductor web de Spotify e inicia sesión con la cuenta que quieras usar.",
          "Elige Desarrollo > Mostrar inspector web y abre la pestaña Storage.",
          "Selecciona Cookies y https://open.spotify.com.",
          "Busca sp_dc, copia solo su Value y pégalo en SongDocent. No compartas este valor.",
        ],
      },
      appleMusicChrome: {
        title: "Busca media-user-token de Apple Music en Chrome",
        body: "Copia solo el valor de la cookie media-user-token de Apple Music.",
        alts: [
          "Panel Application de DevTools de Chrome con la navegación Storage y Cookies señalada; todos los valores están ocultos.",
          "Tabla de cookies de Apple Music con la fila media-user-token señalada; su valor y los demás valores están ocultos.",
        ],
        steps: [
          "Abre Apple Music en la web e inicia sesión con la cuenta que quieras usar.",
          "Pulsa Command–Option–I y abre la pestaña Application de DevTools. Usa el menú de doble flecha si hace falta.",
          "En Storage, despliega Cookies y selecciona https://music.apple.com.",
          "Busca la fila llamada media-user-token.",
          "Copia solo su Value y pégalo en SongDocent. No compartas nunca este valor.",
        ],
      },
      appleMusicSafari: {
        title: "Busca media-user-token de Apple Music en Safari",
        body: "Usa el inspector web de Safari para copiar solo el valor de media-user-token.",
        alts: [
          "Panel Storage del inspector web de Safari con la navegación Cookies señalada; todos los valores están ocultos.",
          "Tabla de cookies de Apple Music con la fila media-user-token señalada; su valor y los demás valores están ocultos.",
        ],
        steps: [
          "Si no aparece el menú Desarrollo, activa las funciones para desarrolladores web en los ajustes avanzados de Safari.",
          "Abre Apple Music en la web e inicia sesión con la cuenta que quieras usar.",
          "Elige Desarrollo > Mostrar inspector web y abre la pestaña Storage.",
          "Selecciona Cookies y https://music.apple.com, y busca media-user-token.",
          "Copia solo su Value y pégalo en SongDocent. No compartas este valor.",
        ],
      },
      geminiApiKey: {
        title: "Crea una clave de API de Gemini",
        body: "Usa la documentación oficial de Google y Google AI Studio para crear una clave.",
        alts: [
          "Página de claves de API de Google AI Studio con el control para crear una clave señalado y todos los valores ocultos.",
        ],
        steps: [
          "Abre la documentación oficial de claves de Gemini y revisa los requisitos de cuenta y facturación.",
          "Abre la página de claves de API de Google AI Studio e inicia sesión.",
          "Crea o elige una clave para el proyecto de Google Cloud adecuado.",
          "Copia la clave una vez, mantenla privada y pégala en SongDocent.",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["es"],
      openAiApiKey: {
        title: "Crea una clave de API de OpenAI",
        body: "Usa la página oficial de claves y el artículo de ayuda de OpenAI.",
        alts: [
          "Página de claves de API de OpenAI con el control para crear una clave secreta señalado y todos los valores ocultos.",
        ],
        steps: [
          "Abre el artículo oficial de OpenAI sobre claves de API y revisa los requisitos de cuenta y facturación.",
          "Abre la página de claves e inicia sesión en el proyecto correcto.",
          "Crea una nueva clave secreta con el acceso que necesite tu proyecto.",
          "Copia la clave cuando aparezca, mantenla privada y pégala en SongDocent.",
        ],
      },
    },
  },
  fr: {
    screens: {
      welcome: {
        title: "Bienvenue dans SongDocent",
        body: "Choisissez la langue de l'app, puis configurez les paroles et la traduction en six étapes.",
      },
      keychain: {
        title: "Conservez vos identifiants dans le trousseau macOS",
        body: "Vérifiez où les identifiants sont stockés et envoyés avant que SongDocent demande l'accès au trousseau.",
      },
      lyrics: {
        title: "Choisissez un fournisseur de paroles",
        body: "Configurez Spotify ou Apple Music, puis suivez le guide des cookies pour Chrome ou Safari.",
      },
      ai: {
        title: "Choisissez un fournisseur d'IA",
        body: "Vous pouvez utiliser Gemini, OpenAI ou Claude pour traduire les paroles.",
      },
      language: {
        title: "Choisissez la langue de traduction",
        body: "Sélectionnez la langue dans laquelle SongDocent doit traduire les paroles.",
      },
      review: {
        title: "Vérifiez et terminez",
        body: "Vérifiez les fournisseurs, les états de connexion et la langue avant d'ouvrir le lecteur.",
      },
    },
    onboardingKeychain: {
      body: "SongDocent utilise le trousseau macOS pour stocker de manière sécurisée les informations nécessaires au fonctionnement de l’application.\nConsultez les détails avant que SongDocent demande l’accès au trousseau macOS.",
      sensitiveInformationWarning: "Les clés API d’IA et les cookies des services de streaming musical sont des informations sensibles. Ne les partagez avec personne.",
    },
    accessibility: {
      progressLabel: "Progression de la configuration",
      appLanguageLabel: "Langue de l’application",
      aiModelLabel: "Modèle d’IA",
      selectedOption: "Sélectionné",
      currentStep: "Étape actuelle",
      completedStep: "Terminé",
      upcomingStep: "À venir",
    },
    keychainBullets: {
      systemAuth: "Votre mot de passe macOS ou Touch ID est traité uniquement par l'interface système d'Apple. SongDocent ne peut ni le voir ni le stocker.",
      localStorage: "Les identifiants sont stockés localement dans l'élément SongDocent / secrets_v1 du trousseau macOS.",
      noSongDocentServer: "Aucun serveur appartenant à SongDocent ne reçoit vos identifiants.",
      directHttps: "Pour les paroles ou la traduction, ils sont envoyés directement par HTTPS uniquement au service choisi : Spotify, Apple Music, Gemini, OpenAI ou Claude.",
      systemPrompt: "Selon les réglages du système, une demande d'authentification macOS peut apparaître.",
      sensitiveCredentials: "SP_DC et media-user-token sont des identifiants de session sensibles. Ne les partagez pas et remplacez-les dans Réglages à leur expiration.",
    },
    settingsGuide: {
      title: "Guide de configuration",
      body: "Relancez le guide de configuration complet sans réinitialiser l’état terminé ou ignoré.",
      button: "Rouvrir le guide de configuration",
    },
    buttons: {
      back: "Retour",
      continue: "Continuer",
      skip: "Ignorer la configuration",
      complete: "Terminer la configuration",
      validate: "Vérifier l’identifiant",
      retry: "Réessayer",
      saveAnyway: "Enregistrer quand même et continuer",
      localLlmLater: "Configurer un LLM local plus tard",
      cancel: "Annuler",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini (par défaut)",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "LLM local",
    },
    providerDescriptions: {
      lyricsChoice: "Choisissez une source initiale de paroles : Spotify ou Apple Music.",
      aiChoice: "Utilisez Gemini par défaut ou choisissez OpenAI ou Claude.",
    },
    validation: {
      valid: "Identifiant vérifié.",
      saved: "Identifiant enregistré.",
      invalid: "Cet identifiant n'est pas valide. Vérifiez-le et réessayez.",
      unavailable: "La vérification est temporairement indisponible en raison d'un problème réseau ou de service.",
      saveAnyway: "Vous pouvez enregistrer cet identifiant sans vérification et continuer.",
      cancelled: "L'accès au trousseau a été annulé. Rien n'a été enregistré.",
      retry: "Réessayez l'enregistrement et approuvez la demande macOS si elle apparaît.",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "Ouvrir la page officielle",
      openFailed: "Impossible d'ouvrir la page officielle. Réessayez dans un instant.",
    },
    localLlmExplanation: "Vous utilisez Ollama, LM Studio ou un autre LLM local ? Ignorez cet assistant et configurez-le plus tard dans Réglages.",
    language: {
      targetLabel: "Langue cible",
      targetDescription: "Les paroles seront traduites dans cette langue.",
    },
    reviewLabels: {
      lyricsProvider: "Fournisseur de paroles",
      aiProvider: "Fournisseur d'IA",
      targetLanguage: "Langue de traduction",
      connectionStatus: "État de la connexion",
      ready: "Prêt",
      notConfigured: "Non configuré",
    },
    guides: {
      spotifyChrome: {
        title: "Trouver le SP_DC Spotify dans Chrome",
        body: "Copiez uniquement la valeur du cookie SP_DC depuis le lecteur web Spotify.",
        alts: [
          "Panneau Application des DevTools Chrome avec la navigation Storage et Cookies repérée ; toutes les valeurs sont masquées.",
          "Tableau des cookies Spotify avec la ligne sp_dc repérée ; sa valeur et toutes les autres valeurs sont masquées.",
        ],
        steps: [
          "Ouvrez le lecteur web Spotify et connectez-vous au compte à utiliser.",
          "Appuyez sur Command–Option–I, puis ouvrez l'onglet Application de DevTools. Utilisez le menu à double chevron s'il est masqué.",
          "Sous Storage, développez Cookies et sélectionnez https://open.spotify.com.",
          "Repérez la ligne nommée sp_dc.",
          "Copiez uniquement sa Value et collez-la dans SongDocent. Ne partagez jamais cette valeur.",
        ],
      },
      spotifySafari: {
        title: "Trouver le SP_DC Spotify dans Safari",
        body: "Utilisez l'inspecteur web de Safari pour copier uniquement la valeur du cookie SP_DC.",
        alts: [
          "Panneau Storage de l'inspecteur web Safari avec la navigation Cookies repérée ; toutes les valeurs sont masquées.",
          "Tableau des cookies Spotify avec la ligne sp_dc repérée ; sa valeur et toutes les autres valeurs sont masquées.",
        ],
        steps: [
          "Si le menu Développement n'apparaît pas, activez les fonctions pour développeurs web dans les réglages avancés de Safari.",
          "Ouvrez le lecteur web Spotify et connectez-vous au compte à utiliser.",
          "Choisissez Développement > Afficher l'inspecteur web, puis ouvrez l'onglet Storage.",
          "Sélectionnez Cookies et https://open.spotify.com.",
          "Repérez sp_dc, copiez uniquement sa Value et collez-la dans SongDocent. Ne partagez pas cette valeur.",
        ],
      },
      appleMusicChrome: {
        title: "Trouver media-user-token d'Apple Music dans Chrome",
        body: "Copiez uniquement la valeur du cookie media-user-token depuis Apple Music.",
        alts: [
          "Panneau Application des DevTools Chrome avec la navigation Storage et Cookies repérée ; toutes les valeurs sont masquées.",
          "Tableau des cookies Apple Music avec la ligne media-user-token repérée ; sa valeur et toutes les autres valeurs sont masquées.",
        ],
        steps: [
          "Ouvrez Apple Music sur le web et connectez-vous au compte à utiliser.",
          "Appuyez sur Command–Option–I, puis ouvrez l'onglet Application de DevTools. Utilisez le menu à double chevron si nécessaire.",
          "Sous Storage, développez Cookies et sélectionnez https://music.apple.com.",
          "Repérez la ligne nommée media-user-token.",
          "Copiez uniquement sa Value et collez-la dans SongDocent. Ne partagez jamais cette valeur.",
        ],
      },
      appleMusicSafari: {
        title: "Trouver media-user-token d'Apple Music dans Safari",
        body: "Utilisez l'inspecteur web de Safari pour copier uniquement la valeur de media-user-token.",
        alts: [
          "Panneau Storage de l'inspecteur web Safari avec la navigation Cookies repérée ; toutes les valeurs sont masquées.",
          "Tableau des cookies Apple Music avec la ligne media-user-token repérée ; sa valeur et toutes les autres valeurs sont masquées.",
        ],
        steps: [
          "Si le menu Développement n'apparaît pas, activez les fonctions pour développeurs web dans les réglages avancés de Safari.",
          "Ouvrez Apple Music sur le web et connectez-vous au compte à utiliser.",
          "Choisissez Développement > Afficher l'inspecteur web, puis ouvrez l'onglet Storage.",
          "Sélectionnez Cookies et https://music.apple.com, puis repérez media-user-token.",
          "Copiez uniquement sa Value et collez-la dans SongDocent. Ne partagez pas cette valeur.",
        ],
      },
      geminiApiKey: {
        title: "Créer une clé API Gemini",
        body: "Utilisez la documentation officielle de Google et Google AI Studio pour créer une clé.",
        alts: [
          "Page des clés API de Google AI Studio avec la commande de création repérée et toutes les valeurs masquées.",
        ],
        steps: [
          "Ouvrez la documentation officielle des clés Gemini et vérifiez les conditions de compte et de facturation.",
          "Ouvrez la page des clés API de Google AI Studio et connectez-vous.",
          "Créez ou sélectionnez une clé pour le bon projet Google Cloud.",
          "Copiez la clé une fois, gardez-la privée et collez-la dans SongDocent.",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["fr"],
      openAiApiKey: {
        title: "Créer une clé API OpenAI",
        body: "Utilisez la page officielle des clés et l'article d'aide d'OpenAI.",
        alts: [
          "Page des clés API OpenAI avec la commande de création d'une clé secrète repérée et toutes les valeurs masquées.",
        ],
        steps: [
          "Ouvrez l'article d'aide officiel d'OpenAI sur les clés API et vérifiez les conditions de compte et de facturation.",
          "Ouvrez la page des clés et connectez-vous au bon projet.",
          "Créez une nouvelle clé secrète avec les accès nécessaires au projet.",
          "Copiez la clé lorsqu'elle apparaît, gardez-la privée et collez-la dans SongDocent.",
        ],
      },
    },
  },
  de: {
    screens: {
      welcome: {
        title: "Willkommen bei SongDocent",
        body: "Wähle die App-Sprache und richte Liedtexte und Übersetzung in sechs kurzen Schritten ein.",
      },
      keychain: {
        title: "Zugangsdaten im macOS-Schlüsselbund schützen",
        body: "Prüfe Speicherort und Übertragungsweg, bevor SongDocent den Zugriff auf den Schlüsselbund anfordert.",
      },
      lyrics: {
        title: "Liedtextanbieter auswählen",
        body: "Richte Spotify oder Apple Music ein und folge der Cookie-Anleitung für Chrome oder Safari.",
      },
      ai: {
        title: "KI-Anbieter auswählen",
        body: "Für Liedtextübersetzungen kannst du Gemini, OpenAI oder Claude nutzen.",
      },
      language: {
        title: "Übersetzungssprache auswählen",
        body: "Wähle die Sprache, in die SongDocent Liedtexte übersetzen soll.",
      },
      review: {
        title: "Prüfen und abschließen",
        body: "Prüfe Anbieter, Verbindungsstatus und Übersetzungssprache, bevor du den Player öffnest.",
      },
    },
    onboardingKeychain: {
      body: "SongDocent verwendet den macOS-Schlüsselbund, um die für den Betrieb der App erforderlichen Benutzerinformationen sicher zu speichern.\nPrüfe die Details, bevor SongDocent den Zugriff auf den macOS-Schlüsselbund anfordert.",
      sensitiveInformationWarning: "KI-API-Schlüssel und Cookies von Musikstreamingdiensten sind vertrauliche Informationen. Teile sie nicht mit anderen.",
    },
    accessibility: {
      progressLabel: "Einrichtungsfortschritt",
      appLanguageLabel: "App-Sprache",
      aiModelLabel: "KI-Modell",
      selectedOption: "Ausgewählt",
      currentStep: "Aktuell",
      completedStep: "Abgeschlossen",
      upcomingStep: "Bevorstehend",
    },
    keychainBullets: {
      systemAuth: "Dein macOS-Passwort oder Touch ID wird nur von Apples Systemoberfläche verarbeitet. SongDocent kann es weder sehen noch speichern.",
      localStorage: "Zugangsdaten werden lokal im macOS-Schlüsselbundeintrag SongDocent / secrets_v1 gespeichert.",
      noSongDocentServer: "Kein von SongDocent betriebener Server erhält deine Zugangsdaten.",
      directHttps: "Für Liedtexte oder Übersetzungen werden sie nur direkt per HTTPS an den gewählten Dienst Spotify, Apple Music, Gemini, OpenAI oder Claude gesendet.",
      systemPrompt: "Je nach Systemeinstellungen kann ein macOS-Authentifizierungsdialog erscheinen.",
      sensitiveCredentials: "SP_DC und media-user-token sind sensible Sitzungsdaten. Teile sie nicht und ersetze abgelaufene Werte in Einstellungen.",
    },
    settingsGuide: {
      title: "Einrichtungsassistent",
      body: "Führe den vollständigen Einrichtungsassistenten erneut aus, ohne den Status „abgeschlossen“ oder „übersprungen“ zurückzusetzen.",
      button: "Einrichtungsassistent erneut öffnen",
    },
    buttons: {
      back: "Zurück",
      continue: "Weiter",
      skip: "Einrichtung überspringen",
      complete: "Einrichtung abschließen",
      validate: "Zugangsdaten prüfen",
      retry: "Erneut versuchen",
      saveAnyway: "Trotzdem speichern und fortfahren",
      localLlmLater: "Lokales LLM später einrichten",
      cancel: "Abbrechen",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini (Standard)",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "Lokales LLM",
    },
    providerDescriptions: {
      lyricsChoice: "Wähle eine anfängliche Liedtextquelle: Spotify oder Apple Music.",
      aiChoice: "Verwende standardmäßig Gemini oder wähle OpenAI oder Claude.",
    },
    validation: {
      valid: "Zugangsdaten bestätigt.",
      saved: "Zugangsdaten gespeichert.",
      invalid: "Diese Zugangsdaten sind ungültig. Prüfe sie und versuche es erneut.",
      unavailable: "Die Prüfung ist wegen eines Netzwerk- oder Dienstproblems vorübergehend nicht verfügbar.",
      saveAnyway: "Du kannst die Zugangsdaten ungeprüft speichern und fortfahren.",
      cancelled: "Der Schlüsselbundzugriff wurde abgebrochen. Es wurde nichts gespeichert.",
      retry: "Versuche das Speichern erneut und bestätige den macOS-Dialog, falls er erscheint.",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "Offizielle Seite öffnen",
      openFailed: "Die offizielle Seite konnte nicht geöffnet werden. Versuche es gleich noch einmal.",
    },
    localLlmExplanation: "Verwendest du Ollama, LM Studio oder ein anderes lokales LLM? Überspringe diesen Assistenten und richte es später in Einstellungen ein.",
    language: {
      targetLabel: "Zielsprache",
      targetDescription: "Liedtexte werden in diese Sprache übersetzt.",
    },
    reviewLabels: {
      lyricsProvider: "Liedtextanbieter",
      aiProvider: "KI-Anbieter",
      targetLanguage: "Übersetzungssprache",
      connectionStatus: "Verbindungsstatus",
      ready: "Bereit",
      notConfigured: "Nicht eingerichtet",
    },
    guides: {
      spotifyChrome: {
        title: "Spotify-SP_DC in Chrome finden",
        body: "Kopiere nur den Wert des SP_DC-Cookies aus dem Spotify Web Player.",
        alts: [
          "Application-Bereich der Chrome DevTools mit markierter Storage- und Cookies-Navigation; alle Cookie-Werte sind verdeckt.",
          "Spotify-Cookie-Tabelle mit markierter Zeile sp_dc; ihr Wert und alle anderen Cookie-Werte sind verdeckt.",
        ],
        steps: [
          "Öffne den Spotify Web Player und melde dich mit dem gewünschten Konto an.",
          "Drücke Command–Option–I und öffne in DevTools den Tab Application. Nutze das Doppelpfeil-Menü, falls er verborgen ist.",
          "Klappe unter Storage den Bereich Cookies auf und wähle https://open.spotify.com.",
          "Suche die Zeile mit dem Namen sp_dc.",
          "Kopiere nur den Value und füge ihn in SongDocent ein. Teile diesen Wert niemals.",
        ],
      },
      spotifySafari: {
        title: "Spotify-SP_DC in Safari finden",
        body: "Kopiere mit Safaris Web Inspector nur den Wert des SP_DC-Cookies.",
        alts: [
          "Storage-Bereich des Safari Web Inspector mit markierter Cookies-Navigation; alle Cookie-Werte sind verdeckt.",
          "Spotify-Cookie-Tabelle mit markierter Zeile sp_dc; ihr Wert und alle anderen Cookie-Werte sind verdeckt.",
        ],
        steps: [
          "Aktiviere in Safaris erweiterten Einstellungen die Webentwicklerfunktionen, falls das Menü Entwickeln fehlt.",
          "Öffne den Spotify Web Player und melde dich mit dem gewünschten Konto an.",
          "Wähle Entwickeln > Web-Inspector einblenden und öffne den Tab Storage.",
          "Wähle Cookies und https://open.spotify.com.",
          "Suche sp_dc, kopiere nur den Value und füge ihn in SongDocent ein. Teile diesen Wert nicht.",
        ],
      },
      appleMusicChrome: {
        title: "Apple-Music-media-user-token in Chrome finden",
        body: "Kopiere nur den Wert des Cookies media-user-token aus Apple Music.",
        alts: [
          "Application-Bereich der Chrome DevTools mit markierter Storage- und Cookies-Navigation; alle Cookie-Werte sind verdeckt.",
          "Apple-Music-Cookie-Tabelle mit markierter Zeile media-user-token; ihr Wert und alle anderen Cookie-Werte sind verdeckt.",
        ],
        steps: [
          "Öffne Apple Music im Web und melde dich mit dem gewünschten Konto an.",
          "Drücke Command–Option–I und öffne in DevTools den Tab Application. Nutze bei Bedarf das Doppelpfeil-Menü.",
          "Klappe unter Storage den Bereich Cookies auf und wähle https://music.apple.com.",
          "Suche die Zeile mit dem Namen media-user-token.",
          "Kopiere nur den Value und füge ihn in SongDocent ein. Teile diesen Wert niemals.",
        ],
      },
      appleMusicSafari: {
        title: "Apple-Music-media-user-token in Safari finden",
        body: "Kopiere mit Safaris Web Inspector nur den Wert von media-user-token.",
        alts: [
          "Storage-Bereich des Safari Web Inspector mit markierter Cookies-Navigation; alle Cookie-Werte sind verdeckt.",
          "Apple-Music-Cookie-Tabelle mit markierter Zeile media-user-token; ihr Wert und alle anderen Cookie-Werte sind verdeckt.",
        ],
        steps: [
          "Aktiviere in Safaris erweiterten Einstellungen die Webentwicklerfunktionen, falls das Menü Entwickeln fehlt.",
          "Öffne Apple Music im Web und melde dich mit dem gewünschten Konto an.",
          "Wähle Entwickeln > Web-Inspector einblenden und öffne den Tab Storage.",
          "Wähle Cookies und https://music.apple.com und suche media-user-token.",
          "Kopiere nur den Value und füge ihn in SongDocent ein. Teile diesen Wert nicht.",
        ],
      },
      geminiApiKey: {
        title: "Gemini-API-Schlüssel erstellen",
        body: "Erstelle einen Schlüssel mit Googles offizieller Dokumentation und Google AI Studio.",
        alts: [
          "API-Schlüsselseite von Google AI Studio mit markierter Schaltfläche zum Erstellen; alle Schlüsselwerte sind verdeckt.",
        ],
        steps: [
          "Öffne die offizielle Dokumentation zu Gemini-API-Schlüsseln und prüfe Konto- und Abrechnungsanforderungen.",
          "Öffne die API-Schlüsselseite von Google AI Studio und melde dich an.",
          "Erstelle oder wähle einen API-Schlüssel für das passende Google-Cloud-Projekt.",
          "Kopiere den Schlüssel einmal, halte ihn geheim und füge ihn in SongDocent ein.",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["de"],
      openAiApiKey: {
        title: "OpenAI-API-Schlüssel erstellen",
        body: "Erstelle einen Schlüssel auf OpenAIs offizieller Schlüsselseite mithilfe des Hilfeartikels.",
        alts: [
          "OpenAI-API-Schlüsselseite mit markierter Schaltfläche zum Erstellen eines geheimen Schlüssels; alle Werte sind verdeckt.",
        ],
        steps: [
          "Öffne OpenAIs offiziellen Hilfeartikel zu API-Schlüsseln und prüfe Konto- und Abrechnungsanforderungen.",
          "Öffne die API-Schlüsselseite und melde dich beim richtigen Projekt an.",
          "Erstelle einen neuen geheimen Schlüssel mit den benötigten Projektberechtigungen.",
          "Kopiere den angezeigten Schlüssel, halte ihn geheim und füge ihn in SongDocent ein.",
        ],
      },
    },
  },
  "pt-BR": {
    screens: {
      welcome: {
        title: "Boas-vindas ao SongDocent",
        body: "Escolha o idioma do app e configure letras e tradução em seis etapas rápidas.",
      },
      keychain: {
        title: "Proteja as credenciais no Keychain do macOS",
        body: "Confira onde as credenciais são armazenadas e enviadas antes de o SongDocent pedir acesso ao Keychain.",
      },
      lyrics: {
        title: "Escolha um provedor de letras",
        body: "Configure Spotify ou Apple Music e siga o guia de cookies para Chrome ou Safari.",
      },
      ai: {
        title: "Escolha um provedor de IA",
        body: "Você pode usar Gemini, OpenAI ou Claude para traduzir letras.",
      },
      language: {
        title: "Escolha o idioma da tradução",
        body: "Selecione o idioma para o qual o SongDocent deve traduzir as letras.",
      },
      review: {
        title: "Revise e conclua",
        body: "Confira provedores, estados de conexão e idioma antes de abrir o player.",
      },
    },
    onboardingKeychain: {
      body: "O SongDocent usa o Keychain do macOS para armazenar com segurança as informações do usuário necessárias ao funcionamento do aplicativo.\nConfira os detalhes antes de o SongDocent solicitar acesso ao Keychain do macOS.",
      sensitiveInformationWarning: "Chaves de API de IA e cookies de serviços de streaming de música são informações confidenciais. Não compartilhe esses dados com outras pessoas.",
    },
    accessibility: {
      progressLabel: "Progresso da configuração",
      appLanguageLabel: "Idioma do app",
      aiModelLabel: "Modelo de IA",
      selectedOption: "Selecionado",
      currentStep: "Atual",
      completedStep: "Concluída",
      upcomingStep: "Próxima",
    },
    keychainBullets: {
      systemAuth: "Sua senha do macOS ou Touch ID é processada somente pela interface do sistema da Apple. O SongDocent não consegue ver nem armazenar esses dados.",
      localStorage: "As credenciais são armazenadas localmente no item SongDocent / secrets_v1 do Keychain do macOS.",
      noSongDocentServer: "Nenhum servidor operado pelo SongDocent recebe suas credenciais.",
      directHttps: "Para letras ou traduções, elas são enviadas diretamente por HTTPS somente ao serviço escolhido: Spotify, Apple Music, Gemini, OpenAI ou Claude.",
      systemPrompt: "Dependendo dos ajustes do sistema, uma solicitação de autenticação do macOS pode aparecer.",
      sensitiveCredentials: "SP_DC e media-user-token são credenciais de sessão confidenciais. Não compartilhe; troque valores expirados em Configurações.",
    },
    settingsGuide: {
      title: "Guia de configuração",
      body: "Execute novamente o guia de configuração completo sem redefinir o estado de concluído ou ignorado.",
      button: "Reabrir guia de configuração",
    },
    buttons: {
      back: "Voltar",
      continue: "Continuar",
      skip: "Pular configuração",
      complete: "Concluir configuração",
      validate: "Verificar credencial",
      retry: "Tentar novamente",
      saveAnyway: "Salvar mesmo assim e continuar",
      localLlmLater: "Configurar LLM local depois",
      cancel: "Cancelar",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini (padrão)",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "LLM local",
    },
    providerDescriptions: {
      lyricsChoice: "Escolha uma fonte inicial de letras: Spotify ou Apple Music.",
      aiChoice: "Use Gemini por padrão ou escolha OpenAI ou Claude.",
    },
    validation: {
      valid: "Credencial verificada.",
      saved: "Credencial salva.",
      invalid: "Esta credencial é inválida. Confira e tente novamente.",
      unavailable: "A verificação está temporariamente indisponível por um problema de rede ou do serviço.",
      saveAnyway: "Você pode salvar a credencial sem verificação e continuar.",
      cancelled: "O acesso ao Keychain foi cancelado. Nada foi salvo.",
      retry: "Tente salvar novamente e aprove a solicitação do macOS se ela aparecer.",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "Abrir página oficial",
      openFailed: "Não foi possível abrir a página oficial. Tente novamente em instantes.",
    },
    localLlmExplanation: "Usa Ollama, LM Studio ou outro LLM local? Pule este assistente e configure depois em Configurações.",
    language: {
      targetLabel: "Idioma de destino",
      targetDescription: "As letras serão traduzidas para este idioma.",
    },
    reviewLabels: {
      lyricsProvider: "Provedor de letras",
      aiProvider: "Provedor de IA",
      targetLanguage: "Idioma da tradução",
      connectionStatus: "Estado da conexão",
      ready: "Pronto",
      notConfigured: "Não configurado",
    },
    guides: {
      spotifyChrome: {
        title: "Encontre o SP_DC do Spotify no Chrome",
        body: "Copie somente o valor do cookie SP_DC do player web do Spotify.",
        alts: [
          "Painel Application do DevTools do Chrome com a navegação Storage e Cookies marcada; todos os valores estão ocultos.",
          "Tabela de cookies do Spotify com a linha sp_dc marcada; esse valor e todos os demais estão ocultos.",
        ],
        steps: [
          "Abra o player web do Spotify e entre na conta que você quer usar.",
          "Pressione Command–Option–I e abra a aba Application do DevTools. Use o menu de seta dupla se ela estiver oculta.",
          "Em Storage, expanda Cookies e selecione https://open.spotify.com.",
          "Encontre a linha chamada sp_dc.",
          "Copie somente o Value e cole no SongDocent. Nunca compartilhe esse valor.",
        ],
      },
      spotifySafari: {
        title: "Encontre o SP_DC do Spotify no Safari",
        body: "Use o Inspetor Web do Safari para copiar somente o valor do cookie SP_DC.",
        alts: [
          "Painel Storage do Inspetor Web do Safari com a navegação Cookies marcada; todos os valores estão ocultos.",
          "Tabela de cookies do Spotify com a linha sp_dc marcada; esse valor e todos os demais estão ocultos.",
        ],
        steps: [
          "Se o menu Desenvolvedor não aparecer, ative os recursos para desenvolvedores web nos ajustes avançados do Safari.",
          "Abra o player web do Spotify e entre na conta que você quer usar.",
          "Escolha Desenvolvedor > Mostrar Inspetor Web e abra a aba Storage.",
          "Selecione Cookies e https://open.spotify.com.",
          "Encontre sp_dc, copie somente o Value e cole no SongDocent. Não compartilhe esse valor.",
        ],
      },
      appleMusicChrome: {
        title: "Encontre media-user-token do Apple Music no Chrome",
        body: "Copie somente o valor do cookie media-user-token do Apple Music.",
        alts: [
          "Painel Application do DevTools do Chrome com a navegação Storage e Cookies marcada; todos os valores estão ocultos.",
          "Tabela de cookies do Apple Music com a linha media-user-token marcada; esse valor e todos os demais estão ocultos.",
        ],
        steps: [
          "Abra o Apple Music na web e entre na conta que você quer usar.",
          "Pressione Command–Option–I e abra a aba Application do DevTools. Use o menu de seta dupla se necessário.",
          "Em Storage, expanda Cookies e selecione https://music.apple.com.",
          "Encontre a linha chamada media-user-token.",
          "Copie somente o Value e cole no SongDocent. Nunca compartilhe esse valor.",
        ],
      },
      appleMusicSafari: {
        title: "Encontre media-user-token do Apple Music no Safari",
        body: "Use o Inspetor Web do Safari para copiar somente o valor de media-user-token.",
        alts: [
          "Painel Storage do Inspetor Web do Safari com a navegação Cookies marcada; todos os valores estão ocultos.",
          "Tabela de cookies do Apple Music com a linha media-user-token marcada; esse valor e todos os demais estão ocultos.",
        ],
        steps: [
          "Se o menu Desenvolvedor não aparecer, ative os recursos para desenvolvedores web nos ajustes avançados do Safari.",
          "Abra o Apple Music na web e entre na conta que você quer usar.",
          "Escolha Desenvolvedor > Mostrar Inspetor Web e abra a aba Storage.",
          "Selecione Cookies e https://music.apple.com, depois encontre media-user-token.",
          "Copie somente o Value e cole no SongDocent. Não compartilhe esse valor.",
        ],
      },
      geminiApiKey: {
        title: "Crie uma chave de API do Gemini",
        body: "Use a documentação oficial do Google e o Google AI Studio para criar uma chave.",
        alts: [
          "Página de chaves de API do Google AI Studio com o controle de criação marcado e todos os valores ocultos.",
        ],
        steps: [
          "Abra a documentação oficial de chaves do Gemini e confira os requisitos de conta e cobrança.",
          "Abra a página de chaves de API do Google AI Studio e entre na sua conta.",
          "Crie ou escolha uma chave para o projeto correto do Google Cloud.",
          "Copie a chave uma vez, mantenha-a privada e cole no SongDocent.",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["pt-BR"],
      openAiApiKey: {
        title: "Crie uma chave de API da OpenAI",
        body: "Use a página oficial de chaves e o artigo de ajuda da OpenAI.",
        alts: [
          "Página de chaves de API da OpenAI com o controle de criação de chave secreta marcado e todos os valores ocultos.",
        ],
        steps: [
          "Abra o artigo oficial da OpenAI sobre chaves de API e confira os requisitos de conta e cobrança.",
          "Abra a página de chaves e entre no projeto correto.",
          "Crie uma nova chave secreta com o acesso necessário para seu projeto.",
          "Copie a chave quando ela aparecer, mantenha-a privada e cole no SongDocent.",
        ],
      },
    },
  },
  "zh-CN": {
    screens: {
      welcome: {
        title: "欢迎使用 SongDocent",
        body: "选择应用语言，然后通过六个简短步骤设置歌词和翻译。",
      },
      keychain: {
        title: "将凭据安全保存在 macOS 钥匙串中",
        body: "在 SongDocent 请求访问钥匙串之前，请先了解凭据的存储位置和发送范围。",
      },
      lyrics: {
        title: "选择歌词提供商",
        body: "设置 Spotify 或 Apple Music，并按照 Chrome 或 Safari 的 Cookie 指南操作。",
      },
      ai: {
        title: "选择 AI 提供商",
        body: "你可以使用 Gemini、OpenAI 或 Claude 翻译歌词。",
      },
      language: {
        title: "选择翻译语言",
        body: "选择 SongDocent 翻译歌词时使用的目标语言。",
      },
      review: {
        title: "检查并完成",
        body: "打开播放器前，请检查提供商、连接状态和翻译语言。",
      },
    },
    onboardingKeychain: {
      body: "SongDocent 使用 macOS 钥匙串安全存储应用运行所需的用户信息。\n在 SongDocent 请求访问 macOS 钥匙串之前，请先查看详细信息。",
      sensitiveInformationWarning: "AI API 密钥和音乐流媒体服务 Cookie 都是敏感信息，请勿与他人分享。",
    },
    accessibility: {
      progressLabel: "设置进度",
      appLanguageLabel: "应用语言",
      aiModelLabel: "AI 模型",
      selectedOption: "已选择",
      currentStep: "当前",
      completedStep: "已完成",
      upcomingStep: "即将开始",
    },
    keychainBullets: {
      systemAuth: "你的 macOS 密码或 Touch ID 只由 Apple 系统界面处理。SongDocent 无法查看或存储这些信息。",
      localStorage: "凭据仅在本机存储于 macOS 钥匙串的 SongDocent / secrets_v1 项目中。",
      noSongDocentServer: "SongDocent 运营的任何服务器都不会接收你的凭据。",
      directHttps: "发起歌词或翻译请求时，凭据只会通过 HTTPS 直接发送给你选择的 Spotify、Apple Music、Gemini、OpenAI 或 Claude 服务。",
      systemPrompt: "根据系统设置，macOS 身份验证提示可能会出现。",
      sensitiveCredentials: "SP_DC 和 media-user-token 是敏感的会话凭据。请勿分享；过期后请在 设置 中更换。",
    },
    settingsGuide: {
      title: "设置指南",
      body: "重新运行完整设置指南，而不会重置已完成或已跳过状态。",
      button: "重新打开设置指南",
    },
    buttons: {
      back: "上一步",
      continue: "继续",
      skip: "跳过设置",
      complete: "完成设置",
      validate: "验证凭据",
      retry: "重试",
      saveAnyway: "仍然保存并继续",
      localLlmLater: "稍后设置本地 LLM",
      cancel: "取消",
    },
    providerLabels: {
      spotify: "Spotify",
      appleMusic: "Apple Music",
      gemini: "Gemini（默认）",
      openai: "OpenAI",
      claude: "Claude",
      localLlm: "本地 LLM",
    },
    providerDescriptions: {
      lyricsChoice: "选择一个初始歌词来源：Spotify 或 Apple Music。",
      aiChoice: "默认使用 Gemini，也可以选择 OpenAI 或 Claude。",
    },
    validation: {
      valid: "凭据验证成功。",
      saved: "凭据已保存。",
      invalid: "此凭据无效。请检查后重试。",
      unavailable: "由于网络或服务问题，目前暂时无法验证。",
      saveAnyway: "你可以不经验证直接保存此凭据并继续。",
      cancelled: "钥匙串访问已取消，未保存任何内容。",
      retry: "请重新尝试保存；如果出现 macOS 提示，请批准访问。",
    },
    browserTabs: {
      chrome: "Chrome",
      safari: "Safari",
    },
    guideLinks: {
      openLabel: "打开官方页面",
      openFailed: "无法打开官方页面。请稍后再试。",
    },
    localLlmExplanation: "使用 Ollama、LM Studio 或其他本地 LLM？请跳过此向导，稍后在 设置 中配置。",
    language: {
      targetLabel: "翻译目标",
      targetDescription: "歌词将被翻译为此语言。",
    },
    reviewLabels: {
      lyricsProvider: "歌词提供商",
      aiProvider: "AI 提供商",
      targetLanguage: "翻译语言",
      connectionStatus: "连接状态",
      ready: "已就绪",
      notConfigured: "未配置",
    },
    guides: {
      spotifyChrome: {
        title: "在 Chrome 中查找 Spotify SP_DC",
        body: "只复制 Spotify 网页播放器中的 SP_DC Cookie 值。",
        alts: [
          "Chrome DevTools 的 Application 面板，已标出 Storage 和 Cookies 导航位置；所有 Cookie 值均已隐藏。",
          "Spotify Cookie 表格，已标出 sp_dc 行；该值和其他所有 Cookie 值均已隐藏。",
        ],
        steps: [
          "打开 Spotify 网页播放器，并登录你要使用的账号。",
          "按 Command–Option–I 打开 DevTools，再打开 Application 标签页。如果标签被隐藏，请使用双箭头菜单。",
          "在 Storage 下展开 Cookies，并选择 https://open.spotify.com。",
          "找到名称为 sp_dc 的行。",
          "只复制它的 Value 并粘贴到 SongDocent。切勿分享此值。",
        ],
      },
      spotifySafari: {
        title: "在 Safari 中查找 Spotify SP_DC",
        body: "使用 Safari 网页检查器，只复制 SP_DC Cookie 值。",
        alts: [
          "Safari 网页检查器的 Storage 面板，已标出 Cookies 导航位置；所有 Cookie 值均已隐藏。",
          "Spotify Cookie 表格，已标出 sp_dc 行；该值和其他所有 Cookie 值均已隐藏。",
        ],
        steps: [
          "如果看不到“开发”菜单，请在 Safari 高级设置中启用网页开发者功能。",
          "打开 Spotify 网页播放器，并登录你要使用的账号。",
          "选择“开发”>“显示网页检查器”，然后打开 Storage 标签页。",
          "选择 Cookies 和 https://open.spotify.com。",
          "找到 sp_dc，只复制它的 Value 并粘贴到 SongDocent。请勿分享此值。",
        ],
      },
      appleMusicChrome: {
        title: "在 Chrome 中查找 Apple Music media-user-token",
        body: "只复制 Apple Music 中的 media-user-token Cookie 值。",
        alts: [
          "Chrome DevTools 的 Application 面板，已标出 Storage 和 Cookies 导航位置；所有 Cookie 值均已隐藏。",
          "Apple Music Cookie 表格，已标出 media-user-token 行；该值和其他所有 Cookie 值均已隐藏。",
        ],
        steps: [
          "打开 Apple Music 网页版，并登录你要使用的账号。",
          "按 Command–Option–I 打开 DevTools，再打开 Application 标签页。需要时可使用双箭头菜单。",
          "在 Storage 下展开 Cookies，并选择 https://music.apple.com。",
          "找到名称为 media-user-token 的行。",
          "只复制它的 Value 并粘贴到 SongDocent。切勿分享此值。",
        ],
      },
      appleMusicSafari: {
        title: "在 Safari 中查找 Apple Music media-user-token",
        body: "使用 Safari 网页检查器，只复制 media-user-token Cookie 值。",
        alts: [
          "Safari 网页检查器的 Storage 面板，已标出 Cookies 导航位置；所有 Cookie 值均已隐藏。",
          "Apple Music Cookie 表格，已标出 media-user-token 行；该值和其他所有 Cookie 值均已隐藏。",
        ],
        steps: [
          "如果看不到“开发”菜单，请在 Safari 高级设置中启用网页开发者功能。",
          "打开 Apple Music 网页版，并登录你要使用的账号。",
          "选择“开发”>“显示网页检查器”，然后打开 Storage 标签页。",
          "选择 Cookies 和 https://music.apple.com，再找到 media-user-token。",
          "只复制它的 Value 并粘贴到 SongDocent。请勿分享此值。",
        ],
      },
      geminiApiKey: {
        title: "创建 Gemini API 密钥",
        body: "使用 Google 官方文档和 Google AI Studio 创建密钥。",
        alts: [
          "Google AI Studio API 密钥页面，创建密钥控件已标出，所有密钥值均已隐藏。",
        ],
        steps: [
          "打开 Gemini API 密钥官方文档，查看账号和结算要求。",
          "打开 Google AI Studio API 密钥页面并登录。",
          "为正确的 Google Cloud 项目创建或选择一个 API 密钥。",
          "复制一次密钥，妥善保密，然后粘贴到 SongDocent。",
        ],
      },
      claudeApiKey: CLAUDE_GUIDE_COPY["zh-CN"],
      openAiApiKey: {
        title: "创建 OpenAI API 密钥",
        body: "使用 OpenAI 官方 API 密钥页面和帮助文章创建密钥。",
        alts: [
          "OpenAI API 密钥页面，创建秘密密钥控件已标出，所有密钥值均已隐藏。",
        ],
        steps: [
          "打开 OpenAI 官方 API 密钥帮助文章，查看账号和结算要求。",
          "打开 API 密钥页面，并登录正确的项目。",
          "按项目需要的权限创建一个新的秘密密钥。",
          "密钥显示时立即复制，妥善保密，然后粘贴到 SongDocent。",
        ],
      },
    },
  },
} as const satisfies Record<LangCode, SetupCopy>;

export function setupBrowsersFor(
  platform: DesktopPlatform,
): readonly SetupBrowser[] {
  return browserOptionsForPlatform(platform);
}

export function setupCopyFor(
  lang: LangCode,
  platform: DesktopPlatform,
): SetupCopy {
  const base: SetupCopy = SETUP_COPY[lang];
  if (platform === "macos") return base;

  const platformCopy = platformCopyFor(lang, platform);
  const withWindowsShortcut = (guide: SetupGuideCopy): SetupGuideCopy => ({
    ...guide,
    steps: guide.steps.map((step, index) =>
      index === 1 ? platformCopy.devtoolsShortcut : step,
    ),
  });

  return {
    ...base,
    screens: {
      ...base.screens,
      keychain: {
        title: platformCopy.primerTitle,
        body: platformCopy.primerBody,
      },
    },
    onboardingKeychain: {
      ...base.onboardingKeychain,
      body: platformCopy.primerBody,
    },
    keychainBullets: {
      ...base.keychainBullets,
      systemAuth: platformCopy.systemAuth,
      localStorage: platformCopy.localStorage,
      systemPrompt: platformCopy.systemPrompt,
    },
    validation: {
      ...base.validation,
      cancelled: platformCopy.cancelled,
      retry: platformCopy.retry,
    },
    guides: {
      ...base.guides,
      spotifyChrome: withWindowsShortcut(base.guides.spotifyChrome),
      appleMusicChrome: withWindowsShortcut(base.guides.appleMusicChrome),
    },
  };
}
