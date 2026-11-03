import type { LangCode } from "./i18n";
import type { ProviderConnectionStatus, SessionProvider } from "./providerConnection";

export type ProviderConnectionCopy = {
  riskTitle: string;
  riskBody: string;
  understandAndConnect: string;
  cancel: string;
  connect: string;
  reconnect: string;
  disconnect: string;
  unofficial: string;
  waiting: string;
  validating: string;
  connected: string;
  expired: string;
  timedOut: string;
  blocked: string;
  invalid: string;
  unavailable: string;
  storeDenied: string;
  startFailed: string;
  statusUnavailable: string;
  retry: string;
  manualAdvanced: string;
};

export const PROVIDER_CONNECTION_LANGUAGES: readonly LangCode[] = [
  "en",
  "ko",
  "ja",
  "es",
  "fr",
  "de",
  "pt-BR",
  "zh-CN",
];

const content: Record<LangCode, ProviderConnectionCopy> = {
  en: {
    riskTitle: "Understand the risk before connecting {provider}",
    riskBody: "SongDocent's {provider} lyrics connection is not an official API integration for that service. Depending on its policies, the feature may stop working or your account may be limited or suspended. After you sign in through the in-app window, SongDocent automatically retrieves your authentication cookie and stores it only in this device's secure storage to access lyrics.",
    understandAndConnect: "I understand the risk and connect",
    cancel: "Cancel",
    connect: "Connect {provider}",
    reconnect: "Reconnect",
    disconnect: "Disconnect",
    unofficial: "Unofficial connection",
    waiting: "Finish signing in in the {provider} window.",
    validating: "Checking the session securely…",
    connected: "Connected",
    expired: "Session expired. Reconnect to keep lyrics working.",
    timedOut: "The connection timed out.",
    blocked: "The sign-in page was blocked for safety.",
    invalid: "The captured session is invalid.",
    unavailable: "The service could not verify the session.",
    storeDenied: "SongDocent could not save the session in secure storage.",
    startFailed: "Could not open the sign-in window. Try connecting again.",
    statusUnavailable: "Could not check the connection status. Close the sign-in window and try again.",
    retry: "Try again",
    manualAdvanced: "Enter cookie manually (advanced)",
  },
  ko: {
    riskTitle: "{provider} 연결 전 위험 안내",
    riskBody: "SongDocent의 {provider} 가사 연결은 해당 서비스의 공식 API 연동이 아닙니다. 서비스 정책에 따라 기능이 중단되거나 계정이 제한 또는 정지될 가능성이 있습니다. 앱 내 로그인 창에서 로그인하면 SongDocent가 인증 쿠키를 자동으로 가져와 이 기기의 보안 저장소에만 저장하고, 가사를 불러오는 데 사용합니다.",
    understandAndConnect: "위험을 이해하고 연결",
    cancel: "취소",
    connect: "{provider} 연결",
    reconnect: "다시 연결",
    disconnect: "연결 해제",
    unofficial: "비공식 연결",
    waiting: "{provider} 창에서 로그인을 완료해 주세요.",
    validating: "세션을 안전하게 확인하는 중…",
    connected: "연결됨",
    expired: "세션이 만료되었습니다. 가사를 계속 사용하려면 다시 연결하세요.",
    timedOut: "연결 시간이 초과되었습니다.",
    blocked: "안전을 위해 로그인 페이지를 차단했습니다.",
    invalid: "가져온 세션이 유효하지 않습니다.",
    unavailable: "서비스에서 세션을 확인할 수 없습니다.",
    storeDenied: "보안 저장소에 세션을 저장하지 못했습니다.",
    startFailed: "로그인 창을 열지 못했어요. 연결을 다시 시도해 주세요.",
    statusUnavailable: "연결 상태를 확인하지 못했어요. 로그인 창을 닫고 다시 시도해 주세요.",
    retry: "다시 시도",
    manualAdvanced: "쿠키 직접 입력(고급)",
  },
  ja: {
    riskTitle: "{provider}に接続する前にリスクをご確認ください",
    riskBody: "SongDocentの{provider}歌詞接続は、そのサービスの公式API連携ではありません。サービスのポリシーにより、機能が停止したり、アカウントが制限または停止されたりする可能性があります。アプリ内のログインウィンドウでログインすると、SongDocentが認証Cookieを自動的に取得し、この端末の安全なストレージにのみ保存して、歌詞の取得に使用します。",
    understandAndConnect: "リスクを理解して接続",
    cancel: "キャンセル",
    connect: "{provider}に接続",
    reconnect: "再接続",
    disconnect: "接続解除",
    unofficial: "非公式接続",
    waiting: "{provider}ウィンドウでログインを完了してください。",
    validating: "セッションを安全に確認中…",
    connected: "接続済み",
    expired: "セッションの有効期限が切れました。歌詞を使い続けるには再接続してください。",
    timedOut: "接続がタイムアウトしました。",
    blocked: "安全のためログインページをブロックしました。",
    invalid: "取得したセッションは無効です。",
    unavailable: "サービスでセッションを確認できません。",
    storeDenied: "安全なストレージにセッションを保存できませんでした。",
    startFailed: "ログインウィンドウを開けませんでした。もう一度接続してください。",
    statusUnavailable: "接続状態を確認できませんでした。ログインウィンドウを閉じて、もう一度お試しください。",
    retry: "もう一度試す",
    manualAdvanced: "Cookieを手動入力（詳細）",
  },
  es: {
    riskTitle: "Comprende el riesgo antes de conectar {provider}",
    riskBody: "La conexión de letras de SongDocent con {provider} no es una integración oficial de su API. Según las políticas del servicio, la función puede dejar de funcionar o tu cuenta puede quedar limitada o suspendida. Al iniciar sesión en la ventana de la aplicación, SongDocent obtiene automáticamente tu cookie de autenticación y la guarda únicamente en el almacenamiento seguro de este dispositivo para obtener las letras.",
    understandAndConnect: "Entiendo el riesgo y conectar",
    cancel: "Cancelar",
    connect: "Conectar {provider}",
    reconnect: "Volver a conectar",
    disconnect: "Desconectar",
    unofficial: "Conexión no oficial",
    waiting: "Completa el inicio de sesión en la ventana de {provider}.",
    validating: "Comprobando la sesión de forma segura…",
    connected: "Conectado",
    expired: "La sesión caducó. Vuelve a conectar para seguir usando las letras.",
    timedOut: "Se agotó el tiempo de conexión.",
    blocked: "La página de acceso se bloqueó por seguridad.",
    invalid: "La sesión capturada no es válida.",
    unavailable: "El servicio no pudo verificar la sesión.",
    storeDenied: "No se pudo guardar la sesión en el almacenamiento seguro.",
    startFailed: "No se pudo abrir la ventana de inicio de sesión. Vuelve a conectar.",
    statusUnavailable: "No se pudo comprobar la conexión. Cierra la ventana de inicio de sesión y vuelve a intentarlo.",
    retry: "Reintentar",
    manualAdvanced: "Introducir cookie manualmente (avanzado)",
  },
  fr: {
    riskTitle: "Comprendre le risque avant de connecter {provider}",
    riskBody: "La connexion aux paroles de SongDocent pour {provider} n'est pas une intégration API officielle de ce service. Selon ses règles, la fonction peut cesser de marcher ou votre compte peut être limité ou suspendu. Après votre connexion dans la fenêtre intégrée à l’application, SongDocent récupère automatiquement votre cookie d’authentification et le conserve uniquement dans le stockage sécurisé de cet appareil pour accéder aux paroles.",
    understandAndConnect: "Je comprends le risque et je me connecte",
    cancel: "Annuler",
    connect: "Connecter {provider}",
    reconnect: "Reconnecter",
    disconnect: "Déconnecter",
    unofficial: "Connexion non officielle",
    waiting: "Terminez la connexion dans la fenêtre {provider}.",
    validating: "Vérification sécurisée de la session…",
    connected: "Connecté",
    expired: "La session a expiré. Reconnectez-vous pour continuer à utiliser les paroles.",
    timedOut: "Le délai de connexion est dépassé.",
    blocked: "La page de connexion a été bloquée par sécurité.",
    invalid: "La session récupérée n'est pas valide.",
    unavailable: "Le service n'a pas pu vérifier la session.",
    storeDenied: "Impossible d'enregistrer la session dans le stockage sécurisé.",
    startFailed: "Impossible d’ouvrir la fenêtre de connexion. Réessayez.",
    statusUnavailable: "Impossible de vérifier la connexion. Fermez la fenêtre de connexion et réessayez.",
    retry: "Réessayer",
    manualAdvanced: "Saisir le cookie manuellement (avancé)",
  },
  de: {
    riskTitle: "Risiko vor der Verbindung mit {provider} verstehen",
    riskBody: "SongDocents Liedtext-Verbindung zu {provider} ist keine offizielle API-Integration dieses Dienstes. Abhängig von dessen Richtlinien kann die Funktion ausfallen oder dein Konto eingeschränkt oder gesperrt werden. Nach der Anmeldung im Fenster der App ruft SongDocent automatisch dein Authentifizierungs-Cookie ab und speichert es ausschließlich im sicheren Speicher dieses Geräts, um Liedtexte abzurufen.",
    understandAndConnect: "Risiko verstanden – verbinden",
    cancel: "Abbrechen",
    connect: "{provider} verbinden",
    reconnect: "Neu verbinden",
    disconnect: "Trennen",
    unofficial: "Inoffizielle Verbindung",
    waiting: "Schließe die Anmeldung im {provider}-Fenster ab.",
    validating: "Sitzung wird sicher geprüft…",
    connected: "Verbunden",
    expired: "Die Sitzung ist abgelaufen. Verbinde dich erneut, damit Liedtexte weiter funktionieren.",
    timedOut: "Zeitüberschreitung bei der Verbindung.",
    blocked: "Die Anmeldeseite wurde zur Sicherheit blockiert.",
    invalid: "Die erfasste Sitzung ist ungültig.",
    unavailable: "Der Dienst konnte die Sitzung nicht prüfen.",
    storeDenied: "Die Sitzung konnte nicht sicher gespeichert werden.",
    startFailed: "Das Anmeldefenster konnte nicht geöffnet werden. Versuche es erneut.",
    statusUnavailable: "Der Verbindungsstatus konnte nicht geprüft werden. Schließe das Anmeldefenster und versuche es erneut.",
    retry: "Erneut versuchen",
    manualAdvanced: "Cookie manuell eingeben (erweitert)",
  },
  "pt-BR": {
    riskTitle: "Entenda o risco antes de conectar {provider}",
    riskBody: "A conexão de letras do SongDocent com o {provider} não é uma integração oficial da API desse serviço. Conforme as políticas do serviço, o recurso pode parar de funcionar ou sua conta pode ser limitada ou suspensa. Ao entrar pela janela do aplicativo, o SongDocent obtém automaticamente seu cookie de autenticação e o salva apenas no armazenamento seguro deste dispositivo para buscar as letras.",
    understandAndConnect: "Entendo o risco e quero conectar",
    cancel: "Cancelar",
    connect: "Conectar {provider}",
    reconnect: "Reconectar",
    disconnect: "Desconectar",
    unofficial: "Conexão não oficial",
    waiting: "Conclua o login na janela do {provider}.",
    validating: "Verificando a sessão com segurança…",
    connected: "Conectado",
    expired: "A sessão expirou. Reconecte para continuar usando as letras.",
    timedOut: "O tempo da conexão se esgotou.",
    blocked: "A página de login foi bloqueada por segurança.",
    invalid: "A sessão capturada é inválida.",
    unavailable: "O serviço não conseguiu verificar a sessão.",
    storeDenied: "Não foi possível salvar a sessão no armazenamento seguro.",
    startFailed: "Não foi possível abrir a janela de login. Tente conectar novamente.",
    statusUnavailable: "Não foi possível verificar a conexão. Feche a janela de login e tente novamente.",
    retry: "Tentar novamente",
    manualAdvanced: "Inserir cookie manualmente (avançado)",
  },
  "zh-CN": {
    riskTitle: "连接 {provider} 前请了解风险",
    riskBody: "SongDocent 的 {provider} 歌词连接并非该服务的官方 API 集成。根据服务政策，此功能可能停止工作，你的账户也可能受到限制或被停用。在应用内的登录窗口登录后，SongDocent 会自动获取你的身份验证 Cookie，仅保存在本设备的安全存储中，用于获取歌词。",
    understandAndConnect: "我了解风险并连接",
    cancel: "取消",
    connect: "连接 {provider}",
    reconnect: "重新连接",
    disconnect: "断开连接",
    unofficial: "非官方连接",
    waiting: "请在 {provider} 窗口中完成登录。",
    validating: "正在安全验证会话…",
    connected: "已连接",
    expired: "会话已过期。请重新连接以继续使用歌词。",
    timedOut: "连接已超时。",
    blocked: "为了安全，登录页面已被阻止。",
    invalid: "获取的会话无效。",
    unavailable: "服务无法验证此会话。",
    storeDenied: "无法将会话保存到安全存储。",
    startFailed: "无法打开登录窗口，请重新连接。",
    statusUnavailable: "无法检查连接状态。请关闭登录窗口后重试。",
    retry: "重试",
    manualAdvanced: "手动输入 Cookie（高级）",
  },
};

export function providerConnectionCopyFor(language: LangCode): ProviderConnectionCopy {
  return content[language] ?? content.en;
}

export function providerDisplayName(provider: SessionProvider): string {
  return provider === "spotify" ? "Spotify" : "Apple Music";
}

export function formatProviderCopy(template: string, provider: SessionProvider): string {
  return template.replaceAll("{provider}", providerDisplayName(provider));
}

export function connectionStatusMessage(
  status: ProviderConnectionStatus | null,
  copy: ProviderConnectionCopy,
): string | null {
  if (!status || status.phase === "idle" || status.phase === "cancelled") return null;
  if (status.phase === "opening" || status.phase === "waiting_for_login") {
    return formatProviderCopy(copy.waiting, status.provider);
  }
  if (status.phase === "validating") return copy.validating;
  if (status.phase === "connected") return copy.connected;
  if (status.phase === "timed_out") return copy.timedOut;
  if (status.code === "credential_invalid") return copy.invalid;
  if (status.code === "credential_store_denied") return copy.storeDenied;
  if (status.code === "navigation_blocked") return copy.blocked;
  if (status.code === "connection_start_failed" || status.code === "connection_runtime_error") return copy.startFailed;
  if (status.code === "status_unavailable") return copy.statusUnavailable;
  return copy.unavailable;
}
