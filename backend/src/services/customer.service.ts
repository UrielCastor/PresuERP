import { CustomerRepository } from '../repositories/customer.repository';
import { BadRequestError, NotFoundError } from '../utils/appError';
import { prisma } from '../config/db';

export class CustomerService {
  private repo: CustomerRepository;

  constructor() {
    this.repo = new CustomerRepository();
  }

  async getCustomers(
    businessId: string,
    options: {
      search?: string;
      type?: string;
      activeOnly?: boolean;
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    return this.repo.findAll(businessId, options);
  }

  async getCustomerById(id: string, businessId: string) {
    const customer = await this.repo.findById(id, businessId);
    if (!customer) {
      throw new NotFoundError('Cliente no encontrado');
    }

    // Calculate purchase history metrics
    const sales = customer.sales || [];
    const completedSales = sales.filter((s: any) => s.status === 'COMPLETED');
    const totalSpent = completedSales.reduce((acc: number, s: any) => acc + Number(s.totalAmount || 0), 0);

    return {
      ...customer,
      metrics: {
        totalSalesCount: completedSales.length,
        totalSpent,
      },
    };
  }

  async createCustomer(businessId: string, data: any) {
    console.log("3. [SERVICE CREATE] data recibida:", data);
    if (!data.name || data.name.trim() === '') {
      throw new BadRequestError('El nombre del cliente es obligatorio');
    }

    if (data.document && data.document.trim() !== '') {
      const existing = await this.repo.findByDocument(data.document.trim(), businessId);
      if (existing && existing.active) {
        throw new BadRequestError(`Ya existe un cliente registrado con el documento/CUIT ${data.document}`);
      }
    }

    if (data.defaultPriceListId) {
      const priceList = await prisma.priceList.findFirst({
        where: { id: data.defaultPriceListId, businessId },
      });
      if (!priceList) {
        throw new BadRequestError('La lista de precios predeterminada seleccionada no pertenece a esta empresa o no existe.');
      }
    }

    const docVal = data.document ? data.document.trim() : null;

    return this.repo.create({
      businessId,
      name: data.name.trim(),
      type: data.type || 'PERSON',
      document: docVal,
      taxId: docVal,
      taxCondition: data.taxCondition ? data.taxCondition.trim() : null,
      phone: data.phone ? data.phone.trim() : null,
      email: data.email ? data.email.trim() : null,
      address: data.address ? data.address.trim() : null,
      city: data.city ? data.city.trim() : null,
      province: data.province ? data.province.trim() : null,
      notes: data.notes ? data.notes.trim() : null,
      allowCreditAccount: Boolean(data.allowCreditAccount),
      creditLimit: data.creditLimit ? Number(data.creditLimit) : 0,
      currentDebt: data.currentDebt ? Number(data.currentDebt) : 0,
      defaultPriceListId: data.defaultPriceListId || null,
      autoApplyPriceList: data.autoApplyPriceList !== undefined ? Boolean(data.autoApplyPriceList) : true,
      active: true,
      isActive: true,
    });
  }

  async updateCustomer(id: string, businessId: string, data: any) {
    console.log("3. [SERVICE UPDATE] data recibida:", data);
    const existing = await this.repo.findById(id, businessId);
    if (!existing) {
      throw new NotFoundError('Cliente no encontrado');
    }

    if (data.document && data.document.trim() !== '') {
      const duplicate = await this.repo.findByDocument(data.document.trim(), businessId);
      if (duplicate && duplicate.id !== id && duplicate.active) {
        throw new BadRequestError(`Ya existe otro cliente registrado con el documento ${data.document}`);
      }
    }

    if (data.defaultPriceListId !== undefined) {
      if (data.defaultPriceListId) {
        const priceList = await prisma.priceList.findFirst({
          where: { id: data.defaultPriceListId, businessId },
        });
        if (!priceList) {
          throw new BadRequestError('La lista de precios predeterminada seleccionada no pertenece a esta empresa o no existe.');
        }
      }
    }

    const docVal = data.document !== undefined ? (data.document ? data.document.trim() : null) : undefined;

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.type !== undefined) updateData.type = data.type;
    if (docVal !== undefined) {
      updateData.document = docVal;
      updateData.taxId = docVal;
    }
    if (data.taxCondition !== undefined) updateData.taxCondition = data.taxCondition ? data.taxCondition.trim() : null;
    if (data.phone !== undefined) updateData.phone = data.phone ? data.phone.trim() : null;
    if (data.email !== undefined) updateData.email = data.email ? data.email.trim() : null;
    if (data.address !== undefined) updateData.address = data.address ? data.address.trim() : null;
    if (data.city !== undefined) updateData.city = data.city ? data.city.trim() : null;
    if (data.province !== undefined) updateData.province = data.province ? data.province.trim() : null;
    if (data.notes !== undefined) updateData.notes = data.notes ? data.notes.trim() : null;
    if (data.allowCreditAccount !== undefined) updateData.allowCreditAccount = Boolean(data.allowCreditAccount);
    if (data.creditLimit !== undefined) updateData.creditLimit = Number(data.creditLimit);
    if (data.currentDebt !== undefined) updateData.currentDebt = Number(data.currentDebt);
    if (data.defaultPriceListId !== undefined) updateData.defaultPriceListId = data.defaultPriceListId || null;
    if (data.autoApplyPriceList !== undefined) updateData.autoApplyPriceList = Boolean(data.autoApplyPriceList);
    if (data.active !== undefined) {
      updateData.active = Boolean(data.active);
      updateData.isActive = Boolean(data.active);
    }

    await this.repo.update(id, businessId, updateData);
    return this.repo.findById(id, businessId);
  }

  async deleteCustomer(id: string, businessId: string) {
    const existing = await this.repo.findById(id, businessId);
    if (!existing) {
      throw new NotFoundError('Cliente no encontrado');
    }

    await this.repo.softDelete(id, businessId);
    return { success: true, message: 'Cliente desactivado correctamente' };
  }

  async getAccountMovements(customerId: string, businessId: string) {
    const customer = await this.repo.findById(customerId, businessId);
    if (!customer) {
      throw new NotFoundError('Cliente no encontrado');
    }
    return this.repo.getAccountMovements(customerId, businessId);
  }

  async registerAccountPayment(
    customerId: string,
    businessId: string,
    data: { amount: number; paymentMethod?: string; description?: string; cashSessionId?: string; warehouseId?: string },
    userId?: string
  ) {
    console.log('[ACCOUNT PAYMENT] Service:', { customerId, businessId, data, userId });
    if (!userId) {
      throw new BadRequestError('Usuario no autenticado.');
    }
    const customer = await this.repo.findById(customerId, businessId);
    if (!customer) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const amount = Number(data.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new BadRequestError('El monto del pago debe ser mayor a 0');
    }

    const paymentMethod = data.paymentMethod || 'CASH';

    return this.repo.registerPayment(
      customerId,
      businessId,
      amount,
      paymentMethod,
      data.description,
      userId,
      data.cashSessionId,
      data.warehouseId
    );
  }
}
