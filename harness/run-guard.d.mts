export type GuardedRun<T> =
  | { status: 'ok'; result: T }
  | { status: 'blocked'; error: Error };

export function runGuardedModelWork<T>(
  makeComplete: (options: {
    onBlocked: (error: Error) => void;
  }) => (payload: any) => Promise<any>,
  work: (complete: (payload: any) => Promise<any>) => Promise<T>,
): Promise<GuardedRun<T>>;
