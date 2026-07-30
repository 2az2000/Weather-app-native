import {
  createInMemoryKeyValueStorage,
  createKeyValueStorage,
} from './key-value-storage';

describe('KeyValueStorage', () => {
  it('round-trips a value', () => {
    const storage = createInMemoryKeyValueStorage();
    storage.set('unit', 'celsius');

    expect(storage.getString('unit')).toBe('celsius');
  });

  it('returns undefined for a missing key rather than throwing', () => {
    expect(createInMemoryKeyValueStorage().getString('absent')).toBeUndefined();
  });

  it('reports containment', () => {
    const storage = createInMemoryKeyValueStorage();
    expect(storage.contains('unit')).toBe(false);

    storage.set('unit', 'celsius');
    expect(storage.contains('unit')).toBe(true);
  });

  it('deletes a single key without affecting others', () => {
    const storage = createInMemoryKeyValueStorage();
    storage.set('a', '1');
    storage.set('b', '2');

    storage.delete('a');

    expect(storage.contains('a')).toBe(false);
    expect(storage.getString('b')).toBe('2');
  });

  it('clears everything', () => {
    const storage = createInMemoryKeyValueStorage();
    storage.set('a', '1');
    storage.set('b', '2');

    storage.clearAll();

    expect(storage.contains('a')).toBe(false);
    expect(storage.contains('b')).toBe(false);
  });

  it('overwrites an existing key', () => {
    const storage = createInMemoryKeyValueStorage();
    storage.set('unit', 'celsius');
    storage.set('unit', 'fahrenheit');

    expect(storage.getString('unit')).toBe('fahrenheit');
  });
});

/**
 * Covers the MMKV-backed factory. The native module is doubled (see
 * `__mocks__/react-native-mmkv.js`) because Nitro cannot load in Node; this
 * verifies the ADAPTER, particularly the v4 rename of `delete` to `remove`.
 */
describe('createKeyValueStorage (MMKV adapter)', () => {
  it('round-trips a value through the native-backed store', () => {
    const storage = createKeyValueStorage('test');
    storage.set('unit', 'celsius');

    expect(storage.getString('unit')).toBe('celsius');
    expect(storage.contains('unit')).toBe(true);
  });

  it('maps delete onto MMKV v4’s renamed remove method', () => {
    const storage = createKeyValueStorage('test');
    storage.set('unit', 'celsius');

    storage.delete('unit');

    expect(storage.contains('unit')).toBe(false);
  });

  it('clears every key', () => {
    const storage = createKeyValueStorage('test');
    storage.set('a', '1');
    storage.set('b', '2');

    storage.clearAll();

    expect(storage.contains('a')).toBe(false);
    expect(storage.contains('b')).toBe(false);
  });

  it('returns undefined for a missing key', () => {
    expect(createKeyValueStorage('test').getString('absent')).toBeUndefined();
  });
});
