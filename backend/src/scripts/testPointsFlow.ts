import { PrismaClient } from '@prisma/client';
import { PointsService } from '../services/points.service';
import { SaleService } from '../services/sale.service';

const prisma = new PrismaClient();
const pointsService = new PointsService();
const saleService = new SaleService();

async function run() {
  console.log('=== INICIANDO SIMULACIÓN DEL FLUJO DE PUNTOS (FASE 2) ===');
  try {
    // 1. Obtener un negocio existente activo
    const business = await prisma.business.findFirst({
      where: { isActive: true }
    });
    if (!business) {
      console.log('No hay negocios configurados. Por favor, crea un negocio primero.');
      return;
    }
    const businessId = business.id;
    console.log(`Negocio seleccionado: ${business.name} (${businessId})`);

    // 2. Obtener un usuario de este negocio
    const user = await prisma.user.findFirst({
      where: { businessId }
    });
    if (!user) {
      console.log('No hay usuarios en este negocio. Por favor, asocia un usuario.');
      return;
    }

    // 3. Obtener o crear un cliente de prueba fresco
    let customer = await prisma.customer.findFirst({
      where: { businessId, email: 'test_puntos_fase2@presuerp.com' }
    });
    if (customer) {
      // Eliminar historial y cliente anterior para asegurar limpieza completa
      await prisma.customerPointsHistory.deleteMany({
        where: { customerId: customer.id }
      });
      await prisma.customer.delete({
        where: { id: customer.id }
      });
    }

    customer = await prisma.customer.create({
      data: {
        businessId,
        name: 'Cliente de Prueba Puntos F2',
        document: '88888888',
        type: 'PERSON',
        email: 'test_puntos_fase2@presuerp.com',
        pointsBalance: 0,
        excludeFromLoyalty: false,
      }
    });
    const customerId = customer.id;

    // Agregar balance inicial de 100 puntos con ajuste manual registrado en historial
    await pointsService.adjustPoints(
      businessId,
      {
        customerId,
        points: 100,
        description: 'Carga inicial de saldo de puntos para simulación',
      },
      user.id
    );

    const freshCustomer = await pointsService.getCustomerBalance(businessId, customerId);
    console.log(`Cliente seleccionado: ${freshCustomer.name} (Puntos Iniciales: ${freshCustomer.pointsBalance})`);

    // 4. Configurar parámetros de fidelización y registrar auditoría
    console.log('Configurando parámetros del programa de fidelización (con auditoría)...');
    await pointsService.updateSettings(
      businessId,
      {
        enabled: true,
        earnEveryAmount: 1000.0, // Gana puntos por cada $1000
        earnPoints: 10,          // 10 puntos por cada tramo de $1000
        minimumSaleAmount: 500.0, // Venta mínima de $500 para acumular
        pointValue: 2.0,          // Cada punto equivale a $2.0 de descuento
        allowPartialRedemption: true,
        allowRedemption: true,
        maxRedemptionPercentage: 50.0, // Máximo 50% de la venta pagado con puntos
        expirePoints: false,
        expirationMonths: 12,
        roundingMode: 'FLOOR',
        pointsCalculationMode: 'EFFECTIVELY_PAID',
        accumulateOnPointsPaid: false,
      },
      {
        userId: user.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Runner Script (Antigravity)',
      }
    );

    const settings = await pointsService.getSettings(businessId);
    console.log('Configuración de fidelización guardada:', {
      enabled: settings.enabled,
      pointValue: Number(settings.pointValue),
      maxRedemptionPercentage: Number(settings.maxRedemptionPercentage),
    });

    // 5. Probando previsualización de canje
    console.log('\n--- Probando previsualización de canje ---');
    const preview = await pointsService.previewRedemption(businessId, {
      customerId,
      pointsToRedeem: 50,
      saleTotalBeforePoints: 2100,
    });
    console.log('Previsualización de canje resultante:', preview);
    if (!preview.applicable || preview.finalDiscount !== 100) {
      throw new Error('Aserción de previsualización fallida.');
    }

    // 6. Simular la venta
    // Detalles:
    // Subtotal: 2 unidades de producto a $1050 c/u = $2100
    // Canje de puntos: 50 puntos (Valor = 50 * $2 = $100 descuento)
    // Pago total final esperado: $2000
    // Puntos acumulados esperados: $2000 / $1000 = 2 * 10 = 20 puntos
    console.log('\n--- Ejecutando creación de venta ---');
    
    // Obtener un almacén
    const warehouse = await prisma.warehouse.findFirst({ where: { businessId } });
    if (!warehouse) {
      console.log('No hay almacenes creados.');
      return;
    }

    // Obtener una sesión de caja activa o crearla
    let cashSession = await prisma.cashSession.findFirst({
      where: { businessId, status: 'OPEN' }
    });
    if (!cashSession) {
      const register = await prisma.cashRegister.findFirst({ where: { businessId } });
      if (!register) {
        console.log('No hay cajas registradoras creadas.');
        return;
      }
      cashSession = await prisma.cashSession.create({
        data: {
          businessId,
          cashRegisterId: register.id,
          openedById: user.id,
          status: 'OPEN',
          openingBalance: 1000,
        }
      });
    }

    // Obtener un producto de prueba existente
    const product = await prisma.product.findFirst({ where: { businessId } });
    if (!product) {
      console.log('No hay productos en el negocio. Por favor crea uno primero.');
      return;
    }

    const saleData = {
      customerId,
      cashSessionId: cashSession.id,
      warehouseId: warehouse.id,
      subtotal: 2100,
      totalAmount: 2000,
      status: 'COMPLETED' as const,
      pointsRedeemed: 50,
      items: [
        {
          productId: product.id,
          quantity: 2,
          unitPrice: 1050,
          discountAmount: 0,
          totalAmount: 2100,
        }
      ],
      payments: [
        {
          paymentMethodId: (await prisma.paymentMethod.findFirst({ where: { businessId } }))?.id || '',
          amount: 2000,
          details: 'Pago en efectivo',
        }
      ],
    };

    const sale = await saleService.create(businessId, user.id, saleData);
    console.log('Venta creada exitosamente:', {
      id: sale.id,
      number: sale.documentNumber,
      totalAmount: Number(sale.totalAmount),
      pointsRedeemed: sale.pointsRedeemed,
      pointsDiscountAmount: Number(sale.pointsDiscountAmount),
      pointsEarned: sale.pointsEarned,
      status: sale.status,
    });

    // Validar balances y logs
    const customerAfter = await prisma.customer.findUnique({ where: { id: customerId } });
    console.log(`Balance de puntos del cliente tras la venta: ${customerAfter?.pointsBalance}`);
    
    console.log('Historial de puntos generado para la venta:');
    const histories = await prisma.customerPointsHistory.findMany({
      where: { saleId: sale.id },
      orderBy: { createdAt: 'asc' },
    });
    for (const h of histories) {
      console.log(` - Tipo: ${h.type}, Puntos: ${h.points}, Balance resultante: ${h.balanceAfter}, Razón: ${h.reason}, Descripción: ${h.description}`);
    }

    // Aserciones básicas
    if (sale.pointsRedeemed !== 50 || Number(sale.pointsDiscountAmount) !== 100 || sale.pointsEarned !== 20) {
      throw new Error('Aserción fallida: Los valores de puntos registrados en la venta son incorrectos.');
    }
    if (customerAfter?.pointsBalance !== 70) { // 100 - 50 + 20 = 70
      throw new Error(`Aserción fallida: El balance de puntos esperado es 70, pero se obtuvo ${customerAfter?.pointsBalance}`);
    }
    console.log('✓ Simulación de venta y acreditación/canje automático EXITOSA.');

    // 7. Probando Dashboard de KPIs
    console.log('\n--- Probando dashboard de fidelización ---');
    const dashboard = await pointsService.getLoyaltyDashboard(businessId);
    console.log('KPIs del Dashboard:', dashboard);

    // 8. Probando Exportación a CSV
    console.log('\n--- Probando exportación a CSV ---');
    const csv = await pointsService.exportPointsToCsv(businessId, { customerId });
    console.log('Primeras 3 líneas del reporte CSV:\n' + csv.split('\n').slice(0, 4).join('\n'));

    // 9. Probando caducidad de puntos (Job FIFO)
    console.log('\n--- Probando caducidad de puntos (FIFO) ---');
    // Forzar la expiración para probar
    await pointsService.updateSettings(
      businessId,
      {
        enabled: true,
        earnEveryAmount: 1000.0,
        earnPoints: 10,
        minimumSaleAmount: 500.0,
        pointValue: 2.0,
        allowPartialRedemption: true,
        allowRedemption: true,
        maxRedemptionPercentage: 50.0,
        expirePoints: true, // Habilitar caducidad
        expirationMonths: 1,
        roundingMode: 'FLOOR',
        pointsCalculationMode: 'EFFECTIVELY_PAID',
        accumulateOnPointsPaid: false,
      },
      { userId: user.id }
    );

    // Simulamos una nueva acreditación de puntos que expira en el pasado
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 2); // Expiró hace 2 meses
    
    // Inyectamos entrada manual con expiresAt en el pasado
    const testEarnEntry = await prisma.customerPointsHistory.create({
      data: {
        businessId,
        customerId,
        type: 'EARN',
        reason: 'SALE',
        points: 40,
        balanceAfter: (customerAfter?.pointsBalance || 0) + 40,
        expiresAt: pastDate,
        description: 'Puntos inyectados que ya expiraron',
      }
    });

    // Ajustar el balance físico del cliente
    await prisma.customer.update({
      where: { id: customerId },
      data: { pointsBalance: { increment: 40 } }
    });
    
    const balanceBeforeJob = (await pointsService.getCustomerBalance(businessId, customerId)).pointsBalance;
    console.log(`Balance de puntos del cliente antes de correr la expiración: ${balanceBeforeJob}`);

    // Ejecutar vencimientos (forzando ejecución para test)
    const expirationResult = await pointsService.expireExpiredPoints(true);
    console.log('Resultado del job de expiración:', expirationResult);

    const balanceAfterJob = (await pointsService.getCustomerBalance(businessId, customerId)).pointsBalance;
    console.log(`Balance de puntos del cliente después de correr la expiración: ${balanceAfterJob}`);
    if (balanceAfterJob !== balanceBeforeJob - 40) {
      throw new Error(`Aserción de expiración fallida. El balance esperado es ${balanceBeforeJob - 40}, pero se obtuvo ${balanceAfterJob}`);
    }
    console.log('✓ Simulación del job de caducidad FIFO exitosa.');

    // 10. Simular cancelación de venta
    console.log('\n--- Ejecutando cancelación de venta ---');
    await saleService.cancel(sale.id, businessId, user.id);
    console.log('Venta cancelada exitosamente.');

    // Validar balance de puntos final tras la anulación
    const customerAfterCancel = await prisma.customer.findUnique({ where: { id: customerId } });
    console.log(`Balance de puntos del cliente tras la cancelación: ${customerAfterCancel?.pointsBalance}`);
    console.log('Historial de puntos posterior a la cancelación (incluyendo reversiones):');
    const allHistories = await prisma.customerPointsHistory.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
    });
    for (const h of allHistories) {
      console.log(` - Tipo: ${h.type}, Puntos: ${h.points}, Balance resultante: ${h.balanceAfter}, Razón: ${h.reason}, Descripción: ${h.description}`);
    }

    // Aserción de balance final esperado:
    // El balance tras el job de expiración era 70. Al cancelar, se devuelven 50 (canjeados) y se restan 20 (ganados).
    // Por lo tanto, el balance final debe ser 70 + 50 - 20 = 100 puntos!
    if (customerAfterCancel?.pointsBalance !== 100) {
      throw new Error(`Aserción fallida: El balance de puntos esperado tras la cancelación es 100, pero se obtuvo ${customerAfterCancel?.pointsBalance}`);
    }
    console.log('✓ Simulación de reversión de puntos por cancelación EXITOSA.');

  } catch (error) {
    console.error('ERROR EN SIMULACIÓN:', error);
  } finally {
    await prisma.$disconnect();
    console.log('=== SIMULACIÓN FINALIZADA ===');
  }
}

run();
