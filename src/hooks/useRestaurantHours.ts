import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RestaurantHours, RestaurantHoursInput, DaySchedule, DAYS_OF_WEEK } from '@/types/restaurant-hours';
import { useToast } from './use-toast';

export function useRestaurantHours(restaurantId: string | undefined) {
  const [hours, setHours] = useState<RestaurantHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (restaurantId) {
      fetchHours();
    }
  }, [restaurantId]);

  const fetchHours = async () => {
    if (!restaurantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('restaurant_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('day_of_week', { ascending: true });

      if (error) throw error;
      setHours(data || []);
    } catch (error) {
      console.error('Error fetching restaurant hours:', error);
      toast({
        title: 'Erro ao carregar horários',
        description: 'Não foi possível carregar os horários de funcionamento.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getDaySchedules = useCallback((): DaySchedule[] => {
    return DAYS_OF_WEEK.map(day => {
      const existingHours = hours.find(h => h.day_of_week === day.value);
      
      if (existingHours) {
        return {
          dayOfWeek: day.value,
          dayName: day.label,
          openTime: existingHours.open_time.substring(0, 5), // HH:MM
          closeTime: existingHours.close_time.substring(0, 5), // HH:MM
          isClosed: existingHours.is_closed,
          hasHours: true,
          id: existingHours.id,
        };
      }
      
      return {
        dayOfWeek: day.value,
        dayName: day.label,
        openTime: '09:00',
        closeTime: '22:00',
        isClosed: false,
        hasHours: false,
      };
    });
  }, [hours]);

  const saveHours = async (schedules: DaySchedule[]) => {
    if (!restaurantId) return;

    try {
      setSaving(true);

      // Process each day
      for (const schedule of schedules) {
        const hoursData: RestaurantHoursInput = {
          day_of_week: schedule.dayOfWeek,
          open_time: `${schedule.openTime}:00`,
          close_time: `${schedule.closeTime}:00`,
          is_closed: schedule.isClosed,
        };

        if (schedule.hasHours && schedule.id) {
          // Update existing hours
          const { error } = await supabase
            .from('restaurant_hours')
            .update(hoursData)
            .eq('id', schedule.id);

          if (error) throw error;
        } else {
          // Insert new hours
          const { error } = await supabase
            .from('restaurant_hours')
            .insert({
              restaurant_id: restaurantId,
              ...hoursData,
            });

          if (error) throw error;
        }
      }

      toast({
        title: 'Horários salvos',
        description: 'Os horários de funcionamento foram salvos com sucesso.',
      });

      await fetchHours();
      return true;
    } catch (error) {
      console.error('Error saving restaurant hours:', error);
      toast({
        title: 'Erro ao salvar horários',
        description: 'Não foi possível salvar os horários de funcionamento.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deleteHours = async (dayOfWeek: number) => {
    if (!restaurantId) return;

    try {
      const { error } = await supabase
        .from('restaurant_hours')
        .delete()
        .eq('restaurant_id', restaurantId)
        .eq('day_of_week', dayOfWeek);

      if (error) throw error;

      toast({
        title: 'Horário removido',
        description: 'O horário foi removido com sucesso.',
      });

      await fetchHours();
    } catch (error) {
      console.error('Error deleting restaurant hours:', error);
      toast({
        title: 'Erro ao remover horário',
        description: 'Não foi possível remover o horário.',
        variant: 'destructive',
      });
    }
  };

  const isRestaurantCurrentlyOpen = (): boolean => {
    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayHours = hours.find(h => h.day_of_week === currentDay);

    if (!todayHours || todayHours.is_closed) {
      return false;
    }

    const openMinutes = timeToMinutes(todayHours.open_time);
    const closeMinutes = timeToMinutes(todayHours.close_time);

    if (openMinutes <= closeMinutes) {
      return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
    } else {
      return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
    }
  };

  return {
    hours,
    loading,
    saving,
    fetchHours,
    getDaySchedules,
    saveHours,
    deleteHours,
    isRestaurantCurrentlyOpen,
  };
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
