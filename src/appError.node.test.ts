import assert from "node:assert/strict";
import {
  clearCurrentError,
  getErrorPresentation,
  mergeCurrentError,
  normalizeAppError,
  replaceCurrentError,
  type AppError,
} from "./appError.ts";

const compromised: AppError = {
  code: "AI_API_KEY_COMPROMISED",
  domain: "translation",
  retryable: false,
  technicalMessage: "Your API key was reported as leaked.",
};

assert.deepEqual(normalizeAppError(compromised), compromised);

assert.deepEqual(
  normalizeAppError(JSON.stringify(compromised)),
  compromised,
);

const unknown = normalizeAppError(new Error("super secret backend detail"));
assert.equal(unknown.code, "UNKNOWN");
assert.equal(getErrorPresentation(unknown, "ko").message.includes("super secret"), false);

const sameErrorWithNewDetail: AppError = {
  ...compromised,
  technicalMessage: "same code, newer backend detail",
};
assert.equal(replaceCurrentError(compromised, sameErrorWithNewDetail), compromised);

const previousRetry = () => undefined;
assert.equal(
  mergeCurrentError(
    { error: compromised, retry: previousRetry },
    sameErrorWithNewDetail,
  ).retry,
  previousRetry,
);

const serviceError: AppError = {
  code: "AI_SERVICE_UNAVAILABLE",
  domain: "translation",
  retryable: true,
  technicalMessage: "503 UNAVAILABLE",
};
assert.equal(replaceCurrentError(compromised, serviceError), serviceError);
assert.equal(
  mergeCurrentError(
    { error: compromised, retry: previousRetry },
    serviceError,
  ).retry,
  undefined,
  "a different error must not inherit an obsolete retry",
);
assert.equal(clearCurrentError(serviceError, "lyrics"), serviceError);
assert.equal(clearCurrentError(serviceError, "translation"), null);

assert.equal(
  getErrorPresentation(compromised, "ko").action,
  "open-ai-settings",
);
assert.equal(getErrorPresentation(serviceError, "ko").action, "retry");
assert.equal(
  getErrorPresentation(
    {
      code: "AI_QUOTA_EXHAUSTED",
      domain: "translation",
      retryable: false,
      technicalMessage: "daily limit",
    },
    "ko",
  ).action,
  "none",
);

const japanese = getErrorPresentation(compromised, "ja");
assert.match(japanese.title, /APIキー/);

const spanish = getErrorPresentation(compromised, "es");
assert.match(spanish.title, /clave API/i);
assert.equal(spanish.title.includes("Replace"), false);

const windowsPlayerPermission = getErrorPresentation(
  {
    code: "PLAYER_PERMISSION_DENIED",
    domain: "player",
    retryable: false,
    technicalMessage: "access denied",
  },
  "en",
  "windows",
);
assert.match(windowsPlayerPermission.message, /Windows/);
assert.doesNotMatch(windowsPlayerPermission.message, /macOS|Automation/);

for (const code of [
  "SETTINGS_LOAD_FAILED",
  "SETTINGS_SAVE_FAILED",
  "SETTINGS_CLEAR_FAILED",
]) {
  const presentation = getErrorPresentation(
    {
      code,
      domain: "settings",
      retryable: false,
      technicalMessage: "credential store failed",
    },
    "ko",
    "windows",
  );
  assert.match(presentation.message, /Windows 자격 증명 관리자/);
  assert.doesNotMatch(presentation.message, /Keychain/);
}


for (const lang of ["en", "ko", "ja", "es", "fr", "de", "pt-BR", "zh-CN"] as const) {
  const generic = getErrorPresentation({ code: "UNKNOWN", domain: "unknown", retryable: false, technicalMessage: "" }, lang).message;
  for (const code of ["AI_REQUEST_FAILED", "AI_RESOURCE_NOT_FOUND", "APP_TASK_FAILED", "CACHE_READ_FAILED", "CACHE_WRITE_FAILED", "CACHE_CLEAR_FAILED", "CACHE_OPERATION_FAILED", "LOCAL_AI_CONNECTION_FAILED", "LOCAL_AI_RESPONSE_INVALID", "LYRICS_FETCH_FAILED", "LYRICS_REQUEST_INVALID", "LYRICS_REQUEST_TIMEOUT", "SETTINGS_INVALID_VALUE", "SETTINGS_OPERATION_FAILED"]) {
    const domain = code.startsWith("CACHE_") ? "storage" : "translation";
    const copy = getErrorPresentation({ code, domain, retryable: true, technicalMessage: "private diagnostic detail" }, lang);
    assert.ok(copy.message !== generic || copy.title !== getErrorPresentation({ code: "UNKNOWN", domain: "unknown", retryable: false, technicalMessage: "" }, lang).title, `${lang}: ${code} needs recovery guidance`);
    assert.ok(!copy.message.includes("private diagnostic"));
  }
}
for (const lang of ["es", "fr", "de", "pt-BR", "zh-CN"] as const) {
  const storage = getErrorPresentation({ code: "CACHE_WRITE_FAILED", domain: "storage", retryable: true, technicalMessage: "" }, lang);
  assert.doesNotMatch(storage.message, /Keychain|Chaves|Schlüsselbund|钥匙串/);
}

const recoveryDetails = {
  en: [/Google.*exposed/i, /Google AI Studio/, /restarting/i, /reappear/i, /http:\/\//],
  ko: [/Google|구글/, /Google AI Studio/, /다시 열면/, /다시/, /http:\/\//],
  ja: [/Google/, /Google AI Studio/, /再起動/, /再度/, /http:\/\//],
  es: [/Google.*filtrado/i, /Google AI Studio/, /reiniciar/i, /reaparecer/i, /http:\/\//],
  fr: [/Google.*exposée/i, /Google AI Studio/, /redémarrage/i, /réapparaître/i, /http:\/\//],
  de: [/Google.*offengelegt/i, /Google AI Studio/, /Neustart/i, /wieder erscheinen/i, /http:\/\//],
  "pt-BR": [/Google.*exposta/i, /Google AI Studio/, /reiniciar/i, /reaparecer/i, /http:\/\//],
  "zh-CN": [/Google.*泄露/, /Google AI Studio/, /重启/, /再次出现/, /http:\/\//],
} as const;
const specificCodes = [
  "AI_API_KEY_COMPROMISED", "AI_REGION_UNAVAILABLE", "CACHE_WRITE_FAILED",
  "CACHE_CLEAR_FAILED", "LOCAL_AI_URL_INVALID",
] as const;
for (const [lang, patterns] of Object.entries(recoveryDetails)) {
  specificCodes.forEach((code, index) => {
    const presentation = getErrorPresentation(
      { code, domain: "translation", retryable: false, technicalMessage: "" },
      lang as keyof typeof recoveryDetails,
    );
    assert.match(presentation.message, patterns[index], `${lang}: ${code}`);
  });
}

const cliTitles = Object.keys(recoveryDetails).map((lang) =>
  getErrorPresentation(
    { code: "CLI_NOT_FOUND", domain: "translation", retryable: false, technicalMessage: "" },
    lang as keyof typeof recoveryDetails,
  ).title,
);
assert.equal(new Set(cliTitles).size, cliTitles.length, "each locale needs a translated CLI title");

console.log("app error tests passed");
