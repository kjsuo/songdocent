// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { LangCode } from "./i18n";
import { ProviderConnectionRiskModal } from "./ProviderConnectionRiskModal";
import {
  PROVIDER_CONNECTION_LANGUAGES,
  providerConnectionCopyFor,
} from "./providerConnectionContent";

afterEach(() => cleanup());

function Harness({ onConfirm = () => undefined }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={openerRef} type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <ProviderConnectionRiskModal
        open={open}
        provider="spotify"
        uiLang="ko"
        returnFocusTo={openerRef.current}
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}

describe("ProviderConnectionRiskModal", () => {
  test("shows the explicit Korean risk disclosure without a checkbox", async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByText(/Spotify/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/공식 API 연동이 아닙니다/)).toBeTruthy();
    expect(within(dialog).getByText(/계정이 제한 또는 정지/)).toBeTruthy();
    expect(within(dialog).getByText(/보안 저장소에만 저장/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "위험을 이해하고 연결" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "취소" })).toBeTruthy();
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
    expect(dialog.querySelector("input")).toBeNull();

    await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole("heading")));
    fireEvent.click(within(dialog).getByRole("button", { name: "위험을 이해하고 연결" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("Escape and backdrop cancel, then restore focus", async () => {
    const { rerender } = render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const heading = await screen.findByRole("heading");
    await waitFor(() => expect(document.activeElement).toBe(heading));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open" }));

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const backdrop = await screen.findByTestId("provider-risk-backdrop");
    fireEvent.mouseDown(backdrop);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    rerender(<Harness />);
  });
});

test("all provider connection copy is complete in all eight languages", () => {
  const requiredKeys = [
    "riskTitle",
    "riskBody",
    "understandAndConnect",
    "cancel",
    "connect",
    "reconnect",
    "disconnect",
    "unofficial",
    "waiting",
    "validating",
    "connected",
    "expired",
    "timedOut",
    "blocked",
    "invalid",
    "unavailable",
    "storeDenied",
    "retry",
    "manualAdvanced",
  ] as const;

  expect(PROVIDER_CONNECTION_LANGUAGES).toHaveLength(8);
  for (const language of PROVIDER_CONNECTION_LANGUAGES as readonly LangCode[]) {
    const copy = providerConnectionCopyFor(language);
    for (const key of requiredKeys) expect(copy[key].trim(), `${language}.${key}`).not.toBe("");
  }
});
