import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validation.middleware';
import { registerBusinessSchema, loginSchema, refreshTokenSchema } from '../validators/auth.validator';
import { authLimitter } from '../middlewares/rateLimiter';

const router = Router();
const controller = new AuthController();

router.post('/register', authLimitter, validate(registerBusinessSchema), controller.register);
router.post('/login', authLimitter, validate(loginSchema), controller.login);
router.post('/refresh', validate(refreshTokenSchema), controller.refresh);
router.post('/logout', controller.logout);

export default router;
