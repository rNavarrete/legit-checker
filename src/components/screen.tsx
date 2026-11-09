import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

/** Scrollable page with a sticky footer (for the main action). */
export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <ThemedView style={styles.root}>
      <SafeAreaView edges={['bottom']} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>{children}</View>
        </ScrollView>
        {footer ? <View style={[styles.inner, styles.footer]}>{footer}</View> : null}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { padding: Spacing.four, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  footer: { alignSelf: 'center', paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, paddingTop: Spacing.two },
});
