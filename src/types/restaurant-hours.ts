export interface RestaurantHours {
  id: string;
  restaurant_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  open_time: string; // Format: "HH:MM:SS"
  close_time: string; // Format: "HH:MM:SS"
  is_closed: boolean;
  created_at: string;
  updated_at: string;
}

export interface RestaurantHoursInput {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface DaySchedule {
  dayOfWeek: number;
  dayName: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  hasHours: boolean;
  id?: string;
}

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export function getDayName(dayOfWeek: number): string {
  const day = DAYS_OF_WEEK.find(d => d.value === dayOfWeek);
  return day?.label || 'Desconhecido';
}

export function formatTime(time: string): string {
  // Convert "HH:MM:SS" to "HH:MM"
  return time.substring(0, 5);
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isCurrentlyOpen(hours: RestaurantHours): boolean {
  if (hours.is_closed) return false;

  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  if (hours.day_of_week !== currentDay) return false;

  const openMinutes = timeToMinutes(hours.open_time);
  const closeMinutes = timeToMinutes(hours.close_time);

  if (openMinutes <= closeMinutes) {
    // Normal case: opens and closes on the same day
    return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
  } else {
    // Crosses midnight
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }
}
