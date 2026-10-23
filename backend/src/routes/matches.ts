import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import {
  authenticateToken,
  AuthRequest,
  requireRole,
} from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

/*
  CREATE MATCH
  POST /matches
  Admin only.
*/
router.post(
  '/',
  requireRole('ADMIN'),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        tournamentId,
        redBoxerId,
        blueBoxerId,
        weightCategory,
        rounds,
        matchType,
        judgeIds,
      } = req.body;

      // -----------------------------
      // BASIC VALIDATION
      // -----------------------------

      if (
        !redBoxerId ||
        !blueBoxerId ||
        !weightCategory ||
        !matchType
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Red boxer, blue boxer, weight category and match type are required',
        });
      }

      if (redBoxerId === blueBoxerId) {
        return res.status(400).json({
          success: false,
          message:
            'Red boxer and blue boxer cannot be the same',
        });
      }

      // -----------------------------
      // ROUND VALIDATION
      // -----------------------------

      const roundCount = Number(rounds);

      const validRounds = [
        3,
        4,
        6,
        8,
        10,
        12,
      ];

      if (!validRounds.includes(roundCount)) {
        return res.status(400).json({
          success: false,
          message:
            'Rounds must be one of: 3, 4, 6, 8, 10 or 12',
        });
      }

      // -----------------------------
      // JUDGE VALIDATION
      // -----------------------------

      if (!Array.isArray(judgeIds)) {
        return res.status(400).json({
          success: false,
          message:
            'Exactly 4 judges are required',
        });
      }

      if (judgeIds.length !== 4) {
        return res.status(400).json({
          success: false,
          message:
            'Exactly 4 judges must be assigned to a match',
        });
      }

      const normalizedJudgeIds = judgeIds.map(
        (id: unknown) => String(id),
      );

      const uniqueJudgeIds = new Set(
        normalizedJudgeIds,
      );

      if (uniqueJudgeIds.size !== 4) {
        return res.status(400).json({
          success: false,
          message:
            'The same judge cannot be assigned more than once',
        });
      }

      // -----------------------------
      // FIND JUDGES
      // -----------------------------

      const judges = await prisma.judge.findMany({
        where: {
          id: {
            in: normalizedJudgeIds,
          },
        },
      });

      if (judges.length !== 4) {
        return res.status(404).json({
          success: false,
          message:
            'One or more selected judges were not found',
        });
      }

      // -----------------------------
      // CHECK JUDGE STATUS
      // -----------------------------

      const inactiveJudge = judges.find(
        (judge) => judge.status !== 'ACTIVE',
      );

      if (inactiveJudge) {
        return res.status(400).json({
          success: false,
          message:
            `${inactiveJudge.name} is inactive and cannot be assigned to a match`,
        });
      }

      // -----------------------------
      // FIND RED BOXER
      // -----------------------------

      const redBoxer =
        await prisma.boxer.findUnique({
          where: {
            id: String(redBoxerId),
          },
        });

      if (!redBoxer) {
        return res.status(404).json({
          success: false,
          message: 'Red boxer not found',
        });
      }

      // -----------------------------
      // FIND BLUE BOXER
      // -----------------------------

      const blueBoxer =
        await prisma.boxer.findUnique({
          where: {
            id: String(blueBoxerId),
          },
        });

      if (!blueBoxer) {
        return res.status(404).json({
          success: false,
          message: 'Blue boxer not found',
        });
      }

      // -----------------------------
      // CHECK BOXER STATUS
      // -----------------------------

      if (redBoxer.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message:
            `${redBoxer.name} is not active`,
        });
      }

      if (blueBoxer.status !== 'ACTIVE') {
        return res.status(400).json({
          success: false,
          message:
            `${blueBoxer.name} is not active`,
        });
      }

      // -----------------------------
      // TOURNAMENT VALIDATION
      // -----------------------------

      if (tournamentId) {
        const tournament =
          await prisma.tournament.findUnique({
            where: {
              id: String(tournamentId),
            },

            include: {
              boxers: {
                select: {
                  boxerId: true,
                },
              },
            },
          });

        if (!tournament) {
          return res.status(404).json({
            success: false,
            message:
              'Tournament not found',
          });
        }

        if (
          tournament.status === 'COMPLETED' ||
          tournament.status === 'CANCELLED'
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Cannot create a match in a completed or cancelled tournament',
          });
        }

        // Check that both boxers belong
        // to the tournament

        const tournamentBoxerIds =
          new Set(
            tournament.boxers.map(
              (entry) => entry.boxerId,
            ),
          );

        if (
          !tournamentBoxerIds.has(
            redBoxer.id,
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Red boxer is not registered in this tournament',
          });
        }

        if (
          !tournamentBoxerIds.has(
            blueBoxer.id,
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Blue boxer is not registered in this tournament',
          });
        }
      }

      // -----------------------------
      // CREATE MATCH + ASSIGN JUDGES
      // -----------------------------

      const match =
        await prisma.$transaction(
          async (tx) => {
            const createdMatch =
              await tx.match.create({
                data: {
                  ...(tournamentId
                    ? {
                        tournament: {
                          connect: {
                            id: String(
                              tournamentId,
                            ),
                          },
                        },
                      }
                    : {}),

                  redBoxer: {
                    connect: {
                      id: redBoxer.id,
                    },
                  },

                  blueBoxer: {
                    connect: {
                      id: blueBoxer.id,
                    },
                  },

                  weightCategory:
                    String(
                      weightCategory,
                    ).trim(),

                  rounds: roundCount,

                  matchType:
                    String(
                      matchType,
                    ).trim(),

                  status: 'UPCOMING',

                  currentRound: 1,
                },
              });

            // Assign the 4 judges
            await tx.matchJudge.createMany({
              data: normalizedJudgeIds.map(
                (judgeId) => ({
                  matchId:
                    createdMatch.id,
                  judgeId,
                }),
              ),
            });

            return createdMatch;
          },
        );

      // -----------------------------
      // FETCH COMPLETE MATCH
      // -----------------------------

      const completeMatch =
        await prisma.match.findUnique({
          where: {
            id: match.id,
          },

          include: {
            tournament: true,

            redBoxer: true,

            blueBoxer: true,

            judges: {
              include: {
                judge: true,
              },
            },

            scores: {
              orderBy: {
                roundNumber: 'asc',
              },
            },

            result: true,
          },
        });

      return res.status(201).json({
        success: true,

        message:
          'Match created and 4 judges assigned successfully',

        match: completeMatch,
      });
    } catch (error) {
      console.error(
        'Create match error:',
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to create match',
      });
    }
  },
);

/*
  GET ALL / ASSIGNED MATCHES
  GET /matches

  Admins receive all matches.
  Judges receive only matches assigned to their judge profile.
*/
router.get(
  '/',
  requireRole('ADMIN', 'JUDGE'),
  async (req: AuthRequest, res: Response) => {
    try {
      let judgeId: string | undefined;

      if (req.user?.role === 'JUDGE') {
        const judge = await prisma.judge.findUnique({
          where: {
            userId: req.user.userId,
          },
        });

        if (!judge) {
          return res.status(403).json({
            success: false,
            message: 'Judge profile not found',
          });
        }

        judgeId = judge.id;
      }

      const matches = await prisma.match.findMany({
        where: judgeId
          ? {
              judges: {
                some: {
                  judgeId,
                },
              },
            }
          : undefined,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          tournament: true,
          redBoxer: true,
          blueBoxer: true,
          judges: {
            include: {
              judge: true,
            },
          },
          result: true,
        },
      });

      return res.json({
        success: true,
        matches,
      });
    } catch (error) {
      console.error('Get matches error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch matches',
      });
    }
  },
);

/*
  GET SINGLE MATCH
  GET /matches/:id
*/
router.get(
  '/:id',
  requireRole('ADMIN', 'JUDGE'),
  async (
    req: AuthRequest,
    res: Response,
  ) => {
    try {
      const matchId =
        Array.isArray(req.params.id)
          ? req.params.id[0]
          : req.params.id;

      const match =
        await prisma.match.findUnique({
          where: {
            id: matchId,
          },

          include: {
            tournament: true,

            redBoxer: true,

            blueBoxer: true,

            judges: {
              include: {
                judge: true,
              },
            },

            scores: {
              orderBy: {
                roundNumber: 'asc',
              },
            },

            result: true,
          },
        });

      if (!match) {
        return res.status(404).json({
          success: false,
          message:
            'Match not found',
        });
      }

      if (req.user?.role === 'JUDGE') {
        const judge = await prisma.judge.findUnique({
          where: {
            userId: req.user.userId,
          },
        });

        if (!judge) {
          return res.status(403).json({
            success: false,
            message: 'Judge profile not found',
          });
        }

        const assigned = match.judges.some(
          (matchJudge) => matchJudge.judgeId === judge.id,
        );

        if (!assigned) {
          return res.status(403).json({
            success: false,
            message: 'You are not assigned to this match',
          });
        }
      }

      return res.json({
        success: true,
        match,
      });
    } catch (error) {
      console.error(
        'Get match error:',
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to fetch match',
      });
    }
  },
);

export default router;