import api from './api';

export interface CapabilityItemDto {
  id: string;
  name: string;
  description: string;
  module: string;
  type: 'VIEW' | 'OPERATIVE' | 'CRITICAL';
  technicalPermission: string;
}

export interface GroupedCapabilityModuleDto {
  module: string;
  capabilities: CapabilityItemDto[];
}

export interface RoleCapabilitiesResponseDto {
  role: {
    id: string;
    name: string;
    description?: string;
    isSystem?: boolean;
  };
  capabilityIds: string[];
}

export interface RoleCapabilityHistoryItemDto {
  id: string;
  action: 'ADDED' | 'REMOVED';
  reason?: string | null;
  createdAt: string;
  capabilityId: string;
  user: {
    name: string;
    email: string;
  };
}

export const capabilityService = {
  getGroupedCapabilities: async (): Promise<GroupedCapabilityModuleDto[]> => {
    const res = await api.get('/system/capabilities');
    return res.data.data;
  },

  getRoleCapabilities: async (roleId: string): Promise<RoleCapabilitiesResponseDto> => {
    const res = await api.get(`/roles/${roleId}/capabilities`);
    return res.data.data;
  },

  updateRoleCapabilities: async (
    roleId: string,
    capabilityIds: string[],
    reason?: string
  ): Promise<RoleCapabilitiesResponseDto> => {
    const res = await api.put(`/roles/${roleId}/capabilities`, { capabilityIds, reason });
    return res.data.data;
  },

  createCustomRole: async (data: { name: string; description?: string; baseRoleId?: string }): Promise<any> => {
    const res = await api.post('/roles/custom', data);
    return res.data.data;
  },

  updateRole: async (roleId: string, data: { name?: string; description?: string }): Promise<any> => {
    const res = await api.patch(`/roles/${roleId}`, data);
    return res.data.data;
  },

  deleteRole: async (roleId: string): Promise<any> => {
    const res = await api.delete(`/roles/${roleId}`);
    return res.data.data;
  },

  getRoleCapabilityHistory: async (roleId: string): Promise<RoleCapabilityHistoryItemDto[]> => {
    const res = await api.get(`/roles/${roleId}/capabilities/history`);
    return res.data.data;
  },
};

