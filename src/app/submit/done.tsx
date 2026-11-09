import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { MIN_DECISIVE_VOTES } from '@/domain/consensus';

export default function DoneScreen() {
  return (
    <Screen footer={<Button title="Back to home" onPress={() => router.dismissTo('/')} />}>
      <View style={styles.body}>
        <ThemedText type="subtitle">Your check is in the queue.</ThemedText>
        <ThemedText themeColor="textSecondary">
          {`At least ${MIN_DECISIVE_VOTES} verifiers will look at your pair. If they split, more get pulled in until there’s a clear call. You’ll be able to read every review once it settles.`}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: Spacing.three, paddingTop: Spacing.five },
});
