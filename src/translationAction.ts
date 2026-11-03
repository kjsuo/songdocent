export type TranslationActionMode = "translate" | "loading" | "delete";

export function getTranslationActionMode({
  hasCurrentTranslation,
  translationPending,
}: {
  hasCurrentTranslation: boolean;
  translationPending: boolean;
}): TranslationActionMode {
  if (translationPending) return "loading";
  return hasCurrentTranslation ? "delete" : "translate";
}
