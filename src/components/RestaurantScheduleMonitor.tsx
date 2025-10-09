import { useEffect } from 'react';
import { RestaurantScheduleService } from '@/services/restaurantScheduleService';

/**
 * Component that initializes the automatic restaurant schedule service
 * This will check and update restaurant open/closed status every minute
 * 
 * TEMPORARILY DISABLED until migration is applied
 */
export function RestaurantScheduleMonitor() {
  useEffect(() => {
    // TEMPORARILY DISABLED - API 406 error needs to be fixed first
    // Uncomment after fixing the Supabase API access issue
    
    // const cleanup = RestaurantScheduleService.startScheduleChecker();
    // return cleanup;
    
    console.log('⚠️ Restaurant Schedule Monitor: DISABLED due to API 406 errors');
    console.log('📋 Fix: Check DIAGNOSTIC_AND_FIX.sql and restart Supabase API');
  }, []);

  // This component doesn't render anything
  return null;
}
