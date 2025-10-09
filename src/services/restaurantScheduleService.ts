import { supabase } from '@/integrations/supabase/client';

interface RestaurantScheduleCheck {
  restaurantId: string;
  shouldBeOpen: boolean;
  currentStatus: boolean;
}

export class RestaurantScheduleService {
  /**
   * Check if a restaurant should be open based on its configured hours
   */
  static async checkRestaurantSchedule(restaurantId: string): Promise<RestaurantScheduleCheck | null> {
    try {
      // Get current day and time
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;

      // Get restaurant current status
      const { data: restaurant, error: restaurantError } = await supabase
        .from('restaurants')
        .select('open, id')
        .eq('id', restaurantId)
        .single();

      if (restaurantError || !restaurant) {
        console.error('Error fetching restaurant:', restaurantError);
        return null;
      }

      // Get hours for current day
      const { data: hours, error: hoursError } = await supabase
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', currentDay)
        .single();

      // If no hours configured for today, don't change anything
      if (hoursError || !hours) {
        return {
          restaurantId,
          shouldBeOpen: restaurant.open,
          currentStatus: restaurant.open,
        };
      }

      // If restaurant is closed for the day
      if (hours.is_closed) {
        return {
          restaurantId,
          shouldBeOpen: false,
          currentStatus: restaurant.open,
        };
      }

      // Check if current time is within operating hours
      const shouldBeOpen = this.isTimeInRange(
        currentTime,
        hours.open_time,
        hours.close_time
      );

      return {
        restaurantId,
        shouldBeOpen,
        currentStatus: restaurant.open,
      };
    } catch (error) {
      console.error('Error checking restaurant schedule:', error);
      return null;
    }
  }

  /**
   * Update restaurant open status if it doesn't match the schedule
   */
  static async updateRestaurantStatus(restaurantId: string): Promise<boolean> {
    const check = await this.checkRestaurantSchedule(restaurantId);

    if (!check) return false;

    // If status matches, no need to update
    if (check.shouldBeOpen === check.currentStatus) {
      return true;
    }

    // Update restaurant status
    const { error } = await supabase
      .from('restaurants')
      .update({ open: check.shouldBeOpen })
      .eq('id', restaurantId);

    if (error) {
      console.error('Error updating restaurant status:', error);
      return false;
    }

    console.log(
      `Restaurant ${restaurantId} status updated to ${check.shouldBeOpen ? 'open' : 'closed'} based on schedule`
    );

    return true;
  }

  /**
   * Check all restaurants and update their status based on schedule
   */
  static async updateAllRestaurantsStatus(): Promise<void> {
    try {
      // Get all restaurants that have hours configured
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('id')
        .not('id', 'is', null);

      if (error || !restaurants) {
        console.error('Error fetching restaurants:', error);
        return;
      }

      // Update each restaurant
      for (const restaurant of restaurants) {
        await this.updateRestaurantStatus(restaurant.id);
      }
    } catch (error) {
      console.error('Error updating all restaurants status:', error);
    }
  }

  /**
   * Check if a time is within a range (handles midnight crossing)
   */
  private static isTimeInRange(
    currentTime: string,
    openTime: string,
    closeTime: string
  ): boolean {
    const current = this.timeToMinutes(currentTime);
    const open = this.timeToMinutes(openTime);
    const close = this.timeToMinutes(closeTime);

    if (open <= close) {
      // Normal case: opens and closes on the same day
      return current >= open && current <= close;
    } else {
      // Crosses midnight
      return current >= open || current <= close;
    }
  }

  /**
   * Convert time string (HH:MM:SS) to minutes since midnight
   */
  private static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Start automatic schedule checking (runs every minute)
   */
  static startScheduleChecker(): () => void {
    console.log('Starting restaurant schedule checker...');

    // Run immediately
    this.updateAllRestaurantsStatus();

    // Then run every minute
    const intervalId = setInterval(() => {
      this.updateAllRestaurantsStatus();
    }, 60000); // 60000ms = 1 minute

    // Return cleanup function
    return () => {
      console.log('Stopping restaurant schedule checker...');
      clearInterval(intervalId);
    };
  }
}
