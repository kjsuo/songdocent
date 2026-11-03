import { useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { LangCode } from "./i18n";
import { filterTranslationLanguages, translationLanguageOptions } from "./translationLanguages";

const SEARCH_COPY: Record<LangCode, { search: string; empty: string }> = {
  en: { search: "Search languages", empty: "No matching languages" },
  ko: { search: "언어 검색", empty: "일치하는 언어가 없습니다" },
  ja: { search: "言語を検索", empty: "一致する言語がありません" },
  es: { search: "Buscar idiomas", empty: "No hay idiomas coincidentes" },
  fr: { search: "Rechercher une langue", empty: "Aucune langue correspondante" },
  de: { search: "Sprachen suchen", empty: "Keine passenden Sprachen" },
  "pt-BR": { search: "Pesquisar idiomas", empty: "Nenhum idioma encontrado" },
  "zh-CN": { search: "搜索语言", empty: "没有匹配的语言" },
};

export function TranslationLanguageSelect({ id, value, onChange, uiLang, label, className = "" }: {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  uiLang: LangCode;
  label: string;
  className?: string;
}) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const resultsId = `${selectId}-results`;
  const options = useMemo(() => translationLanguageOptions(uiLang), [uiLang]);
  const matches = filterTranslationLanguages(options, query);
  const searching = query.trim().length > 0;
  const chooseLanguage = (code: string) => {
    onChange(code);
    setQuery("");
    searchRef.current?.focus();
  };
  const copy = SEARCH_COPY[uiLang];
  return (
    <span className={`translation-language-picker ${className}`}>
      <input
        ref={searchRef}
        type="search"
        aria-label={copy.search}
        aria-controls={searching ? resultsId : undefined}
        placeholder={copy.search}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || !searching) return;
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setQuery("");
          } else if (matches.length && event.key === "Enter") {
            event.preventDefault();
            chooseLanguage(matches[0].code);
          } else if (matches.length && event.key === "ArrowDown") {
            event.preventDefault();
            resultRefs.current[0]?.focus();
          }
        }}
      />
      {searching ? (
        <span id={resultsId} className="translation-language-results" role="group" aria-label={label}>
          {matches.length ? matches.map(({ code, label: optionLabel }, index) => (
            <button
              key={code}
              ref={(element) => { resultRefs.current[index] = element; }}
              type="button"
              className="translation-language-result"
              aria-pressed={code === value}
              onClick={() => chooseLanguage(code)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const next = index + (event.key === "ArrowDown" ? 1 : -1);
                  if (next < 0) searchRef.current?.focus();
                  else resultRefs.current[Math.min(next, matches.length - 1)]?.focus();
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setQuery("");
                  searchRef.current?.focus();
                }
              }}
            >
              <span>{optionLabel}</span>
              {code === value ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          )) : <span className="translation-language-empty" role="status">{copy.empty}</span>}
        </span>
      ) : null}
      <span className="settings-select-wrap">
        <select id={selectId} aria-label={label} value={value} onChange={(event) => { onChange(event.target.value); setQuery(""); }}>
          {options.map(({ code, label: optionLabel }) => <option key={code} value={code}>{optionLabel}</option>)}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
    </span>
  );
}
