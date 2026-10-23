import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import prisma from './lib/prisma';

import authRouter from './routes/auth';
import protectedRouter from './routes/protected';
import boxerRouter from './routes/boxers';
import tournamentRouter from './routes/tournaments';
import matchRouter from './routes/matches';
import matchHistoryRouter from './routes/matchHistory';
import judgeRouter from './routes/judges';
import scoringRouter from './routes/scoring';

const app = express();

const PORT = Number(process.env.PORT ?? 5000);
const HOST = '0.0.0.0';

app.use(cors());
app.use(
  express.json({
    limit: '10mb',
  }),
);
// ===============================
// API ROUTES
// ===============================

app.use('/auth', authRouter);

app.use('/protected', protectedRouter);

app.use('/boxers', boxerRouter);

app.use('/tournaments', tournamentRouter);

// ===============================
// MATCH ROUTES
// ===============================

// Match history routes MUST come before
// the general match routes because matchRouter
// may contain routes such as /:id.
app.use('/matches', matchHistoryRouter);

app.use('/matches', matchRouter);

// Scoring routes
app.use('/matches', scoringRouter);

app.use('/judges', judgeRouter);

// ===============================
// ROOT
// ===============================

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Boxing Scoring System API is running',
  });
});

// ===============================
// HEALTH CHECK
// ===============================

app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Boxing Scoring System API is healthy',
  });
});

// ===============================
// DATABASE HEALTH CHECK
// ===============================

app.get('/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      message: 'PostgreSQL database connection is working',
    });
  } catch (error) {
    console.error('Database connection error:', error);

    res.status(500).json({
      success: false,
      message: 'Database connection failed',
    });
  }
});

// ===============================
// START SERVER
// ===============================

const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`LAN:   http://<YOUR-PC-IP>:${PORT}`);
});

// ===============================
// SERVER ERROR
// ===============================

server.on('error', (error) => {
  console.error('Server startup error:', error);
});

// ===============================
// GRACEFUL SHUTDOWN
// ===============================

async function shutdown() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Prisma disconnect error:', error);
  } finally {
    server.close(() => {
      process.exit(0);
    });
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);