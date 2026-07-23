import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Iniciando migración de precios de Planes SaaS ---');
  try {
    const plans = await prisma.plan.findMany();
    console.log(`Se encontraron ${plans.length} planes en la base de datos.`);

    for (const plan of plans) {
      console.log(`Procesando plan: ${plan.name} (Code: ${plan.code})...`);

      // Check if price already exists for MONTHLY cycle
      const existingPrices = await (prisma as any).planPrice.findMany({
        where: {
          planId: plan.id,
          billingCycle: 'MONTHLY',
        },
      });

      if (existingPrices.length > 0) {
        console.log(`  El plan ${plan.name} ya posee precio mensual. Saltando...`);
      } else {
        const priceVal = (plan as any).monthlyPrice || 0;
        console.log(`  Creando PlanPrice mensual para ${plan.name} con valor de $${Number(priceVal)}...`);
        await (prisma as any).planPrice.create({
          data: {
            planId: plan.id,
            billingCycle: 'MONTHLY',
            price: priceVal,
            active: true,
          },
        });
        console.log(`  ✅ PlanPrice creado exitosamente.`);
      }
    }
    console.log('--- Migración completada de forma segura ---');
  } catch (error) {
    console.error('Error al realizar la migración de precios:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
