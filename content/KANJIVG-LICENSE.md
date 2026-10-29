# KanjiVG subset

The five kanji (木, 水, 山, 日, 月) in `public/kanji/*.svg` are unmodified
KanjiVG source files by Ulrich Apel. Source:
https://github.com/KanjiVG/kanjivg/tree/70a0b7ae0c18ceb5cb358274b029cce0234a43bc/kanji

KanjiVG: https://kanjivg.tagaini.net/

License: Creative Commons Attribution-Share Alike 3.0 Unported
https://creativecommons.org/licenses/by-sa/3.0/

The full license is bundled at `public/kanji/COPYING.txt`.
`content/kanji-data.json` extracts the original paths and adapts them into
40-point stroke polylines for scoring. Those derived paths and polylines
retain the same CC BY-SA 3.0 license. Reproduce the subset with
`node scripts/vendor-shodo.mjs` (requires headless Chrome).

The Shodo page and exported PNG sheets include the source and license credit.
When the guide is exported, its KanjiVG-derived content retains this license.
