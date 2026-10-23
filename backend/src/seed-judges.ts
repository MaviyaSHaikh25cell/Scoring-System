import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from './lib/prisma';

const DEFAULT_JUDGE_PASSWORD = 'Judge@12345';

const judges = [
  {
    judgeId: 'JG001',
    name: 'Amit Deshmukh',
    email: 'amit.deshmukh@example.com',
    status: 'ACTIVE' as const,
  },
  {
    judgeId: 'JG002',
    name: 'Rakesh Patil',
    email: 'rakesh.patil@example.com',
    status: 'ACTIVE' as const,
  },
  {
    judgeId: 'JG003',
    name: 'Sanjay More',
    email: 'sanjay.more@example.com',
    status: 'ACTIVE' as const,
  },
  {
    judgeId: 'JG004',
    name: 'Vijay Shinde',
    email: 'vijay.shinde@example.com',
    status: 'INACTIVE' as const,
  },
  {
    judgeId: 'JG005',
    name: 'Nitin Kulkarni',
    email: 'nitin.kulkarni@example.com',
    status: 'ACTIVE' as const,
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(
    DEFAULT_JUDGE_PASSWORD,
    12,
  );

  for (const judgeData of judges) {
    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: {
          email: judgeData.email,
        },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: judgeData.email,
            passwordHash,
            role: 'JUDGE',
            status:
              judgeData.status === 'ACTIVE'
                ? 'ACTIVE'
                : 'INACTIVE',
          },
        });
      } else {
        user = await tx.user.update({
          where: {
            id: user.id,
          },
          data: {
            passwordHash,
            role: 'JUDGE',
            status:
              judgeData.status === 'ACTIVE'
                ? 'ACTIVE'
                : 'INACTIVE',
          },
        });
      }

      const existingJudge = await tx.judge.findUnique({
        where: {
          judgeId: judgeData.judgeId,
        },
      });

      const judge = existingJudge
        ? await tx.judge.update({
            where: {
              id: existingJudge.id,
            },
            data: {
              name: judgeData.name,
              email: judgeData.email,
              status: judgeData.status,
              userId: user.id,
            },
          })
        : await tx.judge.create({
            data: {
              ...judgeData,
              userId: user.id,
            },
          });

      return { judge, user };
    });

    console.log(
      `Ready ${result.judge.judgeId}: ${result.judge.name} (${result.user.email})`,
    );
  }

  console.log('');
  console.log('Judge accounts are ready.');
  console.log(`Default password: ${DEFAULT_JUDGE_PASSWORD}`);
  console.log('Active judges: JG001, JG002, JG003, JG005');
}

main()
  .catch((error) => {
    console.error('Judge seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
