import { PriceListRepository } from '../repositories/priceList.repository';

export class PriceListService {
  private repo = new PriceListRepository();

  async getActivePriceLists(businessId: string) {
    return this.repo.findByBusinessId(businessId);
  }

  async getAllPriceLists(businessId: string) {
    return this.repo.findAll(businessId);
  }

  async getPriceListById(id: string, businessId: string) {
    return this.repo.findById(id, businessId);
  }

  async createPriceList(businessId: string, data: { name: string; description?: string | null; isActive?: boolean; isDefault?: boolean }) {
    return this.repo.create(businessId, data);
  }

  async updatePriceList(id: string, businessId: string, data: { name?: string; description?: string | null; isActive?: boolean; isDefault?: boolean }) {
    return this.repo.update(id, businessId, data);
  }

  async deletePriceList(id: string, businessId: string) {
    return this.repo.delete(id, businessId);
  }

  async addPriceListItem(priceListId: string, businessId: string, data: { productId: string; price: number; minQuantity?: number }) {
    return this.repo.addItem(priceListId, businessId, data);
  }

  async updatePriceListItem(itemId: string, priceListId: string, businessId: string, data: { price?: number; minQuantity?: number }) {
    return this.repo.updateItem(itemId, priceListId, businessId, data);
  }

  async deletePriceListItem(itemId: string, priceListId: string, businessId: string) {
    return this.repo.deleteItem(itemId, priceListId, businessId);
  }
}
