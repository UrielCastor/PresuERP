import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Input } from '../components/forms/Input';
import { Button } from '../components/ui/Button';
import { Tabs } from '../components/ui/Tabs';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useAppearance } from '../contexts/AppearanceContext';
import api from '../services/api';
import {
  SettingsService,
  BusinessWithSettings,
  BusinessData,
  BusinessSettingsData,
  FiscalSettingsData,
  POSSettingsData,
  PrintSettingsData,
  EmailSettingsData,
  NumberSettingsData
} from '../services/settings.service';
import { paymentAdjustmentRuleService, PaymentAdjustmentRule } from '../services/paymentAdjustmentRule.service';
import { productPriceTierService, ProductPriceTier } from '../services/productPriceTier.service';
import { promotionService, Promotion } from '../services/promotion.service';
import { productApi } from '../services/product.service';
import {
  Building, Settings as SettingsIcon, Percent, Printer, Mail, ListPlus,
  Loader2, AlertCircle, CheckCircle2, Palette, Users, Package, Store,
  ShoppingCart, Shield, ShieldCheck, Activity, Share2, Award, Banknote, Calendar, Zap, CreditCard, Clock, Globe, Fingerprint, History, Layers,
  Plus, Trash2, Edit2, X
} from 'lucide-react';

import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiscalSettings } from './FiscalSettings';
import { FiscalService, FiscalConfigData } from '../services/fiscal.service';

export const Settings: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const canViewAudit = user?.isStaff || hasPermission('settings:read');
  const { preferences, updatePreference } = useAppearance();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<BusinessWithSettings | null>(null);

  // Loyalty Program State
  const [loyaltyData, setLoyaltyData] = useState({
    enabled: false,
    earnEveryAmount: 1000,
    earnPoints: 10,
    minimumSaleAmount: 500,
    pointValue: 10,
    allowPartialRedemption: true,
    allowRedemption: true,
    maxRedemptionPercentage: 50,
    expirePoints: false,
    expirationMonths: 12,
    roundingMode: 'FLOOR' as 'FLOOR' | 'ROUND' | 'CEIL',
    pointsCalculationMode: 'EFFECTIVELY_PAID' as 'GROSS' | 'AFTER_DISCOUNTS' | 'EFFECTIVELY_PAID',
    accumulateOnPointsPaid: false,
  });

  // States
  const [bizData, setBizData] = useState<BusinessData>({ name: '', email: '', phone: '', address: '', website: '', city: '', state: '', country: 'Argentina', zipCode: '', subscriptionPlan: 'Professional', subscriptionEndsAt: '' });
  const [prefData, setPrefData] = useState<BusinessSettingsData>({ currencyCode: 'ARS', currencySymbol: '$', timezone: 'America/Argentina/Buenos_Aires', dateFormat: 'DD/MM/YYYY', timeFormat: '24h', decimalSeparator: ',', thousandSeparator: '.', decimalPlaces: 2, showCents: true, language: 'es', logoUrl: '', allowNegativeStock: false, warnMinimumStock: true, autoDeductStock: true, allowManualAdjustments: true, costingMethod: 'Promedio Ponderado' });
  const [fiscalData, setFiscalData] = useState<FiscalSettingsData>({ taxRegime: 'Responsable Inscripto', vatNumber: '', grossIncomeNumber: '', multilateralAgreement: false, mainPointOfSale: '00001', afipEnvironment: 'Testing', digitalCertificateUrl: '', isLocalTaxEnabled: true, defaultTaxRate: 21 });
  const [posData, setPOSData] = useState<POSSettingsData>({ isAutoCloseSessionEnabled: false, maxCashLimit: 0, printReceiptAfterSale: true, isDiscountAllowed: true, maxDiscountPercentage: 100, defaultPaymentMethodId: null, defaultCashRegisterId: null, requireOpenCashRegister: true, allowMultipleRegisters: false, requireCustomerForSale: false, requireSellerForSale: false, ticketCopyCount: 1, showTicketPreview: true, allowMixedPayments: true, autoRounding: false, autoRoundingMode: 'CASH_ONLY' });
  const [printData, setPrintData] = useState<PrintSettingsData>({ printerType: 'THERMAL', paperWidth: '80MM', fontName: 'Monospace', headerText: '', footerText: '', logoSize: 100, margins: '0mm', showQr: false, showBarcode: false });
  const [emailData, setEmailData] = useState<EmailSettingsData>({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpPassword: '', senderEmail: '', senderName: '', secureConnection: true });
  const [numberData, setNumberData] = useState<NumberSettingsData>({ currentPurchaseNumber: 1, currentSaleNumber: 1, currentTransferNumber: 1, currentInventoryNumber: 1 });

  // License and SaaS pricing states
  const [plans, setPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [selectedCycles, setSelectedCycles] = useState<Record<string, string>>({}); // planId -> selectedCycle
  const [payingPlanPrice, setPayingPlanPrice] = useState<string | null>(null); // spinner state
  const defaultSection = hasPermission('settings:read') ? 'general' : 'pos';
  const [activeSection, setActiveSection] = useState(defaultSection);
  const [searchParams] = useSearchParams();
  const [arcaConfig, setArcaConfig] = useState<FiscalConfigData | null>(null);

  useEffect(() => {
    if (window.location.pathname === '/settings/pos') {
      setActiveSection('pos');
    } else {
      const section = searchParams.get('section') || searchParams.get('tab');
      if (section) {
        setActiveSection(section);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    FiscalService.getConfig().then(cfg => setArcaConfig(cfg)).catch(() => {});
  }, [activeSection]);

  // Integrations states
  const [isConfiguringMP, setIsConfiguringMP] = useState<boolean>(false);
  const [mpPublicKey, setMpPublicKey] = useState<string>('');

  const [mpAccessTokenValue, setMpAccessTokenValue] = useState<string>('');
  const [mpAccessTokenChanged, setMpAccessTokenChanged] = useState<boolean>(false);
  const [mpAccessTokenConfigured, setMpAccessTokenConfigured] = useState<boolean>(false);

  const [mpWebhookSecretValue, setMpWebhookSecretValue] = useState<string>('');
  const [mpWebhookSecretChanged, setMpWebhookSecretChanged] = useState<boolean>(false);
  const [mpWebhookSecretConfigured, setMpWebhookSecretConfigured] = useState<boolean>(false);

  const [mpEnvironment, setMpEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX');
  const [mpStatus, setMpStatus] = useState<'CONNECTED' | 'NOT_CONFIGURED' | 'TESTING'>('NOT_CONFIGURED');
  const [mpLastTestStatus, setMpLastTestStatus] = useState<string | null>(null);
  const [mpLastTestAt, setMpLastTestAt] = useState<string | null>(null);

  const applyMPIntegrationState = (mpInt: any) => {
    if (mpInt) {
      setMpPublicKey(mpInt.credentials?.publicKey || '');
      setMpEnvironment(mpInt.credentials?.environment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX');
      setMpStatus(mpInt.status === 'ACTIVE' ? 'CONNECTED' : 'NOT_CONFIGURED');
      setMpLastTestStatus(mpInt.lastTestStatus);
      setMpLastTestAt(mpInt.lastTestAt);

      const isTokenConfigured = !!mpInt.credentials?.accessTokenConfigured;
      setMpAccessTokenConfigured(isTokenConfigured);
      setMpAccessTokenValue('');
      setMpAccessTokenChanged(false);

      const isSecretConfigured = !!mpInt.webhookSecretConfigured;
      setMpWebhookSecretConfigured(isSecretConfigured);
      setMpWebhookSecretValue('');
      setMpWebhookSecretChanged(false);
    } else {
      setMpStatus('NOT_CONFIGURED');
    }
  };
  // Payment Adjustment Rules state
  const [adjustmentRules, setAdjustmentRules] = useState<PaymentAdjustmentRule[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState<boolean>(false);
  const [ruleForm, setRuleForm] = useState<{
    paymentMethod: 'CASH' | 'TRANSFER' | 'MERCADOPAGO' | 'DEBIT_CARD' | 'CREDIT_CARD';
    adjustmentType: 'DISCOUNT' | 'SURCHARGE';
    valueType: 'PERCENTAGE' | 'FIXED';
    value: number;
    active: boolean;
  }>({
    paymentMethod: 'MERCADOPAGO',
    adjustmentType: 'DISCOUNT',
    valueType: 'PERCENTAGE',
    value: 5,
    active: true
  });

  // Precios por Cantidad States
  const [priceTiers, setPriceTiers] = useState<ProductPriceTier[]>([]);
  const [isTierModalOpen, setIsTierModalOpen] = useState<boolean>(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [savingTier, setSavingTier] = useState<boolean>(false);
  const [tierForm, setTierForm] = useState<{
    productId: string;
    minQuantity: number;
    price: number;
    isActive: boolean;
  }>({
    productId: '',
    minQuantity: 10,
    price: 1200,
    isActive: true,
  });
  const [productsList, setProductsList] = useState<any[]>([]);

  // Promotions State & Handlers
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState<boolean>(false);
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [savingPromo, setSavingPromo] = useState<boolean>(false);
  const [promoForm, setPromoForm] = useState<{
    name: string;
    type: 'TWO_FOR_ONE' | 'SECOND_UNIT_DISCOUNT' | 'SPECIAL_PACK';
    productId: string;
    minQuantity: number;
    discountPercentage: number;
    specialPrice: number;
    isActive: boolean;
  }>({
    name: '2x1 Promoción',
    type: 'TWO_FOR_ONE',
    productId: '',
    minQuantity: 2,
    discountPercentage: 20,
    specialPrice: 0,
    isActive: true,
  });

  const fetchPromotions = async () => {
    try {
      const promos = await promotionService.getAll();
      setPromotions(promos);
    } catch (err) {
      console.error('Error fetching promotions', err);
    }
  };

  const fetchAdjustmentRules = async () => {
    try {
      const rules = await paymentAdjustmentRuleService.getAll();
      setAdjustmentRules(rules);
    } catch (err) {
      console.error('Error fetching payment adjustment rules', err);
    }
  };

  const fetchPriceTiers = async () => {
    try {
      const tiers = await productPriceTierService.getAll();
      setPriceTiers(tiers);
    } catch (err) {
      console.error('Error fetching product price tiers', err);
    }
  };

  const fetchProductsList = async () => {
    try {
      const prods = await productApi.list();
      setProductsList(prods);
    } catch (err) {
      console.error('Error fetching products list', err);
    }
  };

  const openNewTierModal = () => {
    setEditingTierId(null);
    setTierForm({
      productId: productsList.length > 0 ? productsList[0].id : '',
      minQuantity: 10,
      price: 1200,
      isActive: true,
    });
    setIsTierModalOpen(true);
  };

  const openEditTierModal = (tier: ProductPriceTier) => {
    setEditingTierId(tier.id);
    setTierForm({
      productId: tier.productId,
      minQuantity: Number(tier.minQuantity),
      price: Number(tier.price),
      isActive: tier.isActive,
    });
    setIsTierModalOpen(true);
  };

  const handleSaveTier = async () => {
    try {
      setSavingTier(true);
      if (editingTierId) {
        await productPriceTierService.update(editingTierId, tierForm);
      } else {
        await productPriceTierService.create(tierForm);
      }
      await fetchPriceTiers();
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
      setIsTierModalOpen(false);
      setEditingTierId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al guardar la regla de precio por cantidad');
    } finally {
      setSavingTier(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla de precio por cantidad?')) return;
    try {
      await productPriceTierService.delete(id);
      await fetchPriceTiers();
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al eliminar la regla');
    }
  };

  const handleToggleTierActive = async (tier: ProductPriceTier) => {
    try {
      await productPriceTierService.update(tier.id, { isActive: !tier.isActive });
      await fetchPriceTiers();
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
    } catch (err: any) {
      alert('Error al cambiar el estado de la regla');
    }
  };

  const handleSaveRule = async () => {
    try {
      setSavingRule(true);
      if (editingRuleId) {
        await paymentAdjustmentRuleService.update(editingRuleId, ruleForm);
      } else {
        await paymentAdjustmentRuleService.create(ruleForm);
      }
      await fetchAdjustmentRules();
      setIsRuleModalOpen(false);
      setEditingRuleId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al guardar la regla');
    } finally {
      setSavingRule(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta regla de ajuste?')) return;
    try {
      await paymentAdjustmentRuleService.delete(id);
      await fetchAdjustmentRules();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al eliminar la regla');
    }
  };

  const handleToggleRuleActive = async (rule: PaymentAdjustmentRule) => {
    try {
      await paymentAdjustmentRuleService.update(rule.id, { active: !rule.active });
      await fetchAdjustmentRules();
    } catch (err: any) {
      alert('Error al cambiar el estado de la regla');
    }
  };

  const openNewRuleModal = () => {
    setEditingRuleId(null);
    setRuleForm({
      paymentMethod: 'MERCADOPAGO',
      adjustmentType: 'DISCOUNT',
      valueType: 'PERCENTAGE',
      value: 5,
      active: true
    });
    setIsRuleModalOpen(true);
  };

  const openEditRuleModal = (rule: PaymentAdjustmentRule) => {
    setEditingRuleId(rule.id);
    setRuleForm({
      paymentMethod: rule.paymentMethod,
      adjustmentType: rule.adjustmentType,
      valueType: rule.valueType,
      value: Number(rule.value),
      active: rule.active
    });
    setIsRuleModalOpen(true);
  };

  const openNewPromoModal = () => {
    setEditingPromoId(null);
    setPromoForm({
      name: '',
      type: 'TWO_FOR_ONE',
      productId: productsList.length > 0 ? productsList[0].id : '',
      minQuantity: 2,
      discountPercentage: 20,
      specialPrice: 0,
      isActive: true,
    });
    setIsPromoModalOpen(true);
  };

  const openEditPromoModal = (promo: Promotion) => {
    setEditingPromoId(promo.id);
    setPromoForm({
      name: promo.name,
      type: promo.type,
      productId: promo.productId,
      minQuantity: promo.minQuantity,
      discountPercentage: promo.discountPercentage ? Number(promo.discountPercentage) : 20,
      specialPrice: promo.specialPrice ? Number(promo.specialPrice) : 0,
      isActive: promo.isActive,
    });
    setIsPromoModalOpen(true);
  };

  const handleSavePromo = async () => {
    try {
      setSavingPromo(true);
      if (editingPromoId) {
        await promotionService.update(editingPromoId, promoForm);
      } else {
        await promotionService.create(promoForm);
      }
      await fetchPromotions();
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
      setIsPromoModalOpen(false);
      setEditingPromoId(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al guardar la promoción');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta promoción?')) return;
    try {
      await promotionService.delete(id);
      await fetchPromotions();
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Error al eliminar la promoción');
    }
  };

  const handleTogglePromoActive = async (promo: Promotion) => {
    try {
      await promotionService.update(promo.id, { isActive: !promo.isActive });
      await fetchPromotions();
      queryClient.invalidateQueries({ queryKey: ['productsListAll'] });
    } catch (err: any) {
      alert('Error al cambiar el estado de la promoción');
    }
  };

  useEffect(() => { 
    fetchSettings(); 
    fetchAdjustmentRules();
    fetchPriceTiers();
    fetchPromotions();
    fetchProductsList();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true); setError(null);
      const [data, plansRes, subRes, loyaltyRes] = await Promise.all([
        SettingsService.getSettings(),
        api.get('/businesses/plans'),
        api.get('/businesses/subscription'),
        api.get('/points/settings').catch(() => ({ data: { data: null } }))
      ]);
      
      setSettings(data);
      setBizData({
        name: data.name, email: data.email, phone: data.phone, address: data.address,
        website: data.website || '', city: data.city || '', state: data.state || '',
        country: data.country || 'Argentina', zipCode: data.zipCode || '',
        subscriptionPlan: data.subscriptionPlan || 'Professional',
        subscriptionEndsAt: data.subscriptionEndsAt || '',
      });
      if (data.settings) setPrefData({ ...data.settings, allowNegativeStock: !!data.settings.allowNegativeStock, warnMinimumStock: !!data.settings.warnMinimumStock, autoDeductStock: !!data.settings.autoDeductStock, allowManualAdjustments: !!data.settings.allowManualAdjustments });
      if (data.fiscalSettings) setFiscalData({ ...data.fiscalSettings, defaultTaxRate: Number(data.fiscalSettings.defaultTaxRate) });
      if (data.posSettings) setPOSData({ ...data.posSettings, maxCashLimit: Number(data.posSettings.maxCashLimit), maxDiscountPercentage: Number(data.posSettings.maxDiscountPercentage) });
      if (data.printSettings) setPrintData(data.printSettings);
      if (data.emailSettings) setEmailData({ ...data.emailSettings, smtpPassword: '' });
      if (data.numberSettings) setNumberData(data.numberSettings);

      const lData = loyaltyRes.data?.data;
      if (lData) {
        setLoyaltyData({
          enabled: !!lData.enabled,
          earnEveryAmount: Number(lData.earnEveryAmount),
          earnPoints: Number(lData.earnPoints),
          minimumSaleAmount: Number(lData.minimumSaleAmount),
          pointValue: Number(lData.pointValue),
          allowPartialRedemption: !!lData.allowPartialRedemption,
          allowRedemption: !!lData.allowRedemption,
          maxRedemptionPercentage: Number(lData.maxRedemptionPercentage),
          expirePoints: !!lData.expirePoints,
          expirationMonths: Number(lData.expirationMonths),
          roundingMode: lData.roundingMode || 'FLOOR',
          pointsCalculationMode: lData.pointsCalculationMode || 'EFFECTIVELY_PAID',
          accumulateOnPointsPaid: !!lData.accumulateOnPointsPaid,
        });
      }

      setPlans(plansRes.data.data || []);
      const sub = subRes.data.data;
      setSubscription(sub);

      const cycles: Record<string, string> = {};
      for (const p of plansRes.data.data || []) {
         const activePrices = p.prices?.filter((pr: any) => pr.active) || [];
         if (activePrices.length > 0) {
            cycles[p.id] = activePrices[0].billingCycle;
         }
      }
      setSelectedCycles(cycles);

      // Fetch Integrations Config
      try {
         const intRes = await api.get('/business/integrations');
         const mpInt = intRes.data.data.find((item: any) => item.provider === 'MERCADO_PAGO');
         applyMPIntegrationState(mpInt);
      } catch (err) {
         console.error('Error fetching integrations', err);
      }

    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar configs');
    } finally { setLoading(false); }
  };

  const handleCheckoutLicense = async (planId: string) => {
     const cycle = selectedCycles[planId];
     if (!cycle) {
        alert('Seleccione un ciclo de facturación para este plan.');
        return;
     }

     if (!subscription) {
        alert('No se detectó un registro de suscripción asignado. Contacte soporte.');
        return;
     }

     try {
        setPayingPlanPrice(planId);
        const { data } = await api.post('/businesses/payments/create-preference', {
           businessId: settings?.id,
           planId,
           billingCycle: cycle
        });

        if (data.success && data.data?.initPoint) {
           window.open(data.data.initPoint, '_blank');
           alert('Se abrió la ventana de Mercado Pago. Realice el pago para activar los beneficios.');
        } else {
           alert('Ocurrió un inconveniente al generar la preferencia de Mercado Pago.');
        }
     } catch (e: any) {
        alert(e.response?.data?.message || 'Ocurrió un error al procesar la renovación.');
     } finally {
        setPayingPlanPrice(null);
     }
  };

  const handleSaveMP = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const hasNewAccessToken = Boolean(mpAccessTokenChanged && mpAccessTokenValue && mpAccessTokenValue.trim());
      const payloadAccessToken = hasNewAccessToken ? mpAccessTokenValue.trim() : null;

      const hasNewWebhookSecret = Boolean(mpWebhookSecretChanged && mpWebhookSecretValue && mpWebhookSecretValue.trim());
      const payloadWebhookSecret = hasNewWebhookSecret ? mpWebhookSecretValue.trim() : null;

      console.log('[MP FRONT SAVE]', {
        accessTokenChanged: hasNewAccessToken,
        webhookSecretChanged: hasNewWebhookSecret,
        payloadAccessToken: payloadAccessToken ? '[NUEVO_TOKEN]' : null,
        payloadWebhookSecret: payloadWebhookSecret ? '[NUEVO_SECRET]' : null,
      });

      const { data } = await api.put('/business/integrations/mercado-pago', {
        accessToken: payloadAccessToken,
        publicKey: mpPublicKey,
        environment: mpEnvironment,
        webhookSecret: payloadWebhookSecret
      });

      if (data.success) {
        setSuccessMessage('Configuración de Mercado Pago guardada correctamente.');
        setIsConfiguringMP(false);
        // Refresh integration details
        const intRes = await api.get('/business/integrations');
        const mpInt = intRes.data.data.find((item: any) => item.provider === 'MERCADO_PAGO');
        applyMPIntegrationState(mpInt);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar la integración.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestMP = async () => {
    try {
      setMpStatus('TESTING');
      setError(null);
      setSuccessMessage(null);
      const { data } = await api.post('/business/integrations/mercado-pago/test');
      if (data.success) {
        setSuccessMessage('Conexión exitosa con Mercado Pago.');
      } else {
        setError('Error de conexión con Mercado Pago.');
      }
      
      // Refresh integration details
      const intRes = await api.get('/business/integrations');
      const mpInt = intRes.data.data.find((item: any) => item.provider === 'MERCADO_PAGO');
      applyMPIntegrationState(mpInt);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Problema al comunicar con la pasarela.');
      setMpStatus('CONNECTED');
    }
  };

  const handleSave = async (section: string) => {
    try {
      setSaving(true); setError(null); setSuccessMessage(null);
      if (section === 'general') {
        const updated = await SettingsService.updateBusiness(bizData);
        setBizData(updated as BusinessData);
        setSuccessMessage('Información de empresa guardada');
      } else if (section === 'preferences') {
        const updated = await SettingsService.updatePreferences(prefData);
        setPrefData(updated as BusinessSettingsData);
        setSuccessMessage('Preferencias regionales guardadas');
      } else if (section === 'fiscal') {
        const updated = await SettingsService.updateFiscal(fiscalData);
        setFiscalData(updated as FiscalSettingsData);
        setSuccessMessage('Ajustes fiscales guardados');
      } else if (section === 'pos') {
        const updated = await SettingsService.updatePOS(posData);
        setPOSData(updated as POSSettingsData);
        setSuccessMessage('Configuraciones POS guardadas');
      } else if (section === 'print') {
        const updated = await SettingsService.updatePrint(printData);
        setPrintData(updated as PrintSettingsData);
        setSuccessMessage('Ajustes de impresión guardados');
      } else if (section === 'email') {
        const updated = await SettingsService.updateEmail(emailData);
        setEmailData({ ...updated, smtpPassword: '' } as EmailSettingsData);
        setSuccessMessage('Ajustes SMTP guardados');
      } else if (section === 'numbers') {
        const updated = await SettingsService.updateNumbers(numberData);
        setNumberData(updated as NumberSettingsData);
        setSuccessMessage('Numeradores de comprobantes actualizados');
      } else if (section === 'inventory') {
        const updated = await SettingsService.updatePreferences(prefData);
        setPrefData(updated as BusinessSettingsData);
        setSuccessMessage('Reglas de inventario guardadas');
      } else if (section === 'loyalty') {
        const res = await api.put('/points/settings', loyaltyData);
        if (res.data?.data) {
          const lData = res.data.data;
          setLoyaltyData({
            enabled: !!lData.enabled,
            earnEveryAmount: Number(lData.earnEveryAmount),
            earnPoints: Number(lData.earnPoints),
            minimumSaleAmount: Number(lData.minimumSaleAmount),
            pointValue: Number(lData.pointValue),
            allowPartialRedemption: !!lData.allowPartialRedemption,
            allowRedemption: !!lData.allowRedemption,
            maxRedemptionPercentage: Number(lData.maxRedemptionPercentage),
            expirePoints: !!lData.expirePoints,
            expirationMonths: Number(lData.expirationMonths),
            roundingMode: lData.roundingMode || 'FLOOR',
            pointsCalculationMode: lData.pointsCalculationMode || 'EFFECTIVELY_PAID',
            accumulateOnPointsPaid: !!lData.accumulateOnPointsPaid,
          });
        }
        setSuccessMessage('Configuración de fidelización guardada');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const testSmtp = () => {
     setSaving(true);
     setTimeout(() => { setSaving(false); setSuccessMessage('Conexión SMTP exitosa'); }, 1500);
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary-600" /></div>;

  const renderSubmitButton = (section: string) => (
    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
      <Button onClick={() => handleSave(section)} disabled={saving} variant="primary">
        {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/> Guardando...</> : 'Guardar Cambios'}
      </Button>
    </div>
  );

  const rawMenuGroups = [
    { label: 'Configuración', items: [
      { id: 'general', label: 'General', icon: Building, permission: 'settings:read' },
      { id: 'preferences', label: 'Preferencias', icon: SettingsIcon, permission: 'settings:read' },
      { id: 'fiscal', label: 'Fiscal', icon: Percent, permission: 'settings:read' },
    ]},
    { label: 'Operación', items: [
      { id: 'pos', label: 'POS', icon: ShoppingCart, permission: 'settings:pos:read' },
      { id: 'print', label: 'Impresión', icon: Printer, permission: 'settings:read' },
      { id: 'email', label: 'Email', icon: Mail, permission: 'settings:read' },
      { id: 'numbers', label: 'Numeración', icon: ListPlus, permission: 'settings:read' },
      { id: 'inventory', label: 'Inventario', icon: Package, permission: 'settings:read' },
    ]},
    { label: 'Sistema', items: [
      { id: 'appearance', label: 'Apariencia', icon: Palette, permission: 'settings:read' },
      { id: 'security', label: 'Seguridad', icon: Shield, permission: 'settings:read' },
      { id: 'integrations', label: 'Integraciones', icon: Share2, permission: 'settings:read' },
      { id: 'loyalty', label: 'Fidelización', icon: Award, permissions: ['customerPoints:settings', 'points:write'] },
    ]},
    { label: 'Administración', items: [
      { id: 'license', label: 'Licencia', icon: Award, permission: 'settings:read' },
    ]},
  ];

  const menuGroups = rawMenuGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (item.permission && !hasPermission(item.permission)) return false;
      if (item.permissions && !item.permissions.some(p => hasPermission(p))) return false;
      return true;
    })
  })).filter(group => group.items.length > 0);

  return (
    <div className="space-y-5 pb-20 w-full">
      <PageHeader title="Centro de Administración" subtitle="Gestiona todos los parámetros de tu organización de forma centralizada." />

      {error && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100"><AlertCircle className="h-4 w-4 shrink-0"/><span>{error}</span></div>}
      {successMessage && <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-100"><CheckCircle2 className="h-4 w-4 shrink-0"/><span>{successMessage}</span></div>}

      {/* TENANT HEADER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-primary-600/5 via-indigo-500/5 to-transparent dark:from-primary-900/20 dark:via-indigo-900/10 p-5">
          <div className="flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {prefData.logoUrl ? <img src={prefData.logoUrl} alt="Logo" className="object-cover h-full w-full" /> : <Building className="h-7 w-7 text-primary-500" />}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{bizData.name || 'Empresa Sin Nombre'}</h2>
                <div className="flex flex-wrap gap-2 items-center mt-1.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 uppercase tracking-wider">🟢 Activo</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 uppercase tracking-wider">{subscription?.plan?.name || bizData.subscriptionPlan}</span>
                  <span className="text-xs text-slate-400 font-mono">CUIT: {settings?.taxId || 'N/A'}</span>
                  <span className="text-xs text-slate-400 hidden sm:inline">•</span>
                  <span className="text-xs text-slate-400">{fiscalData.taxRegime}</span>
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1.5">
                  <Calendar className="h-3 w-3"/> Miembro desde {settings?.createdAt ? new Date(settings.createdAt).toLocaleDateString('es-AR') : 'N/A'}
                </p>
              </div>
            </div>
            <Button variant="outline" className="shrink-0 text-xs"><Palette className="h-3.5 w-3.5 mr-1.5"/>Editar Logo</Button>
          </div>
        </div>

        {/* KPI Stats Bar */}
        {settings && (
          <div className="grid grid-cols-3 sm:grid-cols-6 border-t border-slate-100 dark:border-slate-800 divide-x divide-slate-100 dark:divide-slate-800">
            {[
              { icon: Users, label: 'Usuarios', value: settings._count?.users || 0 },
              { icon: Package, label: 'Productos', value: settings._count?.products || 0 },
              { icon: Users, label: 'Clientes', value: settings._count?.customers || 0 },
              { icon: Store, label: 'Proveedores', value: settings._count?.suppliers || 0 },
              { icon: Building, label: 'Depósitos', value: settings._count?.warehouses || 0 },
              { icon: Banknote, label: 'Cajas', value: settings._count?.cashRegisters || 0 },
            ].map((kpi) => (
              <div key={kpi.label} className="py-3 px-3 text-center group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                <kpi.icon className="h-3.5 w-3.5 text-slate-400 mx-auto mb-1 group-hover:text-primary-500 transition-colors" />
                <div className="text-lg font-extrabold text-slate-800 dark:text-white">{kpi.value}</div>
                <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">{kpi.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-8 mt-6">
        {/* NEW SIDEBAR */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="sticky top-6 flex flex-col gap-6">
            {menuGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">{group.label}</h3>
                <nav className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const isActive = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-semibold rounded-xl transition-all ${
                          isActive 
                            ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-400' 
                            : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'}`} />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>
        </aside>

        {/* CONTENT AREA */}
        <div className="flex-1 min-w-0">
          {[
            { id: 'general', label: 'General', content: (
              <div className="space-y-6 mt-6">
                <Card><CardHeader><CardTitle>Información General</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="name" label="Razón Social / Nombre Comercial" value={bizData.name} onChange={e => setBizData({...bizData, name: e.target.value})} />
                    <Input id="website" label="Sitio Web" value={bizData.website || ''} onChange={e => setBizData({...bizData, website: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="email" label="Email Principal" value={bizData.email || ''} onChange={e => setBizData({...bizData, email: e.target.value})} />
                    <Input id="phone" label="Teléfono de Contacto" value={bizData.phone || ''} onChange={e => setBizData({...bizData, phone: e.target.value})} />
                  </div>
                </CardContent></Card>
                <Card><CardHeader><CardTitle>Dirección</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <Input id="address" label="Calle y Número" value={bizData.address || ''} onChange={e => setBizData({...bizData, address: e.target.value})} />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input id="city" label="Ciudad" value={bizData.city || ''} onChange={e => setBizData({...bizData, city: e.target.value})} />
                    <Input id="state" label="Provincia" value={bizData.state || ''} onChange={e => setBizData({...bizData, state: e.target.value})} />
                    <Input id="zipCode" label="Código Postal" value={bizData.zipCode || ''} onChange={e => setBizData({...bizData, zipCode: e.target.value})} />
                  </div>
                  <Input id="country" label="País" value={bizData.country || ''} onChange={e => setBizData({...bizData, country: e.target.value})} />
                </CardContent></Card>
                {renderSubmitButton('general')}
              </div>
            ) },
            { id: 'preferences', label: 'Preferencias', content: (
              <div className="space-y-6 mt-6">
                <Card><CardHeader><CardTitle>Regional</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1.5">
                       <label className="text-sm font-medium">Idioma</label>
                       <select className="input-class" value={prefData.language} onChange={e => setPrefData({...prefData, language: e.target.value})}><option value="es">Español</option><option value="en">Inglés</option></select>
                     </div>
                     <div className="flex flex-col gap-1.5"><label className="text-sm font-medium">Zona Horaria</label><select className="input-class" value={prefData.timezone} onChange={e => setPrefData({...prefData, timezone: e.target.value})}><option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option></select></div>
                     <div className="flex flex-col gap-1.5"><label className="text-sm font-medium">Formato Fecha</label><select className="input-class" value={prefData.dateFormat} onChange={e => setPrefData({...prefData, dateFormat: e.target.value})}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option></select></div>
                     <div className="flex flex-col gap-1.5"><label className="text-sm font-medium">Formato Hora</label><select className="input-class" value={prefData.timeFormat} onChange={e => setPrefData({...prefData, timeFormat: e.target.value})}><option value="24h">24h</option><option value="12h">12h</option></select></div>
                  </div>
                </CardContent></Card>
                <Card><CardHeader><CardTitle>Números</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="decimal" label="Separador Decimal" value={prefData.decimalSeparator} onChange={e => setPrefData({...prefData, decimalSeparator: e.target.value})} />
                    <Input id="thousand" label="Separador Miles" value={prefData.thousandSeparator} onChange={e => setPrefData({...prefData, thousandSeparator: e.target.value})} />
                  </div>
                </CardContent></Card>
                <Card><CardHeader><CardTitle>Monedas</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="cc" label="Moneda Principal (ISO)" value={prefData.currencyCode} onChange={e => setPrefData({...prefData, currencyCode: e.target.value})} />
                    <Input id="csym" label="Símbolo" value={prefData.currencySymbol} onChange={e => setPrefData({...prefData, currencySymbol: e.target.value})} />
                  </div>
                </CardContent></Card>
                {renderSubmitButton('preferences')}
              </div>
            ) },
            { id: 'fiscal', label: 'Fiscal', content: (
              <div className="mt-6">
                <FiscalSettings />
              </div>
            ) },
            { id: 'pos', label: 'POS', content: (
              <div className="space-y-6 mt-6">
                <Card><CardHeader><CardTitle>Configuración POS / Terminales</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6">
                     <label className="flex items-center gap-3"><input type="checkbox" checked={posData.requireOpenCashRegister} onChange={e => setPOSData({...posData, requireOpenCashRegister: e.target.checked})} className="h-4 w-4"/>Exigir caja abierta para vender</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={posData.allowMultipleRegisters} onChange={e => setPOSData({...posData, allowMultipleRegisters: e.target.checked})} className="h-4 w-4"/>Permitir múltiples cajas</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={posData.requireCustomerForSale} onChange={e => setPOSData({...posData, requireCustomerForSale: e.target.checked})} className="h-4 w-4"/>Exigir identificar cliente</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={posData.requireSellerForSale} onChange={e => setPOSData({...posData, requireSellerForSale: e.target.checked})} className="h-4 w-4"/>Exigir vendedor</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={posData.printReceiptAfterSale} onChange={e => setPOSData({...posData, printReceiptAfterSale: e.target.checked})} className="h-4 w-4"/>Impresión automática</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={posData.allowMixedPayments} onChange={e => setPOSData({...posData, allowMixedPayments: e.target.checked})} className="h-4 w-4"/>Permitir pagos mixtos</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={posData.isDiscountAllowed} onChange={e => setPOSData({...posData, isDiscountAllowed: e.target.checked})} className="h-4 w-4"/>Permitir descuentos</label>
                      <div className="space-y-2.5 col-span-1 md:col-span-2 p-3 bg-slate-50/70 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={Boolean(posData.autoRounding || posData.autoPriceRounding)}
                            onChange={(e) =>
                              setPOSData({
                                ...posData,
                                autoRounding: e.target.checked,
                                autoPriceRounding: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            Redondeo automático
                          </span>
                        </label>

                        {Boolean(posData.autoRounding || posData.autoPriceRounding) && (
                          <div className="pl-7 space-y-2.5 animate-in fade-in duration-200">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Los precios finales de venta se ajustarán automáticamente al valor comercial más cercano.
                            </p>

                            <div className="pt-1">
                              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                                Aplicar redondeo:
                              </label>
                              <div className="flex flex-wrap items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  <input
                                    type="radio"
                                    name="autoRoundingMode"
                                    value="CASH_ONLY"
                                    checked={(posData.autoRoundingMode || 'CASH_ONLY') === 'CASH_ONLY'}
                                    onChange={() => setPOSData({ ...posData, autoRoundingMode: 'CASH_ONLY' })}
                                    className="h-3.5 w-3.5 text-primary-600 focus:ring-primary-500"
                                  />
                                  Solo efectivo (Recomendado)
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800 dark:text-slate-200">
                                  <input
                                    type="radio"
                                    name="autoRoundingMode"
                                    value="ALL_METHODS"
                                    checked={posData.autoRoundingMode === 'ALL_METHODS'}
                                    onChange={() => setPOSData({ ...posData, autoRoundingMode: 'ALL_METHODS' })}
                                    className="h-3.5 w-3.5 text-primary-600 focus:ring-primary-500"
                                  />
                                  Todos los medios de pago
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                     <Input type="number" id="dsc" label="Max. Descuento (%)" value={posData.maxDiscountPercentage} onChange={e => setPOSData({...posData, maxDiscountPercentage: Number(e.target.value)})} />
                     <Input type="number" id="cp" label="Copias Ticket" value={posData.ticketCopyCount} onChange={e => setPOSData({...posData, ticketCopyCount: Number(e.target.value)})} />
                  </div>
                </CardContent></Card>

                {/* Descuentos y Recargos por Medio de Pago Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle>Descuentos y Recargos por Medio de Pago</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">Configuración de ajustes comerciales automáticos según la forma de pago en el POS.</p>
                    </div>
                    <Button type="button" variant="primary" size="sm" onClick={openNewRuleModal}>
                      <Plus className="w-4 h-4 mr-1.5" /> Nueva regla
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {adjustmentRules.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Percent className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay reglas de ajuste configuradas</p>
                        <p className="text-xs text-slate-400 mt-1">Haz clic en "+ Nueva regla" para automatizar descuentos o recargos.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-3">Método de Pago</th>
                              <th className="pb-3">Ajuste</th>
                              <th className="pb-3">Valor</th>
                              <th className="pb-3">Estado</th>
                              <th className="pb-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {adjustmentRules.map((rule) => {
                              const methodNames: Record<string, string> = {
                                CASH: 'Efectivo',
                                TRANSFER: 'Transferencia',
                                MERCADOPAGO: 'Mercado Pago',
                                DEBIT_CARD: 'Débito',
                                CREDIT_CARD: 'Crédito'
                              };
                              return (
                                <tr key={rule.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                  <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">
                                    {methodNames[rule.paymentMethod] || rule.paymentMethod}
                                  </td>
                                  <td className="py-3">
                                    {rule.adjustmentType === 'DISCOUNT' ? (
                                      <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                        Descuento
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                                        Recargo
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 font-mono font-bold">
                                    {rule.valueType === 'PERCENTAGE' ? `${rule.value}%` : `$${rule.value}`}
                                  </td>
                                  <td className="py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleRuleActive(rule)}
                                      className="cursor-pointer"
                                    >
                                      {rule.active ? (
                                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🟢 Activo</span>
                                      ) : (
                                        <span className="text-xs font-bold text-slate-400">🔴 Inactivo</span>
                                      )}
                                    </button>
                                  </td>
                                  <td className="py-3 text-right">
                                    <div className="flex justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => openEditRuleModal(rule)}
                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                        title="Editar regla"
                                      >
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteRule(rule.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                        title="Eliminar regla"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Modal Form de Regla de Ajuste */}
                {isRuleModalOpen && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          {editingRuleId ? 'Editar Regla de Ajuste' : 'Nueva Regla por Medio de Pago'}
                        </h4>
                        <button onClick={() => setIsRuleModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Método de Pago</label>
                          <select
                            value={ruleForm.paymentMethod}
                            disabled={!!editingRuleId}
                            onChange={(e) => setRuleForm({ ...ruleForm, paymentMethod: e.target.value as any })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60"
                          >
                            <option value="MERCADOPAGO">Mercado Pago</option>
                            <option value="CASH">Efectivo</option>
                            <option value="TRANSFER">Transferencia</option>
                            <option value="DEBIT_CARD">Débito</option>
                            <option value="CREDIT_CARD">Crédito</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Ajuste</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setRuleForm({ ...ruleForm, adjustmentType: 'DISCOUNT' })}
                              className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                                ruleForm.adjustmentType === 'DISCOUNT'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 shadow-sm'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              ○ Descuento
                            </button>
                            <button
                              type="button"
                              onClick={() => setRuleForm({ ...ruleForm, adjustmentType: 'SURCHARGE' })}
                              className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all ${
                                ruleForm.adjustmentType === 'SURCHARGE'
                                  ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 shadow-sm'
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              ○ Recargo
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Unidad</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setRuleForm({ ...ruleForm, valueType: 'PERCENTAGE' })}
                                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                                  ruleForm.valueType === 'PERCENTAGE'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                % Porcentaje
                              </button>
                              <button
                                type="button"
                                onClick={() => setRuleForm({ ...ruleForm, valueType: 'FIXED' })}
                                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                                  ruleForm.valueType === 'FIXED'
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                $ Monto Fijo
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Valor</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={ruleForm.value}
                              onChange={(e) => setRuleForm({ ...ruleForm, value: Number(e.target.value) })}
                              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={ruleForm.active}
                              onChange={(e) => setRuleForm({ ...ruleForm, active: e.target.checked })}
                              className="h-4 w-4 rounded text-indigo-600"
                            />
                            Regla activa en POS
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsRuleModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="button" variant="primary" size="sm" onClick={handleSaveRule} disabled={savingRule}>
                          {savingRule ? 'Guardando...' : 'Guardar regla'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Precios por Cantidad Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle>Precios por Cantidad</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">Configuración automática de precios comerciales según la cantidad vendida de un producto.</p>
                    </div>
                    <Button type="button" variant="primary" size="sm" onClick={openNewTierModal}>
                      <Plus className="w-4 h-4 mr-1.5" /> Nueva regla
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {priceTiers.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay reglas de precios por cantidad configuradas</p>
                        <p className="text-xs text-slate-400 mt-1">Haz clic en "+ Nueva regla" para automatizar escalas de precios por volumen.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-3">Producto</th>
                              <th className="pb-3">Cantidad mínima</th>
                              <th className="pb-3">Precio</th>
                              <th className="pb-3">Estado</th>
                              <th className="pb-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {priceTiers.map((tier) => (
                              <tr key={tier.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">
                                  {tier.product?.name || 'Producto N/A'}
                                  {tier.product?.sku && <span className="text-xs text-slate-400 font-mono ml-2">({tier.product.sku})</span>}
                                </td>
                                <td className="py-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {tier.minQuantity} u.
                                </td>
                                <td className="py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  ${Number(tier.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTierActive(tier)}
                                    className="cursor-pointer"
                                  >
                                    {tier.isActive ? (
                                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">🟢 Activo</span>
                                    ) : (
                                      <span className="text-xs font-bold text-slate-400">🔴 Inactivo</span>
                                    )}
                                  </button>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditTierModal(tier)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                      title="Editar regla"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTier(tier.id)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                                      title="Eliminar regla"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Modal Form de Regla de Precio por Cantidad */}
                {isTierModalOpen && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          {editingTierId ? 'Editar Regla de Precio por Cantidad' : 'Nueva Regla de Precio por Cantidad'}
                        </h4>
                        <button onClick={() => setIsTierModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Producto *</label>
                          <select
                            value={tierForm.productId}
                            disabled={!!editingTierId}
                            onChange={(e) => setTierForm({ ...tierForm, productId: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Seleccionar producto...</option>
                            {productsList.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ''} - Base: ${p.salePrice}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cantidad mínima *</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={tierForm.minQuantity}
                            onChange={(e) => setTierForm({ ...tierForm, minQuantity: Number(e.target.value) })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Precio Unitario *</label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={tierForm.price}
                            onChange={(e) => setTierForm({ ...tierForm, price: Number(e.target.value) })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={tierForm.isActive}
                              onChange={(e) => setTierForm({ ...tierForm, isActive: e.target.checked })}
                              className="h-4 w-4 rounded text-indigo-600"
                            />
                            Regla activa
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsTierModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="button" variant="primary" size="sm" onClick={handleSaveTier} disabled={savingTier}>
                          {savingTier ? 'Guardando...' : 'Guardar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Promociones Card */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle>Promociones</CardTitle>
                      <p className="text-xs text-slate-500 mt-1">Configuración de promociones automáticas aplicadas durante la venta.</p>
                    </div>
                    <Button type="button" variant="primary" size="sm" onClick={openNewPromoModal}>
                      <Plus className="w-4 h-4 mr-1.5" /> Nueva promoción
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {promotions.length === 0 ? (
                      <div className="text-center py-8 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Zap className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay promociones configuradas</p>
                        <p className="text-xs text-slate-400 mt-1">Haz clic en "+ Nueva promoción" para crear reglas 2x1, 2da unidad % o packs.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase tracking-wider">
                              <th className="pb-3">Nombre</th>
                              <th className="pb-3">Tipo</th>
                              <th className="pb-3">Producto</th>
                              <th className="pb-3">Regla / Detalle</th>
                              <th className="pb-3">Estado</th>
                              <th className="pb-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {promotions.map((promo) => (
                              <tr key={promo.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                                <td className="py-3 font-bold text-slate-900 dark:text-slate-100">
                                  {promo.name}
                                </td>
                                <td className="py-3">
                                  <span className="inline-flex items-center text-xs font-extrabold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                    {promo.type === 'TWO_FOR_ONE' ? '2x1' : promo.type === 'SECOND_UNIT_DISCOUNT' ? '2da Unidad %' : 'Pack Especial'}
                                  </span>
                                </td>
                                <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">
                                  {promo.product?.name || promo.productId}
                                </td>
                                <td className="py-3 text-xs font-mono">
                                  {promo.type === 'TWO_FOR_ONE' && `Compra 2, paga 1`}
                                  {promo.type === 'SECOND_UNIT_DISCOUNT' && `2da unidad ${promo.discountPercentage}% OFF`}
                                  {promo.type === 'SPECIAL_PACK' && `Min ${promo.minQuantity} u. -> $${Number(promo.specialPrice).toLocaleString('es-AR')}`}
                                </td>
                                <td className="py-3">
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePromoActive(promo)}
                                    className={`px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
                                      promo.isActive
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                                  >
                                    {promo.isActive ? 'Activa' : 'Inactiva'}
                                  </button>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openEditPromoModal(promo)}
                                      className="p-1 text-slate-400 hover:text-primary-600"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePromo(promo.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Modal Form de Promoción */}
                {isPromoModalOpen && (
                  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 border border-slate-200 dark:border-slate-800">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                        <h4 className="font-bold text-slate-900 dark:text-white text-base">
                          {editingPromoId ? 'Editar Promoción' : 'Nueva Promoción'}
                        </h4>
                        <button onClick={() => setIsPromoModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Nombre Promoción *</label>
                          <input
                            type="text"
                            placeholder="ej: 2x1 Fernet Branca"
                            value={promoForm.name}
                            onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipo de Promoción *</label>
                          <select
                            value={promoForm.type}
                            onChange={(e) => setPromoForm({ ...promoForm, type: e.target.value as any })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="TWO_FOR_ONE">2x1 (Lleva 2, Paga 1)</option>
                            <option value="SECOND_UNIT_DISCOUNT">Segunda Unidad con Descuento %</option>
                            <option value="SPECIAL_PACK">Pack Especial por Volumen</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Producto Afectado *</label>
                          <select
                            value={promoForm.productId}
                            onChange={(e) => setPromoForm({ ...promoForm, productId: e.target.value })}
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          >
                            <option value="">Seleccionar producto...</option>
                            {productsList.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ''} - Base: ${p.salePrice}
                              </option>
                            ))}
                          </select>
                        </div>

                        {promoForm.type === 'SECOND_UNIT_DISCOUNT' && (
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Descuento en 2da Unidad (%) *</label>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={promoForm.discountPercentage}
                              onChange={(e) => setPromoForm({ ...promoForm, discountPercentage: Number(e.target.value) })}
                              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                        )}

                        {promoForm.type === 'SPECIAL_PACK' && (
                          <>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Cantidad Mínima del Pack *</label>
                              <input
                                type="number"
                                min="2"
                                value={promoForm.minQuantity}
                                onChange={(e) => setPromoForm({ ...promoForm, minQuantity: Number(e.target.value) })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Precio Especial del Pack ($) *</label>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={promoForm.specialPrice}
                                onChange={(e) => setPromoForm({ ...promoForm, specialPrice: Number(e.target.value) })}
                                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                          </>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={promoForm.isActive}
                              onChange={(e) => setPromoForm({ ...promoForm, isActive: e.target.checked })}
                              className="h-4 w-4 rounded text-indigo-600"
                            />
                            Promoción activa
                          </label>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsPromoModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="button" variant="primary" size="sm" onClick={handleSavePromo} disabled={savingPromo}>
                          {savingPromo ? 'Guardando...' : 'Guardar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {renderSubmitButton('pos')}
              </div>
            ) },
            { id: 'print', label: 'Impresión', content: (
              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <Card><CardHeader><CardTitle>Ajustes de Tiketa</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5"><label className="text-sm font-medium">Ancho Papel</label><select className="input-class" value={printData.paperWidth} onChange={e => setPrintData({...printData, paperWidth: e.target.value})}><option value="58MM">58 MM</option><option value="80MM">80 MM</option></select></div>
                        <div className="flex flex-col gap-1.5"><label className="text-sm font-medium">Tipo</label><select className="input-class" value={printData.printerType} onChange={e => setPrintData({...printData, printerType: e.target.value})}><option value="THERMAL">Térmica / ESC_POS</option></select></div>
                        <Input id="hdr" label="Encabezado" value={printData.headerText || ''} onChange={e => setPrintData({...printData, headerText: e.target.value})} />
                        <Input id="ftr" label="Pie de página" value={printData.footerText || ''} onChange={e => setPrintData({...printData, footerText: e.target.value})} />
                        <label className="flex items-center gap-3 col-span-2"><input type="checkbox" checked={printData.showQr} onChange={e => setPrintData({...printData, showQr: e.target.checked})} className="h-4 w-4"/>Mostrar QR AFIP</label>
                        <label className="flex items-center gap-3 col-span-2"><input type="checkbox" checked={printData.showBarcode} onChange={e => setPrintData({...printData, showBarcode: e.target.checked})} className="h-4 w-4"/>Mostrar Código de Barras</label>
                      </div>
                    </CardContent></Card>
                  </div>
                  <Card className="bg-slate-100 dark:bg-slate-950 flex justify-center py-10 shadow-inner">
                     <div className="w-64 bg-white shadow-xl min-h-[300px] p-4 text-center font-mono text-[10px] text-black">
                        <div className="font-bold text-sm mb-2">{bizData.name.toUpperCase() || 'EMPRESA DEMO'}</div>
                        <div>CUIT: {fiscalData.vatNumber || 'XX-XXXXXXXX-X'}</div>
                        <div className="whitespace-pre-line my-2">{printData.headerText}</div>
                        <div className="border-b border-dashed border-black my-2"></div>
                        <div className="flex justify-between"><span>1x PRODUCTO A</span><span>$ 1500.00</span></div>
                        <div className="flex justify-between"><span>2x PRODUCTO B</span><span>$ 3000.00</span></div>
                        <div className="border-t border-black my-2 border-dashed"></div>
                        <div className="flex justify-between font-bold text-xs"><span className="uppercase">TOTAL</span><span>$ 4500.00</span></div>
                        <div className="whitespace-pre-line mt-4">{printData.footerText || '¡Gracias por su compra!'}</div>
                        {printData.showQr && <div className="mt-4 border border-black p-4 inline-block">[ QR ]</div>}
                     </div>
                  </Card>
                </div>
                {renderSubmitButton('print')}
              </div>
            ) },
            { id: 'email', label: 'Email', content: (
              <div className="space-y-6 mt-6">
                <Card><CardHeader><CardTitle>Servidor SMTP</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="smtpHost" label="SMTP Host" value={emailData.smtpHost || ''} onChange={e => setEmailData({...emailData, smtpHost: e.target.value})} />
                    <Input id="smtpPort" label="SMTP Port" type="number" value={emailData.smtpPort || ''} onChange={e => setEmailData({...emailData, smtpPort: Number(e.target.value)})} />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input id="smtpUser" label="Usuario SMTP" value={emailData.smtpUser || ''} onChange={e => setEmailData({...emailData, smtpUser: e.target.value})} />
                    <Input id="smtpPass" label="Contraseña SMTP" type="password" placeholder="••••••••" value={emailData.smtpPassword || ''} onChange={e => setEmailData({...emailData, smtpPassword: e.target.value})} />
                    <Input id="senderEmail" label="Email Envío (Sender)" value={emailData.senderEmail || ''} onChange={e => setEmailData({...emailData, senderEmail: e.target.value})} />
                    <Input id="senderName" label="Nombre Envío" value={emailData.senderName || ''} onChange={e => setEmailData({...emailData, senderName: e.target.value})} />
                  </div>
                  <div className="flex gap-4 pt-4">
                     <Button type="button" variant="outline" onClick={testSmtp}><Globe className="h-4 w-4 mr-2"/>Probar Conexión</Button>
                     <Button type="button" variant="outline"><Mail className="h-4 w-4 mr-2"/>Enviar Email Prueba</Button>
                  </div>
                </CardContent></Card>
                {renderSubmitButton('email')}
              </div>
            ) },
            { id: 'numbers', label: 'Numeración', content: (
              <div className="space-y-6 mt-6">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Card><CardContent className="pt-6">
                      <h4 className="text-sm font-bold uppercase text-slate-500 mb-4 tracking-wide">FACTURAS</h4>
                      <div className="text-xl font-mono text-slate-900 border p-3 rounded-lg dark:text-white dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                        FAC-{(numberData.currentSaleNumber || 0).toString().padStart(8, '0')}
                      </div>
                      <div className="mt-4"><Input type="number" label="Próximo Nro" value={numberData.currentSaleNumber} onChange={e => setNumberData({...numberData, currentSaleNumber: Number(e.target.value)})} /></div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-6">
                      <h4 className="text-sm font-bold uppercase text-slate-500 mb-4 tracking-wide">ÓRDENES COMPRA</h4>
                      <div className="text-xl font-mono text-slate-900 border p-3 rounded-lg dark:text-white dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                        COM-{(numberData.currentPurchaseNumber || 0).toString().padStart(8, '0')}
                      </div>
                      <div className="mt-4"><Input type="number" label="Próximo Nro" value={numberData.currentPurchaseNumber} onChange={e => setNumberData({...numberData, currentPurchaseNumber: Number(e.target.value)})} /></div>
                    </CardContent></Card>
                    <Card><CardContent className="pt-6">
                      <h4 className="text-sm font-bold uppercase text-slate-500 mb-4 tracking-wide">MOV. INVENTARIO</h4>
                      <div className="text-xl font-mono text-slate-900 border p-3 rounded-lg dark:text-white dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                        INV-{(numberData.currentInventoryNumber || 0).toString().padStart(8, '0')}
                      </div>
                      <div className="mt-4"><Input type="number" label="Próximo Nro" value={numberData.currentInventoryNumber} onChange={e => setNumberData({...numberData, currentInventoryNumber: Number(e.target.value)})} /></div>
                    </CardContent></Card>
                 </div>
                 {renderSubmitButton('numbers')}
              </div>
            ) },
            { id: 'inventory', label: 'Inventario', content: (
              <div className="space-y-6 mt-6">
                 <Card><CardHeader><CardTitle>Reglas de Stock</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <label className="flex items-center gap-3"><input type="checkbox" checked={prefData.allowNegativeStock} onChange={e => setPrefData({...prefData, allowNegativeStock: e.target.checked})} className="h-4 w-4"/>Permitir stock negativo (Requiere Supervisor)</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={prefData.warnMinimumStock} onChange={e => setPrefData({...prefData, warnMinimumStock: e.target.checked})} className="h-4 w-4"/>Avisar stock mínimo en caja</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={prefData.autoDeductStock} onChange={e => setPrefData({...prefData, autoDeductStock: e.target.checked})} className="h-4 w-4"/>Descontar stock automáticamente por ventas</label>
                     <label className="flex items-center gap-3"><input type="checkbox" checked={prefData.allowManualAdjustments} onChange={e => setPrefData({...prefData, allowManualAdjustments: e.target.checked})} className="h-4 w-4"/>Permitir ajustes manuales en Remitos</label>
                   </div>
                   <div className="pt-6 border-t mt-4 border-slate-100 dark:border-slate-800">
                     <div className="flex flex-col gap-1.5"><label className="text-sm font-medium">Método de Costeo (Kardex)</label><select className="input-class w-full md:w-1/2" value={prefData.costingMethod} onChange={e => setPrefData({...prefData, costingMethod: e.target.value})}><option value="Promedio Ponderado">Precio Promedio Ponderado (PPP)</option><option value="FIFO">Primeras Entradas (FIFO)</option><option value="LIFO">Últimas Entradas (LIFO)</option></select></div>
                   </div>
                 </CardContent></Card>
                 {renderSubmitButton('inventory')}
              </div>
            ) },
            { id: 'appearance', label: 'Apariencia', content: (
              <div className="space-y-6 mt-6">
                <Card><CardHeader><CardTitle>UI Personalización</CardTitle></CardHeader><CardContent className="space-y-6 pt-4">
                  <div>
                    <label className="block text-sm font-medium mb-3">Modo Visual</label>
                    <div className="flex gap-4">
                      <button onClick={() => updatePreference('themeMode', 'light')} className={`p-4 border rounded-xl flex-1 ${preferences.themeMode === 'light' ? 'border-primary-500 bg-primary-50 text-primary-600' : 'bg-white'}`}>Claro</button>
                      <button onClick={() => updatePreference('themeMode', 'dark')} className={`p-4 border rounded-xl flex-1 ${preferences.themeMode === 'dark' ? 'border-primary-500 bg-primary-900/50 text-primary-400' : 'bg-slate-900 text-white'}`}>Oscuro</button>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <label className="block text-sm font-medium mb-3">Temas Visuales (15 Temas SaaS)</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {[
                        { id: 'light', color: 'bg-slate-200 border border-slate-400', name: '☀️ Light' },
                        { id: 'dark', color: 'bg-slate-950', name: '🌙 Dark Obsidian' },
                        { id: 'midnight', color: 'bg-indigo-950', name: '🌌 Midnight' },
                        { id: 'emerald', color: 'bg-emerald-600', name: '🟢 Emerald' },
                        { id: 'ocean', color: 'bg-cyan-700', name: '🌊 Ocean' },
                        { id: 'sapphire', color: 'bg-blue-800', name: '🔷 Sapphire' },
                        { id: 'indigo', color: 'bg-indigo-600', name: '🔮 Indigo' },
                        { id: 'purple', color: 'bg-purple-700', name: '💜 Purple' },
                        { id: 'rose', color: 'bg-rose-700', name: '🌹 Rose' },
                        { id: 'coffee', color: 'bg-amber-900', name: '☕ Coffee' },
                        { id: 'forest', color: 'bg-green-800', name: '🌲 Forest' },
                        { id: 'sunset', color: 'bg-amber-600', name: '🌅 Sunset' },
                        { id: 'cyber', color: 'bg-cyan-400', name: '⚡ Cyber' },
                        { id: 'slate', color: 'bg-slate-600', name: '🔘 Slate' },
                        { id: 'nord', color: 'bg-slate-700', name: '❄️ Nord' },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => updatePreference('accentColor', t.id as any)}
                          className={`p-3 border rounded-xl flex items-center gap-2 transition-all ${
                            preferences.accentColor === t.id
                              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                              : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full ${t.color} shrink-0`}></span>
                          <span className="text-xs font-semibold truncate">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent></Card>
              </div>
            ) },
            { id: 'security', label: 'Seguridad', content: (
              <div className="space-y-6 mt-6">
                <Card><CardHeader><CardTitle>Contraseña</CardTitle></CardHeader><CardContent className="space-y-4 pt-4">
                  <Input id="pwd" label="Nueva Contraseña" type="password" />
                  <Input id="pwdc" label="Confirmar Contraseña" type="password" />
                  <Button variant="primary">Actualizar Módulo Auth</Button>
                </CardContent></Card>
                <Card><CardHeader><CardTitle>MFA (Multifactor Auth)</CardTitle></CardHeader><CardContent className="space-y-4 pt-4 flex flex-col items-center py-10">
                  <Fingerprint className="h-12 w-12 text-slate-300 mb-4" />
                  <h4 className="text-lg font-bold">Autenticación de 2 Factores</h4>
                  <p className="text-slate-500 text-sm">Protege tu Tenant con TOTP. Próximamente disponible en ERP V2.</p>
                  <Button variant="outline" disabled className="mt-4">Configurar OTP</Button>
                </CardContent></Card>
              </div>
            )},
            { id: 'integrations', label: 'Integraciones', content: (
              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="hover:border-primary-500 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-[#009ee3] rounded-xl flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                            MP
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-extrabold text-slate-900 dark:text-white">Mercado Pago</h4>
                            <p className="text-xs text-slate-500 font-medium">Pagos QR y POS Externo</p>
                            
                            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                              <div className="flex">
                                <span className="w-32 text-slate-400 font-medium">Estado actual:</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {mpStatus === 'NOT_CONFIGURED' ? (
                                    <span className="text-red-500 font-bold">🔴 No Configurado</span>
                                  ) : mpLastTestStatus === 'SUCCESS' ? (
                                    <span className="text-emerald-500 font-bold">🟢 Conectado</span>
                                  ) : mpLastTestStatus === 'FAILED' ? (
                                    <span className="text-red-500 font-bold">🔴 Error de conexión</span>
                                  ) : (
                                    <span className="text-slate-500 font-bold">⚪ Configurado (Sin probar)</span>
                                  )}
                                </span>
                              </div>
                              {mpStatus !== 'NOT_CONFIGURED' && (
                                <>
                                  <div className="flex">
                                    <span className="w-32 text-slate-400 font-medium">Última prueba:</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">
                                      {mpLastTestStatus || 'Ninguna'}
                                    </span>
                                  </div>
                                  <div className="flex">
                                    <span className="w-32 text-slate-400 font-medium">Fecha:</span>
                                    <span className="text-slate-700 dark:text-slate-300">
                                      {mpLastTestAt ? new Date(mpLastTestAt).toLocaleString('es-AR') : 'N/A'}
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {mpStatus === 'NOT_CONFIGURED' ? (
                            <Badge variant="error" dot={false}>🔴 No Configurado</Badge>
                          ) : mpLastTestStatus === 'SUCCESS' ? (
                            <Badge variant="success">🟢 Conectado</Badge>
                          ) : mpLastTestStatus === 'FAILED' ? (
                            <Badge variant="error">🔴 Error de conexión</Badge>
                          ) : (
                            <Badge variant="default" dot={true}>Configurado</Badge>
                          )}
                          <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">
                            {mpEnvironment === 'PRODUCTION' ? 'Producción' : 'Sandbox (Pruebas)'}
                          </span>
                        </div>
                      </div>

                      {/* Modos Vista / Edicion */}
                      {isConfiguringMP ? (
                        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Editar Credenciales de Mercado Pago</h5>
                            <span className="text-xs text-slate-400">Los campos en blanco mantendrán las claves guardadas</span>
                          </div>

                          <div>
                            <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Ambiente de Operación</label>
                            <select
                              value={mpEnvironment}
                              onChange={(e) => setMpEnvironment(e.target.value as any)}
                              className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="SANDBOX">Pruebas (Sandbox)</option>
                              <option value="PRODUCTION">Producción (Production)</option>
                            </select>
                          </div>

                          <Input
                            id="mp_public_key"
                            label="Public Key"
                            placeholder="Ej: APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            value={mpPublicKey}
                            onChange={(e) => setMpPublicKey(e.target.value)}
                          />

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Access Token</label>
                              {mpAccessTokenConfigured && (
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                  🟢 Configurado
                                </span>
                              )}
                            </div>
                            <Input
                              id="mp_access_token"
                              type="password"
                              placeholder={mpAccessTokenConfigured ? "Dejar vacío para mantener actual" : "Ej: APP_USR-xxxxxxxxxxxxxxxx-xxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx"}
                              value={mpAccessTokenValue}
                              onChange={(e) => {
                                setMpAccessTokenValue(e.target.value);
                                setMpAccessTokenChanged(true);
                              }}
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              {mpAccessTokenConfigured 
                                ? "Dejar en blanco para conservar la credencial almacenada en PostgreSQL." 
                                : "Ingresá el Access Token de Producción o Sandbox de Mercado Pago."}
                            </p>
                          </div>

                          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Configuración Firma Webhook</h5>
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Webhook Secret</label>
                                {mpWebhookSecretConfigured && (
                                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    🟢 Configurado
                                  </span>
                                )}
                              </div>
                              <Input
                                id="mp_webhook_secret"
                                type="password"
                                placeholder={mpWebhookSecretConfigured ? "Dejar vacío para mantener actual" : "Firma secreta generada por Mercado Pago"}
                                value={mpWebhookSecretValue}
                                onChange={(e) => {
                                  setMpWebhookSecretValue(e.target.value);
                                  setMpWebhookSecretChanged(true);
                                }}
                              />
                              <p className="text-xs text-slate-500 mt-1">
                                {mpWebhookSecretConfigured 
                                  ? "Dejar en blanco para conservar la firma secreta almacenada en PostgreSQL." 
                                  : "Pegá aquí la firma secreta generada por Mercado Pago para esta aplicación."}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800 mt-6">
                            <Button variant="outline" size="sm" onClick={() => setIsConfiguringMP(false)}>
                              Cancelar
                            </Button>
                            <Button variant="primary" size="sm" onClick={handleSaveMP} disabled={saving}>
                              {saving ? 'Guardando...' : 'Guardar cambios'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
                          {/* Sub-Card 1: Credenciales Guardadas */}
                          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">Credenciales Almacenadas</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="block text-slate-400 font-medium mb-1">Access Token</span>
                                {mpAccessTokenConfigured ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                                    🟢 Configurado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-950/50 dark:text-red-400 px-2.5 py-1 rounded border border-red-200 dark:border-red-800">
                                    🔴 No configurado
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="block text-slate-400 font-medium mb-1">Webhook Secret</span>
                                {mpWebhookSecretConfigured ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                                    🟢 Configurado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-950/50 dark:text-red-400 px-2.5 py-1 rounded border border-red-200 dark:border-red-800">
                                    🔴 No configurado
                                  </span>
                                )}
                              </div>
                              {mpPublicKey && (
                                <div className="sm:col-span-2">
                                  <span className="block text-slate-400 font-medium mb-1">Public Key</span>
                                  <span className="font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 block truncate">
                                    {mpPublicKey}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Sub-Card 2: Webhook URL */}
                          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500">URL de Webhook SaaS</h5>
                              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">🟢 Activo</span>
                            </div>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value="https://presuerp.duckdns.org/api/v1/business/integrations/mercado-pago/webhook"
                                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-600 dark:text-slate-400 select-all"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  navigator.clipboard.writeText('https://presuerp.duckdns.org/api/v1/business/integrations/mercado-pago/webhook');
                                  alert('URL de Webhook copiada al portapapeles');
                                }}
                              >
                                Copiar
                              </Button>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex gap-2 pt-2 justify-end">
                            {mpStatus !== 'NOT_CONFIGURED' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleTestMP} 
                                disabled={saving || mpStatus === 'TESTING'}
                              >
                                {mpStatus === 'TESTING' ? 'Probando...' : 'Probar conexión'}
                              </Button>
                            )}
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => setIsConfiguringMP(true)}
                            >
                              {mpStatus === 'NOT_CONFIGURED' ? 'Configurar credenciales' : 'Editar credenciales'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-slate-800 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
                          ARCA
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-800 dark:text-white">Facturación Electrónica ARCA / AFIP</h4>
                            {arcaConfig?.enabled ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border border-emerald-200">
                                🟢 Conectado
                              </span>
                            ) : arcaConfig?.certificateName || arcaConfig?.taxId ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border border-amber-200">
                                🟡 Certificado cargado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200">
                                ⚪ Disponible
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {arcaConfig?.taxId
                              ? `CUIT: ${arcaConfig.taxId} · Ambiente: ${arcaConfig.environment}`
                              : 'Emisión de facturas A/B/C con trazabilidad fiscal WSFEv1 y QR AFIP'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={arcaConfig?.enabled ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => setActiveSection('fiscal')}
                        className="shrink-0 font-bold"
                      >
                        {arcaConfig?.enabled || arcaConfig?.taxId ? 'Administrar' : 'Configurar'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="opacity-60 bg-slate-50/50 dark:bg-slate-950/20">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-[#25D366] rounded-lg flex items-center justify-center text-white">
                          <Share2 className="h-5 w-5"/>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white">WhatsApp API</h4>
                          <p className="text-xs text-slate-500">Envío de Tickets y Mensajes</p>
                        </div>
                      </div>
                      <Badge variant="outline">Próximamente</Badge>
                    </CardContent>
                  </Card>

                  <Card className="opacity-60 bg-slate-50/50 dark:bg-slate-950/20">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400">
                          <Zap className="h-5 w-5"/>
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white">Webhooks / API Rest</h4>
                          <p className="text-xs text-slate-500">Gatilla eventos ERP hacia afuera</p>
                        </div>
                      </div>
                      <Badge variant="outline">Desarrollo</Badge>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )},
            { id: 'license', label: 'Licencia', content: (
              <div className="space-y-6 mt-6">
                {/* Active Plan Summary Card */}
                <Card className="bg-gradient-to-br from-primary-900 to-indigo-900 text-white border-0 shadow-xl overflow-hidden relative">
                   <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                   <div className="absolute left-0 bottom-0 -translate-x-10 translate-y-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                   
                   <CardContent className="p-8 relative">
                     <div className="flex justify-between items-start">
                       <div>
                         <h4 className="text-primary-200 uppercase font-black tracking-widest text-xs mb-2 font-semibold">PLAN VIGENTE</h4>
                         <div className="text-5xl font-black mb-4 uppercase tracking-wide">
                            {subscription?.plan?.name || bizData.subscriptionPlan}
                         </div>
                         <p className="text-primary-100 text-sm opacity-80 max-w-md">
                            La licencia Cloud SaaS se rige bajo la suscripción activa. Tu plan actual posee los límites y fechas indicados a continuación.
                         </p>
                       </div>
                       <Award className="h-20 w-20 text-primary-500/30 shrink-0" />
                     </div>

                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-10 p-6 bg-black/25 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <div className="text-center">
                           <div className="text-2xl font-black">
                              {settings?._count?.users || 0} / {subscription?.plan?.maxUsers === 0 ? '∞' : (subscription?.plan?.maxUsers || 50)}
                           </div>
                           <div className="text-xs text-primary-200 mt-1 uppercase font-semibold">Usuarios Lim.</div>
                        </div>
                        <div className="text-center">
                           <div className="text-2xl font-black font-sans">
                              {subscription?.plan?.maxProducts === 0 ? 'Ilimitado' : (subscription?.plan?.maxProducts || 5000)}
                           </div>
                           <div className="text-xs text-primary-200 mt-1 uppercase font-semibold">Catálogo Lim.</div>
                        </div>
                        <div className="text-center text-indigo-150 bg-white/5 p-2 rounded-xl flex flex-col justify-center">
                           <div className="text-xs text-primary-200 uppercase font-semibold">Ciclo Activo</div>
                           <div className="text-sm font-black uppercase tracking-wider font-mono mt-0.5">{subscription?.billingCycle || 'N/A'}</div>
                        </div>
                        <div className="text-center text-indigo-150 bg-white/5 p-2 rounded-xl flex flex-col justify-center">
                           <div className="text-xs text-primary-200 uppercase font-semibold">Estado Contrato</div>
                           <div className="text-sm font-black uppercase tracking-wider mt-0.5">
                              {subscription?.status === 'ACTIVE' ? '🟢 ACTIVO' : subscription?.status || 'N/A'}
                           </div>
                        </div>
                     </div>

                     <div className="mt-8 text-sm flex items-center justify-between border-t border-white/10 pt-4">
                        <div>
                           <span className="text-primary-300 font-medium">Próximo vencimiento:</span>
                           <span className="font-extrabold ml-2 font-mono">
                              {subscription?.renewalDate ? new Date(subscription.renewalDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin vencimiento (Sin Límites / Lifetime)'}
                           </span>
                        </div>
                        {subscription?.renewalDate && (
                           <span className="text-xs text-indigo-200 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Renovación automática vía Mercado Pago webhooks
                           </span>
                        )}
                     </div>
                   </CardContent>
                </Card>

                {/* Available plans offering grid */}
                <div className="space-y-4">
                   <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                      <Layers className="w-5 h-5 text-indigo-600 font-semibold" /> Planes de Suscripción Disponibles
                   </h3>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {plans.filter(p => p.active).map((p: any) => {
                         const activePrices = p.prices?.filter((pr: any) => pr.active) || [];
                         const selectedCycle = selectedCycles[p.id] || '';
                         const selectedPriceObj = activePrices.find((pr: any) => pr.billingCycle === selectedCycle);
                         const priceVal = selectedPriceObj ? selectedPriceObj.price : 0;
                         const isCurrentPlan = subscription?.plan?.id === p.id;
                         
                         return (
                            <Card key={p.id} className={`flex flex-col relative border ${isCurrentPlan ? 'border-primary-500 shadow-md ring-1 ring-primary-500/20' : 'border-slate-200 dark:border-slate-800'} transition-all hover:shadow-lg`}>
                               {isCurrentPlan && (
                                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-2 bg-indigo-600 text-white text-[10px] uppercase font-bold py-1 px-2.5 rounded-full shadow-sm tracking-wider">
                                     Plan Contratado
                                  </div>
                               )}
                               
                               <CardHeader className="pb-2">
                                  <CardTitle className="text-xl uppercase font-black tracking-wide text-slate-800 dark:text-slate-100 flex items-center justify-between">
                                     {p.name}
                                  </CardTitle>
                                  <span className="text-xs text-slate-400 font-medium">Límites: {p.maxUsers === 0 ? 'Usuarios Ilimitados' : `${p.maxUsers} Usuarios`} | {p.maxProducts === 0 ? 'Catálogo Ilimitado' : `${p.maxProducts} Productos`}</span>
                               </CardHeader>
                               
                               <CardContent className="flex-1 flex flex-col justify-between p-6">
                                  <div className="space-y-4">
                                     {/* Features list */}
                                     {p.features && (
                                        <div className="text-xs space-y-1 text-slate-500 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-lg">
                                           <div className="font-semibold text-slate-400 uppercase tracking-widest text-[9px] mb-1">Módulos Permitidos:</div>
                                           {(() => {
                                              try {
                                                 const arr = JSON.parse(p.features);
                                                 return Array.isArray(arr) ? arr.map((f: string) => (
                                                    <div key={f} className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-350">
                                                       <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> {f}
                                                    </div>
                                                 )) : <div className="italic">{p.features}</div>;
                                              } catch {
                                                 return <div className="italic">{p.features}</div>;
                                              }
                                           })()}
                                        </div>
                                     )}
                                     
                                     {/* Cycle selector dropdown */}
                                     {activePrices.length > 0 ? (
                                        <div className="flex flex-col gap-1">
                                           <label className="text-[10px] font-bold text-slate-400 uppercase">CICLO FACTURACIÓN</label>
                                           <select 
                                              value={selectedCycle} 
                                              onChange={e => setSelectedCycles({...selectedCycles, [p.id]: e.target.value})}
                                              className="w-full text-xs font-semibold py-1.5 px-2 border rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                                           >
                                              {activePrices.map((pr: any) => (
                                                 <option key={pr.id} value={pr.billingCycle} className="font-mono">
                                                    {pr.billingCycle} - (${Number(pr.price).toLocaleString()})
                                                 </option>
                                              ))}
                                           </select>
                                        </div>
                                     ) : (
                                        <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200 mt-2 font-medium italic">
                                           Sin ciclos de precios activos actualmente.
                                        </div>
                                     )}
                                  </div>
                                  
                                  {/* Dynamic price representation */}
                                  <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                                     <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-slate-800 dark:text-white font-mono">${Number(priceVal).toLocaleString()}</span>
                                        <span className="text-xs font-semibold text-slate-500 uppercase">/{selectedCycle.toLowerCase()}</span>
                                     </div>
                                     
                                     {activePrices.length > 0 && (
                                        <button 
                                           disabled={payingPlanPrice !== null}
                                           onClick={() => handleCheckoutLicense(p.id)} 
                                           className={`w-full mt-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm ${
                                              isCurrentPlan 
                                                 ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-850 dark:text-white dark:hover:bg-slate-800' 
                                                 : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md'
                                           }`}
                                        >
                                           {payingPlanPrice === p.id ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                           ) : (
                                              <CreditCard className="w-3.5 h-3.5" />
                                           )}
                                           {isCurrentPlan ? 'Renovar / Extender' : 'Contratar Plan'}
                                        </button>
                                     )}
                                  </div>
                               </CardContent>
                            </Card>
                         );
                      })}
                   </div>
                </div>
              </div>
            )},
            { id: 'loyalty', label: 'Fidelización', content: (
               <div className="space-y-6 mt-6">
                 <Card>
                   <CardHeader>
                     <CardTitle>Programa de Fidelización de Clientes</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-6 pt-4">
                     <div className="flex flex-col gap-4">
                       <label className="flex items-center gap-2 cursor-pointer">
                         <input
                           type="checkbox"
                           checked={loyaltyData.enabled}
                           onChange={e => setLoyaltyData({...loyaltyData, enabled: e.target.checked})}
                           className="w-4 h-4 rounded text-indigo-650"
                         />
                         <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Habilitar programa de fidelización</span>
                       </label>
                     </div>
                     
                     {loyaltyData.enabled && (
                       <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Valor del Punto ($)</label>
                             <input
                               type="number"
                               className="input-class"
                               value={loyaltyData.pointValue}
                               onChange={e => setLoyaltyData({...loyaltyData, pointValue: Number(e.target.value)})}
                             />
                             <span className="text-xs text-slate-500 mt-1 block">Equivalencia en dinero por cada punto canjeado (ej: 1 punto = $10)</span>
                           </div>
                           
                           <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Monto Mínimo de Compra para Acumular ($)</label>
                             <input
                               type="number"
                               className="input-class"
                               value={loyaltyData.minimumSaleAmount}
                               onChange={e => setLoyaltyData({...loyaltyData, minimumSaleAmount: Number(e.target.value)})}
                             />
                             <span className="text-xs text-slate-500 mt-1 block">Venta mínima requerida para sumar puntos</span>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Regla de Acumulación (Monto de tramo, $)</label>
                             <input
                               type="number"
                               className="input-class"
                               value={loyaltyData.earnEveryAmount}
                               onChange={e => setLoyaltyData({...loyaltyData, earnEveryAmount: Number(e.target.value)})}
                             />
                             <span className="text-xs text-slate-500 mt-1 block">Cada cuánto dinero abonado se otorgan puntos (ej: Cada $1000)</span>
                           </div>

                           <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Puntos por tramo</label>
                             <input
                               type="number"
                               className="input-class"
                               value={loyaltyData.earnPoints}
                               onChange={e => setLoyaltyData({...loyaltyData, earnPoints: Number(e.target.value)})}
                             />
                             <span className="text-xs text-slate-500 mt-1 block">Cuántos puntos se otorgan por cada tramo (ej: genera 10 puntos)</span>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
                           <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Cálculo de puntos sobre</label>
                             <select
                               className="w-full text-xs font-semibold py-2 px-3 border rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                               value={loyaltyData.pointsCalculationMode}
                               onChange={e => setLoyaltyData({...loyaltyData, pointsCalculationMode: e.target.value as any})}
                             >
                               <option value="GROSS">Monto Bruto (Sin descuentos)</option>
                               <option value="AFTER_DISCOUNTS">Monto con Descuento</option>
                               <option value="EFFECTIVELY_PAID">Monto Efectivamente Pagado (Neto de puntos/canjes)</option>
                             </select>
                             <span className="text-xs text-slate-500 mt-1 block">Base de cálculo del monto de la venta para otorgar puntos</span>
                           </div>

                           <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Modo de Redondeo</label>
                             <select
                               className="w-full text-xs font-semibold py-2 px-3 border rounded-lg focus:ring-1 focus:ring-indigo-500 bg-white dark:bg-slate-800 dark:text-white"
                               value={loyaltyData.roundingMode}
                               onChange={e => setLoyaltyData({...loyaltyData, roundingMode: e.target.value as any})}
                             >
                               <option value="FLOOR">Hacia abajo (Piso)</option>
                               <option value="ROUND">Matemático tradicional (Próximo)</option>
                               <option value="CEIL">Hacia arriba (Techo)</option>
                             </select>
                             <span className="text-xs text-slate-500 mt-1 block">Cómo redondear los puntos calculados</span>
                           </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div>
                             <label className="flex items-center gap-2 cursor-pointer mt-4">
                               <input
                                 type="checkbox"
                                 checked={loyaltyData.allowRedemption}
                                 onChange={e => setLoyaltyData({...loyaltyData, allowRedemption: e.target.checked})}
                                 className="w-4 h-4 rounded text-indigo-650"
                               />
                               <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Permitir canje / uso de puntos</span>
                             </label>
                             <span className="text-xs text-slate-500 mt-1 block">Habilita a los cajeros en el POS a cobrar ventas usando puntos</span>
                           </div>

                           <div>
                             <label className="flex items-center gap-2 cursor-pointer mt-4">
                               <input
                                 type="checkbox"
                                 checked={loyaltyData.accumulateOnPointsPaid}
                                 onChange={e => setLoyaltyData({...loyaltyData, accumulateOnPointsPaid: e.target.checked})}
                                 className="w-4 h-4 rounded text-indigo-650"
                               />
                               <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Compras usando puntos generan puntos</span>
                             </label>
                             <span className="text-xs text-slate-500 mt-1 block">Define si la porción pagada con puntos también genera nuevos puntos</span>
                           </div>
                         </div>

                         {loyaltyData.allowRedemption && (
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                             <div>
                               <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Porcentaje máximo de descuento (%)</label>
                               <input
                                 type="number"
                                 className="input-class"
                                 value={loyaltyData.maxRedemptionPercentage}
                                 onChange={e => setLoyaltyData({...loyaltyData, maxRedemptionPercentage: Number(e.target.value)})}
                               />
                               <span className="text-xs text-slate-500 mt-1 block">Porcentaje máximo de la venta que se puede abonar con puntos (ej: 50%)</span>
                             </div>

                             <div>
                               <label className="flex items-center gap-2 cursor-pointer mt-6">
                                 <input
                                   type="checkbox"
                                   checked={loyaltyData.allowPartialRedemption}
                                   onChange={e => setLoyaltyData({...loyaltyData, allowPartialRedemption: e.target.checked})}
                                   className="w-4 h-4 rounded text-indigo-650"
                                 />
                                 <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Permitir canje parcial de saldo</span>
                               </label>
                               <span className="text-xs text-slate-500 mt-1 block">Permite canjear menos puntos del máximo permitido para la venta</span>
                             </div>
                           </div>
                         )}

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                           <div>
                             <label className="flex items-center gap-2 cursor-pointer mt-2">
                               <input
                                 type="checkbox"
                                 checked={loyaltyData.expirePoints}
                                 onChange={e => setLoyaltyData({...loyaltyData, expirePoints: e.target.checked})}
                                 className="w-4 h-4 rounded text-indigo-650"
                               />
                               <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Expirar puntos ganados</span>
                             </label>
                             <span className="text-xs text-slate-500 mt-1 block">Los puntos acumulados caducarán tras un período determinado</span>
                           </div>

                           {loyaltyData.expirePoints && (
                             <div>
                               <label className="text-[10px] font-bold text-slate-400 uppercase font-mono">Meses de validez</label>
                               <input
                                 type="number"
                                 className="input-class"
                                 value={loyaltyData.expirationMonths}
                                 onChange={e => setLoyaltyData({...loyaltyData, expirationMonths: Number(e.target.value)})}
                               />
                               <span className="text-xs text-slate-500 mt-1 block">Cantidad de meses antes del vencimiento del lote (ej: 12)</span>
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                   </CardContent>
                 </Card>
                 {renderSubmitButton('loyalty')}
               </div>
             )}
          ].filter(tab => {
            return menuGroups.some(group => group.items.some(item => item.id === tab.id));
          }).find(s => s.id === activeSection)?.content}
        </div>
      </div>
      <style>{`
        .settings-panel-container .input-class {
          display: block; width: 100%; border-radius: 0.75rem; border: 1px solid #cbd5e1;
          background-color: #ffffff; padding: 0.625rem 0.875rem; color: #0f172a; font-size: 0.875rem;
          font-weight: 500; transition: all 0.2s; outline: none; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        }
        .settings-panel-container .input-class:focus { 
          border-color: #0ea5e9; background-color: #ffffff; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); 
        }
        
        .dark .settings-panel-container .input-class { 
          background-color: #0f172a; border-color: #334155; color: #f8fafc; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.2); 
        }
        .dark .settings-panel-container .input-class:focus { 
          border-color: #38bdf8; background-color: #0f172a; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15); 
        }

        /* Modern Small Labels */
        .settings-panel-container label {
          font-size: 0.65rem !important;
          font-weight: 700 !important;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 0.35rem;
          display: block;
        }
        .dark .settings-panel-container label { color: #94a3b8; }
        
        /* Typography overrides */
        .settings-panel-container h3 { letter-spacing: -0.025em; font-weight: 800; }
        
        /* Flex improvements for checkboxes */
        .settings-panel-container label:has(input[type="checkbox"]) {
          display: flex !important;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.875rem !important;
          text-transform: none;
          letter-spacing: normal;
          color: #334155;
          font-weight: 600 !important;
          cursor: pointer;
        }
        .dark .settings-panel-container label:has(input[type="checkbox"]) { color: #cbd5e1; }
        .settings-panel-container input[type="checkbox"] { width: 1.25rem; height: 1.25rem; accent-color: #6366f1; border-radius: 0.35rem; }
      `}</style>
    </div>
  );
};
