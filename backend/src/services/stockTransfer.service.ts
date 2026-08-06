import { StockTransferRepository, CreateStockTransferInput, StockTransferFilterInput } from '../repositories/stockTransfer.repository';
import { NotFoundError } from '../utils/appError';

export class StockTransferService {
  private repo = new StockTransferRepository();

  async createFromRequest(businessId: string, createdByUserId: string, input: CreateStockTransferInput) {
    return this.repo.createFromRequest(businessId, createdByUserId, input);
  }

  async list(businessId: string, filters: StockTransferFilterInput = {}) {
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

  async receive(
    id: string,
    businessId: string,
    receivedByUserId: string,
    input: { items: { stockTransferItemId: string; receivedQty: number }[]; notes?: string }
  ) {
    return this.repo.receive(id, businessId, receivedByUserId, input.items, input.notes);
  }
}
