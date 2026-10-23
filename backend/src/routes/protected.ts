import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/profile', authenticateToken, (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    message: 'Protected route accessed successfully',
    user: req.user,
  });
});

export default router;