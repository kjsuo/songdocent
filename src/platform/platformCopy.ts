import type { LangCode } from "../i18n";

export type DesktopPlatform = "macos" | "windows";
export type SetupBrowser = "chrome" | "safari";

export type PlatformCopy = {
  secureStore: string;
  primerTitle: string;
  primerBody: string;
  systemAuth: string;
  localStorage: string;
  systemPrompt: string;
  cancelled: string;
  retry: string;
  devtoolsShortcut: string;
};

export const SUPPORTED_PLATFORM_COPY_LANGUAGES = [
  "en",
  "ko",
  "ja",
  "es",
  "fr",
  "de",
  "pt-BR",
  "zh-CN",
] as const satisfies readonly LangCode[];

const PLATFORM_COPY: Record<
  DesktopPlatform,
  Record<LangCode, PlatformCopy>
> = {
  macos: {
    en: {
      secureStore: "macOS Keychain",
      primerTitle: "Keep credentials in macOS Keychain",
      primerBody:
        "SongDocent uses macOS Keychain to securely store the information required to run the application.\nReview the details before SongDocent requests Keychain access from macOS.",
      systemAuth:
        "Your macOS password or Touch ID is handled only by Apple's system UI. SongDocent cannot see or store it.",
      localStorage:
        "Credentials are stored locally in the macOS Keychain item SongDocent / secrets_v1.",
      systemPrompt:
        "A macOS authentication prompt may appear, depending on your system settings.",
      cancelled: "Keychain access was cancelled. Nothing was saved.",
      retry:
        "Try the save again and approve the macOS prompt if it appears.",
      devtoolsShortcut: "Press Command–Option–I to open DevTools.",
    },
    ko: {
      secureStore: "macOS Keychain",
      primerTitle: "자격 증명을 macOS Keychain에 안전하게 보관",
      primerBody:
        "SongDocent은 앱 실행에 필요한 정보를 macOS Keychain에 안전하게 보관합니다.\nSongDocent이 macOS에 Keychain 접근을 요청하기 전에 세부 내용을 확인하세요.",
      systemAuth:
        "macOS 암호나 Touch ID는 Apple 시스템 화면에서만 처리됩니다. SongDocent은 이를 보거나 저장할 수 없어요.",
      localStorage:
        "자격 증명은 macOS Keychain의 SongDocent / secrets_v1 항목에 로컬로 저장됩니다.",
      systemPrompt: "시스템 설정에 따라 macOS 인증창이 나타날 수 있습니다.",
      cancelled: "Keychain 접근이 취소되어 아무것도 저장하지 않았어요.",
      retry: "저장을 다시 시도하고 macOS 인증창이 나타나면 승인하세요.",
      devtoolsShortcut: "Command–Option–I를 눌러 DevTools를 여세요.",
    },
    ja: {
      secureStore: "macOS Keychain",
      primerTitle: "認証情報をmacOS Keychainに安全に保存",
      primerBody:
        "SongDocentはアプリの実行に必要な情報をmacOS Keychainに安全に保存します。\nSongDocentがmacOSにKeychainアクセスを要求する前に詳細を確認してください。",
      systemAuth:
        "macOSのパスワードまたはTouch IDはAppleのシステム画面だけで処理されます。SongDocentが見たり保存したりすることはできません。",
      localStorage:
        "認証情報はmacOS KeychainのSongDocent / secrets_v1項目にローカル保存されます。",
      systemPrompt:
        "システム設定によってはmacOSの認証画面が表示される場合があります。",
      cancelled: "Keychainへのアクセスがキャンセルされ、保存されませんでした。",
      retry: "もう一度保存し、macOSの認証画面が表示された場合は承認してください。",
      devtoolsShortcut: "Command–Option–IでDevToolsを開きます。",
    },
    es: {
      secureStore: "Llavero de macOS",
      primerTitle: "Guarda tus credenciales en el Llavero de macOS",
      primerBody:
        "SongDocent usa el Llavero de macOS para guardar de forma segura la información necesaria para ejecutar la aplicación.\nRevisa los detalles antes de que SongDocent solicite acceso al Llavero.",
      systemAuth:
        "Tu contraseña de macOS o Touch ID solo se procesa en la interfaz del sistema de Apple. SongDocent no puede verla ni guardarla.",
      localStorage:
        "Las credenciales se guardan localmente en el elemento SongDocent / secrets_v1 del Llavero de macOS.",
      systemPrompt:
        "Según la configuración del sistema, puede aparecer una solicitud de autenticación de macOS.",
      cancelled: "Se canceló el acceso al Llavero. No se guardó nada.",
      retry: "Vuelve a guardar y aprueba la solicitud de macOS si aparece.",
      devtoolsShortcut: "Pulsa Command–Option–I para abrir DevTools.",
    },
    fr: {
      secureStore: "Trousseau macOS",
      primerTitle: "Protégez vos identifiants dans le Trousseau macOS",
      primerBody:
        "SongDocent utilise le Trousseau macOS pour stocker en toute sécurité les informations nécessaires à l’application.\nConsultez les détails avant que SongDocent demande l’accès au Trousseau.",
      systemAuth:
        "Votre mot de passe macOS ou Touch ID est traité uniquement par l’interface système d’Apple. SongDocent ne peut ni le voir ni le stocker.",
      localStorage:
        "Les identifiants sont stockés localement dans l’élément SongDocent / secrets_v1 du Trousseau macOS.",
      systemPrompt:
        "Selon les réglages du système, une demande d’authentification macOS peut apparaître.",
      cancelled: "L’accès au Trousseau a été annulé. Rien n’a été enregistré.",
      retry: "Réessayez l’enregistrement et approuvez la demande macOS si elle apparaît.",
      devtoolsShortcut: "Appuyez sur Command–Option–I pour ouvrir DevTools.",
    },
    de: {
      secureStore: "macOS-Schlüsselbund",
      primerTitle: "Zugangsdaten im macOS-Schlüsselbund schützen",
      primerBody:
        "SongDocent speichert die für die App erforderlichen Informationen sicher im macOS-Schlüsselbund.\nPrüfe die Details, bevor SongDocent den Zugriff anfordert.",
      systemAuth:
        "Dein macOS-Passwort oder Touch ID wird nur von Apples Systemoberfläche verarbeitet. SongDocent kann diese Daten weder sehen noch speichern.",
      localStorage:
        "Zugangsdaten werden lokal im Eintrag SongDocent / secrets_v1 des macOS-Schlüsselbunds gespeichert.",
      systemPrompt:
        "Je nach Systemeinstellungen kann ein macOS-Authentifizierungsdialog erscheinen.",
      cancelled: "Der Schlüsselbund-Zugriff wurde abgebrochen. Nichts wurde gespeichert.",
      retry: "Versuche das Speichern erneut und bestätige den macOS-Dialog, falls er erscheint.",
      devtoolsShortcut: "Drücke Command–Option–I, um DevTools zu öffnen.",
    },
    "pt-BR": {
      secureStore: "Chaves do macOS",
      primerTitle: "Proteja as credenciais nas Chaves do macOS",
      primerBody:
        "O SongDocent usa as Chaves do macOS para armazenar com segurança as informações necessárias ao aplicativo.\nConfira os detalhes antes que o SongDocent solicite acesso.",
      systemAuth:
        "Sua senha do macOS ou Touch ID é processada somente pela interface do sistema da Apple. O SongDocent não consegue ver nem armazenar esses dados.",
      localStorage:
        "As credenciais são armazenadas localmente no item SongDocent / secrets_v1 das Chaves do macOS.",
      systemPrompt:
        "Dependendo dos ajustes do sistema, uma solicitação de autenticação do macOS pode aparecer.",
      cancelled: "O acesso às Chaves foi cancelado. Nada foi salvo.",
      retry: "Tente salvar novamente e aprove a solicitação do macOS se ela aparecer.",
      devtoolsShortcut: "Pressione Command–Option–I para abrir o DevTools.",
    },
    "zh-CN": {
      secureStore: "macOS 钥匙串",
      primerTitle: "将凭据安全保存在 macOS 钥匙串中",
      primerBody:
        "SongDocent 使用 macOS 钥匙串安全存储应用运行所需的信息。\n在 SongDocent 请求访问钥匙串之前，请先查看详细内容。",
      systemAuth:
        "你的 macOS 密码或 Touch ID 只由 Apple 系统界面处理。SongDocent 无法查看或存储这些信息。",
      localStorage:
        "凭据仅在本机存储于 macOS 钥匙串的 SongDocent / secrets_v1 项目中。",
      systemPrompt: "根据系统设置，可能会出现 macOS 身份验证提示。",
      cancelled: "钥匙串访问已取消。未保存任何内容。",
      retry: "请重新尝试保存；如果出现 macOS 提示，请批准访问。",
      devtoolsShortcut: "按 Command–Option–I 打开 DevTools。",
    },
  },
  windows: {
    en: {
      secureStore: "Windows Credential Manager",
      primerTitle: "Keep credentials in Windows Credential Manager",
      primerBody:
        "SongDocent uses Windows Credential Manager to securely store the information required to run the application.\nReview the details before SongDocent saves credentials on Windows.",
      systemAuth:
        "Windows sign-in and system authentication are handled only by Windows. SongDocent cannot see or store your Windows password or PIN.",
      localStorage:
        "Credentials are stored locally in the Windows Credential Manager item SongDocent / secrets_v1.",
      systemPrompt:
        "A Windows authentication prompt may appear, depending on your system settings.",
      cancelled: "Credential Manager access was cancelled. Nothing was saved.",
      retry:
        "Try the save again and approve the Windows prompt if it appears.",
      devtoolsShortcut: "Press Ctrl–Shift–I to open DevTools.",
    },
    ko: {
      secureStore: "Windows 자격 증명 관리자",
      primerTitle: "자격 증명을 Windows 자격 증명 관리자에 안전하게 보관",
      primerBody:
        "SongDocent은 앱 실행에 필요한 정보를 Windows 자격 증명 관리자에 안전하게 보관합니다.\nSongDocent이 Windows에 자격 증명을 저장하기 전에 세부 내용을 확인하세요.",
      systemAuth:
        "Windows 로그인과 시스템 인증은 Windows에서만 처리됩니다. SongDocent은 Windows 암호나 PIN을 보거나 저장할 수 없어요.",
      localStorage:
        "자격 증명은 Windows 자격 증명 관리자의 SongDocent / secrets_v1 항목에 로컬로 저장됩니다.",
      systemPrompt: "시스템 설정에 따라 Windows 인증창이 나타날 수 있습니다.",
      cancelled:
        "Windows 자격 증명 관리자 접근이 취소되어 아무것도 저장하지 않았어요.",
      retry: "저장을 다시 시도하고 Windows 인증창이 나타나면 승인하세요.",
      devtoolsShortcut: "Ctrl–Shift–I를 눌러 DevTools를 여세요.",
    },
    ja: {
      secureStore: "Windows 資格情報マネージャー",
      primerTitle: "認証情報をWindows 資格情報マネージャーに安全に保存",
      primerBody:
        "SongDocentはアプリの実行に必要な情報をWindows 資格情報マネージャーに安全に保存します。\nWindowsに認証情報を保存する前に詳細を確認してください。",
      systemAuth:
        "Windowsのサインインとシステム認証はWindowsだけで処理されます。SongDocentがWindowsのパスワードやPINを見たり保存したりすることはできません。",
      localStorage:
        "認証情報はWindows 資格情報マネージャーのSongDocent / secrets_v1項目にローカル保存されます。",
      systemPrompt:
        "システム設定によってはWindowsの認証画面が表示される場合があります。",
      cancelled:
        "Windows 資格情報マネージャーへのアクセスがキャンセルされ、保存されませんでした。",
      retry: "もう一度保存し、Windowsの認証画面が表示された場合は承認してください。",
      devtoolsShortcut: "Ctrl–Shift–IでDevToolsを開きます。",
    },
    es: {
      secureStore: "Administrador de credenciales de Windows",
      primerTitle:
        "Guarda tus credenciales en el Administrador de credenciales de Windows",
      primerBody:
        "SongDocent usa el Administrador de credenciales de Windows para guardar de forma segura la información necesaria para la aplicación.\nRevisa los detalles antes de guardar las credenciales.",
      systemAuth:
        "El inicio de sesión y la autenticación del sistema son gestionados únicamente por Windows. SongDocent no puede ver ni guardar tu contraseña o PIN de Windows.",
      localStorage:
        "Las credenciales se guardan localmente en el elemento SongDocent / secrets_v1 del Administrador de credenciales de Windows.",
      systemPrompt:
        "Según la configuración del sistema, puede aparecer una solicitud de autenticación de Windows.",
      cancelled:
        "Se canceló el acceso al Administrador de credenciales. No se guardó nada.",
      retry: "Vuelve a guardar y aprueba la solicitud de Windows si aparece.",
      devtoolsShortcut: "Pulsa Ctrl–Shift–I para abrir DevTools.",
    },
    fr: {
      secureStore: "Gestionnaire d’identifiants Windows",
      primerTitle:
        "Protégez vos identifiants dans le Gestionnaire d’identifiants Windows",
      primerBody:
        "SongDocent utilise le Gestionnaire d’identifiants Windows pour stocker en toute sécurité les informations nécessaires à l’application.\nConsultez les détails avant l’enregistrement.",
      systemAuth:
        "La connexion et l’authentification système sont traitées uniquement par Windows. SongDocent ne peut ni voir ni stocker votre mot de passe ou votre code PIN Windows.",
      localStorage:
        "Les identifiants sont stockés localement dans l’élément SongDocent / secrets_v1 du Gestionnaire d’identifiants Windows.",
      systemPrompt:
        "Selon les réglages du système, une demande d’authentification Windows peut apparaître.",
      cancelled:
        "L’accès au Gestionnaire d’identifiants a été annulé. Rien n’a été enregistré.",
      retry: "Réessayez l’enregistrement et approuvez la demande Windows si elle apparaît.",
      devtoolsShortcut: "Appuyez sur Ctrl–Shift–I pour ouvrir DevTools.",
    },
    de: {
      secureStore: "Windows-Anmeldeinformationsverwaltung",
      primerTitle:
        "Zugangsdaten in der Windows-Anmeldeinformationsverwaltung schützen",
      primerBody:
        "SongDocent speichert die für die App erforderlichen Informationen sicher in der Windows-Anmeldeinformationsverwaltung.\nPrüfe die Details vor dem Speichern.",
      systemAuth:
        "Windows-Anmeldung und Systemauthentifizierung werden nur von Windows verarbeitet. SongDocent kann dein Windows-Passwort oder deine PIN weder sehen noch speichern.",
      localStorage:
        "Zugangsdaten werden lokal im Eintrag SongDocent / secrets_v1 der Windows-Anmeldeinformationsverwaltung gespeichert.",
      systemPrompt:
        "Je nach Systemeinstellungen kann ein Windows-Authentifizierungsdialog erscheinen.",
      cancelled:
        "Der Zugriff auf die Anmeldeinformationsverwaltung wurde abgebrochen. Nichts wurde gespeichert.",
      retry: "Versuche das Speichern erneut und bestätige den Windows-Dialog, falls er erscheint.",
      devtoolsShortcut: "Drücke Ctrl–Shift–I, um DevTools zu öffnen.",
    },
    "pt-BR": {
      secureStore: "Gerenciador de Credenciais do Windows",
      primerTitle:
        "Proteja as credenciais no Gerenciador de Credenciais do Windows",
      primerBody:
        "O SongDocent usa o Gerenciador de Credenciais do Windows para armazenar com segurança as informações necessárias ao aplicativo.\nConfira os detalhes antes de salvar.",
      systemAuth:
        "A entrada e a autenticação do sistema são processadas somente pelo Windows. O SongDocent não consegue ver nem armazenar sua senha ou PIN do Windows.",
      localStorage:
        "As credenciais são armazenadas localmente no item SongDocent / secrets_v1 do Gerenciador de Credenciais do Windows.",
      systemPrompt:
        "Dependendo dos ajustes do sistema, uma solicitação de autenticação do Windows pode aparecer.",
      cancelled:
        "O acesso ao Gerenciador de Credenciais foi cancelado. Nada foi salvo.",
      retry: "Tente salvar novamente e aprove a solicitação do Windows se ela aparecer.",
      devtoolsShortcut: "Pressione Ctrl–Shift–I para abrir o DevTools.",
    },
    "zh-CN": {
      secureStore: "Windows 凭据管理器",
      primerTitle: "将凭据安全保存在 Windows 凭据管理器中",
      primerBody:
        "SongDocent 使用 Windows 凭据管理器安全存储应用运行所需的信息。\n在保存凭据之前，请先查看详细内容。",
      systemAuth:
        "Windows 登录和系统身份验证仅由 Windows 处理。SongDocent 无法查看或存储你的 Windows 密码或 PIN。",
      localStorage:
        "凭据仅在本机存储于 Windows 凭据管理器的 SongDocent / secrets_v1 项目中。",
      systemPrompt: "根据系统设置，可能会出现 Windows 身份验证提示。",
      cancelled: "Windows 凭据管理器访问已取消。未保存任何内容。",
      retry: "请重新尝试保存；如果出现 Windows 提示，请批准访问。",
      devtoolsShortcut: "按 Ctrl–Shift–I 打开 DevTools。",
    },
  },
};

export function normalizeDesktopPlatform(value: string): DesktopPlatform {
  return value === "windows" ? "windows" : "macos";
}

export function browserOptionsForPlatform(
  platform: DesktopPlatform,
): readonly SetupBrowser[] {
  return platform === "windows" ? ["chrome"] : ["chrome", "safari"];
}

export function platformCopyFor(
  lang: LangCode,
  platform: DesktopPlatform,
): PlatformCopy {
  return PLATFORM_COPY[platform][lang];
}
