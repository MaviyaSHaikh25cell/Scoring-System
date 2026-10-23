import { API_BASE_URL } from '../constants/api';
import React, {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import {
  getTournamentById,
  updateTournamentMatch,
} from '../constants/storage';

type JudgeRoundScore = {
  round: number;
  redScore: number;
  blueScore: number;
};

type DatabaseMatchResult = {
  redScore?: number | string | null;
  blueScore?: number | string | null;
  decision?: string | null;
  winnerId?: string | null;
  loserId?: string | null;
};

type DatabaseMatch = {
  id: string;
  status?: string | null;
  redBoxerId?: string | null;
  blueBoxerId?: string | null;
  redBoxer?: { name?: string | null } | null;
  blueBoxer?: { name?: string | null } | null;
  weightCategory?: string | null;
  rounds?: number | string | null;
  matchType?: string | null;
  currentRound?: number | string | null;
  completedAt?: string | null;
  judges?: any[];
  scores?: any[];
  result?: DatabaseMatchResult | null;
};

type JudgeMatchScore = {
  matchId: string;
  judgeId: string;
  judgeName: string;

  redBoxer: string;
  blueBoxer: string;
  weightCategory: string;
  rounds: number;
  matchType: string;

  roundScores: JudgeRoundScore[];

  currentRound: number;
  currentRoundRedScore: number;
  currentRoundBlueScore: number;

  totalRedScore: number;
  totalBlueScore: number;

  status: 'IN_PROGRESS' | 'COMPLETED';

  date: string;
  time: string;
};

const JUDGE_SCORES_KEY =
  '@boxing_system_judge_scores';

const CURRENT_JUDGE_KEY =
  '@boxing_current_judge';



export default function MatchSummaryScreen() {
  const {
    redBoxer,
    blueBoxer,
    weightCategory,
    rounds,
    matchType,
    redScore,
    blueScore,
    matchId,
    tournamentId,
    tournamentMatchId,
  } = useLocalSearchParams<{
    redBoxer?: string;
    blueBoxer?: string;
    weightCategory?: string;
    rounds?: string;
    matchType?: string;
    redScore?: string;
    blueScore?: string;
    matchId?: string;
    tournamentId?: string;
    tournamentMatchId?: string;
  }>();

  const [judgeScores, setJudgeScores] =
    useState<JudgeMatchScore[]>([]);

  const [databaseMatch, setDatabaseMatch] =
    useState<DatabaseMatch | null>(null);

  const [databaseResult, setDatabaseResult] =
    useState<DatabaseMatchResult | null>(null);

  const [loadingJudges, setLoadingJudges] =
    useState(true);

  const [tournamentUpdated, setTournamentUpdated] =
    useState(false);

  const updateStartedRef = useRef(false);

  /*
   * LOAD ALL JUDGES' SCORES FOR THIS MATCH
   *
   * PostgreSQL is the primary source.
   * AsyncStorage remains only as a legacy fallback.
   */
  useEffect(() => {
    const loadJudgeScores = async () => {
      if (!matchId) {
        setDatabaseMatch(null);
        setDatabaseResult(null);
        setJudgeScores([]);
        setLoadingJudges(false);
        return;
      }

      setLoadingJudges(true);

      try {
        const token = await AsyncStorage.getItem(
          '@boxing_auth_token',
        );

        if (!token) {
          throw new Error(
            'No authentication token found.',
          );
        }

        const response = await fetch(
          `${API_BASE_URL}/matches/history/${matchId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        );

        const data = await response.json();

        console.log(
          'MATCH HISTORY API RESPONSE:',
          data,
        );

        if (!response.ok) {
          throw new Error(
            data?.message ||
              'Failed to load match history',
          );
        }

        const match =
          data?.match as DatabaseMatch | undefined;

        if (!match) {
          throw new Error(
            'Match data was not returned by the server.',
          );
        }

        setDatabaseMatch(match);
        setDatabaseResult(match.result ?? null);

        const expectedRounds =
          Number(match.rounds) ||
          Number(rounds) ||
          3;

        const databaseJudgeScores: JudgeMatchScore[] =
          (match.judges || [])
            .map((matchJudge: any) => {
              const judgeId =
                matchJudge.judge?.judgeId ||
                matchJudge.judgeId ||
                '';

              const judgeName =
                matchJudge.judge?.name ||
                'ASSIGNED JUDGE';

              // RoundScore.judgeId stores the database
              // Judge.id (CUID), not the public JG001 id.
              const judgeDatabaseId =
                matchJudge.judgeId;

              const judgeRoundScores =
                (match.scores || [])
                  .filter(
                    (score: any) =>
                      score.judgeId ===
                      judgeDatabaseId,
                  )
                  .sort(
                    (a: any, b: any) =>
                      Number(a.roundNumber) -
                      Number(b.roundNumber),
                  );

              const roundScores: JudgeRoundScore[] =
                judgeRoundScores.map(
                  (score: any) => ({
                    round: Number(
                      score.roundNumber,
                    ),
                    redScore:
                      Number(score.redScore) || 0,
                    blueScore:
                      Number(score.blueScore) || 0,
                  }),
                );

              const totalRedScore =
                roundScores.reduce(
                  (total, score) =>
                    total + score.redScore,
                  0,
                );

              const totalBlueScore =
                roundScores.reduce(
                  (total, score) =>
                    total + score.blueScore,
                  0,
                );

              return {
                matchId: match.id,
                judgeId,
                judgeName,

                redBoxer:
                  match.redBoxer?.name ||
                  redBoxer ||
                  'RED BOXER',

                blueBoxer:
                  match.blueBoxer?.name ||
                  blueBoxer ||
                  'BLUE BOXER',

                weightCategory:
                  match.weightCategory ||
                  weightCategory ||
                  'LIGHTWEIGHT',

                rounds: expectedRounds,

                matchType:
                  match.matchType ||
                  matchType ||
                  'TOURNAMENT',

                roundScores,

                currentRound:
                  Number(match.currentRound) || 0,

                currentRoundRedScore: 0,
                currentRoundBlueScore: 0,

                totalRedScore,
                totalBlueScore,

                status:
                  roundScores.length >= expectedRounds
                    ? ('COMPLETED' as const)
                    : ('IN_PROGRESS' as const),

                date: match.completedAt
                  ? new Date(
                      match.completedAt,
                    ).toLocaleDateString()
                  : '',

                time: match.completedAt
                  ? new Date(
                      match.completedAt,
                    ).toLocaleTimeString()
                  : '',
              };
            })
            .sort((a, b) =>
              a.judgeId.localeCompare(
                b.judgeId,
              ),
            );

        setJudgeScores(
          databaseJudgeScores,
        );
      } catch (error) {
        console.log(
          'Error loading match history from PostgreSQL:',
          error,
        );

        // Legacy fallback for older locally stored matches.
        try {
          const stored =
            await AsyncStorage.getItem(
              JUDGE_SCORES_KEY,
            );

          if (!stored) {
            setDatabaseMatch(null);
            setDatabaseResult(null);
            setJudgeScores([]);
            return;
          }

          const parsed: JudgeMatchScore[] =
            JSON.parse(stored);

          if (!Array.isArray(parsed)) {
            setDatabaseMatch(null);
            setDatabaseResult(null);
            setJudgeScores([]);
            return;
          }

          const scoresForThisMatch =
            parsed
              .filter(
                (item) =>
                  item.matchId === matchId,
              )
              .sort((a, b) =>
                a.judgeId.localeCompare(
                  b.judgeId,
                ),
              );

          setDatabaseMatch(null);
          setDatabaseResult(null);
          setJudgeScores(
            scoresForThisMatch,
          );
        } catch (fallbackError) {
          console.log(
            'Error loading fallback judge scores:',
            fallbackError,
          );

          setDatabaseMatch(null);
          setDatabaseResult(null);
          setJudgeScores([]);
        }
      } finally {
        setLoadingJudges(false);
      }
    };

    loadJudgeScores();
  }, [
    matchId,
    redBoxer,
    blueBoxer,
    weightCategory,
    rounds,
    matchType,
  ]);

  /*
   * LEGACY FALLBACK SCORE
   */
  const finalRedScore =
    Number(redScore) || 0;

  const finalBlueScore =
    Number(blueScore) || 0;

  const redWins =
    finalRedScore > finalBlueScore;

  const blueWins =
    finalBlueScore > finalRedScore;

  const draw =
    finalRedScore === finalBlueScore;

  const fallbackWinnerName = draw
    ? 'DRAW'
    : redWins
      ? redBoxer || 'RED BOXER'
      : blueBoxer || 'BLUE BOXER';

  const fallbackWinnerCorner = draw
    ? 'MATCH DRAW'
    : redWins
      ? 'RED CORNER'
      : 'BLUE CORNER';

  /*
   * NUMBER OF COMPLETED JUDGES
   */
  const completedJudgeCount =
    judgeScores.filter(
      (judge) =>
        judge.status === 'COMPLETED',
    ).length;

  /*
   * GET TOTAL FROM ROUND SCORES
   */
  const getJudgeTotal = (
    judge: JudgeMatchScore,
    side: 'RED' | 'BLUE',
  ) => {
    if (
      Array.isArray(judge.roundScores) &&
      judge.roundScores.length > 0
    ) {
      return judge.roundScores.reduce(
        (total, roundScore) =>
          total +
          (side === 'RED'
            ? Number(
                roundScore.redScore,
              ) || 0
            : Number(
                roundScore.blueScore,
              ) || 0),
        0,
      );
    }

    return side === 'RED'
      ? Number(
          judge.totalRedScore,
        ) || 0
      : Number(
          judge.totalBlueScore,
        ) || 0;
  };

  /*
   * OFFICIAL JUDGE DECISIONS
   */
  const judgeDecisions = judgeScores
    .filter(
      (judge) =>
        judge.status === 'COMPLETED',
    )
    .map((judge) => {
      const judgeRedScore =
        getJudgeTotal(
          judge,
          'RED',
        );

      const judgeBlueScore =
        getJudgeTotal(
          judge,
          'BLUE',
        );

      if (
        judgeRedScore >
        judgeBlueScore
      ) {
        return 'RED' as const;
      }

      if (
        judgeBlueScore >
        judgeRedScore
      ) {
        return 'BLUE' as const;
      }

      return 'DRAW' as const;
    });

  const redJudgeVotes =
    judgeDecisions.filter(
      (decision) =>
        decision === 'RED',
    ).length;

  const blueJudgeVotes =
    judgeDecisions.filter(
      (decision) =>
        decision === 'BLUE',
    ).length;

  const drawJudgeVotes =
    judgeDecisions.filter(
      (decision) =>
        decision === 'DRAW',
    ).length;

  /*
   * OFFICIAL RESULT
   */
  const databaseOfficialWinner =
    databaseMatch &&
    databaseResult
      ? databaseResult.winnerId ===
        databaseMatch.redBoxerId
        ? 'RED'
        : databaseResult.winnerId ===
            databaseMatch.blueBoxerId
          ? 'BLUE'
          : String(
                databaseResult.decision || '',
              ).toUpperCase() === 'DRAW'
            ? 'DRAW'
            : null
      : null;

  const calculatedOfficialWinner =
    completedJudgeCount === 4
      ? redJudgeVotes >= 3
        ? 'RED'
        : blueJudgeVotes >= 3
          ? 'BLUE'
          : 'DRAW'
      : null;

  const officialWinner =
    databaseOfficialWinner ||
    calculatedOfficialWinner;

  const officialWinnerName =
    officialWinner === 'RED'
      ? redBoxer || 'RED BOXER'
      : officialWinner === 'BLUE'
        ? blueBoxer || 'BLUE BOXER'
        : officialWinner === 'DRAW'
          ? 'DRAW'
          : '';

  /*
   * UPDATE TOURNAMENT AFTER ALL 4 JUDGES
   *
   * This writes the official result back into
   * Tournament Management.
   */
  useEffect(() => {
    const updateTournamentResult =
      async () => {
        if (
          completedJudgeCount !== 4 ||
          !officialWinner ||
          !tournamentId ||
          !tournamentMatchId ||
          updateStartedRef.current
        ) {
          return;
        }

        updateStartedRef.current = true;

        try {
          const tournament =
            await getTournamentById(
              tournamentId,
            );

          if (!tournament) {
            console.log(
              'Tournament not found:',
              tournamentId,
            );
            return;
          }

          let currentMatch = null;

          for (const category of tournament.weightCategories) {
            const foundMatch =
              category.matches.find(
                (match) =>
                  match.id ===
                  tournamentMatchId,
              );

            if (foundMatch) {
              currentMatch =
                foundMatch;
              break;
            }
          }

          if (!currentMatch) {
            console.log(
              'Tournament match not found:',
              tournamentMatchId,
            );
            return;
          }

          /*
           * Determine official winner name.
           */
          const winnerName =
            officialWinner === 'RED'
              ? currentMatch.redBoxer ||
                redBoxer ||
                null
              : officialWinner ===
                  'BLUE'
                ? currentMatch.blueBoxer ||
                  blueBoxer ||
                  null
                : null;

          /*
           * Determine winner club.
           */
          const winnerClub =
            officialWinner === 'RED'
              ? currentMatch.redClub ||
                null
              : officialWinner ===
                  'BLUE'
                ? currentMatch.blueClub ||
                  null
                : null;

          /*
           * Update current tournament match.
           */
          await updateTournamentMatch(
            tournamentId,
            tournamentMatchId,
            {
              status: 'COMPLETED',
              winner: winnerName,
              winnerClub:
                winnerClub,
              scoringMatchId:
                matchId || null,
            },
          );

          /*
           * If there is a next match, place the
           * winner into the correct bracket slot.
           */
          if (
            currentMatch.nextMatchId &&
            winnerName
          ) {
            let nextMatch = null;

            for (const category of tournament.weightCategories) {
              const foundNext =
                category.matches.find(
                  (match) =>
                    match.id ===
                    currentMatch!.nextMatchId,
                );

              if (foundNext) {
                nextMatch =
                  foundNext;
                break;
              }
            }

            if (nextMatch) {
              const isRedSource =
                nextMatch.redSourceMatchId ===
                currentMatch.id;

              const isBlueSource =
                nextMatch.blueSourceMatchId ===
                currentMatch.id;

              if (isRedSource) {
                await updateTournamentMatch(
                  tournamentId,
                  nextMatch.id,
                  {
                    redBoxer:
                      winnerName,
                    redClub:
                      winnerClub,
                    redSourceText:
                      `WINNER OF BOUT NO ${currentMatch.matchNumber}`,
                    status:
                      nextMatch.blueBoxer
                        ? 'UPCOMING'
                        : 'LOCKED',
                  },
                );
              } else if (isBlueSource) {
                await updateTournamentMatch(
                  tournamentId,
                  nextMatch.id,
                  {
                    blueBoxer:
                      winnerName,
                    blueClub:
                      winnerClub,
                    blueSourceText:
                      `WINNER OF BOUT NO ${currentMatch.matchNumber}`,
                    status:
                      nextMatch.redBoxer
                        ? 'UPCOMING'
                        : 'LOCKED',
                  },
                );
              }
            }
          }

          setTournamentUpdated(true);

          console.log(
            'Tournament match updated successfully:',
            tournamentMatchId,
          );
        } catch (error) {
          console.log(
            'Error updating tournament result:',
            error,
          );
        }
      };

    updateTournamentResult();
  }, [
    completedJudgeCount,
    officialWinner,
    tournamentId,
    tournamentMatchId,
    matchId,
    redBoxer,
    blueBoxer,
  ]);

  /*
   * GO TO THE CORRECT SCREEN AFTER MATCH
   *
   * Tournament match:
   *     Match Summary
   *          ↓
   * Tournament Management
   *          ↓
   * Automatically opens the same tournament
   *
   * Normal match:
   *     Match Summary
   *          ↓
   * Dashboard
   *
   * Judge:
   *     Match Summary
   *          ↓
   * Judge Dashboard
   */
  const handleBackToDashboard =
    async () => {
      try {
        const currentJudge =
          await AsyncStorage.getItem(
            CURRENT_JUDGE_KEY,
          );

        /*
         * JUDGE FLOW
         */
        if (currentJudge) {
          router.replace(
            '/judge-dashboard',
          );
          return;
        }

        /*
         * TOURNAMENT FLOW
         *
         * Pass the tournament ID so
         * Tournament Management can
         * automatically open that
         * exact tournament.
         */
        if (tournamentId) {
          router.replace({
            pathname:
              '/tournament-management',
            params: {
              tournamentId:
                tournamentId,
            },
          });
          return;
        }

        /*
         * NORMAL MATCH FLOW
         */
        router.replace(
          '/dashboard',
        );
      } catch (error) {
        console.log(
          'Error checking current user:',
          error,
        );

        /*
         * If anything goes wrong,
         * still prioritize returning
         * to the tournament when the
         * tournament ID exists.
         */
        if (tournamentId) {
          router.replace({
            pathname:
              '/tournament-management',
            params: {
              tournamentId:
                tournamentId,
            },
          });
          return;
        }

        router.replace(
          '/dashboard',
        );
      }
    };

  /*
   * RENDER ONE JUDGE CARD
   */
  const renderJudgeCard = (
    judge: JudgeMatchScore,
    index: number,
  ) => {
    const judgeRedScore =
      getJudgeTotal(
        judge,
        'RED',
      );

    const judgeBlueScore =
      getJudgeTotal(
        judge,
        'BLUE',
      );

    const judgeCompleted =
      judge.status ===
      'COMPLETED';

    return (
      <View
        key={`${judge.matchId}_${judge.judgeId}`}
        style={styles.judgeCard}
      >
        <View
          style={styles.judgeHeader}
        >
          <View
            style={
              styles.judgeNumberCircle
            }
          >
            <Text
              style={
                styles.judgeNumber
              }
            >
              {index + 1}
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
              JUDGE {index + 1}
            </Text>

            <Text
              style={styles.judgeName}
            >
              {judge.judgeName ||
                judge.judgeId ||
                'ASSIGNED JUDGE'}
            </Text>

            <Text
              style={styles.judgeId}
            >
              {judge.judgeId}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              judgeCompleted
                ? styles.completedBadge
                : styles.pendingBadge,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                judgeCompleted
                  ? styles.completedText
                  : styles.pendingText,
              ]}
            >
              {judgeCompleted
                ? 'SUBMITTED'
                : 'IN PROGRESS'}
            </Text>
          </View>
        </View>

        <View
          style={styles.judgeScoreBox}
        >
          <View
            style={styles.judgeSide}
          >
            <View
              style={[
                styles.smallCorner,
                styles.redCorner,
              ]}
            >
              <Text
                style={
                  styles.smallCornerText
                }
              >
                R
              </Text>
            </View>

            <Text
              style={
                styles.judgeSideLabel
              }
            >
              RED
            </Text>

            <Text
              style={styles.judgeScore}
            >
              {judgeRedScore}
            </Text>
          </View>

          <View
            style={
              styles.judgeVsContainer
            }
          >
            <Text
              style={styles.judgeVs}
            >
              VS
            </Text>
          </View>

          <View
            style={styles.judgeSide}
          >
            <View
              style={[
                styles.smallCorner,
                styles.blueCorner,
              ]}
            >
              <Text
                style={
                  styles.smallCornerText
                }
              >
                B
              </Text>
            </View>

            <Text
              style={
                styles.judgeSideLabel
              }
            >
              BLUE
            </Text>

            <Text
              style={styles.judgeScore}
            >
              {judgeBlueScore}
            </Text>
          </View>
        </View>

        {judge.roundScores &&
          judge.roundScores.length >
            0 && (
            <View
              style={
                styles.roundSection
              }
            >
              <Text
                style={
                  styles.roundSectionTitle
                }
              >
                ROUND SCORES
              </Text>

              {judge.roundScores.map(
                (roundScore) => (
                  <View
                    key={`${judge.judgeId}-round-${roundScore.round}`}
                    style={
                      styles.roundRow
                    }
                  >
                    <Text
                      style={
                        styles.roundNumber
                      }
                    >
                      ROUND{' '}
                      {roundScore.round}
                    </Text>

                    <View
                      style={
                        styles.roundScoreValues
                      }
                    >
                      <Text
                        style={
                          styles.roundRed
                        }
                      >
                        {
                          roundScore.redScore
                        }
                      </Text>

                      <Text
                        style={
                          styles.roundDash
                        }
                      >
                        -
                      </Text>

                      <Text
                        style={
                          styles.roundBlue
                        }
                      >
                        {
                          roundScore.blueScore
                        }
                      </Text>
                    </View>
                  </View>
                ),
              )}
            </View>
          )}
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.container}
        >
          {/* HEADER */}
          <View
            style={styles.header}
          >
            <Text
              style={styles.headerTitle}
            >
              MATCH SUMMARY
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              {judgeScores.length >
              0
                ? '4-JUDGE SCORE REVIEW'
                : 'MATCH COMPLETED'}
            </Text>
          </View>

          {/* MATCH */}
          <View
            style={styles.matchCard}
          >
            <View
              style={
                styles.matchBoxer
              }
            >
              <View
                style={[
                  styles.matchCorner,
                  styles.redCorner,
                ]}
              >
                <Text
                  style={
                    styles.matchCornerText
                  }
                >
                  R
                </Text>
              </View>

              <Text
                style={
                  styles.matchBoxerName
                }
                numberOfLines={2}
              >
                {redBoxer ||
                  'RED BOXER'}
              </Text>
            </View>

            <View
              style={styles.matchVs}
            >
              <Text
                style={
                  styles.matchVsText
                }
              >
                VS
              </Text>
            </View>

            <View
              style={
                styles.matchBoxer
              }
            >
              <View
                style={[
                  styles.matchCorner,
                  styles.blueCorner,
                ]}
              >
                <Text
                  style={
                    styles.matchCornerText
                  }
                >
                  B
                </Text>
              </View>

              <Text
                style={
                  styles.matchBoxerName
                }
                numberOfLines={2}
              >
                {blueBoxer ||
                  'BLUE BOXER'}
              </Text>
            </View>
          </View>

          {/* MATCH INFORMATION */}
          <View
            style={styles.infoCard}
          >
            <View
              style={styles.infoRow}
            >
              <Text
                style={styles.infoLabel}
              >
                CATEGORY
              </Text>

              <Text
                style={styles.infoValue}
              >
                {weightCategory ||
                  'LIGHTWEIGHT'}
              </Text>
            </View>

            <View
              style={
                styles.infoSeparator
              }
            />

            <View
              style={styles.infoRow}
            >
              <Text
                style={styles.infoLabel}
              >
                MATCH TYPE
              </Text>

              <Text
                style={styles.infoValue}
              >
                {matchType ||
                  'TOURNAMENT'}
              </Text>
            </View>

            <View
              style={
                styles.infoSeparator
              }
            />

            <View
              style={styles.infoRow}
            >
              <Text
                style={styles.infoLabel}
              >
                ROUNDS
              </Text>

              <Text
                style={styles.infoValue}
              >
                {rounds || '3'}
              </Text>
            </View>

            <View
              style={
                styles.infoSeparator
              }
            />

            <View
              style={styles.infoRow}
            >
              <Text
                style={styles.infoLabel}
              >
                JUDGES SUBMITTED
              </Text>

              <Text
                style={[
                  styles.infoValue,
                  completedJudgeCount ===
                    4 &&
                    styles.allJudgesText,
                ]}
              >
                {completedJudgeCount}{' '}
                / 4
              </Text>
            </View>
          </View>

          {/* SECTION */}
          <View
            style={
              styles.sectionHeader
            }
          >
            <View>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                INDEPENDENT JUDGE
                SCORES
              </Text>

              <Text
                style={
                  styles.sectionSubtitle
                }
              >
                Each judge's score is
                stored separately
              </Text>
            </View>

            <View
              style={
                styles.judgeCountBadge
              }
            >
              <Text
                style={
                  styles.judgeCountText
                }
              >
                {completedJudgeCount}/4
              </Text>
            </View>
          </View>

          {/* LOADING */}
          {loadingJudges ? (
            <View
              style={styles.emptyCard}
            >
              <Text
                style={
                  styles.emptyTitle
                }
              >
                LOADING JUDGE SCORES
              </Text>

              <Text
                style={
                  styles.emptyText
                }
              >
                Reading independent
                score records...
              </Text>
            </View>
          ) : judgeScores.length >
            0 ? (
            <>
              {judgeScores.map(
                (judge, index) =>
                  renderJudgeCard(
                    judge,
                    index,
                  ),
              )}

              {completedJudgeCount <
                4 && (
                <View
                  style={
                    styles.warningCard
                  }
                >
                  <Text
                    style={
                      styles.warningTitle
                    }
                  >
                    WAITING FOR JUDGES
                  </Text>

                  <Text
                    style={
                      styles.warningText
                    }
                  >
                    {4 -
                      completedJudgeCount}{' '}
                    judge
                    {4 -
                      completedJudgeCount ===
                    1
                      ? ''
                      : 's'}{' '}
                    {4 -
                      completedJudgeCount ===
                    1
                      ? 'has'
                      : 'have'}{' '}
                    not submitted a
                    completed
                    scorecard yet.
                  </Text>
                </View>
              )}
            </>
          ) : (
            <>
              <View
                style={
                  styles.legacyCard
                }
              >
                <Text
                  style={
                    styles.legacyTitle
                  }
                >
                  LEGACY MATCH SCORE
                </Text>

                <Text
                  style={
                    styles.legacyText
                  }
                >
                  This match does not
                  have independent
                  judge score records.
                </Text>

                <View
                  style={
                    styles.legacyScoreRow
                  }
                >
                  <View
                    style={
                      styles.legacySide
                    }
                  >
                    <Text
                      style={
                        styles.legacyLabel
                      }
                    >
                      RED
                    </Text>

                    <Text
                      style={
                        styles.legacyScore
                      }
                    >
                      {
                        finalRedScore
                      }
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.legacyDash
                    }
                  >
                    -
                  </Text>

                  <View
                    style={
                      styles.legacySide
                    }
                  >
                    <Text
                      style={
                        styles.legacyLabel
                      }
                    >
                      BLUE
                    </Text>

                    <Text
                      style={
                        styles.legacyScore
                      }
                    >
                      {
                        finalBlueScore
                      }
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={
                  styles.warningCard
                }
              >
                <Text
                  style={
                    styles.warningTitle
                  }
                >
                  NO 4-JUDGE DATA
                </Text>

                <Text
                  style={
                    styles.warningText
                  }
                >
                  This is an older match
                  record. The score above
                  is not an official
                  4-judge result.
                </Text>
              </View>
            </>
          )}

          {/* OFFICIAL RESULT */}
          <View
            style={[
              styles.officialCard,
              completedJudgeCount ===
                4 &&
                officialWinner ===
                  'RED' &&
                styles.officialRedCard,
              completedJudgeCount ===
                4 &&
                officialWinner ===
                  'BLUE' &&
                styles.officialBlueCard,
              completedJudgeCount ===
                4 &&
                officialWinner ===
                  'DRAW' &&
                styles.officialDrawCard,
            ]}
          >
            <View
              style={[
                styles.officialIcon,
                completedJudgeCount ===
                  4 &&
                  officialWinner ===
                    'RED' &&
                  styles.officialRedIcon,
                completedJudgeCount ===
                  4 &&
                  officialWinner ===
                    'BLUE' &&
                  styles.officialBlueIcon,
                completedJudgeCount ===
                  4 &&
                  officialWinner ===
                    'DRAW' &&
                  styles.officialDrawIcon,
              ]}
            >
              <Text
                style={
                  styles.officialIconText
                }
              >
                4J
              </Text>
            </View>

            <Text
              style={
                styles.officialTitle
              }
            >
              OFFICIAL RESULT
            </Text>

            {completedJudgeCount ===
            4 ? (
              <>
                <Text
                  style={[
                    styles.officialWinnerName,
                    officialWinner ===
                      'RED' &&
                      styles.officialRedText,
                    officialWinner ===
                      'BLUE' &&
                      styles.officialBlueText,
                    officialWinner ===
                      'DRAW' &&
                      styles.officialDrawText,
                  ]}
                  numberOfLines={2}
                >
                  {officialWinnerName}
                </Text>

                <Text
                  style={
                    styles.officialResultLabel
                  }
                >
                  {officialWinner ===
                  'DRAW'
                    ? 'MAJORITY NOT REACHED — MATCH DRAW'
                    : `${officialWinner === 'RED' ? 'RED' : 'BLUE'} CORNER WINS`}
                </Text>

                <View
                  style={
                    styles.officialVotesRow
                  }
                >
                  <View
                    style={
                      styles.officialVote
                    }
                  >
                    <Text
                      style={[
                        styles.officialVoteLabel,
                        styles.officialRedText,
                      ]}
                    >
                      RED
                    </Text>

                    <Text
                      style={
                        styles.officialVoteValue
                      }
                    >
                      {
                        redJudgeVotes
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      styles.officialVote
                    }
                  >
                    <Text
                      style={
                        styles.officialVoteLabel
                      }
                    >
                      DRAW
                    </Text>

                    <Text
                      style={
                        styles.officialVoteValue
                      }
                    >
                      {
                        drawJudgeVotes
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      styles.officialVote
                    }
                  >
                    <Text
                      style={[
                        styles.officialVoteLabel,
                        styles.officialBlueText,
                      ]}
                    >
                      BLUE
                    </Text>

                    <Text
                      style={
                        styles.officialVoteValue
                      }
                    >
                      {
                        blueJudgeVotes
                      }
                    </Text>
                  </View>
                </View>

                <Text
                  style={
                    styles.officialText
                  }
                >
                  Result is based on
                  the 4 independent
                  judge decisions. A
                  boxer needs at least
                  3 of 4 judge decisions
                  to win.
                </Text>

                {tournamentUpdated && (
                  <Text
                    style={
                      styles.updatedText
                    }
                  >
                    ✓ TOURNAMENT RESULT
                    UPDATED
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text
                  style={
                    styles.officialText
                  }
                >
                  Official result will
                  be calculated after
                  all 4 judges submit
                  their completed
                  scorecards.
                </Text>

                <Text
                  style={
                    styles.officialWaiting
                  }
                >
                  {4 -
                    completedJudgeCount}{' '}
                  JUDGE
                  {4 -
                    completedJudgeCount ===
                  1
                    ? ''
                    : 'S'}{' '}
                  REMAINING
                </Text>
              </>
            )}
          </View>

          {/* BUTTONS */}
          <View
            style={styles.buttons}
          >
            <Pressable
              style={
                styles.primaryButton
              }
              onPress={
                handleBackToDashboard
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                {tournamentId
                  ? 'BACK TO TOURNAMENT'
                  : 'BACK TO DASHBOARD'}
              </Text>

              <Text
                style={styles.arrow}
              >
                →
              </Text>
            </Pressable>

            <Pressable
              style={
                styles.secondaryButton
              }
              onPress={() =>
                router.replace(
                  '/create-match',
                )
              }
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                CREATE NEW MATCH
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },

  scrollView: {
    flex: 1,
    backgroundColor: '#0B0D10',
  },

  scrollContent: {
    paddingBottom: 35,
  },

  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  header: {
    alignItems: 'center',
    marginBottom: 18,
  },

  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  headerSubtitle: {
    color: '#43A047',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 5,
  },

  matchCard: {
    backgroundColor: '#15191F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#252B32',
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  matchBoxer: {
    alignItems: 'center',
    width: '38%',
  },

  matchCorner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  matchCornerText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },

  matchBoxerName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textAlign: 'center',
    marginTop: 7,
  },

  matchVs: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  matchVsText: {
    color: '#555D67',
    fontSize: 11,
    fontWeight: '900',
  },

  redCorner: {
    backgroundColor: '#C62828',
  },

  blueCorner: {
    backgroundColor: '#1565C0',
  },

  infoCard: {
    backgroundColor: '#15191F',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#252B32',
    paddingHorizontal: 15,
    marginTop: 14,
  },

  infoRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  infoLabel: {
    color: '#626A74',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  infoValue: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  allJudgesText: {
    color: '#43A047',
  },

  infoSeparator: {
    height: 1,
    backgroundColor: '#252B32',
  },

  sectionHeader: {
    marginTop: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  sectionTitle: {
    color: '#858D97',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  sectionSubtitle: {
    color: '#555D67',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 4,
  },

  judgeCountBadge: {
    backgroundColor: '#20252C',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  judgeCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  judgeCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 14,
    marginBottom: 12,
  },

  judgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  judgeNumberCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
  },

  judgeNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  judgeHeaderInfo: {
    flex: 1,
    marginLeft: 10,
  },

  judgeTitle: {
    color: '#858D97',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  judgeName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
  },

  judgeId: {
    color: '#555D67',
    fontSize: 7,
    fontWeight: '800',
    marginTop: 2,
  },

  statusBadge: {
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  completedBadge: {
    backgroundColor: '#16301E',
  },

  pendingBadge: {
    backgroundColor: '#29251A',
  },

  statusText: {
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  completedText: {
    color: '#43A047',
  },

  pendingText: {
    color: '#F9A825',
  },

  judgeScoreBox: {
    backgroundColor: '#11151A',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#252B32',
    marginTop: 13,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },

  judgeSide: {
    alignItems: 'center',
    width: '35%',
  },

  smallCorner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallCornerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  judgeSideLabel: {
    color: '#69717B',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 5,
  },

  judgeScore: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '900',
    marginTop: 1,
  },

  judgeVsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  judgeVs: {
    color: '#555D67',
    fontSize: 10,
    fontWeight: '900',
  },

  roundSection: {
    marginTop: 12,
  },

  roundSectionTitle: {
    color: '#626A74',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 5,
  },

  roundRow: {
    minHeight: 30,
    backgroundColor: '#11151A',
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  roundNumber: {
    color: '#737C87',
    fontSize: 8,
    fontWeight: '900',
  },

  roundScoreValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  roundRed: {
    color: '#F45B5B',
    fontSize: 10,
    fontWeight: '900',
    minWidth: 25,
    textAlign: 'center',
  },

  roundDash: {
    color: '#555D67',
    fontSize: 9,
    fontWeight: '900',
  },

  roundBlue: {
    color: '#64A9F5',
    fontSize: 10,
    fontWeight: '900',
    minWidth: 25,
    textAlign: 'center',
  },

  emptyCard: {
    backgroundColor: '#15191F',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 20,
    alignItems: 'center',
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  emptyText: {
    color: '#626A74',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },

  warningCard: {
    backgroundColor: '#29251A',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#51451E',
    padding: 13,
    marginTop: 2,
  },

  warningTitle: {
    color: '#F9A825',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  warningText: {
    color: '#B7A96C',
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 5,
  },

  legacyCard: {
    backgroundColor: '#15191F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 16,
  },

  legacyTitle: {
    color: '#858D97',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },

  legacyText: {
    color: '#626A74',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 14,
  },

  legacyScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },

  legacySide: {
    alignItems: 'center',
    width: 80,
  },

  legacyLabel: {
    color: '#69717B',
    fontSize: 8,
    fontWeight: '900',
  },

  legacyScore: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    marginTop: 2,
  },

  legacyDash: {
    color: '#555D67',
    fontSize: 18,
    fontWeight: '900',
    marginHorizontal: 15,
  },

  officialCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#30363E',
    padding: 18,
    alignItems: 'center',
    marginTop: 16,
  },

  officialRedCard: {
    borderColor: '#6E2727',
  },

  officialBlueCard: {
    borderColor: '#24558B',
  },

  officialDrawCard: {
    borderColor: '#5A5A5A',
  },

  officialIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#20252C',
    alignItems: 'center',
    justifyContent: 'center',
  },

  officialIconText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  officialRedIcon: {
    backgroundColor: '#6B2424',
  },

  officialBlueIcon: {
    backgroundColor: '#214F80',
  },

  officialDrawIcon: {
    backgroundColor: '#383D43',
  },

  officialTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 10,
  },

  officialWinnerName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 10,
  },

  officialRedText: {
    color: '#F45B5B',
  },

  officialBlueText: {
    color: '#64A9F5',
  },

  officialDrawText: {
    color: '#D0D4D8',
  },

  officialResultLabel: {
    color: '#858D97',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 5,
  },

  officialVotesRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingVertical: 10,
    backgroundColor: '#11151A',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#252B32',
  },

  officialVote: {
    alignItems: 'center',
    minWidth: 55,
  },

  officialVoteLabel: {
    color: '#69717B',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  officialVoteValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },

  officialWaiting: {
    color: '#F9A825',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 9,
  },

  officialText: {
    color: '#858D97',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 6,
  },

  updatedText: {
    color: '#43A047',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 12,
  },

  buttons: {
    marginTop: 18,
  },

  primaryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E53935',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 18,
    marginLeft: 8,
  },

  secondaryButton: {
    height: 45,
    borderRadius: 12,
    backgroundColor: '#171B21',
    borderWidth: 1,
    borderColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  secondaryButtonText: {
    color: '#D4D8DC',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
});