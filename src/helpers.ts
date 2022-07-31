import { LockTimeoutError } from './errors';

export const noop = () => {
  /* Empty handler */
};

export const withTimeout = <R, P, T extends (...args: P[]) => Promise<R>>(logic: T, ms: number) => {
  return (...args: Parameters<T>) => {
    let id: NodeJS.Timeout;

    const timeout = new Promise<never>((resolve, reject) => {
      id = setTimeout(() => {
        reject(new LockTimeoutError());
      }, ms);
    });

    return Promise.race([logic(...args), timeout]).finally(() => clearTimeout(id));
  };
};
