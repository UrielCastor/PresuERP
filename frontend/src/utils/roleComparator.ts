/**
 * ROLE COMPARATOR UTILITY — PRESUERP
 *
 * Compares two roles side-by-side, identifies capabilities unique to Role A, unique to Role B,
 * shared capabilities, and exports comparative summary data to CSV/Excel.
 */

import { CapabilityItemDto, GroupedCapabilityModuleDto } from '../services/capability.service';
import { analyzeRoleCapabilities, RoleAnalysisResult } from './roleAnalyzer';

export interface CapabilityDiffItem {
  id: string;
  name: string;
  description: string;
  module: string;
  type: string;
  hasRoleA: boolean;
  hasRoleB: boolean;
  status: 'BOTH' | 'ONLY_A' | 'ONLY_B' | 'NEITHER';
}

export interface RoleComparisonSummary {
  roleA: { id: string; name: string; description?: string; analysis: RoleAnalysisResult };
  roleB: { id: string; name: string; description?: string; analysis: RoleAnalysisResult };
  totalCapabilitiesCount: number;
  sharedCount: number;
  onlyACount: number;
  onlyBCount: number;
  differencesCount: number;
  items: CapabilityDiffItem[];
}

export function compareRoles(
  roleA: { id: string; name: string; description?: string; capabilityIds: string[] },
  roleB: { id: string; name: string; description?: string; capabilityIds: string[] },
  groupedModules: GroupedCapabilityModuleDto[]
): RoleComparisonSummary {
  const setA = new Set(roleA.capabilityIds || []);
  const setB = new Set(roleB.capabilityIds || []);

  const allCaps: CapabilityItemDto[] = groupedModules.flatMap((m) => m.capabilities);
  const items: CapabilityDiffItem[] = [];

  let sharedCount = 0;
  let onlyACount = 0;
  let onlyBCount = 0;

  for (const cap of allCaps) {
    const hasA = setA.has(cap.id);
    const hasB = setB.has(cap.id);

    let status: CapabilityDiffItem['status'] = 'NEITHER';
    if (hasA && hasB) {
      status = 'BOTH';
      sharedCount++;
    } else if (hasA && !hasB) {
      status = 'ONLY_A';
      onlyACount++;
    } else if (!hasA && hasB) {
      status = 'ONLY_B';
      onlyBCount++;
    }

    items.push({
      id: cap.id,
      name: cap.name,
      description: cap.description,
      module: cap.module,
      type: cap.type,
      hasRoleA: hasA,
      hasRoleB: hasB,
      status,
    });
  }

  const analysisA = analyzeRoleCapabilities(setA, allCaps.length);
  const analysisB = analyzeRoleCapabilities(setB, allCaps.length);

  return {
    roleA: { ...roleA, analysis: analysisA },
    roleB: { ...roleB, analysis: analysisB },
    totalCapabilitiesCount: allCaps.length,
    sharedCount,
    onlyACount,
    onlyBCount,
    differencesCount: onlyACount + onlyBCount,
    items,
  };
}

/**
 * Download Role Comparison as CSV File
 */
export function exportComparisonToCSV(summary: RoleComparisonSummary) {
  const headers = ['Módulo', 'Capacidad', 'ID Técnica', `Rol A (${summary.roleA.name})`, `Rol B (${summary.roleB.name})`, 'Estado Comparativo'];
  
  const rows = summary.items.map((item) => {
    let statusText = 'Ninguno';
    if (item.status === 'BOTH') statusText = 'Compartido por ambos';
    else if (item.status === 'ONLY_A') statusText = `Solo en ${summary.roleA.name}`;
    else if (item.status === 'ONLY_B') statusText = `Solo en ${summary.roleB.name}`;

    return [
      `"${item.module}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.id}"`,
      item.hasRoleA ? 'SI' : 'NO',
      item.hasRoleB ? 'SI' : 'NO',
      `"${statusText}"`,
    ].join(',');
  });

  const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `comparacion_roles_${summary.roleA.name}_vs_${summary.roleB.name}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
