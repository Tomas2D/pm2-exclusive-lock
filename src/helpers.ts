import { LockTimeoutError } from './errors';

export const noop = () => {
  /* Empty handler */
};

export function withTimeout<P extends unknown[], R>(fn: (...args: P) => R, ms: number) {
  return async (...args: P): Promise<Awaited<R>> => {
    let timeoutId: NodeJS.Timeout;

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new LockTimeoutError()), ms);
    });

    return Promise.race([fn(...args), timeout]).finally(() => clearTimeout(timeoutId));
  };
}
