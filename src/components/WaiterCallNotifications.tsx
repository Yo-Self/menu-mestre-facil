import { useState, useEffect } from 'react';
import { Bell, X, Check, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWaiterCalls, type WaiterCall } from '@/hooks/useWaiterCalls';
import { useMenuWaiterCall } from '@/hooks/useMenuWaiterCall';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface WaiterCallNotificationsProps {
  restaurantId: string;
  menuId?: string;
  onCallAttended?: (call: WaiterCall) => void;
  className?: string;
}

export function WaiterCallNotifications({ 
  restaurantId, 
  menuId,
  onCallAttended,
  className 
}: WaiterCallNotificationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previousCount, setPreviousCount] = useState(0);
  
  const { calls, loading, error, pendingCount, updateCallStatus } = useWaiterCalls({
    restaurantId,
    autoRefresh: true,
    refreshInterval: 10000,
  });

  const { waiterCallEnabled, loading: menuLoading } = useMenuWaiterCall({
    menuId,
    restaurantId,
  });

  const { toast } = useToast();

  // Efeito para tocar som quando há novas chamadas
  useEffect(() => {
    if (pendingCount > previousCount && previousCount >= 0) {
      playNotificationSound();
      toast({
        title: "Nova chamada de garçom!",
        description: `Mesa ${calls[0]?.table_number} solicitou atendimento.`,
      });
    }
    setPreviousCount(pendingCount);
  }, [pendingCount, previousCount, calls, toast]);

  const playNotificationSound = () => {
    console.log('🎵 Tocando som de notificação...');
    try {
      // Usar a função global se disponível
      if (typeof window !== 'undefined' && (window as any).createNotificationSound) {
        console.log('Usando função global createNotificationSound');
        (window as any).createNotificationSound();
      } else {
        console.log('Usando Web Audio API diretamente');
        // Fallback: criar som diretamente
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        // Resumir contexto se estiver suspenso (necessário para autoplay)
        if (audioContext.state === 'suspended') {
          audioContext.resume();
        }
        
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Som mais audível
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.3);
        
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
        
        console.log('Som tocado com sucesso');
      }
    } catch (error) {
      console.error('Erro ao tocar som de notificação:', error);
    }
  };

  const handleAttendCall = async (call: WaiterCall) => {
    try {
      await updateCallStatus(call.id, 'attended');
      toast({
        title: "Chamada atendida!",
        description: `Mesa ${call.table_number} foi atendida com sucesso.`,
      });
      onCallAttended?.(call);
    } catch (error) {
      toast({
        title: "Erro ao atender chamada",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  const handleCancelCall = async (call: WaiterCall) => {
    try {
      await updateCallStatus(call.id, 'cancelled');
      toast({
        title: "Chamada cancelada",
        description: `Chamada da mesa ${call.table_number} foi cancelada.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao cancelar chamada",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const callTime = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - callTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Agora mesmo';
    if (diffInMinutes === 1) return '1 minuto atrás';
    if (diffInMinutes < 60) return `${diffInMinutes} minutos atrás`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours === 1) return '1 hora atrás';
    return `${diffInHours} horas atrás`;
  };

  // Mostrar loading se ainda estiver carregando o status do menu
  if (menuLoading) {
    return (
      <div className={cn("relative", className)}>
        <Button variant="ghost" size="icon" disabled>
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>

      {/* Botão de notificações */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
        title={waiterCallEnabled === false ? "Chamada de garçom desabilitada neste menu" : "Chamadas de garçom"}
      >
        <Bell className="h-5 w-5" />
        {pendingCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {pendingCount > 99 ? '99+' : pendingCount}
          </Badge>
        )}
        {waiterCallEnabled === false && (
          <div className="absolute -bottom-1 -right-1 h-2 w-2 bg-muted-foreground rounded-full" />
        )}
      </Button>

      {/* Painel de notificações */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-80 z-50">
          <Card className="shadow-lg border-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Chamadas de Garçom</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {waiterCallEnabled === false && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bell className="h-4 w-4" />
                  <span>Chamada de garçom desabilitada neste menu</span>
                </div>
              )}
              {pendingCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {pendingCount} chamada{pendingCount !== 1 ? 's' : ''} pendente{pendingCount !== 1 ? 's' : ''}
                </p>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 text-center text-muted-foreground">
                  Carregando...
                </div>
              ) : error ? (
                <div className="p-4 text-center text-destructive">
                  Erro ao carregar chamadas
                </div>
              ) : calls.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  {waiterCallEnabled === false ? (
                    <div className="space-y-2">
                      <p>Nenhuma chamada pendente</p>
                      <p className="text-xs">Novas chamadas estão desabilitadas neste menu</p>
                    </div>
                  ) : (
                    <p>Nenhuma chamada pendente</p>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-80">
                  <div className="p-4 space-y-3">
                    {calls.map((call, index) => (
                      <div key={call.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                Mesa {call.table_number}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {getTimeAgo(call.created_at)}
                              </span>
                            </div>
                            
                            {call.notes && (
                              <div className="flex items-start gap-1 mb-2">
                                <MessageSquare className="h-3 w-3 mt-0.5 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                  {call.notes}
                                </p>
                              </div>
                            )}
                            
                            <p className="text-xs text-muted-foreground">
                              {formatTime(call.created_at)}
                            </p>
                          </div>
                          
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              onClick={() => handleAttendCall(call)}
                              className="h-8 px-2"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Atender
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCancelCall(call)}
                              className="h-8 px-2"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        {index < calls.length - 1 && (
                          <Separator className="mt-3" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overlay para fechar ao clicar fora */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
