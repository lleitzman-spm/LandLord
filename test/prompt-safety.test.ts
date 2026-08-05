import { describe, expect, it } from 'vitest';
import { makeVendorClerk } from '../harness/clerks.mjs';
import { makeResidentClerk } from '../harness/res-desk.mjs';
import { makeTurnoverClerk } from '../harness/turn-desk.mjs';
import { makeViolationClerk } from '../harness/viol-desk.mjs';
import { assertNoIdentity } from '../src/domain/contextGuard';

const now = '2026-07-29T12:00:00.000Z';
const privateSubject = '126 Kingsmill Way, unit B — tenant Alice Smith reports no cooling';

function policy() {
  return { tier: 1, model: 'test-model', fallback: 'tool' };
}

function captureBrain(content: string) {
  const calls: unknown[] = [];
  return {
    calls,
    complete: async (payload: unknown) => {
      calls.push(payload);
      return { message: { role: 'assistant', content } };
    },
  };
}

function simpleCore(target: unknown, params: Record<string, string>) {
  return {
    readFlows: () => [target],
    paramsOf: () => params,
    proposeStep: () => ({ id: 'proposal', caseId: 'case-1', kind: 'proposed' }),
    coinCents: (cents: number) => `$${Math.round(cents / 100)}`,
  };
}

describe('de-identified decision evidence', () => {
  it('gives vendor reasoning a controlled symptom, trade, and urgency only', async () => {
    const brain = captureBrain(
      '{"vendor":"vendor-1","dollars":180,"confidence":0.9,"why":"emergency fit"}',
    );
    const target = {
      template: { key: 'vendor-dispatch', title: 'Vendor Dispatch', steps: [] },
      status: 'open',
      next: { kind: 'handed', index: 3, step: { key: 'assign-vendor' } },
      caseId: 'case-1',
      subject: privateSubject,
      openedAt: now,
    };
    const core = {
      ...simpleCore(target, { trade: 'HVAC', urgency: 'emergency' }),
      applyEconomySetting: () => ({}),
      FOUNDING_ECONOMY: {},
      readCase: () => ({}),
      estimateSpendCents: () => 18000,
      spendGate: () => ({ capCents: null, needsApproval: false }),
    };
    const clerk = makeVendorClerk({ core, complete: brain.complete, brainFor: policy });
    await clerk.run({ doc: { flows: [], events: [] }, now, taken: new Set(), cap: 1 });

    const prompt = JSON.stringify(brain.calls);
    expect(prompt).toContain('Symptom: no-cooling');
    expect(prompt).toContain('Trade: HVAC');
    expect(prompt).toContain('urgency: emergency');
    expect(prompt).not.toContain('Alice Smith');
    expect(prompt).not.toContain('Kingsmill');
    expect(prompt).not.toContain('unit B');
    expect(() => assertNoIdentity(brain.calls[0])).not.toThrow();
  });

  it('gives resident triage a structured request category without its subject', async () => {
    const brain = captureBrain(
      '{"posture":"priority","confidence":0.9,"why":"inspection finding"}',
    );
    const target = {
      template: { key: 'service-request-triage', title: 'Service Request' },
      status: 'open',
      next: {
        kind: 'handed',
        index: 2,
        step: { key: 'classify', holder: 'mabel' },
      },
      caseId: 'case-1',
      subject: privateSubject,
      openedAt: now,
    };
    const core = simpleCore(target, {
      category: 'inspection-finding',
      urgency: 'urgent',
    });
    const clerk = makeResidentClerk({ core, complete: brain.complete, brainFor: policy });
    await clerk.run({ doc: { flows: [], events: [] }, now, taken: new Set(), cap: 1 });

    const prompt = JSON.stringify(brain.calls);
    expect(prompt).toContain('request-category=inspection-finding');
    expect(prompt).toContain('urgency=urgent');
    expect(prompt).toContain('symptom=no-cooling');
    expect(prompt).not.toContain('Alice Smith');
    expect(prompt).not.toContain('Kingsmill');
    expect(prompt).not.toContain('unit B');
    expect(() => assertNoIdentity(brain.calls[0])).not.toThrow();
  });

  it('gives violation grading its controlled violation type without its subject', async () => {
    const brain = captureBrain(
      '{"grade":"severe","confidence":0.9,"why":"documented unauthorized pet"}',
    );
    const target = {
      template: { key: 'lease-violation', title: 'Lease Violation' },
      status: 'open',
      next: {
        kind: 'handed',
        index: 2,
        step: { key: 'verify', holder: 'pm-desk' },
      },
      caseId: 'case-1',
      subject: privateSubject,
      openedAt: now,
    };
    const core = simpleCore(target, {
      violationType: 'unauthorized-pet',
      noticeType: 'cure-or-quit',
    });
    const clerk = makeViolationClerk({ core, complete: brain.complete, brainFor: policy });
    await clerk.run({ doc: { flows: [], events: [] }, now, taken: new Set(), cap: 1 });

    const prompt = JSON.stringify(brain.calls);
    expect(prompt).toContain('Violation type: unauthorized-pet');
    expect(prompt).not.toContain('Alice Smith');
    expect(prompt).not.toContain('Kingsmill');
    expect(prompt).not.toContain('unit B');
    expect(() => assertNoIdentity(brain.calls[0])).not.toThrow();
  });

  it('gives turnover scoping distinct controlled condition evidence without either subject', async () => {
    async function promptFor(subject: string) {
      const brain = captureBrain(
        '{"scope":"cosmetic","confidence":0.9,"why":"condition fit"}',
      );
      const target = {
        template: { key: 'move-out-relay', title: 'Move-out relay' },
        status: 'open',
        next: {
          kind: 'handed',
          index: 5,
          step: { key: 'turn-scope', holder: 'va-desk' },
        },
        caseId: 'case-1',
        subject,
        openedAt: now,
      };
      const core = simpleCore(target, {});
      const clerk = makeTurnoverClerk({
        core,
        complete: brain.complete,
        brainFor: policy,
      });
      await clerk.run({
        doc: { flows: [], events: [] },
        now,
        taken: new Set(),
        cap: 1,
      });
      return brain.calls[0];
    }

    const cosmetic = await promptFor(
      '126 Kingsmill Way, unit B — tenant Alice Smith reports light cosmetic scuffs',
    );
    const rehabilitation = await promptFor(
      '88 Cedar Road, unit 7 — owner Bob Jones reports fire damage and structural damage',
    );
    const cosmeticPrompt = JSON.stringify(cosmetic);
    const rehabilitationPrompt = JSON.stringify(rehabilitation);

    expect(cosmeticPrompt).toContain('turn-condition=cosmetic-wear');
    expect(rehabilitationPrompt).toContain(
      'turn-condition=major-rehabilitation',
    );
    expect(cosmeticPrompt).not.toEqual(rehabilitationPrompt);

    for (const prompt of [cosmeticPrompt, rehabilitationPrompt]) {
      expect(prompt).not.toMatch(
        /Alice Smith|Bob Jones|Kingsmill|Cedar Road|unit [B7]/,
      );
    }
    expect(() => assertNoIdentity(cosmetic)).not.toThrow();
    expect(() => assertNoIdentity(rehabilitation)).not.toThrow();
  });
});
