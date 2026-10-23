import { Router } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from '../middleware/auth';

const router = Router();

router.use(authenticateToken);
router.use(requireRole('ADMIN'));

const DEFAULT_JUDGE_PASSWORD = 'Judge@12345';

// GET /judges
router.get('/', async (_req: AuthRequest, res) => {
  try {
    const judges = await prisma.judge.findMany({
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        matchJudges: {
          select: {
            matchId: true,
          },
        },
      },
    });

    res.json({
      success: true,
      judges: judges.map((judge) => ({
        ...judge,
        matches: judge.matchJudges.length,
      })),
    });
  } catch (error) {
    console.error('Get judges error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch judges',
    });
  }
});

// GET /judges/:id
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const judgeId = String(req.params.id);

    const judge = await prisma.judge.findUnique({
      where: {
        id: judgeId,
      },
      include: {
        matchJudges: {
          select: {
            matchId: true,
          },
        },
      },
    });

    if (!judge) {
      return res.status(404).json({
        success: false,
        message: 'Judge not found',
      });
    }

    res.json({
      success: true,
      judge: {
        ...judge,
        matches: judge.matchJudges.length,
      },
    });
  } catch (error) {
    console.error('Get judge error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch judge',
    });
  }
});

// POST /judges
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      judgeId,
      name,
      email,
      status,
      password,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const existingEmail = await prisma.judge.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        message: 'A judge with this email already exists',
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user account with this email already exists',
      });
    }

    let finalJudgeId = judgeId
      ? String(judgeId).trim().toUpperCase()
      : '';

    if (!finalJudgeId) {
      const lastJudge = await prisma.judge.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
      });

      let nextNumber = 1;

      if (lastJudge) {
        const match = lastJudge.judgeId.match(/^JG(\d+)$/);

        if (match) {
          nextNumber = Number(match[1]) + 1;
        }
      }

      finalJudgeId = `JG${String(nextNumber).padStart(3, '0')}`;
    }

    const existingJudgeId = await prisma.judge.findUnique({
      where: {
        judgeId: finalJudgeId,
      },
    });

    if (existingJudgeId) {
      return res.status(409).json({
        success: false,
        message: 'A judge with this Judge ID already exists',
      });
    }

    const finalStatus =
      status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const finalPassword =
      typeof password === 'string' && password.trim().length >= 8
        ? password.trim()
        : DEFAULT_JUDGE_PASSWORD;

    const passwordHash = await bcrypt.hash(
      finalPassword,
      12,
    );

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          role: 'JUDGE',
          status: finalStatus,
        },
      });

      const judge = await tx.judge.create({
        data: {
          judgeId: finalJudgeId,
          name: String(name).trim(),
          email: normalizedEmail,
          status: finalStatus,
          userId: user.id,
        },
      });

      return { judge, user };
    });

    res.status(201).json({
      success: true,
      message: 'Judge created successfully',
      judge: {
        ...result.judge,
        matches: 0,
      },
      login: {
        email: result.user.email,
        temporaryPassword:
          password ? undefined : DEFAULT_JUDGE_PASSWORD,
      },
    });
  } catch (error) {
    console.error('Create judge error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to create judge',
    });
  }
});

// PUT /judges/:id
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const judgeId = String(req.params.id);
    const { name, email, status, password } = req.body;

    const existingJudge = await prisma.judge.findUnique({
      where: {
        id: judgeId,
      },
    });

    if (!existingJudge) {
      return res.status(404).json({
        success: false,
        message: 'Judge not found',
      });
    }

    const normalizedEmail = email
      ? String(email).trim().toLowerCase()
      : existingJudge.email;

    if (normalizedEmail !== existingJudge.email) {
      const emailTaken = await prisma.judge.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

      const userEmailTaken = await prisma.user.findUnique({
        where: {
          email: normalizedEmail,
        },
      });

      if (emailTaken || userEmailTaken) {
        return res.status(409).json({
          success: false,
          message: 'Another account already uses this email',
        });
      }
    }

    const finalStatus =
      status === undefined
        ? existingJudge.status
        : status === 'INACTIVE'
          ? 'INACTIVE'
          : 'ACTIVE';

    const result = await prisma.$transaction(async (tx) => {
      const judge = await tx.judge.update({
        where: {
          id: judgeId,
        },
        data: {
          ...(name !== undefined && {
            name: String(name).trim(),
          }),
          ...(email !== undefined && {
            email: normalizedEmail,
          }),
          ...(status !== undefined && {
            status: finalStatus,
          }),
        },
      });

      if (existingJudge.userId) {
        await tx.user.update({
          where: {
            id: existingJudge.userId,
          },
          data: {
            ...(email !== undefined && {
              email: normalizedEmail,
            }),
            ...(status !== undefined && {
              status: finalStatus,
            }),
            ...(typeof password === 'string' &&
              password.trim().length >= 8 && {
                passwordHash: await bcrypt.hash(
                  password.trim(),
                  12,
                ),
              }),
          },
        });
      }

      return judge;
    });

    res.json({
      success: true,
      message: 'Judge updated successfully',
      judge: result,
    });
  } catch (error) {
    console.error('Update judge error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update judge',
    });
  }
});

// DELETE /judges/:id
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const judgeId = String(req.params.id);

    const existingJudge = await prisma.judge.findUnique({
      where: {
        id: judgeId,
      },
      include: {
        matchJudges: true,
      },
    });

    if (!existingJudge) {
      return res.status(404).json({
        success: false,
        message: 'Judge not found',
      });
    }

    if (existingJudge.matchJudges.length > 0) {
      return res.status(400).json({
        success: false,
        message:
          'This judge cannot be deleted because they are assigned to matches. Set the judge to INACTIVE instead.',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.judge.delete({
        where: {
          id: judgeId,
        },
      });

      if (existingJudge.userId) {
        await tx.user.delete({
          where: {
            id: existingJudge.userId,
          },
        });
      }
    });

    res.json({
      success: true,
      message: 'Judge deleted successfully',
    });
  } catch (error) {
    console.error('Delete judge error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to delete judge',
    });
  }
});

export default router;
