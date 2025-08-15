import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useWaiterCalls } from '@/hooks/useWaiterCalls';
import { useToast } from '@/hooks/use-toast';
import { Volume2 } from 'lucide-react';

export default function WaiterCallTestPage() {
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const { toast } = useToast();
  
  // Usar um ID de restaurante real para teste
  const testRestaurantId = 'e1e057fc-ea38-42f7-b7b2-226580130355';
  
  const { createCall, calls, loading } = useWaiterCalls({
    restaurantId: testRestaurantId,
    autoRefresh: true,
    refreshInterval: 5000,
  });

  const handleCreateCall = async () => {
    if (!tableNumber.trim()) {
      toast({
        title: "Erro",
        description: "Por favor, informe o número da mesa.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createCall(parseInt(tableNumber), notes.trim() || undefined);
      toast({
        title: "Chamada criada!",
        description: `Chamada da mesa ${tableNumber} foi criada com sucesso.`,
      });
      setTableNumber('');
      setNotes('');
    } catch (error) {
      toast({
        title: "Erro ao criar chamada",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    }
  };

  const testNotificationSound = () => {
    try {
      if (typeof window !== 'undefined' && (window as any).createNotificationSound) {
        (window as any).createNotificationSound();
        toast({
          title: "Som de teste",
          description: "Som de notificação tocado!",
        });
      } else {
        toast({
          title: "Erro",
          description: "Função de som não encontrada.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao tocar som",
        description: "Verifique o console para mais detalhes.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Teste de Chamadas de Garçom</h1>
        <p className="text-muted-foreground">
          Página para testar a funcionalidade de chamadas de garçom
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário para criar chamada */}
        <Card>
          <CardHeader>
            <CardTitle>Criar Nova Chamada</CardTitle>
            <CardDescription>
              Simule uma chamada de garçom de uma mesa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="tableNumber">Número da Mesa</Label>
              <Input
                id="tableNumber"
                type="number"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="Ex: 5"
                min="1"
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Preciso de mais água, conta por favor"
                rows={3}
              />
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleCreateCall} 
                disabled={loading || !tableNumber.trim()}
                className="flex-1"
              >
                {loading ? 'Criando...' : 'Criar Chamada'}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={testNotificationSound}
                title="Testar som de notificação"
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de chamadas ativas */}
        <Card>
          <CardHeader>
            <CardTitle>Chamadas Ativas</CardTitle>
            <CardDescription>
              Chamadas pendentes do restaurante de teste
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
              </div>
            ) : calls.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>Nenhuma chamada pendente</p>
                <p className="text-sm">Crie uma chamada usando o formulário ao lado</p>
              </div>
            ) : (
              <div className="space-y-3">
                {calls.map((call) => (
                  <div key={call.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">Mesa {call.table_number}</h4>
                        {call.notes && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {call.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(call.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Pendente
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como testar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm">
            1. <strong>Crie uma chamada:</strong> Use o formulário ao lado para simular uma chamada de garçom
          </p>
          <p className="text-sm">
            2. <strong>Verifique as notificações:</strong> A chamada aparecerá no ícone de sino no header
          </p>
          <p className="text-sm">
            3. <strong>Teste o som:</strong> Novas chamadas devem tocar um alerta sonoro
          </p>
          <p className="text-sm">
            4. <strong>Atenda a chamada:</strong> Clique no ícone de sino e use os botões "Atender" ou "Cancelar"
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
