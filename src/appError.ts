import { cliErrorMessage } from "./ai/cliCopy.ts";
import type { LangCode } from "./i18n";
import type { DesktopPlatform } from "./platform/platformCopy";

export type AppErrorDomain =
  | "player"
  | "lyrics"
  | "translation"
  | "annotation"
  | "settings"
  | "storage"
  | "unknown";

export type AppError = {
  code: string;
  domain: AppErrorDomain;
  retryable: boolean;
  technicalMessage: string;
};

export type AppErrorRetryAction = () => void | Promise<void>;

export type CurrentAppError = {
  error: AppError;
  retry?: AppErrorRetryAction;
};

export type ErrorRecoveryAction =
  | "retry"
  | "open-ai-settings"
  | "open-lyrics-settings"
  | "none";

export type ErrorPresentation = {
  title: string;
  message: string;
  action: ErrorRecoveryAction;
};

const DOMAINS = new Set<AppErrorDomain>([
  "player",
  "lyrics",
  "translation",
  "annotation",
  "settings",
  "storage",
  "unknown",
]);

type ErrorCopy = Pick<ErrorPresentation, "title" | "message">;

const CLI_CONNECTION_TITLE: Record<LangCode, string> = {
  en: "Check the CLI AI connection",
  ko: "CLI AI 연결을 확인해 주세요",
  ja: "CLI AIの接続を確認してください",
  es: "Comprueba la conexión con la IA de CLI",
  fr: "Vérifiez la connexion à l’IA en ligne de commande",
  de: "Prüfe die CLI-KI-Verbindung",
  "pt-BR": "Confira a conexão com a IA da CLI",
  "zh-CN": "请检查 CLI AI 连接",
};

const WINDOWS_ERROR_MESSAGES: Record<
  LangCode,
  { playerPermission: string; settingsLoad: string; settingsAccess: string }
> = {
  en: {
    playerPermission: "Restart SongDocent and the music app, then check Windows app permissions.",
    settingsLoad: "SongDocent could not read the saved Windows Credential Manager data.",
    settingsAccess: "Check Windows Credential Manager access and try again.",
  },
  ko: {
    playerPermission: "SongDocent과 음악 앱을 다시 시작한 뒤 Windows 앱 권한을 확인해 주세요.",
    settingsLoad: "Windows 자격 증명 관리자에 저장된 정보를 읽을 수 없어요.",
    settingsAccess: "Windows 자격 증명 관리자 접근 상태를 확인하고 다시 시도해 주세요.",
  },
  ja: {
    playerPermission: "SongDocentと音楽アプリを再起動し、Windowsのアプリ権限を確認してください。",
    settingsLoad: "Windows資格情報マネージャーに保存された情報を読み取れません。",
    settingsAccess: "Windows資格情報マネージャーへのアクセスを確認してください。",
  },
  es: {
    playerPermission: "Reinicia SongDocent y la app de música, y comprueba los permisos de Windows.",
    settingsLoad: "SongDocent no pudo leer los datos del Administrador de credenciales de Windows.",
    settingsAccess: "Comprueba el Administrador de credenciales de Windows e inténtalo de nuevo.",
  },
  fr: {
    playerPermission: "Redémarrez SongDocent et l’app de musique, puis vérifiez les autorisations Windows.",
    settingsLoad: "SongDocent n’a pas pu lire les données du Gestionnaire d’identifiants Windows.",
    settingsAccess: "Vérifiez le Gestionnaire d’identifiants Windows puis réessayez.",
  },
  de: {
    playerPermission: "Starte SongDocent und die Musik-App neu und prüfe die Windows-Berechtigungen.",
    settingsLoad: "SongDocent konnte die Daten der Windows-Anmeldeinformationsverwaltung nicht lesen.",
    settingsAccess: "Prüfe die Windows-Anmeldeinformationsverwaltung und versuche es erneut.",
  },
  "pt-BR": {
    playerPermission: "Reinicie o SongDocent e o app de música e confira as permissões do Windows.",
    settingsLoad: "O SongDocent não conseguiu ler os dados do Gerenciador de Credenciais do Windows.",
    settingsAccess: "Confira o Gerenciador de Credenciais do Windows e tente novamente.",
  },
  "zh-CN": {
    playerPermission: "请重启 SongDocent 和音乐应用，然后检查 Windows 应用权限。",
    settingsLoad: "SongDocent 无法读取 Windows 凭据管理器中保存的数据。",
    settingsAccess: "请检查 Windows 凭据管理器访问权限后重试。",
  },
};

const EN_COPY = {
    AI_API_KEY_MISSING: {
      title: "An AI API key is required",
      message: "Open AI settings and save a key before trying again.",
    },
    AI_API_KEY_INVALID: {
      title: "The AI API key is invalid",
      message: "Check the saved key or replace it with a valid one.",
    },
    AI_API_KEY_COMPROMISED: {
      title: "Replace this AI API key",
      message: "Google blocked the key because it may have been exposed.",
    },
    AI_PERMISSION_DENIED: {
      title: "The AI service denied access",
      message: "Check the API key restrictions and model permissions.",
    },
    AI_REGION_UNAVAILABLE: {
      title: "Gemini's free tier is unavailable here",
      message: "Enable billing for the project in Google AI Studio to continue.",
    },
    AI_BILLING_REQUIRED: {
      title: "Gemini billing needs attention",
      message: "Check the project's billing setup in Google AI Studio.",
    },
    AI_REQUEST_INVALID: {
      title: "The AI request could not be accepted",
      message: "Check the selected model and try again.",
    },
    AI_INPUT_TOO_LARGE: {
      title: "This lyric is too large for the model",
      message: "Try another model with a larger context window.",
    },
    AI_MODEL_NOT_FOUND: {
      title: "The selected AI model is unavailable",
      message: "Choose a supported model in AI settings.",
    },
    AI_RATE_LIMITED: {
      title: "The AI service is receiving too many requests",
      message: "Wait a moment, then try again.",
    },
    AI_QUOTA_EXHAUSTED: {
      title: "The AI usage limit has been reached",
      message: "Check the daily or spending quota before trying again.",
    },
    AI_SERVICE_ERROR: {
      title: "The AI service had a problem",
      message: "The provider returned an internal error. Try again shortly.",
    },
    AI_SERVICE_UNAVAILABLE: {
      title: "The AI service is temporarily unavailable",
      message: "The provider may be overloaded. Try again shortly.",
    },
    AI_REQUEST_TIMEOUT: {
      title: "The AI request took too long",
      message: "Check the connection and try again.",
    },
    AI_REQUEST_CANCELLED: {
      title: "The AI request was interrupted",
      message: "Try the request again.",
    },
    AI_CONTENT_BLOCKED: {
      title: "The AI service could not process this selection",
      message: "A safety or content filter blocked the request.",
    },
    AI_RESPONSE_INVALID: {
      title: "The AI response could not be read",
      message: "The provider returned an unexpected result. Try again.",
    },
    AI_RESPONSE_INCOMPLETE: {
      title: "The AI response was incomplete",
      message: "Some lyrics were missing from the result. Try again.",
    },
    NETWORK_UNAVAILABLE: {
      title: "The network connection was lost",
      message: "Check your internet connection and try again.",
    },
    PLAYER_PERMISSION_DENIED: {
      title: "SongDocent cannot control the music app",
      message: "Allow SongDocent under macOS Privacy & Security > Automation.",
    },
    PLAYER_NOT_RUNNING: {
      title: "No music app is available",
      message: "Open Spotify or Apple Music and start a track.",
    },
    PLAYER_RESPONSE_INVALID: {
      title: "SongDocent could not read the current track",
      message: "Restart the music app and try again.",
    },
    PLAYER_UNAVAILABLE: {
      title: "The music app is not responding",
      message: "Check Spotify or Apple Music and try again.",
    },
    LYRICS_AUTH_REQUIRED: {
      title: "Lyrics access needs to be connected",
      message: "Open Lyrics settings and save the required credential.",
    },
    LYRICS_AUTH_EXPIRED: {
      title: "Lyrics access has expired",
      message: "Update the saved credential in Lyrics settings.",
    },
    LYRICS_NOT_FOUND: {
      title: "Lyrics were not found for this track",
      message: "The selected lyrics source may not carry this song.",
    },
    LYRICS_RESPONSE_INVALID: {
      title: "The lyrics response could not be read",
      message: "The lyrics provider returned an unexpected result.",
    },
    LYRICS_RATE_LIMITED: {
      title: "The lyrics provider is receiving too many requests",
      message: "Wait a moment and let SongDocent try again.",
    },
    LYRICS_SERVICE_UNAVAILABLE: {
      title: "The lyrics provider is temporarily unavailable",
      message: "Keep the track open and try again shortly.",
    },
    SETTINGS_LOAD_FAILED: {
      title: "Settings could not be loaded",
      message: "SongDocent could not read the saved Keychain data.",
    },
    SETTINGS_SAVE_FAILED: {
      title: "Settings could not be saved",
      message: "Check Keychain access and try again.",
    },
    SETTINGS_CLEAR_FAILED: {
      title: "The saved credential could not be removed",
      message: "Check Keychain access and try again.",
    },
    LOCAL_AI_URL_INVALID: {
      title: "The local AI address is invalid",
      message: "Enter a URL that starts with http:// or https://.",
    },
    LOCAL_AI_MODEL_NOT_FOUND: {
      title: "The local AI model is not loaded",
      message: "Load the configured model or select another one.",
    },
    LOCAL_AI_UNREACHABLE: {
      title: "SongDocent cannot reach the local AI server",
      message: "Start Ollama or LM Studio and check its address.",
    },
    AI_REQUEST_FAILED: {
      title: "The AI request failed",
      message: "Check the service and model settings, then try again.",
    },
    AI_RESOURCE_NOT_FOUND: {
      title: "The AI endpoint was not found",
      message: "Check the server address and API endpoint in AI settings.",
    },
    APP_TASK_FAILED: {
      title: "The operation could not finish",
      message: "Try again. If the problem continues, restart SongDocent.",
    },
    CACHE_READ_FAILED: {
      title: "Saved translations could not be loaded",
      message: "Lyrics are still available, but saved translations could not be read.",
    },
    CACHE_WRITE_FAILED: {
      title: "The translation could not be saved",
      message: "You can keep reading it, but it may be lost after restarting. Check disk space and file permissions.",
    },
    CACHE_CLEAR_FAILED: {
      title: "Saved translations could not be deleted",
      message: "They are hidden for now, but may reappear when this track is loaded again. Try deleting them again.",
    },
    CACHE_OPERATION_FAILED: {
      title: "Translation storage is unavailable",
      message: "Check disk space and file permissions, then try again.",
    },
    LOCAL_AI_CONNECTION_FAILED: {
      title: "The local AI request failed",
      message: "Check that the server is running and the configured model is loaded.",
    },
    LOCAL_AI_RESPONSE_INVALID: {
      title: "The local AI response could not be read",
      message: "Check the loaded model and API compatibility, then try again.",
    },
    LYRICS_FETCH_FAILED: {
      title: "Lyrics could not be loaded",
      message: "Check the lyrics service connection and try again.",
    },
    LYRICS_REQUEST_INVALID: {
      title: "This track cannot be looked up",
      message: "The track ID or title and artist information is missing. Try another track.",
    },
    LYRICS_REQUEST_TIMEOUT: {
      title: "The lyrics request took too long",
      message: "Check your connection. SongDocent will try loading the lyrics again.",
    },
    SETTINGS_INVALID_VALUE: {
      title: "The setting is invalid",
      message: "Check the value you entered and try again.",
    },
    SETTINGS_OPERATION_FAILED: {
      title: "Settings could not be updated",
      message: "Check access to the system credential store and try again.",
    },
    unknown: {
      title: "Something went wrong",
      message: "Try again. If the problem continues, restart SongDocent.",
    },
  };

type ErrorCopyCode = keyof typeof EN_COPY;

const COPY = {
  en: EN_COPY,
  ko: {
    AI_API_KEY_MISSING: {
      title: "AI API 키가 필요해요",
      message: "AI 설정을 열어 API 키를 저장한 뒤 다시 시도해 주세요.",
    },
    AI_API_KEY_INVALID: {
      title: "AI API 키가 올바르지 않아요",
      message: "저장된 키를 확인하거나 유효한 키로 교체해 주세요.",
    },
    AI_API_KEY_COMPROMISED: {
      title: "AI API 키를 새로 만들어 주세요",
      message: "키 노출 가능성이 감지되어 Google이 이 키를 차단했어요.",
    },
    AI_PERMISSION_DENIED: {
      title: "AI 서비스 접근 권한이 없어요",
      message: "API 키 제한과 선택한 모델의 사용 권한을 확인해 주세요.",
    },
    AI_REGION_UNAVAILABLE: {
      title: "이 지역에서는 Gemini 무료 사용이 어려워요",
      message: "Google AI Studio에서 프로젝트 결제를 설정해 주세요.",
    },
    AI_BILLING_REQUIRED: {
      title: "Gemini 결제 설정을 확인해 주세요",
      message: "Google AI Studio에서 프로젝트의 결제 상태를 확인해 주세요.",
    },
    AI_REQUEST_INVALID: {
      title: "AI 요청을 처리할 수 없어요",
      message: "선택한 모델 설정을 확인한 뒤 다시 시도해 주세요.",
    },
    AI_INPUT_TOO_LARGE: {
      title: "가사가 모델의 처리 한도를 넘었어요",
      message: "더 큰 컨텍스트를 지원하는 모델로 변경해 주세요.",
    },
    AI_MODEL_NOT_FOUND: {
      title: "선택한 AI 모델을 사용할 수 없어요",
      message: "AI 설정에서 지원되는 모델을 선택해 주세요.",
    },
    AI_RATE_LIMITED: {
      title: "AI 요청이 잠시 너무 많아요",
      message: "잠깐 기다린 뒤 다시 시도해 주세요.",
    },
    AI_QUOTA_EXHAUSTED: {
      title: "AI 사용 한도에 도달했어요",
      message: "일일 요청량이나 결제 한도를 확인해 주세요.",
    },
    AI_SERVICE_ERROR: {
      title: "AI 서비스에 문제가 생겼어요",
      message: "제공자 내부 오류예요. 잠시 후 다시 시도해 주세요.",
    },
    AI_SERVICE_UNAVAILABLE: {
      title: "AI 서비스를 잠시 사용할 수 없어요",
      message: "서비스가 혼잡할 수 있어요. 잠시 후 다시 시도해 주세요.",
    },
    AI_REQUEST_TIMEOUT: {
      title: "AI 응답이 너무 오래 걸렸어요",
      message: "네트워크를 확인하고 다시 시도해 주세요.",
    },
    AI_REQUEST_CANCELLED: {
      title: "AI 요청이 중간에 끊겼어요",
      message: "요청을 다시 시도해 주세요.",
    },
    AI_CONTENT_BLOCKED: {
      title: "AI가 이 내용을 처리하지 못했어요",
      message: "안전 또는 콘텐츠 필터가 요청을 차단했어요.",
    },
    AI_RESPONSE_INVALID: {
      title: "AI 응답을 읽지 못했어요",
      message: "예상하지 못한 형식의 결과가 왔어요. 다시 시도해 주세요.",
    },
    AI_RESPONSE_INCOMPLETE: {
      title: "AI 응답이 일부 빠졌어요",
      message: "번역되지 않은 가사가 있어요. 다시 시도해 주세요.",
    },
    NETWORK_UNAVAILABLE: {
      title: "네트워크 연결이 끊겼어요",
      message: "인터넷 연결을 확인하고 다시 시도해 주세요.",
    },
    PLAYER_PERMISSION_DENIED: {
      title: "SongDocent이 음악 앱을 제어할 수 없어요",
      message: "macOS 개인정보 보호 및 보안 > 자동화에서 SongDocent을 허용해 주세요.",
    },
    PLAYER_NOT_RUNNING: {
      title: "실행 중인 음악 앱이 없어요",
      message: "Spotify나 Apple Music을 열고 음악을 재생해 주세요.",
    },
    PLAYER_RESPONSE_INVALID: {
      title: "재생 중인 곡을 확인하지 못했어요",
      message: "음악 앱을 다시 실행한 뒤 시도해 주세요.",
    },
    PLAYER_UNAVAILABLE: {
      title: "음악 앱이 응답하지 않아요",
      message: "Spotify나 Apple Music 상태를 확인해 주세요.",
    },
    LYRICS_AUTH_REQUIRED: {
      title: "가사 서비스 연결이 필요해요",
      message: "가사 설정을 열어 필요한 인증 정보를 저장해 주세요.",
    },
    LYRICS_AUTH_EXPIRED: {
      title: "가사 서비스 인증이 만료됐어요",
      message: "가사 설정에서 저장된 인증 정보를 갱신해 주세요.",
    },
    LYRICS_NOT_FOUND: {
      title: "이 곡의 가사를 찾지 못했어요",
      message: "선택한 가사 서비스에 이 곡이 없을 수 있어요.",
    },
    LYRICS_RESPONSE_INVALID: {
      title: "가사 응답을 읽지 못했어요",
      message: "가사 서비스에서 예상하지 못한 결과가 왔어요.",
    },
    LYRICS_RATE_LIMITED: {
      title: "가사 요청이 잠시 너무 많아요",
      message: "잠시 기다리면 SongDocent이 다시 불러올게요.",
    },
    LYRICS_SERVICE_UNAVAILABLE: {
      title: "가사 서비스를 잠시 사용할 수 없어요",
      message: "곡을 열어 둔 채 잠시 후 다시 시도해 주세요.",
    },
    SETTINGS_LOAD_FAILED: {
      title: "설정을 불러오지 못했어요",
      message: "Keychain에 저장된 정보를 읽을 수 없어요.",
    },
    SETTINGS_SAVE_FAILED: {
      title: "설정을 저장하지 못했어요",
      message: "Keychain 접근 상태를 확인하고 다시 시도해 주세요.",
    },
    SETTINGS_CLEAR_FAILED: {
      title: "저장된 인증 정보를 지우지 못했어요",
      message: "Keychain 접근 상태를 확인하고 다시 시도해 주세요.",
    },
    LOCAL_AI_URL_INVALID: {
      title: "로컬 AI 주소가 올바르지 않아요",
      message: "http:// 또는 https://로 시작하는 주소를 입력해 주세요.",
    },
    LOCAL_AI_MODEL_NOT_FOUND: {
      title: "로컬 AI 모델이 준비되지 않았어요",
      message: "설정한 모델을 불러오거나 다른 모델을 선택해 주세요.",
    },
    LOCAL_AI_UNREACHABLE: {
      title: "로컬 AI 서버에 연결할 수 없어요",
      message: "Ollama 또는 LM Studio를 실행하고 주소를 확인해 주세요.",
    },
    AI_REQUEST_FAILED: {
      title: "AI 요청에 실패했어요",
      message: "서비스와 모델 설정을 확인한 뒤 다시 시도해 주세요.",
    },
    AI_RESOURCE_NOT_FOUND: {
      title: "AI 요청 주소를 찾을 수 없어요",
      message: "AI 설정에서 서버 주소와 API 경로를 확인해 주세요.",
    },
    APP_TASK_FAILED: {
      title: "작업을 완료하지 못했어요",
      message: "다시 시도해 주세요. 계속되면 SongDocent을 재실행해 주세요.",
    },
    CACHE_READ_FAILED: {
      title: "저장된 번역을 불러오지 못했어요",
      message: "가사는 볼 수 있지만 저장된 번역을 읽지 못했어요.",
    },
    CACHE_WRITE_FAILED: {
      title: "번역을 저장하지 못했어요",
      message: "지금은 읽을 수 있지만 앱을 다시 열면 사라질 수 있어요. 저장 공간과 파일 접근 권한을 확인해 주세요.",
    },
    CACHE_CLEAR_FAILED: {
      title: "저장된 번역을 삭제하지 못했어요",
      message: "화면에서는 숨겼지만 곡을 다시 불러오면 나타날 수 있어요. 삭제를 다시 시도해 주세요.",
    },
    CACHE_OPERATION_FAILED: {
      title: "번역 저장소를 사용할 수 없어요",
      message: "저장 공간과 파일 접근 권한을 확인한 뒤 다시 시도해 주세요.",
    },
    LOCAL_AI_CONNECTION_FAILED: {
      title: "로컬 AI 요청에 실패했어요",
      message: "서버가 실행 중인지, 설정한 모델을 불러왔는지 확인해 주세요.",
    },
    LOCAL_AI_RESPONSE_INVALID: {
      title: "로컬 AI 응답을 읽지 못했어요",
      message: "불러온 모델과 API 호환성을 확인한 뒤 다시 시도해 주세요.",
    },
    LYRICS_FETCH_FAILED: {
      title: "가사를 불러오지 못했어요",
      message: "가사 서비스 연결 상태를 확인한 뒤 다시 시도해 주세요.",
    },
    LYRICS_REQUEST_INVALID: {
      title: "이 곡의 가사를 검색할 수 없어요",
      message: "곡 ID 또는 제목·아티스트 정보가 없어요. 다른 곡을 재생해 주세요.",
    },
    LYRICS_REQUEST_TIMEOUT: {
      title: "가사 요청 시간이 초과됐어요",
      message: "인터넷 연결을 확인해 주세요. 가사 불러오기를 다시 시도할게요.",
    },
    SETTINGS_INVALID_VALUE: {
      title: "설정값이 올바르지 않아요",
      message: "입력한 값을 확인한 뒤 다시 시도해 주세요.",
    },
    SETTINGS_OPERATION_FAILED: {
      title: "설정을 변경하지 못했어요",
      message: "시스템 보안 저장소 접근 상태를 확인한 뒤 다시 시도해 주세요.",
    },
    unknown: {
      title: "문제가 발생했어요",
      message: "다시 시도해 주세요. 계속되면 SongDocent을 재실행해 주세요.",
    },
  },
  ja: {
    AI_API_KEY_MISSING: {
      title: "AI APIキーが必要です",
      message: "AI設定でAPIキーを保存してから、もう一度お試しください。",
    },
    AI_API_KEY_INVALID: {
      title: "AI APIキーが正しくありません",
      message: "保存したキーを確認するか、有効なキーに交換してください。",
    },
    AI_API_KEY_COMPROMISED: {
      title: "AI APIキーを作り直してください",
      message: "漏えいの可能性が検出され、Googleがこのキーをブロックしました。",
    },
    AI_PERMISSION_DENIED: {
      title: "AIサービスへのアクセス権がありません",
      message: "APIキーの制限とモデルの権限を確認してください。",
    },
    AI_REGION_UNAVAILABLE: {
      title: "この地域ではGeminiの無料枠を利用できません",
      message: "Google AI Studioでプロジェクトの課金を設定してください。",
    },
    AI_BILLING_REQUIRED: {
      title: "Geminiの課金設定を確認してください",
      message: "Google AI Studioでプロジェクトの課金状態を確認してください。",
    },
    AI_REQUEST_INVALID: {
      title: "AIリクエストを処理できません",
      message: "選択したモデルの設定を確認してください。",
    },
    AI_INPUT_TOO_LARGE: {
      title: "歌詞がモデルの処理上限を超えています",
      message: "より大きなコンテキストに対応するモデルを選択してください。",
    },
    AI_MODEL_NOT_FOUND: {
      title: "選択したAIモデルを利用できません",
      message: "AI設定で対応モデルを選択してください。",
    },
    AI_RATE_LIMITED: {
      title: "AIへのリクエストが一時的に集中しています",
      message: "少し待ってから、もう一度お試しください。",
    },
    AI_QUOTA_EXHAUSTED: {
      title: "AIの利用上限に達しました",
      message: "1日の上限または利用料金の上限を確認してください。",
    },
    AI_SERVICE_ERROR: {
      title: "AIサービスで問題が発生しました",
      message: "サービス側の内部エラーです。しばらくしてからお試しください。",
    },
    AI_SERVICE_UNAVAILABLE: {
      title: "AIサービスを一時的に利用できません",
      message: "混雑している可能性があります。しばらくしてからお試しください。",
    },
    AI_REQUEST_TIMEOUT: {
      title: "AIの応答に時間がかかりすぎました",
      message: "ネットワークを確認して、もう一度お試しください。",
    },
    AI_REQUEST_CANCELLED: {
      title: "AIリクエストが中断されました",
      message: "もう一度お試しください。",
    },
    AI_CONTENT_BLOCKED: {
      title: "AIがこの内容を処理できませんでした",
      message: "安全性またはコンテンツフィルターによりブロックされました。",
    },
    AI_RESPONSE_INVALID: {
      title: "AIの応答を読み取れませんでした",
      message: "予期しない形式の結果です。もう一度お試しください。",
    },
    AI_RESPONSE_INCOMPLETE: {
      title: "AIの応答が不完全です",
      message: "一部の歌詞が欠けています。もう一度お試しください。",
    },
    NETWORK_UNAVAILABLE: {
      title: "ネットワーク接続が切れました",
      message: "インターネット接続を確認してください。",
    },
    PLAYER_PERMISSION_DENIED: {
      title: "SongDocentが音楽アプリを操作できません",
      message: "macOSのプライバシーとセキュリティ > オートメーションで許可してください。",
    },
    PLAYER_NOT_RUNNING: {
      title: "利用できる音楽アプリがありません",
      message: "SpotifyまたはApple Musicを開いて再生してください。",
    },
    PLAYER_RESPONSE_INVALID: {
      title: "再生中の曲を確認できませんでした",
      message: "音楽アプリを再起動して、もう一度お試しください。",
    },
    PLAYER_UNAVAILABLE: {
      title: "音楽アプリが応答していません",
      message: "SpotifyまたはApple Musicの状態を確認してください。",
    },
    LYRICS_AUTH_REQUIRED: {
      title: "歌詞サービスへの接続が必要です",
      message: "歌詞設定で必要な認証情報を保存してください。",
    },
    LYRICS_AUTH_EXPIRED: {
      title: "歌詞サービスの認証期限が切れました",
      message: "歌詞設定で認証情報を更新してください。",
    },
    LYRICS_NOT_FOUND: {
      title: "この曲の歌詞が見つかりませんでした",
      message: "選択した歌詞サービスに曲がない可能性があります。",
    },
    LYRICS_RESPONSE_INVALID: {
      title: "歌詞の応答を読み取れませんでした",
      message: "歌詞サービスから予期しない結果が返されました。",
    },
    LYRICS_RATE_LIMITED: {
      title: "歌詞へのリクエストが一時的に集中しています",
      message: "少し待つとSongDocentが再試行します。",
    },
    LYRICS_SERVICE_UNAVAILABLE: {
      title: "歌詞サービスを一時的に利用できません",
      message: "曲を開いたまま、しばらくしてからお試しください。",
    },
    SETTINGS_LOAD_FAILED: {
      title: "設定を読み込めませんでした",
      message: "Keychainに保存された情報を読み取れません。",
    },
    SETTINGS_SAVE_FAILED: {
      title: "設定を保存できませんでした",
      message: "Keychainへのアクセスを確認してください。",
    },
    SETTINGS_CLEAR_FAILED: {
      title: "保存した認証情報を削除できませんでした",
      message: "Keychainへのアクセスを確認してください。",
    },
    LOCAL_AI_URL_INVALID: {
      title: "ローカルAIのアドレスが正しくありません",
      message: "http:// または https:// で始まるURLを入力してください。",
    },
    LOCAL_AI_MODEL_NOT_FOUND: {
      title: "ローカルAIモデルが読み込まれていません",
      message: "設定したモデルを読み込むか、別のモデルを選択してください。",
    },
    LOCAL_AI_UNREACHABLE: {
      title: "ローカルAIサーバーに接続できません",
      message: "OllamaまたはLM Studioを起動し、アドレスを確認してください。",
    },
    AI_REQUEST_FAILED: {
      title: "AIリクエストに失敗しました",
      message: "サービスとモデルの設定を確認し、もう一度お試しください。",
    },
    AI_RESOURCE_NOT_FOUND: {
      title: "AIの接続先が見つかりません",
      message: "AI設定でサーバーアドレスとAPIパスを確認してください。",
    },
    APP_TASK_FAILED: {
      title: "処理を完了できませんでした",
      message: "もう一度お試しください。続く場合はSongDocentを再起動してください。",
    },
    CACHE_READ_FAILED: {
      title: "保存済みの翻訳を読み込めません",
      message: "歌詞は表示できますが、保存済みの翻訳を読み込めませんでした。",
    },
    CACHE_WRITE_FAILED: {
      title: "翻訳を保存できません",
      message: "現在の翻訳は読めますが、再起動すると失われる場合があります。空き容量とファイルのアクセス権を確認してください。",
    },
    CACHE_CLEAR_FAILED: {
      title: "保存済みの翻訳を削除できません",
      message: "画面では非表示ですが、曲を再度読み込むと表示される場合があります。削除をもう一度お試しください。",
    },
    CACHE_OPERATION_FAILED: {
      title: "翻訳の保存領域を利用できません",
      message: "空き容量とファイルのアクセス権を確認し、もう一度お試しください。",
    },
    LOCAL_AI_CONNECTION_FAILED: {
      title: "ローカルAIへのリクエストに失敗しました",
      message: "サーバーが起動し、設定したモデルが読み込まれているか確認してください。",
    },
    LOCAL_AI_RESPONSE_INVALID: {
      title: "ローカルAIの応答を読み取れません",
      message: "読み込んだモデルとAPIの互換性を確認し、もう一度お試しください。",
    },
    LYRICS_FETCH_FAILED: {
      title: "歌詞を読み込めません",
      message: "歌詞サービスの接続状態を確認し、もう一度お試しください。",
    },
    LYRICS_REQUEST_INVALID: {
      title: "この曲の歌詞を検索できません",
      message: "曲のID、またはタイトルとアーティスト情報がありません。別の曲を再生してください。",
    },
    LYRICS_REQUEST_TIMEOUT: {
      title: "歌詞の取得がタイムアウトしました",
      message: "インターネット接続を確認してください。歌詞の取得を再試行します。",
    },
    SETTINGS_INVALID_VALUE: {
      title: "設定値が正しくありません",
      message: "入力内容を確認し、もう一度お試しください。",
    },
    SETTINGS_OPERATION_FAILED: {
      title: "設定を更新できません",
      message: "システムの認証情報ストアへのアクセスを確認し、もう一度お試しください。",
    },
    unknown: {
      title: "問題が発生しました",
      message: "もう一度お試しください。続く場合はSongDocentを再起動してください。",
    },
  },
  "es": {
    AI_API_KEY_MISSING: { title: "Se necesita una clave API de IA", message: "Abre los ajustes de IA y guarda una clave antes de reintentar." },
    AI_API_KEY_INVALID: { title: "La clave API de IA no es válida", message: "Comprueba la clave guardada o sustitúyela por una válida." },
    AI_API_KEY_COMPROMISED: { title: "Sustituye esta clave API de IA", message: "Google bloqueó la clave porque podría haberse filtrado." },
    AI_PERMISSION_DENIED: { title: "El servicio de IA denegó el acceso", message: "Comprueba las restricciones de la clave API y los permisos del modelo." },
    AI_REGION_UNAVAILABLE: { title: "El nivel gratuito de Gemini no está disponible aquí", message: "Activa la facturación del proyecto en Google AI Studio para continuar." },
    AI_BILLING_REQUIRED: { title: "Revisa la facturación de Gemini", message: "Comprueba la facturación del proyecto en Google AI Studio." },
    AI_REQUEST_INVALID: { title: "No se pudo aceptar la solicitud de IA", message: "Comprueba el modelo seleccionado e inténtalo de nuevo." },
    AI_INPUT_TOO_LARGE: { title: "La letra es demasiado larga para el modelo", message: "Prueba otro modelo con una ventana de contexto mayor." },
    AI_MODEL_NOT_FOUND: { title: "El modelo de IA seleccionado no está disponible", message: "Elige un modelo compatible en los ajustes de IA." },
    AI_RATE_LIMITED: { title: "El servicio de IA recibe demasiadas solicitudes", message: "Espera un momento e inténtalo de nuevo." },
    AI_QUOTA_EXHAUSTED: { title: "Se alcanzó el límite de uso de IA", message: "Comprueba la cuota diaria o de gasto antes de reintentar." },
    AI_SERVICE_ERROR: { title: "El servicio de IA tuvo un problema", message: "El proveedor devolvió un error interno. Vuelve a intentarlo pronto." },
    AI_SERVICE_UNAVAILABLE: { title: "El servicio de IA no está disponible temporalmente", message: "El proveedor puede estar sobrecargado. Vuelve a intentarlo pronto." },
    AI_REQUEST_TIMEOUT: { title: "La solicitud de IA tardó demasiado", message: "Comprueba la conexión e inténtalo de nuevo." },
    AI_REQUEST_CANCELLED: { title: "La solicitud de IA se interrumpió", message: "Vuelve a enviar la solicitud." },
    AI_CONTENT_BLOCKED: { title: "El servicio de IA no pudo procesar esta selección", message: "Un filtro de seguridad o contenido bloqueó la solicitud." },
    AI_RESPONSE_INVALID: { title: "No se pudo leer la respuesta de IA", message: "El proveedor devolvió un resultado inesperado. Inténtalo de nuevo." },
    AI_RESPONSE_INCOMPLETE: { title: "La respuesta de IA estaba incompleta", message: "Faltaban partes de la letra en el resultado. Inténtalo de nuevo." },
    NETWORK_UNAVAILABLE: { title: "Se perdió la conexión de red", message: "Comprueba tu conexión a Internet e inténtalo de nuevo." },
    PLAYER_PERMISSION_DENIED: { title: "SongDocent no puede controlar la app de música", message: "Permite SongDocent en Privacidad y seguridad > Automatización de macOS." },
    PLAYER_NOT_RUNNING: { title: "No hay ninguna app de música disponible", message: "Abre Spotify o Apple Music y reproduce una canción." },
    PLAYER_RESPONSE_INVALID: { title: "SongDocent no pudo leer la canción actual", message: "Reinicia la app de música e inténtalo de nuevo." },
    PLAYER_UNAVAILABLE: { title: "La app de música no responde", message: "Comprueba Spotify o Apple Music e inténtalo de nuevo." },
    LYRICS_AUTH_REQUIRED: { title: "Debes conectar el acceso a las letras", message: "Abre los ajustes de letras y guarda la credencial necesaria." },
    LYRICS_AUTH_EXPIRED: { title: "El acceso a las letras ha caducado", message: "Actualiza la credencial guardada en los ajustes de letras." },
    LYRICS_NOT_FOUND: { title: "No se encontró la letra de esta canción", message: "Es posible que la fuente de letras seleccionada no tenga esta canción." },
    LYRICS_RESPONSE_INVALID: { title: "No se pudo leer la respuesta de letras", message: "El proveedor de letras devolvió un resultado inesperado." },
    LYRICS_RATE_LIMITED: { title: "El proveedor de letras recibe demasiadas solicitudes", message: "Espera un momento y deja que SongDocent vuelva a intentarlo." },
    LYRICS_SERVICE_UNAVAILABLE: { title: "El proveedor de letras no está disponible temporalmente", message: "Mantén la canción abierta y vuelve a intentarlo pronto." },
    SETTINGS_LOAD_FAILED: { title: "No se pudieron cargar los ajustes", message: "SongDocent no pudo leer los datos guardados en el llavero." },
    SETTINGS_SAVE_FAILED: { title: "No se pudieron guardar los ajustes", message: "Comprueba el acceso al llavero e inténtalo de nuevo." },
    SETTINGS_CLEAR_FAILED: { title: "No se pudo eliminar la credencial guardada", message: "Comprueba el acceso al llavero e inténtalo de nuevo." },
    LOCAL_AI_URL_INVALID: { title: "La dirección de IA local no es válida", message: "Introduce una URL que empiece por http:// o https://." },
    LOCAL_AI_MODEL_NOT_FOUND: { title: "El modelo de IA local no está cargado", message: "Carga el modelo configurado o selecciona otro." },
    LOCAL_AI_UNREACHABLE: { title: "SongDocent no puede conectar con el servidor de IA local", message: "Inicia Ollama o LM Studio y comprueba su dirección." },
    AI_REQUEST_FAILED: { title: "Falló la solicitud de IA", message: "Comprueba los ajustes del servicio y del modelo e inténtalo de nuevo." },
    AI_RESOURCE_NOT_FOUND: { title: "No se encontró el endpoint de IA", message: "Comprueba la dirección del servidor y el endpoint de API en los ajustes de IA." },
    APP_TASK_FAILED: { title: "No se pudo completar la operación", message: "Inténtalo de nuevo. Si el problema continúa, reinicia SongDocent." },
    CACHE_READ_FAILED: { title: "No se pudieron cargar las traducciones guardadas", message: "La letra sigue disponible, pero no se pudieron leer las traducciones guardadas." },
    CACHE_WRITE_FAILED: { title: "No se pudo guardar la traducción", message: "Puedes seguir leyéndola, pero podría perderse al reiniciar. Comprueba el espacio y los permisos de archivos." },
    CACHE_CLEAR_FAILED: { title: "No se pudieron eliminar las traducciones guardadas", message: "Están ocultas por ahora, pero podrían reaparecer al cargar la canción. Intenta eliminarlas de nuevo." },
    CACHE_OPERATION_FAILED: { title: "El almacenamiento de traducciones no está disponible", message: "Comprueba el espacio y los permisos de archivos e inténtalo de nuevo." },
    LOCAL_AI_CONNECTION_FAILED: { title: "Falló la solicitud a la IA local", message: "Comprueba que el servidor esté activo y el modelo configurado esté cargado." },
    LOCAL_AI_RESPONSE_INVALID: { title: "No se pudo leer la respuesta de la IA local", message: "Comprueba el modelo cargado y la compatibilidad de la API e inténtalo de nuevo." },
    LYRICS_FETCH_FAILED: { title: "No se pudo cargar la letra", message: "Comprueba la conexión al servicio de letras e inténtalo de nuevo." },
    LYRICS_REQUEST_INVALID: { title: "No se puede buscar esta canción", message: "Falta el ID de la canción o su título y artista. Prueba otra canción." },
    LYRICS_REQUEST_TIMEOUT: { title: "La solicitud de letras tardó demasiado", message: "Comprueba la conexión. SongDocent volverá a intentar cargar la letra." },
    SETTINGS_INVALID_VALUE: { title: "El valor del ajuste no es válido", message: "Comprueba el valor introducido e inténtalo de nuevo." },
    SETTINGS_OPERATION_FAILED: { title: "No se pudieron actualizar los ajustes", message: "Comprueba el acceso al almacén de credenciales del sistema e inténtalo de nuevo." },
    unknown: { title: "Se produjo un problema", message: "Inténtalo de nuevo. Si el problema continúa, reinicia SongDocent." },
  },
  "fr": {
    AI_API_KEY_MISSING: { title: "Une clé API IA est nécessaire", message: "Ouvrez les réglages IA et enregistrez une clé avant de réessayer." },
    AI_API_KEY_INVALID: { title: "La clé API IA est invalide", message: "Vérifiez la clé enregistrée ou remplacez-la par une clé valide." },
    AI_API_KEY_COMPROMISED: { title: "Remplacez cette clé API IA", message: "Google a bloqué la clé car elle pourrait avoir été exposée." },
    AI_PERMISSION_DENIED: { title: "Le service IA a refusé l’accès", message: "Vérifiez les restrictions de la clé API et les autorisations du modèle." },
    AI_REGION_UNAVAILABLE: { title: "L’offre gratuite de Gemini est indisponible ici", message: "Activez la facturation du projet dans Google AI Studio pour continuer." },
    AI_BILLING_REQUIRED: { title: "La facturation Gemini nécessite votre attention", message: "Vérifiez la facturation du projet dans Google AI Studio." },
    AI_REQUEST_INVALID: { title: "La requête IA n’a pas pu être acceptée", message: "Vérifiez le modèle sélectionné puis réessayez." },
    AI_INPUT_TOO_LARGE: { title: "Ces paroles sont trop longues pour le modèle", message: "Essayez un modèle avec une fenêtre de contexte plus grande." },
    AI_MODEL_NOT_FOUND: { title: "Le modèle IA sélectionné est indisponible", message: "Choisissez un modèle pris en charge dans les réglages IA." },
    AI_RATE_LIMITED: { title: "Le service IA reçoit trop de requêtes", message: "Patientez un instant puis réessayez." },
    AI_QUOTA_EXHAUSTED: { title: "La limite d’utilisation de l’IA est atteinte", message: "Vérifiez le quota quotidien ou de dépenses avant de réessayer." },
    AI_SERVICE_ERROR: { title: "Le service IA a rencontré un problème", message: "Le fournisseur a renvoyé une erreur interne. Réessayez bientôt." },
    AI_SERVICE_UNAVAILABLE: { title: "Le service IA est temporairement indisponible", message: "Le fournisseur est peut-être surchargé. Réessayez bientôt." },
    AI_REQUEST_TIMEOUT: { title: "La requête IA a pris trop de temps", message: "Vérifiez la connexion puis réessayez." },
    AI_REQUEST_CANCELLED: { title: "La requête IA a été interrompue", message: "Relancez la requête." },
    AI_CONTENT_BLOCKED: { title: "Le service IA n’a pas pu traiter cette sélection", message: "Un filtre de sécurité ou de contenu a bloqué la requête." },
    AI_RESPONSE_INVALID: { title: "La réponse IA n’a pas pu être lue", message: "Le fournisseur a renvoyé un résultat inattendu. Réessayez." },
    AI_RESPONSE_INCOMPLETE: { title: "La réponse IA était incomplète", message: "Des paroles manquaient dans le résultat. Réessayez." },
    NETWORK_UNAVAILABLE: { title: "La connexion réseau a été perdue", message: "Vérifiez votre connexion Internet puis réessayez." },
    PLAYER_PERMISSION_DENIED: { title: "SongDocent ne peut pas contrôler l’app de musique", message: "Autorisez SongDocent dans Confidentialité et sécurité > Automatisation de macOS." },
    PLAYER_NOT_RUNNING: { title: "Aucune app de musique n’est disponible", message: "Ouvrez Spotify ou Apple Music et lancez un morceau." },
    PLAYER_RESPONSE_INVALID: { title: "SongDocent n’a pas pu lire le morceau actuel", message: "Redémarrez l’app de musique puis réessayez." },
    PLAYER_UNAVAILABLE: { title: "L’app de musique ne répond pas", message: "Vérifiez Spotify ou Apple Music puis réessayez." },
    LYRICS_AUTH_REQUIRED: { title: "L’accès aux paroles doit être connecté", message: "Ouvrez les réglages des paroles et enregistrez l’identifiant requis." },
    LYRICS_AUTH_EXPIRED: { title: "L’accès aux paroles a expiré", message: "Mettez à jour l’identifiant enregistré dans les réglages des paroles." },
    LYRICS_NOT_FOUND: { title: "Les paroles de ce morceau sont introuvables", message: "La source de paroles sélectionnée ne propose peut-être pas ce morceau." },
    LYRICS_RESPONSE_INVALID: { title: "La réponse des paroles n’a pas pu être lue", message: "Le fournisseur de paroles a renvoyé un résultat inattendu." },
    LYRICS_RATE_LIMITED: { title: "Le fournisseur de paroles reçoit trop de requêtes", message: "Patientez et laissez SongDocent réessayer." },
    LYRICS_SERVICE_UNAVAILABLE: { title: "Le fournisseur de paroles est temporairement indisponible", message: "Gardez le morceau ouvert et réessayez bientôt." },
    SETTINGS_LOAD_FAILED: { title: "Les réglages n’ont pas pu être chargés", message: "SongDocent n’a pas pu lire les données enregistrées dans le trousseau." },
    SETTINGS_SAVE_FAILED: { title: "Les réglages n’ont pas pu être enregistrés", message: "Vérifiez l’accès au trousseau puis réessayez." },
    SETTINGS_CLEAR_FAILED: { title: "L’identifiant enregistré n’a pas pu être supprimé", message: "Vérifiez l’accès au trousseau puis réessayez." },
    LOCAL_AI_URL_INVALID: { title: "L’adresse de l’IA locale est invalide", message: "Saisissez une URL commençant par http:// ou https://." },
    LOCAL_AI_MODEL_NOT_FOUND: { title: "Le modèle IA local n’est pas chargé", message: "Chargez le modèle configuré ou choisissez-en un autre." },
    LOCAL_AI_UNREACHABLE: { title: "SongDocent ne peut pas joindre le serveur IA local", message: "Démarrez Ollama ou LM Studio et vérifiez son adresse." },
    AI_REQUEST_FAILED: { title: "La requête IA a échoué", message: "Vérifiez les réglages du service et du modèle puis réessayez." },
    AI_RESOURCE_NOT_FOUND: { title: "Le point d’accès IA est introuvable", message: "Vérifiez l’adresse du serveur et le point d’accès API dans les réglages IA." },
    APP_TASK_FAILED: { title: "L’opération n’a pas pu aboutir", message: "Réessayez. Si le problème persiste, redémarrez SongDocent." },
    CACHE_READ_FAILED: { title: "Les traductions enregistrées n’ont pas pu être chargées", message: "Les paroles restent disponibles, mais les traductions enregistrées n’ont pas pu être lues." },
    CACHE_WRITE_FAILED: { title: "La traduction n’a pas pu être enregistrée", message: "Vous pouvez continuer à la lire, mais elle risque d’être perdue au redémarrage. Vérifiez l’espace disque et les autorisations des fichiers." },
    CACHE_CLEAR_FAILED: { title: "Les traductions enregistrées n’ont pas pu être supprimées", message: "Elles sont masquées pour le moment, mais pourraient réapparaître au chargement du morceau. Réessayez de les supprimer." },
    CACHE_OPERATION_FAILED: { title: "Le stockage des traductions est indisponible", message: "Vérifiez l’espace disque et les autorisations des fichiers puis réessayez." },
    LOCAL_AI_CONNECTION_FAILED: { title: "La requête à l’IA locale a échoué", message: "Vérifiez que le serveur fonctionne et que le modèle configuré est chargé." },
    LOCAL_AI_RESPONSE_INVALID: { title: "La réponse de l’IA locale n’a pas pu être lue", message: "Vérifiez le modèle chargé et la compatibilité de l’API puis réessayez." },
    LYRICS_FETCH_FAILED: { title: "Les paroles n’ont pas pu être chargées", message: "Vérifiez la connexion au service de paroles puis réessayez." },
    LYRICS_REQUEST_INVALID: { title: "Ce morceau ne peut pas être recherché", message: "L’identifiant du morceau ou son titre et son artiste manquent. Essayez un autre morceau." },
    LYRICS_REQUEST_TIMEOUT: { title: "La requête de paroles a pris trop de temps", message: "Vérifiez la connexion. SongDocent réessaiera de charger les paroles." },
    SETTINGS_INVALID_VALUE: { title: "La valeur du réglage est invalide", message: "Vérifiez la valeur saisie puis réessayez." },
    SETTINGS_OPERATION_FAILED: { title: "Les réglages n’ont pas pu être mis à jour", message: "Vérifiez l’accès au stockage des identifiants du système puis réessayez." },
    unknown: { title: "Un problème est survenu", message: "Réessayez. Si le problème persiste, redémarrez SongDocent." },
  },
  "de": {
    AI_API_KEY_MISSING: { title: "Ein KI-API-Schlüssel ist erforderlich", message: "Öffne die KI-Einstellungen und speichere einen Schlüssel, bevor du es erneut versuchst." },
    AI_API_KEY_INVALID: { title: "Der KI-API-Schlüssel ist ungültig", message: "Prüfe den gespeicherten Schlüssel oder ersetze ihn durch einen gültigen." },
    AI_API_KEY_COMPROMISED: { title: "Ersetze diesen KI-API-Schlüssel", message: "Google hat den Schlüssel gesperrt, weil er möglicherweise offengelegt wurde." },
    AI_PERMISSION_DENIED: { title: "Der KI-Dienst hat den Zugriff verweigert", message: "Prüfe die Einschränkungen des API-Schlüssels und die Modellberechtigungen." },
    AI_REGION_UNAVAILABLE: { title: "Die kostenlose Gemini-Stufe ist hier nicht verfügbar", message: "Aktiviere die Abrechnung für das Projekt in Google AI Studio." },
    AI_BILLING_REQUIRED: { title: "Die Gemini-Abrechnung muss geprüft werden", message: "Prüfe die Abrechnung des Projekts in Google AI Studio." },
    AI_REQUEST_INVALID: { title: "Die KI-Anfrage wurde nicht angenommen", message: "Prüfe das ausgewählte Modell und versuche es erneut." },
    AI_INPUT_TOO_LARGE: { title: "Der Songtext ist für das Modell zu lang", message: "Versuche ein Modell mit größerem Kontextfenster." },
    AI_MODEL_NOT_FOUND: { title: "Das ausgewählte KI-Modell ist nicht verfügbar", message: "Wähle in den KI-Einstellungen ein unterstütztes Modell." },
    AI_RATE_LIMITED: { title: "Der KI-Dienst erhält zu viele Anfragen", message: "Warte einen Moment und versuche es erneut." },
    AI_QUOTA_EXHAUSTED: { title: "Das KI-Nutzungslimit ist erreicht", message: "Prüfe das Tages- oder Ausgabenlimit, bevor du es erneut versuchst." },
    AI_SERVICE_ERROR: { title: "Beim KI-Dienst ist ein Problem aufgetreten", message: "Der Anbieter meldete einen internen Fehler. Versuche es gleich erneut." },
    AI_SERVICE_UNAVAILABLE: { title: "Der KI-Dienst ist vorübergehend nicht verfügbar", message: "Der Anbieter ist möglicherweise überlastet. Versuche es gleich erneut." },
    AI_REQUEST_TIMEOUT: { title: "Die KI-Anfrage hat zu lange gedauert", message: "Prüfe die Verbindung und versuche es erneut." },
    AI_REQUEST_CANCELLED: { title: "Die KI-Anfrage wurde unterbrochen", message: "Sende die Anfrage erneut." },
    AI_CONTENT_BLOCKED: { title: "Der KI-Dienst konnte diese Auswahl nicht verarbeiten", message: "Ein Sicherheits- oder Inhaltsfilter hat die Anfrage blockiert." },
    AI_RESPONSE_INVALID: { title: "Die KI-Antwort konnte nicht gelesen werden", message: "Der Anbieter lieferte ein unerwartetes Ergebnis. Versuche es erneut." },
    AI_RESPONSE_INCOMPLETE: { title: "Die KI-Antwort war unvollständig", message: "Im Ergebnis fehlten Teile des Songtexts. Versuche es erneut." },
    NETWORK_UNAVAILABLE: { title: "Die Netzwerkverbindung wurde unterbrochen", message: "Prüfe deine Internetverbindung und versuche es erneut." },
    PLAYER_PERMISSION_DENIED: { title: "SongDocent kann die Musik-App nicht steuern", message: "Erlaube SongDocent unter macOS Datenschutz & Sicherheit > Automation." },
    PLAYER_NOT_RUNNING: { title: "Keine Musik-App verfügbar", message: "Öffne Spotify oder Apple Music und spiele einen Titel ab." },
    PLAYER_RESPONSE_INVALID: { title: "SongDocent konnte den aktuellen Titel nicht lesen", message: "Starte die Musik-App neu und versuche es erneut." },
    PLAYER_UNAVAILABLE: { title: "Die Musik-App antwortet nicht", message: "Prüfe Spotify oder Apple Music und versuche es erneut." },
    LYRICS_AUTH_REQUIRED: { title: "Der Songtext-Zugriff muss verbunden werden", message: "Öffne die Songtext-Einstellungen und speichere die erforderlichen Zugangsdaten." },
    LYRICS_AUTH_EXPIRED: { title: "Der Songtext-Zugriff ist abgelaufen", message: "Aktualisiere die gespeicherten Zugangsdaten in den Songtext-Einstellungen." },
    LYRICS_NOT_FOUND: { title: "Für diesen Titel wurde kein Songtext gefunden", message: "Die ausgewählte Songtext-Quelle enthält diesen Titel möglicherweise nicht." },
    LYRICS_RESPONSE_INVALID: { title: "Die Songtext-Antwort konnte nicht gelesen werden", message: "Der Songtext-Anbieter lieferte ein unerwartetes Ergebnis." },
    LYRICS_RATE_LIMITED: { title: "Der Songtext-Anbieter erhält zu viele Anfragen", message: "Warte einen Moment, bis SongDocent es erneut versucht." },
    LYRICS_SERVICE_UNAVAILABLE: { title: "Der Songtext-Anbieter ist vorübergehend nicht verfügbar", message: "Lass den Titel geöffnet und versuche es gleich erneut." },
    SETTINGS_LOAD_FAILED: { title: "Die Einstellungen konnten nicht geladen werden", message: "SongDocent konnte die gespeicherten Schlüsselbunddaten nicht lesen." },
    SETTINGS_SAVE_FAILED: { title: "Die Einstellungen konnten nicht gespeichert werden", message: "Prüfe den Schlüsselbund-Zugriff und versuche es erneut." },
    SETTINGS_CLEAR_FAILED: { title: "Die gespeicherten Zugangsdaten konnten nicht entfernt werden", message: "Prüfe den Schlüsselbund-Zugriff und versuche es erneut." },
    LOCAL_AI_URL_INVALID: { title: "Die lokale KI-Adresse ist ungültig", message: "Gib eine URL ein, die mit http:// oder https:// beginnt." },
    LOCAL_AI_MODEL_NOT_FOUND: { title: "Das lokale KI-Modell ist nicht geladen", message: "Lade das konfigurierte Modell oder wähle ein anderes." },
    LOCAL_AI_UNREACHABLE: { title: "SongDocent erreicht den lokalen KI-Server nicht", message: "Starte Ollama oder LM Studio und prüfe die Adresse." },
    AI_REQUEST_FAILED: { title: "Die KI-Anfrage ist fehlgeschlagen", message: "Prüfe die Dienst- und Modelleinstellungen und versuche es erneut." },
    AI_RESOURCE_NOT_FOUND: { title: "Der KI-Endpunkt wurde nicht gefunden", message: "Prüfe Serveradresse und API-Endpunkt in den KI-Einstellungen." },
    APP_TASK_FAILED: { title: "Der Vorgang konnte nicht abgeschlossen werden", message: "Versuche es erneut. Falls das Problem bleibt, starte SongDocent neu." },
    CACHE_READ_FAILED: { title: "Gespeicherte Übersetzungen konnten nicht geladen werden", message: "Der Songtext bleibt verfügbar, aber gespeicherte Übersetzungen konnten nicht gelesen werden." },
    CACHE_WRITE_FAILED: { title: "Die Übersetzung konnte nicht gespeichert werden", message: "Du kannst sie weiterlesen, aber sie könnte beim Neustart verloren gehen. Prüfe Speicherplatz und Dateiberechtigungen." },
    CACHE_CLEAR_FAILED: { title: "Gespeicherte Übersetzungen konnten nicht gelöscht werden", message: "Sie sind vorerst ausgeblendet, könnten beim erneuten Laden des Titels aber wieder erscheinen. Versuche erneut, sie zu löschen." },
    CACHE_OPERATION_FAILED: { title: "Der Übersetzungsspeicher ist nicht verfügbar", message: "Prüfe Speicherplatz und Dateiberechtigungen und versuche es erneut." },
    LOCAL_AI_CONNECTION_FAILED: { title: "Die lokale KI-Anfrage ist fehlgeschlagen", message: "Prüfe, ob der Server läuft und das konfigurierte Modell geladen ist." },
    LOCAL_AI_RESPONSE_INVALID: { title: "Die lokale KI-Antwort konnte nicht gelesen werden", message: "Prüfe das geladene Modell und die API-Kompatibilität und versuche es erneut." },
    LYRICS_FETCH_FAILED: { title: "Der Songtext konnte nicht geladen werden", message: "Prüfe die Verbindung zum Songtext-Dienst und versuche es erneut." },
    LYRICS_REQUEST_INVALID: { title: "Dieser Titel kann nicht gesucht werden", message: "Die Titel-ID oder Titel und Interpret fehlen. Versuche einen anderen Titel." },
    LYRICS_REQUEST_TIMEOUT: { title: "Die Songtext-Anfrage hat zu lange gedauert", message: "Prüfe die Verbindung. SongDocent versucht erneut, den Songtext zu laden." },
    SETTINGS_INVALID_VALUE: { title: "Der Einstellungswert ist ungültig", message: "Prüfe den eingegebenen Wert und versuche es erneut." },
    SETTINGS_OPERATION_FAILED: { title: "Die Einstellungen konnten nicht aktualisiert werden", message: "Prüfe den Zugriff auf den Anmeldedatenspeicher des Systems und versuche es erneut." },
    unknown: { title: "Ein Problem ist aufgetreten", message: "Versuche es erneut. Falls das Problem bleibt, starte SongDocent neu." },
  },
  "pt-BR": {
    AI_API_KEY_MISSING: { title: "É necessária uma chave de API de IA", message: "Abra os ajustes de IA e salve uma chave antes de tentar novamente." },
    AI_API_KEY_INVALID: { title: "A chave de API de IA é inválida", message: "Confira a chave salva ou substitua-a por uma válida." },
    AI_API_KEY_COMPROMISED: { title: "Substitua esta chave de API de IA", message: "O Google bloqueou a chave porque ela pode ter sido exposta." },
    AI_PERMISSION_DENIED: { title: "O serviço de IA negou o acesso", message: "Confira as restrições da chave de API e as permissões do modelo." },
    AI_REGION_UNAVAILABLE: { title: "O plano gratuito do Gemini não está disponível aqui", message: "Ative o faturamento do projeto no Google AI Studio para continuar." },
    AI_BILLING_REQUIRED: { title: "O faturamento do Gemini precisa de atenção", message: "Confira o faturamento do projeto no Google AI Studio." },
    AI_REQUEST_INVALID: { title: "A solicitação de IA não foi aceita", message: "Confira o modelo selecionado e tente novamente." },
    AI_INPUT_TOO_LARGE: { title: "Esta letra é longa demais para o modelo", message: "Experimente outro modelo com uma janela de contexto maior." },
    AI_MODEL_NOT_FOUND: { title: "O modelo de IA selecionado está indisponível", message: "Escolha um modelo compatível nos ajustes de IA." },
    AI_RATE_LIMITED: { title: "O serviço de IA está recebendo solicitações demais", message: "Aguarde um momento e tente novamente." },
    AI_QUOTA_EXHAUSTED: { title: "O limite de uso da IA foi atingido", message: "Confira a cota diária ou de gastos antes de tentar novamente." },
    AI_SERVICE_ERROR: { title: "O serviço de IA apresentou um problema", message: "O provedor retornou um erro interno. Tente novamente em instantes." },
    AI_SERVICE_UNAVAILABLE: { title: "O serviço de IA está temporariamente indisponível", message: "O provedor pode estar sobrecarregado. Tente novamente em instantes." },
    AI_REQUEST_TIMEOUT: { title: "A solicitação de IA demorou demais", message: "Confira a conexão e tente novamente." },
    AI_REQUEST_CANCELLED: { title: "A solicitação de IA foi interrompida", message: "Envie a solicitação novamente." },
    AI_CONTENT_BLOCKED: { title: "O serviço de IA não conseguiu processar esta seleção", message: "Um filtro de segurança ou conteúdo bloqueou a solicitação." },
    AI_RESPONSE_INVALID: { title: "Não foi possível ler a resposta da IA", message: "O provedor retornou um resultado inesperado. Tente novamente." },
    AI_RESPONSE_INCOMPLETE: { title: "A resposta da IA estava incompleta", message: "Partes da letra estavam ausentes do resultado. Tente novamente." },
    NETWORK_UNAVAILABLE: { title: "A conexão de rede foi perdida", message: "Confira sua conexão com a internet e tente novamente." },
    PLAYER_PERMISSION_DENIED: { title: "O SongDocent não consegue controlar o app de música", message: "Permita o SongDocent em Privacidade e Segurança > Automação no macOS." },
    PLAYER_NOT_RUNNING: { title: "Nenhum app de música está disponível", message: "Abra o Spotify ou Apple Music e reproduza uma faixa." },
    PLAYER_RESPONSE_INVALID: { title: "O SongDocent não conseguiu ler a faixa atual", message: "Reinicie o app de música e tente novamente." },
    PLAYER_UNAVAILABLE: { title: "O app de música não está respondendo", message: "Confira o Spotify ou Apple Music e tente novamente." },
    LYRICS_AUTH_REQUIRED: { title: "É necessário conectar o acesso às letras", message: "Abra os ajustes de letras e salve a credencial necessária." },
    LYRICS_AUTH_EXPIRED: { title: "O acesso às letras expirou", message: "Atualize a credencial salva nos ajustes de letras." },
    LYRICS_NOT_FOUND: { title: "A letra desta faixa não foi encontrada", message: "A fonte de letras selecionada talvez não tenha esta música." },
    LYRICS_RESPONSE_INVALID: { title: "Não foi possível ler a resposta de letras", message: "O provedor de letras retornou um resultado inesperado." },
    LYRICS_RATE_LIMITED: { title: "O provedor de letras está recebendo solicitações demais", message: "Aguarde um momento para o SongDocent tentar novamente." },
    LYRICS_SERVICE_UNAVAILABLE: { title: "O provedor de letras está temporariamente indisponível", message: "Mantenha a faixa aberta e tente novamente em instantes." },
    SETTINGS_LOAD_FAILED: { title: "Não foi possível carregar os ajustes", message: "O SongDocent não conseguiu ler os dados salvos nas Chaves." },
    SETTINGS_SAVE_FAILED: { title: "Não foi possível salvar os ajustes", message: "Confira o acesso às Chaves e tente novamente." },
    SETTINGS_CLEAR_FAILED: { title: "Não foi possível remover a credencial salva", message: "Confira o acesso às Chaves e tente novamente." },
    LOCAL_AI_URL_INVALID: { title: "O endereço da IA local é inválido", message: "Digite uma URL que comece com http:// ou https://." },
    LOCAL_AI_MODEL_NOT_FOUND: { title: "O modelo de IA local não está carregado", message: "Carregue o modelo configurado ou selecione outro." },
    LOCAL_AI_UNREACHABLE: { title: "O SongDocent não consegue acessar o servidor de IA local", message: "Inicie o Ollama ou LM Studio e confira o endereço." },
    AI_REQUEST_FAILED: { title: "A solicitação de IA falhou", message: "Confira os ajustes do serviço e do modelo e tente novamente." },
    AI_RESOURCE_NOT_FOUND: { title: "O endpoint de IA não foi encontrado", message: "Confira o endereço do servidor e o endpoint da API nos ajustes de IA." },
    APP_TASK_FAILED: { title: "Não foi possível concluir a operação", message: "Tente novamente. Se o problema continuar, reinicie o SongDocent." },
    CACHE_READ_FAILED: { title: "Não foi possível carregar as traduções salvas", message: "A letra continua disponível, mas as traduções salvas não puderam ser lidas." },
    CACHE_WRITE_FAILED: { title: "Não foi possível salvar a tradução", message: "Você pode continuar lendo, mas ela pode ser perdida ao reiniciar. Confira o espaço em disco e as permissões dos arquivos." },
    CACHE_CLEAR_FAILED: { title: "Não foi possível excluir as traduções salvas", message: "Elas estão ocultas por enquanto, mas podem reaparecer ao carregar a faixa. Tente excluí-las novamente." },
    CACHE_OPERATION_FAILED: { title: "O armazenamento de traduções está indisponível", message: "Confira o espaço em disco e as permissões dos arquivos e tente novamente." },
    LOCAL_AI_CONNECTION_FAILED: { title: "A solicitação à IA local falhou", message: "Confira se o servidor está ativo e o modelo configurado está carregado." },
    LOCAL_AI_RESPONSE_INVALID: { title: "Não foi possível ler a resposta da IA local", message: "Confira o modelo carregado e a compatibilidade da API e tente novamente." },
    LYRICS_FETCH_FAILED: { title: "Não foi possível carregar a letra", message: "Confira a conexão com o serviço de letras e tente novamente." },
    LYRICS_REQUEST_INVALID: { title: "Não é possível buscar esta faixa", message: "Falta o ID da faixa ou o título e o artista. Experimente outra faixa." },
    LYRICS_REQUEST_TIMEOUT: { title: "A solicitação de letras demorou demais", message: "Confira a conexão. O SongDocent tentará carregar a letra novamente." },
    SETTINGS_INVALID_VALUE: { title: "O valor do ajuste é inválido", message: "Confira o valor inserido e tente novamente." },
    SETTINGS_OPERATION_FAILED: { title: "Não foi possível atualizar os ajustes", message: "Confira o acesso ao armazenamento de credenciais do sistema e tente novamente." },
    unknown: { title: "Ocorreu um problema", message: "Tente novamente. Se o problema continuar, reinicie o SongDocent." },
  },
  "zh-CN": {
    AI_API_KEY_MISSING: { title: "需要 AI API 密钥", message: "请打开 AI 设置并保存密钥，然后重试。" },
    AI_API_KEY_INVALID: { title: "AI API 密钥无效", message: "请检查已保存的密钥或更换有效密钥。" },
    AI_API_KEY_COMPROMISED: { title: "请更换此 AI API 密钥", message: "Google 因密钥可能泄露而将其封禁。" },
    AI_PERMISSION_DENIED: { title: "AI 服务拒绝访问", message: "请检查 API 密钥限制和模型权限。" },
    AI_REGION_UNAVAILABLE: { title: "此地区无法使用 Gemini 免费层级", message: "请在 Google AI Studio 中为项目启用结算以继续。" },
    AI_BILLING_REQUIRED: { title: "Gemini 结算需要处理", message: "请在 Google AI Studio 中检查项目的结算设置。" },
    AI_REQUEST_INVALID: { title: "AI 请求未被接受", message: "请检查所选模型后重试。" },
    AI_INPUT_TOO_LARGE: { title: "歌词超出模型处理长度", message: "请尝试上下文窗口更大的模型。" },
    AI_MODEL_NOT_FOUND: { title: "所选 AI 模型不可用", message: "请在 AI 设置中选择受支持的模型。" },
    AI_RATE_LIMITED: { title: "AI 服务收到的请求过多", message: "请稍等片刻后重试。" },
    AI_QUOTA_EXHAUSTED: { title: "已达到 AI 使用限额", message: "请检查每日配额或费用限额后重试。" },
    AI_SERVICE_ERROR: { title: "AI 服务出现问题", message: "服务商返回了内部错误，请稍后重试。" },
    AI_SERVICE_UNAVAILABLE: { title: "AI 服务暂时不可用", message: "服务商可能负载过高，请稍后重试。" },
    AI_REQUEST_TIMEOUT: { title: "AI 请求超时", message: "请检查连接后重试。" },
    AI_REQUEST_CANCELLED: { title: "AI 请求已中断", message: "请重新发送请求。" },
    AI_CONTENT_BLOCKED: { title: "AI 服务无法处理所选内容", message: "安全或内容过滤器阻止了该请求。" },
    AI_RESPONSE_INVALID: { title: "无法读取 AI 响应", message: "服务商返回了意外结果，请重试。" },
    AI_RESPONSE_INCOMPLETE: { title: "AI 响应不完整", message: "结果中缺少部分歌词，请重试。" },
    NETWORK_UNAVAILABLE: { title: "网络连接已断开", message: "请检查互联网连接后重试。" },
    PLAYER_PERMISSION_DENIED: { title: "SongDocent 无法控制音乐应用", message: "请在 macOS 的隐私与安全性 > 自动化中允许 SongDocent。" },
    PLAYER_NOT_RUNNING: { title: "没有可用的音乐应用", message: "请打开 Spotify 或 Apple Music 并播放歌曲。" },
    PLAYER_RESPONSE_INVALID: { title: "SongDocent 无法读取当前歌曲", message: "请重启音乐应用后重试。" },
    PLAYER_UNAVAILABLE: { title: "音乐应用没有响应", message: "请检查 Spotify 或 Apple Music 后重试。" },
    LYRICS_AUTH_REQUIRED: { title: "需要连接歌词访问权限", message: "请打开歌词设置并保存所需凭据。" },
    LYRICS_AUTH_EXPIRED: { title: "歌词访问权限已过期", message: "请在歌词设置中更新保存的凭据。" },
    LYRICS_NOT_FOUND: { title: "未找到这首歌的歌词", message: "所选歌词来源可能没有收录这首歌。" },
    LYRICS_RESPONSE_INVALID: { title: "无法读取歌词响应", message: "歌词服务商返回了意外结果。" },
    LYRICS_RATE_LIMITED: { title: "歌词服务商收到的请求过多", message: "请稍等片刻，让 SongDocent 重试。" },
    LYRICS_SERVICE_UNAVAILABLE: { title: "歌词服务商暂时不可用", message: "请保持歌曲打开，稍后重试。" },
    SETTINGS_LOAD_FAILED: { title: "无法加载设置", message: "SongDocent 无法读取钥匙串中保存的数据。" },
    SETTINGS_SAVE_FAILED: { title: "无法保存设置", message: "请检查钥匙串访问权限后重试。" },
    SETTINGS_CLEAR_FAILED: { title: "无法删除已保存的凭据", message: "请检查钥匙串访问权限后重试。" },
    LOCAL_AI_URL_INVALID: { title: "本地 AI 地址无效", message: "请输入以 http:// 或 https:// 开头的 URL。" },
    LOCAL_AI_MODEL_NOT_FOUND: { title: "本地 AI 模型未加载", message: "请加载配置的模型或选择其他模型。" },
    LOCAL_AI_UNREACHABLE: { title: "SongDocent 无法连接本地 AI 服务器", message: "请启动 Ollama 或 LM Studio 并检查其地址。" },
    AI_REQUEST_FAILED: { title: "AI 请求失败", message: "请检查服务和模型设置后重试。" },
    AI_RESOURCE_NOT_FOUND: { title: "未找到 AI 端点", message: "请在 AI 设置中检查服务器地址和 API 端点。" },
    APP_TASK_FAILED: { title: "无法完成操作", message: "请重试。如果问题持续，请重新启动 SongDocent。" },
    CACHE_READ_FAILED: { title: "无法加载已保存的翻译", message: "仍可查看歌词，但无法读取已保存的翻译。" },
    CACHE_WRITE_FAILED: { title: "无法保存翻译", message: "您可以继续阅读，但重启后可能丢失。请检查磁盘空间和文件权限。" },
    CACHE_CLEAR_FAILED: { title: "无法删除已保存的翻译", message: "翻译暂时已隐藏，但重新加载歌曲时可能再次出现。请再次尝试删除。" },
    CACHE_OPERATION_FAILED: { title: "翻译存储不可用", message: "请检查磁盘空间和文件权限后重试。" },
    LOCAL_AI_CONNECTION_FAILED: { title: "本地 AI 请求失败", message: "请确认服务器正在运行且已加载配置的模型。" },
    LOCAL_AI_RESPONSE_INVALID: { title: "无法读取本地 AI 响应", message: "请检查已加载的模型和 API 兼容性后重试。" },
    LYRICS_FETCH_FAILED: { title: "无法加载歌词", message: "请检查歌词服务连接后重试。" },
    LYRICS_REQUEST_INVALID: { title: "无法搜索此歌曲", message: "缺少歌曲 ID，或缺少标题和艺术家信息。请尝试其他歌曲。" },
    LYRICS_REQUEST_TIMEOUT: { title: "歌词请求超时", message: "请检查连接。SongDocent 将再次尝试加载歌词。" },
    SETTINGS_INVALID_VALUE: { title: "设置值无效", message: "请检查输入的值后重试。" },
    SETTINGS_OPERATION_FAILED: { title: "无法更新设置", message: "请检查系统凭据存储的访问权限后重试。" },
    unknown: { title: "出现了问题", message: "请重试。如果问题持续，请重新启动 SongDocent。" },
  },

} satisfies Record<LangCode, Record<ErrorCopyCode, ErrorCopy>>;

function candidateFrom(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function technicalMessage(value: unknown) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function normalizeAppError(value: unknown): AppError {
  const candidate = candidateFrom(value);
  const domain = candidate?.domain;
  if (
    candidate &&
    typeof candidate.code === "string" &&
    typeof domain === "string" &&
    DOMAINS.has(domain as AppErrorDomain)
  ) {
    return {
      code: candidate.code,
      domain: domain as AppErrorDomain,
      retryable: candidate.retryable === true,
      technicalMessage:
        typeof candidate.technicalMessage === "string"
          ? candidate.technicalMessage
          : technicalMessage(value),
    };
  }

  return {
    code: "UNKNOWN",
    domain: "unknown",
    retryable: false,
    technicalMessage: technicalMessage(value),
  };
}

export function replaceCurrentError(
  current: AppError | null,
  next: AppError,
): AppError {
  if (current?.code === next.code && current.domain === next.domain) return current;
  return next;
}

export function mergeCurrentError(
  current: CurrentAppError | null,
  next: AppError,
  retry?: AppErrorRetryAction,
): CurrentAppError {
  const sameIdentity =
    current?.error.code === next.code && current.error.domain === next.domain;

  return {
    error: replaceCurrentError(current?.error ?? null, next),
    retry: retry ?? (sameIdentity ? current?.retry : undefined),
  };
}

export function clearCurrentError(
  current: AppError | null,
  domain?: AppErrorDomain,
): AppError | null {
  if (!current || (domain && current.domain !== domain)) return current;
  return null;
}

const AI_SETTINGS_CODES = new Set([
  "AI_API_KEY_MISSING",
  "AI_API_KEY_INVALID",
  "AI_API_KEY_COMPROMISED",
  "AI_PERMISSION_DENIED",
  "AI_MODEL_NOT_FOUND",
  "LOCAL_AI_URL_INVALID",
  "LOCAL_AI_MODEL_NOT_FOUND",
  "LOCAL_AI_UNREACHABLE",
  "LOCAL_AI_CONNECTION_FAILED",
  "LOCAL_AI_RESPONSE_INVALID",
  "AI_RESOURCE_NOT_FOUND",
]);

const LYRICS_SETTINGS_CODES = new Set([
  "LYRICS_AUTH_REQUIRED",
  "LYRICS_AUTH_EXPIRED",
]);

function recoveryAction(error: AppError): ErrorRecoveryAction {
  if (["CLI_NOT_FOUND", "CLI_UNSUPPORTED", "CLI_AUTH_REQUIRED", "CLI_MODEL_UNAVAILABLE", "CLI_SEARCH_UNAVAILABLE"].includes(error.code)) return "open-ai-settings";
  if (AI_SETTINGS_CODES.has(error.code)) return "open-ai-settings";
  if (LYRICS_SETTINGS_CODES.has(error.code)) return "open-lyrics-settings";
  if (error.retryable) return "retry";
  return "none";
}

export function getErrorPresentation(
  error: AppError,
  lang: LangCode,
  platform: DesktopPlatform = "macos",
): ErrorPresentation {
  const localizedCopy: Record<string, ErrorCopy> = COPY[lang];
  let copy = localizedCopy[error.code] ?? localizedCopy.unknown;

  if (error.code.startsWith("CLI_")) copy = { title: CLI_CONNECTION_TITLE[lang], message: cliErrorMessage(error, lang) };
  if (platform === "windows") {
    const platformMessages = WINDOWS_ERROR_MESSAGES[lang];
    if (error.code === "PLAYER_PERMISSION_DENIED") {
      copy = { ...copy, message: platformMessages.playerPermission };
    } else if (error.code === "SETTINGS_LOAD_FAILED") {
      copy = { ...copy, message: platformMessages.settingsLoad };
    } else if (
      error.code === "SETTINGS_SAVE_FAILED" ||
      error.code === "SETTINGS_CLEAR_FAILED"
    ) {
      copy = { ...copy, message: platformMessages.settingsAccess };
    }
  }
  return { ...copy, action: recoveryAction(error) };
}
