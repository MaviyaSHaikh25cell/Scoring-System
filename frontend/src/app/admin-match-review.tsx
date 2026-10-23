import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getTournamentById,
  saveTournament,
  saveMatch,
} from '../constants/storage';

import type {
  Tournament,
  TournamentMatch,
  TournamentRoundReview,
  RoundVerificationStatus,
  RefereeEvent,
  AdminOverride,
} from '../constants/storage';

const ROUND_REVIEWS_KEY =
  '@boxing_system_round_reviews';

const REFEREE_EVENTS_KEY =
  '@boxing_system_referee_events';

const ASSIGNED_MATCHES_KEY =
  '@boxing_system_assigned_matches';

const ADMIN_OVERRIDES_KEY =
  '@boxing_system_admin_overrides';

type StoredRoundReview = {
  id: string;
  matchId: string;
  tournamentId: string | null;
  tournamentMatchId: string | null;
  roundNumber: number;
  status: RoundVerificationStatus;
  submittedJudgeId: string;
  submittedJudgeName: string;
  redScore: number;
  blueScore: number;
  submittedAt: string;
};

type AssignedMatch = {
  id: string;
  redBoxer: string;
  blueBoxer: string;
  weightCategory: string;
  rounds: number;
  matchType: string;
  judgeId?: string;
  judgeName?: string;
  judgeIds?: string[];
  judgeNames?: string[];
  status: string;
  tournamentId?: string;
  tournamentMatchId?: string;
  winner?: string;
  result?: 'WON' | 'LOST' | 'DRAW';
  redScore?: number;
  blueScore?: number;
};

type ReviewGroup = {
  key: string;
  matchId: string;
  tournamentId: string | null;
  tournamentMatchId: string | null;
  roundNumber: number;
  submissions: StoredRoundReview[];
};

type RefereeEventStored = {
  id: string;
  matchId: string;
  type: RefereeEvent['type'];
  roundNumber: number;
  time: string;
  corner: RefereeEvent['corner'];
  note: string | null;
  refereeId: string | null;
  refereeName: string | null;
  createdAt: string;
};

type EditingSubmission = {
  groupKey: string;
  submissionId: string;
  judgeName: string;
  redScore: number;
  blueScore: number;
};

export default function AdminMatchReviewScreen() {
  const params = useLocalSearchParams<{
    matchId?: string;
    tournamentId?: string;
    tournamentMatchId?: string;
  }>();

  const [reviews, setReviews] =
    useState<StoredRoundReview[]>([]);

  const [assignedMatches, setAssignedMatches] =
    useState<AssignedMatch[]>([]);

  const [refereeEvents, setRefereeEvents] =
    useState<RefereeEventStored[]>([]);

  const [adminOverrides, setAdminOverrides] =
    useState<AdminOverride[]>([]);

  const [refreshing, setRefreshing] =
    useState(false);

  const [processingKey, setProcessingKey] =
    useState<string | null>(null);

  const [selectedKey, setSelectedKey] =
    useState<string | null>(null);

  const [editingSubmission, setEditingSubmission] =
    useState<EditingSubmission | null>(null);

  const [editRedScore, setEditRedScore] =
    useState('');

  const [editBlueScore, setEditBlueScore] =
    useState('');

  const [editReason, setEditReason] =
    useState('');

  const [savingEdit, setSavingEdit] =
    useState(false);

  const loadData = useCallback(async () => {
    try {
      const [
        storedReviews,
        storedMatches,
        storedEvents,
        storedOverrides,
      ] = await Promise.all([
        AsyncStorage.getItem(ROUND_REVIEWS_KEY),
        AsyncStorage.getItem(ASSIGNED_MATCHES_KEY),
        AsyncStorage.getItem(REFEREE_EVENTS_KEY),
        AsyncStorage.getItem(ADMIN_OVERRIDES_KEY),
      ]);

      const parsedReviews = storedReviews
        ? JSON.parse(storedReviews)
        : [];

      const parsedMatches = storedMatches
        ? JSON.parse(storedMatches)
        : [];

      const parsedEvents = storedEvents
        ? JSON.parse(storedEvents)
        : [];

      const parsedOverrides = storedOverrides
        ? JSON.parse(storedOverrides)
        : [];

      setReviews(
        Array.isArray(parsedReviews)
          ? parsedReviews
          : [],
      );

      setAssignedMatches(
        Array.isArray(parsedMatches)
          ? parsedMatches
          : [],
      );

      setRefereeEvents(
        Array.isArray(parsedEvents)
          ? parsedEvents
          : [],
      );

      setAdminOverrides(
        Array.isArray(parsedOverrides)
          ? parsedOverrides
          : [],
      );
    } catch (error) {
      console.log(
        'Error loading admin match review data:',
        error,
      );

      Alert.alert(
        'Error',
        'Unable to load match review data. Please try again.',
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);

    await loadData();

    setRefreshing(false);
  };

  const reviewGroups = useMemo<ReviewGroup[]>(
    () => {
      const grouped = new Map<
        string,
        ReviewGroup
      >();

      reviews.forEach((review) => {
        const key =
          `${review.matchId}_${review.roundNumber}`;

        const existing = grouped.get(key);

        if (existing) {
          const alreadyExists =
            existing.submissions.some(
              (item) =>
                item.submittedJudgeId ===
                review.submittedJudgeId,
            );

          if (!alreadyExists) {
            existing.submissions.push(review);
          }
        } else {
          grouped.set(key, {
            key,
            matchId: review.matchId,
            tournamentId:
              review.tournamentId ?? null,
            tournamentMatchId:
              review.tournamentMatchId ?? null,
            roundNumber: review.roundNumber,
            submissions: [review],
          });
        }
      });

      return Array.from(
        grouped.values(),
      ).sort((a, b) => {
        if (a.matchId === b.matchId) {
          return (
            a.roundNumber -
            b.roundNumber
          );
        }

        return a.matchId.localeCompare(
          b.matchId,
        );
      });
    },
    [reviews],
  );

  const filteredGroups = useMemo(() => {
    return reviewGroups.filter((group) => {
      if (
        params.matchId &&
        group.matchId !== params.matchId
      ) {
        return false;
      }

      if (
        params.tournamentId &&
        group.tournamentId &&
        group.tournamentId !==
          params.tournamentId
      ) {
        return false;
      }

      if (
        params.tournamentMatchId &&
        group.tournamentMatchId &&
        group.tournamentMatchId !==
          params.tournamentMatchId
      ) {
        return false;
      }

      return true;
    });
  }, [
    reviewGroups,
    params.matchId,
    params.tournamentId,
    params.tournamentMatchId,
  ]);

  const getAssignedJudgeCount = (
    group: ReviewGroup,
  ) => {
    const uniqueJudgeIds =
      new Set<string>();

    assignedMatches.forEach((match) => {
      const sameTournamentMatch =
        Boolean(group.tournamentMatchId) &&
        match.tournamentMatchId ===
          group.tournamentMatchId;

      const sameScoringMatch =
        match.id === group.matchId;

      if (
        !sameTournamentMatch &&
        !sameScoringMatch
      ) {
        return;
      }

      (match.judgeIds ?? []).forEach(
        (judgeId) => {
          if (judgeId) {
            uniqueJudgeIds.add(judgeId);
          }
        },
      );

      if (match.judgeId) {
        uniqueJudgeIds.add(
          match.judgeId,
        );
      }
    });

    if (uniqueJudgeIds.size >= 4) {
      return uniqueJudgeIds.size;
    }

    return 4;
  };

  const getSubmittedJudgeIds = (
    group: ReviewGroup,
  ) => {
    return new Set(
      group.submissions
        .map(
          (submission) =>
            submission.submittedJudgeId,
        )
        .filter(Boolean),
    );
  };

  const getMatchInfo = (
    group: ReviewGroup,
  ) => {
    return assignedMatches.find(
      (match) =>
        match.id === group.matchId,
    );
  };

  const getRefereeEventsForGroup = (
    group: ReviewGroup,
  ) => {
    return refereeEvents.filter(
      (event) =>
        event.matchId ===
          group.matchId &&
        event.roundNumber ===
          group.roundNumber,
    );
  };

  const getOverridesForSubmission = (
    submission: StoredRoundReview,
  ) => {
    return adminOverrides.filter(
      (override) =>
        override.field ===
          `ROUND_${submission.roundNumber}_${submission.submittedJudgeId}` &&
        override.previousValue.includes(
          `${submission.matchId}:`,
        ),
    );
  };

  const calculateTotals = (
    group: ReviewGroup,
  ) => {
    const redTotal =
      group.submissions.reduce(
        (total, submission) =>
          total +
          Number(
            submission.redScore || 0,
          ),
        0,
      );

    const blueTotal =
      group.submissions.reduce(
        (total, submission) =>
          total +
          Number(
            submission.blueScore || 0,
          ),
        0,
      );

    return {
      redTotal,
      blueTotal,
    };
  };

  const calculateRoundWinner = (
    redTotal: number,
    blueTotal: number,
  ): 'RED' | 'BLUE' | 'DRAW' => {
    if (redTotal > blueTotal) {
      return 'RED';
    }

    if (blueTotal > redTotal) {
      return 'BLUE';
    }

    return 'DRAW';
  };

  const getOverallWinner = (
    groupList: ReviewGroup[],
  ): {
    winner: 'RED' | 'BLUE' | 'DRAW';
    redTotal: number;
    blueTotal: number;
  } => {
    const approvedSubmissions =
      groupList.flatMap((group) =>
        group.submissions.filter(
          (submission) =>
            submission.status ===
            'APPROVED',
        ),
      );

    const redTotal =
      approvedSubmissions.reduce(
        (total, submission) =>
          total +
          Number(
            submission.redScore || 0,
          ),
        0,
      );

    const blueTotal =
      approvedSubmissions.reduce(
        (total, submission) =>
          total +
          Number(
            submission.blueScore || 0,
          ),
        0,
      );

    return {
      winner: calculateRoundWinner(
        redTotal,
        blueTotal,
      ),
      redTotal,
      blueTotal,
    };
  };

  const finalizeCompletedMatch = async (
    group: ReviewGroup,
  ) => {
    if (
      !group.tournamentId ||
      !group.tournamentMatchId
    ) {
      return null;
    }

    const matchInfo =
      getMatchInfo(group);

    const requiredRounds =
      matchInfo?.rounds ||
      group.roundNumber;

    /*
     * IMPORTANT:
     * The current round has just been approved,
     * but React state may still contain the old
     * PENDING status.
     *
     * Therefore we create a temporary review
     * collection where the current group is treated
     * as APPROVED.
     */
    const matchGroups =
      reviewGroups
        .filter((item) => {
          if (
            item.matchId !==
            group.matchId
          ) {
            return false;
          }

          if (
            group.tournamentMatchId &&
            item.tournamentMatchId &&
            item.tournamentMatchId !==
              group.tournamentMatchId
          ) {
            return false;
          }

          return true;
        })
        .map((item) => {
          if (
            item.key !== group.key
          ) {
            return item;
          }

          return {
            ...item,
            submissions:
              item.submissions.map(
                (submission) => ({
                  ...submission,
                  status:
                    'APPROVED' as RoundVerificationStatus,
                }),
              ),
          };
        });

    const approvedRounds =
      new Set(
        matchGroups
          .filter(
            (item) =>
              item.submissions.length >
                0 &&
              item.submissions.every(
                (submission) =>
                  submission.status ===
                  'APPROVED',
              ),
          )
          .map(
            (item) =>
              item.roundNumber,
          ),
      );

    for (
      let roundNumber = 1;
      roundNumber <= requiredRounds;
      roundNumber += 1
    ) {
      if (
        !approvedRounds.has(
          roundNumber,
        )
      ) {
        Alert.alert(
          'FINAL ROUND NOT READY',
          `Round ${roundNumber} is not fully approved yet.`,
        );

        return null;
      }
    }

    const tournament =
      await getTournamentById(
        group.tournamentId,
      );

    if (!tournament) {
      throw new Error(
        'Tournament record not found.',
      );
    }

    const match =
      tournament.weightCategories
        .flatMap(
          (category) =>
            category.matches,
        )
        .find(
          (item) =>
            item.id ===
            group.tournamentMatchId,
        );

    if (!match) {
      throw new Error(
        'Tournament match record not found.',
      );
    }

    if (
      match.status ===
        'COMPLETED' &&
      match.winner
    ) {
      return {
        winnerName: match.winner,
        redTotal: 0,
        blueTotal: 0,
      };
    }

    const result =
      getOverallWinner(
        matchGroups,
      );

    const winnerName =
      result.winner === 'RED'
        ? match.redBoxer || 'RED'
        : result.winner === 'BLUE'
          ? match.blueBoxer ||
            'BLUE'
          : 'DRAW';

    const winnerClub =
      result.winner === 'RED'
        ? match.redClub || null
        : result.winner === 'BLUE'
          ? match.blueClub || null
          : null;

    const approvedRoundReviews: TournamentRoundReview[] =
      matchGroups
        .flatMap(
          (item) =>
            item.submissions,
        )
        .filter(
          (submission) =>
            submission.status ===
            'APPROVED',
        )
        .reduce<TournamentRoundReview[]>(
          (
            list,
            submission,
          ) => {
            const existing =
              list.find(
                (review) =>
                  review.roundNumber ===
                  submission.roundNumber,
              );

            if (existing) {
              existing.judgeScores.push(
                {
                  judgeId:
                    submission.submittedJudgeId,
                  judgeName:
                    submission.submittedJudgeName,
                  redScore:
                    submission.redScore,
                  blueScore:
                    submission.blueScore,
                  submittedAt:
                    submission.submittedAt,
                },
              );

              existing.submittedJudgeCount =
                existing
                  .judgeScores
                  .length;

              const redTotal =
                existing.judgeScores.reduce(
                  (
                    total,
                    score,
                  ) =>
                    total +
                    Number(
                      score.redScore ||
                        0,
                    ),
                  0,
                );

              const blueTotal =
                existing.judgeScores.reduce(
                  (
                    total,
                    score,
                  ) =>
                    total +
                    Number(
                      score.blueScore ||
                        0,
                    ),
                  0,
                );

              existing.roundWinner =
                calculateRoundWinner(
                  redTotal,
                  blueTotal,
                );
            } else {
              list.push({
                roundNumber:
                  submission.roundNumber,
                status: 'APPROVED',
                submittedJudgeCount: 1,
                judgeScores: [
                  {
                    judgeId:
                      submission.submittedJudgeId,
                    judgeName:
                      submission.submittedJudgeName,
                    redScore:
                      submission.redScore,
                    blueScore:
                      submission.blueScore,
                    submittedAt:
                      submission.submittedAt,
                  },
                ],
                roundWinner:
                  calculateRoundWinner(
                    submission.redScore,
                    submission.blueScore,
                  ),
                approvedBy:
                  'ADM001',
                approvedByName:
                  'SYSTEM ADMIN',
                approvedAt:
                  new Date().toISOString(),
                adminNote:
                  'Round approved by Admin.',
                flagReason: null,
              });
            }

            return list;
          },
          [],
        );

    const now =
      new Date().toISOString();

    const historyDate =
      new Date().toLocaleDateString(
        'en-GB',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        },
      );

    const historyTime =
      new Date().toLocaleTimeString(
        'en-US',
        {
          hour: 'numeric',
          minute: '2-digit',
        },
      );

    await saveMatch({
      id: `MATCH-${group.matchId}-${Date.now()}`,
      redBoxer:
        match.redBoxer ||
        'RED BOXER',
      blueBoxer:
        match.blueBoxer ||
        'BLUE BOXER',
      weightCategory:
        match.weightCategory,
      rounds: requiredRounds,
      matchType:
        match.matchType,
      redScore:
        result.redTotal,
      blueScore:
        result.blueTotal,
      winner: winnerName,
      result:
        result.winner === 'DRAW'
          ? 'DRAW'
          : result.winner ===
              'RED'
            ? 'WON'
            : 'LOST',
      date: historyDate,
      time: historyTime,
    });

    const updatedCategories =
      tournament.weightCategories.map(
        (category) => ({
          ...category,
          matches:
            category.matches.map(
              (item) =>
                item.id ===
                group.tournamentMatchId
                  ? {
                      ...item,
                      status:
                        'COMPLETED' as const,
                      winner:
                        winnerName,
                      winnerClub:
                        winnerClub,
                      roundReviews:
                        approvedRoundReviews,
                      adminVerified:
                        true,
                      adminVerifiedBy:
                        'ADM001',
                      adminVerifiedByName:
                        'SYSTEM ADMIN',
                      adminVerifiedAt:
                        now,
                    }
                  : item,
            ),
        }),
      );

    /*
     * Advance the official winner into
     * the next bracket bout.
     */
    if (
      match.nextMatchId &&
      result.winner !== 'DRAW'
    ) {
      const nextMatchCategoryIndex =
        updatedCategories.findIndex(
          (category) =>
            category.matches.some(
              (item) =>
                item.id ===
                match.nextMatchId,
            ),
        );

      if (
        nextMatchCategoryIndex >= 0
      ) {
        const nextCategory =
          updatedCategories[
            nextMatchCategoryIndex
          ];

        const nextMatchIndex =
          nextCategory.matches.findIndex(
            (item) =>
              item.id ===
              match.nextMatchId,
          );

        if (nextMatchIndex >= 0) {
          const nextMatch =
            nextCategory.matches[
              nextMatchIndex
            ];

          const sourceText =
            `${match.round} Match ${match.matchNumber} — ${winnerName}`;

          const winnerSlotIsRed =
            nextMatch.redSourceMatchId ===
              match.id ||
            (!nextMatch.redBoxer &&
              !nextMatch.redSourceMatchId);

          const winnerSlotIsBlue =
            nextMatch.blueSourceMatchId ===
              match.id ||
            (!nextMatch.blueBoxer &&
              !nextMatch.blueSourceMatchId);

          let updatedNextMatch: TournamentMatch =
            {
              ...nextMatch,
            };

          if (winnerSlotIsRed) {
            updatedNextMatch = {
              ...updatedNextMatch,
              redBoxer:
                winnerName,
              redClub:
                winnerClub,
              redSourceMatchId:
                match.id,
              redSourceText:
                sourceText,
            };
          } else if (
            winnerSlotIsBlue
          ) {
            updatedNextMatch = {
              ...updatedNextMatch,
              blueBoxer:
                winnerName,
              blueClub:
                winnerClub,
              blueSourceMatchId:
                match.id,
              blueSourceText:
                sourceText,
            };
          }

          updatedNextMatch = {
            ...updatedNextMatch,
            status:
              updatedNextMatch.redBoxer &&
              updatedNextMatch.blueBoxer
                ? 'UPCOMING'
                : 'LOCKED',
          };

          nextCategory.matches[
            nextMatchIndex
          ] = updatedNextMatch;
        }
      }
    }

    const allMatches =
      updatedCategories.flatMap(
        (category) =>
          category.matches,
      );

    const allMatchesCompleted =
      allMatches.length > 0 &&
      allMatches.every(
        (item) =>
          item.status ===
          'COMPLETED',
      );

    const anyMatchLive =
      allMatches.some(
        (item) =>
          item.status === 'LIVE',
      );

    const anyMatchCompleted =
      allMatches.some(
        (item) =>
          item.status ===
          'COMPLETED',
      );

    /*
     * IMPORTANT:
     * Only one updatedTournament declaration.
     */
    const updatedTournament: Tournament =
      {
        ...tournament,
        status:
          allMatchesCompleted
            ? 'COMPLETED'
            : anyMatchLive ||
                anyMatchCompleted
              ? 'LIVE'
              : tournament.status,
        weightCategories:
          updatedCategories,
      };

    await saveTournament(
      updatedTournament,
    );

    const storedAssignments =
      await AsyncStorage.getItem(
        ASSIGNED_MATCHES_KEY,
      );

    const assignments: AssignedMatch[] =
      storedAssignments
        ? JSON.parse(
            storedAssignments,
          )
        : [];

    if (
      Array.isArray(assignments)
    ) {
      const updatedAssignments =
        assignments.map(
          (assignment) => {
            const sameTournamentMatch =
              assignment.tournamentMatchId ===
                group.tournamentMatchId &&
              assignment.tournamentId ===
                group.tournamentId;

            const sameScoringMatch =
              assignment.id ===
              group.matchId;

            if (
              !sameTournamentMatch &&
              !sameScoringMatch
            ) {
              return assignment;
            }

            return {
              ...assignment,
              status: 'COMPLETED',
              winner: winnerName,
              result:
                result.winner ===
                'DRAW'
                  ? 'DRAW'
                  : result.winner ===
                      'RED'
                    ? 'WON'
                    : 'LOST',
              redScore:
                result.redTotal,
              blueScore:
                result.blueTotal,
            };
          },
        );

      await AsyncStorage.setItem(
        ASSIGNED_MATCHES_KEY,
        JSON.stringify(
          updatedAssignments,
        ),
      );
    }

    return {
      winnerName,
      redTotal:
        result.redTotal,
      blueTotal:
        result.blueTotal,
    };
  };

  const openEditModal = (
    group: ReviewGroup,
    submission: StoredRoundReview,
  ) => {
    setEditingSubmission({
      groupKey: group.key,
      submissionId:
        submission.id,
      judgeName:
        submission.submittedJudgeName,
      redScore:
        submission.redScore,
      blueScore:
        submission.blueScore,
    });

    setEditRedScore(
      String(submission.redScore),
    );

    setEditBlueScore(
      String(submission.blueScore),
    );

    setEditReason('');
  };

  const closeEditModal = () => {
    if (savingEdit) {
      return;
    }

    setEditingSubmission(null);
    setEditRedScore('');
    setEditBlueScore('');
    setEditReason('');
  };

  const saveJudgeScoreEdit =
    async () => {
      if (!editingSubmission) {
        return;
      }

      const newRedScore =
        Number(editRedScore);

      const newBlueScore =
        Number(editBlueScore);

      const reason =
        editReason.trim();

      if (
        !Number.isInteger(
          newRedScore,
        ) ||
        !Number.isInteger(
          newBlueScore,
        )
      ) {
        Alert.alert(
          'Invalid Score',
          'Enter whole-number scores for both boxers.',
        );

        return;
      }

      if (
        newRedScore < 0 ||
        newRedScore > 20 ||
        newBlueScore < 0 ||
        newBlueScore > 20
      ) {
        Alert.alert(
          'Invalid Score',
          'Scores must be between 0 and 20.',
        );

        return;
      }

      if (!reason) {
        Alert.alert(
          'Reason Required',
          'Enter a reason for the Admin score correction.',
        );

        return;
      }

      const submission =
        reviews.find(
          (item) =>
            item.id ===
            editingSubmission.submissionId,
        );

      if (!submission) {
        Alert.alert(
          'Error',
          'The selected judge submission could not be found.',
        );

        return;
      }

      if (
        newRedScore ===
          submission.redScore &&
        newBlueScore ===
          submission.blueScore
      ) {
        Alert.alert(
          'No Change',
          'The new scores are the same as the current scores.',
        );

        return;
      }

      Alert.alert(
        'Confirm Score Correction',
        `Judge: ${submission.submittedJudgeName}\n\n` +
          `Current: ${submission.redScore} - ${submission.blueScore}\n` +
          `New: ${newRedScore} - ${newBlueScore}\n\n` +
          `Reason: ${reason}`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'SAVE CORRECTION',
            onPress:
              async () => {
                setSavingEdit(true);

                try {
                  const storedReviews =
                    await AsyncStorage.getItem(
                      ROUND_REVIEWS_KEY,
                    );

                  const allReviews: StoredRoundReview[] =
                    storedReviews
                      ? JSON.parse(
                          storedReviews,
                        )
                      : [];

                  const updatedReviews =
                    allReviews.map(
                      (review) => {
                        if (
                          review.id !==
                          submission.id
                        ) {
                          return review;
                        }

                        return {
                          ...review,
                          redScore:
                            newRedScore,
                          blueScore:
                            newBlueScore,
                        };
                      },
                    );

                  await AsyncStorage.setItem(
                    ROUND_REVIEWS_KEY,
                    JSON.stringify(
                      updatedReviews,
                    ),
                  );

                  const storedOverrides =
                    await AsyncStorage.getItem(
                      ADMIN_OVERRIDES_KEY,
                    );

                  const allOverrides: AdminOverride[] =
                    storedOverrides
                      ? JSON.parse(
                          storedOverrides,
                        )
                      : [];

                  const now =
                    new Date().toISOString();

                  const newOverride: AdminOverride =
                    {
                      id: `OVR-${Date.now()}`,
                      adminId:
                        'ADM001',
                      adminName:
                        'SYSTEM ADMIN',
                      field:
                        `ROUND_${submission.roundNumber}_${submission.submittedJudgeId}`,
                      previousValue:
                        `${submission.matchId}: ` +
                        `${submission.redScore}-${submission.blueScore}`,
                      newValue:
                        `${submission.matchId}: ` +
                        `${newRedScore}-${newBlueScore}`,
                      reason,
                      createdAt: now,
                    };

                  const updatedOverrides =
                    [
                      ...allOverrides,
                      newOverride,
                    ];

                  await AsyncStorage.setItem(
                    ADMIN_OVERRIDES_KEY,
                    JSON.stringify(
                      updatedOverrides,
                    ),
                  );

                  if (
                    submission.tournamentId &&
                    submission.tournamentMatchId
                  ) {
                    const tournament =
                      await getTournamentById(
                        submission.tournamentId,
                      );

                    if (tournament) {
                      const updatedCategories =
                        tournament.weightCategories.map(
                          (category) => ({
                            ...category,
                            matches:
                              category.matches.map(
                                (match) => {
                                  if (
                                    match.id !==
                                    submission.tournamentMatchId
                                  ) {
                                    return match;
                                  }

                                  const existingReviews =
                                    match.roundReviews ??
                                    [];

                                  const existingIndex =
                                    existingReviews.findIndex(
                                      (review) =>
                                        review.roundNumber ===
                                        submission.roundNumber,
                                    );

                                  if (
                                    existingIndex <
                                    0
                                  ) {
                                    return match;
                                  }

                                  const currentReview =
                                    existingReviews[
                                      existingIndex
                                    ];

                                  const updatedJudgeScores =
                                    currentReview.judgeScores.map(
                                      (
                                        judgeScore,
                                      ) => {
                                        if (
                                          judgeScore.judgeId !==
                                          submission.submittedJudgeId
                                        ) {
                                          return judgeScore;
                                        }

                                        return {
                                          ...judgeScore,
                                          redScore:
                                            newRedScore,
                                          blueScore:
                                            newBlueScore,
                                        };
                                      },
                                    );

                                  const redTotal =
                                    updatedJudgeScores.reduce(
                                      (
                                        total,
                                        score,
                                      ) =>
                                        total +
                                        Number(
                                          score.redScore ||
                                            0,
                                        ),
                                      0,
                                    );

                                  const blueTotal =
                                    updatedJudgeScores.reduce(
                                      (
                                        total,
                                        score,
                                      ) =>
                                        total +
                                        Number(
                                          score.blueScore ||
                                            0,
                                        ),
                                      0,
                                    );

                                  const updatedReview: TournamentRoundReview =
                                    {
                                      ...currentReview,
                                      judgeScores:
                                        updatedJudgeScores,
                                      roundWinner:
                                        calculateRoundWinner(
                                          redTotal,
                                          blueTotal,
                                        ),
                                    };

                                  const updatedRoundReviews =
                                    [
                                      ...existingReviews,
                                    ];

                                  updatedRoundReviews[
                                    existingIndex
                                  ] =
                                    updatedReview;

                                  const existingMatchOverrides =
                                    match.adminOverrides ??
                                    [];

                                  return {
                                    ...match,
                                    roundReviews:
                                      updatedRoundReviews,
                                    adminOverrides:
                                      [
                                        ...existingMatchOverrides,
                                        newOverride,
                                      ],
                                  };
                                },
                              ),
                          }),
                        );

                      await saveTournament({
                        ...tournament,
                        weightCategories:
                          updatedCategories,
                      });
                    }
                  }

                  await loadData();

                  Alert.alert(
                    'Score Updated',
                    `The score for ${submission.submittedJudgeName} has been corrected and the Admin change has been recorded.`,
                  );

                  closeEditModal();
                } catch (error) {
                  console.log(
                    'Error saving Admin score correction:',
                    error,
                  );

                  Alert.alert(
                    'Error',
                    'The score correction could not be saved.',
                  );
                } finally {
                  setSavingEdit(false);
                }
              },
          },
        ],
      );
    };

  const updateRoundReviewStatuses =
    async (
      group: ReviewGroup,
      status: RoundVerificationStatus,
      adminNote: string | null,
      flagReason: string | null,
    ) => {
      try {
        const stored =
          await AsyncStorage.getItem(
            ROUND_REVIEWS_KEY,
          );

        const allReviews: StoredRoundReview[] =
          stored
            ? JSON.parse(stored)
            : [];

        const now =
          new Date().toISOString();

        const updatedReviews =
          allReviews.map(
            (review) => {
              if (
                review.matchId ===
                  group.matchId &&
                review.roundNumber ===
                  group.roundNumber &&
                review.tournamentId ===
                  group.tournamentId &&
                review.tournamentMatchId ===
                  group.tournamentMatchId
              ) {
                return {
                  ...review,
                  status,
                };
              }

              return review;
            },
          );

        await AsyncStorage.setItem(
          ROUND_REVIEWS_KEY,
          JSON.stringify(
            updatedReviews,
          ),
        );

        if (
          group.tournamentId &&
          group.tournamentMatchId
        ) {
          const tournament =
            await getTournamentById(
              group.tournamentId,
            );

          if (tournament) {
            const updatedCategories =
              tournament.weightCategories.map(
                (category) => {
                  const matchExists =
                    category.matches.some(
                      (match) =>
                        match.id ===
                        group.tournamentMatchId,
                    );

                  if (!matchExists) {
                    return category;
                  }

                  return {
                    ...category,
                    matches:
                      category.matches.map(
                        (match) => {
                          if (
                            match.id !==
                            group.tournamentMatchId
                          ) {
                            return match;
                          }

                          const existingReviews: TournamentRoundReview[] =
                            match.roundReviews ??
                            [];

                          const existingIndex =
                            existingReviews.findIndex(
                              (review) =>
                                review.roundNumber ===
                                group.roundNumber,
                            );

                          const totals =
                            calculateTotals(
                              group,
                            );

                          const updatedReview: TournamentRoundReview =
                            {
                              roundNumber:
                                group.roundNumber,
                              status,
                              submittedJudgeCount:
                                group.submissions.length,
                              judgeScores:
                                group.submissions.map(
                                  (
                                    submission,
                                  ) => ({
                                    judgeId:
                                      submission.submittedJudgeId,
                                    judgeName:
                                      submission.submittedJudgeName,
                                    redScore:
                                      submission.redScore,
                                    blueScore:
                                      submission.blueScore,
                                    submittedAt:
                                      submission.submittedAt,
                                  }),
                                ),
                              roundWinner:
                                calculateRoundWinner(
                                  totals.redTotal,
                                  totals.blueTotal,
                                ),
                              approvedBy:
                                status ===
                                'APPROVED'
                                  ? 'ADM001'
                                  : null,
                              approvedByName:
                                status ===
                                'APPROVED'
                                  ? 'SYSTEM ADMIN'
                                  : null,
                              approvedAt:
                                status ===
                                'APPROVED'
                                  ? now
                                  : null,
                              adminNote,
                              flagReason,
                            };

                          let updatedReviewsForMatch: TournamentRoundReview[];

                          if (
                            existingIndex >=
                            0
                          ) {
                            updatedReviewsForMatch =
                              [
                                ...existingReviews,
                              ];

                            updatedReviewsForMatch[
                              existingIndex
                            ] =
                              updatedReview;
                          } else {
                            updatedReviewsForMatch =
                              [
                                ...existingReviews,
                                updatedReview,
                              ];
                          }

                          return {
                            ...match,
                            roundReviews:
                              updatedReviewsForMatch,
                          };
                        },
                      ),
                  };
                },
              );

            await saveTournament({
              ...tournament,
              weightCategories:
                updatedCategories,
            });
          }
        }
      } catch (error) {
        console.log(
          'Error updating round review:',
          error,
        );

        throw error;
      }
    };

  const approveRound = (
    group: ReviewGroup,
  ) => {
    const assignedJudgeCount =
      getAssignedJudgeCount(group);

    const submittedJudgeIds =
      getSubmittedJudgeIds(group);

    if (
      submittedJudgeIds.size <
      assignedJudgeCount
    ) {
      Alert.alert(
        'Cannot Approve Yet',
        `Only ${submittedJudgeIds.size} of ${assignedJudgeCount} assigned judges have submitted this round.`,
      );

      return;
    }

    Alert.alert(
      'Approve Round',
      `Approve Round ${group.roundNumber} for this match?\n\nAfter approval, the judges will be allowed to continue to the next round.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'APPROVE',
          onPress:
            async () => {
              setProcessingKey(
                group.key,
              );

              try {
                await updateRoundReviewStatuses(
                  group,
                  'APPROVED',
                  'Round approved by Admin.',
                  null,
                );

                const isFinalRound =
                  group.roundNumber ===
                  (getMatchInfo(group)
                    ?.rounds ||
                    group.roundNumber);

                if (isFinalRound) {
                  const finalResult =
                    await finalizeCompletedMatch(
                      group,
                    );

                  await loadData();

                  if (finalResult) {
                    Alert.alert(
                      'OFFICIAL RESULT VERIFIED',
                      `${finalResult.winnerName} is the official result.\n\nRed total: ${finalResult.redTotal}\nBlue total: ${finalResult.blueTotal}\n\nThe tournament match is now completed and the result has been saved.`,
                    );
                  }
                } else {
                  await loadData();

                  Alert.alert(
                    'Round Approved',
                    `Round ${group.roundNumber} has been approved. The next round can now be scored.`,
                  );
                }
              } catch (error) {
                console.log(
                  'Error approving round:',
                  error,
                );

                Alert.alert(
                  'Error',
                  'The round could not be approved. Please try again.',
                );
              } finally {
                setProcessingKey(
                  null,
                );
              }
            },
        },
      ],
    );
  };

  const flagRound = (
    group: ReviewGroup,
  ) => {
    Alert.alert(
      'Flag Round',
      `Flag Round ${group.roundNumber} for review?\n\nJudges will remain locked until the Admin resolves the issue.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'FLAG ROUND',
          style: 'destructive',
          onPress:
            async () => {
              setProcessingKey(
                group.key,
              );

              try {
                await updateRoundReviewStatuses(
                  group,
                  'FLAGGED',
                  'Round flagged by Admin.',
                  'Admin requested review of this round.',
                );

                await loadData();

                Alert.alert(
                  'Round Flagged',
                  'The round has been flagged and remains locked.',
                );
              } catch {
                Alert.alert(
                  'Error',
                  'The round could not be flagged. Please try again.',
                );
              } finally {
                setProcessingKey(
                  null,
                );
              }
            },
        },
      ],
    );
  };

  const renderStatus = (
    group: ReviewGroup,
  ) => {
    const statuses =
      group.submissions.map(
        (submission) =>
          submission.status,
      );

    if (
      statuses.length > 0 &&
      statuses.every(
        (status) =>
          status === 'APPROVED',
      )
    ) {
      return {
        label: 'APPROVED',
        style:
          styles.statusApproved,
      };
    }

    if (
      statuses.some(
        (status) =>
          status === 'FLAGGED',
      )
    ) {
      return {
        label: 'FLAGGED',
        style:
          styles.statusFlagged,
      };
    }

    return {
      label: 'READY FOR ADMIN',
      style:
        styles.statusPending,
    };
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={onRefresh}
            tintColor="#E53935"
          />
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={styles.header}
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={styles.backText}
            >
              ‹
            </Text>
          </Pressable>

          <View
            style={
              styles.headerTitleContainer
            }
          >
            <Text
              style={styles.eyebrow}
            >
              ADMIN CONTROL
            </Text>

            <Text
              style={styles.title}
            >
              Match Review
            </Text>
          </View>

          <View
            style={styles.adminBadge}
          >
            <Text
              style={
                styles.adminBadgeText
              }
            >
              ADMIN
            </Text>
          </View>
        </View>

        <View
          style={styles.infoBanner}
        >
          <Text
            style={styles.infoTitle}
          >
            ROUND VERIFICATION
          </Text>

          <Text
            style={styles.infoText}
          >
            Review every judge independently.
            Admin score corrections require a
            reason and are recorded in the audit
            history.
          </Text>
        </View>

        {filteredGroups.length ===
        0 ? (
          <View
            style={styles.emptyCard}
          >
            <Text
              style={styles.emptyIcon}
            >
              ✓
            </Text>

            <Text
              style={styles.emptyTitle}
            >
              NO ROUND REVIEWS
            </Text>

            <Text
              style={styles.emptyText}
            >
              There are currently no submitted
              rounds waiting for Admin review.
            </Text>
          </View>
        ) : (
          filteredGroups.map(
            (group) => {
              const matchInfo =
                getMatchInfo(
                  group,
                );

              const submittedJudgeIds =
                getSubmittedJudgeIds(
                  group,
                );

              const assignedJudgeCount =
                getAssignedJudgeCount(
                  group,
                );

              const allJudgesSubmitted =
                submittedJudgeIds.size >=
                assignedJudgeCount;

              const totals =
                calculateTotals(
                  group,
                );

              const events =
                getRefereeEventsForGroup(
                  group,
                );

              const status =
                renderStatus(
                  group,
                );

              const expanded =
                selectedKey ===
                group.key;

              const processing =
                processingKey ===
                group.key;

              return (
                <View
                  key={group.key}
                  style={
                    styles.reviewCard
                  }
                >
                  <Pressable
                    onPress={() =>
                      setSelectedKey(
                        expanded
                          ? null
                          : group.key,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.reviewHeader,
                      pressed &&
                        styles.cardPressed,
                    ]}
                  >
                    <View
                      style={
                        styles.roundBadge
                      }
                    >
                      <Text
                        style={
                          styles.roundBadgeSmall
                        }
                      >
                        ROUND
                      </Text>

                      <Text
                        style={
                          styles.roundBadgeNumber
                        }
                      >
                        {
                          group.roundNumber
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.reviewHeaderInfo
                      }
                    >
                      <Text
                        style={
                          styles.matchId
                        }
                      >
                        MATCH {group.matchId}
                      </Text>

                      <Text
                        style={
                          styles.boxerNames
                        }
                      >
                        {matchInfo?.redBoxer ??
                          'RED'}{' '}
                        <Text
                          style={
                            styles.vs
                          }
                        >
                          VS
                        </Text>{' '}
                        {matchInfo?.blueBoxer ??
                          'BLUE'}
                      </Text>

                      <Text
                        style={
                          styles.weight
                        }
                      >
                        {matchInfo?.weightCategory ??
                          'Weight category'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.statusColumn
                      }
                    >
                      <View
                        style={
                          status.style
                        }
                      >
                        <Text
                          style={
                            styles.statusText
                          }
                        >
                          {
                            status.label
                          }
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.expandText
                        }
                      >
                        {expanded
                          ? '▲'
                          : '▼'}
                      </Text>
                    </View>
                  </Pressable>

                  <View
                    style={
                      styles.submissionSummary
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.summaryLabel
                        }
                      >
                        JUDGES
                      </Text>

                      <Text
                        style={
                          styles.summaryValue
                        }
                      >
                        {
                          submittedJudgeIds.size
                        }
                        /
                        {
                          assignedJudgeCount
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.summaryDivider
                      }
                    />

                    <View>
                      <Text
                        style={
                          styles.summaryLabel
                        }
                      >
                        RED TOTAL
                      </Text>

                      <Text
                        style={
                          styles.summaryValue
                        }
                      >
                        {
                          totals.redTotal
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.summaryDivider
                      }
                    />

                    <View>
                      <Text
                        style={
                          styles.summaryLabel
                        }
                      >
                        BLUE TOTAL
                      </Text>

                      <Text
                        style={
                          styles.summaryValue
                        }
                      >
                        {
                          totals.blueTotal
                        }
                      </Text>
                    </View>
                  </View>

                  {expanded && (
                    <View
                      style={
                        styles.expandedContent
                      }
                    >
                      <Text
                        style={
                          styles.sectionTitle
                        }
                      >
                        JUDGE SCORES
                      </Text>

                      {group.submissions.map(
                        (
                          submission,
                        ) => {
                          const overrides =
                            getOverridesForSubmission(
                              submission,
                            );

                          return (
                            <View
                              key={`${group.key}_${submission.submittedJudgeId}`}
                              style={
                                styles.judgeCard
                              }
                            >
                              <View
                                style={
                                  styles.judgeTopRow
                                }
                              >
                                <View
                                  style={
                                    styles.judgeInfo
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
                                      {submission.submittedJudgeName
                                        .charAt(
                                          0,
                                        )
                                        .toUpperCase()}
                                    </Text>
                                  </View>

                                  <View>
                                    <Text
                                      style={
                                        styles.judgeName
                                      }
                                    >
                                      {
                                        submission.submittedJudgeName
                                      }
                                    </Text>

                                    <Text
                                      style={
                                        styles.judgeId
                                      }
                                    >
                                      {
                                        submission.submittedJudgeId
                                      }
                                    </Text>
                                  </View>
                                </View>

                                <Pressable
                                  onPress={() =>
                                    openEditModal(
                                      group,
                                      submission,
                                    )
                                  }
                                  style={({
                                    pressed,
                                  }) => [
                                    styles.editButton,
                                    pressed &&
                                      styles.buttonPressed,
                                  ]}
                                >
                                  <Text
                                    style={
                                      styles.editButtonText
                                    }
                                  >
                                    ✎ EDIT
                                  </Text>
                                </Pressable>
                              </View>

                              <View
                                style={
                                  styles.scoreRow
                                }
                              >
                                <View
                                  style={
                                    styles.scoreBoxRed
                                  }
                                >
                                  <Text
                                    style={
                                      styles.scoreBoxLabel
                                    }
                                  >
                                    RED
                                  </Text>

                                  <Text
                                    style={
                                      styles.scoreBoxValue
                                    }
                                  >
                                    {
                                      submission.redScore
                                    }
                                  </Text>
                                </View>

                                <Text
                                  style={
                                    styles.scoreVs
                                  }
                                >
                                  —
                                </Text>

                                <View
                                  style={
                                    styles.scoreBoxBlue
                                  }
                                >
                                  <Text
                                    style={
                                      styles.scoreBoxLabel
                                    }
                                  >
                                    BLUE
                                  </Text>

                                  <Text
                                    style={
                                      styles.scoreBoxValue
                                    }
                                  >
                                    {
                                      submission.blueScore
                                    }
                                  </Text>
                                </View>
                              </View>

                              {overrides.length >
                                0 && (
                                <View
                                  style={
                                    styles.auditCard
                                  }
                                >
                                  <Text
                                    style={
                                      styles.auditTitle
                                    }
                                  >
                                    ADMIN CORRECTION
                                  </Text>

                                  {overrides.map(
                                    (
                                      override,
                                    ) => (
                                      <View
                                        key={
                                          override.id
                                        }
                                        style={
                                          styles.auditItem
                                        }
                                      >
                                        <Text
                                          style={
                                            styles.auditText
                                          }
                                        >
                                          {
                                            override.previousValue
                                          }{' '}
                                          →
                                          {' '}
                                          {
                                            override.newValue
                                          }
                                        </Text>

                                        <Text
                                          style={
                                            styles.auditReason
                                          }
                                        >
                                          {
                                            override.reason
                                          }
                                        </Text>
                                      </View>
                                    ),
                                  )}
                                </View>
                              )}
                            </View>
                          );
                        },
                      )}

                      {group.submissions
                        .length ===
                        0 && (
                        <Text
                          style={
                            styles.noDataText
                          }
                        >
                          No judge submissions
                          found.
                        </Text>
                      )}

                      <Text
                        style={
                          styles.sectionTitle
                        }
                      >
                        REFEREE EVENTS
                      </Text>

                      {events.length ===
                      0 ? (
                        <View
                          style={
                            styles.noEventsCard
                          }
                        >
                          <Text
                            style={
                              styles.noEventsText
                            }
                          >
                            No referee events recorded
                            for this round.
                          </Text>
                        </View>
                      ) : (
                        events.map(
                          (event) => (
                            <View
                              key={
                                event.id
                              }
                              style={
                                styles.eventItem
                              }
                            >
                              <View
                                style={
                                  styles.eventTime
                                }
                              >
                                <Text
                                  style={
                                    styles.eventTimeText
                                  }
                                >
                                  {
                                    event.time
                                  }
                                </Text>
                              </View>

                              <View
                                style={
                                  styles.eventInfo
                                }
                              >
                                <Text
                                  style={
                                    styles.eventType
                                  }
                                >
                                  {event.type.replace(
                                    '_',
                                    ' ',
                                  )}
                                </Text>

                                <Text
                                  style={
                                    styles.eventDetails
                                  }
                                >
                                  {event.corner
                                    ? `${event.corner} corner`
                                    : 'Both / match'}
                                  {event.refereeName
                                    ? ` • ${event.refereeName}`
                                    : ''}
                                </Text>

                                {event.note ? (
                                  <Text
                                    style={
                                      styles.eventNote
                                    }
                                  >
                                    {
                                      event.note
                                    }
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          ),
                        )
                      )}

                      {(() => {
                        const isFinalRound =
                          group.roundNumber ===
                          (matchInfo?.rounds ||
                            group.roundNumber);

                        if (
                          !isFinalRound ||
                          status.label !==
                            'APPROVED'
                        ) {
                          return null;
                        }

                        const finalResult =
                          getOverallWinner(
                            reviewGroups.filter(
                              (item) =>
                                item.matchId ===
                                group.matchId,
                            ),
                          );

                        const winnerName =
                          finalResult.winner ===
                          'RED'
                            ? matchInfo?.redBoxer ||
                              'RED'
                            : finalResult.winner ===
                                'BLUE'
                              ? matchInfo?.blueBoxer ||
                                'BLUE'
                              : 'DRAW';

                        return (
                          <View
                            style={
                              styles.officialResultCard
                            }
                          >
                            <Text
                              style={
                                styles.officialResultEyebrow
                              }
                            >
                              OFFICIAL RESULT
                            </Text>

                            <Text
                              style={
                                styles.officialResultTitle
                              }
                            >
                              {
                                winnerName
                              }
                            </Text>

                            <Text
                              style={
                                styles.officialResultText
                              }
                            >
                              RED{' '}
                              {
                                finalResult.redTotal
                              }{' '}
                              — BLUE{' '}
                              {
                                finalResult.blueTotal
                              }
                            </Text>
                          </View>
                        );
                      })()}

                      <View
                        style={
                          styles.actionArea
                        }
                      >
                        {!allJudgesSubmitted && (
                          <View
                            style={
                              styles.waitingCard
                            }
                          >
                            <Text
                              style={
                                styles.waitingTitle
                              }
                            >
                              WAITING FOR JUDGES
                            </Text>

                            <Text
                              style={
                                styles.waitingText
                              }
                            >
                              {
                                submittedJudgeIds.size
                              }{' '}
                              of{' '}
                              {
                                assignedJudgeCount
                              }{' '}
                              assigned judges have
                              submitted this round.
                            </Text>
                          </View>
                        )}

                        {allJudgesSubmitted &&
                          status.label !==
                            'APPROVED' && (
                            <>
                              <Pressable
                                disabled={
                                  processing
                                }
                                onPress={() =>
                                  approveRound(
                                    group,
                                  )
                                }
                                style={({
                                  pressed,
                                }) => [
                                  styles.approveButton,
                                  pressed &&
                                    styles.buttonPressed,
                                  processing &&
                                    styles.disabledButton,
                                ]}
                              >
                                <Text
                                  style={
                                    styles.approveText
                                  }
                                >
                                  {processing
                                    ? 'PROCESSING...'
                                    : '✓  APPROVE ROUND'}
                                </Text>
                              </Pressable>

                              <Pressable
                                disabled={
                                  processing
                                }
                                onPress={() =>
                                  flagRound(
                                    group,
                                  )
                                }
                                style={({
                                  pressed,
                                }) => [
                                  styles.flagButton,
                                  pressed &&
                                    styles.buttonPressed,
                                  processing &&
                                    styles.disabledButton,
                                ]}
                              >
                                <Text
                                  style={
                                    styles.flagText
                                  }
                                >
                                  ⚠  FLAG ROUND
                                </Text>
                              </Pressable>
                            </>
                          )}

                        {status.label ===
                          'APPROVED' && (
                          <View
                            style={
                              styles.approvedCard
                            }
                          >
                            <Text
                              style={
                                styles.approvedTitle
                              }
                            >
                              ✓ ROUND APPROVED
                            </Text>

                            <Text
                              style={
                                styles.approvedText
                              }
                            >
                              This round is verified.
                              Judges can proceed to
                              the next round.
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            },
          )
        )}
      </ScrollView>

      <Modal
        visible={
          editingSubmission !== null
        }
        transparent
        animationType="fade"
        onRequestClose={
          closeEditModal
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalCard}
          >
            <Text
              style={styles.modalEyebrow}
            >
              ADMIN CONTROL
            </Text>

            <Text
              style={styles.modalTitle}
            >
              Edit Judge Score
            </Text>

            {editingSubmission && (
              <Text
                style={styles.modalJudge}
              >
                {
                  editingSubmission.judgeName
                }
              </Text>
            )}

            <Text
              style={styles.inputLabel}
            >
              RED SCORE
            </Text>

            <TextInput
              value={editRedScore}
              onChangeText={
                setEditRedScore
              }
              keyboardType="number-pad"
              style={
                styles.scoreInput
              }
              placeholder="10"
              placeholderTextColor="#555D67"
              maxLength={2}
            />

            <Text
              style={styles.inputLabel}
            >
              BLUE SCORE
            </Text>

            <TextInput
              value={editBlueScore}
              onChangeText={
                setEditBlueScore
              }
              keyboardType="number-pad"
              style={
                styles.scoreInput
              }
              placeholder="9"
              placeholderTextColor="#555D67"
              maxLength={2}
            />

            <Text
              style={styles.inputLabel}
            >
              REASON FOR CORRECTION *
            </Text>

            <TextInput
              value={editReason}
              onChangeText={
                setEditReason
              }
              style={[
                styles.reasonInput,
                styles.multilineInput,
              ]}
              placeholder="Explain why the score is being corrected..."
              placeholderTextColor="#555D67"
              multiline
              textAlignVertical="top"
              maxLength={300}
            />

            <Text
              style={styles.auditWarning}
            >
              This correction will be permanently
              recorded in the Admin audit history.
            </Text>

            <View
              style={styles.modalActions}
            >
              <Pressable
                disabled={savingEdit}
                onPress={
                  closeEditModal
                }
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  CANCEL
                </Text>
              </Pressable>

              <Pressable
                disabled={savingEdit}
                onPress={
                  saveJudgeScoreEdit
                }
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed &&
                    styles.buttonPressed,
                  savingEdit &&
                    styles.disabledButton,
                ]}
              >
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  {savingEdit
                    ? 'SAVING...'
                    : 'SAVE CORRECTION'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#171B21',
    borderWidth: 1,
    borderColor: '#292F37',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  backText: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },

  headerTitleContainer: {
    flex: 1,
  },

  eyebrow: {
    color: '#E53935',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 3,
  },

  adminBadge: {
    backgroundColor: '#32191B',
    borderWidth: 1,
    borderColor: '#6B282B',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  adminBadgeText: {
    color: '#F45B5B',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  infoBanner: {
    backgroundColor: '#171B21',
    borderWidth: 1,
    borderColor: '#292F37',
    borderRadius: 15,
    padding: 15,
    marginBottom: 18,
  },

  infoTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },

  infoText: {
    color: '#7D858F',
    fontSize: 11,
    lineHeight: 17,
  },

  emptyCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },

  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#16301F',
    color: '#43A047',
    fontSize: 25,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 50,
    marginBottom: 15,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },

  emptyText: {
    color: '#6F7781',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 8,
  },

  reviewCard: {
    backgroundColor: '#15191F',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#252B32',
    marginBottom: 13,
    overflow: 'hidden',
  },

  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },

  roundBadge: {
    width: 50,
    height: 58,
    borderRadius: 12,
    backgroundColor: '#32191B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  roundBadgeSmall: {
    color: '#C85A5A',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },

  roundBadgeNumber: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 1,
  },

  reviewHeaderInfo: {
    flex: 1,
  },

  matchId: {
    color: '#69717B',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },

  boxerNames: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 5,
  },

  vs: {
    color: '#626A74',
    fontSize: 9,
    fontWeight: '900',
  },

  weight: {
    color: '#747C86',
    fontSize: 9,
    marginTop: 4,
  },

  statusColumn: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  statusPending: {
    backgroundColor: '#332B14',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },

  statusApproved: {
    backgroundColor: '#16301F',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },

  statusFlagged: {
    backgroundColor: '#35191B',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },

  statusText: {
    color: '#D8DCE0',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  expandText: {
    color: '#626A74',
    fontSize: 9,
    marginTop: 8,
  },

  submissionSummary: {
    borderTopWidth: 1,
    borderTopColor: '#252B32',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },

  summaryLabel: {
    color: '#626A74',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
    textAlign: 'center',
  },

  summaryValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 3,
  },

  summaryDivider: {
    width: 1,
    height: 25,
    backgroundColor: '#252B32',
  },

  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#252B32',
    padding: 14,
  },

  sectionTitle: {
    color: '#8A929C',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 5,
    marginBottom: 10,
  },

  judgeCard: {
    backgroundColor: '#111419',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 11,
    marginBottom: 8,
  },

  judgeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  judgeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  judgeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#252B32',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  judgeAvatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  judgeName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },

  judgeId: {
    color: '#626A74',
    fontSize: 8,
    marginTop: 2,
  },

  editButton: {
    backgroundColor: '#252B32',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#3A424B',
  },

  editButtonText: {
    color: '#F9A825',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },

  scoreBoxRed: {
    width: 75,
    backgroundColor: '#32191B',
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },

  scoreBoxBlue: {
    width: 75,
    backgroundColor: '#14243A',
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },

  scoreBoxLabel: {
    color: '#8A929C',
    fontSize: 7,
    fontWeight: '900',
  },

  scoreBoxValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },

  scoreVs: {
    color: '#555D67',
    fontSize: 13,
    fontWeight: '900',
    marginHorizontal: 12,
  },

  auditCard: {
    marginTop: 10,
    backgroundColor: '#2A2415',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#4A3D1B',
    padding: 9,
  },

  auditTitle: {
    color: '#F9A825',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  auditItem: {
    marginTop: 3,
  },

  auditText: {
    color: '#D8DCE0',
    fontSize: 9,
    fontWeight: '800',
  },

  auditReason: {
    color: '#9D936F',
    fontSize: 8,
    marginTop: 3,
    lineHeight: 12,
  },

  noDataText: {
    color: '#6F7781',
    fontSize: 10,
    marginBottom: 15,
  },

  noEventsCard: {
    backgroundColor: '#111419',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
  },

  noEventsText: {
    color: '#626A74',
    fontSize: 10,
  },

  eventItem: {
    flexDirection: 'row',
    backgroundColor: '#111419',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252B32',
    padding: 10,
    marginBottom: 7,
  },

  eventTime: {
    width: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventTimeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  eventInfo: {
    flex: 1,
    marginLeft: 8,
  },

  eventType: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

  eventDetails: {
    color: '#737B85',
    fontSize: 8,
    marginTop: 3,
  },

  eventNote: {
    color: '#9BA2AA',
    fontSize: 8,
    marginTop: 4,
  },

  officialResultCard: {
    backgroundColor: '#16301F',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#2D6335',
    padding: 14,
    marginTop: 14,
    marginBottom: 4,
    alignItems: 'center',
  },

  officialResultEyebrow: {
    color: '#66BB6A',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  officialResultTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 5,
    textAlign: 'center',
  },

  officialResultText: {
    color: '#8DB891',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 4,
  },

  actionArea: {
    marginTop: 10,
  },

  waitingCard: {
    backgroundColor: '#332B14',
    borderRadius: 11,
    padding: 12,
    borderWidth: 1,
    borderColor: '#55461A',
  },

  waitingTitle: {
    color: '#F9A825',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  waitingText: {
    color: '#A79A70',
    fontSize: 9,
    marginTop: 4,
    lineHeight: 14,
  },

  approveButton: {
    height: 48,
    borderRadius: 11,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  approveText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  flagButton: {
    height: 44,
    borderRadius: 11,
    backgroundColor: '#35191B',
    borderWidth: 1,
    borderColor: '#6B282B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  flagText: {
    color: '#F45B5B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  approvedCard: {
    backgroundColor: '#16301F',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#2D6335',
    padding: 13,
  },

  approvedTitle: {
    color: '#66BB6A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  approvedText: {
    color: '#8DB891',
    fontSize: 9,
    lineHeight: 14,
    marginTop: 4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },

  modalCard: {
    backgroundColor: '#15191F',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#343B44',
    padding: 20,
  },

  modalEyebrow: {
    color: '#E53935',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 4,
  },

  modalJudge: {
    color: '#858D97',
    fontSize: 10,
    marginTop: 4,
    marginBottom: 18,
  },

  inputLabel: {
    color: '#8A929C',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginTop: 10,
    marginBottom: 6,
  },

  scoreInput: {
    height: 44,
    backgroundColor: '#111419',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3139',
    color: '#FFFFFF',
    paddingHorizontal: 13,
    fontSize: 16,
    fontWeight: '800',
  },

  reasonInput: {
    minHeight: 46,
    backgroundColor: '#111419',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A3139',
    color: '#FFFFFF',
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 10,
  },

  multilineInput: {
    minHeight: 82,
  },

  auditWarning: {
    color: '#9D936F',
    fontSize: 8,
    lineHeight: 13,
    marginTop: 10,
  },

  modalActions: {
    flexDirection: 'row',
    marginTop: 18,
  },

  cancelButton: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#252B32',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  cancelButtonText: {
    color: '#A8AFB7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  saveButton: {
    flex: 1.4,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#E53935',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },

  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  pressed: {
    opacity: 0.7,
  },

  cardPressed: {
    opacity: 0.75,
  },

  buttonPressed: {
    opacity: 0.75,
  },

  disabledButton: {
    opacity: 0.5,
  },
});