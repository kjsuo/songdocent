import { invoke, isTauri } from "@tauri-apps/api/core";
import type { SecretStatus } from "../settings";

export type SecretKind =
  | "spotify_sp_dc"
  | "apple_music_media_user_token"
  | "gemini_api_key"
  | "openai_api_key"
  | "claude_api_key"
  | "openai_compatible_api_key";

export type ValidationStatus = "valid" | "invalid" | "unavailable";

export type CredentialValidationResult = {
  status: ValidationStatus;
  code: string;
};

export function isDesktopRuntime(): boolean {
  return isTauri();
}

export function getSecretStatus(): Promise<SecretStatus> {
  return invoke<SecretStatus>("get_secret_status");
}

export function validateCredential(
  kind: SecretKind,
  value: string,
): Promise<CredentialValidationResult> {
  return invoke<CredentialValidationResult>("validate_setup_credential", {
    kind,
    value,
  });
}

export function saveSecret(kind: SecretKind, value: string): Promise<void> {
  return invoke<void>("set_secret", { kind, value });
}

export function clearSecret(kind: SecretKind): Promise<void> {
  return invoke<void>("clear_secret", { kind });
}
