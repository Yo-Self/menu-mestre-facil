import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Clock, Save, AlertCircle } from 'lucide-react';
import { useRestaurantHours } from '@/hooks/useRestaurantHours';
import { DaySchedule, DAYS_OF_WEEK } from '@/types/restaurant-hours';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function RestaurantHoursPage() {
  const { id: restaurantId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loading, saving, getDaySchedules, saveHours } = useRestaurantHours(restaurantId);
  
  const [schedules, setSchedules] = useState<DaySchedule[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!loading) {
      setSchedules(getDaySchedules());
    }
  }, [loading, getDaySchedules]);

  const handleTimeChange = (dayIndex: number, field: 'openTime' | 'closeTime', value: string) => {
    const newSchedules = [...schedules];
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      [field]: value,
    };
    setSchedules(newSchedules);
    setHasChanges(true);
  };

  const handleClosedToggle = (dayIndex: number) => {
    const newSchedules = [...schedules];
    newSchedules[dayIndex] = {
      ...newSchedules[dayIndex],
      isClosed: !newSchedules[dayIndex].isClosed,
    };
    setSchedules(newSchedules);
    setHasChanges(true);
  };

  const handleCopyToAll = (dayIndex: number) => {
    const sourceSched = schedules[dayIndex];
    const newSchedules = schedules.map(sched => ({
      ...sched,
      openTime: sourceSched.openTime,
      closeTime: sourceSched.closeTime,
      isClosed: sourceSched.isClosed,
    }));
    setSchedules(newSchedules);
    setHasChanges(true);
  };

  const handleSave = async () => {
    const success = await saveHours(schedules);
    if (success) {
      setHasChanges(false);
    }
  };

  const validateTime = (time: string): boolean => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return regex.test(time);
  };

  const isValidSchedule = (): boolean => {
    return schedules.every(sched => {
      if (sched.isClosed) return true;
      return validateTime(sched.openTime) && validateTime(sched.closeTime);
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/dashboard/restaurants/${restaurantId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/dashboard/restaurants/${restaurantId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Horários de Funcionamento</h1>
          <p className="text-muted-foreground">
            Configure os horários de abertura e fechamento automático do seu restaurante
          </p>
        </div>
      </div>

      <Alert>
        <Clock className="h-4 w-4" />
        <AlertTitle>Funcionamento Automático</AlertTitle>
        <AlertDescription>
          O restaurante será aberto e fechado automaticamente nos horários configurados.
          Isso afeta a disponibilidade para pedidos online.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Horários por Dia da Semana</CardTitle>
          <CardDescription>
            Defina os horários de funcionamento para cada dia da semana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {schedules.map((schedule, index) => (
            <div key={schedule.dayOfWeek} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-36">
                    <Label className="text-base font-semibold">
                      {schedule.dayName}
                    </Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!schedule.isClosed}
                      onCheckedChange={() => handleClosedToggle(index)}
                      id={`closed-${schedule.dayOfWeek}`}
                    />
                    <Label
                      htmlFor={`closed-${schedule.dayOfWeek}`}
                      className="text-sm text-muted-foreground cursor-pointer"
                    >
                      {schedule.isClosed ? 'Fechado' : 'Aberto'}
                    </Label>
                  </div>

                  {!schedule.isClosed && (
                    <>
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`open-${schedule.dayOfWeek}`} className="text-sm">
                          Abre:
                        </Label>
                        <Input
                          id={`open-${schedule.dayOfWeek}`}
                          type="time"
                          value={schedule.openTime}
                          onChange={(e) => handleTimeChange(index, 'openTime', e.target.value)}
                          className="w-32"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label htmlFor={`close-${schedule.dayOfWeek}`} className="text-sm">
                          Fecha:
                        </Label>
                        <Input
                          id={`close-${schedule.dayOfWeek}`}
                          type="time"
                          value={schedule.closeTime}
                          onChange={(e) => handleTimeChange(index, 'closeTime', e.target.value)}
                          className="w-32"
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyToAll(index)}
                        type="button"
                      >
                        Copiar para todos
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {index < schedules.length - 1 && <Separator />}
            </div>
          ))}

          {!isValidSchedule() && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Horários inválidos</AlertTitle>
              <AlertDescription>
                Por favor, verifique os horários informados. O formato deve ser HH:MM.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-4 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/dashboard/restaurants/${restaurantId}`)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || !isValidSchedule() || saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Horários'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <ul className="list-disc list-inside space-y-2">
            <li>
              O restaurante será aberto e fechado automaticamente nos horários configurados
            </li>
            <li>
              Você ainda pode abrir ou fechar manualmente o restaurante a qualquer momento
            </li>
            <li>
              Para horários que passam da meia-noite (ex: 23:00 até 02:00), basta configurar o horário de fechamento após a meia-noite
            </li>
            <li>
              Marque "Fechado" para dias em que o restaurante não funciona
            </li>
            <li>
              Use "Copiar para todos" para aplicar o mesmo horário em todos os dias rapidamente
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
