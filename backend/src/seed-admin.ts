import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from './lib/prisma';

async function main() {
  const email = 'admin@boxing.com';
  const password = 'Admin@12345';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  console.log('Admin account created/updated successfully.');
  console.log(`Email: ${admin.email}`);
  console.log('Role: ADMIN');
}

main()
  .catch((error) => {
    console.error('Seed error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });