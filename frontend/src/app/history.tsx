import { API_BASE_URL } from '../constants/api';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  router,
  useFocusEffect,
} from 'expo-router';

import {
  getMatchHistory,
} from '../constants/storage';

/* =========================================================
   API
========================================================= */



const AUTH_TOKEN_KEY =
  '@boxing_auth_token';

/* =========================================================
   BACKEND TYPES
========================================================= */

type BackendJudge = {
  id: string;
  judgeId?: string | null;
  name?: string | null;
  email?: string | null;
  status?: string | null;
};

type BackendMatchJudge = {
  id?: string;
  matchId?: string;
  judgeId: string;
  judge?: BackendJudge | null;
};

type BackendRoundScore = {
  id?: string;
  matchId: string;
  judgeId: string;
  roundNumber: number;

  redScore: number;
  blueScore: number;

  redKnockdowns?: number;
  blueKnockdowns?: number;

  redWarnings?: number;
  blueWarnings?: number;

  redFouls?: number;
  blueFouls?: number;

  judge?: BackendJudge | null;
};

type BackendMatchResult = {
  id?: string;
  matchId?: string;

  winnerId?: string | null;
  loserId?: string | null;

  redTotalScore?: number | null;
  blueTotalScore?: number | null;

  decision?: string | null;
};

type BackendBoxer = {
  id: string;
  boxerId?: string;
  name?: string;
};

type BackendTournament = {
  id: string;
  name?: string;
};

type BackendMatch = {
  id: string;

  tournamentId?: string | null;

  redBoxerId?: string | null;
  blueBoxerId?: string | null;

  rounds?: number | null;

  matchType?: string | null;

  status?: string | null;

  currentRound?: number | null;

  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;

  redBoxer?: BackendBoxer | null;
  blueBoxer?: BackendBoxer | null;

  tournament?: BackendTournament | null;

  judges?: BackendMatchJudge[];

  scores?: BackendRoundScore[];

  result?: BackendMatchResult | null;
};

/* =========================================================
   LOCAL DISPLAY TYPE
========================================================= */

type Match = {
  id: string;

  redBoxer: string;
  blueBoxer: string;

  category: string;

  date: string;
  time: string;

  rounds: number;

  redScore: number;
  blueScore: number;

  winner: string;
  winnerId?: string | null;

  decision: string;

  status: string;

  tournament?: string;

  backendMatch?: BackendMatch;
};

/* =========================================================
   HELPERS
========================================================= */

const formatDate = (
  value?: string | null,
) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(
    'en-IN',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  );
};

const formatTime = (
  value?: string | null,
) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleTimeString(
    'en-IN',
    {
      hour: '2-digit',
      minute: '2-digit',
    },
  );
};

const formatDecision = (
  value?: string | null,
) => {
  if (!value) {
    return '—';
  }

  return String(value)
    .replace(/_/g, ' ')
    .toUpperCase();
};

const getWinnerName = (
  match: BackendMatch,
) => {
  const result = match.result;

  if (!result) {
    return 'DRAW';
  }

  if (
    result.winnerId &&
    result.winnerId ===
      match.redBoxerId
  ) {
    return (
      match.redBoxer?.name ||
      'RED BOXER'
    );
  }

  if (
    result.winnerId &&
    result.winnerId ===
      match.blueBoxerId
  ) {
    return (
      match.blueBoxer?.name ||
      'BLUE BOXER'
    );
  }

  return 'DRAW';
};

/* =========================================================
   BACKEND -> LOCAL FORMAT
========================================================= */

const formatBackendMatch = (
  match: BackendMatch,
): Match => {
  const redScore =
    Number(
      match.result?.redTotalScore,
    ) || 0;

  const blueScore =
    Number(
      match.result?.blueTotalScore,
    ) || 0;

  const winner =
    getWinnerName(match);

  let winnerId =
    match.result?.winnerId ||
    null;

  if (
    winner === 'DRAW' ||
    !match.result?.winnerId
  ) {
    winnerId = null;
  }

  return {
    id: match.id,

    redBoxer:
      match.redBoxer?.name ||
      'RED BOXER',

    blueBoxer:
      match.blueBoxer?.name ||
      'BLUE BOXER',

    category:
      match.tournament?.name ||
      match.matchType ||
      'BOXING',

    date:
      formatDate(
        match.completedAt ||
          match.createdAt,
      ),

    time:
      formatTime(
        match.completedAt ||
          match.createdAt,
      ),

    rounds:
      Number(match.rounds) || 0,

    redScore,
    blueScore,

    winner,
    winnerId,

    decision:
      formatDecision(
        match.result?.decision,
      ),

    status:
      match.status || 'COMPLETED',

    tournament:
      match.tournament?.name,

    backendMatch:
      match,
  };
};

/* =========================================================
   LOCAL STORAGE FALLBACK
========================================================= */

const getLocalMatchId = (
  match: any,
  index: number,
) => {
  return (
    String(match?.id || '') ||
    `LOCAL-${index + 1}`
  );
};

const formatLocalMatch = (
  match: any,
  index: number,
): Match => {
  const redScore =
    Number(match?.redScore) || 0;

  const blueScore =
    Number(match?.blueScore) || 0;

  let winner = 'DRAW';

  if (redScore > blueScore) {
    winner =
      match?.redBoxer ||
      'RED BOXER';
  } else if (
    blueScore > redScore
  ) {
    winner =
      match?.blueBoxer ||
      'BLUE BOXER';
  }

  return {
    id: getLocalMatchId(
      match,
      index,
    ),

    redBoxer:
      match?.redBoxer ||
      'RED BOXER',

    blueBoxer:
      match?.blueBoxer ||
      'BLUE BOXER',

    category:
      match?.weightCategory ||
      match?.category ||
      match?.matchType ||
      'BOXING',

    date:
      match?.date ||
      '—',

    time:
      match?.time ||
      '—',

    rounds:
      Number(match?.rounds) || 0,

    redScore,
    blueScore,

    winner,

    winnerId: null,

    decision:
      formatDecision(
        match?.decision ||
          match?.result,
      ),

    status:
      match?.status ||
      'COMPLETED',

    tournament:
      match?.tournamentName ||
      match?.tournament,

    backendMatch:
      undefined,
  };
};

/* =========================================================
   MAIN SCREEN
========================================================= */

export default function HistoryScreen() {
  const [matches, setMatches] =
    useState<Match[]>([]);

  const [
    searchText,
    setSearchText,
  ] = useState('');

  const [
    selectedFilter,
    setSelectedFilter,
  ] = useState<
    'ALL' | 'DECIDED' | 'DRAW'
  >('ALL');

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  /* =======================================================
     DETAILS MODAL STATE
  ======================================================= */

  const [
    detailVisible,
    setDetailVisible,
  ] = useState(false);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    detailError,
    setDetailError,
  ] = useState('');

  const [
    selectedMatch,
    setSelectedMatch,
  ] = useState<
    BackendMatch | null
  >(null);

  /* =======================================================
     LOAD HISTORY
  ======================================================= */

  const loadHistory = useCallback(
    async (
      showLoader = true,
    ) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const token =
          await AsyncStorage.getItem(
            AUTH_TOKEN_KEY,
          );

        if (!token) {
          console.log(
            'History: authentication token not found.',
          );

          const localHistory =
            await getMatchHistory();

          const localMatches =
            Array.isArray(localHistory)
              ? localHistory.map(
                  (
                    match: any,
                    index: number,
                  ) =>
                    formatLocalMatch(
                      match,
                      index,
                    ),
                )
              : [];

          setMatches(
            localMatches,
          );

          return;
        }

        const historyUrl =
          `${API_BASE_URL}/matches/history`;

        console.log(
          'Loading match history:',
          historyUrl,
        );

        const response =
          await fetch(
            historyUrl,
            {
              method: 'GET',

              headers: {
                Accept:
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const rawText =
          await response.text();

        console.log(
          'Match history status:',
          response.status,
        );

        console.log(
          'Match history response:',
          rawText,
        );

        let data: any = null;

        try {
          data = rawText
            ? JSON.parse(rawText)
            : null;
        } catch {
          throw new Error(
            `Server returned invalid JSON (${response.status})`,
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to load match history (${response.status})`,
          );
        }

        const backendMatches =
          Array.isArray(
            data?.matches,
          )
            ? data.matches
            : [];

        const completedMatches =
          backendMatches.filter(
            (match: BackendMatch) =>
              match.status ===
              'COMPLETED',
          );

        console.log(
          'Completed matches received:',
          completedMatches.length,
        );

        const formatted =
          completedMatches.map(
            (
              match: BackendMatch,
            ) =>
              formatBackendMatch(
                match,
              ),
          );

        setMatches(formatted);
      } catch (error) {
        console.log(
          'History loading error:',
          error,
        );

        /*
         * PostgreSQL history failed.
         * Use local history as fallback.
         */
        try {
          const localHistory =
            await getMatchHistory();

          const localMatches =
            Array.isArray(localHistory)
              ? localHistory.map(
                  (
                    match: any,
                    index: number,
                  ) =>
                    formatLocalMatch(
                      match,
                      index,
                    ),
                )
              : [];

          setMatches(
            localMatches,
          );
        } catch (localError) {
          console.log(
            'Local history fallback error:',
            localError,
          );

          setMatches([]);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /* =======================================================
     INITIAL / FOCUS LOAD
  ======================================================= */

  useFocusEffect(
    useCallback(() => {
      loadHistory(false);
    }, [loadHistory]),
  );

  useEffect(() => {
    loadHistory(true);
  }, [loadHistory]);

  /* =======================================================
     PULL TO REFRESH
  ======================================================= */

  const handleRefresh =
    async () => {
      setRefreshing(true);

      try {
        await loadHistory(false);
      } finally {
        setRefreshing(false);
      }
    };

  /* =======================================================
     SEARCH + FILTER
  ======================================================= */

  const filteredMatches =
    useMemo(() => {
      const search =
        searchText
          .trim()
          .toLowerCase();

      return matches.filter(
        (match) => {
          const filterOK =
            selectedFilter ===
              'ALL' ||
            (
              selectedFilter ===
                'DECIDED' &&
              match.winner !==
                'DRAW'
            ) ||
            (
              selectedFilter ===
                'DRAW' &&
              match.winner ===
                'DRAW'
            );

          const searchOK =
            !search ||
            match.redBoxer
              .toLowerCase()
              .includes(search) ||
            match.blueBoxer
              .toLowerCase()
              .includes(search) ||
            match.winner
              .toLowerCase()
              .includes(search) ||
            match.category
              .toLowerCase()
              .includes(search) ||
            match.id
              .toLowerCase()
              .includes(search);

          return (
            filterOK &&
            searchOK
          );
        },
      );
    }, [
      matches,
      searchText,
      selectedFilter,
    ]);

  /* =======================================================
     STATS
  ======================================================= */

  const totalMatches =
    matches.length;

  const totalDecided =
    matches.filter(
      (match) =>
        match.winner !==
        'DRAW',
    ).length;

  const totalDraws =
    matches.filter(
      (match) =>
        match.winner ===
        'DRAW',
    ).length;

    /* =======================================================
     OPEN MATCH DETAILS
  ======================================================= */

  const openMatchDetails =
    async (
      match: Match,
    ) => {
      setDetailError('');

      setDetailVisible(true);

      /*
       * If this match already came from PostgreSQL,
       * immediately use the complete backend match.
       */
      if (match.backendMatch) {
        setSelectedMatch(
          match.backendMatch,
        );
      } else {
        setSelectedMatch(null);
      }

      setDetailLoading(true);

      try {
        const token =
          await AsyncStorage.getItem(
            AUTH_TOKEN_KEY,
          );

        if (!token) {
          if (!match.backendMatch) {
            setDetailError(
              'Authentication token not found.',
            );

            setSelectedMatch(null);
          }

          return;
        }

        /* =================================================
           STEP 1
           Determine the REAL PostgreSQL match ID
        ================================================= */

        let databaseMatchId =
          match.backendMatch?.id || '';

        /*
         * If backendMatch is missing, this card came
         * from local history.
         *
         * The local ID may look like:
         *
         * MATCH-1790676796958
         *
         * That is NOT the PostgreSQL Match ID.
         *
         * So search PostgreSQL history and find the
         * corresponding match using boxer names and
         * final scores.
         */
        if (!databaseMatchId) {
          const historyUrl =
            `${API_BASE_URL}/matches/history`;

          console.log(
            'Searching PostgreSQL history for local match:',
            match.id,
          );

          const historyResponse =
            await fetch(
              historyUrl,
              {
                method: 'GET',

                headers: {
                  Accept:
                    'application/json',

                  Authorization:
                    `Bearer ${token}`,
                },
              },
            );

          const historyRawText =
            await historyResponse.text();

          console.log(
            'History lookup status:',
            historyResponse.status,
          );

          if (!historyResponse.ok) {
            throw new Error(
              `Failed to search match history (${historyResponse.status})`,
            );
          }

          let historyData: any = null;

          try {
            historyData =
              historyRawText
                ? JSON.parse(
                    historyRawText,
                  )
                : null;
          } catch {
            throw new Error(
              'Server returned invalid JSON while searching match history.',
            );
          }

          const backendMatches =
            Array.isArray(
              historyData?.matches,
            )
              ? historyData.matches
              : [];

          /*
           * First try exact boxer-name + score match.
           */
          const matchingBackendMatch =
            backendMatches.find(
              (
                backendMatch: BackendMatch,
              ) => {
                const backendRedName =
                  backendMatch
                    .redBoxer
                    ?.name
                    ?.trim()
                    .toLowerCase();

                const backendBlueName =
                  backendMatch
                    .blueBoxer
                    ?.name
                    ?.trim()
                    .toLowerCase();

                const localRedName =
                  match.redBoxer
                    .trim()
                    .toLowerCase();

                const localBlueName =
                  match.blueBoxer
                    .trim()
                    .toLowerCase();

                const backendRedScore =
                  Number(
                    backendMatch
                      .result
                      ?.redTotalScore,
                  ) || 0;

                const backendBlueScore =
                  Number(
                    backendMatch
                      .result
                      ?.blueTotalScore,
                  ) || 0;

                const localRedScore =
                  Number(
                    match.redScore,
                  ) || 0;

                const localBlueScore =
                  Number(
                    match.blueScore,
                  ) || 0;

                return (
                  backendRedName ===
                    localRedName &&
                  backendBlueName ===
                    localBlueName &&
                  backendRedScore ===
                    localRedScore &&
                  backendBlueScore ===
                    localBlueScore
                );
              },
            );

          if (
            matchingBackendMatch
              ?.id
          ) {
            databaseMatchId =
              matchingBackendMatch.id;

            /*
             * Cache the PostgreSQL match
             * immediately so the modal can
             * display it.
             */
            setSelectedMatch(
              matchingBackendMatch,
            );

            console.log(
              'Matched local history to PostgreSQL match:',
              databaseMatchId,
            );
          }
        }

        /* =================================================
           STEP 2
           Make sure we found a real DB ID
        ================================================= */

        if (!databaseMatchId) {
          throw new Error(
            'This match exists only in local history and could not be matched to a PostgreSQL match.',
          );
        }

        /* =================================================
           STEP 3
           Load complete PostgreSQL match
        ================================================= */

        const detailUrl =
          `${API_BASE_URL}/matches/history/${encodeURIComponent(
            databaseMatchId,
          )}`;

        console.log(
          'Loading match details:',
          detailUrl,
        );

        const response =
          await fetch(
            detailUrl,
            {
              method: 'GET',

              headers: {
                Accept:
                  'application/json',

                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        const rawText =
          await response.text();

        console.log(
          'Match details status:',
          response.status,
        );

        console.log(
          'Match details response:',
          rawText,
        );

        let data: any = null;

        try {
          data = rawText
            ? JSON.parse(rawText)
            : null;
        } catch {
          throw new Error(
            `Server returned invalid JSON (${response.status})`,
          );
        }

        if (!response.ok) {
          throw new Error(
            data?.message ||
              `Failed to load match details (${response.status})`,
          );
        }

        if (!data?.match) {
          throw new Error(
            'Match details were not returned by the server.',
          );
        }

        /*
         * Replace cached match with the
         * complete PostgreSQL match.
         */
        setSelectedMatch(
          data.match as BackendMatch,
        );

        console.log(
          'Match details loaded successfully:',
          data.match.id,
        );
      } catch (error) {
        console.log(
          'Match details error:',
          error,
        );

        /*
         * If we already have a PostgreSQL match,
         * keep showing it instead of blanking
         * the modal.
         */
        if (!selectedMatch) {
          setSelectedMatch(null);

          setDetailError(
            error instanceof Error
              ? error.message
              : 'Unable to load match details.',
          );
        }
      } finally {
        setDetailLoading(false);
      }
    };

  const closeDetails =
    () => {
      setDetailVisible(false);

      setDetailLoading(false);

      setDetailError('');

      setSelectedMatch(null);
    };

  /* =======================================================
     DETAIL VALUES
  ======================================================= */

  const detailResult =
    selectedMatch?.result;

  const detailRedScore =
    Number(
      detailResult?.redTotalScore,
    ) || 0;

  const detailBlueScore =
    Number(
      detailResult?.blueTotalScore,
    ) || 0;

  const detailWinner =
    selectedMatch
      ? getWinnerName(
          selectedMatch,
        )
      : '';

  const detailDecision =
    formatDecision(
      detailResult?.decision,
    );

  const detailJudges =
    selectedMatch?.judges ||
    [];

  const detailScores =
    selectedMatch?.scores ||
    [];

  /* =======================================================
     RENDER JUDGE SECTION
  ======================================================= */

  const renderJudgeSection =
    (
      matchJudge: BackendMatchJudge,
      index: number,
    ) => {
      const judgeId =
        matchJudge.judgeId;

      const judge =
        matchJudge.judge;

      const judgeScores =
        detailScores
          .filter(
            (score) =>
              score.judgeId ===
              judgeId,
          )
          .sort(
            (a, b) =>
              Number(
                a.roundNumber,
              ) -
              Number(
                b.roundNumber,
              ),
          );

      const totalRed =
        judgeScores.reduce(
          (
            total,
            score,
          ) =>
            total +
            (
              Number(
                score.redScore,
              ) || 0
            ),
          0,
        );

      const totalBlue =
        judgeScores.reduce(
          (
            total,
            score,
          ) =>
            total +
            (
              Number(
                score.blueScore,
              ) || 0
            ),
          0,
        );

      const completed =
        judgeScores.length >
        0;

      return (
        <View
          key={
            `${judgeId}-${index}`
          }
          style={
            styles.judgeCard
          }
        >
          <View
            style={
              styles.judgeHeader
            }
          >
            <View
              style={
                styles.judgeNumber
              }
            >
              <Text
                style={
                  styles.judgeNumberText
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
                style={
                  styles.judgeTitle
                }
              >
                JUDGE {index + 1}
              </Text>

              <Text
                style={
                  styles.judgeName
                }
              >
                {judge?.name ||
                  judge?.judgeId ||
                  'ASSIGNED JUDGE'}
              </Text>

              <Text
                style={
                  styles.judgeId
                }
              >
                {judge?.judgeId ||
                  judgeId}
              </Text>
            </View>

            <View
              style={[
                styles.judgeStatus,
                completed
                  ? styles.judgeStatusComplete
                  : styles.judgeStatusPending,
              ]}
            >
              <Text
                style={[
                  styles.judgeStatusText,
                  completed
                    ? styles.judgeStatusCompleteText
                    : styles.judgeStatusPendingText,
                ]}
              >
                {completed
                  ? 'SUBMITTED'
                  : 'NO SCORE'}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.judgeTotalBox
            }
          >
            <View
              style={
                styles.judgeTotalSide
              }
            >
              <Text
                style={
                  styles.redLabel
                }
              >
                RED
              </Text>

              <Text
                style={
                  styles.judgeTotalScore
                }
              >
                {totalRed}
              </Text>
            </View>

            <Text
              style={
                styles.totalDash
              }
            >
              -
            </Text>

            <View
              style={
                styles.judgeTotalSide
              }
            >
              <Text
                style={
                  styles.blueLabel
                }
              >
                BLUE
              </Text>

              <Text
                style={
                  styles.judgeTotalScore
                }
              >
                {totalBlue}
              </Text>
            </View>
          </View>

          {judgeScores.length >
          0 ? (
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
                ROUND-BY-ROUND SCORES
              </Text>

              {judgeScores.map(
                (
                  score,
                ) => (
                  <View
                    key={
                      `${judgeId}-${score.roundNumber}`
                    }
                    style={
                      styles.roundRow
                    }
                  >
                    <View
                      style={
                        styles.roundInfo
                      }
                    >
                      <Text
                        style={
                          styles.roundNumber
                        }
                      >
                        ROUND{' '}
                        {
                          score.roundNumber
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.roundScore
                      }
                    >
                      <Text
                        style={
                          styles.roundRedScore
                        }
                      >
                        {
                          score.redScore
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
                          styles.roundBlueScore
                        }
                      >
                        {
                          score.blueScore
                        }
                      </Text>
                    </View>
                  </View>
                ),
              )}

              <View
                style={
                  styles.eventSection
                }
              >
                <Text
                  style={
                    styles.eventSectionTitle
                  }
                >
                  ROUND EVENTS
                </Text>

                {judgeScores.map(
                  (
                    score,
                  ) => {
                    const redKD =
                      Number(
                        score.redKnockdowns,
                      ) || 0;

                    const blueKD =
                      Number(
                        score.blueKnockdowns,
                      ) || 0;

                    const redWarnings =
                      Number(
                        score.redWarnings,
                      ) || 0;

                    const blueWarnings =
                      Number(
                        score.blueWarnings,
                      ) || 0;

                    const redFouls =
                      Number(
                        score.redFouls,
                      ) || 0;

                    const blueFouls =
                      Number(
                        score.blueFouls,
                      ) || 0;

                    const hasEvents =
                      redKD > 0 ||
                      blueKD > 0 ||
                      redWarnings >
                        0 ||
                      blueWarnings >
                        0 ||
                      redFouls > 0 ||
                      blueFouls > 0;

                    if (!hasEvents) {
                      return null;
                    }

                    return (
                      <View
                        key={
                          `events-${judgeId}-${score.roundNumber}`
                        }
                        style={
                          styles.eventRow
                        }
                      >
                        <Text
                          style={
                            styles.eventRound
                          }
                        >
                          R
                          {
                            score.roundNumber
                          }
                        </Text>

                        <View
                          style={
                            styles.eventValues
                          }
                        >
                          {redKD >
                            0 && (
                            <Text
                              style={
                                styles.eventText
                              }
                            >
                              RED KD:{' '}
                              {redKD}
                            </Text>
                          )}

                          {blueKD >
                            0 && (
                            <Text
                              style={
                                styles.eventText
                              }
                            >
                              BLUE KD:{' '}
                              {blueKD}
                            </Text>
                          )}

                          {redWarnings >
                            0 && (
                            <Text
                              style={
                                styles.eventText
                              }
                            >
                              RED WARN:{' '}
                              {
                                redWarnings
                              }
                            </Text>
                          )}

                          {blueWarnings >
                            0 && (
                            <Text
                              style={
                                styles.eventText
                              }
                            >
                              BLUE WARN:{' '}
                              {
                                blueWarnings
                              }
                            </Text>
                          )}

                          {redFouls >
                            0 && (
                            <Text
                              style={
                                styles.eventText
                              }
                            >
                              RED FOUL:{' '}
                              {redFouls}
                            </Text>
                          )}

                          {blueFouls >
                            0 && (
                            <Text
                              style={
                                styles.eventText
                              }
                            >
                              BLUE FOUL:{' '}
                              {blueFouls}
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  },
                )}
              </View>
            </View>
          ) : (
            <View
              style={
                styles.noScoreBox
              }
            >
              <Text
                style={
                  styles.noScoreText
                }
              >
                NO ROUND SCORES
                SUBMITTED
              </Text>
            </View>
          )}
        </View>
      );
    };

  /* =======================================================
     RENDER MATCH CARD
  ======================================================= */

  const renderMatchCard =
    (
      match: Match,
    ) => {
      const isDraw =
        match.winner ===
        'DRAW';

      const redWon =
        !isDraw &&
        match.winner ===
          match.redBoxer;

      const blueWon =
        !isDraw &&
        match.winner ===
          match.blueBoxer;

      return (
        <Pressable
          key={match.id}
          onPress={() =>
            openMatchDetails(
              match,
            )
          }
          style={({ pressed }) => [
            styles.matchCard,
            pressed &&
              styles.cardPressed,
          ]}
        >
          <View
            style={
              styles.cardTopRow
            }
          >
            <View>
              <Text
                style={
                  styles.matchId
                }
              >
                MATCH {match.id}
              </Text>

              <Text
                style={
                  styles.matchCategory
                }
              >
                {match.category}
              </Text>
            </View>

            <View
              style={[
                styles.resultBadge,
                isDraw
                  ? styles.drawBadge
                  : styles.completedBadge,
              ]}
            >
              <Text
                style={
                  styles.resultBadgeText
                }
              >
                {isDraw
                  ? 'DRAW'
                  : 'COMPLETED'}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.boxersRow
            }
          >
            <View
              style={
                styles.boxerColumn
              }
            >
              <View
                style={[
                  styles.cornerCircle,
                  styles.redCorner,
                ]}
              >
                <Text
                  style={
                    styles.cornerText
                  }
                >
                  R
                </Text>
              </View>

              <Text
                style={[
                  styles.boxerName,
                  redWon &&
                    styles.winnerName,
                ]}
                numberOfLines={2}
              >
                {match.redBoxer}
              </Text>

              <Text
                style={[
                  styles.cardScore,
                  redWon &&
                    styles.winnerScore,
                ]}
              >
                {match.redScore}
              </Text>
            </View>

            <View
              style={
                styles.vsColumn
              }
            >
              <Text
                style={
                  styles.vsText
                }
              >
                VS
              </Text>
            </View>

            <View
              style={
                styles.boxerColumn
              }
            >
              <View
                style={[
                  styles.cornerCircle,
                  styles.blueCorner,
                ]}
              >
                <Text
                  style={
                    styles.cornerText
                  }
                >
                  B
                </Text>
              </View>

              <Text
                style={[
                  styles.boxerName,
                  blueWon &&
                    styles.winnerName,
                ]}
                numberOfLines={2}
              >
                {match.blueBoxer}
              </Text>

              <Text
                style={[
                  styles.cardScore,
                  blueWon &&
                    styles.winnerScore,
                ]}
              >
                {match.blueScore}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.cardBottomRow
            }
          >
            <Text
              style={
                styles.cardDate
              }
            >
              {match.date} •{' '}
              {match.time}
            </Text>

            <Text
              style={
                styles.viewDetails
              }
            >
              VIEW DETAILS →
            </Text>
          </View>
        </Pressable>
      );
    };

  /* =======================================================
     JSX
  ======================================================= */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar
        barStyle="light-content"
      />

      <View
        style={styles.container}
      >
        {/* HEADER */}

        <View
          style={styles.header}
        >
          <Pressable
            onPress={() =>
              router.back()
            }
            style={
              styles.backButton
            }
          >
            <Text
              style={
                styles.backIcon
              }
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
              style={
                styles.headerTitle
              }
            >
              MATCH HISTORY
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              View all completed
              boxing matches
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={
                handleRefresh
              }
              tintColor="#FFFFFF"
            />
          }
          contentContainerStyle={
            styles.scrollContent
          }
        >
          {/* STATS */}

          <View
            style={
              styles.statsContainer
            }
          >
            <Stat
              value={
                totalMatches
              }
              label="TOTAL"
            />

            <Stat
              value={
                totalDecided
              }
              label="DECIDED"
              green
            />

            <Stat
              value={
                totalDraws
              }
              label="DRAWS"
              red
            />
          </View>

          {/* SEARCH */}

          <View
            style={
              styles.searchContainer
            }
          >
            <Text
              style={
                styles.searchIcon
              }
            >
              ⌕
            </Text>

            <TextInput
              value={
                searchText
              }
              onChangeText={
                setSearchText
              }
              placeholder="Search boxer or match..."
              placeholderTextColor="#777"
              style={
                styles.searchInput
              }
              autoCapitalize="none"
              autoCorrect={false}
            />

            {searchText.length >
              0 && (
              <Pressable
                onPress={() =>
                  setSearchText(
                    '',
                  )
                }
                style={
                  styles.clearButton
                }
              >
                <Text
                  style={
                    styles.clearText
                  }
                >
                  ×
                </Text>
              </Pressable>
            )}
          </View>

          {/* FILTERS */}

          <View
            style={
              styles.filterContainer
            }
          >
            {(
              [
                'ALL',
                'DECIDED',
                'DRAW',
              ] as const
            ).map(
              (
                filter,
              ) => (
                <Pressable
                  key={filter}
                  onPress={() =>
                    setSelectedFilter(
                      filter,
                    )
                  }
                  style={[
                    styles.filterButton,
                    selectedFilter ===
                      filter &&
                      styles.filterButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selectedFilter ===
                        filter &&
                        styles.filterButtonTextActive,
                    ]}
                  >
                    {filter}
                  </Text>
                </Pressable>
              ),
            )}
          </View>

          {/* SECTION HEADER */}

          <View
            style={
              styles.sectionHeader
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              COMPLETED MATCHES
            </Text>

            <Text
              style={
                styles.matchCount
              }
            >
              {
                filteredMatches.length
              }{' '}
              MATCH
              {filteredMatches.length ===
              1
                ? ''
                : 'ES'}
            </Text>
          </View>

          {/* LOADING */}

          {loading &&
          matches.length ===
            0 ? (
            <View
              style={
                styles.loadingBox
              }
            >
              <ActivityIndicator
                size="large"
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.loadingText
                }
              >
                LOADING MATCH HISTORY...
              </Text>
            </View>
          ) : filteredMatches.length >
            0 ? (
            <View
              style={
                styles.matchesContainer
              }
            >
              {filteredMatches.map(
                (
                  match,
                ) =>
                  renderMatchCard(
                    match,
                  ),
              )}
            </View>
          ) : (
            <View
              style={
                styles.emptyContainer
              }
            >
              <Text
                style={
                  styles.emptyIcon
                }
              >
                🥊
              </Text>

              <Text
                style={
                  styles.emptyTitle
                }
              >
                NO MATCHES FOUND
              </Text>

              <Text
                style={
                  styles.emptySubtitle
                }
              >
                Try changing your
                search or filter.
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* ===================================================
          MATCH DETAILS MODAL
      =================================================== */}

      <Modal
        visible={
          detailVisible
        }
        animationType="slide"
        transparent
        onRequestClose={
          closeDetails
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <SafeAreaView
            style={
              styles.modalSafeArea
            }
          >
            <View
              style={
                styles.modalContainer
              }
            >
              {/* MODAL HEADER */}

              <View
                style={
                  styles.modalHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    MATCH DETAILS
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    ADMIN MATCH REVIEW
                  </Text>
                </View>

                <Pressable
                  onPress={
                    closeDetails
                  }
                  style={
                    styles.modalCloseButton
                  }
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

              {/* DETAIL CONTENT */}

              {detailLoading &&
              !selectedMatch ? (
                <View
                  style={
                    styles.detailLoading
                  }
                >
                  <ActivityIndicator
                    size="large"
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.loadingText
                    }
                  >
                    LOADING MATCH DETAILS...
                  </Text>
                </View>
              ) : detailError &&
                !selectedMatch ? (
                <View
                  style={
                    styles.detailErrorBox
                  }
                >
                  <Text
                    style={
                      styles.errorTitle
                    }
                  >
                    UNABLE TO LOAD DETAILS
                  </Text>

                  <Text
                    style={
                      styles.errorText
                    }
                  >
                    {detailError}
                  </Text>

                  <Pressable
                    style={
                      styles.retryButton
                    }
                    onPress={
                      closeDetails
                    }
                  >
                    <Text
                      style={
                        styles.retryButtonText
                      }
                    >
                      CLOSE
                    </Text>
                  </Pressable>
                </View>
              ) : selectedMatch ? (
                <ScrollView
                  showsVerticalScrollIndicator={
                    false
                  }
                  contentContainerStyle={
                    styles.detailScrollContent
                  }
                >
                  {/* HERO */}

                  <View
                    style={
                      styles.detailHero
                    }
                  >
                    <View
                      style={
                        styles.detailBoxer
                      }
                    >
                      <View
                        style={[
                          styles.detailCorner,
                          styles.redCorner,
                        ]}
                      >
                        <Text
                          style={
                            styles.detailCornerText
                          }
                        >
                          R
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.detailBoxerName
                        }
                      >
                        {
                          selectedMatch
                            .redBoxer
                            ?.name
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.detailScoreCenter
                      }
                    >
                      <Text
                        style={
                          styles.detailScore
                        }
                      >
                        {
                          detailRedScore
                        }
                        {' '}
                        -
                        {' '}
                        {
                          detailBlueScore
                        }
                      </Text>

                      <Text
                        style={
                          styles.detailDecision
                        }
                      >
                        {
                          detailDecision
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.detailBoxer
                      }
                    >
                      <View
                        style={[
                          styles.detailCorner,
                          styles.blueCorner,
                        ]}
                      >
                        <Text
                          style={
                            styles.detailCornerText
                          }
                        >
                          B
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.detailBoxerName
                        }
                      >
                        {
                          selectedMatch
                            .blueBoxer
                            ?.name
                        }
                      </Text>
                    </View>
                  </View>

                  {/* RESULT */}

                  <View
                    style={
                      styles.resultCard
                    }
                  >
                    <Text
                      style={
                        styles.resultCardLabel
                      }
                    >
                      OFFICIAL RESULT
                    </Text>

                    <Text
                      style={
                        styles.resultCardWinner
                      }
                    >
                      {
                        detailWinner
                      }
                    </Text>

                    <Text
                      style={
                        styles.resultCardDecision
                      }
                    >
                      {
                        detailDecision
                      }
                    </Text>
                  </View>

                  {/* MATCH INFORMATION */}

                  <View
                    style={
                      styles.detailCard
                    }
                  >
                    <Text
                      style={
                        styles.detailSectionTitle
                      }
                    >
                      MATCH INFORMATION
                    </Text>

                    <InfoRow
                      label="MATCH ID"
                      value={
                        selectedMatch.id
                      }
                    />

                    <InfoRow
                      label="STATUS"
                      value={
                        selectedMatch.status ||
                        'COMPLETED'
                      }
                    />

                    <InfoRow
                      label="MATCH TYPE"
                      value={
                        selectedMatch.matchType ||
                        '—'
                      }
                    />

                    <InfoRow
                      label="ROUNDS"
                      value={String(
                        selectedMatch.rounds ||
                          0,
                      )}
                    />

                    <InfoRow
                      label="TOURNAMENT"
                      value={
                        selectedMatch
                          .tournament
                          ?.name ||
                        '—'
                      }
                    />

                    <InfoRow
                      label="COMPLETED"
                      value={formatDate(
                        selectedMatch.completedAt,
                      )}
                    />

                    <InfoRow
                      label="TIME"
                      value={formatTime(
                        selectedMatch.completedAt,
                      )}
                    />
                  </View>

                  {/* JUDGES */}

                  <View
                    style={
                      styles.detailSectionHeader
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.detailSectionTitle
                        }
                      >
                        JUDGE-BY-JUDGE REVIEW
                      </Text>

                      <Text
                        style={
                          styles.detailSectionSubtitle
                        }
                      >
                        Individual scorecards
                        from every assigned
                        judge
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
                        {
                          detailJudges.length
                        }
                      </Text>
                    </View>
                  </View>

                  {detailJudges.length >
                  0 ? (
                    detailJudges.map(
                      (
                        matchJudge,
                        index,
                      ) =>
                        renderJudgeSection(
                          matchJudge,
                          index,
                        ),
                    )
                  ) : (
                    <View
                      style={
                        styles.noJudgesBox
                      }
                    >
                      <Text
                        style={
                          styles.noJudgesText
                        }
                      >
                        NO JUDGES ASSIGNED
                      </Text>
                    </View>
                  )}

                  {/* ALL ROUND SCORES */}

                  <View
                    style={
                      styles.detailCard
                    }
                  >
                    <Text
                      style={
                        styles.detailSectionTitle
                      }
                    >
                      ALL ROUND SCORES
                    </Text>

                    {detailScores.length >
                    0 ? (
                      detailScores
                        .slice()
                        .sort(
                          (a, b) =>
                            Number(
                              a.roundNumber,
                            ) -
                            Number(
                              b.roundNumber,
                            ),
                        )
                        .map(
                          (
                            score,
                          ) => (
                            <View
                              key={
                                score.id ||
                                `${score.judgeId}-${score.roundNumber}`
                              }
                              style={
                                styles.allScoreRow
                              }
                            >
                              <View>
                                <Text
                                  style={
                                    styles.allScoreRound
                                  }
                                >
                                  ROUND{' '}
                                  {
                                    score.roundNumber
                                  }
                                </Text>

                                <Text
                                  style={
                                    styles.allScoreJudge
                                  }
                                >
                                  {
                                    score.judge
                                      ?.name ||
                                    score.judge
                                      ?.judgeId ||
                                    score.judgeId
                                  }
                                </Text>
                              </View>

                              <Text
                                style={
                                  styles.allScoreValue
                                }
                              >
                                {
                                  score.redScore
                                }
                                {' '}
                                -
                                {' '}
                                {
                                  score.blueScore
                                }
                              </Text>
                            </View>
                          ),
                        )
                    ) : (
                      <Text
                        style={
                          styles.noScoreText
                        }
                      >
                        No round scores
                        available.
                      </Text>
                    )}
                  </View>

                  {/* EVENT SUMMARY */}

                  <View
                    style={
                      styles.detailCard
                    }
                  >
                    <Text
                      style={
                        styles.detailSectionTitle
                      }
                    >
                      EVENT SUMMARY
                    </Text>

                    <EventSummary
                      scores={
                        detailScores
                      }
                    />
                  </View>

                  <Pressable
                    style={
                      styles.closeBottomButton
                    }
                    onPress={
                      closeDetails
                    }
                  >
                    <Text
                      style={
                        styles.closeBottomButtonText
                      }
                    >
                      CLOSE
                    </Text>
                  </Pressable>
                </ScrollView>
              ) : (
                <View
                  style={
                    styles.detailLoading
                  }
                >
                  <Text
                    style={
                      styles.loadingText
                    }
                  >
                    No match selected.
                  </Text>
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
   STAT
========================================================= */

type StatProps = {
  value: number;
  label: string;
  green?: boolean;
  red?: boolean;
};

function Stat({
  value,
  label,
  green,
  red,
}: StatProps) {
  return (
    <View
      style={styles.statCard}
    >
      <Text
        style={[
          styles.statNumber,
          green &&
            styles.statGreen,
          red &&
            styles.statRed,
        ]}
      >
        {value}
      </Text>

      <Text
        style={
          styles.statLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

/* =========================================================
   INFO ROW
========================================================= */

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({
  label,
  value,
}: InfoRowProps) {
  return (
    <View
      style={styles.infoRow}
    >
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoValue
        }
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

/* =========================================================
   EVENT SUMMARY
========================================================= */

function EventSummary({
  scores,
}: {
  scores: BackendRoundScore[];
}) {
  let redKnockdowns = 0;
  let blueKnockdowns = 0;

  let redWarnings = 0;
  let blueWarnings = 0;

  let redFouls = 0;
  let blueFouls = 0;

  scores.forEach(
    (score) => {
      redKnockdowns +=
        Number(
          score.redKnockdowns,
        ) || 0;

      blueKnockdowns +=
        Number(
          score.blueKnockdowns,
        ) || 0;

      redWarnings +=
        Number(
          score.redWarnings,
        ) || 0;

      blueWarnings +=
        Number(
          score.blueWarnings,
        ) || 0;

      redFouls +=
        Number(
          score.redFouls,
        ) || 0;

      blueFouls +=
        Number(
          score.blueFouls,
        ) || 0;
    },
  );

  return (
    <View
      style={
        styles.eventSummary
      }
    >
      <View
        style={
          styles.eventSummaryRow
        }
      >
        <Text
          style={
            styles.eventSummaryLabel
          }
        >
          RED KNOCKDOWNS
        </Text>

        <Text
          style={
            styles.eventSummaryValue
          }
        >
          {redKnockdowns}
        </Text>
      </View>

      <View
        style={
          styles.eventSummaryRow
        }
      >
        <Text
          style={
            styles.eventSummaryLabel
          }
        >
          BLUE KNOCKDOWNS
        </Text>

        <Text
          style={
            styles.eventSummaryValue
          }
        >
          {blueKnockdowns}
        </Text>
      </View>

      <View
        style={
          styles.eventSummaryRow
        }
      >
        <Text
          style={
            styles.eventSummaryLabel
          }
        >
          RED WARNINGS
        </Text>

        <Text
          style={
            styles.eventSummaryValue
          }
        >
          {redWarnings}
        </Text>
      </View>

      <View
        style={
          styles.eventSummaryRow
        }
      >
        <Text
          style={
            styles.eventSummaryLabel
          }
        >
          BLUE WARNINGS
        </Text>

        <Text
          style={
            styles.eventSummaryValue
          }
        >
          {blueWarnings}
        </Text>
      </View>

      <View
        style={
          styles.eventSummaryRow
        }
      >
        <Text
          style={
            styles.eventSummaryLabel
          }
        >
          RED FOULS
        </Text>

        <Text
          style={
            styles.eventSummaryValue
          }
        >
          {redFouls}
        </Text>
      </View>

      <View
        style={
          styles.eventSummaryRow
        }
      >
        <Text
          style={
            styles.eventSummaryLabel
          }
        >
          BLUE FOULS
        </Text>

        <Text
          style={
            styles.eventSummaryValue
          }
        >
          {blueFouls}
        </Text>
      </View>
    </View>
  );
}

/* =========================================================
   STYLES
========================================================= */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        '#0B0D10',
    },

    container: {
      flex: 1,
      backgroundColor:
        '#0B0D10',
    },

    scrollContent: {
      paddingHorizontal: 18,
      paddingBottom: 40,
    },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 14,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor:
        '#15191F',
      borderWidth: 1,
      borderColor:
        '#252B32',
      alignItems: 'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    backIcon: {
      color: '#FFFFFF',
      fontSize: 32,
      lineHeight: 34,
    },

    headerTextContainer: {
      flex: 1,
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
      letterSpacing: 0.8,
      marginTop: 4,
    },

    statsContainer: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 14,
    },

    statCard: {
      flex: 1,
      backgroundColor:
        '#15191F',
      borderRadius: 15,
      borderWidth: 1,
      borderColor:
        '#252B32',
      paddingVertical: 14,
      alignItems: 'center',
    },

    statNumber: {
      color: '#FFFFFF',
      fontSize: 22,
      fontWeight: '900',
    },

    statGreen: {
      color: '#43A047',
    },

    statRed: {
      color: '#F45B5B',
    },

    statLabel: {
      color: '#626A74',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginTop: 4,
    },

    searchContainer: {
      height: 48,
      backgroundColor:
        '#15191F',
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        '#252B32',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      marginBottom: 12,
    },

    searchIcon: {
      color: '#69717B',
      fontSize: 24,
      marginRight: 8,
    },

    searchInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '600',
    },

    clearButton: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    clearText: {
      color: '#FFFFFF',
      fontSize: 24,
    },

    filterContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 18,
    },

    filterButton: {
      flex: 1,
      height: 38,
      borderRadius: 10,
      backgroundColor:
        '#15191F',
      borderWidth: 1,
      borderColor:
        '#252B32',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    filterButtonActive: {
      backgroundColor:
        '#2A2F36',
      borderColor:
        '#59616B',
    },

    filterButtonText: {
      color: '#69717B',
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    filterButtonTextActive: {
      color: '#FFFFFF',
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginBottom: 10,
    },

    sectionTitle: {
      color: '#858D97',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.3,
    },

    matchCount: {
      color: '#555D67',
      fontSize: 8,
      fontWeight: '900',
    },

    matchesContainer: {
      gap: 12,
    },

    matchCard: {
      backgroundColor:
        '#15191F',
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#252B32',
      padding: 15,
    },

    cardPressed: {
      opacity: 0.7,
    },

    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    matchId: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    matchCategory: {
      color: '#626A74',
      fontSize: 8,
      fontWeight: '800',
      marginTop: 3,
    },

    resultBadge: {
      borderRadius: 9,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },

    completedBadge: {
      backgroundColor:
        '#16301E',
    },

    drawBadge: {
      backgroundColor:
        '#29251A',
    },

    resultBadgeText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    boxersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 15,
    },

    boxerColumn: {
      flex: 1,
      alignItems: 'center',
    },

    cornerCircle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    redCorner: {
      backgroundColor:
        '#C62828',
    },

    blueCorner: {
      backgroundColor:
        '#1565C0',
    },

    cornerText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },

    boxerName: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 7,
    },

    winnerName: {
      color: '#43A047',
    },

    cardScore: {
      color: '#858D97',
      fontSize: 20,
      fontWeight: '900',
      marginTop: 3,
    },

    winnerScore: {
      color: '#FFFFFF',
    },

    vsColumn: {
      width: 45,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    vsText: {
      color: '#555D67',
      fontSize: 9,
      fontWeight: '900',
    },

    cardBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 14,
      paddingTop: 11,
      borderTopWidth: 1,
      borderTopColor:
        '#252B32',
    },

    cardDate: {
      color: '#626A74',
      fontSize: 8,
      fontWeight: '700',
    },

    viewDetails: {
      color: '#64A9F5',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    loadingBox: {
      paddingVertical: 50,
      alignItems: 'center',
    },

    loadingText: {
      color: '#858D97',
      fontSize: 9,
      fontWeight: '800',
      marginTop: 12,
      letterSpacing: 0.7,
      textAlign: 'center',
    },

    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
    },

    emptyIcon: {
      fontSize: 42,
    },

    emptyTitle: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
      marginTop: 12,
    },

    emptySubtitle: {
      color: '#626A74',
      fontSize: 9,
      marginTop: 6,
    },

    /* =====================================================
       MODAL
    ===================================================== */

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0,0,0,0.82)',
    },

    modalSafeArea: {
      flex: 1,
    },

    modalContainer: {
      flex: 1,
      backgroundColor:
        '#0B0D10',
      marginTop: 20,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: 'hidden',
    },

    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      paddingHorizontal: 18,
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor:
        '#252B32',
    },

    modalTitle: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 1.2,
    },

    modalSubtitle: {
      color: '#43A047',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginTop: 4,
    },

    modalCloseButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor:
        '#15191F',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    modalCloseText: {
      color: '#FFFFFF',
      fontSize: 27,
      lineHeight: 29,
    },

    detailScrollContent: {
      padding: 18,
      paddingBottom: 50,
    },

    detailLoading: {
      flex: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      padding: 30,
    },

    detailErrorBox: {
      margin: 18,
      padding: 20,
      backgroundColor:
        '#241719',
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#5B2828',
      alignItems: 'center',
    },

    errorTitle: {
      color: '#F45B5B',
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    errorText: {
      color: '#B9BEC5',
      fontSize: 9,
      textAlign: 'center',
      lineHeight: 16,
      marginTop: 10,
    },

    retryButton: {
      marginTop: 16,
      backgroundColor:
        '#2A2F36',
      borderRadius: 10,
      paddingHorizontal: 22,
      paddingVertical: 10,
    },

    retryButtonText: {
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '900',
    },

    detailHero: {
      backgroundColor:
        '#15191F',
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        '#252B32',
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    detailBoxer: {
      flex: 1,
      alignItems: 'center',
    },

    detailCorner: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent:
        'center',
    },

    detailCornerText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '900',
    },

    detailBoxerName: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 8,
    },

    detailScoreCenter: {
      width: 100,
      alignItems: 'center',
    },

    detailScore: {
      color: '#FFFFFF',
      fontSize: 21,
      fontWeight: '900',
    },

    detailDecision: {
      color: '#43A047',
      fontSize: 7,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 5,
    },

    resultCard: {
      backgroundColor:
        '#15191F',
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#252B32',
      marginTop: 12,
      padding: 16,
      alignItems: 'center',
    },

    resultCardLabel: {
      color: '#626A74',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 1,
    },

    resultCardWinner: {
      color: '#43A047',
      fontSize: 17,
      fontWeight: '900',
      textAlign: 'center',
      marginTop: 7,
    },

    resultCardDecision: {
      color: '#858D97',
      fontSize: 8,
      fontWeight: '800',
      marginTop: 4,
    },

    detailCard: {
      backgroundColor:
        '#15191F',
      borderRadius: 16,
      borderWidth: 1,
      borderColor:
        '#252B32',
      padding: 15,
      marginTop: 12,
    },

    detailSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 20,
      marginBottom: 10,
    },

    detailSectionTitle: {
      color: '#858D97',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.1,
    },

    detailSectionSubtitle: {
      color: '#555D67',
      fontSize: 7,
      fontWeight: '700',
      marginTop: 4,
    },

    infoRow: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth: 1,
      borderBottomColor:
        '#252B32',
    },

    infoLabel: {
      color: '#626A74',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    infoValue: {
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '900',
      maxWidth: '60%',
      textAlign: 'right',
    },

    judgeCountBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor:
        '#20252C',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    judgeCountText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
    },

    judgeCard: {
      backgroundColor:
        '#15191F',
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#252B32',
      padding: 14,
      marginBottom: 12,
    },

    judgeHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    judgeNumber: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor:
        '#292F37',
      alignItems: 'center',
      justifyContent:
        'center',
    },

    judgeNumberText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },

    judgeHeaderInfo: {
      flex: 1,
      marginLeft: 10,
    },

    judgeTitle: {
      color: '#858D97',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    judgeName: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
      marginTop: 2,
    },

    judgeId: {
      color: '#555D67',
      fontSize: 7,
      fontWeight: '800',
      marginTop: 2,
    },

    judgeStatus: {
      borderRadius: 9,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },

    judgeStatusComplete: {
      backgroundColor:
        '#16301E',
    },

    judgeStatusPending: {
      backgroundColor:
        '#29251A',
    },

    judgeStatusText: {
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0.4,
    },

    judgeStatusCompleteText: {
      color: '#43A047',
    },

    judgeStatusPendingText: {
      color: '#F9A825',
    },

    judgeTotalBox: {
      backgroundColor:
        '#11151A',
      borderRadius: 13,
      borderWidth: 1,
      borderColor:
        '#252B32',
      marginTop: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-around',
    },

    judgeTotalSide: {
      alignItems: 'center',
      width: '38%',
    },

    redLabel: {
      color: '#F45B5B',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    blueLabel: {
      color: '#64A9F5',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    judgeTotalScore: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
      marginTop: 3,
    },

    totalDash: {
      color: '#555D67',
      fontSize: 12,
      fontWeight: '900',
    },

    roundSection: {
      marginTop: 12,
    },

    roundSectionTitle: {
      color: '#626A74',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginBottom: 5,
    },

    roundRow: {
      minHeight: 34,
      backgroundColor:
        '#11151A',
      borderRadius: 8,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      marginTop: 4,
    },

    roundInfo: {
      flex: 1,
    },

    roundNumber: {
      color: '#858D97',
      fontSize: 7,
      fontWeight: '900',
    },

    roundScore: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    roundRedScore: {
      color: '#F45B5B',
      fontSize: 10,
      fontWeight: '900',
      minWidth: 25,
      textAlign: 'right',
    },

    roundDash: {
      color: '#555D67',
      fontSize: 8,
      fontWeight: '900',
      marginHorizontal: 5,
    },

    roundBlueScore: {
      color: '#64A9F5',
      fontSize: 10,
      fontWeight: '900',
      minWidth: 25,
    },

    eventSection: {
      marginTop: 12,
    },

    eventSectionTitle: {
      color: '#626A74',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.8,
      marginBottom: 5,
    },

    eventRow: {
      backgroundColor:
        '#11151A',
      borderRadius: 8,
      padding: 9,
      flexDirection: 'row',
      marginTop: 4,
    },

    eventRound: {
      color: '#858D97',
      fontSize: 7,
      fontWeight: '900',
      width: 25,
    },

    eventValues: {
      flex: 1,
    },

    eventText: {
      color: '#C1C6CC',
      fontSize: 7,
      fontWeight: '700',
      marginBottom: 2,
    },

    noScoreBox: {
      marginTop: 12,
      backgroundColor:
        '#11151A',
      borderRadius: 10,
      padding: 12,
      alignItems: 'center',
    },

    noScoreText: {
      color: '#626A74',
      fontSize: 7,
      fontWeight: '900',
      textAlign: 'center',
    },

    noJudgesBox: {
      backgroundColor:
        '#15191F',
      borderRadius: 14,
      borderWidth: 1,
      borderColor:
        '#252B32',
      padding: 20,
      alignItems: 'center',
    },

    noJudgesText: {
      color: '#626A74',
      fontSize: 8,
      fontWeight: '900',
    },

    allScoreRow: {
      minHeight: 48,
      borderBottomWidth: 1,
      borderBottomColor:
        '#252B32',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    allScoreRound: {
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: '900',
    },

    allScoreJudge: {
      color: '#626A74',
      fontSize: 7,
      marginTop: 3,
    },

    allScoreValue: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '900',
    },

    eventSummary: {
      marginTop: 4,
    },

    eventSummaryRow: {
      minHeight: 38,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
      borderBottomWidth: 1,
      borderBottomColor:
        '#252B32',
    },

    eventSummaryLabel: {
      color: '#626A74',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    eventSummaryValue: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '900',
    },

    closeBottomButton: {
      height: 48,
      borderRadius: 12,
      backgroundColor:
        '#252B32',
      alignItems: 'center',
      justifyContent:
        'center',
      marginTop: 18,
    },

    closeBottomButtonText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1,
    },
  });