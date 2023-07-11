import { LockTimeoutError } from './errors';
import type { GetObjectKeys } from './types';

export const noop = () => {
  /* Empty handler */
};

export function withTimeout<P extends unknown[], R>(fn: (...args: P) => R, ms: number) {
  if (ms === Infinity) {
    return fn;
  }

  return async (...args: P): Promise<Awaited<R>> => {
    let timeoutId: NodeJS.Timeout;

    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new LockTimeoutError()), ms);
    });

    return Promise.race([fn(...args), timeout]).finally(() => clearTimeout(timeoutId));
  };
}

export function getProperty<T extends Record<string, unknown>>(
  target: T,
  property: string & GetObjectKeys<Required<T>>,
) {
  const paths: string[] = property.split('.');
  // @ts-expect-error we cannot make depth check
  return paths.reduce((acc, path) => acc[path], target);
}

export function findBy<T extends Record<string, any>>(
  targets: T[],
  comparator: (prev: T, cur: T) => T,
): T | null {
  if (targets.length === 0) {
    return null;
  }

  return targets.reduce(comparator);
}

export function maxBy<T extends Record<string, any>>(
  targets: T[],
  property: GetObjectKeys<Required<T>>,
): T | null {
  return findBy(targets, (prev, cur) => {
    const a = getProperty(prev, property);
    const b = getProperty(cur, property);
    return a >= b ? prev : cur;
  });
}
