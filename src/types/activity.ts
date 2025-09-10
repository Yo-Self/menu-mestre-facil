export interface Activity {
  id: string;
  table_name: string;
  operation: string;
  record_id?: string;
  user_id: string;
  old_values?: any;
  new_values?: any;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
}

export interface QuickAction {
  title: string;
  description: string;
  icon: any;
  href: string;
  color: string;
}

export type ActivityType = 
  | 'restaurant_created'
  | 'restaurant_updated'
  | 'restaurant_deleted'
  | 'menu_created'
  | 'menu_updated'
  | 'menu_deleted'
  | 'category_created'
  | 'category_updated'
  | 'category_deleted'
  | 'dish_created'
  | 'dish_updated'
  | 'dish_deleted'
  | 'import_started'
  | 'import_completed'
  | 'import_failed';

export interface ActivityDisplay {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}
