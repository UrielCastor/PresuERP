import api from './api';

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isStaff?: boolean;
  roleId: string;
  role: Role;
  defaultWarehouseId?: string | null;
  defaultWarehouse?: { id: string; name: string } | null;
  userWarehouses?: { warehouseId: string; warehouse: { id: string; name: string } }[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password?: string;
  confirmarPassword?: string;
  roleId: string;
  isActive?: boolean;
  defaultWarehouseId?: string | null;
  authorizedWarehouseIds?: string[];
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string | null;
  confirmarPassword?: string | null;
  roleId?: string;
  isActive?: boolean;
  defaultWarehouseId?: string | null;
  authorizedWarehouseIds?: string[];
}

export class UserService {
  static async list(page: number = 1, limit: number = 100): Promise<{ items: User[]; total: number }> {
    const response = await api.get('/users', { params: { page, limit } });
    return response.data.data;
  }

  static async findById(id: string): Promise<User> {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  }

  static async create(data: CreateUserData): Promise<User> {
    const response = await api.post('/users', data);
    return response.data.data;
  }

  static async update(id: string, data: UpdateUserData): Promise<User> {
    const response = await api.put(`/users/${id}`, data);
    return response.data.data;
  }

  static async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  }

  static async listRoles(): Promise<Role[]> {
    const response = await api.get('/roles');
    return response.data.data;
  }
}
