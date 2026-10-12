/** OWNER: a ui-shell agent. Placeholder for the "heralds" part. */
import type { UICtx } from '../api';
import type { Part } from './part';
import { h } from '../kit';
export function mount(_ctx: UICtx): Part { return { el: h('div', { class: 'll-part-heralds' }) }; }
