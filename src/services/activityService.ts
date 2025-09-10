import { supabase } from '@/integrations/supabase/client';
import { Activity, ActivityDisplay, ActivityType } from '@/types/activity';

export class ActivityService {
  static async getRecentActivities(limit: number = 10): Promise<ActivityDisplay[]> {
    try {
      const { data: activities, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao buscar atividades:', error);
        return [];
      }

      return activities?.map(activity => this.formatActivity(activity)) || [];
    } catch (error) {
      console.error('Erro ao buscar atividades:', error);
      return [];
    }
  }

  static async getImportActivities(limit: number = 5): Promise<ActivityDisplay[]> {
    try {
      const { data: importLogs, error } = await supabase
        .from('import_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Erro ao buscar logs de importação:', error);
        return [];
      }

      return importLogs?.map(log => this.formatImportActivity(log)) || [];
    } catch (error) {
      console.error('Erro ao buscar logs de importação:', error);
      return [];
    }
  }

  private static formatActivity(activity: Activity): ActivityDisplay {
    const activityType = this.getActivityType(activity);
    const activityInfo = this.getActivityInfo(activityType, activity);
    
    return {
      id: activity.id,
      type: activityType,
      title: activityInfo.title,
      description: activityInfo.description,
      timestamp: activity.timestamp,
      icon: activityInfo.icon,
      color: activityInfo.color,
    };
  }

  private static formatImportActivity(log: any): ActivityDisplay {
    const status = log.status;
    const activityType = this.getImportActivityType(status);
    const activityInfo = this.getImportActivityInfo(status, log);
    
    return {
      id: log.id,
      type: activityType,
      title: activityInfo.title,
      description: activityInfo.description,
      timestamp: log.created_at,
      icon: activityInfo.icon,
      color: activityInfo.color,
    };
  }

  private static getActivityType(activity: Activity): ActivityType {
    const { table_name, operation } = activity;
    
    if (table_name === 'restaurants') {
      return operation === 'INSERT' ? 'restaurant_created' :
             operation === 'UPDATE' ? 'restaurant_updated' : 'restaurant_deleted';
    }
    
    if (table_name === 'menus') {
      return operation === 'INSERT' ? 'menu_created' :
             operation === 'UPDATE' ? 'menu_updated' : 'menu_deleted';
    }
    
    if (table_name === 'categories') {
      return operation === 'INSERT' ? 'category_created' :
             operation === 'UPDATE' ? 'category_updated' : 'category_deleted';
    }
    
    if (table_name === 'dishes') {
      return operation === 'INSERT' ? 'dish_created' :
             operation === 'UPDATE' ? 'dish_updated' : 'dish_deleted';
    }
    
    return 'restaurant_created'; // fallback
  }

  private static getImportActivityType(status: string): ActivityType {
    switch (status) {
      case 'scraping':
      case 'processing':
      case 'preview_ready':
      case 'importing':
        return 'import_started';
      case 'import_success':
        return 'import_completed';
      case 'import_failed':
      case 'scraping_failed':
      case 'processing_failed':
      case 'cancelled':
        return 'import_failed';
      default:
        return 'import_started';
    }
  }

  private static getActivityInfo(type: ActivityType, activity: Activity) {
    const name = this.extractName(activity);
    
    switch (type) {
      case 'restaurant_created':
        return {
          title: 'Restaurante Criado',
          description: `"${name}" foi criado`,
          icon: 'Store',
          color: 'text-green-600',
        };
      case 'restaurant_updated':
        return {
          title: 'Restaurante Atualizado',
          description: `"${name}" foi atualizado`,
          icon: 'Store',
          color: 'text-blue-600',
        };
      case 'restaurant_deleted':
        return {
          title: 'Restaurante Removido',
          description: `"${name}" foi removido`,
          icon: 'Store',
          color: 'text-red-600',
        };
      case 'menu_created':
        return {
          title: 'Menu Criado',
          description: `"${name}" foi criado`,
          icon: 'Menu',
          color: 'text-green-600',
        };
      case 'menu_updated':
        return {
          title: 'Menu Atualizado',
          description: `"${name}" foi atualizado`,
          icon: 'Menu',
          color: 'text-blue-600',
        };
      case 'menu_deleted':
        return {
          title: 'Menu Removido',
          description: `"${name}" foi removido`,
          icon: 'Menu',
          color: 'text-red-600',
        };
      case 'category_created':
        return {
          title: 'Categoria Criada',
          description: `"${name}" foi criada`,
          icon: 'FolderOpen',
          color: 'text-green-600',
        };
      case 'category_updated':
        return {
          title: 'Categoria Atualizada',
          description: `"${name}" foi atualizada`,
          icon: 'FolderOpen',
          color: 'text-blue-600',
        };
      case 'category_deleted':
        return {
          title: 'Categoria Removida',
          description: `"${name}" foi removida`,
          icon: 'FolderOpen',
          color: 'text-red-600',
        };
      case 'dish_created':
        return {
          title: 'Prato Criado',
          description: `"${name}" foi criado`,
          icon: 'UtensilsCrossed',
          color: 'text-green-600',
        };
      case 'dish_updated':
        return {
          title: 'Prato Atualizado',
          description: `"${name}" foi atualizado`,
          icon: 'UtensilsCrossed',
          color: 'text-blue-600',
        };
      case 'dish_deleted':
        return {
          title: 'Prato Removido',
          description: `"${name}" foi removido`,
          icon: 'UtensilsCrossed',
          color: 'text-red-600',
        };
      default:
        return {
          title: 'Atividade',
          description: 'Nova atividade no sistema',
          icon: 'Activity',
          color: 'text-gray-600',
        };
    }
  }

  private static getImportActivityInfo(status: string, log: any) {
    const url = log.url || 'MenuDino';
    
    switch (status) {
      case 'scraping':
        return {
          title: 'Importação Iniciada',
          description: `Extraindo dados de ${url}`,
          icon: 'Download',
          color: 'text-blue-600',
        };
      case 'processing':
        return {
          title: 'Processando Dados',
          description: `Validando dados de ${url}`,
          icon: 'Settings',
          color: 'text-yellow-600',
        };
      case 'preview_ready':
        return {
          title: 'Preview Pronto',
          description: `Dados de ${url} prontos para revisão`,
          icon: 'Eye',
          color: 'text-purple-600',
        };
      case 'importing':
        return {
          title: 'Importando',
          description: `Importando dados de ${url}`,
          icon: 'Upload',
          color: 'text-blue-600',
        };
      case 'import_success':
        return {
          title: 'Importação Concluída',
          description: `Dados de ${url} importados com sucesso`,
          icon: 'CheckCircle',
          color: 'text-green-600',
        };
      case 'import_failed':
      case 'scraping_failed':
      case 'processing_failed':
        return {
          title: 'Importação Falhou',
          description: `Erro ao importar dados de ${url}`,
          icon: 'XCircle',
          color: 'text-red-600',
        };
      case 'cancelled':
        return {
          title: 'Importação Cancelada',
          description: `Importação de ${url} foi cancelada`,
          icon: 'X',
          color: 'text-gray-600',
        };
      default:
        return {
          title: 'Importação',
          description: `Atividade de importação de ${url}`,
          icon: 'Download',
          color: 'text-gray-600',
        };
    }
  }

  private static extractName(activity: Activity): string {
    if (activity.new_values?.name) {
      return activity.new_values.name;
    }
    if (activity.old_values?.name) {
      return activity.old_values.name;
    }
    return 'Item';
  }
}
