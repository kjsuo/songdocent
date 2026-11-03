import { expect, test } from "vitest";
import { formatAnnotationLineBreaks } from "./textBreaks";

test.each([
  ["ja", "これは日本語の文章です。音楽を聴きます。🎵"],
  ["zh-CN", "今天我们一起听音乐。🎵"],
])("%s phrase breaks preserve the original text and emoji", (language, text) => {
  const formatted = formatAnnotationLineBreaks(text, language);
  expect(formatted).toContain("\u200B");
  expect(formatted.replaceAll("\u200B", "")).toBe(text);
});

test("phrase formatting preserves words separated by spaces", () => {
  const text = "日本語と English words を読みます。";
  const formatted = formatAnnotationLineBreaks(text, "ja");
  expect(formatted.replaceAll("\u200B", "").replaceAll("\u00A0", " ")).toBe(text);
});
