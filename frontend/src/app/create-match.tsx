import { API_BASE_URL } from '../constants/api';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateTournamentMatch } from '../constants/storage';

const MATCHES_STORAGE_KEY =
  '@boxing_system_assigned_matches';



const AUTH_TOKEN_KEY =
  '@boxing_auth_token';

function normalizeBoxerName(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[.,]/g, '')
    .trim()
    .toUpperCase();
}

type Judge = {
  id: string;
  judgeId: string;
  name: string;
  email: string;
  matches: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type Boxer = {
  id: string;
  boxerId: string;
  name: string;
  dateOfBirth: string;
  weight: number;
  club: string;
  coach: string;
  stance: string;
  status: 'ACTIVE' | 'INACTIVE';
};

type AssignedMatch = {
  id: string;

  redBoxer: string;
  blueBoxer: string;

  weightCategory: string;
  rounds: number;
  matchType: string;

  judgeIds: string[];
  judgeNames: string[];

  tournamentId?: string;
  tournamentMatchId?: string;

  judgeId?: string;
  judgeName?: string;

  status: 'UPCOMING' | 'LIVE' | 'COMPLETED';

  date: string;
  time: string;
};

export default function CreateMatchScreen() {
  /*
   * Tournament parameters sent from
   * Tournament Management.
   */
  const {
    tournamentId,
    tournamentMatchId,
    redBoxer: tournamentRedBoxer,
    blueBoxer: tournamentBlueBoxer,
    weightCategory: tournamentWeightCategory,
    rounds: tournamentRounds,
    matchType: tournamentMatchType,
  } = useLocalSearchParams<{
    tournamentId?: string;
    tournamentMatchId?: string;
    redBoxer?: string;
    blueBoxer?: string;
    weightCategory?: string;
    rounds?: string;
    matchType?: string;
  }>();

  const [redBoxer, setRedBoxer] = useState('');
  const [blueBoxer, setBlueBoxer] = useState('');

  const [weightCategory, setWeightCategory] =
    useState('Lightweight');

  const [rounds, setRounds] = useState(3);

  const [matchType, setMatchType] =
    useState('Tournament');

  const [judges, setJudges] =
    useState<Judge[]>([]);

  const [boxers, setBoxers] =
    useState<Boxer[]>([]);

  const [selectedJudges, setSelectedJudges] =
    useState<Array<Judge | null>>([
      null,
      null,
      null,
      null,
    ]);

  const [judgeModalVisible, setJudgeModalVisible] =
    useState(false);

  const [activeJudgeSlot, setActiveJudgeSlot] =
    useState<number | null>(null);

  const [loadingData, setLoadingData] =
    useState(true);

  const [startingMatch, setStartingMatch] =
    useState(false);

  const weightCategories = [
    'Flyweight',
    'Bantamweight',
    'Featherweight',
    'Lightweight',
    'Welterweight',
    'Middleweight',
    'Heavyweight',
  ];

  /*
   * -----------------------------------------
   * LOAD DATABASE DATA
   * -----------------------------------------
   */

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);

      const token =
        await AsyncStorage.getItem(
          AUTH_TOKEN_KEY,
        );

      if (!token) {
        Alert.alert(
          'AUTHENTICATION ERROR',
          'Please login again.',
          [{ text: 'OK' }],
        );
        return;
      }

      const headers = {
        'Content-Type':
          'application/json',
        Authorization:
          `Bearer ${token}`,
      };

      /*
       * LOAD JUDGES
       */

      const judgesResponse =
        await fetch(
          `${API_BASE_URL}/judges`,
          {
            method: 'GET',
            headers,
          },
        );

      const judgesData =
        await judgesResponse.json();

      if (!judgesResponse.ok) {
        throw new Error(
          judgesData?.message ||
            'Failed to load judges',
        );
      }

      const activeJudges =
        Array.isArray(judgesData.judges)
          ? judgesData.judges.filter(
              (judge: Judge) =>
                judge.status === 'ACTIVE',
            )
          : [];

      setJudges(activeJudges);

      /*
       * LOAD BOXERS
       */

      const boxersResponse =
        await fetch(
          `${API_BASE_URL}/boxers`,
          {
            method: 'GET',
            headers,
          },
        );

      const boxersData =
        await boxersResponse.json();

      if (!boxersResponse.ok) {
        throw new Error(
          boxersData?.message ||
            'Failed to load boxers',
        );
      }

      const activeBoxers =
        Array.isArray(boxersData.boxers)
          ? boxersData.boxers.filter(
              (boxer: Boxer) =>
                boxer.status === 'ACTIVE',
            )
          : [];

      setBoxers(activeBoxers);

      console.log(
        'Active judges loaded:',
        activeJudges,
      );

      console.log(
        'Active boxers loaded:',
        activeBoxers,
      );
    } catch (error) {
      console.error(
        'Create Match loading error:',
        error,
      );

      Alert.alert(
        'LOAD ERROR',
        error instanceof Error
          ? error.message
          : 'Failed to load judges and boxers.',
        [{ text: 'OK' }],
      );
    } finally {
      setLoadingData(false);
    }
  };

  /*
   * -----------------------------------------
   * AUTO-FILL TOURNAMENT MATCH
   * -----------------------------------------
   */

  useEffect(() => {
    if (tournamentRedBoxer) {
      setRedBoxer(tournamentRedBoxer);
    }

    if (tournamentBlueBoxer) {
      setBlueBoxer(tournamentBlueBoxer);
    }

    if (tournamentWeightCategory) {
      setWeightCategory(
        tournamentWeightCategory,
      );
    }

    if (tournamentRounds) {
      const parsedRounds =
        Number(tournamentRounds);

      if (
        Number.isFinite(parsedRounds) &&
        [3, 4, 6, 8, 10, 12].includes(
          parsedRounds,
        )
      ) {
        setRounds(parsedRounds);
      }
    }

    if (tournamentMatchType) {
      setMatchType(tournamentMatchType);
    } else if (
      tournamentRedBoxer ||
      tournamentBlueBoxer ||
      tournamentWeightCategory
    ) {
      setMatchType('Tournament');
    }
  }, [
    tournamentRedBoxer,
    tournamentBlueBoxer,
    tournamentWeightCategory,
    tournamentRounds,
    tournamentMatchType,
  ]);

  /*
   * -----------------------------------------
   * JUDGE SELECTION
   * -----------------------------------------
   */

  const openJudgeSelector = (
    slot: number,
  ) => {
    setActiveJudgeSlot(slot);
    setJudgeModalVisible(true);
  };

  const handleJudgeSelect = (
    judge: Judge,
  ) => {
    if (activeJudgeSlot === null) {
      return;
    }

    const alreadyAssigned =
      selectedJudges.some(
        (selected, index) =>
          index !== activeJudgeSlot &&
          selected?.id === judge.id,
      );

    if (alreadyAssigned) {
      Alert.alert(
        'JUDGE ALREADY ASSIGNED',
        'This judge is already assigned to another position.',
        [{ text: 'OK' }],
      );
      return;
    }

    setSelectedJudges(
      (current) => {
        const updated = [...current];

        updated[activeJudgeSlot] =
          judge;

        return updated;
      },
    );

    setJudgeModalVisible(false);
    setActiveJudgeSlot(null);
  };

  const assignedJudgeCount =
    selectedJudges.filter(
      Boolean,
    ).length;

  const availableJudges =
    judges.filter(
      (judge) =>
        !selectedJudges.some(
          (selected, index) =>
            index !== activeJudgeSlot &&
            selected?.id === judge.id,
        ),
    );

  /*
   * -----------------------------------------
   * LOCAL MATCH CACHE
   * -----------------------------------------
   */

  const saveAssignedMatch = async (
    match: AssignedMatch,
  ) => {
    try {
      const storedMatches =
        await AsyncStorage.getItem(
          MATCHES_STORAGE_KEY,
        );

      let existingMatches:
        AssignedMatch[] = [];

      if (storedMatches) {
        try {
          const parsedMatches =
            JSON.parse(
              storedMatches,
            );

          if (
            Array.isArray(parsedMatches)
          ) {
            existingMatches =
              parsedMatches;
          }
        } catch {
          existingMatches = [];
        }
      }

      const updatedMatches = [
        match,
        ...existingMatches,
      ];

      await AsyncStorage.setItem(
        MATCHES_STORAGE_KEY,
        JSON.stringify(
          updatedMatches,
        ),
      );

      console.log(
        'Local match cache updated:',
        match,
      );
    } catch (error) {
      console.log(
        'Error saving local match:',
        error,
      );
    }
  };

  /*
   * -----------------------------------------
   * START MATCH
   * -----------------------------------------
   */

  const handleStartMatch =
    async () => {
      if (startingMatch) {
        return;
      }

      if (!redBoxer || !blueBoxer) {
        Alert.alert(
          'SELECT BOXERS',
          'Please select one boxer for the Red Corner and one boxer for the Blue Corner.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (redBoxer === blueBoxer) {
        Alert.alert(
          'INVALID MATCH',
          'The same boxer cannot be selected for both corners.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (assignedJudgeCount !== 4) {
        Alert.alert(
          'ASSIGN 4 JUDGES',
          `Please assign all 4 judges before starting the match.\n\n${assignedJudgeCount}/4 judges assigned.`,
          [{ text: 'OK' }],
        );
        return;
      }

      /*
       * FIND REAL DATABASE BOXERS
       */

      const normalizedRedBoxer =
        normalizeBoxerName(redBoxer);
      const normalizedBlueBoxer =
        normalizeBoxerName(blueBoxer);

      const redBoxerData =
        boxers.find(
          (boxer) =>
            normalizeBoxerName(boxer.name) ===
            normalizedRedBoxer,
        );

      const blueBoxerData =
        boxers.find(
          (boxer) =>
            normalizeBoxerName(boxer.name) ===
            normalizedBlueBoxer,
        );

      if (
        !redBoxerData ||
        !blueBoxerData
      ) {
        const missingBoxers = [
          !redBoxerData ? `Red: ${redBoxer}` : '',
          !blueBoxerData ? `Blue: ${blueBoxer}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        Alert.alert(
          'BOXER ERROR',
          `The tournament boxer could not be matched with a registered boxer.\n\n${missingBoxers}\n\nMake sure the boxer is registered in Boxer Management with the same name as the tournament draw.`,
          [{ text: 'OK' }],
        );
        return;
      }

      /*
       * GET THE 4 SELECTED JUDGES
       */

      const assignedJudges =
        selectedJudges.filter(
          (
            judge,
          ): judge is Judge =>
            judge !== null,
        );

      const databaseJudgeIds =
        assignedJudges.map(
          (judge) => judge.id,
        );

      if (
        databaseJudgeIds.length !== 4
      ) {
        Alert.alert(
          'JUDGE ERROR',
          'Exactly 4 judges are required.',
          [{ text: 'OK' }],
        );
        return;
      }

      /*
       * VERIFY THAT ALL JUDGES ARE DIFFERENT
       */

      const uniqueJudgeIds =
        new Set(
          databaseJudgeIds,
        );

      if (
        uniqueJudgeIds.size !== 4
      ) {
        Alert.alert(
          'JUDGE ERROR',
          'The same judge cannot be assigned more than once.',
          [{ text: 'OK' }],
        );
        return;
      }

      try {
        setStartingMatch(true);

        /*
         * GET AUTH TOKEN
         */

        const token =
          await AsyncStorage.getItem(
            AUTH_TOKEN_KEY,
          );

        if (!token) {
          Alert.alert(
            'AUTHENTICATION ERROR',
            'Your login session has expired. Please login again.',
            [{ text: 'OK' }],
          );
          return;
        }

        /*
         * CREATE REAL MATCH
         * IN POSTGRESQL
         */

        const response =
          await fetch(
            `${API_BASE_URL}/matches`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                tournamentId:
                  tournamentId ||
                  undefined,

                redBoxerId:
                  redBoxerData.id,

                blueBoxerId:
                  blueBoxerData.id,

                weightCategory,

                rounds,

                matchType,

                judgeIds:
                  databaseJudgeIds,
              }),
            },
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              'Failed to create match',
          );
        }

        if (!data.match) {
          throw new Error(
            'Match was created but no match data was returned.',
          );
        }

        /*
         * THIS IS THE REAL DATABASE
         * MATCH ID
         */

        const databaseMatchId =
          String(data.match.id);

        /*
         * -----------------------------------------
         * LINK TOURNAMENT BOUT TO DATABASE MATCH
         * -----------------------------------------
         *
         * Only tournament-created matches have
         * tournamentId + tournamentMatchId.
         *
         * We save the real PostgreSQL Match ID
         * into the tournament bracket.
         */

        if (
          tournamentId &&
          tournamentMatchId
        ) {
          try {
            const updatedTournament =
              await updateTournamentMatch(
                String(tournamentId),
                String(tournamentMatchId),
                {
                  scoringMatchId:
                    databaseMatchId,
                  status: 'LIVE',
                },
              );

            if (!updatedTournament) {
              console.warn(
                'Tournament match was created in PostgreSQL, but the tournament bracket could not be updated.',
              );
            } else {
              console.log(
                'Tournament match linked to PostgreSQL match:',
                {
                  tournamentId:
                    tournamentId,
                  tournamentMatchId:
                    tournamentMatchId,
                  scoringMatchId:
                    databaseMatchId,
                },
              );
            }
          } catch (error) {
            /*
             * Do not block the actual match from
             * starting if local tournament sync
             * fails.
             */
            console.error(
              'Tournament bracket sync error:',
              error,
            );
          }
        }

        const now = new Date();

        /*
         * SAVE LOCAL CACHE
         */

        const newMatch:
          AssignedMatch = {
          id: databaseMatchId,

          redBoxer,

          blueBoxer,

          weightCategory,

          rounds,

          matchType,

          judgeIds:
            databaseJudgeIds,

          judgeNames:
            assignedJudges.map(
              (judge) =>
                judge.name,
            ),

          judgeId:
            databaseJudgeIds[0],

          judgeName:
            assignedJudges[0].name,

          tournamentId:
            tournamentId ||
            undefined,

          tournamentMatchId:
            tournamentMatchId ||
            undefined,

          status: 'LIVE',

          date:
            now.toLocaleDateString(),

          time:
            now.toLocaleTimeString(
              [],
              {
                hour: '2-digit',
                minute: '2-digit',
              },
            ),
        };

        await saveAssignedMatch(
          newMatch,
        );

        console.log(
          '================================',
        );

        console.log(
          'MATCH CREATED IN POSTGRESQL',
        );

        console.log(
          'Database Match ID:',
          databaseMatchId,
        );

        console.log(
          'Tournament ID:',
          tournamentId || 'None',
        );

        console.log(
          'Tournament Match ID:',
          tournamentMatchId || 'None',
        );

        console.log(
          'Red Boxer ID:',
          redBoxerData.id,
        );

        console.log(
          'Blue Boxer ID:',
          blueBoxerData.id,
        );

        console.log(
          'Judge IDs:',
          databaseJudgeIds,
        );

        console.log(
          '================================',
        );

        /*
         * GO TO LIVE SCORING
         */

        router.push({
          pathname:
            '/live-scoring',

          params: {
            matchId:
              databaseMatchId,

            redBoxer,

            blueBoxer,

            weightCategory,

            rounds:
              rounds.toString(),

            matchType,

            tournamentId:
              tournamentId || '',

            tournamentMatchId:
              tournamentMatchId || '',
          },
        });
      } catch (error) {
        console.error(
          'Start match error:',
          error,
        );

        Alert.alert(
          'START MATCH FAILED',
          error instanceof Error
            ? error.message
            : 'Failed to create the match.',
          [{ text: 'OK' }],
        );
      } finally {
        setStartingMatch(false);
      }
    };

  /*
   * -----------------------------------------
   * BOXER SELECTION
   * -----------------------------------------
   */

  const handleRedBoxerSelect =
    (boxer: string) => {
      if (boxer === blueBoxer) {
        Alert.alert(
          'BOXER ALREADY SELECTED',
          'This boxer is already selected in the Blue Corner.',
          [{ text: 'OK' }],
        );
        return;
      }

      setRedBoxer(boxer);
    };

  const handleBlueBoxerSelect =
    (boxer: string) => {
      if (boxer === redBoxer) {
        Alert.alert(
          'BOXER ALREADY SELECTED',
          'This boxer is already selected in the Red Corner.',
          [{ text: 'OK' }],
        );
        return;
      }

      setBlueBoxer(boxer);
    };

  /*
   * -----------------------------------------
   * LOADING SCREEN
   * -----------------------------------------
   */

  if (loadingData) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color="#E53935"
          />

          <Text
            style={styles.loadingTitle}
          >
            LOADING MATCH DATA
          </Text>

          <Text
            style={styles.loadingText}
          >
            Loading boxers and judges...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * -----------------------------------------
   * MAIN UI
   * -----------------------------------------
   */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* HEADER */}

        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={styles.backText}
            >
              ‹
            </Text>
          </Pressable>

          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text
              style={styles.headerSmall}
            >
              TOURNAMENT
            </Text>

            <Text
              style={styles.headerTitle}
            >
              Create Match
            </Text>
          </View>

          <View
            style={styles.headerSpacer}
          />
        </View>

        {/* MATCH TYPE */}

        <Text
          style={styles.sectionTitle}
        >
          MATCH TYPE
        </Text>

        <View
          style={styles.typeRow}
        >
          <Pressable
            style={({ pressed }) => [
              styles.typeButton,
              matchType ===
                'Tournament' &&
                styles.typeButtonActive,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              setMatchType(
                'Tournament',
              )
            }
          >
            <Text
              style={[
                styles.typeText,
                matchType ===
                  'Tournament' &&
                  styles.typeTextActive,
              ]}
            >
              Tournament
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.typeButton,
              matchType ===
                'Exhibition' &&
                styles.typeButtonActive,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={() =>
              setMatchType(
                'Exhibition',
              )
            }
          >
            <Text
              style={[
                styles.typeText,
                matchType ===
                  'Exhibition' &&
                  styles.typeTextActive,
              ]}
            >
              Exhibition
            </Text>
          </Pressable>
        </View>

        {/* RED CORNER */}

        <Text
          style={styles.sectionTitle}
        >
          RED CORNER
        </Text>

        <View
          style={styles.boxerCard}
        >
          <View
            style={styles.cornerHeader}
          >
            <View
              style={[
                styles.cornerIcon,
                styles.redBackground,
              ]}
            >
              <Text
                style={styles.cornerLetter}
              >
                R
              </Text>
            </View>

            <View
              style={styles.cornerInfo}
            >
              <Text
                style={styles.cornerTitle}
              >
                RED CORNER
              </Text>

              <Text
                style={
                  styles.cornerSubtitle
                }
              >
                {tournamentRedBoxer
                  ? 'Tournament boxer'
                  : 'Select boxer'}
              </Text>
            </View>
          </View>

          <View
            style={styles.boxerList}
          >
            {(tournamentRedBoxer ? [redBoxer].filter(Boolean) : boxers.map((boxer) => boxer.name)).length === 0 ? (
              <Text
                style={
                  styles.emptyDataText
                }
              >
                No active boxers found.
              </Text>
            ) : (
              (tournamentRedBoxer
                ? boxers.filter(
                    (boxer) =>
                      normalizeBoxerName(boxer.name) ===
                      normalizeBoxerName(tournamentRedBoxer),
                  )
                : boxers
              ).map((boxer) => (
                <Pressable
                  key={boxer.id}
                  style={({
                    pressed,
                  }) => [
                    styles.boxerOption,
                    redBoxer ===
                      boxer.name &&
                      styles.redSelected,
                    pressed &&
                      styles.buttonPressed,
                  ]}
                  onPress={() =>
                    handleRedBoxerSelect(
                      boxer.name,
                    )
                  }
                >
                  <View
                    style={[
                      styles.avatar,
                      styles.redAvatar,
                    ]}
                  >
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {boxer.name.charAt(
                        0,
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.boxerName
                    }
                  >
                    {boxer.name}
                  </Text>

                  {redBoxer ===
                    boxer.name && (
                    <Text
                      style={
                        styles.check
                      }
                    >
                      ✓
                    </Text>
                  )}
                </Pressable>
              ))
            )}
          </View>

          {tournamentRedBoxer &&
            !boxers.some(
              (boxer) =>
                boxer.name ===
                tournamentRedBoxer,
            ) && (
              <View
                style={
                  styles.tournamentBoxerNotice
                }
              >
                <View
                  style={[
                    styles.avatar,
                    styles.redAvatar,
                  ]}
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    {tournamentRedBoxer
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View
                  style={
                    styles.tournamentBoxerNoticeInfo
                  }
                >
                  <Text
                    style={
                      styles.tournamentBoxerNoticeTitle
                    }
                  >
                    {tournamentRedBoxer}
                  </Text>

                  <Text
                    style={
                      styles.tournamentBoxerNoticeText
                    }
                  >
                    Tournament boxer • automatically selected
                  </Text>
                </View>

                <Text
                  style={styles.check}
                >
                  ✓
                </Text>
              </View>
            )}
        </View>

        {/* VS */}

        <View
          style={styles.vsContainer}
        >
          <View
            style={styles.vsLine}
          />

          <View
            style={styles.vsCircle}
          >
            <Text
              style={styles.vsText}
            >
              VS
            </Text>
          </View>

          <View
            style={styles.vsLine}
          />
        </View>

        {/* BLUE CORNER */}

        <Text
          style={styles.sectionTitle}
        >
          BLUE CORNER
        </Text>

        <View
          style={styles.boxerCard}
        >
          <View
            style={styles.cornerHeader}
          >
            <View
              style={[
                styles.cornerIcon,
                styles.blueBackground,
              ]}
            >
              <Text
                style={styles.cornerLetter}
              >
                B
              </Text>
            </View>

            <View
              style={styles.cornerInfo}
            >
              <Text
                style={styles.cornerTitle}
              >
                BLUE CORNER
              </Text>

              <Text
                style={
                  styles.cornerSubtitle
                }
              >
                {tournamentBlueBoxer
                  ? 'Tournament boxer'
                  : 'Select boxer'}
              </Text>
            </View>
          </View>

          <View
            style={styles.boxerList}
          >
            {(tournamentBlueBoxer
              ? boxers.filter(
                  (boxer) =>
                    normalizeBoxerName(boxer.name) ===
                    normalizeBoxerName(tournamentBlueBoxer),
                )
              : boxers
            ).length === 0 ? (
              <Text
                style={
                  styles.emptyDataText
                }
              >
                No active boxers found.
              </Text>
            ) : (
              (tournamentBlueBoxer
                ? boxers.filter(
                    (boxer) =>
                      normalizeBoxerName(boxer.name) ===
                      normalizeBoxerName(tournamentBlueBoxer),
                  )
                : boxers
              ).map((boxer) => (
                <Pressable
                  key={boxer.id}
                  style={({
                    pressed,
                  }) => [
                    styles.boxerOption,
                    blueBoxer ===
                      boxer.name &&
                      styles.blueSelected,
                    pressed &&
                      styles.buttonPressed,
                  ]}
                  onPress={() =>
                    handleBlueBoxerSelect(
                      boxer.name,
                    )
                  }
                >
                  <View
                    style={[
                      styles.avatar,
                      styles.blueAvatar,
                    ]}
                  >
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {boxer.name.charAt(
                        0,
                      )}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.boxerName
                    }
                  >
                    {boxer.name}
                  </Text>

                  {blueBoxer ===
                    boxer.name && (
                    <Text
                      style={
                        styles.check
                      }
                    >
                      ✓
                    </Text>
                  )}
                </Pressable>
              ))
            )}
          </View>

          {tournamentBlueBoxer &&
            !boxers.some(
              (boxer) =>
                boxer.name ===
                tournamentBlueBoxer,
            ) && (
              <View
                style={
                  styles.tournamentBoxerNotice
                }
              >
                <View
                  style={[
                    styles.avatar,
                    styles.blueAvatar,
                  ]}
                >
                  <Text
                    style={
                      styles.avatarText
                    }
                  >
                    {tournamentBlueBoxer
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View
                  style={
                    styles.tournamentBoxerNoticeInfo
                  }
                >
                  <Text
                    style={
                      styles.tournamentBoxerNoticeTitle
                    }
                  >
                    {tournamentBlueBoxer}
                  </Text>

                  <Text
                    style={
                      styles.tournamentBoxerNoticeText
                    }
                  >
                    Tournament boxer • automatically selected
                  </Text>
                </View>

                <Text
                  style={styles.check}
                >
                  ✓
                </Text>
              </View>
            )}
        </View>

        {/* WEIGHT CATEGORY */}

        <Text
          style={styles.sectionTitle}
        >
          WEIGHT CATEGORY
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          style={
            styles.horizontalScroll
          }
          contentContainerStyle={
            styles.horizontalContent
          }
        >
          {weightCategories.map(
            (category) => (
              <Pressable
                key={category}
                style={({
                  pressed,
                }) => [
                  styles.weightButton,
                  weightCategory ===
                    category &&
                    styles.weightButtonActive,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={() =>
                  setWeightCategory(
                    category,
                  )
                }
              >
                <Text
                  style={[
                    styles.weightText,
                    weightCategory ===
                      category &&
                      styles.weightTextActive,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>

        {/* ROUNDS */}

        <Text
          style={styles.sectionTitle}
        >
          NUMBER OF ROUNDS
        </Text>

        <View
          style={
            styles.roundsContainer
          }
        >
          {[3, 4, 6, 8, 10, 12].map(
            (number) => (
              <Pressable
                key={number}
                style={({
                  pressed,
                }) => [
                  styles.roundButton,
                  rounds === number &&
                    styles.roundButtonActive,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={() =>
                  setRounds(number)
                }
              >
                <Text
                  style={[
                    styles.roundText,
                    rounds === number &&
                      styles.roundTextActive,
                  ]}
                >
                  {number}
                </Text>

                <Text
                  style={[
                    styles.roundLabel,
                    rounds === number &&
                      styles.roundLabelActive,
                  ]}
                >
                  ROUNDS
                </Text>
              </Pressable>
            ),
          )}
        </View>

        {/* ASSIGN 4 JUDGES */}

        <Text
          style={styles.sectionTitle}
        >
          ASSIGN JUDGES
        </Text>

        <View
          style={styles.judgeCard}
        >
          <View
            style={styles.judgeHeader}
          >
            <View
              style={styles.judgeIcon}
            >
              <Text
                style={
                  styles.judgeIconText
                }
              >
                4
              </Text>
            </View>

            <View
              style={
                styles.judgeHeaderInfo
              }
            >
              <Text
                style={styles.judgeTitle}
              >
                FOUR JUDGE PANEL
              </Text>

              <Text
                style={
                  styles.judgeSubtitle
                }
              >
                Assign one judge to each
                position
              </Text>
            </View>
          </View>

          <View
            style={styles.judgeList}
          >
            {selectedJudges.map(
              (judge, index) => (
                <Pressable
                  key={`judge-slot-${index}`}
                  style={({
                    pressed,
                  }) => [
                    styles.judgeSlot,
                    judge &&
                      styles.judgeSlotSelected,
                    pressed &&
                      styles.buttonPressed,
                  ]}
                  onPress={() =>
                    openJudgeSelector(
                      index,
                    )
                  }
                >
                  <View
                    style={
                      styles.judgeSlotNumber
                    }
                  >
                    <Text
                      style={
                        styles.judgeSlotNumberText
                      }
                    >
                      {index + 1}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.judgeOptionInfo
                    }
                  >
                    <Text
                      style={
                        styles.judgeSlotLabel
                      }
                    >
                      JUDGE {index + 1}
                    </Text>

                    <Text
                      style={[
                        styles.judgeName,
                        !judge &&
                          styles.judgeNotSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {judge
                        ? judge.name
                        : 'SELECT JUDGE'}
                    </Text>

                    <Text
                      style={
                        styles.judgeId
                      }
                    >
                      {judge
                        ? `${judge.judgeId} • ${judge.matches} matches`
                        : 'Tap to assign'}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.judgeSlotArrow,
                      judge &&
                        styles.judgeSlotArrowSelected,
                    ]}
                  >
                    {judge
                      ? '✓'
                      : '›'}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          <View
            style={[
              styles.judgeAssignmentStatus,
              assignedJudgeCount === 4 &&
                styles.judgeAssignmentStatusComplete,
            ]}
          >
            <Text
              style={
                styles.judgeAssignmentLabel
              }
            >
              JUDGES ASSIGNED
            </Text>

            <Text
              style={
                styles.judgeAssignmentCount
              }
            >
              {assignedJudgeCount}/4
            </Text>
          </View>
        </View>

        {/* JUDGE SELECTION MODAL */}

        <Modal
          visible={judgeModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setJudgeModalVisible(
              false,
            );
            setActiveJudgeSlot(
              null,
            );
          }}
        >
          <View
            style={styles.modalOverlay}
          >
            <View
              style={styles.judgeModal}
            >
              <View
                style={styles.modalHeader}
              >
                <View>
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    SELECT JUDGE
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    Position{' '}
                    {activeJudgeSlot !==
                    null
                      ? activeJudgeSlot +
                        1
                      : ''}{' '}
                    • Active judges only
                  </Text>
                </View>

                <Pressable
                  style={
                    styles.modalCloseButton
                  }
                  onPress={() => {
                    setJudgeModalVisible(
                      false,
                    );
                    setActiveJudgeSlot(
                      null,
                    );
                  }}
                >
                  <Text
                    style={
                      styles.modalCloseText
                    }
                  >
                    ×
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.modalList
                }
              >
                {availableJudges.length ===
                0 ? (
                  <Text
                    style={
                      styles.noJudgeText
                    }
                  >
                    No available active
                    judges.
                  </Text>
                ) : (
                  availableJudges.map(
                    (judge) => (
                      <Pressable
                        key={judge.id}
                        style={({
                          pressed,
                        }) => [
                          styles.modalJudgeOption,

                          activeJudgeSlot !==
                            null &&
                            selectedJudges[
                              activeJudgeSlot
                            ]?.id ===
                              judge.id &&
                            styles.modalJudgeSelected,

                          pressed &&
                            styles.buttonPressed,
                        ]}
                        onPress={() =>
                          handleJudgeSelect(
                            judge,
                          )
                        }
                      >
                        <View
                          style={
                            styles.judgeAvatar
                          }
                        >
                          <Text
                            style={
                              styles.judgeAvatarText
                            }
                          >
                            {judge.name.charAt(
                              0,
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.judgeOptionInfo
                          }
                        >
                          <Text
                            style={
                              styles.judgeName
                            }
                          >
                            {judge.name}
                          </Text>

                          <Text
                            style={
                              styles.judgeId
                            }
                          >
                            {judge.judgeId} •{' '}
                            {judge.matches}{' '}
                            matches
                          </Text>
                        </View>

                        {activeJudgeSlot !==
                          null &&
                          selectedJudges[
                            activeJudgeSlot
                          ]?.id ===
                            judge.id && (
                            <View
                              style={
                                styles.selectedJudgeBadge
                              }
                            >
                              <Text
                                style={
                                  styles.selectedJudgeCheck
                                }
                              >
                                ✓
                              </Text>
                            </View>
                          )}
                      </Pressable>
                    ),
                  )
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MATCH SUMMARY */}

        <View
          style={styles.summaryCard}
        >
          <Text
            style={styles.summaryTitle}
          >
            MATCH SUMMARY
          </Text>

          <View
            style={styles.summaryRow}
          >
            <Text
              style={styles.summaryLabel}
            >
              Red Corner
            </Text>

            <Text
              style={styles.summaryValue}
              numberOfLines={1}
            >
              {redBoxer ||
                'Not selected'}
            </Text>
          </View>

          <View
            style={styles.summaryRow}
          >
            <Text
              style={styles.summaryLabel}
            >
              Blue Corner
            </Text>

            <Text
              style={styles.summaryValue}
              numberOfLines={1}
            >
              {blueBoxer ||
                'Not selected'}
            </Text>
          </View>

          <View
            style={styles.summaryRow}
          >
            <Text
              style={styles.summaryLabel}
            >
              Weight
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {weightCategory}
            </Text>
          </View>

          <View
            style={styles.summaryRow}
          >
            <Text
              style={styles.summaryLabel}
            >
              Rounds
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {rounds}
            </Text>
          </View>

          <View
            style={[
              styles.summaryRow,
              styles.summaryRowLast,
            ]}
          >
            <Text
              style={styles.summaryLabel}
            >
              Judges
            </Text>

            <View
              style={
                styles.summaryJudgesValue
              }
            >
              {selectedJudges.map(
                (judge, index) => (
                  <Text
                    key={`summary-judge-${index}`}
                    style={
                      styles.summaryJudgeLine
                    }
                    numberOfLines={1}
                  >
                    J{index + 1}:{' '}
                    {judge?.name ||
                      'Not selected'}
                  </Text>
                ),
              )}
            </View>
          </View>
        </View>

        {/* START MATCH */}

        <Pressable
          style={({ pressed }) => [
            styles.startButton,

            (!redBoxer ||
              !blueBoxer ||
              assignedJudgeCount < 4 ||
              startingMatch) &&
              styles.startButtonDisabled,

            pressed &&
              styles.buttonPressed,
          ]}
          onPress={
            handleStartMatch
          }
          disabled={startingMatch}
        >
          {startingMatch ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <>
              <Text
                style={
                  styles.startButtonText
                }
              >
                START MATCH
              </Text>

              <Text
                style={styles.startArrow}
              >
                →
              </Text>
            </>
          )}
        </Pressable>

        <Text
          style={styles.bottomNote}
        >
          Make sure both boxers and all
          4 judges are selected before
          starting the match.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },

  container: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 18,
  },

  loadingText: {
    color: '#737B85',
    fontSize: 10,
    marginTop: 7,
  },

  emptyDataText: {
    color: '#737B85',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 18,
  },

  /* HEADER */

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#171B21',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 31,
    lineHeight: 31,
    marginTop: -3,
  },

  headerTextContainer: {
    flex: 1,
  },

  headerSmall: {
    color: '#7D858F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 3,
  },

  headerSpacer: {
    width: 42,
  },

  /* SECTION */

  sectionTitle: {
    color: '#89919B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 11,
    marginTop: 4,
  },

  /* MATCH TYPE */

  typeRow: {
    flexDirection: 'row',
    marginBottom: 23,
  },

  typeButton: {
    flex: 1,
    height: 46,
    borderRadius: 11,
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  typeButtonActive: {
    backgroundColor: '#32191B',
    borderColor: '#E53935',
  },

  typeText: {
    color: '#7E8791',
    fontSize: 12,
    fontWeight: '800',
  },

  typeTextActive: {
    color: '#FFFFFF',
  },

  /* BOXER CARD */

  boxerCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#292F37',
  },

  cornerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  cornerIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  redBackground: {
    backgroundColor: '#C62828',
  },

  blueBackground: {
    backgroundColor: '#1565C0',
  },

  cornerLetter: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  cornerInfo: {
    marginLeft: 11,
  },

  cornerTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  cornerSubtitle: {
    color: '#737B85',
    fontSize: 10,
    marginTop: 3,
  },

  boxerList: {
    gap: 8,
  },

  boxerOption: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#252B32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  redSelected: {
    borderColor: '#C62828',
    backgroundColor: '#261618',
  },

  blueSelected: {
    borderColor: '#1565C0',
    backgroundColor: '#151F2D',
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  redAvatar: {
    backgroundColor: '#7F2020',
  },

  blueAvatar: {
    backgroundColor: '#124B8D',
  },

  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  boxerName: {
    color: '#DCE0E4',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 10,
    flex: 1,
  },

  check: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  tournamentBoxerNotice: {
    minHeight: 52,
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: '#101820',
    borderWidth: 1,
    borderColor: '#39424D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  tournamentBoxerNoticeInfo: {
    flex: 1,
    marginLeft: 10,
  },

  tournamentBoxerNoticeTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  tournamentBoxerNoticeText: {
    color: '#737B85',
    fontSize: 9,
    marginTop: 3,
  },

  /* VS */

  vsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },

  vsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#292F37',
  },

  vsCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#171B21',
    borderWidth: 1,
    borderColor: '#30363E',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
  },

  vsText: {
    color: '#7E8791',
    fontSize: 9,
    fontWeight: '900',
  },

  /* WEIGHT */

  horizontalScroll: {
    marginBottom: 22,
  },

  horizontalContent: {
    paddingRight: 10,
  },

  weightButton: {
    backgroundColor: '#15191F',
    borderWidth: 1,
    borderColor: '#292F37',
    paddingHorizontal: 15,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    marginRight: 8,
  },

  weightButtonActive: {
    backgroundColor: '#E53935',
    borderColor: '#E53935',
  },

  weightText: {
    color: '#7D858F',
    fontSize: 10,
    fontWeight: '800',
  },

  weightTextActive: {
    color: '#FFFFFF',
  },

  /* ROUNDS */

  roundsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 22,
  },

  roundButton: {
    width: '31%',
    height: 64,
    backgroundColor: '#15191F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  roundButtonActive: {
    backgroundColor: '#32191B',
    borderColor: '#E53935',
  },

  roundText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  roundTextActive: {
    color: '#E53935',
  },

  roundLabel: {
    color: '#656D77',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 2,
  },

  roundLabelActive: {
    color: '#FFFFFF',
  },

  /* JUDGE */

  judgeCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#292F37',
    marginBottom: 22,
  },

  judgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },

  judgeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  judgeIconText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  judgeHeaderInfo: {
    marginLeft: 11,
  },

  judgeTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },

  judgeSubtitle: {
    color: '#737B85',
    fontSize: 10,
    marginTop: 3,
  },

  judgeList: {
    gap: 8,
  },

  judgeSlot: {
    minHeight: 62,
    borderRadius: 11,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#252B32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  judgeSlotSelected: {
    borderColor: '#1976D2',
    backgroundColor: '#151F2D',
  },

  judgeSlotNumber: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#124B8D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  judgeSlotNumberText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  judgeSlotLabel: {
    color: '#69737E',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },

  judgeOptionInfo: {
    flex: 1,
    marginLeft: 10,
  },

  judgeName: {
    color: '#DCE0E4',
    fontSize: 12,
    fontWeight: '800',
  },

  judgeNotSelected: {
    color: '#8A929C',
  },

  judgeId: {
    color: '#737B85',
    fontSize: 9,
    marginTop: 3,
  },

  judgeSlotArrow: {
    color: '#8A929C',
    fontSize: 27,
    fontWeight: '500',
    paddingHorizontal: 4,
  },

  judgeSlotArrowSelected: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  judgeAssignmentStatus: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#101820',
    borderWidth: 1,
    borderColor: '#292F37',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  judgeAssignmentStatusComplete: {
    borderColor: '#1976D2',
  },

  judgeAssignmentLabel: {
    color: '#69737E',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  judgeAssignmentCount: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  /* JUDGE MODAL */

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },

  judgeModal: {
    backgroundColor: '#111419',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#292F37',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 30,
    maxHeight: '75%',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },

  modalSubtitle: {
    color: '#737B85',
    fontSize: 10,
    marginTop: 4,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1A1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 25,
    lineHeight: 27,
  },

  modalList: {
    gap: 8,
    paddingBottom: 4,
  },

  modalJudgeOption: {
    minHeight: 60,
    borderRadius: 11,
    backgroundColor: '#0E1115',
    borderWidth: 1,
    borderColor: '#252B32',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },

  modalJudgeSelected: {
    borderColor: '#1976D2',
    backgroundColor: '#151F2D',
  },

  judgeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#124B8D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  judgeAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  noJudgeText: {
    color: '#777F89',
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 20,
  },

  selectedJudgeBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#1976D2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectedJudgeCheck: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  /* SUMMARY */

  summaryCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#292F37',
    marginBottom: 16,
  },

  summaryTitle: {
    color: '#8A929C',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginBottom: 12,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#22272E',
  },

  summaryRowLast: {
    borderBottomWidth: 0,
  },

  summaryLabel: {
    color: '#6F7781',
    fontSize: 10,
  },

  summaryValue: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
    marginLeft: 15,
  },

  summaryJudgesValue: {
    flex: 1,
    marginLeft: 15,
    alignItems: 'flex-end',
  },

  summaryJudgeLine: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'right',
  },

  /* START */

  startButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  startButtonDisabled: {
    backgroundColor: '#4A2527',
  },

  startButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  startArrow: {
    color: '#FFFFFF',
    fontSize: 22,
    marginLeft: 12,
  },

  bottomNote: {
    color: '#555D67',
    textAlign: 'center',
    fontSize: 9,
    marginTop: 10,
    lineHeight: 14,
  },

  /* GENERAL */

  buttonPressed: {
    opacity: 0.7,
  },
});