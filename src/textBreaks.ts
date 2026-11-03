import { model as jaModel } from "../node_modules/budoux/module/data/models/ja.js";
import { model as zhHansModel } from "../node_modules/budoux/module/data/models/zh-hans.js";
import { Parser } from "../node_modules/budoux/module/parser.js";

const ZERO_WIDTH_SPACE = "\u200B";
const NON_BREAKING_SPACE = "\u00A0";

const jaParser = new Parser(jaModel);
const zhHansParser = new Parser(zhHansModel);

const parserForLang = (lang: string) => {
  if (lang === "ja") return jaParser;
  if (lang === "zh-CN") return zhHansParser;
  return null;
};

const toInlineText = (text: string) => text.replace(/\s+/g, " ").trim();

const protectChunkSpaces = (chunk: string) => chunk.replace(/ /g, NON_BREAKING_SPACE);

export const formatAnnotationLineBreaks = (text: string, lang: string) => {
  const inlineText = toInlineText(text);
  const parser = parserForLang(lang);

  if (!parser) return inlineText;

  return parser.parse(inlineText).map(protectChunkSpaces).join(ZERO_WIDTH_SPACE);
};

export const htmlLangForText = (lang: string) => {
  if (lang === "zh-CN") return "zh-Hans";
  return lang;
};

export const lineBreakClassForLang = (lang: string) => {
  if (lang === "ko") return "text-break-ko";
  if (lang === "ja" || lang === "zh-CN") return "text-break-phrase";
  return "text-break-default";
};
