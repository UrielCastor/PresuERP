import { prisma } from '../config/db';

export class ReportRepository {
  // ==========================================
  // EXECUTIVE SUMMARY REPORTING
  // ==========================================
  async getExecutiveMetrics(businessId: string) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');

    const stockRaw = await prisma.$queryRaw<any[]>`
       SELECT SUM(s.quantity * p."purchasePrice") as "stockValue"
       FROM "stocks" s
       JOIN "products" p ON p.id = s."productId"
       WHERE s."businessId" = ${businessId}
    `;
    const stockValue = parseFloat(stockRaw[0]?.stockValue || 0);

    const activeSessions = await prisma.cashSession.findMany({
       where: { businessId, status: 'OPEN' }
    });

    let cashBalance = 0;
    for (const session of activeSessions) {
       const inMovements = await prisma.cashMovement.aggregate({
          where: { cashSessionId: session.id, type: 'IN' },
          _sum: { amount: true }
       });
       const outMovements = await prisma.cashMovement.aggregate({
          where: { cashSessionId: session.id, type: 'OUT' },
          _sum: { amount: true }
       });

       const inAmount = Number(inMovements._sum.amount || 0);
       const outAmount = Number(outMovements._sum.amount || 0);
       cashBalance += Number(session.openingBalance) + inAmount - outAmount;
    }

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    const thisMonthSales = await prisma.sale.aggregate({
      where: {
        businessId,
        status: { not: 'CANCELLED' },
        createdAt: { gte: startOfThisMonth, lte: now }
      },
      _sum: { totalAmount: true },
      _count: { id: true }
    });
    const salesMonth = Number(thisMonthSales._sum.totalAmount || 0);
    const salesCount = Number(thisMonthSales._count.id || 0);

    const validStatuses = ['APPROVED', 'RECEIVED', 'COMPLETED', 'PAID'];

    const thisMonthPurchases = await prisma.purchase.aggregate({
      where: {
         businessId,
         status: { in: validStatuses },
         createdAt: { gte: startOfThisMonth, lte: now }
      },
      _sum: { total: true }
    });

    const lastMonthPurchases = await prisma.purchase.aggregate({
      where: {
         businessId,
         status: { in: validStatuses },
         createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
      },
      _sum: { total: true }
    });

    const purchasesMonth = Number(thisMonthPurchases._sum.total || 0);
    const pLastMonth = Number(lastMonthPurchases._sum.total || 0);
    let purchasesTrend: string | number = 'Sin datos';
    
    if (pLastMonth > 0) {
       const trendValue = ((purchasesMonth - pLastMonth) / pLastMonth) * 100;
       purchasesTrend = Math.round(trendValue);
    }

    return {
       salesMonth,
       salesCount,
       purchasesMonth,
       purchasesTrend,
       grossMargin: salesMonth - purchasesMonth,
       stockValue,
       cashBalance
    };
  }

  // ==========================================
  // SALES REPORTING
  // ==========================================
  async getSalesMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');

    const baseWhere: any = {
      businessId,
      status: { not: 'CANCELLED' },
      createdAt: { gte: start, lte: end }
    };

    if (filters.userId) baseWhere.userId = filters.userId;
    if (filters.cashRegisterId) baseWhere.cashRegisterId = filters.cashRegisterId;
    if (filters.customerId) baseWhere.customerId = filters.customerId;

    const metrics = await prisma.sale.aggregate({
      where: baseWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalAmount = Number(metrics._sum?.totalAmount || 0);
    const totalSales = Number(metrics._count?.id || 0);
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    const topProductsRaw: any[] = await prisma.$queryRaw`
      SELECT p.name as "productName", p.sku, SUM(si.quantity) as quantity, SUM(si."totalAmount") as amount
      FROM "sale_items" si
      JOIN "sales" s ON s.id = si."saleId"
      JOIN "products" p ON p.id = si."productId"
      WHERE s."businessId" = ${businessId}
        AND s.status != 'CANCELLED'
        AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      GROUP BY p.id, p.name, p.sku
      ORDER BY amount DESC
      LIMIT 50
    `;
    const topProducts = topProductsRaw.map((tp) => ({
      productName: tp.productName,
      sku: tp.sku || 'S/S',
      quantity: Number(tp.quantity || 0),
      amount: Number(tp.amount || 0),
    }));

    const topCustomersRaw: any[] = await prisma.$queryRaw`
      SELECT COALESCE(c.name, 'Consumidor Final') as "customerName", COUNT(s.id) as count, SUM(s."totalAmount") as amount
      FROM "sales" s
      LEFT JOIN "customers" c ON c.id = s."customerId"
      WHERE s."businessId" = ${businessId}
        AND s.status != 'CANCELLED'
        AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      GROUP BY c.id, c.name
      ORDER BY amount DESC
      LIMIT 50
    `;
    const topCustomers = topCustomersRaw.map((tc) => ({
      customerName: tc.customerName,
      count: Number(tc.count || 0),
      amount: Number(tc.amount || 0),
    }));

    return {
      totalSales,
      totalAmount,
      averageTicket,
      paymentMethods: await prisma.salePayment.groupBy({
        by: ['paymentMethodId'],
        where: { sale: baseWhere },
        _sum: { amount: true }
      }),
      salesByDay: await prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "createdAt") as day, SUM("totalAmount") as total
        FROM "sales"
        WHERE "businessId" = ${businessId}
          AND status != 'CANCELLED'
          AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1 ORDER BY 1
      `,
      topProducts,
      topCustomers
    };
  }

  // ==========================================
  // PURCHASES REPORTING
  // ==========================================
  async getPurchasesMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    
    const baseWhere: any = { businessId, purchaseDate: { gte: start, lte: end } };
    if (filters?.supplierId && filters.supplierId !== 'ALL') baseWhere.supplierId = filters.supplierId;
    if (filters?.status && filters.status !== 'ALL') baseWhere.status = filters.status;

    const metrics = await prisma.purchase.aggregate({
      where: baseWhere,
      _sum: { total: true },
      _count: { id: true }
    });
    
    const uniqueSuppliers = await prisma.purchase.groupBy({
       by: ['supplierId'],
       where: baseWhere
    });

    const totalOrders = Number(metrics._count?.id || 0);
    const totalAmount = Number(metrics._sum?.total || 0);

    const summary = {
      totalOrders,
      totalAmount,
      averageTicket: totalOrders > 0 ? totalAmount / totalOrders : 0,
      uniqueSuppliers: uniqueSuppliers.length
    };

    const flowQuery = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
           DATE_TRUNC('day', "purchaseDate") as day,
           SUM(total) as amount,
           COUNT(*) as orders
        FROM "purchases"
        WHERE "businessId" = $1 AND "purchaseDate" >= $2 AND "purchaseDate" <= $3
        GROUP BY DATE_TRUNC('day', "purchaseDate")
        ORDER BY DATE_TRUNC('day', "purchaseDate") ASC
    `, businessId, start, end);
    const purchasesByDay = flowQuery.map(d => ({
        day: d.day,
        amount: Number(d.amount || 0),
        orders: Number(d.orders || 0)
    }));

    const suppliersResult = await prisma.purchase.groupBy({
       by: ['supplierId'],
       where: baseWhere,
       _count: { id: true },
       _sum: { total: true }
    });
    const supplierList = await prisma.supplier.findMany({ where: { businessId } });
    const topSuppliers = suppliersResult.map(s => {
       const matched = supplierList.find(x => x.id === s.supplierId);
       return {
          supplierName: matched ? matched.name : 'Desconocido',
          orders: Number(s._count.id || 0),
          amount: Number(s._sum.total || 0)
       };
    }).sort((a,b) => b.amount - a.amount);

    const topProductsQuery = await prisma.purchaseItem.groupBy({
       by: ['productId'],
       where: { purchase: baseWhere },
       _sum: { quantity: true, total: true }
    });
    const productList = await prisma.product.findMany({ where: { businessId } });
    const topProducts = topProductsQuery.map(tp => {
       const matched = productList.find(x => x.id === tp.productId);
       return {
          productName: matched ? matched.name : 'Desconocido',
          quantity: Number(tp._sum.quantity || 0),
          amount: Number(tp._sum.total || 0)
       };
    }).sort((a,b) => b.amount - a.amount).slice(0, 50);

    const paymentStatusResult = await prisma.purchase.groupBy({
       by: ['paymentStatus'],
       where: baseWhere,
       _count: { id: true },
       _sum: { total: true }
    });
    const paymentStatus = paymentStatusResult.map(p => ({
       status: p.paymentStatus,
       count: Number(p._count.id || 0),
       amount: Number(p._sum.total || 0)
    }));

    const purchaseHistory = await prisma.purchase.findMany({
       where: baseWhere,
       include: { 
          supplier: { select: { name: true } }, 
          warehouse: { select: { name: true } },
          user: { select: { name: true } }
       },
       orderBy: { purchaseDate: 'desc' },
       take: 500
    });

    return {
      summary,
      purchasesByDay,
      topSuppliers,
      topProducts,
      paymentStatus,
      purchaseHistory
    };
  }

  // ==========================================
  // CASH REPORTING
  // ==========================================
  async getCashMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');

    const activeSession = await prisma.cashSession.findFirst({
       where: { businessId, status: 'OPEN' },
       include: { openedBy: { select: { name: true } }, cashRegister: { select: { name: true } } },
       orderBy: { openedAt: 'desc' },
    });

    const incomesCount = await prisma.cashMovement.aggregate({
      where: { businessId, type: 'IN', createdAt: { gte: start, lte: end } },
      _sum: { amount: true }
    });
    const expensesCount = await prisma.cashMovement.aggregate({
      where: { businessId, type: 'OUT', createdAt: { gte: start, lte: end } },
      _sum: { amount: true }
    });

    const incomeVal = Number(incomesCount._sum.amount || 0);
    const expenseVal = Number(expensesCount._sum.amount || 0);
    
    // Initialize sessions Where
    const sessionsWhere: any = { businessId };
    // Usually we filter sessions by start/end overlapping their period, but openedAt is a good proxy.
    sessionsWhere.openedAt = { gte: start, lte: end };
    if (filters?.userId && filters.userId !== 'ALL') sessionsWhere.userId = filters.userId;

    const sessions = await prisma.cashSession.findMany({
       where: sessionsWhere,
       include: { openedBy: { select: { name: true } }, cashRegister: { select: { name: true } } },
       orderBy: { openedAt: 'desc' }
    });

    const movementsWhere: any = { businessId, createdAt: { gte: start, lte: end } };
    if (filters?.userId && filters.userId !== 'ALL') movementsWhere.userId = filters.userId;
    
    const movements = await prisma.cashMovement.findMany({
       where: movementsWhere,
       include: { createdByUser: { select: { name: true } }, cashSession: { include: { cashRegister: { select: { name: true } } } } },
       orderBy: { createdAt: 'desc' }
    });

    const paymentMethodsResult = await prisma.salePayment.groupBy({
       by: ['paymentMethodId'],
       where: { sale: { businessId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } } },
       _sum: { amount: true }
    });
    const paymentMethodsList = await prisma.paymentMethod.findMany({ where: { businessId } });
    const paymentMethods = paymentMethodsResult.map(pm => {
       const matched = paymentMethodsList.find(p => p.id === pm.paymentMethodId);
       return {
          name: matched ? matched.name : 'Desconocido',
          value: Number(pm._sum.amount || 0)
       };
    });

    const flowQuery = await prisma.$queryRawUnsafe<any[]>(`
        SELECT 
           DATE_TRUNC('day', "createdAt") as day,
           SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) as incomes,
           SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) as expenses
        FROM "cash_movements"
        WHERE "businessId" = $1 AND "createdAt" >= $2 AND "createdAt" <= $3
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY DATE_TRUNC('day', "createdAt") ASC
    `, businessId, start, end);
    const flowByDay = flowQuery.map(d => ({
        day: d.day,
        incomes: Number(d.incomes || 0),
        expenses: Number(d.expenses || 0)
    }));

    const userPerformanceQuery = await prisma.sale.groupBy({
       by: ['createdById'],
       where: { businessId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
       _count: { id: true },
       _sum: { totalAmount: true }
    });
    const usersList = await prisma.user.findMany({ where: { businessId } });
    const userPerformance = userPerformanceQuery.map(up => {
       const u = usersList.find(x => x.id === up.createdById);
       const amount = Number(up._sum.totalAmount || 0);
       const qty = Number(up._count.id || 0);
       return {
          userName: u ? (u.name || u.email) : 'Desconocido',
          sales: qty,
          amount: amount,
          averageTicket: qty > 0 ? amount / qty : 0
       };
    }).sort((a,b) => b.amount - a.amount);

    return {
      summary: {
         activeSession,
         incomes: incomeVal,
         expenses: expenseVal,
         net: incomeVal - expenseVal,
      },
      sessions,
      movements,
      flowByDay,
      paymentMethods,
      userPerformance
    };
  }

  // ==========================================
  // INVENTORY REPORTING
  // ==========================================
  async getInventoryMetrics(businessId: string, filters?: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');

    const baseWhere: any = { businessId };
    if (filters?.warehouseId && filters.warehouseId !== 'ALL') baseWhere.warehouseId = filters.warehouseId;
    if (filters?.categoryId && filters.categoryId !== 'ALL') baseWhere.product = { ...baseWhere.product, categoryId: filters.categoryId };
    if (filters?.supplierId && filters.supplierId !== 'ALL') baseWhere.product = { ...baseWhere.product, supplierId: filters.supplierId };
    if (filters?.search) {
      baseWhere.product = {
        ...baseWhere.product,
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { sku: { contains: filters.search, mode: 'insensitive' } },
          { barcode: { contains: filters.search, mode: 'insensitive' } }
        ]
      };
    }

    const stocks = await prisma.stock.findMany({
      where: baseWhere,
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, purchasePrice: true, category: { select: { name: true } }, supplier: { select: { name: true } } }
        },
        warehouse: { select: { id: true, name: true } }
      }
    });

    let totalStockValue = 0;
    let ok = 0;
    let low = 0;
    let over = 0;
    let empty = 0;
    const uniqueWarehouses = new Set();
    const uniqueProducts = new Set();

    const resultProducts = stocks.map((s: any) => {
      uniqueWarehouses.add(s.warehouseId);
      if (s.productId) uniqueProducts.add(s.productId);
      
      const qty = Number(s.quantity);
      const min = Number(s.minimumStock || 0);
      const max = Number(s.maximumStock || 0);
      const val = qty * Number(s.product?.purchasePrice || 0);
      
      if (qty > 0) totalStockValue += val;

      let status = 'OK';
      if (qty <= 0) {
        status = 'NO_STOCK';
        empty++;
      } else if (qty <= min) {
        status = 'LOW_STOCK';
        low++;
      } else if (max > 0 && qty >= max) {
        status = 'OVER_STOCK';
        over++;
      } else {
        ok++;
      }

      return {
        id: s.id,
        productId: s.productId,
        warehouseId: s.warehouseId,
        productName: s.product?.name,
        sku: s.product?.sku,
        barcode: s.product?.barcode,
        categoryName: s.product?.category?.name,
        supplierName: s.product?.supplier?.name,
        warehouseName: s.warehouse?.name,
        quantity: qty,
        reservedQuantity: Number(s.reservedQuantity),
        minimumStock: min,
        maximumStock: max,
        inventoryValue: val,
        status
      };
    });

    // Apply the status filter on the mapped products if needed
    let filteredProducts = resultProducts;
    if (filters?.status && filters.status !== 'ALL') {
      filteredProducts = resultProducts.filter(p => p.status === filters.status);
    }

    return {
      summary: {
        totalProducts: uniqueProducts.size,
        totalStockValue,
        lowStockProducts: low,
        outOfStockProducts: empty,
        overStockProducts: over,
        totalWarehouses: uniqueWarehouses.size
      },
      stockStatus: {
        ok,
        low,
        over,
        empty
      },
      products: filteredProducts
    };
  }

  // ==========================================
  // KARDEX REPORTING
  // ==========================================
  async getKardex(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');

    const baseWhere: any = { businessId, createdAt: { gte: start, lte: end } };
    if (filters.productId) baseWhere.productId = filters.productId;
    if (filters.warehouseId) baseWhere.warehouseId = filters.warehouseId;

    const movements = await prisma.stockMovement.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } }
      }
    });

    const summary = {
      total: movements.length,
      in: movements.filter((m: any) => ['IN', 'PURCHASE', 'SALE_RETURN', 'TRANSFER_IN'].includes(m.type)).length,
      out: movements.filter((m: any) => ['OUT', 'SALE', 'PURCHASE_RETURN', 'TRANSFER_OUT'].includes(m.type)).length,
      adjust: movements.filter((m: any) => ['ADJUSTMENT', 'INITIAL_INVENTORY'].includes(m.type)).length,
      uniqueProducts: new Set(movements.map((m: any) => m.productId)).size
    };

    return { summary, movements };
  }
  // ==========================================
  // ADVANCED REPORTS (FINANCIAL, CUSTOMERS, PRODUCTS, USERS)
  // ==========================================
  async getFinancialMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    const baseWhere = { businessId, createdAt: { gte: start, lte: end } };
    
    const sales = await prisma.sale.aggregate({ where: baseWhere, _sum: { totalAmount: true } });
    const purchases = await prisma.purchase.aggregate({ where: baseWhere, _sum: { total: true } });
    
    return {
      totalSales: sales._sum.totalAmount || 0,
      totalPurchases: purchases._sum.total || 0,
      grossMargin: Number(sales._sum.totalAmount || 0) - Number(purchases._sum.total || 0),
      netFlow: 0,
    };
  }

  async getCustomersMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    return {
      totalActive: await prisma.customer.count({ where: { businessId } }),
      newCustomers: await prisma.customer.count({ where: { businessId, createdAt: { gte: start, lte: end } } }),
      ranking: [],
    };
  }

  async getProductsMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    
    const summary = {
      activeProducts: await prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
      totalValuation: await prisma.$queryRaw<any[]>`
         SELECT SUM(s.quantity * p."purchasePrice") as total
         FROM "stocks" s JOIN "products" p ON p.id = s."productId"
         WHERE s."businessId" = ${businessId}
      `.then(res => parseFloat(res[0]?.total || 0)),
      withoutMovement: 0,
      averageMargin: 0
    };

    const topSelling: any[] = await prisma.$queryRaw`
      SELECT p.name, p.sku, SUM(si.quantity) as qty, SUM(si."totalAmount") as total
      FROM "sale_items" si 
      JOIN "sales" s ON s.id = si."saleId"
      JOIN "products" p ON p.id = si."productId"
      WHERE s."businessId" = ${businessId} AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      GROUP BY p.name, p.sku
      ORDER BY total DESC
      LIMIT 100
    `;

    const categorySales: any[] = await prisma.$queryRaw`
      SELECT c.name, SUM(si.quantity) as qty, SUM(si."totalAmount") as total
      FROM "sale_items" si 
      JOIN "sales" s ON s.id = si."saleId"
      JOIN "products" p ON p.id = si."productId"
      JOIN "categories" c ON c.id = p."categoryId"
      WHERE s."businessId" = ${businessId} AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      GROUP BY c.name
      ORDER BY total DESC
    `;

    const queryDays = 90;
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - queryDays);

    const slowMoving: any[] = await prisma.$queryRaw`
      SELECT p.name, p.sku, SUM(st.quantity) as stock_qty
      FROM "products" p
      LEFT JOIN "stocks" st ON st."productId" = p.id
      WHERE p."businessId" = ${businessId}
      AND NOT EXISTS (
         SELECT 1 FROM "sale_items" si 
         JOIN "sales" s ON s.id = si."saleId" 
         WHERE si."productId" = p.id AND s."createdAt" >= ${dateLimit}
      )
      GROUP BY p.name, p.sku
      HAVING SUM(st.quantity) > 0
      LIMIT 100
    `;

    summary.withoutMovement = slowMoving.length;

    // Calculate Average margin overall
    const marginData: any[] = await prisma.$queryRaw`
      SELECT SUM(si."totalAmount") as revenue, SUM(p."purchasePrice" * si.quantity) as cost
      FROM "sale_items" si 
      JOIN "sales" s ON s.id = si."saleId"
      JOIN "products" p ON p.id = si."productId"
      WHERE s."businessId" = ${businessId} AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
    `;

    if (marginData && marginData[0] && marginData[0].revenue > 0) {
       const rev = parseFloat(marginData[0].revenue);
       const cost = parseFloat(marginData[0].cost);
       summary.averageMargin = ((rev - cost) / rev) * 100;
    }

    return {
      summary,
      topSelling: topSelling.map(i => ({ producto: i.name, sku: i.sku, cantidad: Number(i.qty), facturacion: Number(i.total), margen: summary.averageMargin })),
      inactive: slowMoving.map(i => ({ producto: i.name, sku: i.sku, stock: Number(i.stock_qty), lastSale: `Hace más de ${queryDays} días` })),
      categories: categorySales.map(i => ({ name: i.name, qty: Number(i.qty), total: Number(i.total) })),
      profitability: topSelling.map(i => ({ producto: i.name, ventas: Number(i.qty), ganancia: Number(i.total) * (summary.averageMargin/100), margen: summary.averageMargin }))
    };
  }

  async getUsersMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    const baseWhere = { businessId, createdAt: { gte: start, lte: end } };
    
    const grouping = await prisma.sale.groupBy({
      by: ['createdById'],
      where: baseWhere,
      _count: { _all: true },
      _sum: { totalAmount: true }
    });

    const userIds = grouping.map(g => g.createdById);
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });

    return {
      ranking: grouping.map(g => ({
         user: users.find(u => u.id === g.createdById)?.name || 'Desconocido',
         sales: g._count._all,
         total: g._sum.totalAmount
      })).sort((a, b) => b.sales - a.sales),
    };
  }

  async getAuditReport(businessId: string, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    
    const page = Math.max(1, Number(filters?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { businessId };

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.module && filters.module !== 'ALL') {
      where.entityName = { contains: filters.module, mode: 'insensitive' };
    }

    if (filters?.action && filters.action !== 'ALL') {
      where.actionType = { contains: filters.action, mode: 'insensitive' };
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { entityName: { contains: q, mode: 'insensitive' } },
        { actionType: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
        { previousValues: { contains: q, mode: 'insensitive' } },
        { newValues: { contains: q, mode: 'insensitive' } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const safeParse = (str?: string | null) => {
      if (!str) return null;
      try {
        return JSON.parse(str);
      } catch {
        return str;
      }
    };

    const [items, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return {
      items: items.map(item => ({
        id: item.id,
        createdAt: item.createdAt,
        user: item.user?.name || item.user?.email || 'Sistema',
        userId: item.userId,
        userEmail: item.user?.email,
        module: item.entityName,
        action: item.actionType,
        entity: item.entityName,
        entityId: item.entityId,
        ipAddress: item.ipAddress,
        userAgent: item.userAgent,
        oldData: safeParse(item.previousValues),
        newData: safeParse(item.newValues),
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
