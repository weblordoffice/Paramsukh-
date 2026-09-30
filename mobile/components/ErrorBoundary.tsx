import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      padding: 24,
    },
    icon: {
      fontSize: 48,
      marginBottom: 16,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    stack: {
      fontSize: 10,
      color: colors.textSecondary,
      marginHorizontal: 16,
      marginBottom: 16,
    },
    button: {
      backgroundColor: colors.text,
      paddingVertical: 14,
      paddingHorizontal: 32,
      borderRadius: 12,
    },
    buttonText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: '600',
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>
        {error?.message || 'The app encountered an unexpected error. Please try again.'}
      </Text>
      {error?.stack && (
        <Text style={styles.stack} numberOfLines={4}>
          {error.stack}
        </Text>
      )}
      <TouchableOpacity style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback error={this.state.error} onRetry={this.handleRetry} />
      );
    }

    return this.props.children;
  }
}
