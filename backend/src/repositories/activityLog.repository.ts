import { prisma } from '../config/db';
import { ActivityLog } from '@prisma/client';

export class ActivityLogRepository {
  async log(data: Omit<ActivityLog, 'id' | 'createdAt'>): Promise<ActivityLog> {
    try {
      return await prisma.activityLog.create({
        data,
      });
    } catch (err: any) {
      console.warn('ActivityLog creation skipped or failed:', err.message);
      return {
        id: 'failed-log-uuid',
        ...data,
        createdAt: new Date()
      } as any;
    }
  }
}
