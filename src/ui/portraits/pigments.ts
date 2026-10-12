/**
 * Portraits: the paint box. A limited set of period pigments (madder, woad,
 * weld, verdigris, lapis, gold) so every face comes off the same desk. Values
 * agree with src/ui/css/base.ts and src/render/palette.ts.
 */
import type { Kind } from './types';
import { dye, type Rand } from './util';

export const PIG = {
  ink: '#2a1d14', parch: '#efe3c4', white: '#f4ecd6', bone: '#ece2c6',
  gold: '#c9a227', gold2: '#e6c65e', goldInk: '#7a5e12', silver: '#c4c7c4',
  lapis: '#2f4a7a', lapisDeep: '#233a63', lapisLite: '#4a68a0',
  red: '#8a2620', redDeep: '#6c1a17', redLite: '#b04a3a', rubric: '#9e2b25',
  madder: '#a8362c', woad: '#3a5a84', weld: '#cf9f38', green: '#4f7a5a', forest: '#3a5c40', russet: '#8f5b3a',
  brown: '#6b4c32', cream: '#e4d6b4', linen: '#efe7d0', plum: '#6a3a5a', teal: '#3a7a7a', grey: '#8a857c',
  black: '#352b2b', ochre: '#b98a3e', rose: '#c27a6a', sky: '#7397ba', mustard: '#d4ac3e', olive: '#7b7a47',
  wine: '#742c3a', slate: '#5b6470', violet: '#5c4a8a', indigo: '#3a2f6a', moss: '#56643a',
  steel: '#a9afb2', steelDark: '#737b81', leather: '#80562f', leatherDark: '#5e3d22',
  straw: '#dcbb5e', strawDark: '#b8923f', wood: '#9a6d3e', woodDark: '#70491f', iron: '#5e6165',
  flame: '#f2a23a', flameCore: '#fbe7a0', wax: '#eadfbe', flour: '#f6f0e0', soot: '#3a3230',
} as const;

export const SKIN: Record<Kind, string[]> = {
  human: ['#f0c9a0', '#ebbd92', '#dfae80', '#cf9a68', '#b98052', '#9a6842', '#7d5235', '#f3d2b0', '#e6b58c'],
  halfling: ['#f2cfa8', '#eec29a', '#e0ad80', '#cc9868', '#f4d6b8', '#ad7a4e', '#e9b990'],
  dwarf: ['#e6b48f', '#dba27c', '#cd8f66', '#bb7c52', '#ecbf9c', '#9c6a44', '#d9987a'],
  goblin: ['#88b45e', '#96c066', '#77a758', '#a3b25c', '#72b07e', '#84ad52', '#9cc47a'],
  elf: ['#f3dfc6', '#f1d5bb', '#ecdccb', '#dcb992', '#96704c', '#f2e2d2', '#c9a27c'],
  ogre: ['#9db3a2', '#91a898', '#aab59c', '#96aab0', '#a7a392', '#8fa58c'],
  dragon: ['#b9502e'],
};
export const HAIR = {
  black: '#2f2520', dark: '#4a3323', brown: '#6b4626', chestnut: '#80492a', auburn: '#93482a', red: '#b5552b',
  ginger: '#cc7430', blond: '#d8b159', straw: '#e2c97f', dun: '#b0904f', grey: '#aaa497', silver: '#cfcbbf', white: '#ece8dc',
  green: '#5d7d4a', blue: '#4f6f95', pink: '#c98a94', purple: '#75528f',
} as const;
export type HairName = keyof typeof HAIR;
export const IRIS = {
  brown: '#5c3b22', dark: '#3c2b1f', hazel: '#7c6a38', green: '#4f7c4c', blue: '#4b7098', grey: '#6f8089', amber: '#b27c2c',
  violet: '#7a5fa0', silverI: '#93a2b3', ice: '#77aac6', goldI: '#c79f33', red: '#a83a2a',
} as const;

const CLOTH = [PIG.madder, PIG.woad, PIG.weld, PIG.green, PIG.russet, PIG.brown, PIG.cream, PIG.plum, PIG.teal, PIG.grey, PIG.ochre, PIG.olive, PIG.rose, PIG.sky, PIG.wine, PIG.forest];
const HUMBLE = [PIG.russet, PIG.brown, PIG.cream, PIG.grey, PIG.olive, PIG.ochre, PIG.green, PIG.woad, PIG.madder, PIG.linen];
export function cloth(r: Rand, humble = false): string { return dye(r.pick(humble ? HUMBLE : CLOTH), r); }

