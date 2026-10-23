import { randomUUID } from 'crypto';
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

// FIND BOXER BY DATABASE ID OR BOXER ID
async function findBoxerByIdOrBoxerId(identifier: string) {
  const boxer = await prisma.boxer.findUnique({
    where: {
      id: identifier,
    },
  });

  if (boxer) {
    return boxer;
  }

  return prisma.boxer.findUnique({
    where: {
      boxerId: identifier,
    },
  });
}

// CREATE BOXER
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      boxerId,
      name,
      dateOfBirth,
      weight,
      club,
      coach,
      stance,
    } = req.body;

    // boxerId is NOT required from the frontend.
    // The backend will generate one automatically.
    if (
      !name ||
      !dateOfBirth ||
      weight === undefined ||
      !club ||
      !coach ||
      !stance
    ) {
      return res.status(400).json({
        success: false,
        message: 'All boxer details are required',
      });
    }

    const requestedBoxerId =
      typeof boxerId === 'string'
        ? boxerId.trim()
        : boxerId !== undefined && boxerId !== null
          ? String(boxerId).trim()
          : '';

    const finalBoxerId =
      requestedBoxerId ||
      `BOX-${randomUUID()
        .replace(/-/g, '')
        .slice(0, 8)
        .toUpperCase()}`;

    const existingBoxer = await prisma.boxer.findUnique({
      where: {
        boxerId: finalBoxerId,
      },
    });

    if (existingBoxer) {
      return res.status(409).json({
        success: false,
        message: 'Boxer ID already exists',
      });
    }

    const boxer = await prisma.boxer.create({
      data: {
        boxerId: finalBoxerId,
        name: String(name).trim(),
        dateOfBirth: new Date(dateOfBirth),
        weight: Number(weight),
        club: String(club).trim(),
        coach: String(coach).trim(),
        stance: String(stance).trim(),
        status: 'ACTIVE',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Boxer created successfully',
      boxer,
    });
  } catch (error) {
    console.error('Create boxer error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create boxer',
    });
  }
});

// GET ALL BOXERS
router.get(
  '/',
  async (_req: AuthRequest, res: Response) => {
    try {
      const boxers = await prisma.boxer.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      res.json({
        success: true,
        boxers,
      });
    } catch (error) {
      console.error('Get boxers error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to fetch boxers',
      });
    }
  },
);

// GET SINGLE BOXER
router.get(
  '/:id',
  async (req: AuthRequest, res: Response) => {
    try {
      const identifier = getId(req);

      const boxer =
        await findBoxerByIdOrBoxerId(identifier);

      if (!boxer) {
        return res.status(404).json({
          success: false,
          message: 'Boxer not found',
        });
      }

      res.json({
        success: true,
        boxer,
      });
    } catch (error) {
      console.error('Get boxer error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to fetch boxer',
      });
    }
  },
);

// UPDATE BOXER
router.put(
  '/:id',
  async (req: AuthRequest, res: Response) => {
    try {
      const identifier = getId(req);

      const {
        name,
        dateOfBirth,
        weight,
        club,
        coach,
        stance,
        status,
      } = req.body;

      // Find using either database ID or boxerId
      const existingBoxer =
        await findBoxerByIdOrBoxerId(identifier);

      if (!existingBoxer) {
        return res.status(404).json({
          success: false,
          message: 'Boxer not found',
        });
      }

      const boxer =
        await prisma.boxer.update({
          where: {
            id: existingBoxer.id,
          },
          data: {
            ...(name !== undefined && {
              name: String(name).trim(),
            }),

            ...(dateOfBirth !== undefined && {
              dateOfBirth: new Date(dateOfBirth),
            }),

            ...(weight !== undefined && {
              weight: Number(weight),
            }),

            ...(club !== undefined && {
              club: String(club).trim(),
            }),

            ...(coach !== undefined && {
              coach: String(coach).trim(),
            }),

            ...(stance !== undefined && {
              stance: String(stance).trim(),
            }),

            ...(status !== undefined && {
              status:
                status === 'INACTIVE'
                  ? 'INACTIVE'
                  : 'ACTIVE',
            }),
          },
        });

      res.json({
        success: true,
        message: 'Boxer updated successfully',
        boxer,
      });
    } catch (error) {
      console.error('Update boxer error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to update boxer',
      });
    }
  },
);

// DELETE BOXER
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response) => {
    try {
      const identifier = getId(req);

      // Find using either database ID or boxerId
      const existingBoxer =
        await findBoxerByIdOrBoxerId(identifier);

      if (!existingBoxer) {
        return res.status(404).json({
          success: false,
          message: 'Boxer not found',
        });
      }

      await prisma.boxer.delete({
        where: {
          id: existingBoxer.id,
        },
      });

      res.json({
        success: true,
        message: 'Boxer deleted successfully',
      });
    } catch (error) {
      console.error('Delete boxer error:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to delete boxer',
      });
    }
  },
);

export default router;