import { TransferRequestRepository, CreateTransferRequestInput, UpdateTransferRequestInput, TransferRequestFilterInput } from '../repositories/transferRequest.repository';
import { prisma } from '../config/db';
import { NotFoundError, BadRequestError } from '../utils/appError';

export class TransferRequestService {
  private repo = new TransferRequestRepository();

  async list(businessId: string, filters: TransferRequestFilterInput = {}, userRole?: string, userDefaultWarehouseId?: string) {
    const isCashier = userRole?.toLowerCase() === 'cajero' || userRole?.toLowerCase() === 'cashier';
    if (isCashier && userDefaultWarehouseId) {
      filters.userWarehouseId = userDefaultWarehouseId;
    }
    return this.repo.list(businessId, filters);
  }

  async findById(id: string, businessId: string) {
    const request = await this.repo.findById(id, businessId);
    if (!request) {
      throw new NotFoundError('Pedido interno no encontrado');
    }
    return request;
  }

  async create(
    businessId: string,
    requestedByUserId: string,
    input: CreateTransferRequestInput,
    userRole?: string,
    userDefaultWarehouseId?: string
  ) {
    // 1. Validate basic input fields
    if (!input.originWarehouseId || !input.destinationWarehouseId) {
      throw new BadRequestError('Debe especificar el depósito de origen y de destino');
    }

    if (input.originWarehouseId === input.destinationWarehouseId) {
      throw new BadRequestError('El depósito de origen y de destino no pueden ser el mismo');
    }

    // Restrict originWarehouseId to user's assigned default warehouse if role is Cajero
    const isCashier = userRole?.toLowerCase() === 'cajero' || userRole?.toLowerCase() === 'cashier';
    if (isCashier && userDefaultWarehouseId && input.originWarehouseId !== userDefaultWarehouseId) {
      throw new BadRequestError('El rol Cajero solo puede crear pedidos solicitando stock para su propio depósito asignado');
    }

    // 2. Validate warehouses exist in business
    const originWarehouse = await prisma.warehouse.findFirst({
      where: { id: input.originWarehouseId, businessId, status: 'ACTIVE' },
    });
    if (!originWarehouse) {
      throw new NotFoundError('El depósito de origen no existe o no está activo');
    }

    const destinationWarehouse = await prisma.warehouse.findFirst({
      where: { id: input.destinationWarehouseId, businessId, status: 'ACTIVE' },
    });
    if (!destinationWarehouse) {
      throw new NotFoundError('El depósito de destino no existe o no está activo');
    }

    // 3. Validate items
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestError('El pedido debe incluir al menos un producto');
    }

    // Check quantities > 0
    for (const item of input.items) {
      if (!item.productId) {
        throw new BadRequestError('Cada ítem debe tener un producto válido');
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new BadRequestError('La cantidad solicitada debe ser mayor a cero');
      }
    }

    // Check duplicate products
    const productIds = input.items.map((i) => i.productId);
    const uniqueProductIds = new Set(productIds);
    if (uniqueProductIds.size !== productIds.length) {
      throw new BadRequestError('No se permiten productos duplicados dentro del mismo pedido');
    }

    // Verify all products exist in business
    const existingProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId,
      },
      select: { id: true },
    });

    if (existingProducts.length !== uniqueProductIds.size) {
      throw new NotFoundError('Uno o más productos especificados no existen en el sistema');
    }

    // 4. Delegate creation to repository
    return this.repo.create(businessId, requestedByUserId, input);
  }

  async update(id: string, businessId: string, input: UpdateTransferRequestInput) {
    // 1. Fetch existing request
    const existing = await this.repo.findById(id, businessId);
    if (!existing) {
      throw new NotFoundError('Pedido interno no encontrado');
    }

    // 2. Only allow editing when status === DRAFT
    if (existing.status !== 'DRAFT') {
      throw new BadRequestError('No se puede modificar un pedido que no está en estado Borrador');
    }

    // 3. Validate warehouses if updated
    const targetOriginId = input.originWarehouseId || existing.originWarehouseId;
    const targetDestId = input.destinationWarehouseId || existing.destinationWarehouseId;

    if (targetOriginId === targetDestId) {
      throw new BadRequestError('El depósito de origen y de destino no pueden ser el mismo');
    }

    if (input.originWarehouseId) {
      const origin = await prisma.warehouse.findFirst({
        where: { id: input.originWarehouseId, businessId, status: 'ACTIVE' },
      });
      if (!origin) {
        throw new NotFoundError('El depósito de origen no existe o no está activo');
      }
    }

    if (input.destinationWarehouseId) {
      const dest = await prisma.warehouse.findFirst({
        where: { id: input.destinationWarehouseId, businessId, status: 'ACTIVE' },
      });
      if (!dest) {
        throw new NotFoundError('El depósito de destino no existe o no está activo');
      }
    }

    // 4. Validate items if updated
    if (input.items !== undefined) {
      if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new BadRequestError('El pedido debe incluir al menos un producto');
      }

      for (const item of input.items) {
        if (!item.productId) {
          throw new BadRequestError('Cada ítem debe tener un producto válido');
        }
        if (typeof item.quantity !== 'number' || item.quantity <= 0) {
          throw new BadRequestError('La cantidad solicitada debe ser mayor a cero');
        }
      }

      const productIds = input.items.map((i) => i.productId);
      const uniqueProductIds = new Set(productIds);
      if (uniqueProductIds.size !== productIds.length) {
        throw new BadRequestError('No se permiten productos duplicados dentro del mismo pedido');
      }

      const existingProducts = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          businessId,
        },
        select: { id: true },
      });

      if (existingProducts.length !== uniqueProductIds.size) {
        throw new NotFoundError('Uno o más productos especificados no existen en el sistema');
      }
    }

    // 5. Delegate update to repository
    return this.repo.update(id, businessId, input);
  }

  async sendForApproval(id: string, businessId: string) {
    // 1. Fetch existing request
    const existing = await this.repo.findById(id, businessId);
    if (!existing) {
      throw new NotFoundError('Pedido interno no encontrado');
    }

    // 2. Only allow sending when status === DRAFT
    if (existing.status !== 'DRAFT') {
      throw new BadRequestError('El pedido ya fue enviado o no se encuentra en estado Borrador');
    }

    // 3. Validate items
    if (!existing.items || existing.items.length === 0) {
      throw new BadRequestError('El pedido debe incluir al menos un producto antes de enviarlo');
    }

    for (const item of existing.items) {
      if (Number(item.requestedQty) <= 0) {
        throw new BadRequestError('Todas las cantidades solicitadas deben ser mayores a cero');
      }
    }

    if (existing.originWarehouseId === existing.destinationWarehouseId) {
      throw new BadRequestError('El depósito de origen y de destino no pueden ser el mismo');
    }

    // 4. Update status DRAFT -> PENDING
    return this.repo.updateStatus(id, businessId, 'PENDING');
  }

  async approve(
    id: string,
    businessId: string,
    approvedByUserId: string,
    input: { items: { transferRequestItemId: string; approvedQty: number }[]; notes?: string }
  ) {
    // 1. Fetch existing request
    const existing = await this.repo.findById(id, businessId);
    if (!existing) {
      throw new NotFoundError('Pedido interno no encontrado');
    }

    // 2. Only allow approving when status === PENDING
    if (existing.status !== 'PENDING') {
      throw new BadRequestError('Solo se pueden evaluar o aprobar pedidos en estado Pendiente (PENDING)');
    }

    // 3. Validate items payload
    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new BadRequestError('Debe enviar la lista de ítems a evaluar');
    }

    const existingItemsMap = new Map<string, any>();
    existing.items.forEach((item) => {
      existingItemsMap.set(item.id, item);
    });

    let totalApproved = 0;
    let isFullApproval = true;

    for (const item of input.items) {
      const matching = existingItemsMap.get(item.transferRequestItemId);
      if (!matching) {
        throw new BadRequestError('Uno o más ítems evaluados no pertenecen a este pedido');
      }

      const approvedQtyNum = Number(item.approvedQty);
      if (isNaN(approvedQtyNum) || approvedQtyNum < 0) {
        throw new BadRequestError('La cantidad aprobada no puede ser negativa');
      }

      const requestedQtyNum = Number(matching.requestedQty);
      if (approvedQtyNum > requestedQtyNum) {
        throw new BadRequestError(
          `La cantidad aprobada (${approvedQtyNum}) no puede superar la cantidad solicitada (${requestedQtyNum}) para el producto ${matching.product.name}`
        );
      }

      totalApproved += approvedQtyNum;
      if (approvedQtyNum !== requestedQtyNum) {
        isFullApproval = false;
      }
    }

    if (totalApproved === 0) {
      throw new BadRequestError('Para rechazar completamente un pedido utilice la opción de Rechazar (REJECT)');
    }

    const newStatus = isFullApproval ? 'APPROVED' : 'PARTIAL';

    // 4. Execute atomic approval & stock reservation transaction
    return this.repo.approve(id, businessId, approvedByUserId, input.items, newStatus, input.notes);
  }

  async reject(id: string, businessId: string, rejectedByUserId: string, input: { notes?: string }) {
    // 1. Fetch existing request
    const existing = await this.repo.findById(id, businessId);
    if (!existing) {
      throw new NotFoundError('Pedido interno no encontrado');
    }

    // 2. Only allow rejecting when status === PENDING
    if (existing.status !== 'PENDING') {
      throw new BadRequestError('El pedido ya fue procesado y no se encuentra en estado Pendiente (PENDING)');
    }

    // 3. Validate notes
    if (!input || !input.notes || input.notes.trim() === '') {
      throw new BadRequestError('Debe registrar un motivo o nota de rechazo');
    }

    // 4. Execute atomic rejection transaction
    return this.repo.reject(id, businessId, rejectedByUserId, input.notes.trim());
  }

  async cancel(id: string, businessId: string, userId: string) {
    const request = await this.repo.findById(id, businessId);
    if (!request) {
      throw new NotFoundError('Pedido interno no encontrado');
    }

    if (request.status === 'CANCELLED' || request.status === 'COMPLETED' || request.status === 'REJECTED') {
      throw new BadRequestError(`No se puede cancelar un pedido en estado ${request.status}`);
    }

    const totalSent = request.items.reduce((sum: number, item: any) => sum + Number(item.sentQty || 0), 0);
    if (totalSent > 0) {
      throw new BadRequestError('No se puede cancelar un pedido que ya posee mercadería despachada en traspasos activos');
    }

    return prisma.$transaction(async (tx) => {
      await tx.stockReservation.updateMany({
        where: {
          transferRequestId: id,
          businessId,
          status: 'ACTIVE',
        },
        data: { status: 'RELEASED' },
      });

      return tx.transferRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          originWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true, barcode: true } },
            },
          },
        },
      });
    });
  }
}
