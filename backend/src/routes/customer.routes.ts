import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CustomerController();

router.use(requireAuth);

router.get('/', requirePermission('customers:read'), controller.getCustomers);
router.get('/:id', requirePermission('customers:read'), controller.getCustomerById);
router.get('/:id/account-movements', requirePermission('customers:read'), controller.getAccountMovements);
router.post('/', requirePermission('customers:write'), controller.createCustomer);
router.post('/:id/payments', requirePermission('customers:write'), controller.registerAccountPayment);
router.put('/:id', requirePermission('customers:write'), controller.updateCustomer);
router.delete('/:id', requirePermission('customers:write'), controller.deleteCustomer);

export default router;
