import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import {
  authenticateToken,
  AuthRequest,
  requireRole,
} from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('ADMIN'));

function getId(req: AuthRequest): string {
  const { id } = req.params;

  if (Array.isArray(id)) {
    return id[0];
  }

  return id;
}

// ============================================
// CREATE TOURNAMENT
// ============================================

router.post(
  '/',
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        date,
        venue,
        status,
        boxerIds,
        tournamentData,
      } = req.body;

      if (!name || !String(name).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Tournament name is required',
        });
      }

      const tournamentStatus =
        status === 'LIVE' ||
        status === 'COMPLETED' ||
        status === 'CANCELLED'
          ? status
          : 'UPCOMING';

      const boxerIdList = Array.isArray(boxerIds)
        ? boxerIds.filter(
            (id: unknown): id is string =>
              typeof id === 'string' &&
              id.trim().length > 0,
          )
        : [];

      // Validate boxer IDs if supplied.
      if (boxerIdList.length > 0) {
        const existingBoxers =
          await prisma.boxer.findMany({
            where: {
              id: {
                in: boxerIdList,
              },
            },
            select: {
              id: true,
            },
          });

        const existingIds = new Set(
          existingBoxers.map(
            (boxer) => boxer.id,
          ),
        );

        const missingIds = boxerIdList.filter(
          (id) => !existingIds.has(id),
        );

        if (missingIds.length > 0) {
          return res.status(400).json({
            success: false,
            message:
              'One or more boxer IDs are invalid',
          });
        }
      }

      const tournament =
        await prisma.tournament.create({
          data: {
            name: String(name).trim(),

            ...(date
              ? {
                  date: new Date(date),
                }
              : {}),

            ...(venue
              ? {
                  venue: String(venue).trim(),
                }
              : {}),

            status: tournamentStatus,

            // Store the complete frontend
            // tournament object as JSON.
            ...(tournamentData !== undefined
              ? {
                  data: tournamentData,
                }
              : {}),

            ...(boxerIdList.length > 0
              ? {
                  boxers: {
                    create: boxerIdList.map(
                      (boxerId) => ({
                        boxer: {
                          connect: {
                            id: boxerId,
                          },
                        },
                      }),
                    ),
                  },
                }
              : {}),
          },

          include: {
            boxers: {
              include: {
                boxer: true,
              },
            },

            matches: {
              include: {
                redBoxer: true,
                blueBoxer: true,
                result: true,
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
              },

              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });

      return res.status(201).json({
        success: true,
        message:
          'Tournament created successfully',
        tournament,
      });
    } catch (error) {
      console.error(
        'Create tournament error:',
        error,
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to create tournament',
      });
    }
  },
);

// ============================================
// GET ALL TOURNAMENTS
// ============================================

router.get(
  '/',
  async (_req: AuthRequest, res: Response) => {
    try {
      const tournaments =
        await prisma.tournament.findMany({
          orderBy: {
            createdAt: 'desc',
          },

          include: {
            boxers: {
              include: {
                boxer: true,
              },
            },

            matches: {
              include: {
                redBoxer: true,
                blueBoxer: true,
                result: true,

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
              },

              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });

      return res.json({
        success: true,
        tournaments,
      });
    } catch (error) {
      console.error(
        'Get tournaments error:',
        error,
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tournaments',
      });
    }
  },
);

// ============================================
// GET SINGLE TOURNAMENT
// ============================================

router.get(
  '/:id',
  async (req: AuthRequest, res: Response) => {
    try {
      const tournamentId = getId(req);

      const tournament =
        await prisma.tournament.findUnique({
          where: {
            id: tournamentId,
          },

          include: {
            boxers: {
              include: {
                boxer: true,
              },
            },

            matches: {
              include: {
                redBoxer: true,
                blueBoxer: true,
                result: true,

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
              },

              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });

      if (!tournament) {
        return res.status(404).json({
          success: false,
          message: 'Tournament not found',
        });
      }

      return res.json({
        success: true,
        tournament,
      });
    } catch (error) {
      console.error(
        'Get tournament error:',
        error,
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch tournament',
      });
    }
  },
);

// ============================================
// UPDATE TOURNAMENT
// ============================================

router.put(
  '/:id',
  async (req: AuthRequest, res: Response) => {
    try {
      const tournamentId = getId(req);

      const {
        name,
        date,
        venue,
        status,
        tournamentData,
      } = req.body;

      const existingTournament =
        await prisma.tournament.findUnique({
          where: {
            id: tournamentId,
          },
        });

      if (!existingTournament) {
        return res.status(404).json({
          success: false,
          message: 'Tournament not found',
        });
      }

      const updatedTournament =
        await prisma.tournament.update({
          where: {
            id: tournamentId,
          },

          data: {
            ...(name !== undefined && {
              name: String(name).trim(),
            }),

            ...(date !== undefined && {
              date: date
                ? new Date(date)
                : null,
            }),

            ...(venue !== undefined && {
              venue: venue
                ? String(venue).trim()
                : null,
            }),

            ...(status !== undefined && {
              status:
                status === 'LIVE'
                  ? 'LIVE'
                  : status === 'COMPLETED'
                    ? 'COMPLETED'
                    : status === 'CANCELLED'
                      ? 'CANCELLED'
                      : 'UPCOMING',
            }),

            ...(tournamentData !== undefined && {
              data: tournamentData,
            }),
          },

          include: {
            boxers: {
              include: {
                boxer: true,
              },
            },

            matches: {
              include: {
                redBoxer: true,
                blueBoxer: true,
                result: true,

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
              },

              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });

      return res.json({
        success: true,
        message:
          'Tournament updated successfully',
        tournament: updatedTournament,
      });
    } catch (error) {
      console.error(
        'Update tournament error:',
        error,
      );

      return res.status(500).json({
        success: false,
        message: 'Failed to update tournament',
      });
    }
  },
);

// ============================================
// DELETE TOURNAMENT
// ============================================

router.delete(
  '/:id',
  async (req: AuthRequest, res: Response) => {
    try {
      const tournamentId = getId(req);

      const existingTournament =
        await prisma.tournament.findUnique({
          where: {
            id: tournamentId,
          },
        });

      if (!existingTournament) {
        return res.status(404).json({
          success: false,
          message: 'Tournament not found',
        });
      }

      await prisma.tournament.delete({
        where: {
          id: tournamentId,
        },
      });

      return res.json({
        success: true,
        message:
          'Tournament deleted successfully',
      });
    } catch (error) {
      console.error(
        'Delete tournament error:',
        error,
      );

      return res.status(500).json({
        success: false,
        message:
          'Failed to delete tournament',
      });
    }
  },
);

export default router;