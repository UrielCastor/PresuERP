import { useMemo } from 'react';
import { analyzeRoleCapabilities, RoleAnalysisResult, DEPENDENCY_MAP } from '../utils/roleAnalyzer';

export function useRoleAnalysis(
  assignedCapIds: Set<string>,
  setAssignedCapIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  totalSystemCapsCount: number = 183
) {
  const analysis: RoleAnalysisResult = useMemo(() => {
    return analyzeRoleCapabilities(assignedCapIds, totalSystemCapsCount);
  }, [assignedCapIds, totalSystemCapsCount]);

  /**
   * Apply all missing dependency prerequisites automatically
   */
  const handleApplyAllDependencies = () => {
    setAssignedCapIds((prev) => {
      const next = new Set(prev);
      for (const capId of prev) {
        const depRule = DEPENDENCY_MAP[capId];
        if (depRule && !next.has(depRule.prereqId)) {
          next.add(depRule.prereqId);
        }
      }
      return next;
    });
  };

  /**
   * Auto-resolve single missing capability
   */
  const handleAddSingleCapability = (capId: string) => {
    setAssignedCapIds((prev) => {
      const next = new Set(prev);
      next.add(capId);
      return next;
    });
  };

  /**
   * Auto-resolve all conflicts in 1 click
   */
  const handleResolveAllConflicts = () => {
    handleApplyAllDependencies();
  };

  return {
    analysis,
    handleApplyAllDependencies,
    handleAddSingleCapability,
    handleResolveAllConflicts,
  };
}
