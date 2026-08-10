import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useGroupStore } from '@/src/stores/groupStore';
import { colors, spacing, radius, fontSize, fontWeight, shadow } from '@/constants/Colors';

export default function JoinGroupScreen() {
  const router = useRouter();
  const { joinGroup, createGroup, loading } = useGroupStore();
  const [inviteCode, setInviteCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [mode, setMode] = useState<'join' | 'create'>('join');

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      Alert.alert('Missing Info', 'Please enter an invite code.');
      return;
    }
    try {
      await joinGroup(inviteCode.trim());
      Alert.alert('Joined!', 'You\'re in the group.');
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Invalid invite code.');
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert('Missing Info', 'Please enter a group name.');
      return;
    }
    try {
      const group = await createGroup(groupName.trim());
      Alert.alert(
        'Group Created!',
        `Share this invite code with your friends:\n\n${group.inviteCode}`,
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Something went wrong.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <Text style={styles.title}>
        {mode === 'join' ? 'Join a Group' : 'Create a Group'}
      </Text>
      <Text style={styles.subtitle}>
        {mode === 'join'
          ? 'Enter the invite code your friend shared'
          : 'Start a new fishing group and invite friends'}
      </Text>

      {mode === 'join' ? (
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="key-outline" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Invite code (e.g., a3f9c2)"
              placeholderTextColor={colors.textTertiary}
              value={inviteCode}
              onChangeText={setInviteCode}
              autoCapitalize="none"
              selectionColor={colors.primary}
              autoFocus
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleJoin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Joining...' : 'Join Group'}
            </Text>
          </Pressable>

          <Pressable style={styles.switchButton} onPress={() => setMode('create')}>
            <Text style={styles.switchText}>Or create a new group</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="people-outline" size={18} color={colors.textTertiary} />
            <TextInput
              style={styles.input}
              placeholder="Group name (e.g., Weekend Anglers)"
              placeholderTextColor={colors.textTertiary}
              value={groupName}
              onChangeText={setGroupName}
              selectionColor={colors.primary}
              autoFocus
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleCreate}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating...' : 'Create Group'}
            </Text>
          </Pressable>

          <Pressable style={styles.switchButton} onPress={() => setMode('join')}>
            <Text style={styles.switchText}>Or join an existing group</Text>
          </Pressable>
        </View>
      )}

      {/* Skip */}
      <Pressable
        style={styles.skipButton}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.skipText}>Skip for now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadow.md,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },
  buttonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  switchButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  switchText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  skipText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
  },
});
