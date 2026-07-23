import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();
const controller = new CustomerController();

router.use(requireAuth);

router.get('/', controller.getCustomers);
router.get('/:id', controller.getCustomerById);
router.get('/:id/account-movements', controller.getAccountMovements);
router.post('/', controller.createCustomer);
router.post('/:id/payments', controller.registerAccountPayment);
router.put('/:id', controller.updateCustomer);
router.delete('/:id', controller.deleteCustomer);

export default router;
