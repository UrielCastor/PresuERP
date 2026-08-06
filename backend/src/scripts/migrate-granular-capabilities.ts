/**
 * MIGRATION SCRIPT — Enterprise Granular Capabilities Seeding and Role Migration
 *
 * 1. Upserts all granular capabilities defined in defaultCapabilities into database.
 * 2. Scans existing business roles and automatically expands legacy capabilities
 *    (e.g., products.update -> products.edit_cost, products.edit_price, etc.)
 *    so existing roles do not lose access to their granular actions.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-granular-capabilities.ts
 */

import { prisma } from '../config/db';
import { defaultCapabilities } from '../seeds/capabilities.seed';

// Map legacy capability IDs to their new granular action counterparts
const legacyToGranularMap: Record<string, string[]> = {
  'products.update': [
    'products.edit_name',
    'products.edit_description',
    'products.edit_barcode',
    'products.edit_supplier',
    'products.edit_category',
    'products.edit_brand',
    'products.edit_unit',
    'products.edit_cost',
    'products.edit_margin',
    'products.edit_price',
    'products.edit_tax',
    'products.edit_stock_min',
    'products.edit_image',
    'products.activate',
    'products.deactivate',
  ],
  'products.cost.update': ['products.edit_cost'],
  'sales.create': [
    'sales.change_customer',
    'sales.change_seller',
    'sales.change_quantity',
    'sales.delete_item',
    'sales.payment_cash',
    'sales.payment_card',
    'sales.payment_transfer',
    'sales.payment_mp',
    'sales.reprint',
    'sales.open_drawer',
    'sales.close',
  ],
  'customers.update': [
    'customers.edit_basic',
    'customers.edit_contact',
    'customers.edit_price_list',
    'customers.edit_credit_limit',
    'customers.edit_balance',
    'customers.edit_points',
    'customers.edit_observations',
  ],
  'purchases.update': [
    'purchases.edit_supplier',
    'purchases.edit_items',
    'purchases.edit_prices',
    'purchases.edit_discount',
    'purchases.edit_observations',
  ],
  'price_lists.update': ['price_lists.edit_name', 'price_lists.edit_items'],
  'suppliers.update': ['suppliers.edit_basic', 'suppliers.edit_contact', 'suppliers.edit_balance'],
  'warehouses.update': ['warehouses.edit'],
  'cash.movement': ['cash.income', 'cash.expense', 'cash.transfer', 'cash.print', 'cash.export'],
  'cash.close': ['cash.reopen'],
  'reports.view': [
    'reports.sales.view',
    'reports.cash.view',
    'reports.stock.view',
    'reports.customers.view',
    'reports.finances.view',
  ],
  'reports.export': [
    'reports.sales.export',
    'reports.cash.export',
    'reports.stock.export',
    'reports.customers.export',
    'reports.finances.export',
  ],
  'settings.update': [
    'settings.view',
    'settings.general.update',
    'settings.preferences.update',
    'settings.fiscal.update',
    'settings.operation.update',
    'settings.print.update',
    'settings.email.update',
    'settings.numbering.update',
    'settings.inventory.update',
    'settings.system.update',
    'settings.appearance.update',
    'settings.security.update',
    'settings.integrations.update',
    'settings.admin.update',
    'settings.pos.update',
  ],
  'settings.pos.update': [
    'settings.pos.view',
    'settings.pos.discounts',
    'settings.pos.points',
    'settings.pos.payments',
  ],
};

async function migrateGranularCapabilities() {
  console.log('🔄 Iniciando siembra y migración granular de capacidades...');

  // 1. Upsert all default capabilities
  let upsertedCount = 0;
  for (const cap of defaultCapabilities) {
    await prisma.capability.upsert({
      where: { id: cap.id },
      update: {
        name: cap.name,
        description: cap.description,
        module: cap.module,
        type: cap.type,
        technicalPermission: cap.technicalPermission,
      },
      create: cap,
    });
    upsertedCount++;
  }
  console.log(`✅ ${upsertedCount} capacidades registradas / actualizadas en catálogo global.`);

  // 2. Fetch all role capabilities to map legacy assignments
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, businessId: true },
  });

  let mappedCount = 0;
  for (const role of roles) {
    const roleCaps = await prisma.roleCapability.findMany({
      where: { roleId: role.id },
      select: { capabilityId: true },
    });

    const capSet = new Set(roleCaps.map((rc) => rc.capabilityId));
    const newCapsToAdd = new Set<string>();

    for (const capId of capSet) {
      if (legacyToGranularMap[capId]) {
        for (const newCapId of legacyToGranularMap[capId]) {
          if (!capSet.has(newCapId)) {
            newCapsToAdd.add(newCapId);
          }
        }
      }
    }

    if (newCapsToAdd.size > 0) {
      console.log(`   - Rol "${role.name}" (id: ${role.id}): agregando ${newCapsToAdd.size} capacidades granulares derivadas.`);
      for (const capId of newCapsToAdd) {
        await prisma.roleCapability.create({
          data: {
            roleId: role.id,
            capabilityId: capId,
          },
        });
        mappedCount++;
      }
    }
  }

  console.log(`✅ Migración completada: ${mappedCount} nuevas relaciones asignadas a roles existentes.`);
  await prisma.$disconnect();
}

migrateGranularCapabilities().catch((err) => {
  console.error('❌ Error en migración granular:', err);
  prisma.$disconnect();
  process.exit(1);
});
