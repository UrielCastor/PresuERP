import api from './api';

export interface PaymentAdjustmentRule {
  id: string;
  businessId: string;
  paymentMethod: 'CASH' | 'TRANSFER' | 'MERCADOPAGO' | 'DEBIT_CARD' | 'CREDIT_CARD';
  adjustmentType: 'DISCOUNT' | 'SURCHARGE';
  valueType: 'PERCENTAGE' | 'FIXED';
  value: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const paymentAdjustmentRuleService = {
  getAll: async (): Promise<PaymentAdjustmentRule[]> => {
    const response = await api.get('/payment-adjustment-rules');
    const resData = response.data;
    if (Array.isArray(resData)) return resData;
    if (resData && Array.isArray(resData.data)) return resData.data;
    return [];
  },

  create: async (data: Omit<PaymentAdjustmentRule, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>): Promise<PaymentAdjustmentRule> => {
    const response = await api.post<{ success: boolean; data: PaymentAdjustmentRule }>('/payment-adjustment-rules', data);
    return response.data.data;
  },

  update: async (id: string, data: Partial<Omit<PaymentAdjustmentRule, 'id' | 'businessId' | 'createdAt' | 'updatedAt'>>): Promise<PaymentAdjustmentRule> => {
    const response = await api.put<{ success: boolean; data: PaymentAdjustmentRule }>(`/payment-adjustment-rules/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/payment-adjustment-rules/${id}`);
  }
};

export interface PaymentAdjustmentCalculation {
  adjustmentAmount: number;
  rawAdjustmentAmount: number;
  finalTotal: number;
  type: 'NONE' | 'DISCOUNT' | 'SURCHARGE';
  label: string;
  rawValue: number;
  valueType: 'PERCENTAGE' | 'FIXED';
}

export function calculatePaymentAdjustment(
  baseAmount: number,
  paymentMethod: string | null | undefined,
  rules: PaymentAdjustmentRule[]
): PaymentAdjustmentCalculation {
  if (!baseAmount || baseAmount <= 0 || !paymentMethod || paymentMethod === 'NONE' || paymentMethod === 'UNSELECTED') {
    return {
      adjustmentAmount: 0,
      rawAdjustmentAmount: 0,
      finalTotal: baseAmount || 0,
      type: 'NONE',
      label: '',
      rawValue: 0,
      valueType: 'FIXED',
    };
  }

  let targetMethod = paymentMethod.toUpperCase();
  if (targetMethod === 'MERCADO_PAGO') targetMethod = 'MERCADOPAGO';
  if (targetMethod === 'CARD') targetMethod = 'CREDIT_CARD';

  const rawList = Array.isArray(rules)
    ? rules
    : (rules as any)?.data && Array.isArray((rules as any).data)
    ? (rules as any).data
    : [];

  const activeRule = rawList.find(
    (r: any) =>
      (r.paymentMethod === targetMethod || r.paymentMethod === paymentMethod) &&
      (r.active === true || r.active === 'true' || r.active === 1)
  );

  if (!activeRule) {
    return {
      adjustmentAmount: 0,
      rawAdjustmentAmount: 0,
      finalTotal: baseAmount,
      type: 'NONE',
      label: '',
      rawValue: 0,
      valueType: 'FIXED',
    };
  }

  const ruleVal = Number(activeRule.value || 0);
  let rawAmount = 0;
  if (activeRule.valueType === 'PERCENTAGE') {
    rawAmount = Math.round(((baseAmount * ruleVal) / 100) * 100) / 100;
  } else {
    rawAmount = ruleVal;
  }

  if (activeRule.adjustmentType === 'DISCOUNT') {
    const finalTotal = Math.max(0, baseAmount - rawAmount);
    const label = `Descuento ${activeRule.valueType === 'PERCENTAGE' ? `${ruleVal}%` : `$${ruleVal}`}`;
    return {
      adjustmentAmount: -rawAmount,
      rawAdjustmentAmount: rawAmount,
      finalTotal,
      type: 'DISCOUNT',
      label,
      rawValue: ruleVal,
      valueType: activeRule.valueType,
    };
  } else if (activeRule.adjustmentType === 'SURCHARGE') {
    const finalTotal = baseAmount + rawAmount;
    const label = `Recargo ${activeRule.valueType === 'PERCENTAGE' ? `${ruleVal}%` : `$${ruleVal}`}`;
    return {
      adjustmentAmount: rawAmount,
      rawAdjustmentAmount: rawAmount,
      finalTotal,
      type: 'SURCHARGE',
      label,
      rawValue: ruleVal,
      valueType: activeRule.valueType,
    };
  }

  return {
    adjustmentAmount: 0,
    rawAdjustmentAmount: 0,
    finalTotal: baseAmount,
    type: 'NONE',
    label: '',
    rawValue: 0,
    valueType: 'FIXED',
  };
}
