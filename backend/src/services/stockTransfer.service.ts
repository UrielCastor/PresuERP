import { StockTransferRepository, CreateStockTransferInput, StockTransferFilterInput } from '../repositories/stockTransfer.repository';
import { NotFoundError, BadRequestError } from '../utils/appError';
import { prisma } from '../config/db';

export class StockTransferService {
  private repo = new StockTransferRepository();

  async createFromRequest(businessId: string, createdByUserId: string, input: CreateStockTransferInput) {
    return this.repo.createFromRequest(businessId, createdByUserId, input);
  }

  async list(businessId: string, filters: StockTransferFilterInput = {}, userRole?: string, userDefaultWarehouseId?: string) {
    const isCashier = userRole?.toLowerCase() === 'cajero' || userRole?.toLowerCase() === 'cashier';
    if (isCashier && userDefaultWarehouseId) {
      filters.userWarehouseId = userDefaultWarehouseId;
    }
    return this.repo.list(businessId, filters);
  }

  async findById(id: string, businessId: string) {
    const transfer = await this.repo.findById(id, businessId);
    if (!transfer) {
      throw new NotFoundError('Traspaso no encontrado');
    }
    return transfer;
  }

  async prepare(id: string, businessId: string, preparedByUserId: string) {
    return this.repo.prepare(id, businessId, preparedByUserId);
  }

  async dispatch(id: string, businessId: string, dispatchedByUserId: string) {
    return this.repo.dispatch(id, businessId, dispatchedByUserId);
  }

  async cancel(id: string, businessId: string, userId: string) {
    const transfer = await this.repo.findById(id, businessId);
    if (!transfer) {
      throw new NotFoundError('Traspaso no encontrado');
    }

    if (transfer.status === 'IN_TRANSIT' || transfer.status === 'RECEIVED') {
      throw new BadRequestError('No se puede cancelar un traspaso que ya fue despachado o recibido. Para devoluciones, genere un traspaso inverso.');
    }

    if (transfer.status === 'CANCELLED') {
      throw new BadRequestError('El traspaso ya se encuentra cancelado');
    }

    return prisma.$transaction(async (tx) => {
      if (transfer.transferRequestId) {
        for (const item of transfer.items) {
          if (item.transferRequestItemId) {
            await tx.transferRequestItem.update({
              where: { id: item.transferRequestItemId },
              data: {
                sentQty: { decrement: Number(item.quantity) },
              },
            });
          }
        }
      }

      return tx.stockTransfer.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    });
  }

  async receive(
    id: string,
    businessId: string,
    receivedByUserId: string,
    input: { items: { stockTransferItemId: string; receivedQty: number }[]; notes?: string }
  ) {
    return this.repo.receive(id, businessId, receivedByUserId, input.items, input.notes);
  }
}
