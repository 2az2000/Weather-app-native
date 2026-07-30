import { err, fromPromise, fromThrowable, ok, type Result } from './result';

describe('Result', () => {
  describe('narrowing', () => {
    it('exposes the value only after narrowing to Ok', () => {
      const result: Result<number, string> = ok(42);

      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      if (result.isOk()) {
        expect(result.value).toBe(42);
      }
    });

    it('exposes the error only after narrowing to Err', () => {
      const result: Result<number, string> = err('boom');

      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBe('boom');
      }
    });
  });

  describe('map', () => {
    it('transforms a success value', () => {
      const result = ok<number, string>(2).map((n) => n * 3);
      expect(result.unwrapOr(0)).toBe(6);
    });

    it('leaves an error untouched and does not invoke the mapper', () => {
      const mapper = jest.fn();
      const result = err<string, number>('boom').map(mapper);

      expect(mapper).not.toHaveBeenCalled();
      expect(result.isErr()).toBe(true);
    });
  });

  describe('mapErr', () => {
    it('transforms an error', () => {
      const result = err<string, number>('boom').mapErr((e) => e.toUpperCase());
      expect(result.isErr() && result.error).toBe('BOOM');
    });

    it('leaves a success untouched and does not invoke the mapper', () => {
      const mapper = jest.fn();
      const result = ok<number, string>(1).mapErr(mapper);

      expect(mapper).not.toHaveBeenCalled();
      expect(result.unwrapOr(0)).toBe(1);
    });
  });

  describe('andThen', () => {
    it('chains a second fallible operation on success', () => {
      const result = ok<number, string>(4).andThen((n) => ok<number, string>(n + 1));
      expect(result.unwrapOr(0)).toBe(5);
    });

    it('short-circuits on the first error', () => {
      const next = jest.fn();
      const result = err<string, number>('first').andThen(next);

      expect(next).not.toHaveBeenCalled();
      expect(result.isErr() && result.error).toBe('first');
    });
  });

  describe('unwrapOr', () => {
    it('returns the value when Ok', () => {
      expect(ok<number, string>(7).unwrapOr(0)).toBe(7);
    });

    it('returns the fallback when Err', () => {
      expect(err<string, number>('boom').unwrapOr(99)).toBe(99);
    });
  });

  describe('match', () => {
    it('takes the ok branch for a success', () => {
      const label = ok<number, string>(1).match({
        ok: (n) => `ok:${n}`,
        err: (e) => `err:${e}`,
      });
      expect(label).toBe('ok:1');
    });

    it('takes the err branch for a failure', () => {
      const label = err<string, number>('boom').match({
        ok: (n) => `ok:${n}`,
        err: (e) => `err:${e}`,
      });
      expect(label).toBe('err:boom');
    });
  });

  describe('fromPromise', () => {
    it('wraps a resolved promise as Ok', async () => {
      const result = await fromPromise(Promise.resolve('value'), () => 'mapped');
      expect(result.unwrapOr('fallback')).toBe('value');
    });

    it('maps a rejection into an error value rather than throwing', async () => {
      const cause = new Error('network down');
      const result = await fromPromise(
        Promise.reject(cause),
        (c) => `mapped:${String(c)}`,
      );

      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error).toContain('network down');
    });
  });

  describe('fromThrowable', () => {
    it('wraps a returned value as Ok', () => {
      const result = fromThrowable(
        () => JSON.parse('{"a":1}') as { a: number },
        () => 'bad json',
      );
      expect(result.isOk()).toBe(true);
    });

    it('converts a throw into an error value', () => {
      const result = fromThrowable(
        () => JSON.parse('not json'),
        () => 'bad json',
      );

      expect(result.isErr()).toBe(true);
      expect(result.isErr() && result.error).toBe('bad json');
    });
  });
});
