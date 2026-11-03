import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  OFFICIAL_SETUP_DESTINATIONS,
  openSetupGuideDestination,
  setupGuideDestinationIds,
} from "./guideLinks.ts";
import { SETUP_GUIDES } from "./setupContent.ts";

const APPROVED_URLS = [
  "https://developers.openai.com/codex/cli/",
  "https://developers.openai.com/codex/auth/",
  "https://code.claude.com/docs/en/setup",
  "https://code.claude.com/docs/en/authentication",
  "https://geminicli.com/docs/get-started/installation/",
  "https://geminicli.com/docs/get-started/authentication/",
  "https://antigravity.google/docs/cli/install/",
  "https://antigravity.google/docs/install/",
  "https://opencode.ai/docs/",
  "https://opencode.ai/docs/providers/",
  "https://open.spotify.com/",
  "https://music.apple.com/",
  "https://ai.google.dev/gemini-api/docs/api-key",
  "https://aistudio.google.com/apikey",
  "https://platform.openai.com/api-keys",
  "https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key",
  "https://platform.claude.com/settings/keys",
  "https://platform.claude.com/docs/en/manage-claude/authentication",
].sort();

const capability = JSON.parse(
  readFileSync(
    new URL("../../src-tauri/capabilities/default.json", import.meta.url),
    "utf8",
  ),
) as { permissions: Array<string | { identifier: string; allow?: Array<{ url: string }> }> };

test("setup guide metadata exposes destination IDs instead of caller-controlled URLs", () => {
  for (const guide of Object.values(SETUP_GUIDES)) {
    assert.ok("destinationIds" in guide);
    assert.equal("urls" in guide, false);
  }
});

test("the typed allowlist contains exactly the approved official URLs", () => {
  assert.deepEqual(Object.values(OFFICIAL_SETUP_DESTINATIONS).sort(), APPROVED_URLS);
});

test("every destination exposed by a guide belongs to that guide's allowlist", () => {
  for (const [guideId, guide] of Object.entries(SETUP_GUIDES)) {
    assert.deepEqual(guide.destinationIds, setupGuideDestinationIds(guideId));
    for (const destinationId of guide.destinationIds) {
      assert.ok(destinationId in OFFICIAL_SETUP_DESTINATIONS);
    }
  }
});

test("unknown guide IDs, destination IDs, URLs, and cross-guide IDs never reach the opener", async () => {
  const opened: string[] = [];
  const opener = async (url: string) => {
    opened.push(url);
  };

  assert.equal(
    await openSetupGuideDestination("unknown-guide", "spotifyWeb", opener),
    "not-allowed",
  );
  assert.equal(
    await openSetupGuideDestination("spotifyChrome", "unknown-destination", opener),
    "not-allowed",
  );
  assert.equal(
    await openSetupGuideDestination(
      "spotifyChrome",
      "https://example.com/steal",
      opener,
    ),
    "not-allowed",
  );
  assert.equal(
    await openSetupGuideDestination("spotifyChrome", "openAiApiKeys", opener),
    "not-allowed",
  );
  assert.deepEqual(opened, []);
});

test("an allowed guide destination opens only its exact official URL", async () => {
  const opened: string[] = [];

  assert.equal(
    await openSetupGuideDestination("geminiApiKey", "geminiApiKeyConsole", async (url) => {
      opened.push(url);
    }),
    "opened",
  );
  assert.deepEqual(opened, ["https://aistudio.google.com/apikey"]);
});

test("opener failures are contained without exposing the rejection", async () => {
  assert.equal(
    await openSetupGuideDestination("openAiApiKey", "openAiApiKeyHelp", async () => {
      throw new Error("private system error");
    }),
    "open-failed",
  );
});

test("the desktop capability grants URL opening only for approved destinations and music links", () => {
  const openerPermissions = capability.permissions.filter(
    (permission) =>
      typeof permission === "string"
        ? permission.startsWith("opener:")
        : permission.identifier.startsWith("opener:"),
  );

  assert.equal(openerPermissions.length, 1);
  const [permission] = openerPermissions;
  assert.equal(typeof permission, "object");
  if (typeof permission !== "object") return;

  assert.equal(permission.identifier, "opener:allow-open-url");
  assert.deepEqual(
    permission.allow?.map(({ url }) => url).sort(),
    [...APPROVED_URLS, "music://", "spotify:"].sort(),
  );
});
