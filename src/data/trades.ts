/** OWNER: content-core agent. Replace the generated placeholders with real data. */
import type { TradeDef } from './schema';
import { TRADES, type TradeId } from './ids';
const title = (id: string) => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
export const TRADE_DEFS = Object.fromEntries(TRADES.map(id => [id, { id, name: title(id), income: 30, minRank: 'reeve', blurb: '' } satisfies TradeDef])) as Record<TradeId, TradeDef>;
