import { openUrl } from "@tauri-apps/plugin-opener";

export const OFFICIAL_SETUP_DESTINATIONS = {
  codexCliInstall: "https://developers.openai.com/codex/cli/",
  codexCliLogin: "https://developers.openai.com/codex/auth/",
  claudeCliInstall: "https://code.claude.com/docs/en/setup",
  claudeCliLogin: "https://code.claude.com/docs/en/authentication",
  geminiCliInstall: "https://geminicli.com/docs/get-started/installation/",
  geminiCliLogin: "https://geminicli.com/docs/get-started/authentication/",
  antigravityCliInstall: "https://antigravity.google/docs/cli/install/",
  antigravityCliLogin: "https://antigravity.google/docs/install/",
  opencodeCliInstall: "https://opencode.ai/docs/",
  opencodeCliLogin: "https://opencode.ai/docs/providers/",
  spotifyWeb: "https://open.spotify.com/",
  appleMusicWeb: "https://music.apple.com/",
  geminiApiKeyDocs: "https://ai.google.dev/gemini-api/docs/api-key",
  geminiApiKeyConsole: "https://aistudio.google.com/apikey",
  openAiApiKeys: "https://platform.openai.com/api-keys",
  openAiApiKeyHelp:
    "https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key",
  claudeApiKeys: "https://platform.claude.com/settings/keys",
  claudeApiKeyDocs: "https://platform.claude.com/docs/en/manage-claude/authentication",
} as const;

export type OfficialSetupDestinationId = keyof typeof OFFICIAL_SETUP_DESTINATIONS;

export type SetupGuideOpenResult = "opened" | "not-allowed" | "open-failed";

export const SETUP_GUIDE_DESTINATIONS = {
  spotifyChrome: ["spotifyWeb"],
  spotifySafari: ["spotifyWeb"],
  appleMusicChrome: ["appleMusicWeb"],
  appleMusicSafari: ["appleMusicWeb"],
  geminiApiKey: ["geminiApiKeyDocs", "geminiApiKeyConsole"],
  openAiApiKey: ["openAiApiKeys", "openAiApiKeyHelp"],
  claudeApiKey: ["claudeApiKeys", "claudeApiKeyDocs"],
} as const satisfies Record<string, readonly OfficialSetupDestinationId[]>;

export type SetupLinkGuideId = keyof typeof SETUP_GUIDE_DESTINATIONS;

function hasOwn<T extends object>(value: T, key: PropertyKey): key is keyof T {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function setupGuideDestinationIds(
  guideId: string,
): readonly OfficialSetupDestinationId[] {
  return hasOwn(SETUP_GUIDE_DESTINATIONS, guideId)
    ? SETUP_GUIDE_DESTINATIONS[guideId]
    : [];
}

export async function openSetupGuideDestination(
  guideId: string,
  destinationId: string,
  opener: (url: string) => Promise<void> = openUrl,
): Promise<SetupGuideOpenResult> {
  const allowedForGuide = setupGuideDestinationIds(guideId);
  if (
    !hasOwn(OFFICIAL_SETUP_DESTINATIONS, destinationId) ||
    !allowedForGuide.some((allowedId) => allowedId === destinationId)
  ) {
    return "not-allowed";
  }

  try {
    await opener(OFFICIAL_SETUP_DESTINATIONS[destinationId]);
    return "opened";
  } catch {
    return "open-failed";
  }
}

export function officialSetupDestinationUrl(
  destinationId: OfficialSetupDestinationId,
): string {
  return OFFICIAL_SETUP_DESTINATIONS[destinationId];
}
