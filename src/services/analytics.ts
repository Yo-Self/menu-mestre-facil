import posthog from 'posthog-js';
import { captureError } from '@/lib/observability';
import { getAppPlatform, getAppVersion } from '@/lib/platform';

function baseProps(extra?: Record<string, unknown>) {
  return {
    platform: getAppPlatform(),
    app_version: getAppVersion(),
    page_path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

function track(event: string, properties?: Record<string, unknown>) {
  try {
    posthog.capture(event, baseProps(properties));
  } catch (e) {
    console.error('Telemetria indisponível', e);
  }
}

// Serviço unificado para telemetria e análise comportamental no painel
export const Analytics = {
  trackLogin(userId: string, email: string) {
    track('user_logged_in', { userId, email });
  },

  trackSignup(userId: string, email: string) {
    track('user_registered', { userId, email });
  },

  trackLogout() {
    track('user_logged_out');
    try {
      posthog.reset();
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  trackImportStart(url: string) {
    const source = url.includes('ifood.com.br') ? 'ifood' : 'menudino';
    track('menu_import_started', { source, url });
  },

  trackImportSuccess(url: string, itemsCount: number) {
    const source = url.includes('ifood.com.br') ? 'ifood' : 'menudino';
    track('menu_import_completed', { source, url, items_count: itemsCount });
  },

  trackImportFailed(url: string, error: string) {
    const source = url.includes('ifood.com.br') ? 'ifood' : 'menudino';
    track('menu_import_failed', { source, url, error });
    captureError(new Error(`Importador (${source}) falhou: ${error}`), {
      feature: 'menu_import',
      url,
      error,
    });
  },

  trackDishCreated(restaurantId: string, categoryId: string, price: number) {
    track('dish_created', {
      restaurant_id: restaurantId,
      category_id: categoryId,
      price,
    });
  },

  trackImageUpload(fileSize: number, compressed: boolean) {
    track('image_uploaded', {
      file_size_bytes: fileSize,
      was_compressed: compressed,
    });
  },

  trackPOSOrderCreated(restaurantId: string, itemsCount: number, totalPrice: number) {
    track('pos_order_created', {
      restaurant_id: restaurantId,
      items_count: itemsCount,
      total_price: totalPrice,
    });
  },

  trackPrintJob(type: 'order' | 'report' | 'receipt', success: boolean, printerName?: string) {
    track('thermal_print_job', {
      print_type: type,
      success,
      printer_name: printerName || 'default',
    });
  },

  trackError(error: Error | unknown, context?: Record<string, unknown>) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('🚨 Telemetria capturou erro:', errorObj, context);

    track('app_error', {
      message: errorObj.message,
      name: errorObj.name,
      ...context,
    });

    captureError(errorObj, {
      feature: 'app_error',
      ...context,
    });
  },

  trackReportPeriodChanged(periodName: string, isAllRestaurants: boolean) {
    track('report_period_changed', {
      period_name: periodName,
      all_restaurants: isAllRestaurants,
    });
  },

  trackReportExported(format: 'pdf' | 'csv' | 'xlsx') {
    track('report_exported', { format });
  },

  trackStockUpdated(dishId: string, newQuantity: number, diff: number) {
    track('stock_quantity_updated', {
      dish_id: dishId,
      new_quantity: newQuantity,
      difference: diff,
    });
  },
};
