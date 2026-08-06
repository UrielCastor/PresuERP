import { api } from './api';

export interface TransferRequestItemDto {
  id?: string;
  productId: string;
  quantity: number;
  requestedQty?: number;
  approvedQty?: number;
  sentQty?: number;
  receivedQty?: number;
  notes?: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    unitOfMeasure?: string;
  };
}

export interface TransferRequestDto {
  id: string;
  requestNumber: string;
  originWarehouseId: string;
  destinationWarehouseId: string;
  requestedByUserId: string;
  approvedByUserId?: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED' | 'COMPLETED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  originWarehouse?: { id: string; name: string; code: string };
  destinationWarehouse?: { id: string; name: string; code: string };
  requestedByUser?: { id: string; name: string; email: string };
  approvedByUser?: { id: string; name: string; email: string };
  items: TransferRequestItemDto[];
  stockTransfers?: Array<{ id: string; transferNumber: string; status: string; createdAt?: string }>;
  _count?: { items: number; stockTransfers: number };
}

export interface StockTransferItemDto {
  id: string;
  stockTransferId: string;
  transferRequestItemId?: string;
  productId: string;
  quantity: number;
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
    unitOfMeasure?: string;
  };
}

export interface StockTransferReceiptItemDto {
  id: string;
  receiptId: string;
  productId: string;
  expectedQty: number;
  receivedQty: number;
  differenceQty: number;
  notes?: string;
  product?: { id: string; name: string; sku: string };
}

export interface StockTransferReceiptDto {
  id: string;
  stockTransferId: string;
  receiptNumber?: string;
  receivedByUserId: string;
  receivedAt: string;
  notes?: string;
  receivedByUser?: { id: string; name: string };
  items: StockTransferReceiptItemDto[];
}

export interface StockTransferDto {
  id: string;
  transferRequestId?: string;
  transferNumber: string;
  originWarehouseId: string;
  destinationWarehouseId: string;
  preparedByUserId?: string;
  dispatchedByUserId?: string;
  receivedByUserId?: string;
  status: 'PENDING' | 'PREPARING' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
  departureDate?: string;
  arrivalDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  originWarehouse?: { id: string; name: string; code: string };
  destinationWarehouse?: { id: string; name: string; code: string };
  preparedByUser?: { id: string; name: string; email: string };
  dispatchedByUser?: { id: string; name: string; email: string };
  receivedByUser?: { id: string; name: string; email: string };
  transferRequest?: { id: string; requestNumber: string; status: string };
  items: StockTransferItemDto[];
  receipts?: StockTransferReceiptDto[];
  _count?: { items: number; receipts: number };
}

export interface ProductAvailabilityWarehouseDto {
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  isMain: boolean;
  availableStock: number;
  status: 'AVAILABLE' | 'OUT_OF_STOCK';
  statusLabel: string;
}

export interface ProductAvailabilityDto {
  productId: string;
  productName: string;
  sku: string;
  barcode?: string;
  unitOfMeasure?: string;
  warehouses: ProductAvailabilityWarehouseDto[];
}

export const logisticsService = {
  // Transfer Requests
  async getTransferRequests(params?: any) {
    const res = await api.get('/logistics/transfer-requests', { params });
    return res.data;
  },

  async getTransferRequestById(id: string) {
    const res = await api.get(`/logistics/transfer-requests/${id}`);
    return res.data;
  },

  async createTransferRequest(data: {
    originWarehouseId: string;
    destinationWarehouseId: string;
    items: { productId: string; quantity: number; notes?: string }[];
    notes?: string;
  }) {
    const res = await api.post('/logistics/transfer-requests', data);
    return res.data;
  },

  async updateTransferRequest(
    id: string,
    data: {
      originWarehouseId?: string;
      destinationWarehouseId?: string;
      items?: { productId: string; quantity: number; notes?: string }[];
      notes?: string;
    }
  ) {
    const res = await api.put(`/logistics/transfer-requests/${id}`, data);
    return res.data;
  },

  async sendTransferRequest(id: string) {
    const res = await api.post(`/logistics/transfer-requests/${id}/send`);
    return res.data;
  },

  async approveTransferRequest(
    id: string,
    data: {
      items: { transferRequestItemId: string; approvedQty: number }[];
      notes?: string;
    }
  ) {
    const res = await api.post(`/logistics/transfer-requests/${id}/approve`, data);
    return res.data;
  },

  async rejectTransferRequest(id: string, data: { notes: string }) {
    const res = await api.post(`/logistics/transfer-requests/${id}/reject`, data);
    return res.data;
  },

  async createTransferFromRequest(id: string, data?: { items?: { transferRequestItemId: string; quantity: number }[]; notes?: string }) {
    const res = await api.post(`/logistics/transfer-requests/${id}/create-transfer`, data || {});
    return res.data;
  },

  // Stock Transfers
  async getStockTransfers(params?: any) {
    const res = await api.get('/logistics/stock-transfers', { params });
    return res.data;
  },

  async getStockTransferById(id: string) {
    const res = await api.get(`/logistics/stock-transfers/${id}`);
    return res.data;
  },

  async prepareStockTransfer(id: string) {
    const res = await api.post(`/logistics/stock-transfers/${id}/prepare`);
    return res.data;
  },

  async dispatchStockTransfer(id: string) {
    const res = await api.post(`/logistics/stock-transfers/${id}/dispatch`);
    return res.data;
  },

  async receiveStockTransfer(
    id: string,
    data: {
      items: { stockTransferItemId: string; receivedQty: number }[];
      notes?: string;
    }
  ) {
    const res = await api.post(`/logistics/stock-transfers/${id}/receive`, data);
    return res.data;
  },

  // Product Availability & Search
  async searchLogisticsProducts(query: string) {
    const res = await api.get('/logistics/products/search', { params: { q: query } });
    return res.data;
  },

  async getProductAvailability(productId: string) {
    const res = await api.get('/logistics/product-availability', { params: { productId } });
    return res.data;
  },
};
