import { SystemRepository } from './system.repository';

export class SystemService {
  private repository: SystemRepository;

  constructor() {
    this.repository = new SystemRepository();
  }

  async getDashboardMetrics() {
    return await this.repository.getSystemMetrics();
  }

  async getBusinessOverview(id: string) {
    return await this.repository.getBusinessOverview(id);
  }

  async listAllUsers(filters: any) {
    return await this.repository.listAllUsers(filters);
  }

  async getUserDetails(id: string) {
    return await this.repository.getUserDetails(id);
  }

  async updateUserStatus(id: string, isActive: boolean) {
    return await this.repository.updateUserStatus(id, isActive);
  }

  async deleteUser(id: string, forceSoftDelete: boolean = false) {
    return await this.repository.deleteUser(id, forceSoftDelete);
  }
}
