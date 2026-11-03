import assert from "node:assert/strict";
import test from "node:test";
import { getTranslationActionMode } from "./translationAction.ts";

test("translation loading state keeps the translate action visible", () => {
  assert.equal(
    getTranslationActionMode({
      hasCurrentTranslation: true,
      translationPending: true,
    }),
    "loading",
  );
  assert.equal(
    getTranslationActionMode({
      hasCurrentTranslation: false,
      translationPending: true,
    }),
    "loading",
  );
});

test("translation action falls back to delete only when idle with a translation", () => {
  assert.equal(
    getTranslationActionMode({
      hasCurrentTranslation: true,
      translationPending: false,
    }),
    "delete",
  );
  assert.equal(
    getTranslationActionMode({
      hasCurrentTranslation: false,
      translationPending: false,
    }),
    "translate",
  );
});
