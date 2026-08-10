import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Modal, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '@/src/stores/tripStore';
import { useRiverStore } from '@/src/stores/riverStore';
import { useAuthStore } from '@/src/stores/authStore';
import { useGroupStore } from '@/src/stores/groupStore';
import { SUPABASE_ENABLED } from '@/src/supabase/config';
import { sync } from '@/src/sync/engine';
import { colors, spacing, radius, fontSize, fontWeight } from '@/constants/Colors';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const router = useRouter();
  const { trips, loadTrips } = useTripStore();
  const { rivers, loadRivers } = useRiverStore();
  const { user, signOut, deleteAccount } = useAuthStore();
  const { currentGroup, members, loadCurrentGroup, loadMembers } = useGroupStore();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTrips();
    loadRivers();
    if (SUPABASE_ENABLED && user) {
      loadCurrentGroup().then(() => loadMembers());
    }
  }, [user]);

  const totalFish = trips.reduce((sum, t) => sum + t.catchCount, 0);
  const uniqueFlies = new Set(
    trips.flatMap((t) => t.catches.map((c) => (c.flyPattern ?? '').toLowerCase()))
  ).size;

  const stats = [
    { icon: 'calendar' as const, label: 'Total Trips', value: trips.length },
    { icon: 'water' as const, label: 'Rivers Fished', value: rivers.length },
    { icon: 'fish' as const, label: 'Total Fish', value: totalFish },
    { icon: 'bug' as const, label: 'Unique Flies', value: uniqueFlies },
  ];

  const handleCopyInvite = async () => {
    if (currentGroup?.inviteCode) {
      await Clipboard.setStringAsync(currentGroup.inviteCode);
      Alert.alert('Copied!', `Invite code "${currentGroup.inviteCode}" copied to clipboard. Share it with your friends!`);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('Sign out failed:', e);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your personal data. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeletePassword('');
            setDeleteModalVisible(true);
          },
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (!deletePassword) {
      Alert.alert('Password Required', 'Please enter your password to confirm.');
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      setDeleteModalVisible(false);
      setDeletePassword('');
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert('Deletion Failed', e?.message ?? 'Unable to delete account.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async () => {
    try {
      await sync();
      Alert.alert('Synced', 'Your data is up to date.');
    } catch {
      Alert.alert('Sync Failed', 'Check your internet connection.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar / User Info */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={colors.primary} />
        </View>
        <Text style={styles.name}>{user?.displayName ?? 'Angler'}</Text>
        <Text style={styles.subtitle}>
          {user ? user.email : 'Local account'}
        </Text>
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Your Stats</Text>
      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.statCard}>
            <Ionicons name={stat.icon} size={24} color={colors.primary} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {/* Group Section */}
      {SUPABASE_ENABLED && user ? (
        <>
          <Text style={styles.sectionTitle}>Group</Text>
          {currentGroup ? (
            <View style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Ionicons name="people" size={22} color={colors.accent} />
                <Text style={styles.groupName}>{currentGroup.name}</Text>
              </View>

              {/* Invite code */}
              <Pressable style={styles.inviteRow} onPress={handleCopyInvite}>
                <Text style={styles.inviteLabel}>Invite Code</Text>
                <View style={styles.inviteCodeContainer}>
                  <Text style={styles.inviteCode}>{currentGroup.inviteCode}</Text>
                  <Ionicons name="copy-outline" size={16} color={colors.primary} />
                </View>
              </Pressable>

              {/* Members */}
              <View style={styles.membersHeader}>
                <Text style={styles.membersLabel}>
                  {members.length} {members.length === 1 ? 'member' : 'members'}
                </Text>
                <Pressable onPress={() => loadCurrentGroup().then(() => loadMembers())}>
                  <Ionicons name="refresh-outline" size={16} color={colors.primary} />
                </Pressable>
              </View>
              {members.map((m) => (
                <View key={m.id} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberInitial}>
                      {(m.displayName || '?').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memberName}>{m.displayName}</Text>
                    {m.email ? <Text style={styles.memberEmail}>{m.email}</Text> : null}
                  </View>
                  {m.role === 'admin' ? (
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminText}>Admin</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Pressable
              style={styles.joinCard}
              onPress={() => router.push('/(auth)/join-group')}
            >
              <Ionicons name="people-outline" size={24} color={colors.primary} />
              <View style={styles.joinContent}>
                <Text style={styles.joinTitle}>Join or Create a Group</Text>
                <Text style={styles.joinText}>Share trips with your fishing buddies</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          )}
        </>
      ) : null}

      {/* Account Section */}
      <Text style={styles.sectionTitle}>Account</Text>

      {user ? (
        <View style={styles.accountActions}>
          <Pressable style={styles.actionRow} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Sign Out</Text>
          </Pressable>
          <Pressable style={[styles.actionRow, styles.actionRowLast]} onPress={handleDeleteAccount}>
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Delete Account</Text>
          </Pressable>
        </View>
      ) : SUPABASE_ENABLED ? (
        <Pressable
          style={styles.joinCard}
          onPress={() => router.push('/(auth)/login')}
        >
          <Ionicons name="log-in-outline" size={24} color={colors.primary} />
          <View style={styles.joinContent}>
            <Text style={styles.joinTitle}>Sign In</Text>
            <Text style={styles.joinText}>Sync your data and share with friends</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </Pressable>
      ) : (
        <View style={styles.infoCard}>
          <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Offline Mode</Text>
            <Text style={styles.infoText}>
              Your data is stored locally on this device.
            </Text>
          </View>
        </View>
      )}

      <Text style={styles.version}>FishDex v1.0.0</Text>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            <Text style={styles.modalText}>
              Enter your password to permanently delete your account and all of your personal data. This action cannot be undone.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Password"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={deletePassword}
              onChangeText={setDeletePassword}
              editable={!deleting}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={deleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={confirmDeleteAccount}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  name: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  groupCard: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  groupName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  inviteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  inviteLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  inviteCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  inviteCode: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 2,
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  membersLabel: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
  },
  memberEmail: {
    fontSize: fontSize.xs - 1,
    color: colors.textTertiary,
    marginTop: 1,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs + 2,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  memberName: {
    fontSize: fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  adminBadge: {
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  adminText: {
    fontSize: fontSize.xs,
    color: colors.accent,
    fontWeight: fontWeight.semibold,
  },
  joinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  joinContent: {
    flex: 1,
  },
  joinTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  joinText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  accountActions: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.surfaceLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.semibold,
  },
  modalDeleteButton: {
    backgroundColor: colors.error,
  },
  modalDeleteText: {
    fontSize: fontSize.md,
    color: '#fff',
    fontWeight: fontWeight.semibold,
  },
  actionText: {
    fontSize: fontSize.md,
    color: colors.text,
    fontWeight: fontWeight.medium,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  version: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xl,
  },
});
