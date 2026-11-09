import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSubmissionDraft, type SneakerDetails } from '@/state/submission-draft';

type Field = {
  key: keyof SneakerDetails;
  label: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
};

const FIELDS: Field[] = [
  { key: 'brand', label: 'Brand', placeholder: 'e.g. Nike, New Balance, Asics', required: true },
  { key: 'model', label: 'Model', placeholder: 'e.g. Dunk Low, 990v6, Gel-Kayano 14', required: true },
  { key: 'colorway', label: 'Colorway or style code', placeholder: 'e.g. Panda, DD1391-100' },
  { key: 'size', label: 'Size', placeholder: 'e.g. US 10.5', autoCapitalize: 'characters' },
  { key: 'purchaseSource', label: 'Where you got them', placeholder: 'e.g. eBay, a friend, retail' },
  {
    key: 'notes',
    label: 'Anything verifiers should know',
    placeholder: 'Optional',
    multiline: true,
  },
];

export default function DetailsScreen() {
  const { draft, setDetails } = useSubmissionDraft();
  const [details, setLocal] = useState(draft.details);
  const theme = useTheme();

  const canContinue = details.brand.trim() !== '' && details.model.trim() !== '';

  return (
    <Screen
      footer={
        <Button
          title="Continue to photos"
          disabled={!canContinue}
          onPress={() => {
            setDetails(details);
            router.push('/submit/photos');
          }}
        />
      }>
      <ThemedText themeColor="textSecondary">
        Every model is welcome. Type it the way you’d search for it.
      </ThemedText>
      {FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <ThemedText type="smallBold">
            {field.label}
            {field.required ? ' *' : ''}
          </ThemedText>
          <TextInput
            value={details[field.key]}
            onChangeText={(text) => setLocal((d) => ({ ...d, [field.key]: text }))}
            placeholder={field.placeholder}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize={field.autoCapitalize ?? 'words'}
            multiline={field.multiline}
            style={[
              styles.input,
              field.multiline && styles.multiline,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
          />
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.one },
  input: {
    minHeight: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});
