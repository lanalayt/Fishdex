import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ScrollView, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRiverStore } from '@/src/stores/riverStore';
import { MapPicker } from '@/src/components/MapPicker';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Colors';

export default function NewRiverScreen() {
  const router = useRouter();
  const { createRiver } = useRiverStore();

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    Keyboard.dismiss();
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Please enter a river name.');
      return;
    }

    setSaving(true);
    try {
      await createRiver({
        name: name.trim(),
        region: city.trim() || undefined,
        state: state.trim() || undefined,
        latitude: latitude ?? undefined,
        longitude: longitude ?? undefined,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save river. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
      >
        <View style={styles.field}>
          <Text style={styles.label}>RIVER NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Clear Creek"
            placeholderTextColor={colors.textTertiary}
            selectionColor={colors.primary}
            autoFocus
          />
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.label}>CITY</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g., Golden"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.label}>STATE</Text>
            <TextInput
              style={styles.input}
              value={state}
              onChangeText={setState}
              placeholder="e.g., Colorado"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
            />
          </View>
        </View>

        <MapPicker
          label="Pin River Location"
          latitude={latitude}
          longitude={longitude}
          riverName={name || undefined}
          city={city || undefined}
          state={state || undefined}
          onChange={(lat, lng) => {
            setLatitude(lat === 0 ? null : lat);
            setLongitude(lng === 0 ? null : lng);
          }}
        />

        <View style={styles.saveSection}>
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Ionicons name="checkmark-circle" size={22} color={colors.white} />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save River'}</Text>
          </Pressable>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.xs + 1, fontWeight: fontWeight.semibold,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4, fontSize: fontSize.md, color: colors.text,
  },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  halfField: { flex: 1 },
  saveSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primary,
    paddingVertical: spacing.md, borderRadius: radius.md, ...shadow.md,
  },
  saveButtonPressed: { backgroundColor: colors.primaryDark, transform: [{ scale: 0.98 }] },
  saveButtonText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.white },
  bottomSpacer: { height: 40 },
});
