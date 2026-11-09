import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useVerifySession } from '@/state/verify-session';

export default function VoteCastScreen() {
  const { load } = useVerifySession();

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button
            title="Next pair"
            onPress={() => {
              load();
              router.back();
            }}
          />
          <Button title="Done for now" variant="secondary" onPress={() => router.dismissTo('/')} />
        </View>
      }>
      <View style={styles.body}>
        <ThemedText type="subtitle">Vote cast. Thanks!</ThemedText>
        <ThemedText themeColor="textSecondary">
          You’ll see how everyone else called it once the check settles. Calls that match the consensus, and above all
          what the pair turns out to be, build your reputation.
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
  body: { gap: Spacing.three, paddingTop: Spacing.five },
});
