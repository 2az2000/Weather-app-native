import { z } from 'zod';

import { noopLogger } from '@/core/logger';

import { validateResponse } from './validate';

const schema = z.object({
  latitude: z.number(),
  current: z.object({ temperature_2m: z.number() }),
});

const context = { provider: 'open-meteo', endpoint: '/forecast' };

describe('validateResponse', () => {
  it('returns the parsed payload when it matches the schema', () => {
    const result = validateResponse(
      schema,
      { latitude: 35.7, current: { temperature_2m: 21.4 } },
      context,
      noopLogger,
    );

    expect(result.isOk()).toBe(true);
    expect(result.unwrapOr(null as never)).toEqual({
      latitude: 35.7,
      current: { temperature_2m: 21.4 },
    });
  });

  it('returns a validation AppError instead of throwing when the shape is wrong', () => {
    const result = validateResponse(
      schema,
      { latitude: 'not a number' },
      context,
      noopLogger,
    );

    expect(result.isErr()).toBe(true);
    expect(result.isErr() && result.error).toMatchObject({
      kind: 'validation',
      retryable: false,
    });
  });

  it('reports the path of each offending field, so the cause is locatable', () => {
    const result = validateResponse(
      schema,
      { latitude: 35.7, current: { temperature_2m: 'warm' } },
      context,
      noopLogger,
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr() && result.error.kind === 'validation') {
      expect(result.error.issues.join(' ')).toContain('current.temperature_2m');
    }
  });

  it('handles a null payload, which is what a failed upstream often returns', () => {
    expect(validateResponse(schema, null, context, noopLogger).isErr()).toBe(true);
  });

  it('logs the failure so an upstream contract change becomes visible', () => {
    const error = jest.fn();
    validateResponse(schema, {}, context, { ...noopLogger, error });

    expect(error).toHaveBeenCalledWith(
      'api.validation.failed',
      expect.objectContaining({ provider: 'open-meteo', endpoint: '/forecast' }),
    );
  });
});
