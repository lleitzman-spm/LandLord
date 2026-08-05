export type IdentityKind =
  | 'government-id'
  | 'payment-card'
  | 'bank-account'
  | 'email'
  | 'phone'
  | 'street-address'
  | 'unit-address'
  | 'person-name'
  | 'identity-field'
  | 'unscannable-payload';

export interface IdentityFinding {
  kind: IdentityKind;
  masked: string;
  where: string;
}

export class IdentityLeakError extends Error {
  readonly findings: IdentityFinding[];
  constructor(findings: IdentityFinding[]);
}

export function findIdentity(text: string, where?: string): IdentityFinding[];
export function findPersistentIdentity(text: string, where?: string): IdentityFinding[];
export function assertNoIdentity(payload: unknown): void;
export function guardComplete<T extends (payload: any) => Promise<any>>(
  complete: T,
  options?: { onBlocked?: (error: IdentityLeakError) => void },
): T;
