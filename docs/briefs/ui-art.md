# Brief: ui-art (icons, margin doodles, heraldry, ornament)

**Your files:** `src/ui/icons.ts`, `src/ui/marginalia.ts`, anything under `src/ui/art/`, `src/dev/gallery-art.ts`.
**Read:** the signatures already in `src/ui/icons.ts` and `src/ui/marginalia.ts` (keep them), `src/data/ids.ts` (ICONS: all of them), `src/ui/css/base.ts` (tokens), `docs/STYLE.md`.

**Icons.** `iconSvg(id)` for every `IconId`: a single coherent set drawn in a hand-inked manuscript manner (slightly uneven stroke, rounded joins, `currentColor`, 24-unit viewBox, readable at 16px and handsome at 40px inside a wax seal). Not a generic icon font look: the hammer is a medieval mallet, the coin has a tiny crowned head, the house leans. Draw each with care; include a `title` for accessibility when asked. Also export `sealSvg(id, color)`: the icon embossed on an irregular wax seal (used for map pins and round buttons).

**Marginalia.** The medieval margin was where the scribes had their fun, and it is period-correct comedy:
- `doodle(kind, seed, size)`: ink-and-wash creatures for all eleven named kinds (a snail knight with a lance, rabbits jousting, a goose in a bishop's mitre, a cat playing a lute, a fox as a scribe, a griffin, a goblin unrolling a very long scroll, a small dragon asleep on coins, a mouse carrying a coin twice its size, an owl with a ledger, a hound blowing a horn), plus `vine`; `any` picks by seed. Seeds vary pose, colour accents and small details. Charming, a little absurd, loosely drawn.
- `dropCap(letter, size)`: an illuminated initial for every letter A to Z: a blackletter capital (the UnifrakturMaguntia font is loaded; you may also draw strokes) on a gilded square ground with lapis and rubric vine work, and for a few letters a tiny creature living in it.
- `flourish(width, seed)`: ornamental dividers (knots, vines, a line with a diamond).
- `crest(seed, size)`: a heater shield from a seed: field divisions and tinctures following the rule of tinctures, one charge (a key, a tower, a wheatsheaf, a coin, a griffin, a hovel, a snail...), sometimes a motto ribbon.
- `MARGINALIA_CSS`: class `ll-illum` giving a panel painted corner ornaments and a thin double rule border; `ll-vine-l` / `ll-vine-r` for a vine down a margin (as CSS backgrounds from data-URI SVG).
Keep each SVG small (a few KB); generate with code and parameters, never giant pasted paths.

**Dev gallery.** `src/dev/gallery-art.ts`: a parchment page showing every icon at 16, 24 and 40px with its id, every seal, each doodle kind at three seeds, the whole alphabet of drop caps, flourishes, a dozen crests, and a sample panel with `ll-illum`. Screenshot, look closely (zoom into regions with a second shot at larger size), and iterate until it looks like one scribe drew all of it on a good day.
