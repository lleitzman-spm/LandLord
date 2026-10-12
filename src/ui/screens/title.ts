/** OWNER: a ui-screens agent. Placeholder for the "title" screen. */
import type { Screen, UICtx } from '../api';
import { h } from '../kit';
export function create(_ctx: UICtx): Screen {
  const el = h('div', { class: 'll-veil', hidden: true });
  return { el, open() { el.hidden = false; }, close() { el.hidden = true; } };
}
