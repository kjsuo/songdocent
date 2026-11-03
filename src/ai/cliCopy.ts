import { aiCopy } from "./aiCopy.ts";
import type { LangCode } from "../i18n";
export function cliErrorCode(error: unknown): string {
  const message =
    typeof error === "object" &&
    error !== null &&
    "technicalMessage" in error &&
    typeof error.technicalMessage === "string"
      ? error.technicalMessage
      : typeof error === "string"
        ? error
        : "";
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : message.split(":")[0];
}

export function cliErrorMessage(error: unknown, lang: LangCode): string {
  const copy = aiCopy[lang];
  switch (cliErrorCode(error)) {
    case "CLI_NOT_FOUND":
      return copy.cliNotFound;
    case "CLI_UNSUPPORTED":
      return copy.cliUnsupported;
    case "CLI_AUTH_REQUIRED":
      return copy.cliAuthRequired;
    case "CLI_MODEL_UNAVAILABLE":
      return copy.cliModelUnavailable;
    case "CLI_RATE_LIMITED":
      return copy.cliRateLimited;
    case "CLI_SEARCH_UNAVAILABLE":
      return copy.cliSearchUnavailable;
    case "CLI_TIMEOUT":
      return copy.cliTimeout;
    case "CLI_RESPONSE_INVALID":
      return copy.cliResponseInvalid;
    default:
      return copy.cliRequestFailed;
  }
}
