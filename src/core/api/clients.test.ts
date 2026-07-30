import { noopLogger } from '@/core/logger';

import { createApiClients } from './clients';

const env = { openWeatherApiKey: 'ow-key', mapboxAccessToken: 'mb-token' };

describe('createApiClients', () => {
  it('creates one client per provider', () => {
    const clients = createApiClients(env, noopLogger);

    expect(Object.keys(clients).sort()).toEqual([
      'openMeteoAirQuality',
      'openMeteoArchive',
      'openMeteoForecast',
      'openMeteoGeocoding',
      'openWeather',
      'rainViewer',
    ]);
  });

  it('tags each client with a distinct provider name for the circuit breaker', () => {
    const clients = createApiClients(env, noopLogger);
    const providers = Object.values(clients).map((client) => client.provider);

    expect(new Set(providers).size).toBe(providers.length);
  });

  it('names the Open-Meteo forecast provider so degraded errors identify it', () => {
    expect(createApiClients(env, noopLogger).openMeteoForecast.provider).toBe(
      'open-meteo',
    );
  });

  it('exposes a get method on every client', () => {
    for (const client of Object.values(createApiClients(env, noopLogger))) {
      expect(typeof client.get).toBe('function');
    }
  });
});
