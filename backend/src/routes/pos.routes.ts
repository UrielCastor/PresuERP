import { Router } from 'express';
import { PosController } from '../controllers/pos.controller';

const router = Router();

router.get('/dashboard', PosController.getDashboard);

export default router;
