import { Response } from 'express';
import { CustomerService } from '../services/customer.service';
import { createCustomerSchema, updateCustomerSchema } from '../validators/customer.validator';

export class CustomerController {
  private service: CustomerService;

  constructor() {
    this.service = new CustomerService();
  }

  getCustomers = async (req: any, res: Response, next: any) => {
    try {
      const businessId = req.user.businessId;
      const { search, type, active, page, limit, sortBy, sortOrder } = req.query;

      const result = await this.service.getCustomers(businessId, {
        search: search ? String(search) : undefined,
        type: type ? String(type) : undefined,
        activeOnly: active !== undefined ? active === 'true' : true,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
        sortBy: sortBy ? String(sortBy) : undefined,
        sortOrder: sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : undefined,
      });

      return res.status(200).json({
        status: 'success',
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getCustomerById = async (req: any, res: Response, next: any) => {
    try {
      const businessId = req.user.businessId;
      const { id } = req.params;

      const customer = await this.service.getCustomerById(id, businessId);
      console.log("7. [GET /customers/:id] clienteEncontrado:", customer);

      return res.status(200).json({
        status: 'success',
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  };

  createCustomer = async (req: any, res: Response, next: any) => {
    try {
      console.log("2. [CONTROLLER CREATE] req.body:", req.body);
      const businessId = req.user.businessId;
      const validatedData = createCustomerSchema.parse(req.body);

      const customer = await this.service.createCustomer(businessId, validatedData);

      return res.status(201).json({
        status: 'success',
        message: 'Cliente creado correctamente',
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  };

  updateCustomer = async (req: any, res: Response, next: any) => {
    try {
      console.log("2. [CONTROLLER UPDATE] req.body:", req.body);
      const businessId = req.user.businessId;
      const { id } = req.params;
      const validatedData = updateCustomerSchema.parse(req.body);

      const customer = await this.service.updateCustomer(id, businessId, validatedData);

      return res.status(200).json({
        status: 'success',
        message: 'Cliente actualizado correctamente',
        data: customer,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCustomer = async (req: any, res: Response, next: any) => {
    try {
      const businessId = req.user.businessId;
      const { id } = req.params;

      const result = await this.service.deleteCustomer(id, businessId);

      return res.status(200).json({
        status: 'success',
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  };

  getAccountMovements = async (req: any, res: Response, next: any) => {
    try {
      const businessId = req.user.businessId;
      const { id } = req.params;

      const movements = await this.service.getAccountMovements(id, businessId);

      return res.status(200).json({
        status: 'success',
        data: movements,
      });
    } catch (error) {
      next(error);
    }
  };

  registerAccountPayment = async (req: any, res: Response, next: any) => {
    try {
      console.log('[ACCOUNT PAYMENT] Controller:', { params: req.params, body: req.body });
      const businessId = req.user.businessId;
      const userId = req.user.id;
      const { id } = req.params;

      const result = await this.service.registerAccountPayment(id, businessId, req.body, userId);

      return res.status(200).json({
        status: 'success',
        message: 'Pago registrado exitosamente',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
