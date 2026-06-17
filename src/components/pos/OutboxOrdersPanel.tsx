import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  discardOutboxOrder,
  listOutboxOrders,
  retryOutboxOrder,
} from "@/services/posOffline/orderOutbox";
import { syncPendingPOSOrders } from "@/services/posOffline/syncService";
import type { POSOutboxOrder } from "@/services/posOffline/types";
import { RefreshCw, Trash2, AlertTriangle, UploadCloud } from "lucide-react";

interface OutboxOrdersPanelProps {
  restaurantId: string;
  pendingCount: number;
  failedCount: number;
  onChanged?: () => void;
}

export function OutboxOrdersPanel({
  restaurantId,
  pendingCount,
  failedCount,
  onChanged,
}: OutboxOrdersPanelProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<POSOutboxOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const all = await listOutboxOrders(restaurantId);
      setOrders(all);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (open) {
      void loadOrders();
    }
  }, [open, loadOrders]);

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const result = await syncPendingPOSOrders(restaurantId);
      await loadOrders();
      onChanged?.();

      if (result.synced > 0) {
        toast({
          title: "Sincronização concluída",
          description: `${result.synced} pedido(s) enviado(s) com sucesso.`,
        });
      }

      if (result.stockWarnings.length > 0) {
        toast({
          title: "Atenção ao estoque",
          description: result.stockWarnings.slice(0, 3).join("; "),
          variant: "destructive",
        });
      }

      if (result.remaining > 0 && result.synced === 0) {
        toast({
          title: "Pedidos ainda pendentes",
          description: `${result.remaining} pedido(s) não puderam ser sincronizados.`,
          variant: "destructive",
        });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async (clientOrderId: string) => {
    await retryOutboxOrder(clientOrderId);
    const result = await syncPendingPOSOrders(restaurantId);
    await loadOrders();
    onChanged?.();

    if (result.synced > 0) {
      toast({ title: "Pedido sincronizado", description: "O pedido foi enviado para a nuvem." });
    } else {
      toast({
        title: "Reenvio agendado",
        description: "O pedido voltou para a fila de sincronização.",
      });
    }
  };

  const handleDiscard = async (order: POSOutboxOrder) => {
    const confirmed = window.confirm(
      `Descartar pedido da ${order.table_name} (R$ ${(
        order.items.reduce((acc, item) => acc + item.price_at_time_of_order * item.quantity, 0) / 100
      ).toFixed(2)})?\n\nEsta ação não pode ser desfeita.`
    );
    if (!confirmed) return;

    await discardOutboxOrder(order.client_order_id);
    await loadOrders();
    onChanged?.();
    toast({
      title: "Pedido descartado",
      description: "O pedido foi removido da fila local.",
      variant: "destructive",
    });
  };

  const loadedPendingCount = orders.filter(
    (order) => order.status === "pending" || order.status === "syncing"
  ).length;
  const loadedFailedCount = orders.filter((order) => order.status === "failed").length;

  if (pendingCount === 0 && failedCount === 0 && !open) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-lg font-semibold text-sm">
          <UploadCloud className="h-4 w-4 mr-2" />
          Fila local ({pendingCount + failedCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold">Pedidos na fila local</DialogTitle>
          <DialogDescription>
            Pedidos salvos neste dispositivo aguardando envio à nuvem.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 py-2">
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">
            {loadedPendingCount} pendente(s)
          </Badge>
          {loadedFailedCount > 0 && (
            <Badge variant="outline" className="text-red-600 border-red-500/30">
              {loadedFailedCount} com falha
            </Badge>
          )}
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => void handleSyncAll()}
            disabled={syncing || loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar todos
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido na fila.</p>
          ) : (
            orders.map((order) => {
              const total = order.items.reduce(
                (acc, item) => acc + item.price_at_time_of_order * item.quantity,
                0
              );
              return (
                <div
                  key={order.client_order_id}
                  className="border border-border/60 rounded-xl p-3 space-y-2 bg-muted/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm">
                        {order.table_name} — {(total / 100).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString("pt-BR")}
                        {" · "}
                        {order.items.length} item(ns)
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        order.status === "failed"
                          ? "text-red-600 border-red-500/30"
                          : "text-amber-600 border-amber-500/30"
                      }
                    >
                      {order.status === "failed" ? "Falha" : "Pendente"}
                    </Badge>
                  </div>

                  {order.last_error && (
                    <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-500/5 rounded-lg p-2">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{order.last_error}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1 h-8 text-xs"
                      onClick={() => void handleRetry(order.client_order_id)}
                      disabled={syncing}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reenviar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-destructive hover:text-destructive"
                      onClick={() => void handleDiscard(order)}
                      disabled={syncing}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Descartar
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
