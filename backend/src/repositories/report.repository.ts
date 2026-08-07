import { prisma } from '../config/db';

export class ReportRepository {
  // ==========================================
  // EXECUTIVE SUMMARY REPORTING
  // ==========================================
  async getExecutiveMetrics(businessId: string, filters?: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');

    const warehouseId = filters?.warehouseId && filters.warehouseId !== 'ALL' ? filters.warehouseId : null;

    let stockValue = 0;
    if (warehouseId) {
      const stockRaw = await prisma.$queryRaw<any[]>`
         SELECT SUM(s.quantity * p."purchasePrice") as "stockValue"
         FROM "stocks" s
         JOIN "products" p ON p.id = s."productId"
         WHERE s."businessId" = ${businessId} AND s."warehouseId" = ${warehouseId}
      `;
      stockValue = parseFloat(stockRaw[0]?.stockValue || 0);
    } else {
      const stockRaw = await prisma.$queryRaw<any[]>`
         SELECT SUM(s.quantity * p."purchasePrice") as "stockValue"
         FROM "stocks" s
         JOIN "products" p ON p.id = s."productId"
         WHERE s."businessId" = ${businessId}
      `;
      stockValue = parseFloat(stockRaw[0]?.stockValue || 0);
    }

    const sessionsWhere: any = { businessId, status: 'OPEN' };
    if (warehouseId) {
      sessionsWhere.cashRegister = { warehouseId };
    }

    const activeSessions = await prisma.cashSession.findMany({
       where: sessionsWhere
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

    const salesWhere: any = {
      businessId,
      status: 'COMPLETED',
      createdAt: { gte: startOfThisMonth, lte: now }
    };
    if (warehouseId) salesWhere.warehouseId = warehouseId;

    const thisMonthSales = await prisma.sale.aggregate({
      where: salesWhere,
      _sum: { totalAmount: true },
      _count: { id: true }
    });
    const salesMonth = Number(thisMonthSales._sum.totalAmount || 0);
    const salesCount = Number(thisMonthSales._count.id || 0);

    // Costo de Mercadería Vendida (COGS) del mes
    let cogsMonth = 0;
    if (warehouseId) {
      const cogsRaw = await prisma.$queryRaw<any[]>`
        SELECT SUM(si.quantity * p."purchasePrice") as cogs
        FROM "sale_items" si
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId}
          AND s."warehouseId" = ${warehouseId}
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${startOfThisMonth} AND s."createdAt" <= ${now}
      `;
      cogsMonth = parseFloat(cogsRaw[0]?.cogs || 0);
    } else {
      const cogsRaw = await prisma.$queryRaw<any[]>`
        SELECT SUM(si.quantity * p."purchasePrice") as cogs
        FROM "sale_items" si
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId}
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${startOfThisMonth} AND s."createdAt" <= ${now}
      `;
      cogsMonth = parseFloat(cogsRaw[0]?.cogs || 0);
    }

    const grossMargin = salesMonth - cogsMonth;
    const marginPercentage = salesMonth > 0 ? (grossMargin / salesMonth) * 100 : 0;

    const validStatuses = ['APPROVED', 'RECEIVED', 'COMPLETED', 'PAID'];

    const thisMonthPurchasesWhere: any = {
      businessId,
      status: { in: validStatuses },
      createdAt: { gte: startOfThisMonth, lte: now }
    };
    if (warehouseId) thisMonthPurchasesWhere.warehouseId = warehouseId;

    const lastMonthPurchasesWhere: any = {
      businessId,
      status: { in: validStatuses },
      createdAt: { gte: startOfLastMonth, lte: endOfLastMonth }
    };
    if (warehouseId) lastMonthPurchasesWhere.warehouseId = warehouseId;

    const thisMonthPurchases = await prisma.purchase.aggregate({
      where: thisMonthPurchasesWhere,
      _sum: { total: true }
    });

    const lastMonthPurchases = await prisma.purchase.aggregate({
      where: lastMonthPurchasesWhere,
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
       cogsMonth,
       grossMargin,
       marginPercentage,
       stockValue,
       cashBalance
    };
  }

  // ==========================================
  // SALES REPORTING
  // ==========================================
  async getSalesMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');

    const warehouseId = filters?.warehouseId && filters.warehouseId !== 'ALL' ? filters.warehouseId : null;

    const baseWhere: any = {
      businessId,
      status: 'COMPLETED',
      createdAt: { gte: start, lte: end }
    };

    if (filters?.userId) baseWhere.userId = filters.userId;
    if (filters?.cashRegisterId) baseWhere.cashRegisterId = filters.cashRegisterId;
    if (filters?.customerId) baseWhere.customerId = filters.customerId;
    if (warehouseId) baseWhere.warehouseId = warehouseId;

    const metrics = await prisma.sale.aggregate({
      where: baseWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const totalAmount = Number(metrics._sum?.totalAmount || 0);
    const totalSales = Number(metrics._count?.id || 0);
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    let topProductsRaw: any[] = [];
    let topCustomersRaw: any[] = [];
    let salesByDayRaw: any[] = [];

    if (warehouseId) {
      topProductsRaw = await prisma.$queryRaw`
        SELECT p.name as "productName", p.sku, SUM(si.quantity) as quantity, SUM(si."totalAmount") as amount
        FROM "sale_items" si
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId}
          AND s."warehouseId" = ${warehouseId}
          AND s.status = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY p.id, p.name, p.sku
        ORDER BY amount DESC
        LIMIT 50
      `;

      topCustomersRaw = await prisma.$queryRaw`
        SELECT COALESCE(c.name, 'Consumidor Final') as "customerName", COUNT(s.id) as count, SUM(s."totalAmount") as amount
        FROM "sales" s
        LEFT JOIN "customers" c ON c.id = s."customerId"
        WHERE s."businessId" = ${businessId}
          AND s."warehouseId" = ${warehouseId}
          AND s.status = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY c.id, c.name
        ORDER BY amount DESC
        LIMIT 50
      `;

      salesByDayRaw = await prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "createdAt") as day, SUM("totalAmount") as total
        FROM "sales"
        WHERE "businessId" = ${businessId}
          AND "warehouseId" = ${warehouseId}
          AND status = 'COMPLETED'
          AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1 ORDER BY 1
      `;
    } else {
      topProductsRaw = await prisma.$queryRaw`
        SELECT p.name as "productName", p.sku, SUM(si.quantity) as quantity, SUM(si."totalAmount") as amount
        FROM "sale_items" si
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId}
          AND s.status = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY p.id, p.name, p.sku
        ORDER BY amount DESC
        LIMIT 50
      `;

      topCustomersRaw = await prisma.$queryRaw`
        SELECT COALESCE(c.name, 'Consumidor Final') as "customerName", COUNT(s.id) as count, SUM(s."totalAmount") as amount
        FROM "sales" s
        LEFT JOIN "customers" c ON c.id = s."customerId"
        WHERE s."businessId" = ${businessId}
          AND s.status = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY c.id, c.name
        ORDER BY amount DESC
        LIMIT 50
      `;

      salesByDayRaw = await prisma.$queryRaw`
        SELECT DATE_TRUNC('day', "createdAt") as day, SUM("totalAmount") as total
        FROM "sales"
        WHERE "businessId" = ${businessId}
          AND status = 'COMPLETED'
          AND "createdAt" >= ${start} AND "createdAt" <= ${end}
        GROUP BY 1 ORDER BY 1
      `;
    }

    const topProducts = topProductsRaw.map((tp) => ({
      productName: tp.productName,
      sku: tp.sku || 'S/S',
      quantity: Number(tp.quantity || 0),
      amount: Number(tp.amount || 0),
    }));

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
      salesByDay: salesByDayRaw,
      topProducts,
      topCustomers
    };
  }

  // ==========================================
  // PURCHASES REPORTING
  // ==========================================
  async getPurchasesMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    
    const warehouseId = filters?.warehouseId && filters.warehouseId !== 'ALL' ? filters.warehouseId : null;

    const baseWhere: any = { businessId, purchaseDate: { gte: start, lte: end } };
    if (filters?.supplierId && filters.supplierId !== 'ALL') baseWhere.supplierId = filters.supplierId;
    if (filters?.status && filters.status !== 'ALL') baseWhere.status = filters.status;
    if (warehouseId) baseWhere.warehouseId = warehouseId;

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

    let flowQuery: any[] = [];
    if (warehouseId) {
      flowQuery = await prisma.$queryRawUnsafe<any[]>(`
          SELECT 
             DATE_TRUNC('day', "purchaseDate") as day,
             SUM(total) as amount,
             COUNT(*) as orders
          FROM "purchases"
          WHERE "businessId" = $1 AND "warehouseId" = $4 AND "purchaseDate" >= $2 AND "purchaseDate" <= $3
          GROUP BY DATE_TRUNC('day', "purchaseDate")
          ORDER BY DATE_TRUNC('day', "purchaseDate") ASC
      `, businessId, start, end, warehouseId);
    } else {
      flowQuery = await prisma.$queryRawUnsafe<any[]>(`
          SELECT 
             DATE_TRUNC('day', "purchaseDate") as day,
             SUM(total) as amount,
             COUNT(*) as orders
          FROM "purchases"
          WHERE "businessId" = $1 AND "purchaseDate" >= $2 AND "purchaseDate" <= $3
          GROUP BY DATE_TRUNC('day', "purchaseDate")
          ORDER BY DATE_TRUNC('day', "purchaseDate") ASC
      `, businessId, start, end);
    }

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
    if (filters.warehouseId && filters.warehouseId !== 'ALL') baseWhere.warehouseId = filters.warehouseId;

    const movements = await prisma.stockMovement.findMany({
      where: baseWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true } },
        user: { select: { id: true, name: true } }
      }
    });

    let countIn = 0;
    let countOut = 0;
    let countAdjust = 0;
    const uniqueProducts = new Set();

    for (const m of movements) {
      if (m.productId) uniqueProducts.add(m.productId);
      const mType = (m.movementType || '').toUpperCase();
      const qty = Number(m.quantity || 0);

      if (['ENTRY', 'PURCHASE', 'TRANSFER_IN', 'RETURN_CUSTOMER', 'SALE_RETURN', 'PRODUCTION_OUTPUT'].includes(mType)) {
        countIn++;
      } else if (['EXIT', 'SALE', 'TRANSFER_OUT', 'RETURN_SUPPLIER', 'PURCHASE_RETURN', 'PRODUCTION_INPUT'].includes(mType)) {
        countOut++;
      } else if (['ADJUSTMENT', 'INVENTORY', 'INITIAL_INVENTORY'].includes(mType)) {
        countAdjust++;
      } else {
        if (qty > 0) countIn++;
        else if (qty < 0) countOut++;
        else countAdjust++;
      }
    }

    const summary = {
      total: movements.length,
      in: countIn,
      out: countOut,
      adjust: countAdjust,
      uniqueProducts: uniqueProducts.size
    };

    return { summary, movements };
  }

  // ==========================================
  // ADVANCED REPORTS (FINANCIAL, CUSTOMERS, PRODUCTS, USERS)
  // ==========================================
  async getFinancialMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    const warehouseId = filters?.warehouseId && filters.warehouseId !== 'ALL' ? filters.warehouseId : null;

    const salesWhere: any = { businessId, status: 'COMPLETED', createdAt: { gte: start, lte: end } };
    if (warehouseId) salesWhere.warehouseId = warehouseId;

    const validStatuses = ['APPROVED', 'RECEIVED', 'COMPLETED', 'PAID'];
    const purchasesWhere: any = { businessId, status: { in: validStatuses }, purchaseDate: { gte: start, lte: end } };
    if (warehouseId) purchasesWhere.warehouseId = warehouseId;
    
    const sales = await prisma.sale.aggregate({ where: salesWhere, _sum: { totalAmount: true } });
    const purchases = await prisma.purchase.aggregate({ where: purchasesWhere, _sum: { total: true } });
    
    const totalSales = Number(sales._sum.totalAmount || 0);
    const totalPurchases = Number(purchases._sum.total || 0);

    let totalCogs = 0;
    if (warehouseId) {
      const cogsRaw = await prisma.$queryRaw<any[]>`
        SELECT SUM(si.quantity * p."purchasePrice") as cogs
        FROM "sale_items" si
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId}
          AND s."warehouseId" = ${warehouseId}
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      `;
      totalCogs = parseFloat(cogsRaw[0]?.cogs || 0);
    } else {
      const cogsRaw = await prisma.$queryRaw<any[]>`
        SELECT SUM(si.quantity * p."purchasePrice") as cogs
        FROM "sale_items" si
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId}
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
      `;
      totalCogs = parseFloat(cogsRaw[0]?.cogs || 0);
    }

    const grossMargin = totalSales - totalCogs;
    const marginPercentage = totalSales > 0 ? (grossMargin / totalSales) * 100 : 0;

    let dailyFinancial: any[] = [];
    if (warehouseId) {
      dailyFinancial = await prisma.$queryRaw`
        SELECT 
          d.day,
          COALESCE(s.sales_total, 0) as sales,
          COALESCE(s.cogs_total, 0) as cogs,
          COALESCE(p.purchases_total, 0) as purchases
        FROM (
          SELECT DATE_TRUNC('day', "createdAt") as day FROM "sales" WHERE "businessId" = ${businessId} AND "warehouseId" = ${warehouseId} AND "createdAt" >= ${start} AND "createdAt" <= ${end}
          UNION
          SELECT DATE_TRUNC('day', "purchaseDate") as day FROM "purchases" WHERE "businessId" = ${businessId} AND "warehouseId" = ${warehouseId} AND "purchaseDate" >= ${start} AND "purchaseDate" <= ${end}
        ) d
        LEFT JOIN (
          SELECT DATE_TRUNC('day', s."createdAt") as day, SUM(s."totalAmount") as sales_total, SUM(si.quantity * p."purchasePrice") as cogs_total
          FROM "sales" s
          JOIN "sale_items" si ON si."saleId" = s.id
          JOIN "products" p ON p.id = si."productId"
          WHERE s."businessId" = ${businessId} AND s."warehouseId" = ${warehouseId} AND s.status = 'COMPLETED' AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
          GROUP BY 1
        ) s ON s.day = d.day
        LEFT JOIN (
          SELECT DATE_TRUNC('day', "purchaseDate") as day, SUM("total") as purchases_total
          FROM "purchases"
          WHERE "businessId" = ${businessId} AND "warehouseId" = ${warehouseId} AND status IN ('APPROVED', 'RECEIVED', 'COMPLETED', 'PAID') AND "purchaseDate" >= ${start} AND "purchaseDate" <= ${end}
          GROUP BY 1
        ) p ON p.day = d.day
        ORDER BY d.day ASC
      `;
    } else {
      dailyFinancial = await prisma.$queryRaw`
        SELECT 
          d.day,
          COALESCE(s.sales_total, 0) as sales,
          COALESCE(s.cogs_total, 0) as cogs,
          COALESCE(p.purchases_total, 0) as purchases
        FROM (
          SELECT DATE_TRUNC('day', "createdAt") as day FROM "sales" WHERE "businessId" = ${businessId} AND "createdAt" >= ${start} AND "createdAt" <= ${end}
          UNION
          SELECT DATE_TRUNC('day', "purchaseDate") as day FROM "purchases" WHERE "businessId" = ${businessId} AND "purchaseDate" >= ${start} AND "purchaseDate" <= ${end}
        ) d
        LEFT JOIN (
          SELECT DATE_TRUNC('day', s."createdAt") as day, SUM(s."totalAmount") as sales_total, SUM(si.quantity * p."purchasePrice") as cogs_total
          FROM "sales" s
          JOIN "sale_items" si ON si."saleId" = s.id
          JOIN "products" p ON p.id = si."productId"
          WHERE s."businessId" = ${businessId} AND s.status = 'COMPLETED' AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
          GROUP BY 1
        ) s ON s.day = d.day
        LEFT JOIN (
          SELECT DATE_TRUNC('day', "purchaseDate") as day, SUM("total") as purchases_total
          FROM "purchases"
          WHERE "businessId" = ${businessId} AND status IN ('APPROVED', 'RECEIVED', 'COMPLETED', 'PAID') AND "purchaseDate" >= ${start} AND "purchaseDate" <= ${end}
          GROUP BY 1
        ) p ON p.day = d.day
        ORDER BY d.day ASC
      `;
    }

    return {
      totalSales,
      totalCogs,
      totalPurchases,
      grossMargin,
      marginPercentage,
      netFlow: grossMargin,
      dailyFinancial: dailyFinancial.map(df => {
        const salesVal = Number(df.sales || 0);
        const cogsVal = Number(df.cogs || 0);
        const purchasesVal = Number(df.purchases || 0);
        const marginVal = salesVal - cogsVal;
        return {
          day: df.day,
          sales: salesVal,
          cogs: cogsVal,
          purchases: purchasesVal,
          margin: marginVal
        };
      })
    };
  }

  async getCustomersMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    const warehouseId = filters?.warehouseId && filters.warehouseId !== 'ALL' ? filters.warehouseId : null;

    const baseWhere: any = { businessId };
    if (warehouseId) {
      baseWhere.sales = { some: { warehouseId } };
    }

    const newCustomersWhere: any = { businessId, createdAt: { gte: start, lte: end } };
    if (warehouseId) {
      newCustomersWhere.sales = { some: { warehouseId } };
    }

    return {
      totalActive: await prisma.customer.count({ where: baseWhere }),
      newCustomers: await prisma.customer.count({ where: newCustomersWhere }),
      ranking: [],
    };
  }

  async getProductsMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    const warehouseId = filters?.warehouseId && filters.warehouseId !== 'ALL' ? filters.warehouseId : null;
    
    let totalValuation = 0;
    if (warehouseId) {
      const res = await prisma.$queryRaw<any[]>`
         SELECT SUM(s.quantity * p."purchasePrice") as total
         FROM "stocks" s JOIN "products" p ON p.id = s."productId"
         WHERE s."businessId" = ${businessId} AND s."warehouseId" = ${warehouseId}
      `;
      totalValuation = parseFloat(res[0]?.total || 0);
    } else {
      const res = await prisma.$queryRaw<any[]>`
         SELECT SUM(s.quantity * p."purchasePrice") as total
         FROM "stocks" s JOIN "products" p ON p.id = s."productId"
         WHERE s."businessId" = ${businessId}
      `;
      totalValuation = parseFloat(res[0]?.total || 0);
    }

    let topSelling: any[] = [];
    let categorySales: any[] = [];

    if (warehouseId) {
      topSelling = await prisma.$queryRaw`
        SELECT 
          p.id as "productId",
          p.name, 
          p.sku, 
          SUM(si.quantity) as qty, 
          SUM(si."totalAmount") as total_revenue,
          SUM(si.quantity * p."purchasePrice") as total_cost
        FROM "sale_items" si 
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId} 
          AND s."warehouseId" = ${warehouseId} 
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_revenue DESC
        LIMIT 100
      `;

      categorySales = await prisma.$queryRaw`
        SELECT 
          c.name, 
          SUM(si.quantity) as qty, 
          SUM(si."totalAmount") as total_revenue,
          SUM(si.quantity * p."purchasePrice") as total_cost
        FROM "sale_items" si 
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        JOIN "categories" c ON c.id = p."categoryId"
        WHERE s."businessId" = ${businessId} 
          AND s."warehouseId" = ${warehouseId} 
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC
      `;
    } else {
      topSelling = await prisma.$queryRaw`
        SELECT 
          p.id as "productId",
          p.name, 
          p.sku, 
          SUM(si.quantity) as qty, 
          SUM(si."totalAmount") as total_revenue,
          SUM(si.quantity * p."purchasePrice") as total_cost
        FROM "sale_items" si 
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        WHERE s."businessId" = ${businessId} 
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_revenue DESC
        LIMIT 100
      `;

      categorySales = await prisma.$queryRaw`
        SELECT 
          c.name, 
          SUM(si.quantity) as qty, 
          SUM(si."totalAmount") as total_revenue,
          SUM(si.quantity * p."purchasePrice") as total_cost
        FROM "sale_items" si 
        JOIN "sales" s ON s.id = si."saleId"
        JOIN "products" p ON p.id = si."productId"
        JOIN "categories" c ON c.id = p."categoryId"
        WHERE s."businessId" = ${businessId} 
          AND s."status" = 'COMPLETED'
          AND s."createdAt" >= ${start} AND s."createdAt" <= ${end}
        GROUP BY c.id, c.name
        ORDER BY total_revenue DESC
      `;
    }

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
         WHERE si."productId" = p.id AND s."status" = 'COMPLETED' AND s."createdAt" >= ${dateLimit}
      )
      GROUP BY p.id, p.name, p.sku
      HAVING SUM(st.quantity) > 0
      LIMIT 100
    `;

    let totalRevenue = 0;
    let totalCost = 0;
    topSelling.forEach(item => {
      totalRevenue += Number(item.total_revenue || 0);
      totalCost += Number(item.total_cost || 0);
    });

    const overallGrossProfit = totalRevenue - totalCost;
    const averageMargin = totalRevenue > 0 ? (overallGrossProfit / totalRevenue) * 100 : 0;

    const summary = {
      activeProducts: await prisma.product.count({ where: { businessId, status: 'ACTIVE' } }),
      totalValuation,
      withoutMovement: slowMoving.length,
      averageMargin
    };

    const mappedTopSelling = topSelling.map(i => {
      const rev = Number(i.total_revenue || 0);
      const cost = Number(i.total_cost || 0);
      const profit = rev - cost;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      return {
        producto: i.name,
        sku: i.sku || 'S/S',
        cantidad: Number(i.qty || 0),
        facturacion: rev,
        costo: cost,
        ganancia: profit,
        margen: margin
      };
    });

    const mappedCategories = categorySales.map(i => {
      const rev = Number(i.total_revenue || 0);
      const cost = Number(i.total_cost || 0);
      const profit = rev - cost;
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      return {
        name: i.name,
        qty: Number(i.qty || 0),
        total: rev,
        cost,
        ganancia: profit,
        margen: margin
      };
    });

    const mappedProfitability = mappedTopSelling.map(i => ({
      producto: i.producto,
      ventas: i.cantidad,
      facturacion: i.facturacion,
      costo: i.costo,
      ganancia: i.ganancia,
      margen: i.margen
    }));

    return {
      summary,
      topSelling: mappedTopSelling,
      inactive: slowMoving.map(i => ({ producto: i.name, sku: i.sku || 'S/S', stock: Number(i.stock_qty || 0), lastSale: `Hace más de ${queryDays} días` })),
      categories: mappedCategories,
      profitability: mappedProfitability
    };
  }

  async getUsersMetrics(businessId: string, start: Date, end: Date, filters: any) {
    if (!businessId) throw new Error('businessId is mandatory for reporting');
    const baseWhere: any = { businessId, createdAt: { gte: start, lte: end } };
    if (filters?.warehouseId && filters.warehouseId !== 'ALL') baseWhere.warehouseId = filters.warehouseId;
    
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

    const where: any = {
      businessId,
      NOT: [
        { businessId: 'SYSTEM' },
        { entityName: { in: ['PLAN', 'SUBSCRIPTION', 'INVOICE', 'PLAN_PRICE'] } },
        { actionType: { in: [
          'CREATE_STAFF', 'REMOVE_STAFF',
          'VIEW_BUSINESS', 'VIEW_USER', 'SUSPEND_USER', 'RESTORE_USER', 'DELETE_USER_FORCED', 'DELETE_USER',
          'PLAN_PRICE_REACTIVATED', 'PLAN_PRICE_CREATED', 'PLAN_PRICE_UPDATED', 'PLAN_PRICE_ACTIVATED', 'PLAN_PRICE_DEACTIVATED', 'PLAN_PRICE_DELETED',
          'PAYMENT_APPROVED', 'PAYMENT_PENDING', 'SUBSCRIPTION_RENEWED', 'PLAN_CHANGED'
        ] } }
      ]
    };

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.module && filters.module !== 'ALL') {
      where.entityName = { contains: filters.module, mode: 'insensitive' };
    }

    if (filters?.action && filters.action !== 'ALL') {
      where.actionType = { contains: filters.action, mode: 'insensitive' };
    }

    if (filters?.warehouseId && filters.warehouseId !== 'ALL') {
      const wId = filters.warehouseId;
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { newValues: { contains: wId } },
            { previousValues: { contains: wId } },
          ],
        },
      ];
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
