import { Component, type ReactNode } from 'react'
import { View, Text, Pressable, Platform } from 'react-native'
import { reportError } from '../lib/reportError'

/**
 * App-wide error boundary. Without one, any uncaught render error unmounts the
 * whole React tree — the user sees a blank screen with no way out. This catches
 * it, reports it (src/lib/reportError.ts), and shows a calm recovery screen.
 *
 * Placed high in App.tsx (inside SafeAreaProvider, around the store/auth
 * providers) so it also catches errors thrown during provider setup. The fallback
 * is deliberately self-contained — hard-coded dark colours, no theme/store/i18n —
 * so it renders even when those are the thing that broke.
 */
interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

const INK = '#0a0a0b'
const CARD = 'rgba(255,255,255,0.05)'
const FG = '#ffffff'
const BRAND = '#7ED957'

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    reportError(error, { boundary: 'app-root', componentStack: info?.componentStack })
  }

  handleRetry = (): void => {
    // Web: a full reload is the cleanest reset. Native: clear the error so the
    // tree re-mounts — recovers from a transient error; a persistent one simply
    // shows this screen again (no worse than before, and no blank screen).
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload()
      return
    }
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <View style={{ flex: 1, backgroundColor: INK, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 420,
            backgroundColor: CARD,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
            padding: 24,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 40 }}>😕</Text>
          <Text style={{ marginTop: 12, fontSize: 20, fontWeight: '800', color: FG, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            The app hit an unexpected error. Your data is saved — try again, or fully close and reopen the app.
          </Text>
          <Pressable
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={{
              marginTop: 22,
              backgroundColor: BRAND,
              borderRadius: 999,
              paddingVertical: 14,
              paddingHorizontal: 40,
              width: '100%',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '800', color: INK }}>Try again</Text>
          </Pressable>
        </View>
      </View>
    )
  }
}
