/**
 * Centralized function to resolve effective unit price of a product for a given price list and quantity.
 * PRIORIDAD COMERCIAL DE PRECIOS:
 * 1. Precio especial por Lista de Precios (PriceListItem). Si existe tarifa específica para la lista seleccionada respetando minQuantity <= quantity.
 * 2. Regla de Precio por Cantidad (ProductPriceTier). Regla comercial global activa con mayor minQuantity <= quantity.
 * 3. Promoción Automática (Promotion). 2x1, 2da Unidad con % o Pack especial.
 * 4. Precio Base (Product.salePrice / basePrice). Fallback final.
 */

export interface PriceResolutionResult {
  unitPrice: number;
  appliedRuleType: 'PRICE_LIST' | 'PRICE_TIER' | 'PROMOTION' | 'BASE';
  appliedRuleName?: string;
  promoNotice?: string;
}

export function resolveProductPriceDetails(
  product: any,
  priceListId?: string | null,
  quantity: number = 1
): PriceResolutionResult {
  if (!product) return { unitPrice: 0, appliedRuleType: 'BASE' };

  const basePrice = Number(
    product.basePrice !== undefined && product.basePrice !== null
      ? product.basePrice
      : product.originalSalePrice !== undefined && product.originalSalePrice !== null
      ? product.originalSalePrice
      : product.salePrice || 0
  );

  let matchingPriceListItem: any = null;
  if (priceListId && product.priceListItems && Array.isArray(product.priceListItems) && product.priceListItems.length > 0) {
    const listItems = product.priceListItems
      .filter((item: any) => item.priceListId === priceListId && Number(item.minQuantity) <= quantity)
      .sort((a: any, b: any) => Number(b.minQuantity) - Number(a.minQuantity));

    if (listItems.length > 0) {
      matchingPriceListItem = listItems[0];
    }
  }

  let matchingTier: any = null;
  if (product.priceTiers && Array.isArray(product.priceTiers) && product.priceTiers.length > 0) {
    const tiers = product.priceTiers
      .filter((tier: any) => (tier.isActive === undefined || tier.isActive === true) && Number(tier.minQuantity) <= quantity)
      .sort((a: any, b: any) => Number(b.minQuantity) - Number(a.minQuantity));

    if (tiers.length > 0) {
      matchingTier = tiers[0];
    }
  }

  let matchingPromo: any = null;
  if (product.promotions && Array.isArray(product.promotions) && product.promotions.length > 0) {
    const promos = product.promotions
      .filter((p: any) => (p.isActive === undefined || p.isActive === true) && quantity >= Number(p.minQuantity))
      .sort((a: any, b: any) => Number(b.minQuantity) - Number(a.minQuantity));

    if (promos.length > 0) {
      matchingPromo = promos[0];
    }
  }

  // Evaluación combinada respetando prioridades comerciales:
  if (matchingPriceListItem && matchingTier) {
    const pliMinQty = Number(matchingPriceListItem.minQuantity) || 1;
    const tierMinQty = Number(matchingTier.minQuantity) || 1;

    if (pliMinQty > 1 && pliMinQty >= tierMinQty) {
      return { unitPrice: Number(matchingPriceListItem.price), appliedRuleType: 'PRICE_LIST' };
    }
    if (tierMinQty > pliMinQty) {
      return { unitPrice: Number(matchingTier.price), appliedRuleType: 'PRICE_TIER' };
    }
    return { unitPrice: Number(matchingPriceListItem.price), appliedRuleType: 'PRICE_LIST' };
  }

  if (matchingPriceListItem) {
    return { unitPrice: Number(matchingPriceListItem.price), appliedRuleType: 'PRICE_LIST' };
  }

  if (matchingTier) {
    return { unitPrice: Number(matchingTier.price), appliedRuleType: 'PRICE_TIER' };
  }

  if (matchingPromo) {
    const qty = quantity;
    let effectivePrice = basePrice;
    let promoText = matchingPromo.name || 'Promoción aplicada';

    if (matchingPromo.type === 'TWO_FOR_ONE') {
      effectivePrice = (basePrice * Math.ceil(qty / 2)) / qty;
      promoText = `Promoción aplicada: 2x1 (${matchingPromo.name})`;
    } else if (matchingPromo.type === 'SECOND_UNIT_DISCOUNT') {
      const desc = Number(matchingPromo.discountPercentage) || 0;
      effectivePrice = (basePrice * Math.ceil(qty / 2) + basePrice * (1 - desc / 100) * Math.floor(qty / 2)) / qty;
      promoText = `Promoción aplicada: 2da unidad ${desc}% OFF (${matchingPromo.name})`;
    } else if (matchingPromo.type === 'SPECIAL_PACK') {
      const packPrice = Number(matchingPromo.specialPrice) || basePrice;
      const packQty = Number(matchingPromo.minQuantity) || 1;
      effectivePrice = (packPrice * Math.floor(qty / packQty) + basePrice * (qty % packQty)) / qty;
      promoText = `Promoción aplicada: Pack Especial (${matchingPromo.name})`;
    }

    return {
      unitPrice: effectivePrice,
      appliedRuleType: 'PROMOTION',
      appliedRuleName: matchingPromo.name,
      promoNotice: promoText,
    };
  }

  return { unitPrice: basePrice, appliedRuleType: 'BASE' };
}

export function resolveProductPrice(
  product: any,
  priceListId?: string | null,
  quantity: number = 1
): number {
  return resolveProductPriceDetails(product, priceListId, quantity).unitPrice;
}

// Alias para mantener compatibilidad total
export const getEffectiveProductPrice = resolveProductPrice;
