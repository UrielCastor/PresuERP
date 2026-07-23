import { prisma } from '../config/db';
import { CashService } from '../services/cash.service';

async function testHttpActiveSessionPayload() {
  const business = await prisma.business.findFirst({ where: { isActive: true } });
  if (!business) return;
  const user = await prisma.user.findFirst({ where: { businessId: business.id } });
  if (!user) return;

  const cashService = new CashService();
  const sessionData = await cashService.getActiveSession(business.id, user.id);

  const fullHttpResponsePayload = {
    status: 'success',
    data: sessionData
  };

  console.log('=== JSON COMPLETO RECIBIDO POR EL NAVEGADOR (GET /api/v1/cash/active) ===\n');
  console.log(JSON.stringify(fullHttpResponsePayload, null, 2));
}

testHttpActiveSessionPayload()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
