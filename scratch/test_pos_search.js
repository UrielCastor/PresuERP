// Test helper to verify POS search logic matches all user requirements exactly

const mockProducts = [
  { id: 'PROD-001', name: 'Fernet Branca 750ml', barcode: '7791234567890', sku: 'FER-750', status: 'ACTIVE', totalStock: 10, salePrice: 12740 },
  { id: 'PROD-002', name: 'Coca Cola 2.25L', barcode: '7790001112223', sku: 'COC-225', status: 'ACTIVE', totalStock: 15, salePrice: 2500 },
  { id: 'PROD-003', name: 'Coca Cola Zero 2.25L', barcode: '7790001112224', sku: 'COC-ZER', status: 'ACTIVE', totalStock: 8, salePrice: 2500 },
  { id: 'PROD-004', name: 'Agua Mineral 1.5L', barcode: '7799999999999', sku: 'AGU-15', status: 'ACTIVE', totalStock: 0, salePrice: 1000 },
];

function performPOSSearch(query, products) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return { type: 'EMPTY' };
  const lowerQuery = cleanQuery.toLowerCase();
  const activeProducts = products.filter((p) => p.status === 'ACTIVE');

  // 1. Coincidencia exacta: 1) Barcode, 2) SKU, 3) ID
  let exactMatch = activeProducts.find(
    (p) => p.barcode && p.barcode.trim().toLowerCase() === lowerQuery
  );

  if (!exactMatch) {
    exactMatch = activeProducts.find(
      (p) => p.sku && p.sku.trim().toLowerCase() === lowerQuery
    );
  }

  if (!exactMatch) {
    exactMatch = activeProducts.find(
      (p) => p.id && p.id.trim().toLowerCase() === lowerQuery
    );
  }

  if (exactMatch) {
    if (exactMatch.totalStock <= 0) {
      return { type: 'ERROR', message: 'Producto sin stock disponible', product: exactMatch };
    }
    return { type: 'AUTO_ADD', product: exactMatch };
  }

  // 2. Coincidencia por nombre / parcial
  const nameMatches = activeProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      (p.barcode && p.barcode.toLowerCase().includes(lowerQuery)) ||
      (p.sku && p.sku.toLowerCase().includes(lowerQuery))
  );

  if (nameMatches.length === 1) {
    const singleProduct = nameMatches[0];
    if (singleProduct.totalStock <= 0) {
      return { type: 'ERROR', message: 'Producto sin stock disponible', product: singleProduct };
    }
    return { type: 'AUTO_ADD', product: singleProduct };
  } else if (nameMatches.length > 1) {
    return { type: 'MULTIPLE_MATCHES', matches: nameMatches };
  } else {
    return { type: 'ERROR', message: 'Producto no encontrado' };
  }
}

// Suite de Pruebas
console.log('====================================================');
console.log('🧪 VERIFICACIÓN AUTOMATIZADA: LÓGICA DE BÚSQUEDA POS');
console.log('====================================================\n');

// Test 1: Escaneo por código de barras exacto (USB Barcode Reader)
const res1 = performPOSSearch('7791234567890', mockProducts);
console.log('Test 1: Barcode exacto "7791234567890" ➔', res1.type, res1.product?.name);
if (res1.type !== 'AUTO_ADD' || res1.product.id !== 'PROD-001') throw new Error('Test 1 falló');

// Test 2: Búsqueda por SKU exacto
const res2 = performPOSSearch('COC-225', mockProducts);
console.log('Test 2: SKU exacto "COC-225" ➔', res2.type, res2.product?.name);
if (res2.type !== 'AUTO_ADD' || res2.product.id !== 'PROD-002') throw new Error('Test 2 falló');

// Test 3: Búsqueda por Nombre con único resultado
const res3 = performPOSSearch('Fernet', mockProducts);
console.log('Test 3: Nombre único "Fernet" ➔', res3.type, res3.product?.name);
if (res3.type !== 'AUTO_ADD' || res3.product.id !== 'PROD-001') throw new Error('Test 3 falló');

// Test 4: Búsqueda por Nombre con múltiples resultados ("coca")
const res4 = performPOSSearch('coca', mockProducts);
console.log('Test 4: Nombre múltiple "coca" ➔', res4.type, `(${res4.matches?.length} coincidencias, NO agrega automático)`);
if (res4.type !== 'MULTIPLE_MATCHES' || res4.matches.length !== 2) throw new Error('Test 4 falló');

// Test 5: Producto Inexistente
const res5 = performPOSSearch('999888777666', mockProducts);
console.log('Test 5: Inexistente "999888777666" ➔', res5.type, res5.message);
if (res5.type !== 'ERROR' || res5.message !== 'Producto no encontrado') throw new Error('Test 5 falló');

// Test 6: Producto Sin Stock
const res6 = performPOSSearch('AGU-15', mockProducts);
console.log('Test 6: Sin stock "AGU-15" ➔', res6.type, res6.message);
if (res6.type !== 'ERROR' || res6.message !== 'Producto sin stock disponible') throw new Error('Test 6 falló');

console.log('\n====================================================');
console.log('🎉 BÚSQUEDA POS PROFESIONAL: 100% OK (6/6 PRUEBAS PASADAS)');
console.log('====================================================\n');
