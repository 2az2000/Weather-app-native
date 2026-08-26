import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundary } from '../error-boundary';

/**
 * The boundary CLAUDE.md §22 rule 5 always required and the app never had.
 *
 * Its whole purpose is to be the last thing standing when everything else has
 * failed, so these tests care about one question: does it still render when the
 * thing it wraps does not?
 */
function Boom({ shouldThrow }: { readonly shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('the sky fell');
  return <Text>content</Text>;
}

describe('ErrorBoundary', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // React logs every caught error. That is correct behaviour and would
    // otherwise bury the real output of the run in expected noise.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('content')).toBeTruthy();
  });

  it('shows the error MESSAGE rather than a blank screen', () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    // `getAllBy`, because the message legitimately appears twice — once as
    // "name: message" and again at the head of the stack trace. Both are
    // wanted; the point is that a white screen carries no information, and the
    // person hitting this is usually holding a phone with no debugger.
    expect(screen.getAllByText(/the sky fell/).length).toBeGreaterThan(0);
  });

  it('names WHERE it failed when given a label', () => {
    render(
      <ErrorBoundary label="The app">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('The app crashed')).toBeTruthy();
  });

  it('reports the error to the caller, which owns the logger', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('the sky fell');
  });

  it('offers a retry that clears the error', () => {
    function Flaky() {
      return <Boom shouldThrow={false} />;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getAllByText(/the sky fell/).length).toBeGreaterThan(0);

    // Swap in something that works, then retry — a boundary with no way out
    // strands the user on the error screen until they force-quit.
    rerender(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    fireEvent.press(screen.getByText('Try again'));

    expect(screen.getByText('content')).toBeTruthy();
  });

  it('lets a caller supply its own fallback', () => {
    render(
      <ErrorBoundary fallback={(error) => <Text>custom: {error.message}</Text>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/custom: the sky fell/)).toBeTruthy();
  });

  it('depends on NOTHING that could have caused the crash', () => {
    // No theme, no i18n, no shared primitives — rendered with no providers at
    // all. A fallback that needs the thing that just broke turns one failure
    // into two, and the second one has nowhere left to render.
    expect(() =>
      render(
        <ErrorBoundary>
          <Boom shouldThrow />
        </ErrorBoundary>,
      ),
    ).not.toThrow();

    expect(screen.getAllByText(/the sky fell/).length).toBeGreaterThan(0);
  });
});
