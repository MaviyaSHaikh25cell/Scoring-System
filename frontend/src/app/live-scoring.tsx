import React, { useEffect, useState } from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

type ScoreAction = 'RED' | 'BLUE';

export default function LiveScoringScreen() {
    const {
        redBoxer,
        blueBoxer,
        weightCategory,
        rounds,
        matchType,
    } = useLocalSearchParams<{
        redBoxer: string;
        blueBoxer: string;
        weightCategory: string;
        rounds: string;
        matchType: string;
    }>();

    const totalRounds = Number(rounds) || 3;
    const [redScore, setRedScore] = useState(0);
    const [blueScore, setBlueScore] = useState(0);

    const [round, setRound] = useState(1);

    const [seconds, setSeconds] = useState(180);
    const [isRunning, setIsRunning] = useState(false);

    const [history, setHistory] = useState<ScoreAction[]>([]);
    const [redoStack, setRedoStack] = useState<ScoreAction[]>([]);

    /* TIMER */
    useEffect(() => {
        if (!isRunning || seconds <= 0) {
            return;
        }

        const timer = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    setIsRunning(false);
                    return 0;
                }

                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isRunning, seconds]);

    /* FORMAT TIMER */
    const formatTime = () => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;

        return `${minutes}:${remainingSeconds
            .toString()
            .padStart(2, '0')}`;
    };

    /* ADD SCORE */
    const addScore = (side: ScoreAction) => {
        if (side === 'RED') {
            setRedScore((prev) => prev + 1);
        } else {
            setBlueScore((prev) => prev + 1);
        }

        setHistory((prev) => [...prev, side]);
        setRedoStack([]);
    };

    /* UNDO */
    const undo = () => {
        if (history.length === 0) {
            return;
        }

        const lastAction = history[history.length - 1];

        if (lastAction === 'RED') {
            setRedScore((prev) => Math.max(0, prev - 1));
        } else {
            setBlueScore((prev) => Math.max(0, prev - 1));
        }

        setHistory((prev) => prev.slice(0, -1));
        setRedoStack((prev) => [...prev, lastAction]);
    };

    /* REDO */
    const redo = () => {
        if (redoStack.length === 0) {
            return;
        }

        const action = redoStack[redoStack.length - 1];

        if (action === 'RED') {
            setRedScore((prev) => prev + 1);
        } else {
            setBlueScore((prev) => prev + 1);
        }

        setRedoStack((prev) => prev.slice(0, -1));
        setHistory((prev) => [...prev, action]);
    };

    const nextRound = () => {
  if (round < totalRounds) {
    // Move to next round
    setRound((prev) => prev + 1);

    // Reset timer
    setSeconds(180);
    setIsRunning(false);

    // Reset scores for the new round
    setRedScore(0);
    setBlueScore(0);

    // Reset undo/redo history
    setHistory([]);
    setRedoStack([]);
  }
};

   const finishMatch = () => {
  router.push({
    pathname: '/match-summary',
    params: {
      redBoxer,
      blueBoxer,
      weightCategory,
      rounds: rounds.toString(),
      matchType,
      redScore: redScore.toString(),
      blueScore: blueScore.toString(),
    },
  });
};

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>

                {/* HEADER */}
                <View style={styles.header}>
                    <Pressable
                        onPress={() => router.back()}
                        style={styles.backButton}
                    >
                        <Text style={styles.backText}>‹</Text>
                    </Pressable>

                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>
                            LIVE SCORING
                        </Text>

                        <Text style={styles.headerSubtitle}>
                            {matchType?.toUpperCase() || 'TOURNAMENT'} • ROUND {round}/{totalRounds}
                        </Text>
                    </View>

                    <View style={styles.liveBadge}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>LIVE</Text>
                    </View>
                </View>

                {/* ROUND / TIMER */}
                <View style={styles.timerSection}>
                    <Text style={styles.roundLabel}>
                        ROUND {round}
                    </Text>

                    <Text style={styles.timer}>
                        {formatTime()}
                    </Text>

                    <Pressable
                        style={[
                            styles.timerButton,
                            isRunning && styles.timerButtonStop,
                        ]}
                        onPress={() => setIsRunning((prev) => !prev)}
                    >
                        <Text style={styles.timerButtonText}>
                            {isRunning ? 'PAUSE' : 'START'}
                        </Text>
                    </Pressable>
                </View>

                {/* SCOREBOARD */}
                <View style={styles.scoreboard}>

                    {/* RED */}
                    <View style={styles.boxerSection}>
                        <View style={[styles.corner, styles.redCorner]}>
                            <Text style={styles.cornerText}>R</Text>
                        </View>

                        <Text style={styles.boxerName}>
                            {redBoxer || 'RED BOXER'}
                        </Text>

                        <Text style={styles.score}>
                            {redScore}
                        </Text>

                        <Text style={styles.cornerLabel}>
                            RED CORNER
                        </Text>

                        <Pressable
                            style={[styles.scoreButton, styles.redButton]}
                            onPress={() => addScore('RED')}
                        >
                            <Text style={styles.scoreButtonText}>
                                +1
                            </Text>
                        </Pressable>
                    </View>

                    {/* VS */}
                    <View style={styles.vsContainer}>
                        <Text style={styles.vs}>
                            VS
                        </Text>
                    </View>

                    {/* BLUE */}
                    <View style={styles.boxerSection}>
                        <View style={[styles.corner, styles.blueCorner]}>
                            <Text style={styles.cornerText}>B</Text>
                        </View>

                        <Text style={styles.boxerName}>
                            {blueBoxer || 'BLUE BOXER'}
                        </Text>

                        <Text style={styles.score}>
                            {blueScore}
                        </Text>

                        <Text style={styles.cornerLabel}>
                            BLUE CORNER
                        </Text>

                        <Pressable
                            style={[styles.scoreButton, styles.blueButton]}
                            onPress={() => addScore('BLUE')}
                        >
                            <Text style={styles.scoreButtonText}>
                                +1
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* CONTROLS */}
                <View style={styles.controls}>
                    <Pressable
                        style={[
                            styles.controlButton,
                            history.length === 0 && styles.disabledButton,
                        ]}
                        onPress={undo}
                        disabled={history.length === 0}
                    >
                        <Text style={styles.controlIcon}>↶</Text>
                        <Text style={styles.controlText}>
                            UNDO
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.controlButton,
                            redoStack.length === 0 && styles.disabledButton,
                        ]}
                        onPress={redo}
                        disabled={redoStack.length === 0}
                    >
                        <Text style={styles.controlIcon}>↷</Text>
                        <Text style={styles.controlText}>
                            REDO
                        </Text>
                    </Pressable>
                </View>

                {/* ROUND BUTTON */}
                {round < totalRounds ? (
                    <Pressable
                        style={styles.nextRoundButton}
                        onPress={nextRound}
                    >
                        <Text style={styles.nextRoundText}>
                            FINISH ROUND {round} →
                        </Text>
                    </Pressable>
                ) : (
                    <Pressable
                        style={styles.finishButton}
                        onPress={finishMatch}
                    >
                        <Text style={styles.finishText}>
                            FINISH MATCH →
                        </Text>
                    </Pressable>
                )}

                {/* MATCH INFO */}
                <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>
                        MATCH INFORMATION
                    </Text>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                            CATEGORY
                        </Text>

                        <Text style={styles.infoValue}>
                            {weightCategory || 'LIGHTWEIGHT'}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>
                            ROUND
                        </Text>

                        <Text style={styles.infoValue}>
                            {round} / {totalRounds}
                        </Text>
                    </View>
                </View>

            </View>
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
        paddingHorizontal: 18,
    },

    /* HEADER */

    header: {
        height: 65,
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
        alignItems: 'center',
    },

    headerTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 1.2,
    },

    headerSubtitle: {
        color: '#707883',
        fontSize: 8,
        fontWeight: '800',
        marginTop: 4,
    },

    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#291719',
        paddingHorizontal: 9,
        paddingVertical: 7,
        borderRadius: 15,
    },

    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E53935',
        marginRight: 5,
    },

    liveText: {
        color: '#F45B5B',
        fontSize: 8,
        fontWeight: '900',
    },

    /* TIMER */

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

    timerButtonText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },

    /* SCOREBOARD */

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

    /* CONTROLS */

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

    /* NEXT ROUND */

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
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },

    finishButton: {
        height: 48,
        borderRadius: 12,
        backgroundColor: '#43A047',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 15,
    },

    finishText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },

    /* INFO */

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
    },
});