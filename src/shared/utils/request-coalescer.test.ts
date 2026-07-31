import { RequestCoalescer } from './request-coalescer';

/** Resolves after a macrotask, so concurrent callers genuinely overlap. */
const defer = <T>(value: T, ms = 5): Promise<T> =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, ms);
  });

describe('RequestCoalescer', () => {
  it('runs a single operation normally', async () => {
    const coalescer = new RequestCoalescer();

    await expect(coalescer.run('key', () => defer('value'))).resolves.toBe('value');
  });

  describe('coalescing', () => {
    it('runs the operation ONCE for ten concurrent identical calls', async () => {
      const coalescer = new RequestCoalescer();
      const operation = jest.fn(() => defer('value'));

      const results = await Promise.all(
        Array.from({ length: 10 }, () => coalescer.run('same', operation)),
      );

      expect(operation).toHaveBeenCalledTimes(1);
      expect(results).toEqual(Array.from({ length: 10 }, () => 'value'));
    });

    it('gives every joiner the same resolved value', async () => {
      const coalescer = new RequestCoalescer();
      const shared = { id: 1 };

      const [a, b] = await Promise.all([
        coalescer.run('same', () => defer(shared)),
        coalescer.run('same', () => defer({ id: 2 })),
      ]);

      // The second operation never ran; both callers hold the first result.
      expect(a).toBe(shared);
      expect(b).toBe(shared);
    });

    it('runs different keys independently', async () => {
      const coalescer = new RequestCoalescer();
      const operation = jest.fn((value: string) => defer(value));

      await Promise.all([
        coalescer.run('a', () => operation('a')),
        coalescer.run('b', () => operation('b')),
      ]);

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('settling', () => {
    it('runs again once the previous call has finished', async () => {
      const coalescer = new RequestCoalescer();
      const operation = jest.fn(() => defer('value'));

      await coalescer.run('key', operation);
      await coalescer.run('key', operation);

      // NOT a cache: an entry is removed on settle, so this never serves a
      // stale value. Freshness is the repository's job.
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('clears the entry after a rejection, so one error does not persist', async () => {
      const coalescer = new RequestCoalescer();
      let attempt = 0;

      const operation = jest.fn(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('transient');
        return 'recovered';
      });

      await expect(coalescer.run('key', operation)).rejects.toThrow('transient');

      // Replaying a failure to every later caller would turn one transient
      // error into a permanent one.
      await expect(coalescer.run('key', operation)).resolves.toBe('recovered');
    });

    it('propagates a rejection to every joiner', async () => {
      const coalescer = new RequestCoalescer();
      const failing = () =>
        new Promise<string>((_resolve, reject) => {
          setTimeout(() => {
            reject(new Error('boom'));
          }, 5);
        });

      const results = await Promise.allSettled([
        coalescer.run('key', failing),
        coalescer.run('key', failing),
      ]);

      expect(results.every((result) => result.status === 'rejected')).toBe(true);
    });
  });

  describe('introspection', () => {
    it('reports pending count and membership while in flight', async () => {
      const coalescer = new RequestCoalescer();

      const pending = coalescer.run('key', () => defer('value'));

      expect(coalescer.pendingCount).toBe(1);
      expect(coalescer.isPending('key')).toBe(true);
      expect(coalescer.isPending('other')).toBe(false);

      await pending;

      expect(coalescer.pendingCount).toBe(0);
      expect(coalescer.isPending('key')).toBe(false);
    });
  });
});
