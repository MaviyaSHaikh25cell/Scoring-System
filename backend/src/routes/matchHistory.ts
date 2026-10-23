import { Router, Response } from 'express';
import prisma from '../lib/prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /matches/history
 *
 * Returns completed matches with:
 * - Boxer details
 * - Tournament details
 * - Judges
 * - Final result
 * - Round-by-round scores
 */
router.get(
  '/history',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const matches = await prisma.match.findMany({
        where: {
          status: 'COMPLETED',
        },
        orderBy: {
          completedAt: 'desc',
        },
        include: {
          redBoxer: true,
          blueBoxer: true,
          tournament: true,
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

      res.json({
        success: true,
        count: matches.length,
        matches,
      });
    } catch (error) {
      console.error('Error fetching match history:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to fetch match history',
      });
    }
  }
);

/**
 * GET /matches/history/:id
 *
 * Returns complete details of one completed match.
 */
router.get(
  '/history/:id',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;
      const match = await prisma.match.findUnique({
        where: {
          id,
        },
        include: {
          redBoxer: true,
          blueBoxer: true,
          tournament: true,
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
          message: 'Match not found',
        });
      }

      res.json({
        success: true,
        match,
      });
    } catch (error) {
      console.error('Error fetching match details:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to fetch match details',
      });
    }
  }
);

export default router;