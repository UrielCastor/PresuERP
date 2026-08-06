/**
 * ENTERPRISE ROLE ANALYZER & DIAGNOSTICS ENGINE — PRESUERP
 *
 * Evaluates role capability sets to detect missing prerequisites, logical inconsistencies,
 * security risk levels (LOW/MEDIUM/HIGH/CRITICAL), and calculates a Health Score (0-100).
 */

export interface DependencyMissing {
  capabilityId: string;
  capabilityName: string;
  missingPrerequisiteId: string;
  missingPrerequisiteName: string;
}

export interface RoleConflict {
  id: string;
  title: string;
  description: string;
  missingCapabilityId: string;
  missingCapabilityName: string;
}

export interface Recommendation {
  id: string;
  type: 'DEPENDENCY' | 'CONFLICT' | 'RISK' | 'SECURITY';
  text: string;
  suggestedAddCapabilityId?: string;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface RoleAnalysisResult {
  assignedCount: number;
  totalCapabilitiesCount: number;
  dependenciesMissing: DependencyMissing[];
  conflicts: RoleConflict[];
  criticalActionsCount: number;
  riskLevel: RiskLevel;
  riskLabel: string;
  riskColor: string; // Tailwind class
  healthScore: number;
  healthStatus: 'Excelente' | 'Bueno' | 'Configurable' | 'Inconsistente' | 'Crítico';
  recommendations: Recommendation[];
}

// ─── Dependency Rules ────────────────────────────────────────────────────────
export const DEPENDENCY_MAP: Record<string, { prereqId: string; capName: string; prereqName: string }> = {
  'products.edit_cost': { prereqId: 'products.view', capName: 'Editar Costo de Reposición', prereqName: 'Ver Productos' },
  'products.edit_price': { prereqId: 'products.view', capName: 'Editar Precio de Venta', prereqName: 'Ver Productos' },
  'products.edit_margin': { prereqId: 'products.view', capName: 'Editar Margen %', prereqName: 'Ver Productos' },
  'products.edit_tax': { prereqId: 'products.view', capName: 'Editar Alícuota IVA', prereqName: 'Ver Productos' },
  'products.create': { prereqId: 'products.view', capName: 'Crear Producto', prereqName: 'Ver Productos' },
  'products.delete': { prereqId: 'products.view', capName: 'Eliminar Producto', prereqName: 'Ver Productos' },
  'sales.create': { prereqId: 'sales.view', capName: 'Realizar Venta / POS', prereqName: 'Ver POS / Ventas' },
  'sales.discount': { prereqId: 'sales.view', capName: 'Aplicar Descuento POS', prereqName: 'Ver POS / Ventas' },
  'sales.change_price': { prereqId: 'sales.view', capName: 'Modificar Precio en POS', prereqName: 'Ver POS / Ventas' },
  'sales.cancel': { prereqId: 'sales.view', capName: 'Anular Venta Emitida', prereqName: 'Ver POS / Ventas' },
  'sales.return': { prereqId: 'sales.view', capName: 'Procesar Devolución', prereqName: 'Ver POS / Ventas' },
  'purchases.create': { prereqId: 'purchases.view', capName: 'Crear Órden de Compra', prereqName: 'Ver Compras' },
  'purchases.approve': { prereqId: 'purchases.view', capName: 'Aprobar Recepción Compra', prereqName: 'Ver Compras' },
  'purchases.edit_prices': { prereqId: 'purchases.view', capName: 'Editar Precios Compra', prereqName: 'Ver Compras' },
  'customers.create': { prereqId: 'customers.view', capName: 'Crear Cliente', prereqName: 'Ver Clientes' },
  'customers.edit_credit_limit': { prereqId: 'customers.view', capName: 'Modificar Límite Crédito', prereqName: 'Ver Clientes' },
  'customers.edit_balance': { prereqId: 'customers.view', capName: 'Ajustar Saldo Cta Cte', prereqName: 'Ver Clientes' },
  'cash.close': { prereqId: 'cash.view', capName: 'Cierre Z de Caja', prereqName: 'Ver Caja' },
  'cash.income': { prereqId: 'cash.view', capName: 'Registrar Ingreso Dinero', prereqName: 'Ver Caja' },
  'cash.audit': { prereqId: 'cash.view', capName: 'Auditoría de Caja', prereqName: 'Ver Caja' },
  'reports.sales.export': { prereqId: 'reports.sales.view', capName: 'Exportar Reporte Ventas', prereqName: 'Ver Reporte Ventas' },
  'reports.cash.export': { prereqId: 'reports.cash.view', capName: 'Exportar Reporte Caja', prereqName: 'Ver Reporte Caja' },
  'reports.stock.export': { prereqId: 'reports.stock.view', capName: 'Exportar Reporte Stock', prereqName: 'Ver Reporte Stock' },
  'reports.finances.export': { prereqId: 'reports.finances.view', capName: 'Exportar Reporte Finanzas', prereqName: 'Ver Reporte Finanzas' },
};

// ─── Critical Capabilities List ──────────────────────────────────────────────
export const CRITICAL_CAPABILITY_IDS = new Set([
  'products.edit_cost',
  'products.edit_price',
  'products.delete',
  'sales.discount',
  'sales.change_price',
  'sales.cancel',
  'purchases.approve',
  'purchases.delete',
  'customers.edit_credit_limit',
  'customers.edit_balance',
  'cash.close',
  'cash.audit',
  'cash.reopen',
  'settings.security.update',
  'settings.admin.update',
  'roles.manage',
  'users.delete',
]);

/**
 * Main Analysis Function
 */
export function analyzeRoleCapabilities(
  assignedCapIds: Set<string>,
  totalCapabilitiesCount: number = 183
): RoleAnalysisResult {
  const dependenciesMissing: DependencyMissing[] = [];
  const conflicts: RoleConflict[] = [];
  const recommendations: Recommendation[] = [];

  // 1. Evaluate Dependencies
  for (const capId of assignedCapIds) {
    const depRule = DEPENDENCY_MAP[capId];
    if (depRule && !assignedCapIds.has(depRule.prereqId)) {
      dependenciesMissing.push({
        capabilityId: capId,
        capabilityName: depRule.capName,
        missingPrerequisiteId: depRule.prereqId,
        missingPrerequisiteName: depRule.prereqName,
      });

      conflicts.push({
        id: `conflict-${capId}-${depRule.prereqId}`,
        title: `Permiso "${depRule.capName}" sin módulo base`,
        description: `El rol posee "${depRule.capName}" pero no puede ingresar al módulo correspondiente ("${depRule.prereqName}").`,
        missingCapabilityId: depRule.prereqId,
        missingCapabilityName: depRule.prereqName,
      });

      recommendations.push({
        id: `rec-dep-${capId}`,
        type: 'DEPENDENCY',
        text: `Agregar "${depRule.prereqName}" para habilitar el uso correcto de "${depRule.capName}".`,
        suggestedAddCapabilityId: depRule.prereqId,
      });
    }
  }

  // 2. Count Critical Actions
  let criticalActionsCount = 0;
  for (const capId of assignedCapIds) {
    if (CRITICAL_CAPABILITY_IDS.has(capId)) {
      criticalActionsCount++;
    }
  }

  // 3. Determine Risk Level
  let riskLevel: RiskLevel = 'LOW';
  let riskLabel = '🟢 Bajo';
  let riskColor = 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300';

  if (criticalActionsCount >= 8 || assignedCapIds.has('roles.manage') || assignedCapIds.has('settings.security.update')) {
    riskLevel = 'CRITICAL';
    riskLabel = '🔴 Crítico';
    riskColor = 'text-rose-700 bg-rose-50 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300';
  } else if (criticalActionsCount >= 5 || assignedCapIds.has('customers.edit_balance') || assignedCapIds.has('products.edit_cost')) {
    riskLevel = 'HIGH';
    riskLabel = '🟠 Alto';
    riskColor = 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300';
  } else if (criticalActionsCount >= 2) {
    riskLevel = 'MEDIUM';
    riskLabel = '🟡 Medio';
    riskColor = 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300';
  }

  // Add Security Recommendations for High/Critical risk
  if (criticalActionsCount >= 5) {
    recommendations.push({
      id: 'rec-risk-high',
      type: 'RISK',
      text: `Este rol acumula ${criticalActionsCount} acciones críticas. Asegúrese de asignar este rol únicamente a supervisores de confianza.`,
    });
  }

  // 4. Calculate Health Score (0 - 100)
  let healthScore = 100;
  healthScore -= dependenciesMissing.length * 15;
  healthScore -= (conflicts.length - dependenciesMissing.length) * 10;
  if (riskLevel === 'CRITICAL') healthScore -= 10;
  if (healthScore < 0) healthScore = 0;

  let healthStatus: RoleAnalysisResult['healthStatus'] = 'Excelente';
  if (healthScore >= 90) healthStatus = 'Excelente';
  else if (healthScore >= 75) healthStatus = 'Bueno';
  else if (healthScore >= 60) healthStatus = 'Configurable';
  else if (healthScore >= 40) healthStatus = 'Inconsistente';
  else healthStatus = 'Crítico';

  return {
    assignedCount: assignedCapIds.size,
    totalCapabilitiesCount,
    dependenciesMissing,
    conflicts,
    criticalActionsCount,
    riskLevel,
    riskLabel,
    riskColor,
    healthScore,
    healthStatus,
    recommendations,
  };
}
