import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Expected ${selector} rule to exist`);
  return match[1];
}

const shell = rule(".setup-wizard-shell");
assert.doesNotMatch(shell, /(^|\n)\s*border\s*:/, "wizard shell must not draw an outer border");
assert.doesNotMatch(shell, /(^|\n)\s*border-radius\s*:/, "wizard shell must not look boxed in");
assert.doesNotMatch(shell, /(^|\n)\s*box-shadow\s*:/, "wizard shell must not draw a framed shadow");

assert.doesNotMatch(
  rule(".setup-wizard-header"),
  /(^|\n)\s*border-bottom\s*:/,
  "wizard header must not draw a horizontal divider",
);
assert.doesNotMatch(
  rule(".setup-wizard-actions"),
  /(^|\n)\s*border-top\s*:/,
  "wizard actions must not draw a horizontal divider",
);

assert.match(
  styles,
  /:root\[data-platform="windows"\]\s+\.top-header-bar\s*\{[^}]*padding-left:\s*18px/s,
  "Windows header must not reserve space for macOS traffic lights",
);

console.log("SetupWizard style tests passed");
