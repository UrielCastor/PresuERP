/**
 * MIGRATION SCRIPT — Convert Legacy System Roles to Editable Roles
 *
 * Sets isSystem=false for all roles that are NOT 'Administrator'.
 * This allows Cajero, Supervisor, Empleado (and any others) to be
 * fully managed (renamed, deleted, capability-edited) by the business Admin.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-system-roles.ts
 *
 * Safe to run multiple times (idempotent).
 */

import { prisma } from '../config/db';

async function migrateSystemRoles() {
  console.log('🔄 Iniciando migración de roles de sistema...');

  // Fetch all roles where isSystem=true but name is NOT Administrator
  const legacySystemRoles = await prisma.role.findMany({
    where: {
      isSystem: true,
      NOT: [
        { name: 'Administrator' },
        { name: 'SuperAdmin' },
      ],
    },
    select: { id: true, name: true, businessId: true },
  });

  console.log(`📋 Roles encontrados para migrar: ${legacySystemRoles.length}`);
  for (const role of legacySystemRoles) {
    console.log(`   - ${role.name} (id: ${role.id}, businessId: ${role.businessId})`);
  }

  if (legacySystemRoles.length === 0) {
    console.log('✅ No hay roles para migrar. Base de datos ya actualizada.');
    await prisma.$disconnect();
    return;
  }

  // Update all legacy roles to isSystem=false
  const roleIds = legacySystemRoles.map((r) => r.id);
  const result = await prisma.role.updateMany({
    where: { id: { in: roleIds } },
    data: { isSystem: false },
  });

  console.log(`✅ Migración completada: ${result.count} roles actualizados a isSystem=false.`);
  console.log('   Estos roles ahora pueden ser renombrados, modificados y eliminados por el Admin del negocio.');

  await prisma.$disconnect();
}

migrateSystemRoles().catch((err) => {
  console.error('❌ Error en migración:', err);
  prisma.$disconnect();
  process.exit(1);
});
