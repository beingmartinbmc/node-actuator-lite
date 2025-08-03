export function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const t = setTimeout(() => {
        reject(new Error(errorMessage || `Operation timed out after ${ms}ms`));
      }, ms);
      t.unref();
    })
  ]);
}

export function createTimeoutError(ms: number, operation: string): Error {
  return new Error(`${operation} timed out after ${ms}ms`);
} 