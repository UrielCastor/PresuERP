import { prisma } from '../config/db';

async function check() {
  console.log('Has customerAccountMovement:', 'customerAccountMovement' in prisma);
}

check().catch(console.error).finally(() => prisma.$disconnect());
