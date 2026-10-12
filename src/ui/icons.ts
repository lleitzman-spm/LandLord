/** OWNER: ui-art agent. Manuscript-style SVG icons. Placeholder: a dot. */
import type { IconId } from '../data/ids';
/** Inline SVG markup for an icon, sized by font-size (class ll-icon), drawn in currentColor. */
export function iconSvg(_id: IconId, _opts: { size?: number; title?: string } = {}): string {
  return '<svg class="ll-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>';
}
