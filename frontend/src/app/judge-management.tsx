import { API_BASE_URL } from '../constants/api';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type JudgeStatus = 'ACTIVE' | 'INACTIVE';

type Judge = {
  id: string; // PostgreSQL Judge primary key
  judgeId: string; // Display ID such as JG001
  name: string;
  email: string;
  matches: number;
  status: JudgeStatus;
};

const JUDGES_STORAGE_KEY = '@boxing_system_judges';

const AUTH_TOKEN_KEY = '@boxing_auth_token';

export default function JudgeManagementScreen() {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedFilter, setSelectedFilter] =
    useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);

  const [judgeName, setJudgeName] = useState('');
  const [judgeEmail, setJudgeEmail] = useState('');
  const [judgePassword, setJudgePassword] = useState('');

  useEffect(() => {
    loadJudges();
  }, []);

  const loadJudges = async () => {
    try {
      const token = await AsyncStorage.getItem(
        AUTH_TOKEN_KEY,
      );

      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }

      const response = await fetch(
        `${API_BASE_URL}/judges`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to load judges (${response.status})`,
        );
      }

      const backendJudges = Array.isArray(data?.judges)
        ? data.judges
        : [];

      const normalized: Judge[] = backendJudges.map(
        (judge: any) => ({
          id: String(judge.id),
          judgeId: String(judge.judgeId),
          name: String(judge.name),
          email: String(judge.email),
          matches: Number(judge.matches) || 0,
          status:
            judge.status === 'INACTIVE'
              ? 'INACTIVE'
              : 'ACTIVE',
        }),
      );

      setJudges(normalized);

      await AsyncStorage.setItem(
        JUDGES_STORAGE_KEY,
        JSON.stringify(normalized),
      );
    } catch (error) {
      console.log('Error loading judges:', error);
      Alert.alert(
        'LOAD ERROR',
        error instanceof Error
          ? error.message
          : 'Unable to load judges from the database.',
      );
      setJudges([]);
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingJudge(null);
    setJudgeName('');
    setJudgeEmail('');
    setJudgePassword('');
  };

  const openAddModal = () => {
    setEditingJudge(null);
    setJudgeName('');
    setJudgeEmail('');
    setJudgePassword('');
    setModalVisible(true);
  };

  const openEditModal = (judge: Judge) => {
    setEditingJudge(judge);
    setJudgeName(judge.name);
    setJudgeEmail(judge.email);
    setJudgePassword('');
    setModalVisible(true);
  };

  const handleSaveJudge = async () => {
    const name = judgeName.trim();
    const email = judgeEmail.trim().toLowerCase();
    const password = judgePassword.trim();

    if (!name) {
      Alert.alert('MISSING NAME', 'Please enter the judge name.');
      return;
    }

    if (!email) {
      Alert.alert('MISSING EMAIL', 'Please enter the judge email.');
      return;
    }

    if (!email.includes('@')) {
      Alert.alert('INVALID EMAIL', 'Please enter a valid email address.');
      return;
    }

    if (!editingJudge && password && password.length < 8) {
      Alert.alert(
        'PASSWORD TOO SHORT',
        'Password must contain at least 8 characters.',
      );
      return;
    }

    try {
      const token = await AsyncStorage.getItem(
        AUTH_TOKEN_KEY,
      );

      if (!token) {
        throw new Error(
          'Authentication token not found. Please login again.',
        );
      }

      const response = await fetch(
        editingJudge
          ? `${API_BASE_URL}/judges/${encodeURIComponent(
              editingJudge.id,
            )}`
          : `${API_BASE_URL}/judges`,
        {
          method: editingJudge ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            email,
            ...(password ? { password } : {}),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            `Failed to save judge (${response.status})`,
        );
      }

      closeModal();
      await loadJudges();

      if (editingJudge) {
        Alert.alert(
          'JUDGE UPDATED',
          `${name}'s details have been updated.`,
        );
      } else {
        const temporaryPassword =
          data?.login?.temporaryPassword;

        Alert.alert(
          'JUDGE ADDED',
          temporaryPassword
            ? `${name} has been registered.\n\nLogin email: ${email}\nTemporary password: ${temporaryPassword}`
            : `${name} has been registered successfully.`,
        );
      }
    } catch (error) {
      console.log('Save judge error:', error);
      Alert.alert(
        'SAVE FAILED',
        error instanceof Error
          ? error.message
          : 'Unable to save the judge.',
      );
    }
  };

  const toggleStatus = (judge: Judge) => {
    const newStatus: JudgeStatus =
      judge.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    Alert.alert(
      newStatus === 'ACTIVE'
        ? 'ACTIVATE JUDGE'
        : 'DEACTIVATE JUDGE',
      `Are you sure you want to ${
        newStatus === 'ACTIVE'
          ? 'activate'
          : 'deactivate'
      } ${judge.name}?`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'CONFIRM',
          onPress: async () => {
            try {
              const token =
                await AsyncStorage.getItem(
                  AUTH_TOKEN_KEY,
                );

              if (!token) {
                throw new Error(
                  'Authentication token not found. Please login again.',
                );
              }

              const response =
                await fetch(
                  `${API_BASE_URL}/judges/${encodeURIComponent(
                    judge.id,
                  )}`,
                  {
                    method: 'PUT',
                    headers: {
                      'Content-Type':
                        'application/json',
                      Authorization:
                        `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      status: newStatus,
                    }),
                  },
                );

              const data =
                await response.json();

              if (!response.ok) {
                throw new Error(
                  data?.message ||
                    'Failed to update judge status.',
                );
              }

              await loadJudges();
            } catch (error) {
              Alert.alert(
                'UPDATE FAILED',
                error instanceof Error
                  ? error.message
                  : 'Unable to update judge status.',
              );
            }
          },
        },
      ],
    );
  };

  const deleteJudge = (judge: Judge) => {
    Alert.alert(
      'DELETE JUDGE',
      `Are you sure you want to permanently delete ${judge.name}?`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: async () => {
            try {
              const token =
                await AsyncStorage.getItem(
                  AUTH_TOKEN_KEY,
                );

              if (!token) {
                throw new Error(
                  'Authentication token not found. Please login again.',
                );
              }

              const response =
                await fetch(
                  `${API_BASE_URL}/judges/${encodeURIComponent(
                    judge.id,
                  )}`,
                  {
                    method: 'DELETE',
                    headers: {
                      'Content-Type':
                        'application/json',
                      Authorization:
                        `Bearer ${token}`,
                    },
                  },
                );

              const data =
                await response.json();

              if (!response.ok) {
                throw new Error(
                  data?.message ||
                    'Failed to delete judge.',
                );
              }

              await loadJudges();
            } catch (error) {
              Alert.alert(
                'DELETE FAILED',
                error instanceof Error
                  ? error.message
                  : 'Unable to delete judge.',
              );
            }
          },
        },
      ],
    );
  };

  const filteredJudges = useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return judges.filter((judge) => {
      const filterOK =
        selectedFilter === 'ALL' || judge.status === selectedFilter;

      const searchOK =
        !search ||
        judge.name.toLowerCase().includes(search) ||
        judge.email.toLowerCase().includes(search) ||
        judge.judgeId.toLowerCase().includes(search);

      return filterOK && searchOK;
    });
  }, [judges, searchText, selectedFilter]);

  const activeCount = judges.filter(
    (judge) => judge.status === 'ACTIVE',
  ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>JUDGE MANAGEMENT</Text>
            <Text style={styles.subtitle}>
              {activeCount} active judges
            </Text>
          </View>

          <Pressable onPress={openAddModal} style={styles.addButton}>
            <Text style={styles.addText}>+ ADD</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statsRow}>
            <Stat value={judges.length} label="TOTAL" />
            <Stat value={activeCount} label="ACTIVE" green />
            <Stat
              value={judges.length - activeCount}
              label="INACTIVE"
              red
            />
          </View>

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search judge..."
              placeholderTextColor="#666"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {searchText.length > 0 && (
              <Pressable onPress={() => setSearchText('')}>
                <Text style={styles.clearText}>×</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.filters}>
            {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={[
                  styles.filter,
                  selectedFilter === filter && styles.filterActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedFilter === filter &&
                      styles.filterTextActive,
                  ]}
                >
                  {filter}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>JUDGES</Text>
            <Text style={styles.count}>
              {filteredJudges.length} FOUND
            </Text>
          </View>

          {filteredJudges.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>⌕</Text>
              <Text style={styles.emptyTitle}>NO JUDGES FOUND</Text>
            </View>
          ) : (
            filteredJudges.map((judge) => (
              <JudgeCard
                key={judge.id}
                judge={judge}
                onEdit={() => openEditModal(judge)}
                onToggle={() => toggleStatus(judge)}
                onDelete={() => deleteJudge(judge)}
              />
            ))
          )}
        </ScrollView>

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingJudge ? 'EDIT JUDGE' : 'ADD JUDGE'}
                  </Text>

                  <Text style={styles.modalSubtitle}>
                    {editingJudge
                      ? 'Update judge information'
                      : 'Register a new judge'}
                  </Text>
                </View>

                <Pressable
                  onPress={closeModal}
                  style={styles.modalClose}
                >
                  <Text style={styles.modalCloseText}>×</Text>
                </Pressable>
              </View>

              {editingJudge && (
                <View style={styles.idBox}>
                  <Text style={styles.idLabel}>JUDGE ID</Text>
                  <Text style={styles.idValue}>{editingJudge.judgeId}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>JUDGE NAME</Text>

              <TextInput
                value={judgeName}
                onChangeText={setJudgeName}
                placeholder="Enter judge name"
                placeholderTextColor="#666"
                style={styles.modalInput}
                autoCapitalize="words"
              />

              <Text style={styles.inputLabel}>EMAIL</Text>

              <TextInput
                value={judgeEmail}
                onChangeText={setJudgeEmail}
                placeholder="Enter email address"
                placeholderTextColor="#666"
                style={styles.modalInput}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>
                {editingJudge
                  ? 'NEW PASSWORD (OPTIONAL)'
                  : 'PASSWORD (OPTIONAL)'}
              </Text>

              <TextInput
                value={judgePassword}
                onChangeText={setJudgePassword}
                placeholder={
                  editingJudge
                    ? 'Leave blank to keep current password'
                    : 'Leave blank for Judge@12345'
                }
                placeholderTextColor="#666"
                style={styles.modalInput}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeModal}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>CANCEL</Text>
                </Pressable>

                <Pressable
                  onPress={handleSaveJudge}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveText}>
                    {editingJudge ? 'SAVE CHANGES' : 'ADD JUDGE'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function Stat({
  value,
  label,
  green,
  red,
}: {
  value: number;
  label: string;
  green?: boolean;
  red?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[
          styles.statNumber,
          green && styles.green,
          red && styles.red,
        ]}
      >
        {value}
      </Text>

      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function JudgeCard({
  judge,
  onEdit,
  onToggle,
  onDelete,
}: {
  judge: Judge;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const active = judge.status === 'ACTIVE';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {getInitials(judge.name)}
          </Text>
        </View>

        <View style={styles.judgeInfo}>
          <Text style={styles.judgeName}>{judge.name}</Text>

          <Text style={styles.judgeId}>{judge.judgeId}</Text>

          <Text style={styles.email}>{judge.email}</Text>
        </View>

        <View
          style={[
            styles.status,
            active
              ? styles.activeStatus
              : styles.inactiveStatus,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              active
                ? styles.activeText
                : styles.inactiveText,
            ]}
          >
            {judge.status}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <Text style={styles.matches}>
          {judge.matches} MATCHES
        </Text>

        <Pressable onPress={onEdit} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>EDIT</Text>
        </Pressable>

        <Pressable onPress={onToggle} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>
            {active ? 'DEACTIVATE' : 'ACTIVATE'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onDelete}
          style={[styles.smallButton, styles.deleteButton]}
        >
          <Text style={styles.deleteText}>DELETE</Text>
        </Pressable>
      </View>
    </View>
  );
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/);

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#080808',
  },

  container: {
    flex: 1,
    backgroundColor: '#080808',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1d1d1d',
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#252525',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  backIcon: {
    color: '#fff',
    fontSize: 35,
    lineHeight: 38,
    fontWeight: '300',
    marginTop: -3,
  },

  headerText: {
    flex: 1,
  },

  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  subtitle: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
  },

  addButton: {
    backgroundColor: '#E53935',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  addText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  statsRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },

  stat: {
    flex: 1,
    backgroundColor: '#121212',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#222',
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 4,
  },

  statNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },

  statLabel: {
    color: '#666',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },

  green: {
    color: '#55d88a',
  },

  red: {
    color: '#ff6464',
  },

  searchBox: {
    height: 50,
    backgroundColor: '#121212',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252525',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  searchIcon: {
    color: '#777',
    fontSize: 25,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
  },

  clearText: {
    color: '#777',
    fontSize: 25,
  },

  filters: {
    flexDirection: 'row',
    marginVertical: 15,
  },

  filter: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#252525',
    backgroundColor: '#131313',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },

  filterActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },

  filterText: {
    color: '#777',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  filterTextActive: {
    color: '#080808',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  sectionTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },

  count: {
    color: '#555',
    fontSize: 9,
    fontWeight: '700',
  },

  card: {
    backgroundColor: '#111',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#242424',
    padding: 15,
    marginBottom: 11,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },

  judgeInfo: {
    flex: 1,
  },

  judgeName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  judgeId: {
    color: '#666',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 3,
  },

  email: {
    color: '#777',
    fontSize: 9,
    marginTop: 3,
  },

  status: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },

  activeStatus: {
    backgroundColor: '#102219',
    borderColor: '#214d34',
  },

  inactiveStatus: {
    backgroundColor: '#241313',
    borderColor: '#4b2222',
  },

  statusText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  activeText: {
    color: '#55d88a',
  },

  inactiveText: {
    color: '#ff6464',
  },

  divider: {
    height: 1,
    backgroundColor: '#202020',
    marginVertical: 13,
  },

  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  matches: {
    flex: 1,
    color: '#666',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  smallButton: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 7,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginLeft: 6,
  },

  smallButtonText: {
    color: '#bbb',
    fontSize: 7,
    fontWeight: '900',
  },

  deleteButton: {
    borderColor: '#4b2222',
    backgroundColor: '#241313',
  },

  deleteText: {
    color: '#ff6464',
    fontSize: 7,
    fontWeight: '900',
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 70,
  },

  emptyIcon: {
    color: '#555',
    fontSize: 30,
    marginBottom: 15,
  },

  emptyTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  modal: {
    backgroundColor: '#111',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#292929',
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
  },

  modalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  modalSubtitle: {
    color: '#666',
    fontSize: 10,
    marginTop: 5,
  },

  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#1c1c1c',
    borderWidth: 1,
    borderColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalCloseText: {
    color: '#aaa',
    fontSize: 24,
    lineHeight: 27,
  },

  idBox: {
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#282828',
    borderRadius: 10,
    padding: 11,
    marginBottom: 16,
  },

  idLabel: {
    color: '#555',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
  },

  idValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },

  inputLabel: {
    color: '#888',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 7,
  },

  modalInput: {
    height: 48,
    backgroundColor: '#181818',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#292929',
    color: '#fff',
    paddingHorizontal: 13,
    fontSize: 12,
    marginBottom: 16,
  },

  modalActions: {
    flexDirection: 'row',
    marginTop: 4,
  },

  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#181818',
    borderWidth: 1,
    borderColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },

  cancelText: {
    color: '#888',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  saveButton: {
    flex: 1.3,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },

  saveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});