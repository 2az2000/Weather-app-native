import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFakeContainer as fakeContainer } from './__tests__/fake-container';
import { ContainerProvider, useContainer, useLogger } from './container-provider';

/**
 * Built entirely from fakes — no native module, no network, no database.
 *
 * That this is possible at all is the point of the composition root: every
 * dependency is injected, so a subtree can be rendered against test doubles with
 * no module mocking (CLAUDE.md §10, §26).
 */

function ShowsProvider() {
  const container = useContainer();
  return <Text>{container.network.isOnline ? 'online' : 'offline'}</Text>;
}

describe('ContainerProvider', () => {
  it('provides the container to descendants', () => {
    render(
      <ContainerProvider container={fakeContainer()}>
        <ShowsProvider />
      </ContainerProvider>,
    );

    expect(screen.getByText('online')).toBeTruthy();
  });

  it('provides the exact container instance it was given', () => {
    const container = fakeContainer();

    // Identity is asserted through rendered output rather than by capturing
    // into an outer variable — reassigning during render is a side effect the
    // react-hooks rules correctly reject.
    function AssertsIdentity() {
      return <Text>{useContainer() === container ? 'same' : 'different'}</Text>;
    }

    render(
      <ContainerProvider container={container}>
        <AssertsIdentity />
      </ContainerProvider>,
    );

    expect(screen.getByText('same')).toBeTruthy();
  });

  it('exposes the logger through the convenience accessor', () => {
    const container = fakeContainer();

    function AssertsLoggerIdentity() {
      return <Text>{useLogger() === container.logger ? 'same' : 'different'}</Text>;
    }

    render(
      <ContainerProvider container={container}>
        <AssertsLoggerIdentity />
      </ContainerProvider>,
    );

    expect(screen.getByText('same')).toBeTruthy();
  });

  it('surfaces injected storage to descendants', () => {
    const container = fakeContainer();
    container.storage.set('unit', 'celsius');

    function ReadsStorage() {
      return <Text>{useContainer().storage.getString('unit') ?? 'missing'}</Text>;
    }

    render(
      <ContainerProvider container={container}>
        <ReadsStorage />
      </ContainerProvider>,
    );

    expect(screen.getByText('celsius')).toBeTruthy();
  });
});

describe('useContainer outside a provider', () => {
  it('throws a message naming the fix, rather than returning undefined', () => {
    // Failing loudly in development is correct for a programming error
    // (CLAUDE.md §31), and keeps the return type non-nullable at every call
    // site.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<ShowsProvider />)).toThrow(/ContainerProvider/);

    consoleError.mockRestore();
  });
});
