import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import {
  getTournaments,
  updateTournament,
  deleteTournament,
  Tournament,
  TournamentMatch,
  TournamentWeightCategory,
} from '../constants/storage';

const BG = '#080808';
const CARD = '#111111';
const CARD_2 = '#161616';
const BORDER = '#292929';
const TEXT = '#FFFFFF';
const MUTED = '#8E8E93';
const RED = '#E53935';
const BLUE = '#2979FF';
const GREEN = '#32D74B';
const YELLOW = '#FFD60A';

function getStatusColor(
  status: TournamentMatch['status'],
): string {
  switch (status) {
    case 'LIVE':
      return RED;
    case 'COMPLETED':
      return GREEN;
    case 'UPCOMING':
      return BLUE;
    case 'LOCKED':
    default:
      return MUTED;
  }
}

function getStatusLabel(
  status: TournamentMatch['status'],
): string {
  switch (status) {
    case 'LIVE':
      return 'LIVE';
    case 'COMPLETED':
      return 'COMPLETED';
    case 'UPCOMING':
      return 'UPCOMING';
    case 'LOCKED':
    default:
      return 'LOCKED';
  }
}

function getRoundLabel(
  round: TournamentMatch['round'],
): string {
  switch (round) {
    case 'PRELIMINARY':
      return 'PRELIMINARY';
    case 'ROUND_OF_16':
      return 'PRE-QUARTER FINAL';
    case 'QUARTER_FINAL':
      return 'QUARTER FINAL';
    case 'SEMI_FINAL':
      return 'SEMI FINAL';
    case 'FINAL':
      return 'FINAL';
    default:
      return round;
  }
}

function getBoxerDisplay(
  boxer: string | null,
  sourceText: string | null,
): string {
  if (boxer) {
    return boxer;
  }

  if (sourceText) {
    return sourceText;
  }

  return 'TBD';
}

function getTournamentBoutCount(
  tournament: Tournament,
): number {
  return tournament.weightCategories.reduce(
    (total, category) =>
      total + category.matches.length,
    0,
  );
}

function getTournamentCompletedCount(
  tournament: Tournament,
): number {
  return tournament.weightCategories.reduce(
    (total, category) =>
      total +
      category.matches.filter(
        (match) => match.status === 'COMPLETED',
      ).length,
    0,
  );
}

function getTournamentLiveCount(
  tournament: Tournament,
): number {
  return tournament.weightCategories.reduce(
    (total, category) =>
      total +
      category.matches.filter(
        (match) => match.status === 'LIVE',
      ).length,
    0,
  );
}

function getFinalMatch(
  category: TournamentWeightCategory,
): TournamentMatch | null {
  const explicitFinal =
    category.matches.find(
      (match) =>
        match.round === 'FINAL' &&
        !match.nextMatchId,
    );

  if (explicitFinal) {
    return explicitFinal;
  }

  const terminalMatches =
    category.matches
      .filter((match) => !match.nextMatchId)
      .sort(
        (a, b) =>
          b.matchNumber - a.matchNumber,
      );

  return terminalMatches[0] ?? null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getDecisionLabel(
  match: TournamentMatch,
): string {
  const method = match.stoppage?.method;

  if (method === 'KO') return 'KO';
  if (method === 'RSC') return 'RSC / REFEREE STOPPAGE';
  if (method === 'DOCTOR_STOP') return 'DOCTOR STOPPAGE';
  if (method === 'STOP_CONTEST') return 'STOP CONTEST';
  if (method === 'RETIREMENT') return 'RETIREMENT';

  return 'POINTS';
}

function getTournamentStatusColor(
  status: Tournament['status'],
): string {
  switch (status) {
    case 'LIVE':
      return RED;
    case 'COMPLETED':
      return GREEN;
    case 'UPCOMING':
    default:
      return YELLOW;
  }
}

/*
 * --------------------------------------------------
 * OFFICIAL RESULTS HELPERS
 * --------------------------------------------------
 */

function getRunnerUp(
  finalMatch: TournamentMatch | null,
): string | null {
  if (!finalMatch?.winner) {
    return null;
  }

  if (
    finalMatch.winner ===
    finalMatch.redBoxer
  ) {
    return finalMatch.blueBoxer;
  }

  if (
    finalMatch.winner ===
    finalMatch.blueBoxer
  ) {
    return finalMatch.redBoxer;
  }

  return null;
}

function isCompletedFinal(
  category: TournamentWeightCategory,
): boolean {
  const finalMatch = getFinalMatch(category);

  return Boolean(
    finalMatch &&
      finalMatch.status === 'COMPLETED' &&
      finalMatch.winner,
  );
}

function TournamentResults({
  tournament,
}: {
  tournament: Tournament;
}) {
  const completedCategories =
    tournament.weightCategories.filter(
      (category) =>
        isCompletedFinal(category),
    );

  if (completedCategories.length === 0) {
    return null;
  }

  return (
    <View style={styles.resultsSection}>
      <View style={styles.resultsHeader}>
        <View style={styles.resultsHeaderIcon}>
          <Text style={styles.resultsHeaderIconText}>
            🏆
          </Text>
        </View>

        <View style={styles.resultsHeaderTextBlock}>
          <Text style={styles.resultsTitle}>
            OFFICIAL TOURNAMENT RESULTS
          </Text>

          <Text style={styles.resultsSubtitle}>
            {completedCategories.length}{' '}
            {completedCategories.length === 1
              ? 'CATEGORY'
              : 'CATEGORIES'}{' '}
            WITH COMPLETED FINALS
          </Text>
        </View>
      </View>

      {completedCategories.map(
        (category) => {
          const finalMatch =
            getFinalMatch(category);

          if (
            !finalMatch ||
            !finalMatch.winner
          ) {
            return null;
          }

          const runnerUp =
            getRunnerUp(finalMatch);

          const decision =
            getDecisionLabel(finalMatch);

          return (
            <View
              key={category.id}
              style={styles.resultCard}
            >
              <View
                style={
                  styles.resultCategoryHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.resultCategoryName
                    }
                  >
                    {category.name}
                  </Text>

                  <Text
                    style={
                      styles.resultCategorySubtitle
                    }
                  >
                    FINAL • BOUT{' '}
                    {finalMatch.matchNumber}
                  </Text>
                </View>

                <View
                  style={
                    styles.resultCompletedBadge
                  }
                >
                  <View
                    style={
                      styles.resultCompletedDot
                    }
                  />

                  <Text
                    style={
                      styles.resultCompletedText
                    }
                  >
                    FINAL
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.resultChampionCard
                }
              >
                <View
                  style={
                    styles.resultMedalContainer
                  }
                >
                  <Text
                    style={
                      styles.resultMedal
                    }
                  >
                    🥇
                  </Text>
                </View>

                <View
                  style={
                    styles.resultChampionInfo
                  }
                >
                  <Text
                    style={
                      styles.resultPlaceLabel
                    }
                  >
                    CHAMPION
                  </Text>

                  <Text
                    style={
                      styles.resultChampionName
                    }
                    numberOfLines={2}
                  >
                    {finalMatch.winner}
                  </Text>

                  {finalMatch.winnerClub ? (
                    <Text
                      style={
                        styles.resultClub
                      }
                      numberOfLines={1}
                    >
                      {finalMatch.winnerClub}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View
                style={
                  styles.resultRunnerUpCard
                }
              >
                <View
                  style={
                    styles.resultRunnerMedalContainer
                  }
                >
                  <Text
                    style={
                      styles.resultRunnerMedal
                    }
                  >
                    🥈
                  </Text>
                </View>

                <View
                  style={
                    styles.resultRunnerUpInfo
                  }
                >
                  <Text
                    style={
                      styles.resultPlaceLabelMuted
                    }
                  >
                    RUNNER-UP
                  </Text>

                  <Text
                    style={
                      styles.resultRunnerUpName
                    }
                    numberOfLines={2}
                  >
                    {runnerUp ?? '—'}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.resultDetailsRow
                }
              >
                <View
                  style={
                    styles.resultDetailItem
                  }
                >
                  <Text
                    style={
                      styles.resultDetailLabel
                    }
                  >
                    DECISION
                  </Text>

                  <Text
                    style={
                      styles.resultDetailValue
                    }
                    numberOfLines={2}
                  >
                    {decision}
                  </Text>
                </View>

                <View
                  style={
                    styles.resultDetailDivider
                  }
                />

                <View
                  style={
                    styles.resultDetailItem
                  }
                >
                  <Text
                    style={
                      styles.resultDetailLabel
                    }
                  >
                    FINAL BOUT
                  </Text>

                  <Text
                    style={
                      styles.resultDetailValue
                    }
                  >
                    BOUT {finalMatch.matchNumber}
                  </Text>
                </View>
              </View>
            </View>
          );
        },
      )}
    </View>
  );
}

/*
 * --------------------------------------------------
 * BRACKET HELPERS
 * --------------------------------------------------
 */

const BRACKET_ROUNDS: TournamentMatch['round'][] = [
  'PRELIMINARY',
  'ROUND_OF_16',
  'QUARTER_FINAL',
  'SEMI_FINAL',
  'FINAL',
];

function getBracketRoundTitle(
  round: TournamentMatch['round'],
): string {
  switch (round) {
    case 'PRELIMINARY':
      return 'PRELIMINARY';
    case 'ROUND_OF_16':
      return 'PRE-QUARTER FINAL';
    case 'QUARTER_FINAL':
      return 'QUARTER FINAL';
    case 'SEMI_FINAL':
      return 'SEMI FINAL';
    case 'FINAL':
      return 'FINAL';
    default:
      return round;
  }
}

function getBracketMatches(
  category: TournamentWeightCategory,
  round: TournamentMatch['round'],
): TournamentMatch[] {
  return category.matches
    .filter((match) => match.round === round)
    .sort(
      (a, b) =>
        a.matchNumber - b.matchNumber,
    );
}

function BracketBout({
  match,
}: {
  match: TournamentMatch;
}) {
  const redName = getBoxerDisplay(
    match.redBoxer,
    match.redSourceText,
  );

  const blueName = getBoxerDisplay(
    match.blueBoxer,
    match.blueSourceText,
  );

  const isRedWinner =
    Boolean(match.winner) &&
    match.winner === match.redBoxer;

  const isBlueWinner =
    Boolean(match.winner) &&
    match.winner === match.blueBoxer;

  const statusColor =
    getStatusColor(match.status);

  return (
    <View style={styles.bracketBoutWrapper}>
      <View
        style={[
          styles.bracketBout,
          {
            borderColor:
              match.status === 'COMPLETED'
                ? GREEN
                : BORDER,
          },
        ]}
      >
        <View style={styles.bracketBoutHeader}>
          <Text style={styles.bracketBoutNumber}>
            BOUT {match.matchNumber}
          </Text>

          <View
            style={[
              styles.bracketStatusDot,
              {
                backgroundColor:
                  statusColor,
              },
            ]}
          />
        </View>

        <View
          style={[
            styles.bracketBoxerRow,
            isRedWinner &&
              styles.bracketWinnerRow,
          ]}
        >
          <View
            style={[
              styles.bracketCornerLine,
              {
                backgroundColor: RED,
              },
            ]}
          />

          <Text
            style={[
              styles.bracketBoxerName,
              !match.redBoxer &&
                styles.bracketTbd,
              isRedWinner &&
                styles.bracketWinnerName,
            ]}
            numberOfLines={1}
          >
            {redName}
          </Text>

          {isRedWinner ? (
            <Text
              style={
                styles.bracketWinnerMark
              }
            >
              ✓
            </Text>
          ) : null}
        </View>

        <View style={styles.bracketVsLine}>
          <Text style={styles.bracketVsText}>
            VS
          </Text>
        </View>

        <View
          style={[
            styles.bracketBoxerRow,
            isBlueWinner &&
              styles.bracketWinnerRow,
          ]}
        >
          <View
            style={[
              styles.bracketCornerLine,
              {
                backgroundColor: BLUE,
              },
            ]}
          />

          <Text
            style={[
              styles.bracketBoxerName,
              !match.blueBoxer &&
                styles.bracketTbd,
              isBlueWinner &&
                styles.bracketWinnerName,
            ]}
            numberOfLines={1}
          >
            {blueName}
          </Text>

          {isBlueWinner ? (
            <Text
              style={
                styles.bracketWinnerMark
              }
            >
              ✓
            </Text>
          ) : null}
        </View>

        <View
          style={[
            styles.bracketStatus,
            {
              borderColor: statusColor,
            },
          ]}
        >
          <Text
            style={[
              styles.bracketStatusText,
              {
                color: statusColor,
              },
            ]}
          >
            {getStatusLabel(
              match.status,
            )}
          </Text>
        </View>
      </View>

      {match.nextMatchId ? (
        <View
          style={styles.bracketConnector}
        >
          <View
            style={styles.bracketConnectorLine}
          />
        </View>
      ) : null}
    </View>
  );
}

function BracketRoundColumn({
  category,
  round,
}: {
  category: TournamentWeightCategory;
  round: TournamentMatch['round'];
}) {
  const matches = getBracketMatches(
    category,
    round,
  );

  if (matches.length === 0) {
    return null;
  }

  return (
    <View style={styles.bracketColumn}>
      <View style={styles.bracketColumnHeader}>
        <Text
          style={styles.bracketColumnTitle}
        >
          {getBracketRoundTitle(round)}
        </Text>

        <Text
          style={styles.bracketColumnCount}
        >
          {matches.length}{' '}
          {matches.length === 1
            ? 'BOUT'
            : 'BOUTS'}
        </Text>
      </View>

      <View
        style={[
          styles.bracketMatchesContainer,
          round === 'ROUND_OF_16' &&
            styles.bracketR16Spacing,
          round === 'QUARTER_FINAL' &&
            styles.bracketQuarterSpacing,
          round === 'SEMI_FINAL' &&
            styles.bracketSemiSpacing,
          round === 'FINAL' &&
            styles.bracketFinalSpacing,
        ]}
      >
        {matches.map((match) => (
          <BracketBout
            key={match.id}
            match={match}
          />
        ))}
      </View>
    </View>
  );
}

function TournamentBracket({
  category,
}: {
  category: TournamentWeightCategory;
}) {
  const hasMatches =
    category.matches.length > 0;

  if (!hasMatches) {
    return null;
  }

  return (
    <View style={styles.bracketSection}>
      <View style={styles.bracketSectionHeader}>
        <View>
          <Text
            style={styles.bracketSectionTitle}
          >
            TOURNAMENT BRACKET
          </Text>

          <Text
            style={styles.bracketSectionSubtitle}
          >
            {category.name} • LIVE BRACKET
          </Text>
        </View>

        <View style={styles.bracketLegend}>
          <View
            style={styles.legendItem}
          >
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    GREEN,
                },
              ]}
            />

            <Text style={styles.legendText}>
              DONE
            </Text>
          </View>

          <View
            style={styles.legendItem}
          >
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    BLUE,
                },
              ]}
            />

            <Text style={styles.legendText}>
              READY
            </Text>
          </View>

          <View
            style={styles.legendItem}
          >
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor:
                    MUTED,
                },
              ]}
            />

            <Text style={styles.legendText}>
              LOCKED
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        contentContainerStyle={
          styles.bracketScrollContent
        }
      >
        <View style={styles.bracketBoard}>
          {BRACKET_ROUNDS.map(
            (round) => (
              <BracketRoundColumn
                key={round}
                category={category}
                round={round}
              />
            ),
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function BoxerRow({
  label,
  boxer,
  club,
  sourceText,
  isRed,
}: {
  label: string;
  boxer: string | null;
  club: string | null;
  sourceText: string | null;
  isRed: boolean;
}) {
  const displayName = getBoxerDisplay(
    boxer,
    sourceText,
  );

  return (
    <View style={styles.boxerRow}>
      <View
        style={[
          styles.cornerIndicator,
          {
            backgroundColor: isRed
              ? RED
              : BLUE,
          },
        ]}
      />

      <View style={styles.boxerInfo}>
        <Text style={styles.cornerLabel}>
          {label}
        </Text>

        <Text
          style={[
            styles.boxerName,
            !boxer && styles.tbdText,
          ]}
          numberOfLines={2}
        >
          {displayName}
        </Text>

        {club ? (
          <Text
            style={styles.clubText}
            numberOfLines={1}
          >
            {club}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MatchCard({
  match,
  onStartMatch,
}: {
  match: TournamentMatch;
  onStartMatch: (
    match: TournamentMatch,
  ) => void;
}) {
  const canStart =
    match.status === 'UPCOMING' &&
    Boolean(match.redBoxer) &&
    Boolean(match.blueBoxer) &&
    !match.scoringMatchId;

  return (
    <View style={styles.matchCard}>
      <View style={styles.matchHeader}>
        <View>
          <Text style={styles.boutNumber}>
            BOUT {match.matchNumber}
          </Text>

          <Text style={styles.roundText}>
            {getRoundLabel(match.round)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              borderColor:
                getStatusColor(
                  match.status,
                ),
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  getStatusColor(
                    match.status,
                  ),
              },
            ]}
          />

          <Text
            style={[
              styles.statusText,
              {
                color: getStatusColor(
                  match.status,
                ),
              },
            ]}
          >
            {getStatusLabel(
              match.status,
            )}
          </Text>
        </View>
      </View>

      <View style={styles.boxersContainer}>
        <BoxerRow
          label="RED CORNER"
          boxer={match.redBoxer}
          club={match.redClub}
          sourceText={match.redSourceText}
          isRed
        />

        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>
            VS
          </Text>
        </View>

        <BoxerRow
          label="BLUE CORNER"
          boxer={match.blueBoxer}
          club={match.blueClub}
          sourceText={match.blueSourceText}
          isRed={false}
        />
      </View>

      {match.winner ? (
        <View style={styles.winnerContainer}>
          <Text style={styles.winnerLabel}>
            WINNER
          </Text>

          <Text style={styles.winnerName}>
            {match.winner}
          </Text>

          {match.winnerClub ? (
            <Text style={styles.winnerClub}>
              {match.winnerClub}
            </Text>
          ) : null}
        </View>
      ) : null}

      {canStart ? (
        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            pressed &&
              styles.buttonPressed,
          ]}
          onPress={() =>
            onStartMatch(match)
          }
        >
          <Text style={styles.startButtonText}>
            START MATCH
          </Text>
        </Pressable>
      ) : null}

      {match.status === 'LOCKED' ? (
        <View style={styles.lockedInfo}>
          <Text style={styles.lockedText}>
            Waiting for previous bout winner
          </Text>
        </View>
      ) : null}

      {match.status === 'COMPLETED' ? (
        <View style={styles.completedInfo}>
          <Text style={styles.completedText}>
            MATCH COMPLETED
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function CategorySection({
  category,
  onStartMatch,
}: {
  category: TournamentWeightCategory;
  onStartMatch: (
    match: TournamentMatch,
  ) => void;
}) {
  const completedCount =
    category.matches.filter(
      (match) =>
        match.status === 'COMPLETED',
    ).length;

  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <View
          style={styles.categoryTitleContainer}
        >
          <Text style={styles.categoryName}>
            {category.name}
          </Text>

          <Text style={styles.categorySubtitle}>
            {category.matches.length} BOUT
            {category.matches.length === 1
              ? ''
              : 'S'} • {completedCount}{' '}
            COMPLETED
          </Text>
        </View>
      </View>

      <TournamentBracket
        category={category}
      />

      {category.matches.length === 0 ? (
        <View style={styles.emptyCategory}>
          <Text
            style={styles.emptyCategoryText}
          >
            No bouts in this category
          </Text>
        </View>
      ) : (
        category.matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onStartMatch={
              onStartMatch
            }
          />
        ))
      )}
    </View>
  );
}

function TournamentFolder({
  tournament,
  onPress,
}: {
  tournament: Tournament;
  onPress: () => void;
}) {
  const totalBouts =
    getTournamentBoutCount(
      tournament,
    );

  const completedBouts =
    getTournamentCompletedCount(
      tournament,
    );

  const liveBouts =
    getTournamentLiveCount(
      tournament,
    );

  const statusColor =
    getTournamentStatusColor(
      tournament.status,
    );

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.folderCard,
        pressed &&
          styles.folderPressed,
      ]}
    >
      <View style={styles.folderTopRow}>
        <View
          style={
            styles.folderIconContainer
          }
        >
          <Text style={styles.folderIcon}>
            📁
          </Text>
        </View>

        <View
          style={styles.folderTitleContainer}
        >
          <Text
            style={styles.folderName}
            numberOfLines={2}
          >
            {tournament.name}
          </Text>

          <Text style={styles.folderDate}>
            {tournament.date ||
              'DATE NOT AVAILABLE'}
          </Text>
        </View>

        <Text style={styles.folderArrow}>
          ›
        </Text>
      </View>

      <View style={styles.folderDivider} />

      <View style={styles.folderInfoRow}>
        <View style={styles.folderInfoItem}>
          <Text
            style={styles.folderInfoValue}
          >
            {tournament.boxerCount}
          </Text>

          <Text style={styles.folderInfoLabel}>
            BOXERS
          </Text>
        </View>

        <View style={styles.folderInfoItem}>
          <Text
            style={styles.folderInfoValue}
          >
            {totalBouts}
          </Text>

          <Text style={styles.folderInfoLabel}>
            BOUTS
          </Text>
        </View>

        <View style={styles.folderInfoItem}>
          <Text
            style={styles.folderInfoValue}
          >
            {
              tournament
                .weightCategories.length
            }
          </Text>

          <Text style={styles.folderInfoLabel}>
            CATEGORIES
          </Text>
        </View>

        <View style={styles.folderInfoItem}>
          <Text
            style={[
              styles.folderInfoValue,
              {
                color: statusColor,
              },
            ]}
          >
            {liveBouts > 0
              ? liveBouts
              : completedBouts}
          </Text>

          <Text style={styles.folderInfoLabel}>
            {liveBouts > 0
              ? 'LIVE'
              : 'DONE'}
          </Text>
        </View>
      </View>

      <View style={styles.folderBottomRow}>
        <Text
          style={styles.folderOrganization}
        >
          {tournament.organization ||
            'BOXING TOURNAMENT'}
        </Text>

        <View
          style={[
            styles.folderStatus,
            {
              borderColor: statusColor,
            },
          ]}
        >
          <View
            style={[
              styles.folderStatusDot,
              {
                backgroundColor:
                  statusColor,
              },
            ]}
          />

          <Text
            style={[
              styles.folderStatusText,
              {
                color: statusColor,
              },
            ]}
          >
            {tournament.status}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function TournamentManagement() {
  const router = useRouter();

  const [
    tournaments,
    setTournaments,
  ] = useState<Tournament[]>([]);

  const [
    selectedTournamentId,
    setSelectedTournamentId,
  ] = useState<string | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isEditModalVisible,
    setIsEditModalVisible,
  ] = useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [editName, setEditName] =
    useState('');

  const [
    editOrganization,
    setEditOrganization,
  ] = useState('');

  const [editDate, setEditDate] =
    useState('');

  const [
    editStatus,
    setEditStatus,
  ] =
    useState<Tournament['status']>(
      'UPCOMING',
    );

  const loadTournaments =
    useCallback(async () => {
      try {
        setIsLoading(true);

        const data =
          await getTournaments();

        setTournaments(data);
      } catch (error) {
        console.log(
          'Error loading tournaments:',
          error,
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useFocusEffect(
    useCallback(() => {
      loadTournaments();
    }, [loadTournaments]),
  );

  const selectedTournament =
    tournaments.find(
      (tournament) =>
        tournament.id ===
        selectedTournamentId,
    ) ?? null;

  const totalBouts =
    selectedTournament
      ? getTournamentBoutCount(
          selectedTournament,
        )
      : 0;

  const completedBouts =
    selectedTournament
      ? getTournamentCompletedCount(
          selectedTournament,
        )
      : 0;

  const liveBouts =
    selectedTournament
      ? getTournamentLiveCount(
          selectedTournament,
        )
      : 0;

  const openEditModal = () => {
    if (!selectedTournament) {
      return;
    }

    setEditName(
      selectedTournament.name,
    );

    setEditOrganization(
      selectedTournament.organization,
    );

    setEditDate(
      selectedTournament.date,
    );

    setEditStatus(
      selectedTournament.status,
    );

    setIsEditModalVisible(true);
  };

  const closeEditModal = () => {
    if (isSaving || isDeleting) {
      return;
    }

    setIsEditModalVisible(false);
  };

  const handleSaveTournament =
    async () => {
      if (!selectedTournament) {
        return;
      }

      const trimmedName =
        editName.trim();

      const trimmedOrganization =
        editOrganization.trim();

      const trimmedDate =
        editDate.trim();

      if (!trimmedName) {
        Alert.alert(
          'Invalid Tournament',
          'Tournament name is required.',
        );
        return;
      }

      if (!trimmedOrganization) {
        Alert.alert(
          'Invalid Tournament',
          'Organization is required.',
        );
        return;
      }

      if (!trimmedDate) {
        Alert.alert(
          'Invalid Tournament',
          'Date is required.',
        );
        return;
      }

      const updatedTournament:
        Tournament = {
          ...selectedTournament,
          name: trimmedName,
          organization:
            trimmedOrganization,
          date: trimmedDate,
          status: editStatus,
        };

      try {
        setIsSaving(true);

        await updateTournament(
          updatedTournament,
        );

        const refreshedTournaments =
          await getTournaments();

        setTournaments(
          refreshedTournaments,
        );

        setIsEditModalVisible(false);

        Alert.alert(
          'Tournament Updated',
          'Tournament details have been saved successfully.',
        );
      } catch (error) {
        console.log(
          'Error updating tournament:',
          error,
        );

        Alert.alert(
          'Update Failed',
          'Unable to update tournament. Please check that the backend is running and try again.',
        );
      } finally {
        setIsSaving(false);
      }
    };

  const handlePrintTournamentResults =
    async () => {
      if (!selectedTournament) {
        return;
      }

      if (selectedTournament.status !== 'COMPLETED') {
        Alert.alert(
          'TOURNAMENT NOT FINISHED',
          'The final results can be printed only after every weight category has completed its final bout.',
        );
        return;
      }

      const results =
        selectedTournament.weightCategories.map(
          (category) => {
            const finalMatch = getFinalMatch(category);

            return {
              category: category.name,
              winner: finalMatch?.winner ?? 'NO WINNER',
              runnerUp:
                finalMatch?.winner === finalMatch?.redBoxer
                  ? finalMatch?.blueBoxer ?? '—'
                  : finalMatch?.winner === finalMatch?.blueBoxer
                    ? finalMatch?.redBoxer ?? '—'
                    : '—',
              decision: finalMatch
                ? getDecisionLabel(finalMatch)
                : '—',
              bout: finalMatch
                ? `BOUT ${finalMatch.matchNumber}`
                : '—',
            };
          },
        );

      const incomplete = results.filter(
        (item) =>
          item.winner === 'NO WINNER',
      );

      if (incomplete.length > 0) {
        Alert.alert(
          'RESULTS INCOMPLETE',
          `These weight categories do not have a completed final yet:\n\n${incomplete
            .map((item) => item.category)
            .join('\n')}`,
        );
        return;
      }

      const rows = results
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td><strong>${escapeHtml(item.category)}</strong></td>
              <td class="winner">${escapeHtml(item.winner)}</td>
              <td>${escapeHtml(item.runnerUp)}</td>
              <td>${escapeHtml(item.decision)}</td>
              <td>${escapeHtml(item.bout)}</td>
            </tr>`,
        )
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              body {
                font-family: Arial, sans-serif;
                color: #111;
                padding: 32px;
              }
              h1 {
                margin: 0 0 6px;
                font-size: 26px;
              }
              h2 {
                margin: 0 0 22px;
                color: #555;
                font-size: 15px;
                font-weight: normal;
              }
              .meta {
                margin-bottom: 24px;
                line-height: 1.6;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 12px;
              }
              th, td {
                border: 1px solid #ccc;
                padding: 10px 8px;
                text-align: left;
                font-size: 12px;
              }
              th {
                background: #111;
                color: #fff;
              }
              .winner {
                font-weight: bold;
              }
              .footer {
                margin-top: 28px;
                font-size: 10px;
                color: #777;
              }
            </style>
          </head>
          <body>
            <h1>${escapeHtml(selectedTournament.name)}</h1>
            <h2>OFFICIAL TOURNAMENT FINAL RESULTS</h2>
            <div class="meta">
              <strong>Organization:</strong> ${escapeHtml(selectedTournament.organization || '—')}<br />
              <strong>Date:</strong> ${escapeHtml(selectedTournament.date || '—')}<br />
              <strong>Categories:</strong> ${results.length}
            </div>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>WEIGHT CATEGORY</th>
                  <th>WINNER</th>
                  <th>RUNNER-UP</th>
                  <th>DECISION</th>
                  <th>FINAL BOUT</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
            <div class="footer">
              Official result generated by Boxing Scoring System.
            </div>
          </body>
        </html>
      `;

      try {
        await Print.printAsync({ html });
      } catch (error) {
        console.log(
          'Error printing tournament results:',
          error,
        );

        Alert.alert(
          'PRINT FAILED',
          'The tournament result could not be sent to the printer.',
        );
      }
    };

  const handleDeleteTournament =
    () => {
      if (
        !selectedTournament ||
        isDeleting
      ) {
        return;
      }

      Alert.alert(
        'Delete Tournament',
        `Are you sure you want to delete "${selectedTournament.name}"?\n\nThis action cannot be undone.`,
        [
          {
            text: 'CANCEL',
            style: 'cancel',
          },
          {
            text: 'DELETE',
            style: 'destructive',
            onPress:
              async () => {
                try {
                  setIsDeleting(true);

                  await deleteTournament(
                    selectedTournament.id,
                  );

                  const refreshedTournaments =
                    await getTournaments();

                  setTournaments(
                    refreshedTournaments,
                  );

                  setSelectedTournamentId(
                    null,
                  );

                  Alert.alert(
                    'Tournament Deleted',
                    'The tournament has been deleted successfully.',
                  );
                } catch (error) {
                  console.log(
                    'Error deleting tournament:',
                    error,
                  );

                  Alert.alert(
                    'Delete Failed',
                    'Unable to delete the tournament. Please check that the backend is running and try again.',
                  );
                } finally {
                  setIsDeleting(false);
                }
              },
          },
        ],
      );
    };

  const handleStartMatch = (
    match: TournamentMatch,
  ) => {
    if (!selectedTournament) {
      return;
    }

    if (
      !match.redBoxer ||
      !match.blueBoxer
    ) {
      return;
    }

    router.push({
      pathname: '/create-match',
      params: {
        tournamentId:
          selectedTournament.id,
        tournamentMatchId:
          match.id,
        redBoxer:
          match.redBoxer,
        blueBoxer:
          match.blueBoxer,
        weightCategory:
          match.weightCategory,
        rounds:
          match.rounds.toString(),
        matchType:
          match.matchType,
      },
    });
  };

  const openTournament = (
    tournamentId: string,
  ) => {
    setSelectedTournamentId(
      tournamentId,
    );
  };

  const closeTournamentDetails =
    () => {
      setSelectedTournamentId(null);
    };

  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color={TEXT}
          />

          <Text
            style={styles.loadingText}
          >
            Loading tournaments...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * --------------------------------------------------
   * TOURNAMENT FOLDER VIEW
   * --------------------------------------------------
   */

  if (!selectedTournament) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() =>
                router.back()
              }
              style={({ pressed }) => [
                styles.backButton,
                pressed &&
                  styles.buttonPressed,
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
                styles.titleContainer
              }
            >
              <Text
                style={styles.pageTitle}
              >
                TOURNAMENTS
              </Text>

              <Text
                style={
                  styles.pageSubtitle
                }
              >
                TOURNAMENT MANAGEMENT
              </Text>
            </View>
          </View>

          {tournaments.length ===
          0 ? (
            <View
              style={
                styles.emptyContainer
              }
            >
              <View
                style={styles.emptyIcon}
              >
                <Text
                  style={
                    styles.emptyIconText
                  }
                >
                  📁
                </Text>
              </View>

              <Text
                style={styles.emptyTitle}
              >
                NO TOURNAMENTS
              </Text>

              <Text
                style={
                  styles.emptyDescription
                }
              >
                No tournaments have been
                created yet. Import a boxer
                list PDF from Boxer Management
                to create your first tournament.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.manageBoxersButton,
                  pressed &&
                    styles.buttonPressed,
                ]}
                onPress={() =>
                  router.push(
                    '/boxer-management',
                  )
                }
              >
                <Text
                  style={
                    styles.manageBoxersText
                  }
                >
                  GO TO BOXER MANAGEMENT
                </Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.folderScrollContent
              }
            >
              <View
                style={styles.folderHeader}
              >
                <Text
                  style={
                    styles.folderHeaderTitle
                  }
                >
                  TOURNAMENT FOLDERS
                </Text>

                <Text
                  style={
                    styles.folderHeaderSubtitle
                  }
                >
                  {tournaments.length}{' '}
                  TOURNAMENT
                  {tournaments.length ===
                  1
                    ? ''
                    : 'S'} AVAILABLE
                </Text>
              </View>

              {tournaments.map(
                (tournament) => (
                  <TournamentFolder
                    key={
                      tournament.id
                    }
                    tournament={
                      tournament
                    }
                    onPress={() =>
                      openTournament(
                        tournament.id,
                      )
                    }
                  />
                ),
              )}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    );
  }

  /*
   * --------------------------------------------------
   * TOURNAMENT DETAILS VIEW
   * --------------------------------------------------
   */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable
            onPress={
              closeTournamentDetails
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed &&
                styles.buttonPressed,
            ]}
          >
            <Text
              style={styles.backText}
            >
              ‹
            </Text>
          </Pressable>

          <View
            style={styles.titleContainer}
          >
            <Text
              style={styles.pageTitle}
            >
              TOURNAMENT DETAILS
            </Text>

            <Text
              style={styles.pageSubtitle}
            >
              {selectedTournament.name}
            </Text>
          </View>

          <Pressable
            onPress={openEditModal}
            style={({ pressed }) => [
              styles.editHeaderButton,
              pressed &&
                styles.buttonPressed,
            ]}
          >
            <Text
              style={
                styles.editHeaderButtonText
              }
            >
              EDIT
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <View
            style={
              styles.tournamentHeader
            }
          >
            <View
              style={styles.headerTopRow}
            >
              <View
                style={
                  styles.headerTitleBlock
                }
              >
                <View
                  style={
                    styles.detailFolderRow
                  }
                >
                  <Text
                    style={
                      styles.detailFolderIcon
                    }
                  >
                    📁
                  </Text>

                  <Text
                    style={
                      styles.tournamentName
                    }
                  >
                    {selectedTournament.name}
                  </Text>
                </View>

                {selectedTournament.organization ? (
                  <Text
                    style={
                      styles.organizationText
                    }
                  >
                    {
                      selectedTournament.organization
                    }
                  </Text>
                ) : null}

                {selectedTournament.date ? (
                  <Text
                    style={
                      styles.dateText
                    }
                  >
                    {
                      selectedTournament.date
                    }
                  </Text>
                ) : null}
              </View>

              <View
                style={
                  styles.statusBadgeLarge
                }
              >
                <Text
                  style={[
                    styles.statusBadgeLargeText,
                    {
                      color:
                        getTournamentStatusColor(
                          selectedTournament.status,
                        ),
                    },
                  ]}
                >
                  {
                    selectedTournament.status
                  }
                </Text>
              </View>
            </View>

            {selectedTournament.pdfFileName ? (
              <View
                style={styles.pdfInfo}
              >
                <Text
                  style={styles.pdfLabel}
                >
                  SOURCE PDF
                </Text>

                <Text
                  style={styles.pdfName}
                  numberOfLines={1}
                >
                  {
                    selectedTournament.pdfFileName
                  }
                </Text>
              </View>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editTournamentButton,
              pressed &&
                styles.buttonPressed,
            ]}
            onPress={openEditModal}
          >
            <Text
              style={
                styles.editTournamentButtonText
              }
            >
              ✏️  EDIT TOURNAMENT
            </Text>
          </Pressable>

          {selectedTournament.status === 'COMPLETED' ? (
            <Pressable
              style={({ pressed }) => [
                styles.printResultsButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() =>
                void handlePrintTournamentResults()
              }
            >
              <Text
                style={styles.printResultsButtonText}
              >
                🖨️  PRINT FINAL TOURNAMENT RESULTS
              </Text>
            </Pressable>
          ) : null}

          {selectedTournament.status === 'COMPLETED' ? (
            <TournamentResults
              tournament={selectedTournament}
            />
          ) : null}

          <Pressable
            disabled={isDeleting}
            style={({ pressed }) => [
              styles.deleteTournamentButton,
              pressed &&
                styles.buttonPressed,
              isDeleting &&
                styles.disabledButton,
            ]}
            onPress={
              handleDeleteTournament
            }
          >
            {isDeleting ? (
              <ActivityIndicator
                size="small"
                color={RED}
              />
            ) : (
              <Text
                style={
                  styles.deleteTournamentButtonText
                }
              >
                🗑️  DELETE TOURNAMENT
              </Text>
            )}
          </Pressable>

          <View style={styles.statsRow}>
            <View
              style={styles.statCard}
            >
              <Text
                style={styles.statValue}
              >
                {
                  selectedTournament.boxerCount
                }
              </Text>

              <Text
                style={styles.statLabel}
              >
                BOXERS
              </Text>
            </View>

            <View
              style={styles.statCard}
            >
              <Text
                style={styles.statValue}
              >
                {totalBouts}
              </Text>

              <Text
                style={styles.statLabel}
              >
                BOUTS
              </Text>
            </View>

            <View
              style={styles.statCard}
            >
              <Text
                style={styles.statValue}
              >
                {completedBouts}
              </Text>

              <Text
                style={styles.statLabel}
              >
                DONE
              </Text>
            </View>

            <View
              style={styles.statCard}
            >
              <Text
                style={[
                  styles.statValue,
                  liveBouts > 0 && {
                    color: RED,
                  },
                ]}
              >
                {liveBouts}
              </Text>

              <Text
                style={styles.statLabel}
              >
                LIVE
              </Text>
            </View>
          </View>

          <View
            style={styles.sectionHeader}
          >
            <Text
              style={styles.sectionTitle}
            >
              TOURNAMENT BOUTS
            </Text>

            <Text
              style={styles.sectionSubtitle}
            >
              {
                selectedTournament
                  .weightCategories.length
              }{' '}
              CATEGORIES • {totalBouts}{' '}
              BOUTS
            </Text>
          </View>

          {selectedTournament.weightCategories.map(
            (category) => (
              <CategorySection
                key={category.id}
                category={category}
                onStartMatch={
                  handleStartMatch
                }
              />
            ),
          )}
        </ScrollView>

        <Modal
          visible={
            isEditModalVisible
          }
          transparent
          animationType="slide"
          onRequestClose={
            closeEditModal
          }
        >
          <View
            style={
              styles.modalOverlay
            }
          >
            <View
              style={styles.editModal}
            >
              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={
                    styles.modalTitleContainer
                  }
                >
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    EDIT TOURNAMENT
                  </Text>

                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    Update tournament details
                  </Text>
                </View>

                <Pressable
                  onPress={
                    closeEditModal
                  }
                  disabled={
                    isSaving ||
                    isDeleting
                  }
                  style={({ pressed }) => [
                    styles.modalCloseButton,
                    pressed &&
                      styles.buttonPressed,
                  ]}
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
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={
                  styles.modalScrollContent
                }
              >
                <Text
                  style={
                    styles.inputLabel
                  }
                >
                  TOURNAMENT NAME
                </Text>

                <TextInput
                  value={editName}
                  onChangeText={
                    setEditName
                  }
                  placeholder="Enter tournament name"
                  placeholderTextColor="#555555"
                  style={
                    styles.textInput
                  }
                  editable={
                    !isSaving &&
                    !isDeleting
                  }
                  autoCapitalize="words"
                />

                <Text
                  style={
                    styles.inputLabel
                  }
                >
                  ORGANIZATION
                </Text>

                <TextInput
                  value={
                    editOrganization
                  }
                  onChangeText={
                    setEditOrganization
                  }
                  placeholder="Enter organization"
                  placeholderTextColor="#555555"
                  style={
                    styles.textInput
                  }
                  editable={
                    !isSaving &&
                    !isDeleting
                  }
                  autoCapitalize="words"
                />

                <Text
                  style={
                    styles.inputLabel
                  }
                >
                  DATE
                </Text>

                <TextInput
                  value={editDate}
                  onChangeText={
                    setEditDate
                  }
                  placeholder="Enter tournament date"
                  placeholderTextColor="#555555"
                  style={
                    styles.textInput
                  }
                  editable={
                    !isSaving &&
                    !isDeleting
                  }
                  autoCapitalize="none"
                />

                <Text
                  style={
                    styles.inputLabel
                  }
                >
                  STATUS
                </Text>

                <View
                  style={
                    styles.statusOptions
                  }
                >
                  <Pressable
                    disabled={
                      isSaving ||
                      isDeleting
                    }
                    onPress={() =>
                      setEditStatus(
                        'UPCOMING',
                      )
                    }
                    style={[
                      styles.statusOption,
                      editStatus ===
                        'UPCOMING' &&
                        styles.statusOptionUpcoming,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusOptionDot,
                        {
                          backgroundColor:
                            YELLOW,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusOptionText,
                        editStatus ===
                          'UPCOMING' &&
                          styles.statusOptionTextActive,
                      ]}
                    >
                      UPCOMING
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={
                      isSaving ||
                      isDeleting
                    }
                    onPress={() =>
                      setEditStatus(
                        'LIVE',
                      )
                    }
                    style={[
                      styles.statusOption,
                      editStatus ===
                        'LIVE' &&
                        styles.statusOptionLive,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusOptionDot,
                        {
                          backgroundColor:
                            RED,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusOptionText,
                        editStatus ===
                          'LIVE' &&
                          styles.statusOptionTextActive,
                      ]}
                    >
                      LIVE
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={
                      isSaving ||
                      isDeleting
                    }
                    onPress={() =>
                      setEditStatus(
                        'COMPLETED',
                      )
                    }
                    style={[
                      styles.statusOption,
                      editStatus ===
                        'COMPLETED' &&
                        styles.statusOptionCompleted,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusOptionDot,
                        {
                          backgroundColor:
                            GREEN,
                        },
                      ]}
                    />

                    <Text
                      style={[
                        styles.statusOptionText,
                        editStatus ===
                          'COMPLETED' &&
                          styles.statusOptionTextActive,
                      ]}
                    >
                      COMPLETED
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={
                    styles.modalButtons
                  }
                >
                  <Pressable
                    disabled={
                      isSaving ||
                      isDeleting
                    }
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
                    disabled={
                      isSaving ||
                      isDeleting
                    }
                    onPress={
                      handleSaveTournament
                    }
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed &&
                        styles.buttonPressed,
                      isSaving &&
                        styles.disabledButton,
                    ]}
                  >
                    {isSaving ? (
                      <ActivityIndicator
                        size="small"
                        color="#000000"
                      />
                    ) : (
                      <Text
                        style={
                          styles.saveButtonText
                        }
                      >
                        SAVE CHANGES
                      </Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: BG,
    },

    container: {
      flex: 1,
      backgroundColor: BG,
    },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingTop: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: CARD_2,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    backText: {
      color: TEXT,
      fontSize: 34,
      lineHeight: 36,
      fontWeight: '300',
      marginTop: -4,
    },

    titleContainer: {
      flex: 1,
    },

    pageTitle: {
      color: TEXT,
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: 1.2,
    },

    pageSubtitle: {
      color: MUTED,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginTop: 2,
    },

    editHeaderButton: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 9,
      backgroundColor: TEXT,
      marginLeft: 8,
    },

    editHeaderButtonText: {
      color: '#000000',
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    folderScrollContent: {
      padding: 16,
      paddingBottom: 40,
    },

    folderHeader: {
      marginBottom: 14,
    },

    folderHeaderTitle: {
      color: TEXT,
      fontSize: 15,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    folderHeaderSubtitle: {
      color: MUTED,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginTop: 4,
    },

    folderCard: {
      backgroundColor: CARD,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 15,
      marginBottom: 12,
    },

    folderPressed: {
      opacity: 0.72,
      transform: [
        {
          scale: 0.99,
        },
      ],
    },

    folderTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    folderIconContainer: {
      width: 54,
      height: 54,
      borderRadius: 13,
      backgroundColor: CARD_2,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },

    folderIcon: {
      fontSize: 27,
    },

    folderTitleContainer: {
      flex: 1,
      minWidth: 0,
    },

    folderName: {
      color: TEXT,
      fontSize: 16,
      fontWeight: '900',
      lineHeight: 21,
    },

    folderDate: {
      color: MUTED,
      fontSize: 10,
      fontWeight: '700',
      marginTop: 4,
      letterSpacing: 0.4,
    },

    folderArrow: {
      color: '#666666',
      fontSize: 30,
      fontWeight: '300',
      marginLeft: 8,
    },

    folderDivider: {
      height: 1,
      backgroundColor: BORDER,
      marginVertical: 14,
    },

    folderInfoRow: {
      flexDirection: 'row',
      gap: 8,
    },

    folderInfoItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      backgroundColor: '#0D0D0D',
      borderRadius: 9,
    },

    folderInfoValue: {
      color: TEXT,
      fontSize: 16,
      fontWeight: '900',
    },

    folderInfoLabel: {
      color: '#666666',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 0.6,
      marginTop: 3,
    },

    folderBottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 13,
    },

    folderOrganization: {
      flex: 1,
      color: '#666666',
      fontSize: 9,
      fontWeight: '700',
      marginRight: 8,
    },

    folderStatus: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      backgroundColor: CARD_2,
    },

    folderStatusDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      marginRight: 5,
    },

    folderStatusText: {
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.6,
    },

    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },

    tournamentHeader: {
      backgroundColor: CARD,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 16,
      marginBottom: 12,
    },

    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },

    headerTitleBlock: {
      flex: 1,
      paddingRight: 10,
    },

    detailFolderRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    detailFolderIcon: {
      fontSize: 25,
      marginRight: 9,
    },

    tournamentName: {
      flex: 1,
      color: TEXT,
      fontSize: 21,
      fontWeight: '900',
      letterSpacing: 0.3,
    },

    organizationText: {
      color: MUTED,
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
    },

    dateText: {
      color: '#666666',
      fontSize: 11,
      marginTop: 4,
    },

    statusBadgeLarge: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: CARD_2,
    },

    statusBadgeLargeText: {
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    pdfInfo: {
      marginTop: 15,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: BORDER,
    },

    pdfLabel: {
      color: '#666666',
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1,
    },

    pdfName: {
      color: MUTED,
      fontSize: 11,
      marginTop: 4,
    },

    editTournamentButton: {
      height: 46,
      borderRadius: 10,
      backgroundColor: CARD_2,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    editTournamentButtonText: {
      color: TEXT,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    printResultsButton: {
      marginTop: 12,
      minHeight: 52,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: GREEN,
      backgroundColor: '#102014',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },

    printResultsButtonText: {
      color: GREEN,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    /*
     * --------------------------------------------------
     * OFFICIAL RESULTS STYLES
     * --------------------------------------------------
     */

    resultsSection: {
      backgroundColor: '#0C0C0C',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#203C24',
      padding: 14,
      marginTop: 14,
      marginBottom: 14,
    },

    resultsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },

    resultsHeaderIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#161A16',
      borderWidth: 1,
      borderColor: '#29452E',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    resultsHeaderIconText: {
      fontSize: 24,
    },

    resultsHeaderTextBlock: {
      flex: 1,
    },

    resultsTitle: {
      color: TEXT,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    resultsSubtitle: {
      color: MUTED,
      fontSize: 8,
      fontWeight: '700',
      marginTop: 4,
      letterSpacing: 0.6,
    },

    resultCard: {
      backgroundColor: CARD,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 12,
      marginBottom: 10,
    },

    resultCategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 11,
    },

    resultCategoryName: {
      color: TEXT,
      fontSize: 14,
      fontWeight: '900',
    },

    resultCategorySubtitle: {
      color: MUTED,
      fontSize: 8,
      fontWeight: '700',
      marginTop: 3,
      letterSpacing: 0.6,
    },

    resultCompletedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: GREEN,
      borderRadius: 7,
      paddingHorizontal: 7,
      paddingVertical: 5,
      backgroundColor: '#101A12',
    },

    resultCompletedDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: GREEN,
      marginRight: 5,
    },

    resultCompletedText: {
      color: GREEN,
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    resultChampionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#101A12',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#29452E',
      padding: 11,
    },

    resultMedalContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#18241A',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },

    resultMedal: {
      fontSize: 25,
    },

    resultChampionInfo: {
      flex: 1,
      minWidth: 0,
    },

    resultPlaceLabel: {
      color: GREEN,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    resultChampionName: {
      color: TEXT,
      fontSize: 16,
      fontWeight: '900',
      marginTop: 3,
    },

    resultClub: {
      color: MUTED,
      fontSize: 9,
      fontWeight: '600',
      marginTop: 3,
    },

    resultRunnerUpCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#111111',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 10,
      marginTop: 8,
    },

    resultRunnerMedalContainer: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: '#181818',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },

    resultRunnerMedal: {
      fontSize: 21,
    },

    resultRunnerUpInfo: {
      flex: 1,
      minWidth: 0,
    },

    resultPlaceLabelMuted: {
      color: MUTED,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    resultRunnerUpName: {
      color: '#D8D8D8',
      fontSize: 13,
      fontWeight: '800',
      marginTop: 3,
    },

    resultDetailsRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: '#0D0D0D',
      borderRadius: 9,
      marginTop: 8,
      minHeight: 55,
    },

    resultDetailItem: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    resultDetailDivider: {
      width: 1,
      backgroundColor: BORDER,
      marginVertical: 9,
    },

    resultDetailLabel: {
      color: '#666666',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    resultDetailValue: {
      color: TEXT,
      fontSize: 10,
      fontWeight: '900',
      marginTop: 4,
    },

    deleteTournamentButton: {
      height: 46,
      borderRadius: 10,
      backgroundColor: '#190B0B',
      borderWidth: 1,
      borderColor: RED,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },

    deleteTournamentButtonText: {
      color: RED,
      fontSize: 11,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    statsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 24,
    },

    statCard: {
      flex: 1,
      minHeight: 72,
      backgroundColor: CARD,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
    },

    statValue: {
      color: TEXT,
      fontSize: 21,
      fontWeight: '900',
    },

    statLabel: {
      color: MUTED,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.7,
      marginTop: 4,
    },

    sectionHeader: {
      marginBottom: 12,
    },

    sectionTitle: {
      color: TEXT,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    sectionSubtitle: {
      color: MUTED,
      fontSize: 9,
      fontWeight: '700',
      marginTop: 4,
      letterSpacing: 0.8,
    },

    categorySection: {
      marginBottom: 22,
    },

    categoryHeader: {
      marginBottom: 9,
      paddingHorizontal: 3,
    },

    categoryTitleContainer: {
      flex: 1,
    },

    categoryName: {
      color: TEXT,
      fontSize: 16,
      fontWeight: '900',
    },

    categorySubtitle: {
      color: MUTED,
      fontSize: 9,
      fontWeight: '700',
      marginTop: 3,
      letterSpacing: 0.7,
    },

    /*
     * --------------------------------------------------
     * TOURNAMENT BRACKET STYLES
     * --------------------------------------------------
     */

    bracketSection: {
      backgroundColor: '#0C0C0C',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: BORDER,
      paddingTop: 15,
      paddingBottom: 15,
      marginBottom: 14,
      overflow: 'hidden',
    },

    bracketSectionHeader: {
      paddingHorizontal: 15,
      marginBottom: 14,
    },

    bracketSectionTitle: {
      color: TEXT,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    bracketSectionSubtitle: {
      color: MUTED,
      fontSize: 9,
      fontWeight: '700',
      marginTop: 3,
      letterSpacing: 0.7,
    },

    bracketLegend: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 12,
      marginTop: 12,
    },

    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    legendDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 5,
    },

    legendText: {
      color: '#777777',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    bracketScrollContent: {
      paddingHorizontal: 15,
    },

    bracketBoard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      minHeight: 260,
    },

    bracketColumn: {
      width: 190,
      marginRight: 28,
    },

    bracketColumnHeader: {
      minHeight: 43,
      justifyContent: 'center',
      paddingHorizontal: 10,
      backgroundColor: CARD_2,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: BORDER,
      marginBottom: 12,
    },

    bracketColumnTitle: {
      color: TEXT,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.6,
    },

    bracketColumnCount: {
      color: MUTED,
      fontSize: 7,
      fontWeight: '700',
      marginTop: 3,
    },

    bracketMatchesContainer: {
      justifyContent: 'flex-start',
    },

    bracketR16Spacing: {
      paddingTop: 35,
    },

    bracketQuarterSpacing: {
      paddingTop: 75,
    },

    bracketSemiSpacing: {
      paddingTop: 115,
    },

    bracketFinalSpacing: {
      paddingTop: 155,
    },

    bracketBoutWrapper: {
      position: 'relative',
      minHeight: 100,
      marginBottom: 25,
    },

    bracketBout: {
      width: 190,
      minHeight: 100,
      backgroundColor: CARD,
      borderRadius: 10,
      borderWidth: 1,
      padding: 9,
    },

    bracketBoutHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 7,
    },

    bracketBoutNumber: {
      color: '#777777',
      fontSize: 7,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    bracketStatusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },

    bracketBoxerRow: {
      minHeight: 25,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 6,
      paddingRight: 5,
    },

    bracketWinnerRow: {
      backgroundColor: '#102014',
    },

    bracketCornerLine: {
      width: 3,
      height: 17,
      borderRadius: 2,
      marginRight: 7,
    },

    bracketBoxerName: {
      flex: 1,
      color: '#D8D8D8',
      fontSize: 9,
      fontWeight: '800',
    },

    bracketWinnerName: {
      color: TEXT,
      fontWeight: '900',
    },

    bracketTbd: {
      color: '#666666',
      fontStyle: 'italic',
    },

    bracketWinnerMark: {
      color: GREEN,
      fontSize: 11,
      fontWeight: '900',
      marginLeft: 4,
    },

    bracketVsLine: {
      height: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },

    bracketVsText: {
      color: '#444444',
      fontSize: 6,
      fontWeight: '900',
    },

    bracketStatus: {
      alignSelf: 'flex-start',
      marginTop: 7,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 5,
      borderWidth: 1,
      backgroundColor: CARD_2,
    },

    bracketStatusText: {
      fontSize: 6,
      fontWeight: '900',
      letterSpacing: 0.5,
    },

    bracketConnector: {
      position: 'absolute',
      right: -29,
      top: 49,
      width: 29,
      height: 2,
    },

    bracketConnectorLine: {
      height: 1,
      width: '100%',
      backgroundColor: '#3A3A3A',
    },

    matchCard: {
      backgroundColor: CARD,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
      marginBottom: 10,
    },

    matchHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 13,
    },

    boutNumber: {
      color: TEXT,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    roundText: {
      color: MUTED,
      fontSize: 9,
      fontWeight: '700',
      marginTop: 3,
      letterSpacing: 0.5,
    },

    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      backgroundColor: CARD_2,
    },

    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginRight: 5,
    },

    statusText: {
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    boxerRow: {
      flex: 1,
      flexDirection: 'row',
      minWidth: 0,
    },

    boxersContainer: {
      flexDirection: 'row',
      alignItems: 'stretch',
      backgroundColor: '#0D0D0D',
      borderRadius: 10,
      padding: 10,
    },

    cornerIndicator: {
      width: 3,
      borderRadius: 2,
      marginRight: 9,
    },

    boxerInfo: {
      flex: 1,
      minWidth: 0,
    },

    cornerLabel: {
      color: MUTED,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 4,
    },

    boxerName: {
      color: TEXT,
      fontSize: 13,
      fontWeight: '800',
    },

    tbdText: {
      color: '#777777',
      fontStyle: 'italic',
      fontWeight: '600',
    },

    clubText: {
      color: '#666666',
      fontSize: 9,
      marginTop: 3,
    },

    vsContainer: {
      width: 38,
      alignItems: 'center',
      justifyContent: 'center',
    },

    vsText: {
      color: '#555555',
      fontSize: 10,
      fontWeight: '900',
    },

    winnerContainer: {
      marginTop: 10,
      padding: 10,
      borderRadius: 9,
      backgroundColor: '#101A12',
      borderWidth: 1,
      borderColor: '#203C24',
    },

    winnerLabel: {
      color: GREEN,
      fontSize: 8,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    winnerName: {
      color: TEXT,
      fontSize: 13,
      fontWeight: '900',
      marginTop: 3,
    },

    winnerClub: {
      color: MUTED,
      fontSize: 9,
      marginTop: 2,
    },

    startButton: {
      height: 46,
      borderRadius: 10,
      backgroundColor: TEXT,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },

    startButtonText: {
      color: '#000000',
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    lockedInfo: {
      marginTop: 10,
      paddingVertical: 9,
      alignItems: 'center',
      backgroundColor: '#151515',
      borderRadius: 8,
    },

    lockedText: {
      color: '#666666',
      fontSize: 9,
      fontWeight: '700',
    },

    completedInfo: {
      marginTop: 10,
      paddingVertical: 9,
      alignItems: 'center',
      backgroundColor: '#101A12',
      borderRadius: 8,
    },

    completedText: {
      color: GREEN,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.6,
    },

    emptyCategory: {
      backgroundColor: CARD,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 18,
      alignItems: 'center',
    },

    emptyCategoryText: {
      color: MUTED,
      fontSize: 11,
    },

    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 35,
    },

    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: CARD_2,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 18,
    },

    emptyIconText: {
      fontSize: 27,
    },

    emptyTitle: {
      color: TEXT,
      fontSize: 20,
      fontWeight: '900',
      letterSpacing: 1,
    },

    emptyDescription: {
      color: MUTED,
      fontSize: 12,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 10,
    },

    manageBoxersButton: {
      marginTop: 22,
      paddingHorizontal: 18,
      height: 44,
      borderRadius: 10,
      backgroundColor: TEXT,
      alignItems: 'center',
      justifyContent: 'center',
    },

    manageBoxersText: {
      color: '#000000',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    loadingText: {
      color: MUTED,
      fontSize: 12,
      marginTop: 12,
    },

    buttonPressed: {
      opacity: 0.7,
    },

    /*
     * --------------------------------------------------
     * EDIT MODAL
     * --------------------------------------------------
     */

    modalOverlay: {
      flex: 1,
      backgroundColor:
        'rgba(0, 0, 0, 0.78)',
      justifyContent: 'flex-end',
    },

    editModal: {
      backgroundColor: CARD,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      borderWidth: 1,
      borderColor: BORDER,
      maxHeight: '88%',
      paddingTop: 18,
    },

    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: BORDER,
    },

    modalTitleContainer: {
      flex: 1,
    },

    modalTitle: {
      color: TEXT,
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0.8,
    },

    modalSubtitle: {
      color: MUTED,
      fontSize: 10,
      fontWeight: '600',
      marginTop: 4,
    },

    modalCloseButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: CARD_2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: BORDER,
    },

    modalCloseText: {
      color: TEXT,
      fontSize: 28,
      fontWeight: '300',
      lineHeight: 30,
      marginTop: -2,
    },

    modalScrollContent: {
      padding: 20,
      paddingBottom: 35,
    },

    inputLabel: {
      color: MUTED,
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 0.9,
      marginBottom: 7,
      marginTop: 5,
    },

    textInput: {
      height: 48,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: '#0D0D0D',
      color: TEXT,
      paddingHorizontal: 13,
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 16,
    },

    statusOptions: {
      gap: 9,
      marginBottom: 20,
    },

    statusOption: {
      minHeight: 46,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: '#0D0D0D',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
    },

    statusOptionUpcoming: {
      borderColor: YELLOW,
      backgroundColor: '#191704',
    },

    statusOptionLive: {
      borderColor: RED,
      backgroundColor: '#190B0B',
    },

    statusOptionCompleted: {
      borderColor: GREEN,
      backgroundColor: '#0C180F',
    },

    statusOptionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 9,
    },

    statusOptionText: {
      color: MUTED,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    statusOptionTextActive: {
      color: TEXT,
    },

    modalButtons: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 5,
    },

    cancelButton: {
      flex: 1,
      height: 48,
      borderRadius: 10,
      backgroundColor: CARD_2,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: 'center',
      justifyContent: 'center',
    },

    cancelButtonText: {
      color: MUTED,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    saveButton: {
      flex: 1.5,
      height: 48,
      borderRadius: 10,
      backgroundColor: TEXT,
      alignItems: 'center',
      justifyContent: 'center',
    },

    saveButtonText: {
      color: '#000000',
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 0.7,
    },

    disabledButton: {
      opacity: 0.55,
    },
  });