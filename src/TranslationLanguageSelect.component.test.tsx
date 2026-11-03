// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test } from "vitest";
import { TranslationLanguageSelect } from "./TranslationLanguageSelect";

afterEach(cleanup);
function Harness() {
  const [value, setValue] = useState("ko");
  return <TranslationLanguageSelect value={value} onChange={setValue} uiLang="ko" label="번역 언어" />;
}

test("search preserves the current target, choosing a new language clears search", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const search = screen.getByRole("searchbox", { name: "언어 검색" });
  const select = screen.getByRole("combobox", { name: "번역 언어" }) as HTMLSelectElement;
  await user.type(search, "태국어");
  expect(select.value).toBe("ko");
  const results = screen.getByRole("group", { name: "번역 언어" });
  expect(results.textContent).toContain("태국어");
  expect(results.textContent).not.toContain("한국어");
  await user.click(screen.getByRole("button", { name: /ไทย/ }));
  expect(select.value).toBe("th");
  expect((search as HTMLInputElement).value).toBe("");
  expect(screen.getAllByRole("option")).toHaveLength(100);
  await user.type(search, "zzzzzzzz");
  expect(select.value).toBe("th");
  expect(screen.getByRole("status").textContent).toContain("일치하는 언어가 없습니다");
  await user.clear(search);
  await user.type(search, "العربية");
  await user.click(screen.getByRole("button", { name: /العربية/ }));
  expect(select.value).toBe("ar");
});

test("supports keyboard selection and Escape without changing the target while searching", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const search = screen.getByRole("searchbox", { name: "언어 검색" });
  const select = screen.getByRole("combobox", { name: "번역 언어" }) as HTMLSelectElement;
  await user.type(search, "태국어");
  fireEvent.keyDown(search, { key: "Enter", isComposing: true });
  expect(select.value).toBe("ko");
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(screen.getByRole("button", { name: /ไทย/ }));
  await user.keyboard("{Enter}");
  expect(select.value).toBe("th");
  expect(document.activeElement).toBe(search);
  expect(screen.queryByRole("group")).toBeNull();
  await user.type(search, "Arabic");
  await user.keyboard("{Escape}");
  expect(select.value).toBe("th");
  expect(screen.queryByRole("group")).toBeNull();
  await user.type(search, "Arabic");
  await user.keyboard("{Enter}");
  expect(select.value).toBe("ar");
});
