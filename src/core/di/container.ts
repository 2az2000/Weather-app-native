import { createApiClients, type ApiClients } from '@/core/api';
import { loadEnv, type Env } from '@/core/config';
import { createConsoleSink, createLogger, type Logger } from '@/core/logger';
import { createNetworkMonitor, type NetworkMonitor } from '@/core/network';
import {
  createKeyValueStorage,
  openDatabase,
  type Database,
  type KeyValueStorage,
} from '@/core/storage';

/**
 * The composition root.
 *
 * Every dependency is constructed HERE and injected downward. Nothing is
 * constructed inside a use case, hook, or component (CLAUDE.md §10) — that is
 * what allows a use case to be tested with a two-line fake instead of a mocking
 * framework.
 *
 * Feature repositories are bound here as their phases land: Phase 3 adds
 * `LocationRepository`, Phase 4 adds `WeatherRepository`. Each binds a domain
 * INTERFACE to a data implementation, which is the dependency inversion the whole
 * architecture rests on.
 */
export interface Container {
  readonly env: Env;
  readonly logger: Logger;
  readonly storage: KeyValueStorage;
  readonly network: NetworkMonitor;
  readonly api: ApiClients;
  /**
   * `undefined` when the database failed to open or migrate.
   *
   * A corrupt cache must never prevent the app from starting — the app degrades
   * to MMKV-only operation rather than showing a fatal error (CLAUDE.md §24).
   */
  readonly database: Database | undefined;
}

/**
 * Build the container.
 *
 * `loadEnv()` runs first and THROWS on a missing required variable, so a
 * misconfigured build fails at startup with a message naming the variable rather
 * than as a confusing 401 several screens in (ROADMAP Phase 1 DoD).
 */
export async function createContainer(): Promise<Container> {
  const env = loadEnv();

  const logger = createLogger([createConsoleSink(__DEV__ ? 'debug' : 'warn')]);

  const storage = createKeyValueStorage();
  const network = createNetworkMonitor();
  const api = createApiClients(env, logger);

  const database = await openDatabase(logger);
  if (database.isErr()) {
    logger.warn('di.database.unavailable', { kind: database.error.kind });
  }

  return {
    env,
    logger,
    storage,
    network,
    api,
    database: database.isOk() ? database.value : undefined,
  };
}
