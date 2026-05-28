import posthog from 'posthog-js';

// Serviço unificado para telemetria e análise comportamental no painel
export const Analytics = {
  // --- Fluxos de Autenticação ---
  trackLogin(userId: string, email: string) {
    try {
      posthog.capture('user_logged_in', { userId, email });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },
  
  trackSignup(userId: string, email: string) {
    try {
      posthog.capture('user_registered', { userId, email });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  trackLogout() {
    try {
      posthog.capture('user_logged_out');
      posthog.reset(); // Remove a identificação do usuário da sessão atual
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  // --- Importador e Scraper de Cardápios (iFood / MenuDino) ---
  trackImportStart(url: string) {
    try {
      const source = url.includes('ifood.com.br') ? 'ifood' : 'menudino';
      posthog.capture('menu_import_started', { source, url });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  trackImportSuccess(url: string, itemsCount: number) {
    try {
      const source = url.includes('ifood.com.br') ? 'ifood' : 'menudino';
      posthog.capture('menu_import_completed', { source, url, items_count: itemsCount });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  trackImportFailed(url: string, error: string) {
    try {
      const source = url.includes('ifood.com.br') ? 'ifood' : 'menudino';
      posthog.capture('menu_import_failed', { source, url, error });
      
      // Registra a exceção para que apareça na aba de Error Tracking
      posthog.captureException(new Error(`Importador (${source}) falhou: ${error}`), {
        extra: { url, error }
      });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  // --- Gerenciamento de Pratos & Categorias ---
  trackDishCreated(restaurantId: string, categoryId: string, price: number) {
    try {
      posthog.capture('dish_created', { 
        restaurant_id: restaurantId, 
        category_id: categoryId, 
        price 
      });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  trackImageUpload(fileSize: number, compressed: boolean) {
    try {
      posthog.capture('image_uploaded', { 
        file_size_bytes: fileSize, 
        was_compressed: compressed 
      });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  // --- PDV (POS) e Pedidos Locais ---
  trackPOSOrderCreated(restaurantId: string, itemsCount: number, totalPrice: number) {
    try {
      posthog.capture('pos_order_created', { 
        restaurant_id: restaurantId, 
        items_count: itemsCount, 
        total_price: totalPrice 
      });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  // --- Impressão Térmica (Electron) ---
  trackPrintJob(type: 'order' | 'report' | 'receipt', success: boolean, printerName?: string) {
    try {
      posthog.capture('thermal_print_job', { 
        print_type: type, 
        success, 
        printer_name: printerName || 'default'
      });
    } catch (e) {
      console.error('Telemetria indisponível', e);
    }
  },

  // --- Captura de Exceções Manuais ---
  trackError(error: Error | any, context?: Record<string, any>) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error('🚨 Telemetria capturou erro:', errorObj, context);
    
    try {
      // 1. Captura evento customizado estruturado
      posthog.capture('app_error', {
        message: errorObj.message,
        name: errorObj.name,
        context
      });

      // 2. Reporta ao PostHog Error Tracking
      posthog.captureException(errorObj, { extra: context });
    } catch (e) {
      console.error('Falha ao enviar exceção para a telemetria', e);
    }
  }
};
