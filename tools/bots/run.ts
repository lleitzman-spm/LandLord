/**
 * Balance runner: npx tsx tools/bots/run.ts [seeds=12] [years=6] [mode=peace|iron] [careless]
 * Prints one compact row per seed and a summary.
 */
import { Sim } from '../../src/sim/index';
import type { Mode } from '../../src/sim/types';
import { playDay, newMemo } from './player';
import { rentRoll } from '../../src/sim/economy';
import { debtOf } from '../../src/sim/modes';

const args = process.argv.slice(2);
const seeds = Number(args[0] ?? 12);
const years = Number(args[1] ?? 6);
const mode = (args[2] ?? 'peace') as Mode;
const careless = args.includes('careless');
const trace = args.includes('trace');

const pad = (v: string | number, n: number): string => String(v).padStart(n);
console.log(`${mode} ${careless ? 'careless' : 'competent'}  ${seeds} seeds x ${years}y`);
console.log('seed  Kn  Bar  Duke  rank    hh  roll  gold  maxG  ren  fav  debt  evic  res  exp  end/stall');

const sum = { kn: [] as number[], ba: [] as number[], dead: 0, debtors: 0 };
for (let i = 1; i <= seeds; i++) {
  const sim = Sim.create({ seed: i * 7919, mode });
  const memo = newMemo(i);
  const at: Record<string, number> = {};
  let maxGold = 0, demotions = 0, minGold = 1e9, debtDays = 0;
  const days = years * 360;
  for (let d = 0; d < days && !sim.state.ended; d++) {
    playDay(sim, { careless }, memo);
    const evs = sim.advanceDays(1);
    for (const e of evs) {
      if (e.type === 'promotion' && at[e.rank] === undefined) at[e.rank] = Math.floor(sim.state.day / 30);
      if (e.type === 'demotion') demotions++;
    }
    const s = sim.state;
    if (s.gold > maxGold) maxGold = s.gold;
    if (s.gold < minGold) minGold = s.gold;
    if (debtOf(s) > 0) debtDays++;
    if (trace && d % 180 === 0) {
      const hh = Object.values(s.tenants).filter(t => t.status === 'housed').length;
      console.log(`   m${pad(d / 30, 3)} ${s.realm.rank.padEnd(6)} hh ${pad(hh, 3)} roll ${pad(rentRoll(s), 5)} gold ${pad(Math.round(s.gold), 5)} ren ${pad(Math.round(s.renown), 3)} fav ${pad(Math.round(s.favor), 3)} debt ${debtOf(s)} bld ${Object.keys(s.buildings).length}`);
    }
  }
  const s = sim.state;
  const hh = Object.values(s.tenants).filter(t => t.status === 'housed').length;
  const unmet = s.charter.goals.filter(g => !g.done).map(g => `${g.id.split('_').slice(1).join('_')} ${Math.round(g.value)}/${g.target}`).join(', ');
  const why = Object.entries(memo.stalls).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} x${v}`).join('; ');
  const end = s.ended ? `ENDED ${s.ended.reason} m${Math.floor(s.ended.day / 30)}` : '';
  if (at.knight !== undefined) sum.kn.push(at.knight);
  if (at.baron !== undefined) sum.ba.push(at.baron);
  if (s.ended) sum.dead++;
  if (debtDays > 90) sum.debtors++;
  console.log(
    `${pad(i, 4)} ${pad(at.knight ?? '-', 3)} ${pad(at.baron ?? '-', 4)} ${pad(at.duke ?? '-', 5)}  ${s.realm.rank.padEnd(6)} ${pad(hh, 3)} ${pad(rentRoll(s), 5)} ${pad(Math.round(s.gold), 5)} ${pad(Math.round(maxGold), 5)} ${pad(Math.round(s.renown), 4)} ${pad(Math.round(s.favor), 4)} ${pad(debtOf(s), 5)} ${pad(s.stats.evictions, 5)} ${pad(s.stats.incidentsResolved, 4)} ${pad(s.stats.incidentsIgnored, 4)}  ${end}${demotions ? ` demoted x${demotions}` : ''}${debtDays ? ` debtDays ${debtDays}` : ''} [${unmet}] ${why}`,
  );
}
const med = (a: number[]): string => a.length ? String(a.sort((x, y) => x - y)[Math.floor(a.length / 2)]) : '-';
console.log(`Knight ${sum.kn.length}/${seeds} median m${med(sum.kn)} | Baron ${sum.ba.length}/${seeds} median m${med(sum.ba)} | ended ${sum.dead} | long in debt ${sum.debtors}`);
