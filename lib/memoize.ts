/**
 * Memoization utility untuk cache hasil perhitungan mahal
 * Menggunakan reference check (===) untuk object parameters
 */

type CacheEntry<T> = {
  inputs: unknown[];
  result: T;
};

/**
 * Creates a memoized version of a function
 * Caches based on reference equality (===) of all arguments
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
  maxCacheSize: number = 5
): (...args: TArgs) => TResult {
  const cache: CacheEntry<TResult>[] = [];

  return function memoized(...args: TArgs): TResult {
    // Check if we have a cache hit
    for (const entry of cache) {
      if (inputsEqual(entry.inputs, args)) {
        return entry.result;
      }
    }

    // Cache miss - compute result
    const result = fn(...args);

    // Store in cache
    cache.push({ inputs: args, result });

    // Maintain cache size limit (FIFO eviction)
    if (cache.length > maxCacheSize) {
      cache.shift();
    }

    return result;
  };
}

/**
 * Check if two arrays of inputs are equal (reference check)
 */
function inputsEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * WeakMap-based memoizer for object-heavy inputs
 * Only works with functions that take a single object parameter
 * Automatically garbage collected when input objects are no longer referenced
 */
export function weakMemoize<TInput extends object, TResult>(
  fn: (input: TInput) => TResult
): (input: TInput) => TResult {
  const cache = new WeakMap<TInput, TResult>();

  return function memoized(input: TInput): TResult {
    if (cache.has(input)) {
      return cache.get(input)!;
    }

    const result = fn(input);
    cache.set(input, result);
    return result;
  };
}

/**
 * Composite key memoizer for functions with multiple object parameters
 * Creates a composite cache key from all object parameters
 */
export function compositeMemoize<TArgs extends object[], TResult>(
  fn: (...args: TArgs) => TResult,
  maxCacheSize: number = 10
): (...args: TArgs) => TResult {
  const cache = new Map<string, TResult>();
  const keyOrder: string[] = [];

  return function memoized(...args: TArgs): TResult {
    // Create composite key from object references
    const key = args.map(arg => {
      // Use a unique identifier for each object
      if (!('_memoId' in arg)) {
        Object.defineProperty(arg, '_memoId', {
          value: Math.random().toString(36).substr(2, 9),
          enumerable: false,
          writable: false,
        });
      }
      return (arg as any)._memoId;
    }).join('|');

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = fn(...args);
    cache.set(key, result);
    keyOrder.push(key);

    // Maintain cache size limit
    if (cache.size > maxCacheSize) {
      const oldKey = keyOrder.shift();
      if (oldKey) {
        cache.delete(oldKey);
      }
    }

    return result;
  };
}
