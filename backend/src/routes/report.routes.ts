import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware';

const router = Router();
const controller = new ReportController();

router.use(requireAuth);

router.get('/executive', requirePermission('reports:read'), controller.getExecutiveSummary);
router.get('/sales', requirePermission('reports:read'), controller.getSales);
router.get('/purchases', requirePermission('reports:read'), controller.getPurchases);
router.get('/cash', requirePermission('reports:read'), controller.getCash);
router.get('/inventory', requirePermission('reports:read'), controller.getInventory);
router.get('/stock', requirePermission('reports:read'), controller.getInventory);
router.get('/kardex', requirePermission('reports:read'), controller.getKardex);
router.get('/financial', requirePermission('reports:read'), controller.getFinancial);
router.get('/customers', requirePermission('reports:read'), controller.getCustomers);
router.get('/products', requirePermission('reports:read'), controller.getProducts);
router.get('/users', requirePermission('reports:read'), controller.getUsers);
router.get('/audit', requirePermission('AUDIT_VIEW'), controller.getAudit);
router.post('/export', requirePermission('reports:export'), controller.exportReport);

export default router;
