import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Synchronizing Subscriptions for legacy tenants...');
  
  const businesses = await prisma.business.findMany();
  let plan = await prisma.plan.findFirst({ where: { name: 'PROFESSIONAL' } });

  if (!plan) { 
     plan = await prisma.plan.findFirst();
  }
  
  if (!plan) return console.log('Fatal Error: No plans seeded. Run seed-plans first');

  let processed = 0;
  for (const b of businesses) {
    const existing = await prisma.subscription.findFirst({ where: { businessId: b.id } });
    if (!existing) {
       let ren = new Date();
       ren.setMonth(ren.getMonth() + 1);

       await prisma.subscription.create({
         data: {
            businessId: b.id,
            planId: plan.id,
            status: 'ACTIVE',
            billingCycle: 'MONTHLY',
            startDate: new Date(),
            renewalDate: ren
         }
       });
       
       await prisma.business.update({
          where: { id: b.id },
          data: { subscriptionPlan: plan.name, subscriptionEndsAt: ren }
       });
       
       processed++;
    }
  }

  console.log(`Synchronization finished. ${processed} subscriptions natively migrated and mapped.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
