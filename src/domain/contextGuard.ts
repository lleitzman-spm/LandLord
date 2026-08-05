// TypeScript-facing doorway to the one runtime implementation. The `.mjs`
// module is deliberately shared with the Node harness so there is no second,
// weaker copy of the model-context boundary to drift.
export * from './contextGuard.mjs';
