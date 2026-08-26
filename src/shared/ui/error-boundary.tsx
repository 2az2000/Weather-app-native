import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

/**
 * The app's error boundary.
 *
 * CLAUDE.md §22 rule 5 requires one per route, with a retry affordance, so that
 * "one screen failing must not blank the app". Until now the app had none at
 * all: any error thrown while rendering unmounted the entire tree and left a
 * WHITE SCREEN with no message, no stack, and nothing to report. Every possible
 * cause looked identical from the outside, which is what made the failure
 * impossible to diagnose from a release build.
 *
 * The fallback is deliberately built from raw `react-native` primitives with
 * literal styles, and uses NO theme, NO translation, and nothing from `shared/`
 * beyond React itself. Those are the very things that might have thrown — a
 * fallback that depends on them turns one failure into two, and the second one
 * has nowhere left to render.
 *
 * It shows the message and component stack ON SCREEN rather than only logging
 * them, because the person hitting this is usually holding a phone with no
 * debugger attached.
 */
export interface ErrorBoundaryProps {
  readonly children: ReactNode;
  /** Names the region that failed, so the message says WHERE, not just what. */
  readonly label?: string;
  /** Reported to the logger by the caller, which has one and this does not. */
  readonly onError?: (error: Error, componentStack: string) => void;
  /** Rendered instead of the default diagnostic, when a caller has a nicer one. */
  readonly fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | undefined;
  readonly componentStack: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: undefined, componentStack: '' };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? '' });
    this.props.onError?.(error, info.componentStack ?? '');
  }

  private readonly reset = (): void => {
    this.setState({ error: undefined, componentStack: '' });
  };

  override render(): ReactNode {
    const { error, componentStack } = this.state;
    const { children, label, fallback } = this.props;

    if (error === undefined) return children;
    if (fallback !== undefined) return fallback(error, this.reset);

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#ffffff' }}
        contentContainerStyle={{ padding: 24, gap: 12 }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#111111' }}>
          {label === undefined ? 'Something crashed' : `${label} crashed`}
        </Text>

        <Text style={{ fontSize: 14, lineHeight: 20, color: '#b42318' }}>
          {error.name}: {error.message}
        </Text>

        <Text
          accessibilityRole="button"
          onPress={this.reset}
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: '#175cd3',
            paddingVertical: 12,
          }}
        >
          Try again
        </Text>

        {componentStack !== '' && (
          <View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475467' }}>
              Component stack
            </Text>
            <Text style={{ fontSize: 11, lineHeight: 16, color: '#475467' }}>
              {componentStack.trim().split('\n').slice(0, 12).join('\n')}
            </Text>
          </View>
        )}

        {error.stack !== undefined && (
          <View>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#475467' }}>
              Stack
            </Text>
            <Text style={{ fontSize: 11, lineHeight: 16, color: '#475467' }}>
              {error.stack.split('\n').slice(0, 12).join('\n')}
            </Text>
          </View>
        )}
      </ScrollView>
    );
  }
}
