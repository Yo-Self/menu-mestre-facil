import { useEffect } from 'react';
import { RestaurantScheduleService } from '@/services/restaurantScheduleService';

/**
 * Component that initializes the automatic restaurant schedule service
 * This will check and update restaurant open/closed status every minute
 */
export function RestaurantScheduleMonitor() {
  useEffect(() => {
    console.log('✅ Restaurant Schedule Monitor: Starting automatic checks...');
    const cleanup = RestaurantScheduleService.startScheduleChecker();
    return cleanup;
  }, []);

  // This component doesn't render anything
  return null;
}
