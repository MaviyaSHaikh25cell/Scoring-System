import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from '../middleware/auth';

const router = Router();

/*
 * ============================================================
 * HELPER TYPES
 * ============================================================
 */

type TournamentMatchData = {
  id: string;

  round?: string;
  matchNumber?: number;

  weightCategory?: string;

  redBoxer?: string | null;
  blueBoxer?: string | null;

  redClub?: string | null;
  blueClub?: string | null;

  redSourceMatchId?: string | null;
  blueSourceMatchId?: string | null;

  redSourceText?: string | null;
  blueSourceText?: string | null;

  winner?: string | null;
  winnerClub?: string | null;

  status?: string;

  nextMatchId?: string | null;

  previousMatchIds?: string[];

  rounds?: number;
  matchType?: string;

  scoringMatchId?: string | null;

  [key: string]: any;
};

type TournamentCategoryData = {
  id: string;
  name: string;

  boxerIds?: string[];

  matches?: TournamentMatchData[];

  [key: string]: any;
};

type TournamentData = {
  weightCategories?: TournamentCategoryData[];

  [key: string]: any;
};

/*
 * ============================================================
 * TOURNAMENT BRACKET PROGRESSION
 * ============================================================
 *
 * The frontend tournament bracket is stored inside
 * Tournament.data.
 *
 * PostgreSQL Match is the source of truth for the actual
 * scoring result.
 *
 * When a scoring match is completed:
 *
 *   PostgreSQL Match
 *          ↓
 *   Tournament.data
 *          ↓
 *   Current tournament bout winner
 *          ↓
 *   nextMatchId
 *          ↓
 *   Next bout Red/Blue boxer
 *
 * ============================================================
 */

function normalizeBoxerName(value: string | null | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

function findTournamentMatch(
  categories: TournamentCategoryData[],
  matchId: string,
): TournamentMatchData | null {
  for (const category of categories) {
    const matches = Array.isArray(category.matches)
      ? category.matches
      : [];
    const found = matches.find(
      (match) => String(match.id) === String(matchId),
    );
    if (found) return found;
  }
  return null;
}

/**
 * Place a winner in the next bout. If the bracket links the same
 * source bout to both corners, or the winner is already present in
 * the opposite corner, treat the bout as a walkover rather than
 * creating an illegal boxer-vs-self matchup. Walkovers are propagated
 * forward until a real opponent is available or the bracket ends.
 */
function advanceWinnerThroughBracket(
  categories: TournamentCategoryData[],
  sourceMatch: TournamentMatchData,
  initialWinner: string,
  initialClub: string | null,
): TournamentMatchData | null {
  let source = sourceMatch;
  let winner = initialWinner;
  let club = initialClub;
  let firstNextMatch: TournamentMatchData | null = null;
  const visited = new Set<string>([String(source.id)]);

  while (source.nextMatchId) {
    const nextId = String(source.nextMatchId);
    if (visited.has(nextId)) break;
    visited.add(nextId);

    const next = findTournamentMatch(categories, nextId);
    if (!next) break;
    if (!firstNextMatch) firstNextMatch = next;

    // Never rewrite a bout that has already started or been decided.
    if (next.status === 'LIVE' || next.status === 'COMPLETED') break;

    const sourceId = String(source.id);
    const redSourceId = next.redSourceMatchId
      ? String(next.redSourceMatchId)
      : null;
    const blueSourceId = next.blueSourceMatchId
      ? String(next.blueSourceMatchId)
      : null;
    const feedsRed = redSourceId === sourceId;
    const feedsBlue = blueSourceId === sourceId;

    // Do not guess which corner a winner belongs in if the bracket
    // does not contain a link from this bout to the next one.
    if (!feedsRed && !feedsBlue) break;

    // If both source links point to the same bout, the winner is the
    // only unique boxer entering this bout. Keep one corner and make
    // the other an explicit walkover slot instead of duplicating them.
    const duplicateSource = feedsRed && feedsBlue;
    const targetCorner: 'red' | 'blue' = feedsRed ? 'red' : 'blue';
    const oppositeCorner: 'red' | 'blue' = targetCorner === 'red' ? 'blue' : 'red';
    const oppositeName = oppositeCorner === 'red'
      ? next.redBoxer
      : next.blueBoxer;
    const duplicateBoxer =
      normalizeBoxerName(oppositeName) === normalizeBoxerName(winner);

    if (targetCorner === 'red') {
      next.redBoxer = winner;
      next.redClub = club;
      next.redSourceText = `Winner of Bout ${source.matchNumber ?? ''}`.trim();
    } else {
      next.blueBoxer = winner;
      next.blueClub = club;
      next.blueSourceText = `Winner of Bout ${source.matchNumber ?? ''}`.trim();
    }

    if (duplicateSource && oppositeName && !duplicateBoxer) {
      // The other corner already has a distinct boxer. Preserve that
      // boxer, remove the contradictory feeder link, and make the bout
      // available once both corners are present.
      if (oppositeCorner === 'red') next.redSourceMatchId = null;
      else next.blueSourceMatchId = null;
      next.status = next.redBoxer && next.blueBoxer ? 'UPCOMING' : 'LOCKED';
      break;
    }

    if (duplicateSource || duplicateBoxer) {
      if (oppositeCorner === 'red') {
        next.redBoxer = null;
        next.redClub = null;
        next.redSourceMatchId = null;
        next.redSourceText = 'BYE / WALKOVER';
      } else {
        next.blueBoxer = null;
        next.blueClub = null;
        next.blueSourceMatchId = null;
        next.blueSourceText = 'BYE / WALKOVER';
      }
      next.winner = winner;
      next.winnerClub = club;
      next.status = 'COMPLETED';
      source = next;
      continue;
    }

    const hasRed = Boolean(next.redBoxer);
    const hasBlue = Boolean(next.blueBoxer);
    if (hasRed && hasBlue) {
      next.status = 'UPCOMING';
      break;
    }

    // A single boxer with no feeder assigned to the empty corner is a
    // walkover. If a source bout is still expected, keep this bout locked.
    if (hasRed !== hasBlue) {
      const emptyCorner: 'red' | 'blue' = hasRed ? 'blue' : 'red';
      const emptySourceId = emptyCorner === 'red'
        ? next.redSourceMatchId
        : next.blueSourceMatchId;
      if (!emptySourceId) {
        const advancingName = hasRed ? next.redBoxer : next.blueBoxer;
        const advancingClub = hasRed ? next.redClub : next.blueClub;
        if (emptyCorner === 'red') next.redSourceText = 'BYE / WALKOVER';
        else next.blueSourceText = 'BYE / WALKOVER';
        next.winner = advancingName ?? null;
        next.winnerClub = advancingClub ?? null;
        next.status = 'COMPLETED';
        if (!advancingName) break;
        source = next;
        winner = advancingName;
        club = advancingClub ?? null;
        continue;
      }
    }

    next.status = 'LOCKED';
    break;
  }

  return firstNextMatch;
}

function advanceTournamentWinner(
  tournamentData: any,
  completedScoringMatchId: string,
  winnerName: string | null,
  winnerClub: string | null,
): {
  tournamentData: any;
  currentTournamentMatch: TournamentMatchData | null;
  nextTournamentMatch: TournamentMatchData | null;
  tournamentCompleted: boolean;
} {
  if (
    !tournamentData ||
    typeof tournamentData !== 'object' ||
    Array.isArray(tournamentData)
  ) {
    return {
      tournamentData,
      currentTournamentMatch: null,
      nextTournamentMatch: null,
      tournamentCompleted: false,
    };
  }

  const categories: TournamentCategoryData[] =
    Array.isArray(tournamentData.weightCategories)
      ? tournamentData.weightCategories
      : [];

  let currentTournamentMatch:
    | TournamentMatchData
    | null = null;

  let nextTournamentMatch:
    | TournamentMatchData
    | null = null;

  /*
   * ==========================================================
   * 1. FIND CURRENT TOURNAMENT BOUT
   * ==========================================================
   */

  for (const category of categories) {
    const matches = Array.isArray(category.matches)
      ? category.matches
      : [];

    const found = matches.find(
      (match) =>
        String(match.scoringMatchId ?? '') ===
        String(completedScoringMatchId),
    );

    if (found) {
      currentTournamentMatch = found;
      break;
    }
  }

  /*
   * If the PostgreSQL match is not linked to a
   * frontend tournament match, do nothing.
   */

  if (!currentTournamentMatch) {
    return {
      tournamentData,
      currentTournamentMatch: null,
      nextTournamentMatch: null,
      tournamentCompleted: false,
    };
  }

  /*
   * ==========================================================
   * 2. COMPLETE CURRENT TOURNAMENT BOUT
   * ==========================================================
   */

  currentTournamentMatch.status = 'COMPLETED';

  currentTournamentMatch.winner =
    winnerName ?? null;

  currentTournamentMatch.winnerClub =
    winnerClub ?? null;

  /*
   * ==========================================================
   * 3. FIND NEXT TOURNAMENT BOUT
   * ==========================================================
   */

  const nextMatchId =
    currentTournamentMatch.nextMatchId ?? null;

  if (nextMatchId) {
    for (const category of categories) {
      const matches = Array.isArray(category.matches)
        ? category.matches
        : [];

      const found = matches.find(
        (match) =>
          String(match.id) ===
          String(nextMatchId),
      );

      if (found) {
        nextTournamentMatch = found;
        break;
      }
    }
  }

  /*
   * ==========================================================
   * 4. ADVANCE WINNER TO NEXT BOUT
   * ==========================================================
   */

  if (
    nextTournamentMatch &&
    winnerName &&
    winnerName !== 'DRAW' &&
    winnerName !== 'NO_CONTEST'
  ) {
    advanceWinnerThroughBracket(
      categories,
      currentTournamentMatch,
      winnerName,
      winnerClub,
    );
  }

  /*
   * ==========================================================
   * 6. STRICT TOURNAMENT COMPLETION CHECK
   * ==========================================================
   *
   * IMPORTANT FIX:
   *
   * The tournament is COMPLETED only when:
   *
   * 1. Every category has matches.
   * 2. Every category has a FINAL.
   * 3. EVERY existing bracket match is COMPLETED.
   * 4. Every FINAL has a valid winner.
   *
   * Therefore:
   *
   * Bout 1 = COMPLETED
   * Bout 2 = UPCOMING
   * Bout 3 = UPCOMING
   *
   * CANNOT make the tournament COMPLETED.
   *
   * ==========================================================
   */

  let tournamentCompleted =
    categories.length > 0;

  for (const category of categories) {
    const matches = Array.isArray(category.matches)
      ? category.matches
      : [];

    /*
     * --------------------------------------------------------
     * No matches = category not completed.
     * --------------------------------------------------------
     */

    if (matches.length === 0) {
      tournamentCompleted = false;
      break;
    }

    /*
     * --------------------------------------------------------
     * FINAL MUST EXIST
     * --------------------------------------------------------
     */

    const finalMatches =
      matches.filter(
        (match) =>
          String(match.round ?? '')
            .toUpperCase() === 'FINAL',
      );

    if (finalMatches.length === 0) {
      tournamentCompleted = false;
      break;
    }

    /*
     * --------------------------------------------------------
     * EVERY EXISTING BOUT MUST BE COMPLETED
     * --------------------------------------------------------
     *
     * This is the main fix.
     *
     * If even ONE bout is:
     *
     * LOCKED
     * UPCOMING
     * LIVE
     *
     * then the tournament remains LIVE.
     * --------------------------------------------------------
     */

    const unfinishedMatches =
      matches.filter(
        (match) =>
          String(match.status ?? '')
            .toUpperCase() !== 'COMPLETED',
      );

    if (unfinishedMatches.length > 0) {
      tournamentCompleted = false;
      break;
    }

    /*
     * --------------------------------------------------------
     * FINAL MUST HAVE A WINNER
     * --------------------------------------------------------
     */

    const finalHasWinner =
      finalMatches.some(
        (match) =>
          String(match.status ?? '')
            .toUpperCase() === 'COMPLETED' &&
          Boolean(match.winner) &&
          String(match.winner)
            .toUpperCase() !== 'DRAW' &&
          String(match.winner)
            .toUpperCase() !== 'NO_CONTEST',
      );

    if (!finalHasWinner) {
      tournamentCompleted = false;
      break;
    }
  }

  /*
   * ==========================================================
   * 7. RETURN PROGRESSION RESULT
   * ==========================================================
   */

  return {
    tournamentData,
    currentTournamentMatch,
    nextTournamentMatch,
    tournamentCompleted,
  };
}

/*
 * ============================================================
 * START MATCH
 * POST /matches/:id/start
 * ============================================================
 */

router.post(
  '/:id/start',
  authenticateToken,
  requireRole('ADMIN', 'JUDGE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId = String(req.params.id);

      const match =
        await prisma.match.findUnique({
          where: {
            id: matchId,
          },
          include: {
            judges: true,
          },
        });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found',
        });
      }

      /*
       * If user is a judge, make sure the judge
       * is assigned to this match.
       */

      if (req.user?.role === 'JUDGE') {
        const judge =
          await prisma.judge.findUnique({
            where: {
              userId: req.user.userId,
            },
          });

        if (!judge) {
          return res.status(403).json({
            success: false,
            message:
              'Judge profile not found',
          });
        }

        const assigned =
          match.judges.some(
            (matchJudge) =>
              matchJudge.judgeId ===
              judge.id,
          );

        if (!assigned) {
          return res.status(403).json({
            success: false,
            message:
              'You are not assigned to this match',
          });
        }
      }

      /*
       * Completed match cannot be restarted.
       */

      if (match.status === 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message:
            'A completed match cannot be started again',
        });
      }

      /*
       * Cancelled match cannot be started.
       */

      if (match.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          message:
            'A cancelled match cannot be started',
        });
      }

      /*
       * Start the match.
       */

      const updatedMatch =
        await prisma.$transaction(
          async (tx) => {
            const started =
              await tx.match.update({
                where: {
                  id: matchId,
                },

                data: {
                  status: 'LIVE',

                  startedAt:
                    match.startedAt ??
                    new Date(),

                  currentRound:
                    Math.max(
                      1,
                      match.currentRound,
                    ),
                },

                include: {
                  redBoxer: true,
                  blueBoxer: true,

                  judges: {
                    include: {
                      judge: true,
                    },
                  },

                  scores: true,
                  result: true,
                },
              });

            /*
             * Starting any match makes its tournament LIVE.
             */

            if (match.tournamentId) {
              await tx.tournament.update({
                where: {
                  id: match.tournamentId,
                },

                data: {
                  status: 'LIVE',
                },
              });
            }

            return started;
          },
        );

      return res.json({
        success: true,

        message:
          'Match started successfully',

        match: updatedMatch,
      });
    } catch (error) {
      console.error(
        'Start match error:',
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          'Failed to start match',
      });
    }
  },
);

/*
 * ============================================================
 * SAVE ROUND SCORE
 * POST /matches/:id/round-score
 * ============================================================
 */

router.post(
  '/:id/round-score',
  authenticateToken,
  requireRole('ADMIN', 'JUDGE'),
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId = String(req.params.id);

      const {
        judgeId,
        roundNumber,
        redScore,
        blueScore,
        redKnockdowns = 0,
        blueKnockdowns = 0,
        redWarnings = 0,
        blueWarnings = 0,
        redFouls = 0,
        blueFouls = 0,
      } = req.body;

      const match =
        await prisma.match.findUnique({
          where: {
            id: matchId,
          },

          include: {
            judges: true,
          },
        });

      if (!match) {
        return res.status(404).json({
          success: false,
          message: 'Match not found',
        });
      }

      if (match.status === 'COMPLETED') {
        return res.status(400).json({
          success: false,

          message:
            'Scores cannot be changed after the match is completed',
        });
      }

      if (match.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,

          message:
            'Scores cannot be submitted for a cancelled match',
        });
      }

      /*
       * Determine judge submitting the score.
       */

      let databaseJudgeId:
        | string
        | null = null;

      if (req.user?.role === 'JUDGE') {
        const judge =
          await prisma.judge.findUnique({
            where: {
              userId: req.user.userId,
            },
          });

        if (!judge) {
          return res.status(403).json({
            success: false,

            message:
              'Judge profile not found',
          });
        }

        databaseJudgeId =
          judge.id;
      } else {
        databaseJudgeId =
          judgeId
            ? String(judgeId)
            : null;
      }

      if (!databaseJudgeId) {
        return res.status(400).json({
          success: false,

          message:
            'Judge ID is required',
        });
      }

      /*
       * Verify judge assignment.
       */

      const assignedJudge =
        match.judges.some(
          (matchJudge) =>
            matchJudge.judgeId ===
            databaseJudgeId,
        );

      if (!assignedJudge) {
        return res.status(403).json({
          success: false,

          message:
            'This judge is not assigned to the match',
        });
      }

      const round =
        Number(roundNumber);

      const red =
        Number(redScore);

      const blue =
        Number(blueScore);

      if (
        !Number.isInteger(round) ||
        round < 1
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Invalid round number',
        });
      }

      if (
        !Number.isInteger(red) ||
        !Number.isInteger(blue)
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Scores must be integers',
        });
      }

      if (
        red < 0 ||
        blue < 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Scores cannot be negative',
        });
      }

      if (round > match.rounds) {
        return res.status(400).json({
          success: false,

          message:
            `Round cannot be greater than ${match.rounds}`,
        });
      }

      const updateData: any = {
        redScore: red,
        blueScore: blue,
      };

      /*
       * Only overwrite event counters when
       * explicitly supplied.
       */

      if (
        redKnockdowns !== undefined
      ) {
        updateData.redKnockdowns =
          Number(redKnockdowns) || 0;
      }

      if (
        blueKnockdowns !== undefined
      ) {
        updateData.blueKnockdowns =
          Number(blueKnockdowns) || 0;
      }

      if (
        redWarnings !== undefined
      ) {
        updateData.redWarnings =
          Number(redWarnings) || 0;
      }

      if (
        blueWarnings !== undefined
      ) {
        updateData.blueWarnings =
          Number(blueWarnings) || 0;
      }

      if (
        redFouls !== undefined
      ) {
        updateData.redFouls =
          Number(redFouls) || 0;
      }

      if (
        blueFouls !== undefined
      ) {
        updateData.blueFouls =
          Number(blueFouls) || 0;
      }

      /*
       * Save round score.
       */

      const savedScore =
        await prisma.roundScore.upsert({
          where: {
            matchId_judgeId_roundNumber: {
              matchId,

              judgeId:
                databaseJudgeId,

              roundNumber:
                round,
            },
          },

          update:
            updateData,

          create: {
            matchId,

            judgeId:
              databaseJudgeId,

            roundNumber:
              round,

            redScore:
              red,

            blueScore:
              blue,

            redKnockdowns:
              Number(
                redKnockdowns,
              ) || 0,

            blueKnockdowns:
              Number(
                blueKnockdowns,
              ) || 0,

            redWarnings:
              Number(
                redWarnings,
              ) || 0,

            blueWarnings:
              Number(
                blueWarnings,
              ) || 0,

            redFouls:
              Number(
                redFouls,
              ) || 0,

            blueFouls:
              Number(
                blueFouls,
              ) || 0,
          },
        });

      /*
       * Keep match LIVE while scoring.
       */

      await prisma.match.update({
        where: {
          id: matchId,
        },

        data: {
          status: 'LIVE',

          currentRound:
            Math.min(
              round,
              match.rounds,
            ),
        },
      });

      return res.json({
        success: true,

        message:
          'Round score saved successfully',

        score:
          savedScore,
      });
    } catch (error) {
      console.error(
        'Save round score error:',
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          'Failed to save round score',
      });
    }
  },
);

/*
 * ============================================================
 * COMPLETE MATCH
 * POST /matches/:id/complete
 * ============================================================
 *
 * ADMIN ONLY
 *
 * Handles:
 *
 * - Official result
 * - Match completion
 * - Tournament bracket progression
 * - Winner advancement
 * - Next bout unlocking
 * - Tournament completion
 *
 * ============================================================
 */

router.post(
  '/:id/complete',
  authenticateToken,
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId =
        String(req.params.id);

      const {
        winnerId,
        loserId,
        redTotalScore,
        blueTotalScore,
        decision,
      } = req.body;

      /*
       * ========================================================
       * VALID DECISIONS
       * ========================================================
       */

      const validDecisions = [
        'POINTS',
        'UNANIMOUS_DECISION',
        'SPLIT_DECISION',
        'MAJORITY_DECISION',
        'KO',
        'TKO',
        'DISQUALIFICATION',
        'RETIREMENT',
        'DRAW',
        'NO_CONTEST',
      ];

      if (
        !decision ||
        !validDecisions.includes(
          String(decision),
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Invalid decision type',
        });
      }

      /*
       * ========================================================
       * FIND MATCH
       * ========================================================
       */

      const match =
        await prisma.match.findUnique({
          where: {
            id: matchId,
          },

          include: {
            redBoxer: true,
            blueBoxer: true,
          },
        });

      if (!match) {
        return res.status(404).json({
          success: false,

          message:
            'Match not found',
        });
      }

      /*
       * ========================================================
       * WINNER VALIDATION
       * ========================================================
       */

      if (
        winnerId &&
        winnerId !== match.redBoxerId &&
        winnerId !== match.blueBoxerId
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Winner does not belong to this match',
        });
      }

      /*
       * ========================================================
       * LOSER VALIDATION
       * ========================================================
       */

      if (
        loserId &&
        loserId !== match.redBoxerId &&
        loserId !== match.blueBoxerId
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Loser does not belong to this match',
        });
      }

      /*
       * Winner and loser cannot be the same.
       */

      if (
        winnerId &&
        loserId &&
        String(winnerId) ===
          String(loserId)
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Winner and loser cannot be the same boxer',
        });
      }

      /*
       * ========================================================
       * SCORE VALIDATION
       * ========================================================
       */

      const redTotal =
        Number(redTotalScore);

      const blueTotal =
        Number(blueTotalScore);

      if (
        !Number.isInteger(redTotal) ||
        !Number.isInteger(blueTotal)
      ) {
        return res.status(400).json({
          success: false,

          message:
            'Total scores must be integers',
        });
      }

      /*
       * ========================================================
       * TRANSACTION
       * ========================================================
       */

      const result =
        await prisma.$transaction(
          async (tx) => {
            /*
             * ==================================================
             * 1. SAVE OFFICIAL MATCH RESULT
             * ==================================================
             */

            const matchResult =
              await tx.matchResult.upsert({
                where: {
                  matchId,
                },

                update: {
                  winnerId:
                    winnerId || null,

                  loserId:
                    loserId || null,

                  redTotalScore:
                    redTotal,

                  blueTotalScore:
                    blueTotal,

                  decision,
                },

                create: {
                  matchId,

                  winnerId:
                    winnerId || null,

                  loserId:
                    loserId || null,

                  redTotalScore:
                    redTotal,

                  blueTotalScore:
                    blueTotal,

                  decision,
                },
              });

            /*
             * ==================================================
             * 2. MARK POSTGRESQL MATCH COMPLETED
             * ==================================================
             */

            const updatedMatch =
              await tx.match.update({
                where: {
                  id: matchId,
                },

                data: {
                  status:
                    'COMPLETED',

                  winnerId:
                    winnerId || null,

                  completedAt:
                    new Date(),

                  currentRound:
                    match.rounds,
                },

                include: {
                  redBoxer: true,

                  blueBoxer: true,

                  judges: {
                    include: {
                      judge: true,
                    },
                  },

                  scores: true,

                  result: true,
                },
              });

            /*
             * ==================================================
             * 3. TOURNAMENT BRACKET PROGRESSION
             * ==================================================
             */

            let updatedTournament:
              any = null;

            let advancedWinner =
              false;

            let nextBoutUnlocked =
              false;

            let tournamentCompleted =
              false;

            if (match.tournamentId) {
              /*
               * Get tournament.
               */

              const tournament =
                await tx.tournament.findUnique({
                  where: {
                    id:
                      match.tournamentId,
                  },
                });

              if (tournament) {
                const tournamentData =
                  tournament.data;

                /*
                 * =================================================
                 * FIND WINNER NAME AND CLUB
                 * =================================================
                 */

                let winnerName:
                  | string
                  | null = null;

                let winnerClub:
                  | string
                  | null = null;

                if (
                  winnerId &&
                  String(winnerId) ===
                    String(
                      match.redBoxerId,
                    )
                ) {
                  winnerName =
                    match.redBoxer?.name ??
                    null;

                  winnerClub =
                    match.redBoxer?.club ??
                    null;
                } else if (
                  winnerId &&
                  String(winnerId) ===
                    String(
                      match.blueBoxerId,
                    )
                ) {
                  winnerName =
                    match.blueBoxer?.name ??
                    null;

                  winnerClub =
                    match.blueBoxer?.club ??
                    null;
                }

                /*
                 * DRAW and NO_CONTEST have no advancing winner.
                 */

                if (
                  String(decision) ===
                    'DRAW' ||
                  String(decision) ===
                    'NO_CONTEST'
                ) {
                  winnerName = null;
                  winnerClub = null;
                }

                /*
                 * =================================================
                 * CLONE TOURNAMENT DATA
                 * =================================================
                 */

                const clonedTournamentData =
                  tournamentData &&
                  typeof tournamentData ===
                    'object'
                    ? JSON.parse(
                        JSON.stringify(
                          tournamentData,
                        ),
                      )
                    : tournamentData;

                /*
                 * =================================================
                 * ADVANCE WINNER
                 * =================================================
                 */

                const progression =
                  advanceTournamentWinner(
                    clonedTournamentData,

                    matchId,

                    winnerName,

                    winnerClub,
                  );

                /*
                 * Did we find the tournament bout?
                 */

                advancedWinner =
                  Boolean(
                    progression
                      .currentTournamentMatch,
                  );

                /*
                 * Did next bout become UPCOMING?
                 */

                if (
                  progression
                    .nextTournamentMatch
                    ?.status ===
                    'UPCOMING'
                ) {
                  nextBoutUnlocked = true;
                }

                /*
                 * Final tournament completion status.
                 */

                tournamentCompleted =
                  progression
                    .tournamentCompleted;

                /*
                 * =================================================
                 * SAVE BRACKET
                 * =================================================
                 */

                const tournamentUpdateData:
                  any = {
                    data:
                      progression.tournamentData,
                  };

                /*
                 * =================================================
                 * TOURNAMENT STATUS
                 * =================================================
                 *
                 * COMPLETED ONLY when the strict completion
                 * check returns true.
                 *
                 * Otherwise it stays LIVE.
                 *
                 * This prevents:
                 *
                 * Bout 1 = COMPLETED
                 * Bout 2 = UPCOMING
                 *
                 * from closing the tournament.
                 */

                if (
                  tournamentCompleted
                ) {
                  tournamentUpdateData.status =
                    'COMPLETED';
                } else {
                  tournamentUpdateData.status =
                    'LIVE';
                }

                /*
                 * =================================================
                 * UPDATE TOURNAMENT
                 * =================================================
                 */

                updatedTournament =
                  await tx.tournament.update({
                    where: {
                      id:
                        match.tournamentId,
                    },

                    data:
                      tournamentUpdateData,
                  });
              }
            }

            return {
              match:
                updatedMatch,

              result:
                matchResult,

              tournament:
                updatedTournament,

              advancedWinner,

              nextBoutUnlocked,

              tournamentCompleted,
            };
          },
        );

      /*
       * ========================================================
       * RESPONSE
       * ========================================================
       */

      return res.json({
        success: true,

        message:
          'Match completed successfully',

        match:
          result.match,

        result:
          result.result,

        tournament:
          result.tournament,

        bracketProgression: {
          winnerAdvanced:
            result.advancedWinner,

          nextBoutUnlocked:
            result.nextBoutUnlocked,

          tournamentCompleted:
            result.tournamentCompleted,
        },
      });
    } catch (error) {
      console.error(
        'Complete match error:',
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          'Failed to complete match',
      });
    }
  },
);

export default router;