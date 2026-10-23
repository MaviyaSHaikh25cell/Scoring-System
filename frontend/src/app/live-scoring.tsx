import { API_BASE_URL } from '../constants/api';
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
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
    useLocalSearchParams,
} from 'expo-router';

import {
    getTournamentById,
    updateTournamentMatch,
    saveTournament,
    saveMatch,
    type AdminOverride,
    type TournamentRoundReview,
    type RefereeEvent as StoredRefereeEvent,
    type MatchStoppage,
} from '../constants/storage';

/*
 * =========================================================
 * STORAGE KEYS
 * =========================================================
 */

const JUDGE_SCORES_KEY =
    '@boxing_system_judge_scores';

const ROUND_REVIEWS_KEY =
    '@boxing_system_round_reviews';

const REFEREE_EVENTS_KEY =
    '@boxing_system_referee_events';

const ASSIGNED_MATCHES_KEY =
    '@boxing_system_assigned_matches';

const ADMIN_OVERRIDES_KEY =
    '@boxing_system_admin_overrides';

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type ScoreAction = 'RED' | 'BLUE';

type JudgeRoundScore = {
    round: number;
    redScore: number;
    blueScore: number;
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

type RoundReviewStatus =
    | 'PENDING'
    | 'READY_FOR_ADMIN'
    | 'APPROVED'
    | 'FLAGGED';

type RoundReview = {
    id: string;
    matchId: string;
    tournamentId: string | null;
    tournamentMatchId: string | null;
    roundNumber: number;
    status: RoundReviewStatus;

    submittedJudgeId: string;
    submittedJudgeName: string;

    redScore: number;
    blueScore: number;

    submittedAt: string;

    adminEdited?: boolean;
    adminEditedBy?: string | null;
    adminEditedByName?: string | null;
    adminEditedAt?: string | null;
    adminEditReason?: string | null;

    adminApprovedBy?: string | null;
    adminApprovedByName?: string | null;
    adminApprovedAt?: string | null;
};

type RefereeEventType =
    | 'WARNING'
    | 'CAUTION'
    | 'FOUL'
    | 'KNOCKDOWN'
    | 'RSC'
    | 'KO'
    | 'DOCTOR_STOP'
    | 'RETIREMENT'
    | 'STOP_CONTEST'
    | 'CONTINUE';

type RefereeCorner =
    | 'RED'
    | 'BLUE'
    | 'BOTH'
    | null;

type RefereeEvent = {
    id: string;
    matchId: string;
    tournamentId: string | null;
    tournamentMatchId: string | null;
    type: RefereeEventType;
    roundNumber: number;
    time: string;
    corner: RefereeCorner;
    note: string | null;
    refereeId: string | null;
    refereeName: string | null;
    createdAt: string;
};

type AssignedMatch = {
    id: string;
    redBoxer: string;
    blueBoxer: string;
    weightCategory: string;
    rounds: number;
    matchType: string;
    date?: string;
    time?: string;
    status?: string;
    judges?: {
        id: string;
        name: string;
    }[];
    tournamentId?: string;
    tournamentMatchId?: string;
};

type EditingSubmission = {
    review: RoundReview;
};

type OfficialWinner =
    | 'RED'
    | 'BLUE'
    | 'DRAW'
    | null;

/*
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const EARLY_STOP_TYPES: RefereeEventType[] = [
    'RSC',
    'KO',
    'DOCTOR_STOP',
    'RETIREMENT',
    'STOP_CONTEST',
];

const ADMIN_ID = 'ADM001';
const ADMIN_NAME = 'SYSTEM ADMIN';


/*
 * =========================================================
 * DATABASE API
 * =========================================================
 */



const AUTH_TOKEN_KEY =
    '@boxing_auth_token';

const getAuthToken = async () =>
    AsyncStorage.getItem(
        AUTH_TOKEN_KEY,
    );

const databaseRequest = async (
    endpoint: string,
    options: RequestInit = {},
) => {
    const token =
        await getAuthToken();

    if (!token) {
        throw new Error(
            'Authentication token not found. Please login again.',
        );
    }

    const response =
        await fetch(
            `${API_BASE_URL}${endpoint}`,
            {
                ...options,
                headers: {
                    'Content-Type':
                        'application/json',
                    ...(options.headers || {}),
                    Authorization:
                        `Bearer ${token}`,
                },
            },
        );

    const responseText = await response.text();
    let data: any = null;

    try {
        data = responseText ? JSON.parse(responseText) : null;
    } catch {
        throw new Error(
            response.ok
                ? 'Server returned an invalid response.'
                : `Server error (${response.status}): ${responseText.slice(0, 200)}`,
        );
    }

    if (!response.ok) {
        throw new Error(
            data?.message ||
                `Database request failed (${response.status})`,
        );
    }

    return data;
};

const startDatabaseMatch = async (
    matchId: string,
) => {
    if (!matchId) {
        return null;
    }

    return databaseRequest(
        `/matches/${matchId}/start`,
        {
            method: 'POST',
        },
    );
};

const saveDatabaseRoundScore =
    async (payload: {
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
    }) =>
        databaseRequest(
            `/matches/${payload.matchId}/round-score`,
            {
                method: 'POST',
                body: JSON.stringify(
                    payload,
                ),
            },
        );

const completeDatabaseMatch =
    async (payload: {
        matchId: string;
        winnerId?: string | null;
        loserId?: string | null;
        redTotalScore: number;
        blueTotalScore: number;
        decision:
            | 'POINTS'
            | 'UNANIMOUS_DECISION'
            | 'SPLIT_DECISION'
            | 'MAJORITY_DECISION'
            | 'KO'
            | 'TKO'
            | 'DISQUALIFICATION'
            | 'RETIREMENT'
            | 'DRAW'
            | 'NO_CONTEST';
    }) =>
        databaseRequest(
            `/matches/${payload.matchId}/complete`,
            {
                method: 'POST',
                body: JSON.stringify(
                    payload,
                ),
            },
        );

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

const getTimestamp = () =>
    new Date().toISOString();

const getDateTime = () => {
    const now = new Date();

    return {
        date: now.toLocaleDateString(
            'en-GB',
            {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
            },
        ),
        time: now.toLocaleTimeString(
            'en-US',
            {
                hour: 'numeric',
                minute: '2-digit',
            },
        ),
    };
};

const getEventLabel = (
    type: RefereeEventType,
) => {
    switch (type) {
        case 'WARNING':
            return 'WARNING';
        case 'CAUTION':
            return 'CAUTION';
        case 'FOUL':
            return 'FOUL';
        case 'KNOCKDOWN':
            return 'KNOCKDOWN';
        case 'RSC':
            return 'RSC';
        case 'KO':
            return 'KO';
        case 'DOCTOR_STOP':
            return 'DOCTOR STOP';
        case 'RETIREMENT':
            return 'RETIREMENT';
        case 'STOP_CONTEST':
            return 'STOP CONTEST';
        case 'CONTINUE':
            return 'CONTINUE';
        default:
            return type;
    }
};

const getCornerLabel = (
    corner: RefereeCorner,
) => {
    if (corner === 'RED') {
        return 'RED';
    }

    if (corner === 'BLUE') {
        return 'BLUE';
    }

    if (corner === 'BOTH') {
        return 'BOTH';
    }

    return 'GENERAL';
};

const isStoppageEvent = (
    event: RefereeEvent,
) =>
    EARLY_STOP_TYPES.includes(
        event.type,
    );

const calculateWinnerFromScores = (
    reviews: RoundReview[],
): OfficialWinner => {
    let redTotal = 0;
    let blueTotal = 0;

    reviews.forEach((review) => {
        if (review.status === 'APPROVED') {
            redTotal += review.redScore;
            blueTotal += review.blueScore;
        }
    });

    if (redTotal > blueTotal) {
        return 'RED';
    }

    if (blueTotal > redTotal) {
        return 'BLUE';
    }

    return 'DRAW';
};

/*
 * =========================================================
 * MAIN SCREEN
 * =========================================================
 */

export default function LiveScoringScreen() {
    const params =
        useLocalSearchParams<{
            redBoxer?: string;
            blueBoxer?: string;
            weightCategory?: string;
            rounds?: string;
            matchType?: string;
            matchId?: string;
            judgeId?: string;
            judgeName?: string;
            tournamentId?: string;
            tournamentMatchId?: string;
        }>();

    const redBoxer =
        params.redBoxer || '';

    const blueBoxer =
        params.blueBoxer || '';

    const weightCategory =
        params.weightCategory ||
        'LIGHTWEIGHT';

    const totalRounds =
        Number(params.rounds) || 3;

    const matchType =
        params.matchType ||
        'TOURNAMENT';

    const matchId =
        params.matchId || '';

    const judgeId =
        params.judgeId || '';

    const judgeName =
        params.judgeName || '';

    const tournamentId =
        params.tournamentId || '';

    const tournamentMatchId =
        params.tournamentMatchId || '';

    /*
     * ADMIN MODE:
     *
     * No judgeId means this screen is being opened
     * as the Admin Live Match Review.
     */
    const isAdminMode =
        !judgeId;

    /*
     * =====================================================
     * START DATABASE MATCH
     * =====================================================
     *
     * Create Match stores the match as UPCOMING.
     * Opening Live Scoring changes it to LIVE.
     */
    useEffect(() => {
        if (!matchId) {
            return;
        }

        let cancelled = false;

        const startMatch = async () => {
            try {
                await startDatabaseMatch(
                    matchId,
                );

                if (!cancelled) {
                    console.log(
                        'Database match started:',
                        matchId,
                    );
                }
            } catch (error) {
                console.log(
                    'Database match start skipped/failed:',
                    error,
                );
            }
        };

        void startMatch();

        return () => {
            cancelled = true;
        };
    }, [matchId]);

    /*
     * =====================================================
     * TOURNAMENT STATUS
     * =====================================================
     *
     * Opening a tournament match means the tournament is
     * now live. Persist that status in PostgreSQL.
     */
    useEffect(() => {
        if (!tournamentId) {
            return;
        }

        let cancelled = false;

        const markTournamentLive = async () => {
            try {
                const tournament =
                    await getTournamentById(
                        tournamentId,
                    );

                if (
                    cancelled ||
                    !tournament ||
                    tournament.status === 'LIVE' ||
                    tournament.status === 'COMPLETED'
                ) {
                    return;
                }

                await saveTournament({
                    ...tournament,
                    status: 'LIVE',
                });
            } catch (error) {
                console.log(
                    'Error marking tournament as LIVE:',
                    error,
                );
            }
        };

        void markTournamentLive();

        return () => {
            cancelled = true;
        };
    }, [tournamentId]);

    /*
     * =====================================================
     * JUDGE STATE
     * =====================================================
     */

    const [redScore, setRedScore] =
        useState(0);

    const [blueScore, setBlueScore] =
        useState(0);

    const [totalRedScore, setTotalRedScore] =
        useState(0);

    const [totalBlueScore, setTotalBlueScore] =
        useState(0);

    const [round, setRound] =
        useState(1);

    const [seconds, setSeconds] =
        useState(180);

    const [isRunning, setIsRunning] =
        useState(false);

    const [history, setHistory] =
        useState<ScoreAction[]>([]);

    const [redoStack, setRedoStack] =
        useState<ScoreAction[]>([]);

    const [roundScores, setRoundScores] =
        useState<JudgeRoundScore[]>([]);

    const [isLoadingScore, setIsLoadingScore] =
        useState(true);

    const [roundReviews, setRoundReviews] =
        useState<RoundReview[]>([]);

    const [
        isWaitingForAdmin,
        setIsWaitingForAdmin,
    ] = useState(false);

    const [
        refereeEvents,
        setRefereeEvents,
    ] = useState<RefereeEvent[]>([]);

    const [
        contestStopped,
        setContestStopped,
    ] = useState(false);

    const [
        stoppageEvent,
        setStoppageEvent,
    ] = useState<RefereeEvent | null>(null);

    const [
        showRefereePanel,
        setShowRefereePanel,
    ] = useState(false);

    const [
        lastApprovedRound,
        setLastApprovedRound,
    ] = useState(0);

    /*
     * =====================================================
     * ADMIN STATE
     * =====================================================
     */

    const [
        adminSelectedRound,
        setAdminSelectedRound,
    ] = useState(1);

    const [
        adminExpandedJudge,
        setAdminExpandedJudge,
    ] = useState<string | null>(null);

    const [
        editingSubmission,
        setEditingSubmission,
    ] = useState<EditingSubmission | null>(
        null,
    );

    const [
        editRedScore,
        setEditRedScore,
    ] = useState('');

    const [
        editBlueScore,
        setEditBlueScore,
    ] = useState('');

    const [
        editReason,
        setEditReason,
    ] = useState('');

    const [
        isSavingAdminEdit,
        setIsSavingAdminEdit,
    ] = useState(false);

    const [
        adminNote,
        setAdminNote,
    ] = useState('');

    const [
        isAdminActionRunning,
        setIsAdminActionRunning,
    ] = useState(false);

    /*
     * =====================================================
     * LOAD JUDGE SCORE
     * =====================================================
     */

    const loadJudgeScore =
        useCallback(
            async () => {
                if (
                    isAdminMode ||
                    !matchId ||
                    !judgeId
                ) {
                    setIsLoadingScore(false);
                    return;
                }

                try {
                    const stored =
                        await AsyncStorage.getItem(
                            JUDGE_SCORES_KEY,
                        );

                    if (!stored) {
                        setIsLoadingScore(false);
                        return;
                    }

                    const parsed:
                        JudgeMatchScore[] =
                        JSON.parse(stored);

                    if (
                        !Array.isArray(
                            parsed,
                        )
                    ) {
                        setIsLoadingScore(false);
                        return;
                    }

                    const existing =
                        parsed.find(
                            (item) =>
                                item.matchId ===
                                matchId &&
                                item.judgeId ===
                                judgeId,
                        );

                    if (existing) {
                        setRoundScores(
                            Array.isArray(
                                existing.roundScores,
                            )
                                ? existing.roundScores
                                : [],
                        );

                        /*
                         * The saved JudgeMatchScore keeps the round that
                         * was last submitted, which is still Round 1 after
                         * Admin approves it. Before restoring that value,
                         * check the Admin approval records and move the
                         * judge to the next round when the saved round
                         * has already been approved.
                         */
                        let restoredRound =
                            existing.currentRound ||
                            1;

                        try {
                            const reviewStored =
                                await AsyncStorage.getItem(
                                    ROUND_REVIEWS_KEY,
                                );

                            if (reviewStored) {
                                const savedReviews:
                                    RoundReview[] =
                                    JSON.parse(
                                        reviewStored,
                                    );

                                if (
                                    Array.isArray(
                                        savedReviews,
                                    )
                                ) {
                                    const approvedRounds =
                                        savedReviews
                                            .filter(
                                                (
                                                    review,
                                                ) =>
                                                    review.matchId ===
                                                        matchId &&
                                                    review.submittedJudgeId ===
                                                        judgeId &&
                                                    review.status ===
                                                        'APPROVED',
                                            )
                                            .map(
                                                (
                                                    review,
                                                ) =>
                                                    review.roundNumber,
                                            );

                                    if (
                                        approvedRounds.length >
                                        0
                                    ) {
                                        const highestApprovedRound =
                                            Math.max(
                                                ...approvedRounds,
                                            );

                                        restoredRound =
                                            Math.min(
                                                highestApprovedRound +
                                                    1,
                                                totalRounds,
                                            );
                                    }
                                }
                            }
                        } catch (reviewError) {
                            console.log(
                                'Error restoring approved round:',
                                reviewError,
                            );
                        }

                        setRound(
                            restoredRound,
                        );

                        setRedScore(
                            restoredRound ===
                                existing.currentRound
                                ? existing.currentRoundRedScore ||
                                    0
                                : 0,
                        );

                        setBlueScore(
                            restoredRound ===
                                existing.currentRound
                                ? existing.currentRoundBlueScore ||
                                    0
                                : 0,
                        );

                        setTotalRedScore(
                            existing.totalRedScore ||
                            0,
                        );

                        setTotalBlueScore(
                            existing.totalBlueScore ||
                            0,
                        );
                    }
                } catch (error) {
                    console.log(
                        'Error loading judge score:',
                        error,
                    );
                } finally {
                    setIsLoadingScore(false);
                }
            },
            [
                isAdminMode,
                matchId,
                judgeId,
            ],
        );

    /*
     * =====================================================
     * LOAD ROUND REVIEWS
     * =====================================================
     */

    const loadRoundReviews =
        useCallback(
            async () => {
                if (!matchId) {
                    setRoundReviews([]);
                    return;
                }

                try {
                    const stored =
                        await AsyncStorage.getItem(
                            ROUND_REVIEWS_KEY,
                        );

                    if (!stored) {
                        setRoundReviews([]);
                        setIsWaitingForAdmin(
                            false,
                        );
                        return;
                    }

                    const parsed:
                        RoundReview[] =
                        JSON.parse(stored);

                    if (
                        !Array.isArray(
                            parsed,
                        )
                    ) {
                        setRoundReviews([]);
                        return;
                    }

                    const matchReviews =
                        parsed.filter(
                            (item) =>
                                item.matchId ===
                                matchId,
                        );

                    setRoundReviews(
                        matchReviews,
                    );

                    if (!isAdminMode) {
                        const currentJudgeReview =
                            matchReviews.find(
                                (item) =>
                                    item.roundNumber ===
                                    round &&
                                    item.submittedJudgeId ===
                                    judgeId,
                            );

                        setIsWaitingForAdmin(
                            currentJudgeReview?.status ===
                            'READY_FOR_ADMIN' ||
                            currentJudgeReview?.status ===
                            'FLAGGED',
                        );
                    }
                } catch (error) {
                    console.log(
                        'Error loading round reviews:',
                        error,
                    );
                }
            },
            [
                matchId,
                isAdminMode,
                round,
                judgeId,
            ],
        );

    /*
     * =====================================================
     * LOAD REFEREE EVENTS
     * =====================================================
     */

    const loadRefereeEvents =
        useCallback(
            async () => {
                if (!matchId) {
                    setRefereeEvents([]);
                    return;
                }

                try {
                    const stored =
                        await AsyncStorage.getItem(
                            REFEREE_EVENTS_KEY,
                        );

                    if (!stored) {
                        setRefereeEvents([]);
                        return;
                    }

                    const parsed:
                        RefereeEvent[] =
                        JSON.parse(stored);

                    if (
                        !Array.isArray(
                            parsed,
                        )
                    ) {
                        return;
                    }

                    const matchEvents =
                        parsed.filter(
                            (item) =>
                                item.matchId ===
                                matchId,
                        );

                    setRefereeEvents(
                        matchEvents,
                    );

                    const stoppage =
                        matchEvents.find(
                            isStoppageEvent,
                        );

                    if (stoppage) {
                        setStoppageEvent(
                            stoppage,
                        );
                        setContestStopped(
                            true,
                        );
                        setIsRunning(false);
                    }
                } catch (error) {
                    console.log(
                        'Error loading referee events:',
                        error,
                    );
                }
            },
            [matchId],
        );

    useEffect(() => {
        void loadJudgeScore();
    }, [loadJudgeScore]);

    useEffect(() => {
        void loadRoundReviews();
    }, [loadRoundReviews]);

    useEffect(() => {
        void loadRefereeEvents();
    }, [loadRefereeEvents]);

    useFocusEffect(
        useCallback(() => {
            void loadJudgeScore();
            void loadRoundReviews();
            void loadRefereeEvents();

            return undefined;
        }, [
            loadJudgeScore,
            loadRoundReviews,
            loadRefereeEvents,
        ]),
    );

    /*
     * =====================================================
     * JUDGE APPROVAL DETECTION
     * =====================================================
     */

    useEffect(() => {
        if (isAdminMode) {
            return;
        }

        const checkApproval =
            async () => {
                if (
                    !matchId ||
                    !judgeId
                ) {
                    return;
                }

                try {
                    const stored =
                        await AsyncStorage.getItem(
                            ROUND_REVIEWS_KEY,
                        );

                    if (!stored) {
                        return;
                    }

                    const parsed:
                        RoundReview[] =
                        JSON.parse(stored);

                    if (
                        !Array.isArray(
                            parsed,
                        )
                    ) {
                        return;
                    }

                    const current =
                        parsed.find(
                            (item) =>
                                item.matchId ===
                                matchId &&
                                item.roundNumber ===
                                round &&
                                item.submittedJudgeId ===
                                judgeId,
                        );

                    if (
                        current?.status !==
                        'APPROVED'
                    ) {
                        return;
                    }

                    if (
                        lastApprovedRound >=
                        round
                    ) {
                        return;
                    }

                    setLastApprovedRound(
                        round,
                    );

                    if (
                        round >=
                        totalRounds
                    ) {
                        setIsWaitingForAdmin(
                            false,
                        );
                        return;
                    }

                    setRound(
                        round + 1,
                    );

                    setRedScore(0);
                    setBlueScore(0);
                    setHistory([]);
                    setRedoStack([]);
                    setSeconds(180);
                    setIsRunning(false);
                    setIsWaitingForAdmin(
                        false,
                    );
                } catch (error) {
                    console.log(
                        'Error checking approval:',
                        error,
                    );
                }
            };

        void checkApproval();

        const approvalPoll =
            setInterval(() => {
                void checkApproval();
            }, 1500);

        return () =>
            clearInterval(approvalPoll);
    }, [
        isAdminMode,
        matchId,
        judgeId,
        round,
        totalRounds,
        lastApprovedRound,
    ]);

    /*
     * =====================================================
     * TIMER
     * =====================================================
     */

    useEffect(() => {
        if (
            isAdminMode ||
            !isRunning ||
            seconds <= 0 ||
            contestStopped ||
            isWaitingForAdmin
        ) {
            return;
        }

        const timer =
            setInterval(() => {
                setSeconds(
                    (previous) => {
                        if (
                            previous <=
                            1
                        ) {
                            setIsRunning(
                                false,
                            );

                            return 0;
                        }

                        return (
                            previous - 1
                        );
                    },
                );
            }, 1000);

        return () =>
            clearInterval(timer);
    }, [
        isAdminMode,
        isRunning,
        seconds,
        contestStopped,
        isWaitingForAdmin,
    ]);

    const formatTime = () => {
        const minutes =
            Math.floor(
                seconds / 60,
            );

        const remaining =
            seconds % 60;

        return `${minutes}:${remaining
            .toString()
            .padStart(2, '0')}`;
    };

    /*
     * =====================================================
     * SAVE JUDGE SCORE
     * =====================================================
     */

    const saveJudgeScore =
        async (
            override?: {
                round?: number;
                redScore?: number;
                blueScore?: number;
                totalRedScore?: number;
                totalBlueScore?: number;
                roundScores?: JudgeRoundScore[];
                status?:
                | 'IN_PROGRESS'
                | 'COMPLETED';
            },
        ) => {
            if (
                isAdminMode ||
                !matchId ||
                !judgeId
            ) {
                return;
            }

            try {
                const stored =
                    await AsyncStorage.getItem(
                        JUDGE_SCORES_KEY,
                    );

                let existing:
                    JudgeMatchScore[] =
                    [];

                if (stored) {
                    try {
                        const parsed =
                            JSON.parse(
                                stored,
                            );

                        if (
                            Array.isArray(
                                parsed,
                            )
                        ) {
                            existing =
                                parsed;
                        }
                    } catch {
                        existing = [];
                    }
                }

                const saveRound =
                    override?.round ??
                    round;

                const saveRed =
                    override?.redScore ??
                    redScore;

                const saveBlue =
                    override?.blueScore ??
                    blueScore;

                const saveTotalRed =
                    override?.totalRedScore ??
                    totalRedScore;

                const saveTotalBlue =
                    override?.totalBlueScore ??
                    totalBlueScore;

                const saveRounds =
                    override?.roundScores ??
                    roundScores;

                const {
                    date,
                    time,
                } = getDateTime();

                const score:
                    JudgeMatchScore =
                {
                    matchId,
                    judgeId,
                    judgeName:
                        judgeName ||
                        judgeId,
                    redBoxer:
                        redBoxer ||
                        'RED BOXER',
                    blueBoxer:
                        blueBoxer ||
                        'BLUE BOXER',
                    weightCategory,
                    rounds:
                        totalRounds,
                    matchType,
                    roundScores:
                        saveRounds,
                    currentRound:
                        saveRound,
                    currentRoundRedScore:
                        saveRed,
                    currentRoundBlueScore:
                        saveBlue,
                    totalRedScore:
                        saveTotalRed,
                    totalBlueScore:
                        saveTotalBlue,
                    status:
                        override?.status ??
                        'IN_PROGRESS',
                    date,
                    time,
                };

                const key =
                    `${matchId}_${judgeId}`;

                const updated = [
                    score,
                    ...existing.filter(
                        (item) =>
                            `${item.matchId}_${item.judgeId}` !==
                            key,
                    ),
                ];

                await AsyncStorage.setItem(
                    JUDGE_SCORES_KEY,
                    JSON.stringify(
                        updated,
                    ),
                );
            } catch (error) {
                console.log(
                    'Error saving judge score:',
                    error,
                );
            }
        };

    /*
     * =====================================================
     * JUDGE SCORING
     * =====================================================
     */

    const addScore = (
        side: ScoreAction,
    ) => {
        if (
            isAdminMode ||
            isWaitingForAdmin ||
            contestStopped
        ) {
            return;
        }

        if (side === 'RED') {
            const next =
                redScore + 1;

            const total =
                totalRedScore + 1;

            setRedScore(next);
            setTotalRedScore(total);

            setHistory(
                (previous) => [
                    ...previous,
                    side,
                ],
            );

            setRedoStack([]);

            void saveJudgeScore({
                redScore: next,
                totalRedScore: total,
            });
        } else {
            const next =
                blueScore + 1;

            const total =
                totalBlueScore + 1;

            setBlueScore(next);
            setTotalBlueScore(total);

            setHistory(
                (previous) => [
                    ...previous,
                    side,
                ],
            );

            setRedoStack([]);

            void saveJudgeScore({
                blueScore: next,
                totalBlueScore: total,
            });
        }
    };

    const undo = () => {
        if (
            isAdminMode ||
            history.length === 0 ||
            isWaitingForAdmin ||
            contestStopped
        ) {
            return;
        }

        const last =
            history[
            history.length - 1
            ];

        let nextRed =
            redScore;

        let nextBlue =
            blueScore;

        let nextTotalRed =
            totalRedScore;

        let nextTotalBlue =
            totalBlueScore;

        if (last === 'RED') {
            nextRed =
                Math.max(
                    0,
                    redScore - 1,
                );

            nextTotalRed =
                Math.max(
                    0,
                    totalRedScore - 1,
                );
        } else {
            nextBlue =
                Math.max(
                    0,
                    blueScore - 1,
                );

            nextTotalBlue =
                Math.max(
                    0,
                    totalBlueScore - 1,
                );
        }

        setRedScore(nextRed);
        setBlueScore(nextBlue);
        setTotalRedScore(
            nextTotalRed,
        );
        setTotalBlueScore(
            nextTotalBlue,
        );

        setHistory(
            (previous) =>
                previous.slice(
                    0,
                    -1,
                ),
        );

        setRedoStack(
            (previous) => [
                ...previous,
                last,
            ],
        );

        void saveJudgeScore({
            redScore: nextRed,
            blueScore: nextBlue,
            totalRedScore:
                nextTotalRed,
            totalBlueScore:
                nextTotalBlue,
        });
    };

    const redo = () => {
        if (
            isAdminMode ||
            redoStack.length === 0 ||
            isWaitingForAdmin ||
            contestStopped
        ) {
            return;
        }

        const action =
            redoStack[
            redoStack.length - 1
            ];

        let nextRed =
            redScore;

        let nextBlue =
            blueScore;

        let nextTotalRed =
            totalRedScore;

        let nextTotalBlue =
            totalBlueScore;

        if (action === 'RED') {
            nextRed =
                redScore + 1;

            nextTotalRed =
                totalRedScore + 1;
        } else {
            nextBlue =
                blueScore + 1;

            nextTotalBlue =
                totalBlueScore + 1;
        }

        setRedScore(nextRed);
        setBlueScore(nextBlue);
        setTotalRedScore(
            nextTotalRed,
        );
        setTotalBlueScore(
            nextTotalBlue,
        );

        setRedoStack(
            (previous) =>
                previous.slice(
                    0,
                    -1,
                ),
        );

        setHistory(
            (previous) => [
                ...previous,
                action,
            ],
        );

        void saveJudgeScore({
            redScore: nextRed,
            blueScore: nextBlue,
            totalRedScore:
                nextTotalRed,
            totalBlueScore:
                nextTotalBlue,
        });
    };

    /*
     * =====================================================
     * REFEREE EVENTS
     * =====================================================
     */

    const saveRefereeEvent =
        async (
            type: RefereeEventType,
            corner: RefereeCorner,
            note: string | null = null,
        ) => {
            if (!matchId) {
                return null;
            }

            const event:
                RefereeEvent =
            {
                id:
                    `REF-${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2, 8)}`,
                matchId,
                tournamentId:
                    tournamentId ||
                    null,
                tournamentMatchId:
                    tournamentMatchId ||
                    null,
                type,
                roundNumber:
                    round,
                time:
                    formatTime(),
                corner,
                note,
                refereeId:
                    isAdminMode ? ADMIN_ID : judgeId || null,
                refereeName:
                    isAdminMode ? ADMIN_NAME : judgeName || 'ASSIGNED REFEREE',
                createdAt:
                    getTimestamp(),
            };

            try {
                const stored =
                    await AsyncStorage.getItem(
                        REFEREE_EVENTS_KEY,
                    );

                let existing:
                    RefereeEvent[] =
                    [];

                if (stored) {
                    try {
                        const parsed =
                            JSON.parse(
                                stored,
                            );

                        if (
                            Array.isArray(
                                parsed,
                            )
                        ) {
                            existing =
                                parsed;
                        }
                    } catch {
                        existing = [];
                    }
                }

                const updated = [
                    event,
                    ...existing,
                ];

                await AsyncStorage.setItem(
                    REFEREE_EVENTS_KEY,
                    JSON.stringify(
                        updated,
                    ),
                );

                setRefereeEvents(
                    (previous) => [
                        ...previous,
                        event,
                    ],
                );

                return event;
            } catch (error) {
                console.log(
                    'Error saving referee event:',
                    error,
                );

                return null;
            }
        };

    const recordRefereeEvent =
        async (
            type:
                | 'WARNING'
                | 'CAUTION'
                | 'FOUL'
                | 'KNOCKDOWN',
            corner: RefereeCorner,
        ) => {
            if (!isAdminMode || contestStopped) {
                return;
            }

            await saveRefereeEvent(
                type,
                corner,
            );
        };

    const stopContest =
        async (
            type:
                | 'RSC'
                | 'KO'
                | 'DOCTOR_STOP'
                | 'RETIREMENT'
                | 'STOP_CONTEST',
            stoppedCorner: 'RED' | 'BLUE',
        ) => {
            if (!isAdminMode || contestStopped) {
                return;
            }

            const winnerCorner =
                stoppedCorner === 'RED' ? 'BLUE' : 'RED';

            const stoppedText =
                stoppedCorner === 'RED'
                    ? redBoxer || 'RED BOXER'
                    : blueBoxer || 'BLUE BOXER';

            const winnerText =
                winnerCorner === 'RED'
                    ? redBoxer || 'RED BOXER'
                    : blueBoxer || 'BLUE BOXER';

            const event = await saveRefereeEvent(
                type,
                stoppedCorner,
                `${getEventLabel(type)} — KNOCKED OUT / STOPPED: ${stoppedText} — WINNER: ${winnerText}`,
            );

            if (!event) {
                return;
            }

            setStoppageEvent(event);
            setContestStopped(true);
            setIsRunning(false);
            setShowRefereePanel(false);

            Alert.alert(
                `${getEventLabel(type)} CONFIRMED`,
                `${stoppedText} was stopped.\nWinner: ${winnerText}\nRound: ${round}\nTime: ${formatTime()}`,
            );
        };

    const openRefereeAction =
        (
            type:
                | 'WARNING'
                | 'CAUTION'
                | 'FOUL'
                | 'KNOCKDOWN',
        ) => {
            Alert.alert(
                getEventLabel(type),
                'Select the boxer involved.',
                [
                    {
                        text: 'RED',
                        onPress: () =>
                            void recordRefereeEvent(
                                type,
                                'RED',
                            ),
                    },
                    {
                        text: 'BLUE',
                        onPress: () =>
                            void recordRefereeEvent(
                                type,
                                'BLUE',
                            ),
                    },
                    {
                        text: 'CANCEL',
                        style: 'cancel',
                    },
                ],
            );
        };

    const openStopAction =
        (
            type:
                | 'RSC'
                | 'KO'
                | 'DOCTOR_STOP'
                | 'RETIREMENT'
                | 'STOP_CONTEST',
        ) => {
            if (!isAdminMode || contestStopped) {
                return;
            }

            Alert.alert(
                getEventLabel(type),
                'Select the boxer who was knocked out / stopped.',
                [
                    {
                        text: `${redBoxer || 'RED BOXER'} — STOPPED`,
                        onPress: () => void stopContest(type, 'RED'),
                    },
                    {
                        text: `${blueBoxer || 'BLUE BOXER'} — STOPPED`,
                        onPress: () => void stopContest(type, 'BLUE'),
                    },
                    {
                        text: 'CANCEL',
                        style: 'cancel',
                    },
                ],
            );
        };

    /*
     * =====================================================
     * JUDGE ROUND SUBMISSION
     * =====================================================
     */

    const submitRoundForAdmin =
        async () => {
            if (
                isAdminMode ||
                isWaitingForAdmin ||
                contestStopped
            ) {
                return;
            }

            if (
                redScore === 0 &&
                blueScore === 0
            ) {
                Alert.alert(
                    'ROUND NOT SCORED',
                    'Enter the round score before submitting.',
                );

                return;
            }

            const completedRound:
                JudgeRoundScore =
            {
                round,
                redScore,
                blueScore,
            };

            const updatedRoundScores =
                [
                    ...roundScores.filter(
                        (item) =>
                            item.round !==
                            round,
                    ),
                    completedRound,
                ].sort(
                    (a, b) =>
                        a.round -
                        b.round,
                );

            setRoundScores(
                updatedRoundScores,
            );

            await saveJudgeScore({
                round,
                redScore,
                blueScore,
                totalRedScore,
                totalBlueScore,
                roundScores:
                    updatedRoundScores,
                status:
                    round >=
                        totalRounds
                        ? 'COMPLETED'
                        : 'IN_PROGRESS',
            });

            const review:
                RoundReview =
            {
                id:
                    `ROUND-${matchId}-${round}-${judgeId}`,
                matchId,
                tournamentId:
                    tournamentId ||
                    null,
                tournamentMatchId:
                    tournamentMatchId ||
                    null,
                roundNumber:
                    round,
                status:
                    'READY_FOR_ADMIN',
                submittedJudgeId:
                    judgeId,
                submittedJudgeName:
                    judgeName ||
                    judgeId ||
                    'ASSIGNED JUDGE',
                redScore,
                blueScore,
                submittedAt:
                    getTimestamp(),
                adminEdited:
                    false,
            };

            try {
                const stored =
                    await AsyncStorage.getItem(
                        ROUND_REVIEWS_KEY,
                    );

                let existing:
                    RoundReview[] =
                    [];

                if (stored) {
                    try {
                        const parsed =
                            JSON.parse(
                                stored,
                            );

                        if (
                            Array.isArray(
                                parsed,
                            )
                        ) {
                            existing =
                                parsed;
                        }
                    } catch {
                        existing = [];
                    }
                }

                const key =
                    `${matchId}_${round}_${judgeId}`;

                const updated = [
                    review,
                    ...existing.filter(
                        (item) =>
                            `${item.matchId}_${item.roundNumber}_${item.submittedJudgeId}` !==
                            key,
                    ),
                ];

                await AsyncStorage.setItem(
                    ROUND_REVIEWS_KEY,
                    JSON.stringify(
                        updated,
                    ),
                );

                setRoundReviews(
                    updated.filter(
                        (item) =>
                            item.matchId ===
                            matchId,
                    ),
                );

                /*
                 * Persist the official judge round score
                 * in PostgreSQL as well.
                 *
                 * Referee events are converted into the
                 * RoundScore counters used by the DB.
                 */
                try {
                    const roundEvents =
                        refereeEvents.filter(
                            (event) =>
                                event.roundNumber ===
                                round,
                        );

                    const redKnockdowns =
                        roundEvents.filter(
                            (event) =>
                                event.type ===
                                    'KNOCKDOWN' &&
                                event.corner ===
                                    'RED',
                        ).length;

                    const blueKnockdowns =
                        roundEvents.filter(
                            (event) =>
                                event.type ===
                                    'KNOCKDOWN' &&
                                event.corner ===
                                    'BLUE',
                        ).length;

                    const redWarnings =
                        roundEvents.filter(
                            (event) =>
                                event.type ===
                                    'WARNING' &&
                                event.corner ===
                                    'RED',
                        ).length;

                    const blueWarnings =
                        roundEvents.filter(
                            (event) =>
                                event.type ===
                                    'WARNING' &&
                                event.corner ===
                                    'BLUE',
                        ).length;

                    const redFouls =
                        roundEvents.filter(
                            (event) =>
                                event.type ===
                                    'FOUL' &&
                                event.corner ===
                                    'RED',
                        ).length;

                    const blueFouls =
                        roundEvents.filter(
                            (event) =>
                                event.type ===
                                    'FOUL' &&
                                event.corner ===
                                    'BLUE',
                        ).length;

                    await saveDatabaseRoundScore(
                        {
                            matchId,
                            judgeId,
                            roundNumber:
                                round,
                            redScore,
                            blueScore,
                            redKnockdowns,
                            blueKnockdowns,
                            redWarnings,
                            blueWarnings,
                            redFouls,
                            blueFouls,
                        },
                    );
                } catch (databaseError) {
                    console.log(
                        'Database round score error:',
                        databaseError,
                    );

                    Alert.alert(
                        'DATABASE SAVE FAILED',
                        databaseError instanceof
                            Error
                            ? databaseError.message
                            : 'The round could not be saved to PostgreSQL.',
                    );

                    return;
                }

                setIsWaitingForAdmin(
                    true,
                );

                setIsRunning(false);

                Alert.alert(
                    'ROUND SUBMITTED',
                    `Round ${round} has been submitted for Admin verification.`,
                );
            } catch (error) {
                console.log(
                    'Error saving review:',
                    error,
                );
            }
        };

    /*
     * =====================================================
     * ADMIN HELPERS
     * =====================================================
     */

    const adminRoundReviews =
        useMemo(
            () =>
                roundReviews
                    .filter(
                        (item) =>
                            item.roundNumber ===
                            adminSelectedRound,
                    )
                    .sort(
                        (a, b) =>
                            a.submittedJudgeName.localeCompare(
                                b.submittedJudgeName,
                            ),
                    ),
            [
                roundReviews,
                adminSelectedRound,
            ],
        );

    const adminApprovedReviews =
        useMemo(
            () =>
                roundReviews.filter(
                    (item) =>
                        item.status ===
                        'APPROVED',
                ),
            [roundReviews],
        );

    const adminAssignedJudgeIds =
        useMemo(() => {
            const ids =
                new Set<string>();

            roundReviews.forEach(
                (review) => {
                    if (
                        review.submittedJudgeId
                    ) {
                        ids.add(
                            review.submittedJudgeId,
                        );
                    }
                },
            );

            return Array.from(ids);
        }, [roundReviews]);

    const adminExpectedJudgeCount =
        Math.max(
            4,
            adminAssignedJudgeIds.length,
        );

    const adminSubmittedCount =
        adminRoundReviews.length;

    const adminAllJudgesSubmitted =
        adminSubmittedCount >=
        adminExpectedJudgeCount;

    const adminRoundApproved =
        adminRoundReviews.length >
        0 &&
        adminRoundReviews.every(
            (review) =>
                review.status ===
                'APPROVED',
        );

    const adminOfficialWinner =
        calculateWinnerFromScores(
            adminApprovedReviews,
        );

    /*
     * =====================================================
     * ADMIN EDIT SCORE
     * =====================================================
     */

    const openEditScore =
        (review: RoundReview) => {
            setEditingSubmission({
                review,
            });

            setEditRedScore(
                String(
                    review.redScore,
                ),
            );

            setEditBlueScore(
                String(
                    review.blueScore,
                ),
            );

            setEditReason('');

        };

    const closeEditScore =
        () => {
            if (
                isSavingAdminEdit
            ) {
                return;
            }

            setEditingSubmission(
                null,
            );

            setEditRedScore('');
            setEditBlueScore('');
            setEditReason('');
        };

    const saveAdminScoreEdit =
        async () => {
            if (
                !editingSubmission
            ) {
                return;
            }

            const red =
                Number(
                    editRedScore,
                );

            const blue =
                Number(
                    editBlueScore,
                );

            const reason =
                editReason.trim();

            if (
                !Number.isInteger(
                    red,
                ) ||
                !Number.isInteger(
                    blue,
                ) ||
                red < 0 ||
                red > 20 ||
                blue < 0 ||
                blue > 20
            ) {
                Alert.alert(
                    'INVALID SCORE',
                    'Scores must be whole numbers between 0 and 20.',
                );

                return;
            }

            if (!reason) {
                Alert.alert(
                    'REASON REQUIRED',
                    'Enter a reason for the Admin score edit.',
                );

                return;
            }

            const review =
                editingSubmission.review;

            setIsSavingAdminEdit(
                true,
            );

            try {
                const stored =
                    await AsyncStorage.getItem(
                        ROUND_REVIEWS_KEY,
                    );

                let reviews:
                    RoundReview[] =
                    stored
                        ? JSON.parse(
                            stored,
                        )
                        : [];

                if (
                    !Array.isArray(
                        reviews,
                    )
                ) {
                    reviews = [];
                }

                const updatedReviews =
                    reviews.map(
                        (item) => {
                            if (
                                item.id !==
                                review.id
                            ) {
                                return item;
                            }

                            return {
                                ...item,
                                redScore:
                                    red,
                                blueScore:
                                    blue,
                                adminEdited:
                                    true,
                                adminEditedBy:
                                    ADMIN_ID,
                                adminEditedByName:
                                    ADMIN_NAME,
                                adminEditedAt:
                                    getTimestamp(),
                                adminEditReason:
                                    reason,
                            };
                        },
                    );

                /*
                 * Keep PostgreSQL in sync with the Admin edit.
                 * submittedJudgeId is already the PostgreSQL Judge CUID for
                 * scores loaded from the database. We intentionally do NOT
                 * call GET /matches/history here because the edit only needs
                 * to update the existing RoundScore. The backend preserves
                 * knockdowns/warnings/fouls when these fields are omitted.
                 */
                if (matchId && review.submittedJudgeId) {
                    await saveDatabaseRoundScore({
                        matchId,
                        judgeId: review.submittedJudgeId,
                        roundNumber: review.roundNumber,
                        redScore: red,
                        blueScore: blue,
                    });
                }

                await AsyncStorage.setItem(
                    ROUND_REVIEWS_KEY,
                    JSON.stringify(
                        updatedReviews,
                    ),
                );

                /*
                 * Create permanent Admin audit record.
                 */
                const override:
                    AdminOverride =
                {
                    id:
                        `OVR-${Date.now()}-${Math.random()
                            .toString(
                                36,
                            )
                            .slice(
                                2,
                                8,
                            )}`,
                    adminId:
                        ADMIN_ID,
                    adminName:
                        ADMIN_NAME,
                    field:
                        `JUDGE_SCORE_${review.submittedJudgeId}_${review.matchId}_ROUND_${review.roundNumber}`,
                    previousValue:
                        `${review.redScore}-${review.blueScore}`,
                    newValue:
                        `${red}-${blue}`,
                    reason,
                    createdAt:
                        getTimestamp(),
                };

                const overrideStored =
                    await AsyncStorage.getItem(
                        ADMIN_OVERRIDES_KEY,
                    );

                let overrides:
                    AdminOverride[] =
                    overrideStored
                        ? JSON.parse(
                            overrideStored,
                        )
                        : [];

                if (
                    !Array.isArray(
                        overrides,
                    )
                ) {
                    overrides = [];
                }

                await AsyncStorage.setItem(
                    ADMIN_OVERRIDES_KEY,
                    JSON.stringify([
                        override,
                        ...overrides,
                    ]),
                );

                /*
                 * Keep tournament round review
                 * synchronized.
                 */
                if (
                    tournamentId &&
                    tournamentMatchId
                ) {
                    const tournament =
                        await getTournamentById(
                            tournamentId,
                        );

                    if (tournament) {
                        const match =
                            tournament.weightCategories
                                .flatMap(
                                    (
                                        category,
                                    ) =>
                                        category.matches,
                                )
                                .find(
                                    (
                                        item,
                                    ) =>
                                        item.id ===
                                        tournamentMatchId,
                                );

                        if (match) {
                            const reviews =
                                Array.isArray(
                                    match.roundReviews,
                                )
                                    ? [
                                        ...match.roundReviews,
                                    ]
                                    : [];

                            const target =
                                reviews.find(
                                    (
                                        item,
                                    ) =>
                                        item.roundNumber ===
                                        review.roundNumber &&
                                        item.judgeScores.some(
                                            (
                                                score,
                                            ) =>
                                                score.judgeId ===
                                                review.submittedJudgeId,
                                        ),
                                );

                            if (target) {
                                const judgeScore =
                                    target.judgeScores.find(
                                        (
                                            score,
                                        ) =>
                                            score.judgeId ===
                                            review.submittedJudgeId,
                                    );

                                if (
                                    judgeScore
                                ) {
                                    judgeScore.redScore =
                                        red;

                                    judgeScore.blueScore =
                                        blue;
                                }

                                if (target.judgeScores?.length) {
                                    const roundRedTotal =
                                        target.judgeScores.reduce(
                                            (sum, score) =>
                                                sum + Number(score.redScore || 0),
                                            0,
                                        );
                                    const roundBlueTotal =
                                        target.judgeScores.reduce(
                                            (sum, score) =>
                                                sum + Number(score.blueScore || 0),
                                            0,
                                        );

                                    target.roundWinner =
                                        roundRedTotal > roundBlueTotal
                                            ? 'RED'
                                            : roundBlueTotal > roundRedTotal
                                                ? 'BLUE'
                                                : 'DRAW';
                                }
                            }

                            await updateTournamentMatch(
                                tournamentId,
                                tournamentMatchId,
                                {
                                    roundReviews:
                                        reviews,
                                    adminOverrides:
                                        [
                                            ...(match.adminOverrides ||
                                                []),
                                            override,
                                        ],
                                },
                            );
                        }
                    }
                }

                setRoundReviews(
                    updatedReviews.filter(
                        (item) =>
                            item.matchId ===
                            matchId,
                    ),
                );

                closeEditScore();

                Alert.alert(
                    'SCORE UPDATED',
                    `Admin changed ${review.submittedJudgeName}'s Round ${review.roundNumber} score from ${review.redScore}-${review.blueScore} to ${red}-${blue}.\n\nReason recorded:\n${reason}`,
                );
            } catch (error) {
                console.log(
                    'Admin score edit error:',
                    error,
                );

                Alert.alert(
                    'ERROR',
                    'The score could not be updated.',
                );
            } finally {
                setIsSavingAdminEdit(
                    false,
                );
            }
        };

    /*
     * =====================================================
     * ADMIN ROUND APPROVAL
     * =====================================================
     */

    const approveAdminRound =
        async () => {
            if (
                !matchId ||
                isAdminActionRunning
            ) {
                return;
            }

            if (
                !adminAllJudgesSubmitted
            ) {
                Alert.alert(
                    'WAITING FOR JUDGES',
                    `${adminSubmittedCount} of ${adminExpectedJudgeCount} judges have submitted Round ${adminSelectedRound}.`,
                );

                return;
            }

            if (
                adminRoundReviews.some(
                    (item) =>
                        item.status ===
                        'FLAGGED',
                )
            ) {
                Alert.alert(
                    'ROUND FLAGGED',
                    'Resolve the flagged judge submission before approving this round.',
                );

                return;
            }

            Alert.alert(
                `APPROVE ROUND ${adminSelectedRound}`,
                'This will verify the submitted scores and unlock the next round for judges.',
                [
                    {
                        text: 'CANCEL',
                        style: 'cancel',
                    },
                    {
                        text: 'APPROVE',
                        onPress: () =>
                            void performApproveRound(),
                    },
                ],
            );
        };

    const performApproveRound =
        async () => {
            setIsAdminActionRunning(
                true,
            );

            try {
                const now =
                    getTimestamp();

                const stored =
                    await AsyncStorage.getItem(
                        ROUND_REVIEWS_KEY,
                    );

                let reviews:
                    RoundReview[] =
                    stored
                        ? JSON.parse(
                            stored,
                        )
                        : [];

                if (
                    !Array.isArray(
                        reviews,
                    )
                ) {
                    reviews = [];
                }

                const updated: RoundReview[] =
                    reviews.map(
                        (review): RoundReview => {
                            if (
                                review.matchId !==
                                matchId ||
                                review.roundNumber !==
                                adminSelectedRound
                            ) {
                                return review;
                            }

                            return {
                                ...review,
                                status:
                                    'APPROVED',
                                adminApprovedBy:
                                    ADMIN_ID,
                                adminApprovedByName:
                                    ADMIN_NAME,
                                adminApprovedAt:
                                    now,
                            };
                        },
                    );

                await AsyncStorage.setItem(
                    ROUND_REVIEWS_KEY,
                    JSON.stringify(
                        updated,
                    ),
                );

                /*
                 * Synchronize the tournament
                 * round review structure.
                 */
                if (
                    tournamentId &&
                    tournamentMatchId
                ) {
                    const synchronizedReviews: RoundReview[] =
                        updated.filter(
                            (item): item is RoundReview =>
                                item.matchId === matchId &&
                                item.roundNumber === adminSelectedRound,
                        );

                    await synchronizeTournamentRound(
                        synchronizedReviews,
                        adminSelectedRound,
                    );

                    const matchUpdatedReviews: RoundReview[] =
                        updated.filter(
                            (item): item is RoundReview =>
                                item.matchId === matchId,
                        );

                    setRoundReviews(
                        matchUpdatedReviews,
                    );
                }

                /*
                 * Admin should automatically move to the next round after
                 * approving the current round. Previous rounds remain
                 * selectable and editable from the round chips.
                 */
                const approvedRound = adminSelectedRound;
                const nextRound = Math.min(
                    approvedRound + 1,
                    totalRounds,
                );

                setLastApprovedRound(
                    Math.max(lastApprovedRound, approvedRound),
                );
                setAdminSelectedRound(nextRound);
                setAdminExpandedJudge(null);
                setAdminNote('');

                Alert.alert(
                    'ROUND APPROVED',
                    approvedRound < totalRounds
                        ? `Round ${approvedRound} has been verified.\n\nAdmin moved to Round ${nextRound}.`
                        : `Round ${approvedRound} has been verified.\n\nAll rounds are approved. You can now finalize the official result.`,
                );
            } catch (error) {
                    console.log(
                        'Round approval error:',
                        error,
                    );

                    Alert.alert(
                        'ERROR',
                        'The round could not be approved.',
                    );
                } finally {
                    setIsAdminActionRunning(
                        false,
                    );
                }
            };

            /*
             * =====================================================
             * ADMIN FLAG ROUND
             * =====================================================
             */

            const flagAdminRound =
                async () => {
                    if (
                        isAdminActionRunning
                    ) {
                        return;
                    }

                    Alert.prompt(
                        'FLAG ROUND',
                        'Enter the reason for flagging this round.',
                        [
                            {
                                text: 'CANCEL',
                                style: 'cancel',
                            },
                            {
                                text: 'FLAG',
                                onPress: (
                                    reason?: string,
                                ) =>
                                    void performFlagRound(
                                        reason,
                                    ),
                            },
                        ],
                        'plain-text',
                    );
                };

            const performFlagRound =
                async (
                    reason: string | undefined,
                ) => {
                    const cleanReason =
                        reason?.trim() || '';

                    if (!cleanReason) {
                        Alert.alert(
                            'REASON REQUIRED',
                            'A reason is required when flagging a round.',
                        );

                        return;
                    }

                    setIsAdminActionRunning(
                        true,
                    );

                    try {
                        const stored =
                            await AsyncStorage.getItem(
                                ROUND_REVIEWS_KEY,
                            );

                        let reviews:
                            RoundReview[] =
                            stored
                                ? JSON.parse(
                                    stored,
                                )
                                : [];

                        if (
                            !Array.isArray(
                                reviews,
                            )
                        ) {
                            reviews = [];
                        }

                        const updated: RoundReview[] =
                            reviews.map(
                                (review): RoundReview => {
                                    if (
                                        review.matchId !==
                                        matchId ||
                                        review.roundNumber !==
                                        adminSelectedRound
                                    ) {
                                        return review;
                                    }

                                    return {
                                        ...review,
                                        status:
                                            'FLAGGED',
                                        adminEditReason:
                                            cleanReason,
                                    };
                                },
                            );

                        await AsyncStorage.setItem(
                            ROUND_REVIEWS_KEY,
                            JSON.stringify(
                                updated,
                            ),
                        );

                        setRoundReviews(
                            updated.filter(
                                (item) =>
                                    item.matchId ===
                                    matchId,
                            ),
                        );

                        Alert.alert(
                            'ROUND FLAGGED',
                            `Round ${adminSelectedRound} has been flagged.`,
                        );
                    } catch (error) {
                        console.log(
                            'Flag error:',
                            error,
                        );
                    } finally {
                        setIsAdminActionRunning(
                            false,
                        );
                    }
                };

            /*
             * =====================================================
             * TOURNAMENT ROUND SYNCHRONIZATION
             * =====================================================
             */

            async function synchronizeTournamentRound(
                submittedReviews: RoundReview[],
                roundNumber: number,
            ) {
                    if (
                        !tournamentId ||
                        !tournamentMatchId
                    ) {
                        return;
                    }

                    try {
                        const tournament =
                            await getTournamentById(
                                tournamentId,
                            );

                        if (!tournament) {
                            return;
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
                                        tournamentMatchId,
                                );

                        if (!match) {
                            return;
                        }

                        const existingReviews =
                            Array.isArray(
                                match.roundReviews,
                            )
                                ? [
                                    ...match.roundReviews,
                                ]
                                : [];

                        const judgeScores =
                            submittedReviews.map(
                                (review) => ({
                                    judgeId:
                                        review.submittedJudgeId,
                                    judgeName:
                                        review.submittedJudgeName,
                                    redScore:
                                        review.redScore,
                                    blueScore:
                                        review.blueScore,
                                    submittedAt:
                                        review.submittedAt,
                                }),
                            );

                        const redTotal =
                            judgeScores.reduce(
                                (
                                    total,
                                    score,
                                ) =>
                                    total +
                                    score.redScore,
                                0,
                            );

                        const blueTotal =
                            judgeScores.reduce(
                                (
                                    total,
                                    score,
                                ) =>
                                    total +
                                    score.blueScore,
                                0,
                            );

                        const roundWinner =
                            redTotal >
                                blueTotal
                                ? 'RED'
                                : blueTotal >
                                    redTotal
                                    ? 'BLUE'
                                    : 'DRAW';

                        const newReview:
                            TournamentRoundReview =
                        {
                            roundNumber,
                            status:
                                'APPROVED',
                            submittedJudgeCount:
                                judgeScores.length,
                            judgeScores,
                            roundWinner,
                            approvedBy:
                                ADMIN_ID,
                            approvedByName:
                                ADMIN_NAME,
                            approvedAt:
                                getTimestamp(),
                            adminNote:
                                adminNote ||
                                null,
                            flagReason:
                                null,
                        };

                        const index =
                            existingReviews.findIndex(
                                (item) =>
                                    item.roundNumber ===
                                    roundNumber,
                            );

                        if (
                            index >= 0
                        ) {
                            existingReviews[
                                index
                            ] = newReview;
                        } else {
                            existingReviews.push(
                                newReview,
                            );
                        }

                        await updateTournamentMatch(
                            tournamentId,
                            tournamentMatchId,
                            {
                                roundReviews:
                                    existingReviews,
                            },
                        );
                    } catch (error) {
                        console.log(
                            'Tournament round sync error:',
                            error,
                        );
                    }
            }

            /*
             * =====================================================
             * FINAL OFFICIAL RESULT
             * =====================================================
             */

            const finalizeOfficialResult =
                async () => {
                    if (
                        isAdminActionRunning
                    ) {
                        return;
                    }

                    const finalReviews =
                        roundReviews.filter(
                            (review) =>
                                review.roundNumber ===
                                totalRounds &&
                                review.status ===
                                'APPROVED',
                        );

                    // A referee stoppage ends the match immediately, so
                    // Admin does not need to wait for the scheduled final
                    // round submissions before finalizing the official result.
                    const hasStoppage =
                        refereeEvents.some(isStoppageEvent);

                    if (
                        !hasStoppage &&
                        finalReviews.length <
                            adminExpectedJudgeCount
                    ) {
                        Alert.alert(
                            'FINAL ROUND NOT READY',
                            `All ${adminExpectedJudgeCount} judges must have their final-round scores approved first.`,
                        );

                        return;
                    }

                    const stoppage =
                        refereeEvents.find(
                            isStoppageEvent,
                        );

                    let winner:
                        OfficialWinner =
                        calculateWinnerFromScores(
                            roundReviews,
                        );

                    let stoppageMethod:
                        MatchStoppage['method'] =
                        null;

                    let stoppageWinner:
                        'RED' | 'BLUE' | null =
                        null;

                    if (stoppage) {
                        stoppageMethod =
                            stoppage.type as MatchStoppage['method'];

                        const note =
                            stoppage.note || '';

                        if (
                            note.includes(
                                'WINNER: ' +
                                (redBoxer ||
                                    'RED BOXER'),
                            )
                        ) {
                            winner = 'RED';
                            stoppageWinner =
                                'RED';
                        } else if (
                            note.includes(
                                'WINNER: ' +
                                (blueBoxer ||
                                    'BLUE BOXER'),
                            )
                        ) {
                            winner = 'BLUE';
                            stoppageWinner =
                                'BLUE';
                        }
                    }

                    Alert.alert(
                        'FINALIZE OFFICIAL RESULT',
                        `Official winner: ${winner === 'RED'
                            ? redBoxer
                            : winner ===
                                'BLUE'
                                ? blueBoxer
                                : 'DRAW'
                        }\n\nThis will complete the tournament match and create the official match history record.`,
                        [
                            {
                                text: 'CANCEL',
                                style: 'cancel',
                            },
                            {
                                text: 'FINALIZE',
                                onPress: () =>
                                    void performFinalizeResult(
                                        winner,
                                        stoppageMethod,
                                        stoppageWinner,
                                    ),
                            },
                        ],
                    );
                };

            const performFinalizeResult =
                async (
                    winner: OfficialWinner,
                    stoppageMethod:
                        | MatchStoppage['method'],
                    stoppageWinner:
                        | 'RED'
                        | 'BLUE'
                        | null,
                ) => {
                    setIsAdminActionRunning(
                        true,
                    );

                    try {
                        const winnerName =
                            winner ===
                                'RED'
                                ? redBoxer
                                : winner ===
                                    'BLUE'
                                    ? blueBoxer
                                    : 'DRAW';

                        const loserName =
                            winner ===
                                'RED'
                                ? blueBoxer
                                : winner ===
                                    'BLUE'
                                    ? redBoxer
                                    : '';

                        const totalRed =
                            roundReviews
                                .filter(
                                    (item) =>
                                        item.status ===
                                        'APPROVED',
                                )
                                .reduce(
                                    (
                                        total,
                                        item,
                                    ) =>
                                        total +
                                        item.redScore,
                                    0,
                                );

                        const totalBlue =
                            roundReviews
                                .filter(
                                    (item) =>
                                        item.status ===
                                        'APPROVED',
                                )
                                .reduce(
                                    (
                                        total,
                                        item,
                                    ) =>
                                        total +
                                        item.blueScore,
                                    0,
                                );

                        const now =
                            getTimestamp();

                        /*
                         * Save official match history.
                         */
                        const {
                            date,
                            time,
                        } = getDateTime();

                        const historyResult =
                            winner === 'DRAW'
                                ? 'DRAW'
                                : winner ===
                                    'RED'
                                    ? 'WON'
                                    : 'LOST';

                        await saveMatch({
                            id:
                                `MATCH-${Date.now()}`,
                            redBoxer:
                                redBoxer ||
                                'RED BOXER',
                            blueBoxer:
                                blueBoxer ||
                                'BLUE BOXER',
                            weightCategory,
                            rounds:
                                totalRounds,
                            matchType,
                            redScore:
                                totalRed,
                            blueScore:
                                totalBlue,
                            winner:
                                winnerName ||
                                'DRAW',
                            result:
                                historyResult,
                            date,
                            time,
                        });

                        /*
                         * Update tournament match.
                         */
                        if (
                            tournamentId &&
                            tournamentMatchId
                        ) {
                            const tournament =
                                await getTournamentById(
                                    tournamentId,
                                );

                            if (tournament) {
                                const match =
                                    tournament.weightCategories
                                        .flatMap(
                                            (
                                                category,
                                            ) =>
                                                category.matches,
                                        )
                                        .find(
                                            (
                                                item,
                                            ) =>
                                                item.id ===
                                                tournamentMatchId,
                                        );

                                const winnerClub =
                                    winner ===
                                        'RED'
                                        ? match?.redClub ||
                                        null
                                        : winner ===
                                            'BLUE'
                                            ? match?.blueClub ||
                                            null
                                            : null;

                                const stoppage:
                                    MatchStoppage =
                                {
                                    method:
                                        stoppageMethod,
                                    winnerCorner:
                                        stoppageWinner,
                                    loserCorner:
                                        stoppageWinner ===
                                            'RED'
                                            ? 'BLUE'
                                            : stoppageWinner ===
                                                'BLUE'
                                                ? 'RED'
                                                : null,
                                    roundNumber:
                                        refereeEvents.find(
                                            isStoppageEvent,
                                        )
                                            ?.roundNumber ||
                                        null,
                                    time:
                                        refereeEvents.find(
                                            isStoppageEvent,
                                        )
                                            ?.time ||
                                        null,
                                    refereeId:
                                        refereeEvents.find(
                                            isStoppageEvent,
                                        )
                                            ?.refereeId ||
                                        null,
                                    refereeName:
                                        refereeEvents.find(
                                            isStoppageEvent,
                                        )
                                            ?.refereeName ||
                                        null,
                                    reason:
                                        refereeEvents.find(
                                            isStoppageEvent,
                                        )
                                            ?.note ||
                                        null,
                                    stoppedAt:
                                        refereeEvents.find(
                                            isStoppageEvent,
                                        )
                                            ?.createdAt ||
                                        null,
                                };

                                const approvedRoundReviews =
                                    roundReviews
                                        .filter(
                                            (
                                                item,
                                            ) =>
                                                item.status ===
                                                'APPROVED',
                                        )
                                        .reduce<
                                            TournamentRoundReview[]
                                        >(
                                            (
                                                list,
                                                item,
                                            ) => {
                                                const existing =
                                                    list.find(
                                                        (
                                                            review,
                                                        ) =>
                                                            review.roundNumber ===
                                                            item.roundNumber,
                                                    );

                                                if (
                                                    existing
                                                ) {
                                                    existing.judgeScores.push(
                                                        {
                                                            judgeId:
                                                                item.submittedJudgeId,
                                                            judgeName:
                                                                item.submittedJudgeName,
                                                            redScore:
                                                                item.redScore,
                                                            blueScore:
                                                                item.blueScore,
                                                            submittedAt:
                                                                item.submittedAt,
                                                        },
                                                    );
                                                } else {
                                                    list.push(
                                                        {
                                                            roundNumber:
                                                                item.roundNumber,
                                                            status:
                                                                'APPROVED',
                                                            submittedJudgeCount:
                                                                1,
                                                            judgeScores:
                                                                [
                                                                    {
                                                                        judgeId:
                                                                            item.submittedJudgeId,
                                                                        judgeName:
                                                                            item.submittedJudgeName,
                                                                        redScore:
                                                                            item.redScore,
                                                                        blueScore:
                                                                            item.blueScore,
                                                                        submittedAt:
                                                                            item.submittedAt,
                                                                    },
                                                                ],
                                                            roundWinner:
                                                                item.redScore >
                                                                    item.blueScore
                                                                    ? 'RED'
                                                                    : item.blueScore >
                                                                        item.redScore
                                                                        ? 'BLUE'
                                                                        : 'DRAW',
                                                            approvedBy:
                                                                ADMIN_ID,
                                                            approvedByName:
                                                                ADMIN_NAME,
                                                            approvedAt:
                                                                now,
                                                            adminNote:
                                                                null,
                                                            flagReason:
                                                                null,
                                                        },
                                                    );
                                                }

                                                return list;
                                            },
                                            [],
                                        );

                                await updateTournamentMatch(
                                    tournamentId,
                                    tournamentMatchId,
                                    {
                                        status:
                                            'COMPLETED',
                                        winner:
                                            winnerName ||
                                            'DRAW',
                                        winnerClub,
                                        scoringMatchId:
                                            match?.scoringMatchId ||
                                            matchId,
                                        roundReviews:
                                            approvedRoundReviews,
                                        refereeEvents:
                                            refereeEvents as StoredRefereeEvent[],
                                        stoppage:
                                            stoppageMethod
                                                ? stoppage
                                                : null,
                                        adminVerified:
                                            true,
                                        adminVerifiedBy:
                                            ADMIN_ID,
                                        adminVerifiedByName:
                                            ADMIN_NAME,
                                        adminVerifiedAt:
                                            now,
                                    },
                                );

                                /*
                                 * A tournament is COMPLETED only when
                                 * every weight category has completed
                                 * its final bout. Finishing one category
                                 * must not close the entire tournament.
                                 */
                                if (
                                    !match?.nextMatchId &&
                                    winner !== 'DRAW'
                                ) {
                                    const updatedTournament =
                                        await getTournamentById(
                                            tournamentId,
                                        );

                                    if (updatedTournament) {
                                        const allCategoryFinalsCompleted =
                                            updatedTournament.weightCategories.every(
                                                (category) => {
                                                    const finalMatch =
                                                        category.matches.find(
                                                            (item) =>
                                                                item.round === 'FINAL' &&
                                                                !item.nextMatchId,
                                                        ) ??
                                                        category.matches
                                                            .filter(
                                                                (item) =>
                                                                    !item.nextMatchId,
                                                            )
                                                            .sort(
                                                                (a, b) =>
                                                                    b.matchNumber -
                                                                    a.matchNumber,
                                                            )[0];

                                                    return Boolean(
                                                        finalMatch &&
                                                        finalMatch.status === 'COMPLETED' &&
                                                        finalMatch.winner,
                                                    );
                                                },
                                            );

                                        if (allCategoryFinalsCompleted) {
                                            await saveTournament({
                                                ...updatedTournament,
                                                status: 'COMPLETED',
                                            });
                                        }
                                    }
                                }

                                /*
                                 * Advance tournament bracket.
                                 */
                                if (
                                    match?.nextMatchId &&
                                    winner !== 'DRAW'
                                ) {
                                    const nextMatch =
                                        tournament.weightCategories
                                            .flatMap(
                                                (
                                                    category,
                                                ) =>
                                                    category.matches,
                                            )
                                            .find(
                                                (
                                                    item,
                                                ) =>
                                                    item.id ===
                                                    match.nextMatchId,
                                            );

                                    if (
                                        nextMatch
                                    ) {
                                        const previousWinnerCorner =
                                            match.redBoxer ===
                                                winnerName
                                                ? 'RED'
                                                : 'BLUE';

                                        const preferredNextCorner =
                                            previousWinnerCorner === 'RED'
                                                ? 'BLUE'
                                                : 'RED';

                                        const sourceText =
                                            `${match.round} Match ${match.matchNumber} — ${winnerName}`;

                                        const canUseRed =
                                            nextMatch.redBoxer === null ||
                                            nextMatch.redSourceMatchId ===
                                                match.id;

                                        const canUseBlue =
                                            nextMatch.blueBoxer === null ||
                                            nextMatch.blueSourceMatchId ===
                                                match.id;

                                        /*
                                         * Automatically change the winner's
                                         * corner in the next match.
                                         *
                                         * If the winner was RED, prefer BLUE.
                                         * If the winner was BLUE, prefer RED.
                                         *
                                         * If the preferred corner is already
                                         * occupied by the other winner, use
                                         * the remaining available corner.
                                         */
                                        if (
                                            preferredNextCorner === 'RED' &&
                                            canUseRed
                                        ) {
                                            await updateTournamentMatch(
                                                tournamentId,
                                                nextMatch.id,
                                                {
                                                    redBoxer:
                                                        winnerName,
                                                    redClub:
                                                        winnerClub,
                                                    redSourceMatchId:
                                                        match.id,
                                                    redSourceText:
                                                        sourceText,
                                                },
                                            );
                                        } else if (
                                            preferredNextCorner === 'BLUE' &&
                                            canUseBlue
                                        ) {
                                            await updateTournamentMatch(
                                                tournamentId,
                                                nextMatch.id,
                                                {
                                                    blueBoxer:
                                                        winnerName,
                                                    blueClub:
                                                        winnerClub,
                                                    blueSourceMatchId:
                                                        match.id,
                                                    blueSourceText:
                                                        sourceText,
                                                },
                                            );
                                        } else if (canUseRed) {
                                            /*
                                             * Preferred corner was unavailable,
                                             * so use RED.
                                             */
                                            await updateTournamentMatch(
                                                tournamentId,
                                                nextMatch.id,
                                                {
                                                    redBoxer:
                                                        winnerName,
                                                    redClub:
                                                        winnerClub,
                                                    redSourceMatchId:
                                                        match.id,
                                                    redSourceText:
                                                        sourceText,
                                                },
                                            );
                                        } else if (canUseBlue) {
                                            /*
                                             * Preferred corner was unavailable,
                                             * so use BLUE.
                                             */
                                            await updateTournamentMatch(
                                                tournamentId,
                                                nextMatch.id,
                                                {
                                                    blueBoxer:
                                                        winnerName,
                                                    blueClub:
                                                        winnerClub,
                                                    blueSourceMatchId:
                                                        match.id,
                                                    blueSourceText:
                                                        sourceText,
                                                },
                                            );
                                        }
                                    }
                                }
                            }
                        }

                        /*
                         * Persist the official result in PostgreSQL.
                         *
                         * The Boxer IDs are not available directly in
                         * this screen's route parameters, so fetch the
                         * database match first and use its real IDs.
                         */
                        try {
                            const databaseMatch =
                                await databaseRequest(
                                    `/matches/${matchId}`,
                                    {
                                        method: 'GET',
                                    },
                                );

                            const databaseRedId =
                                databaseMatch?.match
                                    ?.redBoxer?.id;

                            const databaseBlueId =
                                databaseMatch?.match
                                    ?.blueBoxer?.id;

                            let decision:
                                | 'POINTS'
                                | 'UNANIMOUS_DECISION'
                                | 'SPLIT_DECISION'
                                | 'MAJORITY_DECISION'
                                | 'KO'
                                | 'TKO'
                                | 'DISQUALIFICATION'
                                | 'RETIREMENT'
                                | 'DRAW'
                                | 'NO_CONTEST' =
                                'POINTS';

                            if (
                                winner ===
                                'DRAW'
                            ) {
                                decision =
                                    'DRAW';
                            } else if (
                                stoppageMethod ===
                                'KO'
                            ) {
                                decision =
                                    'KO';
                            } else if (
                                stoppageMethod ===
                                    'RSC' ||
                                stoppageMethod ===
                                    'DOCTOR_STOP' ||
                                stoppageMethod ===
                                    'STOP_CONTEST'
                            ) {
                                decision =
                                    'TKO';
                            } else if (
                                stoppageMethod ===
                                'RETIREMENT'
                            ) {
                                decision =
                                    'RETIREMENT';
                            } else {
                                decision =
                                    'POINTS';
                            }

                            await completeDatabaseMatch(
                                {
                                    matchId,
                                    winnerId:
                                        winner ===
                                        'RED'
                                            ? databaseRedId
                                            : winner ===
                                                'BLUE'
                                                ? databaseBlueId
                                                : null,
                                    loserId:
                                        winner ===
                                        'RED'
                                            ? databaseBlueId
                                            : winner ===
                                                'BLUE'
                                                ? databaseRedId
                                                : null,
                                    redTotalScore:
                                        totalRed,
                                    blueTotalScore:
                                        totalBlue,
                                    decision,
                                },
                            );

                            console.log(
                                'Database match completed:',
                                matchId,
                            );
                        } catch (databaseError) {
                            console.log(
                                'Database final result error:',
                                databaseError,
                            );

                            Alert.alert(
                                'DATABASE FINALIZATION FAILED',
                                databaseError instanceof
                                    Error
                                    ? databaseError.message
                                    : 'The official result could not be saved to PostgreSQL.',
                            );

                            return;
                        }

                        Alert.alert(
                            'OFFICIAL RESULT VERIFIED',
                            `${winnerName} is the official result.\n\nThe match is now completed and the tournament record has been updated.`,
                            [
                                {
                                    text: 'OK',
                                    onPress: () =>
                                        router.back(),
                                },
                            ],
                        );
                    } catch (error) {
                        console.log(
                            'Finalize result error:',
                            error,
                        );

                        Alert.alert(
                            'ERROR',
                            'The official result could not be finalized.',
                        );
                    } finally {
                        setIsAdminActionRunning(
                            false,
                        );
                    }
                };

            /*
             * =====================================================
             * CURRENT JUDGE STATUS
             * =====================================================
             */

            const currentJudgeReview =
                roundReviews.find(
                    (item) =>
                        item.roundNumber ===
                        round &&
                        item.submittedJudgeId ===
                        judgeId,
                );

            const totalJudgeSubmissions =
                roundReviews.filter(
                    (item) =>
                        item.roundNumber ===
                        round,
                ).length;

            const approvedCurrentRound =
                currentJudgeReview?.status ===
                'APPROVED';

            /*
             * =====================================================
             * ADMIN RENDER
             * =====================================================
             */

            if (isAdminMode) {
                return (
                    <SafeAreaView
                        style={styles.safeArea}
                    >
                        <ScrollView
                            style={
                                styles.scrollView
                            }
                            contentContainerStyle={
                                styles.scrollContent
                            }
                            showsVerticalScrollIndicator={
                                false
                            }
                        >
                            <View
                                style={
                                    styles.container
                                }
                            >
                                <View
                                    style={
                                        styles.adminHeader
                                    }
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
                                                styles.backText
                                            }
                                        >
                                            ‹
                                        </Text>
                                    </Pressable>

                                    <View
                                        style={
                                            styles.headerCenter
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.headerTitle
                                            }
                                        >
                                            ADMIN LIVE REVIEW
                                        </Text>

                                        <Text
                                            style={
                                                styles.headerSubtitle
                                            }
                                        >
                                            {matchType.toUpperCase()}{' '}
                                            •{' '}
                                            {weightCategory.toUpperCase()}
                                        </Text>
                                    </View>

                                    <View
                                        style={
                                            styles.adminBadge
                                        }
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

                                {!matchId ? (
                                    <View
                                        style={
                                            styles.emptyAdminCard
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.emptyAdminTitle
                                            }
                                        >
                                            NO LIVE MATCH SELECTED
                                        </Text>

                                        <Text
                                            style={
                                                styles.emptyAdminText
                                            }
                                        >
                                            Open a specific live
                                            match from the Admin
                                            match/tournament screen
                                            to review judge
                                            submissions here.
                                        </Text>
                                    </View>
                                ) : (
                                    <>
                                        <View
                                            style={
                                                styles.adminMatchCard
                                            }
                                        >
                                            <View
                                                style={
                                                    styles.adminBoxerRow
                                                }
                                            >
                                                <View
                                                    style={
                                                        styles.adminBoxer
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.redSmall
                                                        }
                                                    >
                                                        RED
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.adminBoxerName
                                                        }
                                                    >
                                                        {redBoxer ||
                                                            'RED BOXER'}
                                                    </Text>
                                                </View>

                                                <Text
                                                    style={
                                                        styles.adminVs
                                                    }
                                                >
                                                    VS
                                                </Text>

                                                <View
                                                    style={
                                                        styles.adminBoxer
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.blueSmall
                                                        }
                                                    >
                                                        BLUE
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.adminBoxerName
                                                        }
                                                    >
                                                        {blueBoxer ||
                                                            'BLUE BOXER'}
                                                    </Text>
                                                </View>
                                            </View>

                                            <View
                                                style={
                                                    styles.adminStatsRow
                                                }
                                            >
                                                <View
                                                    style={
                                                        styles.adminStat
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.adminStatValue
                                                        }
                                                    >
                                                        {
                                                            adminSubmittedCount
                                                        }
                                                        /
                                                        {
                                                            adminExpectedJudgeCount
                                                        }
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.adminStatLabel
                                                        }
                                                    >
                                                        JUDGES SUBMITTED
                                                    </Text>
                                                </View>

                                                <View
                                                    style={
                                                        styles.adminStat
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.adminStatValue
                                                        }
                                                    >
                                                        {
                                                            adminApprovedReviews.length
                                                        }
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.adminStatLabel
                                                        }
                                                    >
                                                        APPROVED
                                                    </Text>
                                                </View>

                                                <View
                                                    style={
                                                        styles.adminStat
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.adminStatValue
                                                        }
                                                    >
                                                        {
                                                            refereeEvents.length
                                                        }
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.adminStatLabel
                                                        }
                                                    >
                                                        REFEREE EVENTS
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>

                                        <Text
                                            style={
                                                styles.sectionTitle
                                            }
                                        >
                                            ROUND VERIFICATION
                                        </Text>

                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={
                                                false
                                            }
                                            style={
                                                styles.roundSelector
                                            }
                                        >
                                            {Array.from(
                                                {
                                                    length:
                                                        totalRounds,
                                                },
                                                (
                                                    _,
                                                    index,
                                                ) => {
                                                    const roundNumber =
                                                        index +
                                                        1;

                                                    const reviews =
                                                        roundReviews.filter(
                                                            (
                                                                item,
                                                            ) =>
                                                                item.roundNumber ===
                                                                roundNumber,
                                                        );

                                                    const approved =
                                                        reviews.length >
                                                        0 &&
                                                        reviews.every(
                                                            (
                                                                item,
                                                            ) =>
                                                                item.status ===
                                                                'APPROVED',
                                                        );

                                                    return (
                                                        <Pressable
                                                            key={
                                                                roundNumber
                                                            }
                                                            onPress={() =>
                                                                setAdminSelectedRound(
                                                                    roundNumber,
                                                                )
                                                            }
                                                            style={[
                                                                styles.roundChip,
                                                                adminSelectedRound ===
                                                                roundNumber &&
                                                                styles.roundChipActive,
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.roundChipText,
                                                                    adminSelectedRound ===
                                                                    roundNumber &&
                                                                    styles.roundChipTextActive,
                                                                ]}
                                                            >
                                                                R
                                                                {
                                                                    roundNumber
                                                                }
                                                            </Text>

                                                            <Text
                                                                style={
                                                                    styles.roundChipStatus
                                                                }
                                                            >
                                                                {approved
                                                                    ? '✓'
                                                                    : `${reviews.length}/${adminExpectedJudgeCount}`}
                                                            </Text>
                                                        </Pressable>
                                                    );
                                                },
                                            )}
                                        </ScrollView>

                                        <View
                                            style={
                                                styles.adminRoundHeader
                                            }
                                        >
                                            <View>
                                                <Text
                                                    style={
                                                        styles.adminRoundTitle
                                                    }
                                                >
                                                    ROUND{' '}
                                                    {
                                                        adminSelectedRound
                                                    }
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.adminRoundSubtitle
                                                    }
                                                >
                                                    {
                                                        adminSubmittedCount
                                                    }
                                                    /
                                                    {
                                                        adminExpectedJudgeCount
                                                    }{' '}
                                                    JUDGES SUBMITTED
                                                </Text>
                                            </View>

                                            <View
                                                style={[
                                                    styles.roundStatusBadge,
                                                    adminRoundApproved &&
                                                    styles.approvedBadge,
                                                ]}
                                            >
                                                <Text
                                                    style={
                                                        styles.roundStatusText
                                                    }
                                                >
                                                    {adminRoundApproved
                                                        ? 'APPROVED'
                                                        : adminAllJudgesSubmitted
                                                            ? 'READY'
                                                            : 'WAITING'}
                                                </Text>
                                            </View>
                                        </View>

                                        {adminRoundReviews.length ===
                                            0 ? (
                                            <View
                                                style={
                                                    styles.emptyReviewCard
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.emptyReviewTitle
                                                    }
                                                >
                                                    WAITING FOR JUDGES
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.emptyReviewText
                                                    }
                                                >
                                                    No judge has submitted
                                                    Round{' '}
                                                    {
                                                        adminSelectedRound
                                                    } yet.
                                                </Text>
                                            </View>
                                        ) : (
                                            adminRoundReviews.map(
                                                (
                                                    review,
                                                ) => {
                                                    const expanded =
                                                        adminExpandedJudge ===
                                                        review.id;

                                                    return (
                                                        <View
                                                            key={
                                                                review.id
                                                            }
                                                            style={
                                                                styles.judgeReviewCard
                                                            }
                                                        >
                                                            <Pressable
                                                                onPress={() =>
                                                                    setAdminExpandedJudge(
                                                                        expanded
                                                                            ? null
                                                                            : review.id,
                                                                    )
                                                                }
                                                                style={
                                                                    styles.judgeReviewHeader
                                                                }
                                                            >
                                                                <View
                                                                    style={
                                                                        styles.judgeReviewLeft
                                                                    }
                                                                >
                                                                    <View
                                                                        style={
                                                                            styles.judgeNumberCircle
                                                                        }
                                                                    >
                                                                        <Text
                                                                            style={
                                                                                styles.judgeNumberText
                                                                            }
                                                                        >
                                                                            J
                                                                        </Text>
                                                                    </View>

                                                                    <View>
                                                                        <Text
                                                                            style={
                                                                                styles.judgeReviewName
                                                                            }
                                                                        >
                                                                            {
                                                                                review.submittedJudgeName
                                                                            }
                                                                        </Text>

                                                                        <Text
                                                                            style={
                                                                                styles.judgeReviewMeta
                                                                            }
                                                                        >
                                                                            {
                                                                                review.submittedJudgeId
                                                                            }{' '}
                                                                            •{' '}
                                                                            {
                                                                                review.status
                                                                            }
                                                                        </Text>
                                                                    </View>
                                                                </View>

                                                                <View
                                                                    style={
                                                                        styles.judgeScorePreview
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.judgeScorePreviewText
                                                                        }
                                                                    >
                                                                        {
                                                                            review.redScore
                                                                        }
                                                                        -
                                                                        {
                                                                            review.blueScore
                                                                        }
                                                                    </Text>

                                                                    <Text
                                                                        style={
                                                                            styles.expandText
                                                                        }
                                                                    >
                                                                        {expanded
                                                                            ? '−'
                                                                            : '+'}
                                                                    </Text>
                                                                </View>
                                                            </Pressable>

                                                            {expanded && (
                                                                <View
                                                                    style={
                                                                        styles.judgeReviewBody
                                                                    }
                                                                >
                                                                    <View
                                                                        style={
                                                                            styles.largeJudgeScores
                                                                        }
                                                                    >
                                                                        <View
                                                                            style={
                                                                                styles.largeScoreSide
                                                                            }
                                                                        >
                                                                            <Text
                                                                                style={
                                                                                    styles.redSmall
                                                                                }
                                                                            >
                                                                                RED
                                                                            </Text>

                                                                            <Text
                                                                                style={
                                                                                    styles.largeScore
                                                                                }
                                                                            >
                                                                                {
                                                                                    review.redScore
                                                                                }
                                                                            </Text>
                                                                        </View>

                                                                        <Text
                                                                            style={
                                                                                styles.largeDash
                                                                            }
                                                                        >
                                                                            -
                                                                        </Text>

                                                                        <View
                                                                            style={
                                                                                styles.largeScoreSide
                                                                            }
                                                                        >
                                                                            <Text
                                                                                style={
                                                                                    styles.blueSmall
                                                                                }
                                                                            >
                                                                                BLUE
                                                                            </Text>

                                                                            <Text
                                                                                style={
                                                                                    styles.largeScore
                                                                                }
                                                                            >
                                                                                {
                                                                                    review.blueScore
                                                                                }
                                                                            </Text>
                                                                        </View>
                                                                    </View>

                                                                    {review.adminEdited && (
                                                                        <View
                                                                            style={
                                                                                styles.editedBanner
                                                                            }
                                                                        >
                                                                            <Text
                                                                                style={
                                                                                    styles.editedTitle
                                                                                }
                                                                            >
                                                                                ADMIN EDITED
                                                                            </Text>

                                                                            <Text
                                                                                style={
                                                                                    styles.editedText
                                                                                }
                                                                            >
                                                                                Reason:{' '}
                                                                                {
                                                                                    review.adminEditReason
                                                                                }
                                                                            </Text>
                                                                        </View>
                                                                    )}

                                                                    <Text
                                                                        style={
                                                                            styles.submittedAt
                                                                        }
                                                                    >
                                                                        SUBMITTED{' '}
                                                                        {
                                                                            review.submittedAt
                                                                        }
                                                                    </Text>

                                                                    <Pressable
                                                                        style={
                                                                            styles.editScoreButton
                                                                        }
                                                                        onPress={() =>
                                                                            openEditScore(
                                                                                review,
                                                                            )
                                                                        }
                                                                    >
                                                                        <Text
                                                                            style={
                                                                                styles.editScoreButtonText
                                                                            }
                                                                        >
                                                                            EDIT THIS JUDGE SCORE
                                                                        </Text>
                                                                    </Pressable>
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                },
                                            )
                                        )}

                                        <View
                                            style={
                                                styles.adminActionsCard
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.adminActionsTitle
                                                }
                                            >
                                                ADMIN ACTIONS
                                            </Text>

                                            <TextInput
                                                value={
                                                    adminNote
                                                }
                                                onChangeText={
                                                    setAdminNote
                                                }
                                                placeholder="Optional Admin note for this round"
                                                placeholderTextColor="#5F6771"
                                                style={
                                                    styles.adminNoteInput
                                                }
                                            />

                                            <Pressable
                                                style={[
                                                    styles.approveButton,
                                                    (!adminAllJudgesSubmitted ||
                                                        adminRoundApproved ||
                                                        isAdminActionRunning) &&
                                                    styles.disabledAdminButton,
                                                ]}
                                                onPress={
                                                    approveAdminRound
                                                }
                                                disabled={
                                                    !adminAllJudgesSubmitted ||
                                                    adminRoundApproved ||
                                                    isAdminActionRunning
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.approveButtonText
                                                    }
                                                >
                                                    {adminRoundApproved
                                                        ? '✓ ROUND APPROVED'
                                                        : `APPROVE ROUND ${adminSelectedRound}`}
                                                </Text>
                                            </Pressable>

                                            <Pressable
                                                style={
                                                    styles.flagButton
                                                }
                                                onPress={
                                                    flagAdminRound
                                                }
                                                disabled={
                                                    isAdminActionRunning
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.flagButtonText
                                                    }
                                                >
                                                    FLAG ROUND FOR REVIEW
                                                </Text>
                                            </Pressable>
                                        </View>

                                        <View
                                            style={styles.adminRefereeCard}
                                        >
                                            <Text style={styles.adminRefereeTitle}>
                                                OFFICIAL REFEREE CONTROLS
                                            </Text>
                                            <Text style={styles.adminRefereeSubtitle}>
                                                ADMIN ONLY • SELECT THE BOXER WHO WAS STOPPED
                                            </Text>

                                            <Text style={styles.refereeSectionLabel}>
                                                CONTEST STOPPAGE
                                            </Text>

                                            <View style={styles.refereeGrid}>
                                                {['RSC', 'KO', 'DOCTOR_STOP', 'RETIREMENT', 'STOP_CONTEST'].map((item) => (
                                                    <Pressable
                                                        key={item}
                                                        style={styles.stopButton}
                                                        onPress={() =>
                                                            openStopAction(
                                                                item as
                                                                | 'RSC'
                                                                | 'KO'
                                                                | 'DOCTOR_STOP'
                                                                | 'RETIREMENT'
                                                                | 'STOP_CONTEST',
                                                            )
                                                        }
                                                        disabled={contestStopped || isAdminActionRunning}
                                                    >
                                                        <Text style={styles.stopButtonText}>
                                                            {getEventLabel(item as RefereeEventType)}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </View>

                                            <Text style={styles.adminRefereeHint}>
                                                If BLUE is selected as stopped, RED is automatically declared the winner.
                                            </Text>
                                        </View>

                                        <View
                                            style={
                                                styles.refereeAdminCard
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.sectionTitleInside
                                                }
                                            >
                                                REFEREE EVENTS
                                            </Text>

                                            {refereeEvents.length ===
                                                0 ? (
                                                <Text
                                                    style={
                                                        styles.emptyReviewText
                                                    }
                                                >
                                                    No referee events recorded.
                                                </Text>
                                            ) : (
                                                refereeEvents
                                                    .slice()
                                                    .reverse()
                                                    .map(
                                                        (
                                                            event,
                                                        ) => (
                                                            <View
                                                                key={
                                                                    event.id
                                                                }
                                                                style={
                                                                    styles.adminEventRow
                                                                }
                                                            >
                                                                <View
                                                                    style={
                                                                        styles.eventLeft
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.eventType
                                                                        }
                                                                    >
                                                                        {getEventLabel(
                                                                            event.type,
                                                                        )}
                                                                    </Text>

                                                                    <Text
                                                                        style={
                                                                            styles.eventMeta
                                                                        }
                                                                    >
                                                                        ROUND{' '}
                                                                        {
                                                                            event.roundNumber
                                                                        }{' '}
                                                                        •{' '}
                                                                        {
                                                                            event.time
                                                                        }
                                                                    </Text>

                                                                    {event.note && (
                                                                        <Text
                                                                            style={
                                                                                styles.eventNote
                                                                            }
                                                                        >
                                                                            {
                                                                                event.note
                                                                            }
                                                                        </Text>
                                                                    )}
                                                                </View>

                                                                <View
                                                                    style={
                                                                        styles.eventRight
                                                                    }
                                                                >
                                                                    <Text
                                                                        style={
                                                                            styles.eventCorner
                                                                        }
                                                                    >
                                                                        {
                                                                            getCornerLabel(
                                                                                event.corner,
                                                                            )
                                                                        }
                                                                    </Text>

                                                                    <Text
                                                                        style={
                                                                            styles.refereeName
                                                                        }
                                                                    >
                                                                        {
                                                                            event.refereeName
                                                                        }
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        ),
                                                    )
                                            )}
                                        </View>

                                        {stoppageEvent && (
                                            <View
                                                style={
                                                    styles.stoppageAdminCard
                                                }
                                            >
                                                <Text
                                                    style={
                                                        styles.stoppageAdminTitle
                                                    }
                                                >
                                                    🛑 CONTEST STOPPAGE
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.stoppageAdminText
                                                    }
                                                >
                                                    {getEventLabel(
                                                        stoppageEvent.type,
                                                    )}{' '}
                                                    • ROUND{' '}
                                                    {
                                                        stoppageEvent.roundNumber
                                                    }{' '}
                                                    •{' '}
                                                    {
                                                        stoppageEvent.time
                                                    }
                                                </Text>

                                                <Text
                                                    style={
                                                        styles.stoppageAdminText
                                                    }
                                                >
                                                    {
                                                        stoppageEvent.note
                                                    }
                                                </Text>
                                            </View>
                                        )}

                                        {(stoppageEvent ||
                                            (adminSelectedRound ===
                                                totalRounds &&
                                                adminRoundApproved)) && (
                                                <View
                                                    style={
                                                        styles.finalizeCard
                                                    }
                                                >
                                                    <Text
                                                        style={
                                                            styles.finalizeTitle
                                                        }
                                                    >
                                                        FINAL MATCH VERIFICATION
                                                    </Text>

                                                    <Text
                                                        style={
                                                            styles.finalizeText
                                                        }
                                                    >
                                                        All final-round judge
                                                        scores are approved.
                                                        Finalize the official
                                                        tournament result.
                                                    </Text>

                                                    <Pressable
                                                        style={
                                                            styles.finalizeButton
                                                        }
                                                        onPress={
                                                            finalizeOfficialResult
                                                        }
                                                        disabled={
                                                            isAdminActionRunning
                                                        }
                                                    >
                                                        <Text
                                                            style={
                                                                styles.finalizeButtonText
                                                            }
                                                        >
                                                            FINALIZE OFFICIAL RESULT
                                                        </Text>
                                                    </Pressable>
                                                </View>
                                            )}
                                    </>
                                )}
                            </View>
                        </ScrollView>

                        <Modal
                            visible={
                                editingSubmission !==
                                null
                            }
                            transparent
                            animationType="fade"
                            onRequestClose={
                                closeEditScore
                            }
                        >
                            <View
                                style={
                                    styles.modalOverlay
                                }
                            >
                                <View
                                    style={
                                        styles.editModal
                                    }
                                >
                                    <ScrollView
                                        keyboardShouldPersistTaps="handled"
                                        showsVerticalScrollIndicator={false}
                                        contentContainerStyle={
                                            styles.editModalContent
                                        }
                                    >
                                    <Text
                                        style={
                                            styles.modalTitle
                                        }
                                    >
                                        EDIT JUDGE SCORE
                                    </Text>

                                    <Text
                                        style={
                                            styles.modalSubtitle
                                        }
                                    >
                                        {
                                            editingSubmission
                                                ?.review
                                                .submittedJudgeName
                                        }{' '}
                                        • ROUND{' '}
                                        {
                                            editingSubmission
                                                ?.review
                                                .roundNumber
                                        }
                                    </Text>

                                    <Text
                                        style={
                                            styles.inputLabel
                                        }
                                    >
                                        RED SCORE
                                    </Text>

                                    <TextInput
                                        value={
                                            editRedScore
                                        }
                                        onChangeText={
                                            setEditRedScore
                                        }
                                        keyboardType="number-pad"
                                        style={
                                            styles.scoreInput
                                        }
                                        placeholder="0-20"
                                        placeholderTextColor="#5F6771"
                                    />

                                    <Text
                                        style={
                                            styles.inputLabel
                                        }
                                    >
                                        BLUE SCORE
                                    </Text>

                                    <TextInput
                                        value={
                                            editBlueScore
                                        }
                                        onChangeText={
                                            setEditBlueScore
                                        }
                                        keyboardType="number-pad"
                                        style={
                                            styles.scoreInput
                                        }
                                        placeholder="0-20"
                                        placeholderTextColor="#5F6771"
                                    />

                                    <Text
                                        style={
                                            styles.inputLabel
                                        }
                                    >
                                        REASON *
                                    </Text>

                                    <TextInput
                                        value={
                                            editReason
                                        }
                                        onChangeText={
                                            setEditReason
                                        }
                                        multiline
                                        style={[
                                            styles.scoreInput,
                                            styles.reasonInput,
                                        ]}
                                        placeholder="Why is the score being changed?"
                                        placeholderTextColor="#5F6771"
                                    />

                                    <View
                                        style={
                                            styles.modalButtons
                                        }
                                    >
                                        <Pressable
                                            style={
                                                styles.cancelButton
                                            }
                                            onPress={
                                                closeEditScore
                                            }
                                            disabled={
                                                isSavingAdminEdit
                                            }
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
                                            style={
                                                styles.saveEditButton
                                            }
                                            onPress={
                                                saveAdminScoreEdit
                                            }
                                            disabled={
                                                isSavingAdminEdit
                                            }
                                        >
                                            <Text
                                                style={
                                                    styles.saveEditButtonText
                                                }
                                            >
                                                {isSavingAdminEdit
                                                    ? 'SAVING...'
                                                    : 'SAVE CHANGE'}
                                            </Text>
                                        </Pressable>
                                    </View>
                                    </ScrollView>
                                </View>
                            </View>
                        </Modal>
                    </SafeAreaView>
                );
            }

            /*
             * =====================================================
             * JUDGE MODE RENDER
             * =====================================================
             */

            const roundStatusText =
                contestStopped
                    ? 'CONTEST STOPPED'
                    : isWaitingForAdmin
                        ? 'YOUR SCORE SUBMITTED'
                        : approvedCurrentRound
                            ? 'ADMIN VERIFIED'
                            : 'SCORING';

            return (
                <SafeAreaView
                    style={styles.safeArea}
                >
                    <ScrollView
                        style={
                            styles.scrollView
                        }
                        contentContainerStyle={
                            styles.scrollContent
                        }
                        showsVerticalScrollIndicator={
                            false
                        }
                    >
                        <View
                            style={
                                styles.container
                            }
                        >
                            <View
                                style={
                                    styles.header
                                }
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
                                            styles.backText
                                        }
                                    >
                                        ‹
                                    </Text>
                                </Pressable>

                                <View
                                    style={
                                        styles.headerCenter
                                    }
                                >
                                    <Text
                                        style={
                                            styles.headerTitle
                                        }
                                    >
                                        LIVE SCORING
                                    </Text>

                                    <Text
                                        style={
                                            styles.headerSubtitle
                                        }
                                    >
                                        {matchType.toUpperCase()}{' '}
                                        • ROUND{' '}
                                        {round}/
                                        {totalRounds}
                                    </Text>

                                    <Text
                                        style={
                                            styles.judgeIndicator
                                        }
                                    >
                                        JUDGE •{' '}
                                        {judgeName
                                            .toUpperCase()}
                                    </Text>
                                </View>

                                <View
                                    style={[
                                        styles.liveBadge,
                                        contestStopped &&
                                        styles.stoppedBadge,
                                        isWaitingForAdmin &&
                                        styles.reviewBadge,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.liveDot,
                                            contestStopped &&
                                            styles.stoppedDot,
                                            isWaitingForAdmin &&
                                            styles.reviewDot,
                                        ]}
                                    />

                                    <Text
                                        style={
                                            styles.liveText
                                        }
                                    >
                                        {contestStopped
                                            ? 'STOPPED'
                                            : isWaitingForAdmin
                                                ? 'WAITING'
                                                : 'LIVE'}
                                    </Text>
                                </View>
                            </View>

                            <View
                                style={
                                    styles.statusBanner
                                }
                            >
                                <Text
                                    style={
                                        styles.statusBannerTitle
                                    }
                                >
                                    {
                                        roundStatusText
                                    }
                                </Text>

                                <Text
                                    style={
                                        styles.statusBannerText
                                    }
                                >
                                    {contestStopped
                                        ? `${getEventLabel(
                                            stoppageEvent?.type ||
                                            'STOP_CONTEST',
                                        )} recorded by referee.`
                                        : isWaitingForAdmin
                                            ? `Your Round ${round} score is submitted. Other judges are not locked.`
                                            : `Round ${round} is open for your scoring.`}
                                </Text>

                                <Text
                                    style={
                                        styles.submissionCount
                                    }
                                >
                                    JUDGES SUBMITTED THIS ROUND:{' '}
                                    {
                                        totalJudgeSubmissions
                                    }
                                </Text>
                            </View>

                            <View
                                style={
                                    styles.timerSection
                                }
                            >
                                <Text
                                    style={
                                        styles.roundLabel
                                    }
                                >
                                    ROUND {round}
                                </Text>

                                <Text
                                    style={
                                        styles.timer
                                    }
                                >
                                    {formatTime()}
                                </Text>

                                <Pressable
                                    style={[
                                        styles.timerButton,
                                        isRunning &&
                                        styles.timerButtonStop,
                                        (contestStopped ||
                                            isWaitingForAdmin) &&
                                        styles.disabledTimer,
                                    ]}
                                    onPress={() =>
                                        setIsRunning(
                                            (
                                                previous,
                                            ) =>
                                                !previous,
                                        )
                                    }
                                    disabled={
                                        contestStopped ||
                                        isWaitingForAdmin
                                    }
                                >
                                    <Text
                                        style={
                                            styles.timerButtonText
                                        }
                                    >
                                        {isRunning
                                            ? 'PAUSE'
                                            : 'START'}
                                    </Text>
                                </Pressable>
                            </View>

                            <View
                                style={
                                    styles.scoreboard
                                }
                            >
                                <View
                                    style={
                                        styles.boxerSection
                                    }
                                >
                                    <View
                                        style={[
                                            styles.corner,
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
                                        style={
                                            styles.boxerName
                                        }
                                    >
                                        {redBoxer ||
                                            'RED BOXER'}
                                    </Text>

                                    <Text
                                        style={
                                            styles.score
                                        }
                                    >
                                        {redScore}
                                    </Text>

                                    <Text
                                        style={
                                            styles.cornerLabel
                                        }
                                    >
                                        RED CORNER
                                    </Text>

                                    <Pressable
                                        style={[
                                            styles.scoreButton,
                                            styles.redButton,
                                            (isWaitingForAdmin ||
                                                contestStopped) &&
                                            styles.disabledScoreButton,
                                        ]}
                                        onPress={() =>
                                            addScore(
                                                'RED',
                                            )
                                        }
                                        disabled={
                                            isWaitingForAdmin ||
                                            contestStopped
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.scoreButtonText
                                            }
                                        >
                                            +1
                                        </Text>
                                    </Pressable>
                                </View>

                                <View
                                    style={
                                        styles.vsContainer
                                    }
                                >
                                    <Text
                                        style={
                                            styles.vs
                                        }
                                    >
                                        VS
                                    </Text>
                                </View>

                                <View
                                    style={
                                        styles.boxerSection
                                    }
                                >
                                    <View
                                        style={[
                                            styles.corner,
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
                                        style={
                                            styles.boxerName
                                        }
                                    >
                                        {blueBoxer ||
                                            'BLUE BOXER'}
                                    </Text>

                                    <Text
                                        style={
                                            styles.score
                                        }
                                    >
                                        {blueScore}
                                    </Text>

                                    <Text
                                        style={
                                            styles.cornerLabel
                                        }
                                    >
                                        BLUE CORNER
                                    </Text>

                                    <Pressable
                                        style={[
                                            styles.scoreButton,
                                            styles.blueButton,
                                            (isWaitingForAdmin ||
                                                contestStopped) &&
                                            styles.disabledScoreButton,
                                        ]}
                                        onPress={() =>
                                            addScore(
                                                'BLUE',
                                            )
                                        }
                                        disabled={
                                            isWaitingForAdmin ||
                                            contestStopped
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.scoreButtonText
                                            }
                                        >
                                            +1
                                        </Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View
                                style={
                                    styles.totalCard
                                }
                            >
                                <Text
                                    style={
                                        styles.totalTitle
                                    }
                                >
                                    YOUR TOTAL SCORE
                                </Text>

                                <View
                                    style={
                                        styles.totalScores
                                    }
                                >
                                    <View
                                        style={
                                            styles.totalSide
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.totalName
                                            }
                                        >
                                            RED
                                        </Text>

                                        <Text
                                            style={
                                                styles.totalScore
                                            }
                                        >
                                            {
                                                totalRedScore
                                            }
                                        </Text>
                                    </View>

                                    <Text
                                        style={
                                            styles.totalVs
                                        }
                                    >
                                        -
                                    </Text>

                                    <View
                                        style={
                                            styles.totalSide
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.totalName
                                            }
                                        >
                                            BLUE
                                        </Text>

                                        <Text
                                            style={
                                                styles.totalScore
                                            }
                                        >
                                            {
                                                totalBlueScore
                                            }
                                        </Text>
                                    </View>
                                </View>
                            </View>

                            <View
                                style={
                                    styles.controls
                                }
                            >
                                <Pressable
                                    style={[
                                        styles.controlButton,
                                        (history.length ===
                                            0 ||
                                            isWaitingForAdmin ||
                                            contestStopped) &&
                                        styles.disabledButton,
                                    ]}
                                    onPress={undo}
                                    disabled={
                                        history.length ===
                                        0 ||
                                        isWaitingForAdmin ||
                                        contestStopped
                                    }
                                >
                                    <Text
                                        style={
                                            styles.controlIcon
                                        }
                                    >
                                        ↶
                                    </Text>

                                    <Text
                                        style={
                                            styles.controlText
                                        }
                                    >
                                        UNDO
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.controlButton,
                                        (redoStack.length ===
                                            0 ||
                                            isWaitingForAdmin ||
                                            contestStopped) &&
                                        styles.disabledButton,
                                    ]}
                                    onPress={redo}
                                    disabled={
                                        redoStack.length ===
                                        0 ||
                                        isWaitingForAdmin ||
                                        contestStopped
                                    }
                                >
                                    <Text
                                        style={
                                            styles.controlIcon
                                        }
                                    >
                                        ↷
                                    </Text>

                                    <Text
                                        style={
                                            styles.controlText
                                        }
                                    >
                                        REDO
                                    </Text>
                                </Pressable>
                            </View>

                            {/* Referee and stoppage controls are Admin-only. */}

                            <View
                                style={
                                    styles.infoCard
                                }
                            >
                                <Text
                                    style={
                                        styles.infoTitle
                                    }
                                >
                                    MATCH INFORMATION
                                </Text>

                                <View
                                    style={
                                        styles.infoRow
                                    }
                                >
                                    <Text
                                        style={
                                            styles.infoLabel
                                        }
                                    >
                                        CATEGORY
                                    </Text>

                                    <Text
                                        style={
                                            styles.infoValue
                                        }
                                    >
                                        {
                                            weightCategory
                                        }
                                    </Text>
                                </View>

                                <View
                                    style={
                                        styles.infoRow
                                    }
                                >
                                    <Text
                                        style={
                                            styles.infoLabel
                                        }
                                    >
                                        ROUND
                                    </Text>

                                    <Text
                                        style={
                                            styles.infoValue
                                        }
                                    >
                                        {round} /{' '}
                                        {
                                            totalRounds
                                        }
                                    </Text>
                                </View>

                                <View
                                    style={
                                        styles.infoRow
                                    }
                                >
                                    <Text
                                        style={
                                            styles.infoLabel
                                        }
                                    >
                                        JUDGE
                                    </Text>

                                    <Text
                                        style={
                                            styles.infoValue
                                        }
                                    >
                                        {
                                            judgeName
                                        }
                                    </Text>
                                </View>

                                <View
                                    style={
                                        styles.infoRow
                                    }
                                >
                                    <Text
                                        style={
                                            styles.infoLabel
                                        }
                                    >
                                        YOUR ROUND STATUS
                                    </Text>

                                    <Text
                                        style={
                                            styles.infoValue
                                        }
                                    >
                                        {
                                            roundStatusText
                                        }
                                    </Text>
                                </View>

                                <View
                                    style={
                                        styles.infoRow
                                    }
                                >
                                    <Text
                                        style={
                                            styles.infoLabel
                                        }
                                    >
                                        JUDGES SUBMITTED
                                    </Text>

                                    <Text
                                        style={
                                            styles.infoValue
                                        }
                                    >
                                        {
                                            totalJudgeSubmissions
                                        }
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </ScrollView>
                </SafeAreaView>
            );
        }

    /*
     * =========================================================
     * STYLES
     * =========================================================
     */

    const styles = StyleSheet.create({
        safeArea: {
            flex: 1,
            backgroundColor: '#0B0D10',
        },

        scrollView: {
            flex: 1,
        },

        scrollContent: {
            paddingBottom: 35,
        },

        container: {
            flex: 1,
            paddingHorizontal: 18,
        },

        header: {
            minHeight: 65,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        adminHeader: {
            minHeight: 70,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        backButton: {
            width: 42,
            height: 42,
            borderRadius: 12,
            backgroundColor: '#171B21',
            alignItems: 'center',
            justifyContent: 'center',
        },

        backText: {
            color: '#FFFFFF',
            fontSize: 30,
            lineHeight: 30,
        },

        headerCenter: {
            flex: 1,
            alignItems: 'center',
        },

        headerTitle: {
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: '900',
            letterSpacing: 1.2,
            textAlign: 'center',
        },

        headerSubtitle: {
            color: '#707883',
            fontSize: 8,
            fontWeight: '800',
            marginTop: 4,
            textAlign: 'center',
        },

        judgeIndicator: {
            color: '#8B929B',
            fontSize: 7,
            fontWeight: '900',
            letterSpacing: 0.8,
            marginTop: 3,
        },

        liveBadge: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#291719',
            paddingHorizontal: 9,
            paddingVertical: 7,
            borderRadius: 15,
        },

        stoppedBadge: {
            backgroundColor: '#322020',
        },

        reviewBadge: {
            backgroundColor: '#302914',
        },

        liveDot: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#E53935',
            marginRight: 5,
        },

        stoppedDot: {
            backgroundColor: '#FF7043',
        },

        reviewDot: {
            backgroundColor: '#FBC02D',
        },

        liveText: {
            color: '#F45B5B',
            fontSize: 8,
            fontWeight: '900',
        },

        statusBanner: {
            backgroundColor: '#15191F',
            borderRadius: 13,
            borderWidth: 1,
            borderColor: '#292F37',
            paddingHorizontal: 14,
            paddingVertical: 11,
            marginTop: 8,
        },

        statusBannerTitle: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1,
        },

        statusBannerText: {
            color: '#737C87',
            fontSize: 8,
            fontWeight: '700',
            marginTop: 4,
            lineHeight: 13,
        },

        submissionCount: {
            color: '#8B929B',
            fontSize: 7,
            fontWeight: '900',
            marginTop: 7,
            letterSpacing: 0.5,
        },

        timerSection: {
            alignItems: 'center',
            paddingVertical: 15,
        },

        roundLabel: {
            color: '#858D97',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1.5,
        },

        timer: {
            color: '#FFFFFF',
            fontSize: 42,
            fontWeight: '900',
            marginTop: 3,
        },

        timerButton: {
            backgroundColor: '#E53935',
            paddingHorizontal: 28,
            paddingVertical: 9,
            borderRadius: 9,
            marginTop: 7,
        },

        timerButtonStop: {
            backgroundColor: '#8E2929',
        },

        disabledTimer: {
            opacity: 0.35,
        },

        timerButtonText: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1,
        },

        scoreboard: {
            backgroundColor: '#15191F',
            borderRadius: 20,
            borderWidth: 1,
            borderColor: '#292F37',
            paddingVertical: 22,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
        },

        boxerSection: {
            alignItems: 'center',
            width: '40%',
        },

        corner: {
            width: 52,
            height: 52,
            borderRadius: 26,
            alignItems: 'center',
            justifyContent: 'center',
        },

        redCorner: {
            backgroundColor: '#C62828',
        },

        blueCorner: {
            backgroundColor: '#1565C0',
        },

        cornerText: {
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: '900',
        },

        boxerName: {
            color: '#D4D8DC',
            fontSize: 12,
            fontWeight: '900',
            letterSpacing: 1,
            marginTop: 8,
            textAlign: 'center',
        },

        score: {
            color: '#FFFFFF',
            fontSize: 48,
            fontWeight: '900',
            marginTop: 2,
        },

        cornerLabel: {
            color: '#626A74',
            fontSize: 8,
            fontWeight: '800',
            letterSpacing: 1,
            marginTop: 1,
        },

        scoreButton: {
            width: 70,
            height: 42,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
        },

        redButton: {
            backgroundColor: '#E53935',
        },

        blueButton: {
            backgroundColor: '#1976D2',
        },

        disabledScoreButton: {
            opacity: 0.3,
        },

        scoreButtonText: {
            color: '#FFFFFF',
            fontSize: 18,
            fontWeight: '900',
        },

        vsContainer: {
            alignItems: 'center',
            justifyContent: 'center',
        },

        vs: {
            color: '#555D67',
            fontSize: 12,
            fontWeight: '900',
        },

        totalCard: {
            backgroundColor: '#11151A',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#252B32',
            paddingVertical: 10,
            paddingHorizontal: 18,
            marginTop: 12,
        },

        totalTitle: {
            color: '#737C87',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 1.2,
            textAlign: 'center',
        },

        totalScores: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 3,
        },

        totalSide: {
            alignItems: 'center',
            minWidth: 65,
        },

        totalName: {
            color: '#858D97',
            fontSize: 8,
            fontWeight: '900',
        },

        totalScore: {
            color: '#FFFFFF',
            fontSize: 20,
            fontWeight: '900',
            marginTop: 1,
        },

        totalVs: {
            color: '#555D67',
            fontSize: 16,
            fontWeight: '900',
            marginHorizontal: 18,
        },

        controls: {
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 12,
            marginTop: 15,
        },

        controlButton: {
            width: 105,
            height: 42,
            borderRadius: 10,
            backgroundColor: '#20252C',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
        },

        disabledButton: {
            opacity: 0.35,
        },

        controlIcon: {
            color: '#FFFFFF',
            fontSize: 20,
            marginRight: 7,
        },

        controlText: {
            color: '#D7DBDF',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.8,
        },

        refereeCard: {
            backgroundColor: '#15191F',
            borderRadius: 15,
            borderWidth: 1,
            borderColor: '#292F37',
            marginTop: 15,
            overflow: 'hidden',
        },

        refereeHeader: {
            minHeight: 60,
            paddingHorizontal: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        refereeTitle: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1,
        },

        refereeSubtitle: {
            color: '#6F7781',
            fontSize: 7,
            fontWeight: '900',
            marginTop: 4,
        },

        refereeArrow: {
            color: '#FFFFFF',
            fontSize: 24,
        },

        refereeBody: {
            borderTopWidth: 1,
            borderTopColor: '#252B32',
            padding: 14,
        },

        refereeSectionLabel: {
            color: '#6F7781',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 1,
            marginTop: 4,
            marginBottom: 9,
        },

        refereeGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },

        refereeButton: {
            width: '48%',
            minHeight: 42,
            borderRadius: 9,
            backgroundColor: '#20252C',
            borderWidth: 1,
            borderColor: '#303640',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 7,
        },

        refereeButtonText: {
            color: '#DDE1E5',
            fontSize: 8,
            fontWeight: '900',
            textAlign: 'center',
        },

        stopButton: {
            width: '48%',
            minHeight: 44,
            borderRadius: 9,
            backgroundColor: '#272124',
            borderWidth: 1,
            borderColor: '#423239',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 7,
        },

        stopButtonText: {
            color: '#FFFFFF',
            fontSize: 8,
            fontWeight: '900',
            textAlign: 'center',
        },

        eventList: {
            marginTop: 5,
        },

        eventRow: {
            minHeight: 42,
            borderTopWidth: 1,
            borderTopColor: '#242A31',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        eventLeft: {
            flex: 1,
        },

        eventType: {
            color: '#FFFFFF',
            fontSize: 8,
            fontWeight: '900',
        },

        eventMeta: {
            color: '#666F79',
            fontSize: 7,
            fontWeight: '800',
            marginTop: 3,
        },

        eventCorner: {
            color: '#AEB4BA',
            fontSize: 8,
            fontWeight: '900',
            marginLeft: 10,
        },

        nextRoundButton: {
            height: 48,
            borderRadius: 12,
            backgroundColor: '#E53935',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 15,
        },

        nextRoundText: {
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.7,
            textAlign: 'center',
        },

        waitingCard: {
            backgroundColor: '#242016',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#4A4025',
            padding: 14,
            marginTop: 15,
            alignItems: 'center',
        },

        waitingTitle: {
            color: '#FBC02D',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 1,
            textAlign: 'center',
        },

        waitingText: {
            color: '#AAA28C',
            fontSize: 8,
            fontWeight: '700',
            textAlign: 'center',
            lineHeight: 13,
            marginTop: 6,
        },

        waitingSmall: {
            color: '#7E765F',
            fontSize: 7,
            fontWeight: '700',
            textAlign: 'center',
            lineHeight: 12,
            marginTop: 5,
        },

        infoCard: {
            backgroundColor: '#15191F',
            borderRadius: 15,
            borderWidth: 1,
            borderColor: '#252B32',
            padding: 15,
            marginTop: 15,
        },

        infoTitle: {
            color: '#7D858F',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1,
            marginBottom: 10,
        },

        infoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 5,
        },

        infoLabel: {
            color: '#626A74',
            fontSize: 9,
            fontWeight: '800',
        },

        infoValue: {
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '900',
            maxWidth: '65%',
            textAlign: 'right',
        },

        /*
         * ADMIN
         */

        adminBadge: {
            backgroundColor: '#242B35',
            paddingHorizontal: 9,
            paddingVertical: 7,
            borderRadius: 10,
        },

        adminBadgeText: {
            color: '#FFFFFF',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 0.7,
        },

        emptyAdminCard: {
            backgroundColor: '#15191F',
            borderRadius: 15,
            borderWidth: 1,
            borderColor: '#292F37',
            padding: 25,
            marginTop: 15,
            alignItems: 'center',
        },

        emptyAdminTitle: {
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '900',
            letterSpacing: 1,
            textAlign: 'center',
        },

        emptyAdminText: {
            color: '#707883',
            fontSize: 9,
            lineHeight: 15,
            textAlign: 'center',
            marginTop: 10,
        },

        adminMatchCard: {
            backgroundColor: '#15191F',
            borderRadius: 17,
            borderWidth: 1,
            borderColor: '#292F37',
            padding: 16,
            marginTop: 10,
        },

        adminBoxerRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        adminBoxer: {
            flex: 1,
            alignItems: 'center',
        },

        redSmall: {
            color: '#EF5350',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 1,
        },

        blueSmall: {
            color: '#42A5F5',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 1,
        },

        adminBoxerName: {
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: '900',
            textAlign: 'center',
            marginTop: 5,
        },

        adminVs: {
            color: '#555D67',
            fontSize: 11,
            fontWeight: '900',
            marginHorizontal: 10,
        },

        adminStatsRow: {
            flexDirection: 'row',
            justifyContent: 'space-around',
            borderTopWidth: 1,
            borderTopColor: '#252B32',
            marginTop: 15,
            paddingTop: 13,
        },

        adminStat: {
            alignItems: 'center',
        },

        adminStatValue: {
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: '900',
        },

        adminStatLabel: {
            color: '#646D77',
            fontSize: 7,
            fontWeight: '900',
            marginTop: 3,
        },

        sectionTitle: {
            color: '#7D858F',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1.1,
            marginTop: 18,
            marginBottom: 9,
        },

        roundSelector: {
            marginBottom: 10,
        },

        roundChip: {
            minWidth: 68,
            height: 49,
            borderRadius: 11,
            backgroundColor: '#171B21',
            borderWidth: 1,
            borderColor: '#292F37',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 8,
        },

        roundChipActive: {
            backgroundColor: '#2C1719',
            borderColor: '#E53935',
        },

        roundChipText: {
            color: '#8A929C',
            fontSize: 9,
            fontWeight: '900',
        },

        roundChipTextActive: {
            color: '#FFFFFF',
        },

        roundChipStatus: {
            color: '#606974',
            fontSize: 7,
            fontWeight: '900',
            marginTop: 3,
        },

        adminRoundHeader: {
            backgroundColor: '#15191F',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#292F37',
            padding: 14,
            marginTop: 4,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
        },

        adminRoundTitle: {
            color: '#FFFFFF',
            fontSize: 11,
            fontWeight: '900',
        },

        adminRoundSubtitle: {
            color: '#68717B',
            fontSize: 7,
            fontWeight: '900',
            marginTop: 4,
        },

        roundStatusBadge: {
            backgroundColor: '#28271D',
            paddingHorizontal: 9,
            paddingVertical: 6,
            borderRadius: 9,
        },

        approvedBadge: {
            backgroundColor: '#173020',
        },

        roundStatusText: {
            color: '#FFFFFF',
            fontSize: 7,
            fontWeight: '900',
        },

        emptyReviewCard: {
            backgroundColor: '#15191F',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#292F37',
            padding: 20,
            marginTop: 10,
            alignItems: 'center',
        },

        emptyReviewTitle: {
            color: '#FBC02D',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 0.8,
        },

        emptyReviewText: {
            color: '#707883',
            fontSize: 8,
            marginTop: 6,
            textAlign: 'center',
        },

        judgeReviewCard: {
            backgroundColor: '#15191F',
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#292F37',
            marginTop: 10,
            overflow: 'hidden',
        },

        judgeReviewHeader: {
            minHeight: 67,
            paddingHorizontal: 13,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        judgeReviewLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            flex: 1,
        },

        judgeNumberCircle: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: '#242A31',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
        },

        judgeNumberText: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '900',
        },

        judgeReviewName: {
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '900',
        },

        judgeReviewMeta: {
            color: '#68717B',
            fontSize: 7,
            fontWeight: '800',
            marginTop: 4,
        },

        judgeScorePreview: {
            alignItems: 'center',
            flexDirection: 'row',
        },

        judgeScorePreviewText: {
            color: '#FFFFFF',
            fontSize: 17,
            fontWeight: '900',
            marginRight: 10,
        },

        expandText: {
            color: '#737C87',
            fontSize: 20,
        },

        judgeReviewBody: {
            borderTopWidth: 1,
            borderTopColor: '#252B32',
            padding: 14,
        },

        largeJudgeScores: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
        },

        largeScoreSide: {
            alignItems: 'center',
            minWidth: 90,
        },

        largeScore: {
            color: '#FFFFFF',
            fontSize: 35,
            fontWeight: '900',
            marginTop: 4,
        },

        largeDash: {
            color: '#555D67',
            fontSize: 20,
            fontWeight: '900',
            marginHorizontal: 18,
        },

        editedBanner: {
            backgroundColor: '#2B2516',
            borderRadius: 9,
            borderWidth: 1,
            borderColor: '#4A4025',
            padding: 10,
            marginTop: 12,
        },

        editedTitle: {
            color: '#FBC02D',
            fontSize: 8,
            fontWeight: '900',
        },

        editedText: {
            color: '#AAA28C',
            fontSize: 8,
            lineHeight: 13,
            marginTop: 4,
        },

        submittedAt: {
            color: '#626A74',
            fontSize: 7,
            marginTop: 10,
        },

        editScoreButton: {
            height: 42,
            borderRadius: 9,
            backgroundColor: '#252B33',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 11,
        },

        editScoreButtonText: {
            color: '#FFFFFF',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 0.5,
        },

        adminActionsCard: {
            backgroundColor: '#15191F',
            borderRadius: 15,
            borderWidth: 1,
            borderColor: '#292F37',
            padding: 14,
            marginTop: 15,
        },

        adminActionsTitle: {
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1,
            marginBottom: 10,
        },

        adminNoteInput: {
            minHeight: 42,
            backgroundColor: '#0F1216',
            borderWidth: 1,
            borderColor: '#292F37',
            borderRadius: 9,
            color: '#FFFFFF',
            paddingHorizontal: 11,
            fontSize: 9,
        },

        approveButton: {
            minHeight: 46,
            borderRadius: 10,
            backgroundColor: '#2E7D32',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 10,
        },

        disabledAdminButton: {
            opacity: 0.35,
        },

        approveButtonText: {
            color: '#FFFFFF',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 0.6,
        },

        flagButton: {
            minHeight: 42,
            borderRadius: 10,
            backgroundColor: '#30251B',
            borderWidth: 1,
            borderColor: '#4A3927',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 8,
        },

        flagButtonText: {
            color: '#FBC02D',
            fontSize: 8,
            fontWeight: '900',
        },

        adminRefereeCard: {
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            backgroundColor: '#12161B',
            borderWidth: 1,
            borderColor: '#3A2525',
        },

        adminRefereeTitle: {
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '900',
            letterSpacing: 0.8,
        },

        adminRefereeSubtitle: {
            color: '#E0A0A0',
            fontSize: 9,
            fontWeight: '700',
            marginTop: 4,
            marginBottom: 14,
            letterSpacing: 0.5,
        },

        adminRefereeHint: {
            color: '#7F8791',
            fontSize: 10,
            lineHeight: 15,
            marginTop: 12,
        },

        refereeAdminCard: {
            backgroundColor: '#15191F',
            borderRadius: 15,
            borderWidth: 1,
            borderColor: '#292F37',
            padding: 14,
            marginTop: 15,
        },

        sectionTitleInside: {
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 1,
            marginBottom: 8,
        },

        adminEventRow: {
            minHeight: 56,
            borderTopWidth: 1,
            borderTopColor: '#252B32',
            paddingVertical: 9,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },

        eventNote: {
            color: '#808995',
            fontSize: 7,
            marginTop: 4,
            lineHeight: 11,
        },

        eventRight: {
            alignItems: 'flex-end',
            marginLeft: 10,
        },

        refereeName: {
            color: '#626A74',
            fontSize: 6,
            fontWeight: '800',
            marginTop: 4,
            maxWidth: 80,
            textAlign: 'right',
        },

        stoppageAdminCard: {
            backgroundColor: '#291B1D',
            borderRadius: 13,
            borderWidth: 1,
            borderColor: '#4A292D',
            padding: 14,
            marginTop: 15,
        },

        stoppageAdminTitle: {
            color: '#FF6B6B',
            fontSize: 9,
            fontWeight: '900',
            letterSpacing: 0.8,
        },

        stoppageAdminText: {
            color: '#C9CDD2',
            fontSize: 8,
            lineHeight: 13,
            marginTop: 6,
        },

        finalizeCard: {
            backgroundColor: '#17251A',
            borderRadius: 15,
            borderWidth: 1,
            borderColor: '#2D5A35',
            padding: 15,
            marginTop: 15,
        },

        finalizeTitle: {
            color: '#81C784',
            fontSize: 10,
            fontWeight: '900',
            letterSpacing: 0.8,
        },

        finalizeText: {
            color: '#9FB5A2',
            fontSize: 8,
            lineHeight: 13,
            marginTop: 7,
        },

        finalizeButton: {
            minHeight: 46,
            borderRadius: 10,
            backgroundColor: '#2E7D32',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
        },

        finalizeButtonText: {
            color: '#FFFFFF',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 0.6,
        },

        /*
         * MODAL
         */

        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.78)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
        },

        editModal: {
            width: '100%',
            maxWidth: 420,
            maxHeight: '90%',
            backgroundColor: '#15191F',
            borderRadius: 17,
            borderWidth: 1,
            borderColor: '#343A42',
            padding: 18,
        },


        editModalContent: {
            paddingBottom: 2,
        },

        modalTitle: {
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: '900',
            letterSpacing: 0.8,
        },

        modalSubtitle: {
            color: '#707883',
            fontSize: 8,
            fontWeight: '800',
            marginTop: 5,
            marginBottom: 14,
        },

        inputLabel: {
            color: '#858D97',
            fontSize: 8,
            fontWeight: '900',
            letterSpacing: 0.8,
            marginTop: 9,
            marginBottom: 5,
        },

        scoreInput: {
            height: 43,
            backgroundColor: '#0F1216',
            borderWidth: 1,
            borderColor: '#2A3038',
            borderRadius: 9,
            color: '#FFFFFF',
            paddingHorizontal: 11,
            fontSize: 10,
            fontWeight: '800',
        },

        reasonInput: {
            height: 80,
            paddingTop: 10,
            textAlignVertical: 'top',
        },

        modalButtons: {
            flexDirection: 'row',
            gap: 9,
            marginTop: 16,
        },

        cancelButton: {
            flex: 1,
            height: 44,
            borderRadius: 9,
            backgroundColor: '#242A31',
            alignItems: 'center',
            justifyContent: 'center',
        },

        cancelButtonText: {
            color: '#B8BEC5',
            fontSize: 8,
            fontWeight: '900',
        },

        saveEditButton: {
            flex: 1,
            height: 44,
            borderRadius: 9,
            backgroundColor: '#E53935',
            alignItems: 'center',
            justifyContent: 'center',
        },

        saveEditButtonText: {
            color: '#FFFFFF',
            fontSize: 8,
            fontWeight: '900',
        },
    });