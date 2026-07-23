/**
 * repair-missing-subscriptions.ts
 *
 * Script de reparación: busca todas las empresas sin Subscription
 * y les crea automáticamente una Subscription con el plan FREE.
 *
 * Uso: npx ts-node src/scripts/repair-missing-subscriptions.ts
 * O compilado: node dist/scripts/repair-missing-subscriptions.js
 *
 * Safe to run multiple times (idempotent).
 */

import { prisma } from '../config/db';

async function repairMissingSubscriptions() {
  console.log('[Repair] Iniciando reparación de suscripciones faltantes...');

  // 1. Buscar plan FREE
  const freePlan =
    await (prisma as any).plan.findFirst({ where: { code: 'FREE' } }) ||
    await (prisma as any).plan.findFirst({ where: { name: 'FREE' } });

  if (!freePlan) {
    console.error('[Repair] ERROR: No se encontró el plan FREE en la base de datos.');
    console.error('[Repair] Por favor cree el plan FREE antes de ejecutar este script.');
    process.exit(1);
  }

  console.log(`[Repair] Plan FREE encontrado: ID=${freePlan.id}, Nombre="${freePlan.name}"`);

  // 2. Buscar todos los negocios
  const allBusinesses = await prisma.business.findMany({
    select: { id: true, name: true }
  });

  console.log(`[Repair] Total de empresas en la base de datos: ${allBusinesses.length}`);

  let repaired = 0;
  let skipped = 0;

  for (const business of allBusinesses) {
    // 3. Verificar si ya tiene subscription
    const existingSub = await (prisma as any).subscription.findFirst({
      where: { businessId: business.id }
    });

    if (existingSub) {
      skipped++;
      continue;
    }

    // 4. Crear subscription FREE
    await (prisma as any).subscription.create({
      data: {
        businessId: business.id,
        planId: freePlan.id,
        status: 'ACTIVE',
        billingCycle: 'FREE',
        startDate: new Date()
      }
    });

    // 5. Actualizar subscriptionPlan en Business si está en blanco o incorrecto
    await prisma.business.update({
      where: { id: business.id },
      data: { subscriptionPlan: freePlan.name }
    });

    console.log(`[Repair] ✓ Subscription FREE creada para empresa "${business.name}" (ID: ${business.id})`);
    repaired++;
  }

  console.log('\n[Repair] ─────────────────────────────────────');
  console.log(`[Repair] Empresas reparadas:  ${repaired}`);
  console.log(`[Repair] Empresas sin cambio: ${skipped} (ya tenían suscripción)`);
  console.log('[Repair] Reparación finalizada.');
}

repairMissingSubscriptions()
  .catch((e) => {
    console.error('[Repair] Error inesperado:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
