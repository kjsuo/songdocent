// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { KeychainPrimer } from "./KeychainPrimer";

afterEach(() => cleanup());

describe("KeychainPrimer copy variants", () => {
  test("shows Windows Credential Manager copy on Windows", () => {
    render(
      <KeychainPrimer
        uiLang="en"
        platform="windows"
        presentation="modal"
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Keep credentials in Windows Credential Manager",
    });
    expect(within(dialog).getByText(/Windows password or PIN/)).toBeTruthy();
    expect(within(dialog).getByText(/SongDocent \/ secrets_v1/)).toBeTruthy();
    expect(within(dialog).queryByText(/macOS|Keychain|Touch ID/)).toBeNull();
  });

  test("shows the concise Korean safety copy during onboarding", () => {
    render(
      <KeychainPrimer
        uiLang="ko"
        copyVariant="onboarding"
        onContinue={vi.fn()}
      />,
    );

    const primer = screen.getByRole("heading", {
      name: "자격 증명을 macOS Keychain에 안전하게 보관",
    }).closest("section");
    expect(primer).not.toBeNull();
    expect(within(primer!).getByText(
      "SongDocent은 어플리케이션 구동에 필요한 사용자의 정보를 안전하게 보관하기 위해 macos의 keychain을 사용합니다. SongDocent이 macOS에 Keychain 접근을 요청하기 전에 세부사항을 확인해보세요.",
    )).toBeTruthy();
    expect(within(primer!).getByText(
      "AI api key와 음악 스트리밍 서비스 쿠키는 민감한 정보입니다. 타인과의 공유는 삼가해주세요.",
    )).toBeTruthy();

    expect(within(primer!).queryByText(/macOS 암호나 Touch ID/)).toBeNull();
    expect(within(primer!).queryByText(/SongDocent \/ secrets_v1/)).toBeNull();
    expect(within(primer!).queryByText(/SongDocent이 운영하는 서버/)).toBeNull();
    expect(within(primer!).queryByText(/SP_DC와 media-user-token/)).toBeNull();
  });

  test("keeps the detailed copy in the Settings modal", () => {
    render(
      <KeychainPrimer
        uiLang="ko"
        presentation="modal"
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "자격 증명을 macOS Keychain에 안전하게 보관",
    });
    expect(within(dialog).getByText(
      "SongDocent이 macOS에 Keychain 접근을 요청하기 전에 저장 위치와 전송 범위를 확인하세요.",
    )).toBeTruthy();
    expect(within(dialog).getByText(/macOS 암호나 Touch ID/)).toBeTruthy();
    expect(within(dialog).getByText(/SongDocent \/ secrets_v1/)).toBeTruthy();
    expect(within(dialog).getByText(/SongDocent이 운영하는 서버/)).toBeTruthy();
    expect(within(dialog).getByText(/SP_DC와 media-user-token/)).toBeTruthy();
    expect(within(dialog).queryByText(/AI api key와 음악 스트리밍 서비스 쿠키/)).toBeNull();
  });
});
