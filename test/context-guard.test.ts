import { describe, it, expect } from 'vitest';
import {
  findIdentity,
  assertNoIdentity,
  guardComplete,
  IdentityLeakError,
} from '../src/domain/contextGuard';

const msg = (content: string) => ({ messages: [{ role: 'user', content }] });

describe('context guard — what must never reach a model', () => {
  it('catches a government id', () => {
    const f = findIdentity('the resident, ssn 123-45-6789, is two months behind');
    expect(f).toHaveLength(1);
    expect(f[0].kind).toBe('government-id');
  });

  it('catches a payment card, and only a Luhn-valid one', () => {
    // a real test number
    expect(findIdentity('card 4111 1111 1111 1111').some((x) => x.kind === 'payment-card')).toBe(true);
    // same shape, checksum fails — an invoice number, not a card
    expect(findIdentity('ref 4111 1111 1111 1112').some((x) => x.kind === 'payment-card')).toBe(false);
  });

  it('catches a bank routing number by its checksum', () => {
    expect(findIdentity('routing 021000021').some((x) => x.kind === 'bank-account')).toBe(true);
    // nine digits that are not a routing number
    expect(findIdentity('parcel 123456789').some((x) => x.kind === 'bank-account')).toBe(false);
  });

  it('catches contact details', () => {
    expect(findIdentity('write to bob@example.com')[0].kind).toBe('email');
    expect(findIdentity('call (555) 555-0134')[0].kind).toBe('phone');
    expect(findIdentity('Phone: 5555550134')[0].kind).toBe('phone');
    expect(findIdentity('call +15555550134')[0].kind).toBe('phone');
  });

  it('catches a role-labeled name in ordinary prose', () => {
    expect(findIdentity('tenant Alice Smith reports no heat')[0].kind).toBe('person-name');
  });

  it('catches direct doors, unit identifiers, and person names', () => {
    const findings = findIdentity(
      '126 Kingsmill Way, unit B — Bob the Harper',
    ).map((finding) => finding.kind);
    expect(findings).toContain('street-address');
    expect(findings).toContain('unit-address');
    expect(findings).toContain('person-name');
  });

  it('never repeats the value it found', () => {
    const f = findIdentity('ssn 123-45-6789');
    expect(f[0].masked).not.toContain('123-45-6789');
    expect(f[0].masked).toContain('*');
  });
});

describe('context guard — it must not fire on ordinary clerk work', () => {
  // These are real strings from the simulated realm and the clerks' menus. A
  // guard that stops legitimate work gets switched off within a day.
  const innocent = [
    'Collections Ladder · opaque case ref wg/s6-512',
    'Vendor Dispatch (Work Order) · opaque case ref case-145',
    'assign vendor-1 @ $180 — within-authority',
    'a modest raise @ $1,481/mo — $300 renewal fee',
    'Step 4/6 · Serve the statutory 30-day pay-or-quit notice.',
    'opaque door ref d-14',
    '{"posture":"standard-ladder","confidence":0.82,"why":"two months behind"}',
    'a heavy turn ($3,800, 14d)',
    'WO-8841 raised 2026-07-28, aged 9d',
  ];

  for (const s of innocent) {
    it(`stays quiet on: ${s.slice(0, 46)}…`, () => {
      expect(findIdentity(s)).toEqual([]);
    });
  }

});

describe('context guard — the seam', () => {
  it('throws rather than redacting, so no clerk reasons on altered evidence', () => {
    expect(() => assertNoIdentity(msg('ssn 123-45-6789'))).toThrow(IdentityLeakError);
  });

  it('lets an ordinary payload through', () => {
    expect(() => assertNoIdentity(msg('choose a posture for a 2-month delinquency'))).not.toThrow();
  });

  it('scans structured content too, not just strings', () => {
    expect(() =>
      assertNoIdentity({ messages: [{ role: 'user', content: { tenant: { ssn: '123-45-6789' } } }] }),
    ).toThrow(IdentityLeakError);
  });

  it('rejects a generic bare name when it arrives in an identity-shaped field', () => {
    expect(() =>
      assertNoIdentity({
        messages: [{ role: 'user', content: 'review this case' }],
        context: { name: 'Alice Smith' },
      }),
    ).toThrow(IdentityLeakError);
  });

  it('does not mistake OpenAI tool-schema names for personal identity', () => {
    expect(() =>
      assertNoIdentity({
        messages: [{ role: 'user', content: 'pick an operational action' }],
        tools: [
          {
            type: 'function',
            function: {
              name: 'choose_posture',
              description: 'Choose a posture from the supplied menu.',
              parameters: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Opaque option name.' },
                  contact: { type: 'string', description: 'A role, not a supplied value.' },
                },
                required: ['name', 'contact'],
              },
            },
          },
        ],
      }),
    ).not.toThrow();
  });

  it('scans the toJSON value the provider would serialize', async () => {
    let sawCall = false;
    const brain = guardComplete(async () => {
      sawCall = true;
      return { ok: true };
    });
    await expect(
      brain({
        messages: [{ role: 'user', content: 'review this case' }],
        context: {
          toJSON: () => ({ contact: 'Alice Smith' }),
        },
      }),
    ).rejects.toThrow(IdentityLeakError);
    expect(sawCall).toBe(false);
  });

  it('materializes once so a stateful toJSON cannot change after the scan', async () => {
    let serializations = 0;
    let providerJson = '';
    const brain = guardComplete(async (payload) => {
      providerJson = JSON.stringify(payload);
      return { ok: true };
    });
    await brain({
      messages: [
        {
          role: 'user',
          content: {
            toJSON: () => {
              serializations += 1;
              return serializations === 1 ? 'ordinary operational facts' : 'bob@example.com';
            },
          },
        },
      ],
    });
    expect(serializations).toBe(1);
    expect(providerJson).toContain('ordinary operational facts');
    expect(providerJson).not.toContain('bob@example.com');
  });

  it('preserves AbortSignal outside the materialized model body', async () => {
    const controller = new AbortController();
    let received: unknown;
    const brain = guardComplete(async (payload) => {
      received = payload.signal;
      return { ok: true };
    });
    await brain({
      messages: [{ role: 'user', content: 'ordinary facts' }],
      signal: controller.signal,
    });
    expect(received).toBe(controller.signal);
  });

  it('a guarded brain never receives a leaking call', async () => {
    let sawCall = false;
    const brain = guardComplete(async () => {
      sawCall = true;
      return { ok: true };
    });
    await expect(brain(msg('call (555) 555-0134'))).rejects.toThrow(IdentityLeakError);
    expect(sawCall).toBe(false);
  });

  const reproducedBypasses: Array<[string, unknown]> = [
    ['a spaced country code', msg('call +1 5555550134')],
    [
      'a phone-number field alias',
      {
        messages: [{ role: 'user', content: 'review this case' }],
        context: { phone_number: '5555550134' },
      },
    ],
    [
      'the reviewer mobile-number field alias',
      {
        messages: [{ role: 'user', content: 'review this case' }],
        context: { mobile_number: '5555550134' },
      },
    ],
    [
      'camel and kebab contact-number aliases',
      {
        messages: [{ role: 'user', content: 'review this case' }],
        context: {
          telephoneNumber: '5555550134',
          'cell-number': '5555550134',
          tel_number: '5555550134',
        },
      },
    ],
    [
      'a contact-name field alias',
      {
        messages: [{ role: 'user', content: 'review this case' }],
        context: { contact_name: 'Alice Smith' },
      },
    ],
  ];

  for (const [label, payload] of reproducedBypasses) {
    it(`blocks ${label} before the provider call`, async () => {
      let sawCall = false;
      const brain = guardComplete(async () => {
        sawCall = true;
        return { ok: true };
      });

      await expect(brain(payload)).rejects.toThrow(IdentityLeakError);
      expect(sawCall).toBe(false);
    });
  }

  it('does not mistake compact work-order and invoice numbers for phones', async () => {
    let sawCall = false;
    const brain = guardComplete(async () => {
      sawCall = true;
      return { ok: true };
    });

    await expect(
      brain({
        messages: [{ role: 'user', content: 'compare ordinary business references' }],
        context: {
          work_order_number: '5555550134',
          invoice_number: '15555550134',
        },
      }),
    ).resolves.toEqual({ ok: true });
    expect(sawCall).toBe(true);
  });

  it('a guarded brain passes clean calls straight through', async () => {
    const brain = guardComplete(async () => ({ ok: true }));
    await expect(brain(msg('pick a vendor within authority'))).resolves.toEqual({ ok: true });
  });

  it('reports every finding, not just the first, so one fix does not reveal another', () => {
    try {
      assertNoIdentity(msg('ssn 123-45-6789 and bob@example.com'));
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as IdentityLeakError).findings.map((f) => f.kind).sort()).toEqual([
        'email',
        'government-id',
      ]);
    }
  });
});
