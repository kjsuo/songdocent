import { aiCopy } from "./aiCopy";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { LangCode } from "../i18n";
import {
  configForProvider,
  saveTranslationConfig,
  type AiProvider,
} from "../settings";
import { getSecretStatus, saveSecret } from "../setup/secretClient";

export function SetupServerConnection({
  provider,
  uiLang,
  primerAccepted,
  onReadyChange,
}: {
  provider: AiProvider;
  uiLang: LangCode;
  primerAccepted: boolean;
  onReadyChange: (ready: boolean) => void;
}) {
  const copy = aiCopy[uiLang];
  const [config, setConfig] = useState(() => configForProvider(provider));
  const [apiKey, setApiKey] = useState("");
  const [keySaved, setKeySaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<"" | "success" | "error">("");
  const generation = useRef(0);
  const ready = useRef(onReadyChange);
  ready.current = onReadyChange;
  const identity = JSON.stringify([config, apiKey]);
  useEffect(() => {
    generation.current += 1;
    ready.current(false);
    setMessage("");
    setBusy(false);
    return () => {
      generation.current += 1;
    };
  }, [identity]);
  useEffect(() => {
    let active = true;
    if (provider === "openai_compatible" && primerAccepted)
      void getSecretStatus()
        .then((status) => {
          if (active) setKeySaved(status.openaiCompatibleApiKey);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [provider, primerAccepted]);
  const test = async () => {
    const current = ++generation.current;
    setBusy(true);
    setMessage("");
    ready.current(false);
    try {
      if (provider === "openai_compatible" && apiKey.trim()) {
        if (!primerAccepted) throw new Error("Secure storage consent required");
        await saveSecret("openai_compatible_api_key", apiKey.trim());
        if (current !== generation.current) return;
        setKeySaved(true);
      }
      const status = await invoke<{ ok: boolean }>(
        provider === "openai_compatible"
          ? "test_openai_compatible_connection"
          : "test_local_ai_connection",
        { provider, model: config.model, baseUrl: config.baseUrl },
      );
      if (current !== generation.current) return;
      if (!status?.ok) throw new Error("Connection failed");
      setMessage("success");
      ready.current(true);
    } catch {
      if (current === generation.current)
        setMessage("error");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <div className="ai-server-fields">
      <label className="ai-compact-field">
        <span>{copy.baseUrl}</span>
        <input
          type="url"
          value={config.baseUrl ?? ""}
          onChange={(event) => {
            const next = { ...config, baseUrl: event.target.value };
            setConfig(next);
            saveTranslationConfig(next);
          }}
          spellCheck={false}
          autoComplete="off"
          placeholder={
            provider === "openai_compatible"
              ? "https://api.example.com/v1"
              : "http://localhost:11434"
          }
        />
      </label>
      <label className="ai-compact-field">
        <span>{copy.model}</span>
        <input
          value={config.model}
          onChange={(event) => {
            const next = { ...config, model: event.target.value };
            setConfig(next);
            saveTranslationConfig(next);
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      {provider === "openai_compatible" ? (
        <label className="ai-compact-field">
          <span>
            {copy.apiKeyOptional}
          </span>
          <input
            type="password"
            value={apiKey}
            disabled={keySaved || busy}
            placeholder={keySaved ? "********" : copy.apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            autoComplete="off"
          />
        </label>
      ) : null}
      <button
        type="button"
        className="settings-test-button"
        disabled={busy}
        onClick={() => void test()}
      >
        {busy
          ? copy.testing
          : copy.testConnection}
      </button>
      <p className="settings-helper" role="status">
        {message === "success" ? copy.connectionVerified : message === "error" ? copy.serverConnectionFailed : ""}
      </p>
    </div>
  );
}
