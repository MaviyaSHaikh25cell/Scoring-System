import { API_BASE_URL } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MATCH_HISTORY_KEY = '@boxing_scoring_match_history';
export const TOURNAMENTS_KEY = '@boxing_scoring_tournaments';



const AUTH_TOKEN_KEY = '@boxing_auth_token';

export type MatchResult = 'WON' | 'LOST' | 'DRAW';

/* =========================================================
   API HELPERS
   ========================================================= */

async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.log('Error loading auth token:', error);
    return null;
  }
}

async function authenticatedRequest(
  endpoint: string,
  options: RequestInit = {},
): Promise<any> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Authentication token not found');
  }

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const contentType =
    response.headers.get('content-type') || '';

  let data: any;

  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    const responseText = await response.text();

    data = {
      message:
        responseText ||
        `Request failed with status ${response.status}`,
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Request failed with status ${response.status}`,
    );
  }

  return data;
}

/* =========================================================
   EXISTING MATCH HISTORY
   ========================================================= */

export type SavedMatch = {
  id: string;
  redBoxer: string;
  blueBoxer: string;
  weightCategory: string;
  rounds: number;
  matchType: string;
  redScore: number;
  blueScore: number;
  winner: string;
  result: MatchResult;
  date: string;
  time: string;
};

export async function getMatchHistory(): Promise<SavedMatch[]> {
  try {
    const stored =
      await AsyncStorage.getItem(
        MATCH_HISTORY_KEY,
      );

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.log(
      'Error loading match history:',
      error,
    );

    return [];
  }
}

export async function saveMatch(
  match: SavedMatch,
): Promise<void> {
  try {
    const history = await getMatchHistory();

    const updatedHistory = [
      match,
      ...history,
    ];

    await AsyncStorage.setItem(
      MATCH_HISTORY_KEY,
      JSON.stringify(updatedHistory),
    );
  } catch (error) {
    console.log(
      'Error saving match history:',
      error,
    );
  }
}

export async function clearMatchHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(
      MATCH_HISTORY_KEY,
    );
  } catch (error) {
    console.log(
      'Error clearing match history:',
      error,
    );
  }
}

/* =========================================================
   ROUND VERIFICATION
   ========================================================= */

export type RoundVerificationStatus =
  | 'PENDING'
  | 'READY_FOR_ADMIN'
  | 'APPROVED'
  | 'FLAGGED';

export type TournamentRoundReview = {
  roundNumber: number;

  status: RoundVerificationStatus;

  submittedJudgeCount: number;

  judgeScores: {
    judgeId: string;
    judgeName: string;
    redScore: number;
    blueScore: number;
    submittedAt: string;
  }[];

  roundWinner:
    | 'RED'
    | 'BLUE'
    | 'DRAW'
    | null;

  approvedBy: string | null;
  approvedByName: string | null;
  approvedAt: string | null;

  adminNote: string | null;

  flagReason: string | null;
};

/* =========================================================
   REFEREE SYSTEM
   ========================================================= */

export type RefereeEventType =
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

export type RefereeCorner =
  | 'RED'
  | 'BLUE'
  | 'BOTH'
  | null;

export type RefereeEvent = {
  id: string;

  type: RefereeEventType;

  roundNumber: number;

  time: string;

  corner: RefereeCorner;

  note: string | null;

  refereeId: string | null;
  refereeName: string | null;

  createdAt: string;
};

export type MatchStoppageMethod =
  | 'RSC'
  | 'KO'
  | 'DOCTOR_STOP'
  | 'RETIREMENT'
  | 'STOP_CONTEST'
  | null;

export type MatchStoppage = {
  method: MatchStoppageMethod;

  winnerCorner:
    | 'RED'
    | 'BLUE'
    | null;

  loserCorner:
    | 'RED'
    | 'BLUE'
    | null;

  roundNumber: number | null;

  time: string | null;

  refereeId: string | null;
  refereeName: string | null;

  reason: string | null;

  stoppedAt: string | null;
};

/* =========================================================
   ADMIN OVERRIDE / AUDIT
   ========================================================= */

export type AdminOverride = {
  id: string;

  adminId: string;
  adminName: string;

  field: string;

  previousValue: string;
  newValue: string;

  reason: string;

  createdAt: string;
};

/* =========================================================
   TOURNAMENT MANAGEMENT
   ========================================================= */

export type TournamentMatchStatus =
  | 'LOCKED'
  | 'UPCOMING'
  | 'LIVE'
  | 'COMPLETED';

export type TournamentRound =
  | 'PRELIMINARY'
  | 'ROUND_OF_16'
  | 'QUARTER_FINAL'
  | 'SEMI_FINAL'
  | 'FINAL';

export type TournamentBoutSource = {
  matchId: string;
  displayText: string;
};

export type TournamentMatch = {
  id: string;

  round: TournamentRound;
  matchNumber: number;

  weightCategory: string;

  redBoxer: string | null;
  blueBoxer: string | null;

  redClub: string | null;
  blueClub: string | null;

  redSourceMatchId: string | null;
  blueSourceMatchId: string | null;

  redSourceText: string | null;
  blueSourceText: string | null;

  winner: string | null;
  winnerClub: string | null;

  status: TournamentMatchStatus;

  nextMatchId: string | null;

  previousMatchIds: string[];

  rounds: number;
  matchType: string;

  scoringMatchId: string | null;

  refereeId?: string | null;
  refereeName?: string | null;

  roundReviews?: TournamentRoundReview[];

  refereeEvents?: RefereeEvent[];

  stoppage?: MatchStoppage | null;

  adminOverrides?: AdminOverride[];

  adminVerified?: boolean;

  adminVerifiedBy?: string | null;
  adminVerifiedByName?: string | null;
  adminVerifiedAt?: string | null;
};

export type TournamentWeightCategory = {
  id: string;
  name: string;

  boxerIds: string[];

  matches: TournamentMatch[];
};

export type Tournament = {
  id: string;

  name: string;

  organization: string;

  date: string;

  pdfFileName: string | null;

  createdAt: string;

  status:
    | 'UPCOMING'
    | 'LIVE'
    | 'COMPLETED';

  boxerCount: number;

  weightCategories: TournamentWeightCategory[];
};

/* =========================================================
   TOURNAMENT MAPPING
   ========================================================= */

/*
 * The backend stores the complete frontend Tournament
 * object inside Tournament.data.
 *
 * The database Tournament record itself contains:
 *
 * id
 * name
 * date
 * venue
 * status
 * data
 *
 * It also contains real PostgreSQL Match records.
 *
 * We keep the existing frontend tournament/bracket
 * structure and merge the real database match state
 * into it.
 */
function mapBackendTournament(
  backendTournament: any,
): Tournament {
  const storedData =
    backendTournament?.data;

  /*
   * PostgreSQL Match records belonging
   * to this tournament.
   */
  const backendMatches =
    Array.isArray(
      backendTournament?.matches,
    )
      ? backendTournament.matches
      : [];

  /*
   * =======================================================
   * EXISTING FRONTEND TOURNAMENT DATA
   * =======================================================
   *
   * Most of your tournament UI depends on:
   *
   * Tournament
   *   -> weightCategories
   *      -> matches
   *
   * Therefore we preserve that structure.
   */
  if (
    storedData &&
    typeof storedData === 'object' &&
    !Array.isArray(storedData)
  ) {
    const storedCategories =
      Array.isArray(
        storedData.weightCategories,
      )
        ? storedData.weightCategories
        : [];

    /*
     * Merge PostgreSQL Match information
     * into every existing tournament match.
     */
    const updatedCategories =
      storedCategories.map(
        (
          category: TournamentWeightCategory,
        ) => {
          const categoryMatches =
            Array.isArray(
              category.matches,
            )
              ? category.matches
              : [];

          const updatedMatches =
            categoryMatches.map(
              (
                tournamentMatch: TournamentMatch,
              ) => {
                /*
                 * Find the real PostgreSQL
                 * Match using scoringMatchId.
                 */
                const databaseMatch =
                  backendMatches.find(
                    (item: any) =>
                      String(item.id) ===
                      String(
                        tournamentMatch.scoringMatchId ??
                          '',
                      ),
                  );

                /*
                 * No PostgreSQL match exists
                 * for this tournament bout yet.
                 *
                 * Keep the existing frontend
                 * tournament match untouched.
                 */
                if (!databaseMatch) {
                  return tournamentMatch;
                }

                /*
                 * ==========================================
                 * WINNER
                 * ==========================================
                 */

                let winnerName =
                  tournamentMatch.winner;

                let winnerClub =
                  tournamentMatch.winnerClub;

                const databaseWinnerId =
                  databaseMatch?.result
                    ?.winnerId ??
                  databaseMatch?.winnerId ??
                  null;

                if (databaseWinnerId) {
                  if (
                    String(
                      databaseWinnerId,
                    ) ===
                    String(
                      databaseMatch.redBoxerId,
                    )
                  ) {
                    winnerName =
                      databaseMatch
                        .redBoxer?.name ??
                      tournamentMatch.redBoxer;

                    winnerClub =
                      databaseMatch
                        .redBoxer?.club ??
                      tournamentMatch.redClub;
                  } else if (
                    String(
                      databaseWinnerId,
                    ) ===
                    String(
                      databaseMatch.blueBoxerId,
                    )
                  ) {
                    winnerName =
                      databaseMatch
                        .blueBoxer?.name ??
                      tournamentMatch.blueBoxer;

                    winnerClub =
                      databaseMatch
                        .blueBoxer?.club ??
                      tournamentMatch.blueClub;
                  }
                } else if (
                  databaseMatch?.result
                    ?.decision === 'DRAW'
                ) {
                  winnerName = 'DRAW';
                  winnerClub = null;
                }

                /*
                 * ==========================================
                 * STATUS
                 * ==========================================
                 *
                 * PostgreSQL is the source of truth
                 * for an actual scoring match.
                 */
                let status =
                  tournamentMatch.status;

                if (
                  databaseMatch.status ===
                  'LIVE'
                ) {
                  status = 'LIVE';
                } else if (
                  databaseMatch.status ===
                  'COMPLETED'
                ) {
                  status = 'COMPLETED';
                } else if (
                  databaseMatch.status ===
                  'UPCOMING'
                ) {
                  status = 'UPCOMING';
                } else if (
                  databaseMatch.status ===
                  'CANCELLED'
                ) {
                  /*
                   * TournamentMatch does not have
                   * CANCELLED, so preserve the
                   * existing frontend status.
                   */
                  status =
                    tournamentMatch.status;
                }

                /*
                 * ==========================================
                 * SYNCHRONIZED MATCH
                 * ==========================================
                 */

                return {
                  ...tournamentMatch,

                  /*
                   * Real PostgreSQL Match ID.
                   */
                  scoringMatchId:
                    String(
                      databaseMatch.id,
                    ),

                  status,

                  winner: winnerName,

                  winnerClub,

                  /*
                   * Synchronize boxer information
                   * from PostgreSQL.
                   */
                  redBoxer:
                    databaseMatch
                      .redBoxer?.name ??
                    tournamentMatch.redBoxer,

                  blueBoxer:
                    databaseMatch
                      .blueBoxer?.name ??
                    tournamentMatch.blueBoxer,

                  redClub:
                    databaseMatch
                      .redBoxer?.club ??
                    tournamentMatch.redClub,

                  blueClub:
                    databaseMatch
                      .blueBoxer?.club ??
                    tournamentMatch.blueClub,
                };
              },
            );

          return {
            ...category,

            matches:
              updatedMatches,
          };
        },
      );

    /*
     * ==========================================
     * TOURNAMENT STATUS
     * ==========================================
     */

    const backendStatus =
      backendTournament?.status;

    const frontendStatus =
      backendStatus === 'LIVE'
        ? 'LIVE'
        : backendStatus ===
            'COMPLETED'
          ? 'COMPLETED'
          : 'UPCOMING';

    /*
     * ==========================================
     * FINAL FRONTEND TOURNAMENT
     * ==========================================
     */

    return {
      ...storedData,

      id: String(
        backendTournament.id ??
          storedData.id ??
          '',
      ),

      name: String(
        backendTournament.name ??
          storedData.name ??
          '',
      ),

      organization:
        backendTournament.venue ??
        storedData.organization ??
        '',

      date:
        backendTournament.date ??
        storedData.date ??
        '',

      createdAt:
        backendTournament.createdAt ??
        storedData.createdAt ??
        new Date().toISOString(),

      status: frontendStatus,

      boxerCount:
        Array.isArray(
          backendTournament?.boxers,
        )
          ? backendTournament.boxers.length
          : Number(
              storedData.boxerCount ?? 0,
            ),

      weightCategories:
        updatedCategories,
    };
  }

  /*
   * =======================================================
   * FALLBACK
   * =======================================================
   *
   * Used when the PostgreSQL tournament does not
   * have frontend tournamentData yet.
   */
  return {
    id: String(
      backendTournament?.id ?? '',
    ),

    name: String(
      backendTournament?.name ?? '',
    ),

    organization: String(
      backendTournament?.venue ?? '',
    ),

    date:
      backendTournament?.date
        ? String(
            backendTournament.date,
          )
        : '',

    pdfFileName: null,

    createdAt:
      backendTournament?.createdAt
        ? String(
            backendTournament.createdAt,
          )
        : new Date().toISOString(),

    status:
      backendTournament?.status ===
      'LIVE'
        ? 'LIVE'
        : backendTournament?.status ===
            'COMPLETED'
          ? 'COMPLETED'
          : 'UPCOMING',

    boxerCount:
      Array.isArray(
        backendTournament?.boxers,
      )
        ? backendTournament.boxers.length
        : 0,

    weightCategories: [],
  };
}

/* =========================================================
   GET TOURNAMENTS
   ========================================================= */

export async function getTournaments(): Promise<
  Tournament[]
> {
  try {
    const data =
      await authenticatedRequest(
        '/tournaments',
      );

    const backendTournaments =
      Array.isArray(data?.tournaments)
        ? data.tournaments
        : [];

    return backendTournaments.map(
      mapBackendTournament,
    );
  } catch (error) {
    console.log(
      'Error loading tournaments from backend:',
      error,
    );

    return [];
  }
}

/* =========================================================
   SAVE TOURNAMENT
   ========================================================= */

export async function saveTournament(
  tournament: Tournament,
): Promise<void> {
  try {
    const existingTournaments =
      await getTournaments();

    const existingTournament =
      existingTournaments.find(
        (item) =>
          item.id === tournament.id,
      );

    /*
     * IMPORTANT:
     *
     * Do not send tournament.weightCategories[].boxerIds
     * from this generic save function.
     *
     * Imported tournament boxerIds can be frontend/import
     * identifiers rather than PostgreSQL Boxer IDs.
     *
     * The complete tournament/bracket is already stored
     * inside tournamentData. Real PostgreSQL boxer IDs are
     * resolved when an actual scoring match is created.
     */
    const tournamentData = {
      ...tournament,
    };

    if (!existingTournament) {
      await authenticatedRequest(
        '/tournaments',
        {
          method: 'POST',

          body: JSON.stringify({
            name: tournament.name,

            date: tournament.date
              ? tournament.date
              : null,

            venue:
              tournament.organization ||
              null,

            status: tournament.status,

            boxerIds: Array.from(
              new Set(
                tournament.weightCategories.flatMap(
                  (category) => category.boxerIds ?? [],
                ),
              ),
            ),

            tournamentData,
          }),
        },
      );

      return;
    }

    await authenticatedRequest(
      `/tournaments/${encodeURIComponent(
        existingTournament.id,
      )}`,
      {
        method: 'PUT',

        body: JSON.stringify({
          name: tournament.name,

          date: tournament.date
            ? tournament.date
            : null,

          venue:
            tournament.organization ||
            null,

          status: tournament.status,

          boxerIds: Array.from(
            new Set(
              tournament.weightCategories.flatMap(
                (category) => category.boxerIds ?? [],
              ),
            ),
          ),

          tournamentData,
        }),
      },
    );
  } catch (error) {
    console.log(
      'Error saving tournament to backend:',
      error,
    );

    throw error;
  }
}

/* =========================================================
   GET TOURNAMENT BY ID
   ========================================================= */

export async function getTournamentById(
  tournamentId: string,
): Promise<Tournament | null> {
  try {
    const data =
      await authenticatedRequest(
        `/tournaments/${encodeURIComponent(
          tournamentId,
        )}`,
      );

    if (!data?.tournament) {
      return null;
    }

    return mapBackendTournament(
      data.tournament,
    );
  } catch (error) {
    console.log(
      'Error loading tournament:',
      error,
    );

    return null;
  }
}

/* =========================================================
   UPDATE TOURNAMENT
   ========================================================= */

export async function updateTournament(
  tournament: Tournament,
): Promise<void> {
  await saveTournament(tournament);
}

/* =========================================================
   TOURNAMENT MATCH UPDATE
   ========================================================= */

export async function updateTournamentMatch(
  tournamentId: string,
  matchId: string,
  updates: Partial<TournamentMatch>,
): Promise<Tournament | null> {
  try {
    const tournament =
      await getTournamentById(
        tournamentId,
      );

    if (!tournament) {
      return null;
    }

    const updatedCategories =
      tournament.weightCategories.map(
        (category) => {
          const matchExists =
            category.matches.some(
              (match) =>
                match.id === matchId,
            );

          if (!matchExists) {
            return category;
          }

          return {
            ...category,

            matches:
              category.matches.map(
                (match) =>
                  match.id === matchId
                    ? {
                        ...match,
                        ...updates,
                      }
                    : match,
              ),
          };
        },
      );

    const updatedTournament: Tournament =
      {
        ...tournament,
        weightCategories:
          updatedCategories,
      };

    await saveTournament(
      updatedTournament,
    );

    return updatedTournament;
  } catch (error) {
    console.log(
      'Error updating tournament match:',
      error,
    );

    return null;
  }
}

/* =========================================================
   TOURNAMENT DELETE
   ========================================================= */

export async function deleteTournament(
  tournamentId: string,
): Promise<void> {
  try {
    await authenticatedRequest(
      `/tournaments/${encodeURIComponent(
        tournamentId,
      )}`,
      {
        method: 'DELETE',
      },
    );
  } catch (error) {
    console.log(
      'Error deleting tournament:',
      error,
    );

    throw error;
  }
}

/* =========================================================
   CLEAR ALL TOURNAMENTS
   ========================================================= */

export async function clearTournaments(): Promise<void> {
  try {
    const tournaments =
      await getTournaments();

    await Promise.all(
      tournaments.map(
        (tournament) =>
          authenticatedRequest(
            `/tournaments/${encodeURIComponent(
              tournament.id,
            )}`,
            {
              method: 'DELETE',
            },
          ),
      ),
    );
  } catch (error) {
    console.log(
      'Error clearing tournaments:',
      error,
    );

    throw error;
  }
}