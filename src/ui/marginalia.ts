/** OWNER: ui-art agent. Margin doodles, borders, drop caps, seals, heraldry. Placeholder: empty. */
export type DoodleKind = 'snail_knight' | 'rabbit_joust' | 'goose_bishop' | 'cat_lute' | 'fox_scribe' | 'griffin' | 'goblin_scroll' | 'dragon_small' | 'mouse_coin' | 'owl_ledger' | 'hound_horn' | 'vine' | 'any';
/** A margin doodle as inline SVG (ink line, a touch of colour). `seed` varies pose/colour. */
export function doodle(_kind: DoodleKind = 'any', _seed = 0, _size = 64): string { return ''; }
/** An illuminated initial: blackletter capital on a gilded, vined ground. */
export function dropCap(letter: string, _size = 56): string { return `<span class="ll-black" style="font-size:2.6em;color:var(--rubric)">${letter}</span>`; }
/** A horizontal ornamental divider (vines, knots). */
export function flourish(_width = 240, _seed = 0): string { return '<hr class="ll-rule">'; }
/** Heraldic shield for the realm from a crest seed (tinctures + one charge). */
export function crest(_seed: number, _size = 48): string { return ''; }
/** CSS for corner ornaments / vine borders, to be applied with class "ll-illum". */
export const MARGINALIA_CSS = '';
