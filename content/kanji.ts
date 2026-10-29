import data from "./kanji-data.json" with { type: "json" };

export const KANJI = data.kanji;
export const KANJIVG_REVISION = data.revision;
export const KANJIVG_CREDIT = "KanjiVG © Ulrich Apel · CC BY-SA 3.0 · kanjivg.tagaini.net";
export type Kanji = (typeof KANJI)[number];
