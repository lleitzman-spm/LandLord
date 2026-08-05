import { describe, it, expect } from 'vitest';
import { chronicleSoundnessViolations, assertChronicleSound } from './invariants';
import { foundingDoc, grandMusterDoc, moneyEvent } from './fixtures';

describe('assertChronicleSound — the money soundness checker', () => {
  it('the founding chronicle is sound', () => {
    expect(chronicleSoundnessViolations(foundingDoc())).toEqual([]);
  });

  it('a real grand muster is sound', () => {
    const { doc } = grandMusterDoc();
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
  });

  it('a cash-complete sample month is sound', () => {
    // Deal a balanced pair: rent charged then received leaves AR at 0 and the
    // trust bank holding the rent — a self-consistent slice the checker passes.
    const doc = foundingDoc();
    doc.money = [moneyEvent('rent_charged', 150_000), moneyEvent('rent_received', 150_000)];
    expect(chronicleSoundnessViolations(doc)).toEqual([]);
  });

  // Adversarial: the checker MUST catch a corrupted book. A money event with a
  // bogus kind falls through postingsFor's default:[] and silently understates
  // the books — exactly the R1 hazard. If this test ever passes silently, the
  // net is blind.
  it('catches a money event with an unknown kind (silent-drop guard)', () => {
    const doc = foundingDoc();
    const bogus = moneyEvent('rent_charged', 99_999);
    // @ts-expect-error — deliberately forge an off-union kind the fold can't post.
    bogus.kind = 'not_a_real_kind';
    doc.money = [bogus];
    const v = chronicleSoundnessViolations(doc);
    expect(v.length).toBeGreaterThan(0);
    expect(v.join(' ')).toMatch(/no postings|silent drop/);
    expect(() => assertChronicleSound(doc)).toThrow(/unsound/);
  });

  // Adversarial #2: an unbalanced book (a lone half-posting via a hand-forged
  // event that only debits) must be caught. Simulate by an owner drawn beyond
  // their net — the compliance owner-overdraw guard should fire.
  it('catches an owner overdrawn (commingling guard)', () => {
    const doc = foundingDoc();
    // Draw an owner who never had funds — their net goes negative.
    doc.money = [moneyEvent('owner_draw', 500_000)];
    const v = chronicleSoundnessViolations(doc);
    expect(v.length).toBeGreaterThan(0);
  });
});
