import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/components/providers/RestaurantProvider";
import {
  Play,
  Square,
  ArrowDownRight,
  ArrowUpRight,
  History,
  TrendingUp,
  DollarSign,
  Calculator,
  RefreshCw,
  Clock,
  ArrowRight,
  PlusCircle,
  MinusCircle,
} from "lucide-react";
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
  getCurrentPOSSession,
  openPOSSession,
  closePOSSession,
  createPOSTransaction,
  getPOSTransactions,
  getPOSSessionsHistory,
  POSSession,
  POSTransaction,
} from "@/services/posService";

export default function POSDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRestaurantId, setCurrentRestaurantId } = useRestaurant();
  
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<POSSession | null>(null);
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [history, setHistory] = useState<POSSession[]>([]);
  const [loadingSession, setLoadingSession] = useState(false);

  // Dialog states
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [cashOpModalOpen, setCashOpModalOpen] = useState(false);
  
  // Form states
  const [initialBalance, setInitialBalance] = useState("");
  const [finalBalance, setFinalBalance] = useState("");
  const [cashOpType, setCashOpType] = useState<"in" | "out">("in");
  const [cashOpAmount, setCashOpAmount] = useState("");
  const [cashOpDescription, setCashOpDescription] = useState("");
  
  // Sales inside current session
  const [sessionRevenue, setSessionRevenue] = useState(0);
  const [sessionSalesCount, setSessionSalesCount] = useState(0);

  // Cash Calculator States for Blind Cash Closure
  const [bill100, setBill100] = useState("");
  const [bill50, setBill50] = useState("");
  const [bill20, setBill20] = useState("");
  const [bill10, setBill10] = useState("");
  const [bill5, setBill5] = useState("");
  const [bill2, setBill2] = useState("");
  const [coins, setCoins] = useState("");
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  useEffect(() => {
    if (!showCalculator) return;
    const total = 
      (parseInt(bill100) || 0) * 100 +
      (parseInt(bill50) || 0) * 50 +
      (parseInt(bill20) || 0) * 20 +
      (parseInt(bill10) || 0) * 10 +
      (parseInt(bill5) || 0) * 5 +
      (parseInt(bill2) || 0) * 2 +
      (parseFloat(coins) || 0);
    setFinalBalance(total > 0 ? total.toFixed(2) : "");
  }, [bill100, bill50, bill20, bill10, bill5, bill2, coins, showCalculator]);

  useEffect(() => {
    if (currentRestaurantId) {
      fetchSessionData();
      fetchHistoryData();
    }
  }, [currentRestaurantId]);

  const fetchRestaurants = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("user_id", user.id);

      if (error) throw error;
      setRestaurants(data || []);

      if (data && data.length > 0 && !currentRestaurantId) {
        setCurrentRestaurantId(data[0].id);
      }
    } catch (err) {
      console.error("Erro ao buscar restaurantes:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionData = async () => {
    if (!currentRestaurantId) return;
    setLoadingSession(true);
    try {
      const session = await getCurrentPOSSession(currentRestaurantId);
      setActiveSession(session);
      
      if (session) {
        // Fetch transactions for the active session
        const transList = await getPOSTransactions(session.id);
        setTransactions(transList);

        // Fetch sales for this session
        const { data: orders, error } = await supabase
          .from("orders")
          .select("total_price, status")
          .eq("pos_session_id", session.id)
          .eq("status", "finished");

        if (error) throw error;
        
        if (orders) {
          const totalRev = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
          setSessionRevenue(totalRev);
          setSessionSalesCount(orders.length);
        }
      } else {
        setTransactions([]);
        setSessionRevenue(0);
        setSessionSalesCount(0);
      }
    } catch (err) {
      console.error("Erro ao buscar dados do caixa:", err);
    } finally {
      setLoadingSession(false);
    }
  };

  const fetchHistoryData = async () => {
    if (!currentRestaurantId) return;
    try {
      const hist = await getPOSSessionsHistory(currentRestaurantId);
      setHistory(hist);
    } catch (err) {
      console.error("Erro ao buscar histórico de caixas:", err);
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRestaurantId) return;
    
    const balanceInCents = Math.round(parseFloat(initialBalance) * 100);
    if (isNaN(balanceInCents) || balanceInCents < 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor inicial válido.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      await openPOSSession(currentRestaurantId, user?.id || null, balanceInCents);
      toast({
        title: "Caixa Aberto!",
        description: `Caixa aberto com saldo inicial de R$ ${parseFloat(initialBalance).toFixed(2)}`,
      });
      setOpenModalOpen(false);
      setInitialBalance("");
      fetchSessionData();
      fetchHistoryData();
    } catch (err: any) {
      toast({
        title: "Erro ao abrir caixa",
        description: err.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    }
  };

  const handleCloseSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const balanceInCents = Math.round(parseFloat(finalBalance) * 100);
    if (isNaN(balanceInCents) || balanceInCents < 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor de fechamento válido.",
        variant: "destructive",
      });
      return;
    }

    try {
      await closePOSSession(activeSession.id, balanceInCents);
      
      const estimatedBalance = getEstimatedBalance();
      const difference = balanceInCents - estimatedBalance;

      toast({
        title: "Caixa Fechado!",
        description: `Caixa encerrado. Diferença encontrada: R$ ${(difference / 100).toFixed(2)}`,
      });
      
      setCloseModalOpen(false);
      setFinalBalance("");
      setActiveSession(null);
      fetchSessionData();
      fetchHistoryData();
    } catch (err: any) {
      toast({
        title: "Erro ao fechar caixa",
        description: err.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    }
  };

  const handleCashOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;

    const amountInCents = Math.round(parseFloat(cashOpAmount) * 100);
    if (isNaN(amountInCents) || amountInCents <= 0) {
      toast({
        title: "Valor inválido",
        description: "Digite um valor válido maior que zero.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createPOSTransaction(
        activeSession.id,
        cashOpType,
        amountInCents,
        cashOpDescription
      );

      toast({
        title: cashOpType === "in" ? "Suprimento Adicionado!" : "Sangria Efetuada!",
        description: `Registro de R$ ${parseFloat(cashOpAmount).toFixed(2)} concluído.`,
      });

      setCashOpModalOpen(false);
      setCashOpAmount("");
      setCashOpDescription("");
      fetchSessionData();
    } catch (err: any) {
      toast({
        title: "Erro ao registrar transação",
        description: err.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    }
  };

  const getEstimatedBalance = () => {
    if (!activeSession) return 0;
    
    // Initial balance + revenue + suprimentos - sangrias
    const initial = activeSession.initial_balance || 0;
    const transSum = transactions.reduce((acc, trans) => {
      if (trans.type === "in") return acc + trans.amount;
      return acc - trans.amount;
    }, 0);

    return initial + sessionRevenue + transSum;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Carregando dados do PDV...</span>
      </div>
    );
  }

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-12">
        <Calculator className="h-16 w-16 mx-auto text-muted-foreground mb-4 animate-bounce" />
        <h2 className="text-xl font-bold font-heading text-foreground">Nenhum Restaurante Ativo</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Você precisa criar e selecionar um restaurante no menu lateral antes de usar o PDV.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Seletor de Restaurante */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3.5xl font-extrabold font-heading text-primary bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">
            Controle de Caixa (PDV)
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            Abra o caixa para iniciar vendas presenciais e acompanhe a movimentação financeira em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label htmlFor="restaurant-select" className="text-sm font-semibold text-muted-foreground flex-shrink-0">
            Filial:
          </Label>
          <select
            id="restaurant-select"
            className="h-10 px-3 rounded-lg border border-border bg-white dark:bg-zinc-950 font-medium text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200"
            value={currentRestaurantId || ""}
            onChange={(e) => setCurrentRestaurantId(e.target.value)}
          >
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <Button variant="outline" size="icon" className="hover:bg-primary/10 transition-colors" onClick={fetchSessionData}>
            <RefreshCw className={`h-4 w-4 ${loadingSession ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loadingSession ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : activeSession ? (
        /* CAIXA ABERTO */
        <div className="space-y-6">
          {/* Caixa Status Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent relative overflow-hidden shadow-md">
              <div className="absolute top-0 right-0 p-4 text-green-500 opacity-10">
                <Play className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
                  Status do Caixa
                </CardDescription>
                <CardTitle className="text-2xl font-black font-heading text-green-700 dark:text-green-500">
                  Aberto para Vendas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center text-xs text-muted-foreground font-semibold gap-1.5 mt-1">
                  <Clock className="h-3.5 w-3.5" />
                  Aberto em: {new Date(activeSession.opened_at).toLocaleString("pt-BR")}
                </div>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden shadow-md border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="absolute top-0 right-0 p-4 text-primary opacity-10">
                <TrendingUp className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Vendas do Turno
                </CardDescription>
                <CardTitle className="text-3xl font-black font-heading">
                  {(sessionRevenue / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-semibold">
                  {sessionSalesCount} {sessionSalesCount === 1 ? "venda registrada" : "vendas registradas"} hoje
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden shadow-md border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
              <div className="absolute top-0 right-0 p-4 text-amber-500 opacity-10">
                <DollarSign className="h-16 w-16" />
              </div>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Saldo Estimado em Caixa
                </CardDescription>
                <CardTitle className="text-3xl font-black font-heading text-amber-600 dark:text-amber-500">
                  {(getEstimatedBalance() / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground font-semibold">
                  Fundo inicial: R$ {(activeSession.initial_balance / 100).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions & Venda Button */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary/5 shadow-inner">
            <div className="flex flex-wrap items-center gap-3">
              {/* Sangria / Suprimento trigger */}
              <Dialog open={cashOpModalOpen} onOpenChange={setCashOpModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="hover:bg-primary/10 rounded-lg font-semibold text-sm transition-all duration-200"
                    onClick={() => {
                      setCashOpType("in");
                      setCashOpAmount("");
                      setCashOpDescription("");
                    }}
                  >
                    <PlusCircle className="h-4 w-4 mr-2 text-green-600" />
                    Suprimento
                  </Button>
                </DialogTrigger>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="hover:bg-primary/10 rounded-lg font-semibold text-sm transition-all duration-200"
                    onClick={() => {
                      setCashOpType("out");
                      setCashOpAmount("");
                      setCashOpDescription("");
                    }}
                  >
                    <MinusCircle className="h-4 w-4 mr-2 text-red-600" />
                    Sangria
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleCashOperation}>
                    <DialogHeader>
                      <DialogTitle className="font-heading font-bold text-lg">
                        {cashOpType === "in" ? "Reforço de Caixa (Suprimento)" : "Retirada de Caixa (Sangria)"}
                      </DialogTitle>
                      <DialogDescription>
                        {cashOpType === "in"
                          ? "Adicione dinheiro ao fundo de troco do caixa atual."
                          : "Retire dinheiro do caixa para segurança física (sangria)."}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">
                          Valor (R$)
                        </Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          className="col-span-3 focus-visible:ring-primary"
                          value={cashOpAmount}
                          onChange={(e) => setCashOpAmount(e.target.value)}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="description" className="text-right">
                          Motivo
                        </Label>
                        <Input
                          id="description"
                          placeholder="Ex: Fundo de troco ou Pagamento"
                          className="col-span-3 focus-visible:ring-primary"
                          value={cashOpDescription}
                          onChange={(e) => setCashOpDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setCashOpModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        className={cashOpType === "in" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                      >
                        Confirmar
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Fechar Caixa trigger */}
              <Dialog open={closeModalOpen} onOpenChange={setCloseModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-red-500/30 hover:bg-red-500/10 text-red-600 rounded-lg font-semibold text-sm">
                    <Square className="h-4 w-4 mr-2" />
                    Fechar Caixa
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleCloseSession}>
                    <DialogHeader>
                      <DialogTitle className="font-heading font-bold text-lg">Fechar Turno do Caixa</DialogTitle>
                      <DialogDescription>
                        Informe o valor total em dinheiro e cartões presente fisicamente na gaveta para auditoria.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="final" className="text-right text-xs font-bold text-muted-foreground">
                          Saldo Físico (R$)
                        </Label>
                        <Input
                          id="final"
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          className="col-span-3 focus-visible:ring-primary font-bold"
                          value={finalBalance}
                          onChange={(e) => setFinalBalance(e.target.value)}
                          required
                          disabled={showCalculator}
                        />
                      </div>

                      <div className="border-t pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowCalculator(!showCalculator);
                            if (!showCalculator) {
                              setBill100("");
                              setBill50("");
                              setBill20("");
                              setBill10("");
                              setBill5("");
                              setBill2("");
                              setCoins("");
                            }
                          }}
                          className="w-full text-xs font-bold text-primary flex items-center justify-center gap-1 hover:bg-primary/5 rounded-lg"
                        >
                          {showCalculator ? "Fechar Calculadora de Cédulas 🧮" : "Usar Calculadora de Cédulas 🧮"}
                        </Button>

                        {showCalculator && (
                          <div className="grid grid-cols-2 gap-2 mt-3 p-3 bg-muted/30 border border-border/40 rounded-xl animate-fade-in-up">
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">R$ 100,00</Label>
                              <Input
                                type="number"
                                placeholder="Qtd"
                                className="h-8 text-xs focus-visible:ring-primary bg-background"
                                value={bill100}
                                onChange={(e) => setBill100(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">R$ 50,00</Label>
                              <Input
                                type="number"
                                placeholder="Qtd"
                                className="h-8 text-xs focus-visible:ring-primary bg-background"
                                value={bill50}
                                onChange={(e) => setBill50(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">R$ 20,00</Label>
                              <Input
                                type="number"
                                placeholder="Qtd"
                                className="h-8 text-xs focus-visible:ring-primary bg-background"
                                value={bill20}
                                onChange={(e) => setBill20(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">R$ 10,00</Label>
                              <Input
                                type="number"
                                placeholder="Qtd"
                                className="h-8 text-xs focus-visible:ring-primary bg-background"
                                value={bill10}
                                onChange={(e) => setBill10(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">R$ 5,00</Label>
                              <Input
                                type="number"
                                placeholder="Qtd"
                                className="h-8 text-xs focus-visible:ring-primary bg-background"
                                value={bill5}
                                onChange={(e) => setBill5(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">R$ 2,00</Label>
                              <Input
                                type="number"
                                placeholder="Qtd"
                                className="h-8 text-xs focus-visible:ring-primary bg-background"
                                value={bill2}
                                onChange={(e) => setBill2(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1 col-span-2">
                              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Total Moedas / Centavos (R$)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0,00"
                                className="h-8 text-xs focus-visible:ring-primary bg-background"
                                value={coins}
                                onChange={(e) => setCoins(e.target.value)}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setCloseModalOpen(false)}>
                        Voltar
                      </Button>
                      <Button type="submit" className="bg-red-600 hover:bg-red-700">
                        Confirmar Fechamento
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Button
              className="bg-primary hover:bg-primary-hover text-primary-foreground font-black font-heading rounded-lg shadow-lg px-6 py-5 group transition-all duration-300 hover:scale-[1.03] w-full sm:w-auto"
              onClick={() => navigate("/dashboard/pos/terminal")}
            >
              Frente de Caixa (Terminal)
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          {/* Transactions list */}
          <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold font-heading">Movimentação do Turno</CardTitle>
                <CardDescription>Entradas, saídas e sangrias avulsas registradas neste caixa.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="text-center py-10">
                  <History className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma sangria ou suprimento registrado ainda.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-y">
                      <tr>
                        <th className="px-6 py-3">Horário</th>
                        <th className="px-6 py-3">Tipo</th>
                        <th className="px-6 py-3">Valor</th>
                        <th className="px-6 py-3">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.map((trans) => (
                        <tr key={trans.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-3.5 font-medium text-muted-foreground">
                            {new Date(trans.created_at).toLocaleTimeString("pt-BR")}
                          </td>
                          <td className="px-6 py-3.5">
                            {trans.type === "in" ? (
                              <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-700 dark:text-green-400 font-bold px-2.5 py-0.5 rounded-lg text-xs">
                                <ArrowDownRight className="h-3 w-3" />
                                Suprimento
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-700 dark:text-red-400 font-bold px-2.5 py-0.5 rounded-lg text-xs">
                                <ArrowUpRight className="h-3 w-3" />
                                Sangria
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 font-bold">
                            {(trans.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </td>
                          <td className="px-6 py-3.5 text-muted-foreground max-w-[200px] truncate">
                            {trans.description || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* CAIXA FECHADO */
        <div className="max-w-md mx-auto py-10 space-y-6">
          <Card className="border-red-500/20 bg-gradient-to-br from-red-500/5 to-transparent shadow-lg text-center p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-500/10 to-transparent rounded-bl-full pointer-events-none" />
            <CardHeader className="items-center pb-2">
              <div className="p-3 rounded-full bg-red-500/10 text-red-500 mb-2">
                <Square className="h-10 w-10 fill-red-500" />
              </div>
              <CardTitle className="text-2xl font-black font-heading text-red-700 dark:text-red-500">Caixa Fechado</CardTitle>
              <CardDescription className="text-sm max-w-[300px]">
                O caixa atual está fechado. Para começar a realizar e registrar vendas, por favor abra um turno.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <Dialog open={openModalOpen} onOpenChange={setOpenModalOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary-hover font-bold font-heading rounded-lg px-6 py-5 shadow-lg group">
                    <Play className="h-4 w-4 mr-2" />
                    Abrir Caixa Agora
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <form onSubmit={handleOpenSession}>
                    <DialogHeader>
                      <DialogTitle className="font-heading font-bold text-lg">Abrir Novo Caixa</DialogTitle>
                      <DialogDescription>
                        Informe o saldo inicial (fundo de troco) disponível fisicamente no caixa.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="initial" className="text-right">
                          Fundo Inicial (R$)
                        </Label>
                        <Input
                          id="initial"
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          className="col-span-3 focus-visible:ring-primary"
                          value={initialBalance}
                          onChange={(e) => setInitialBalance(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="ghost" onClick={() => setOpenModalOpen(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-primary hover:bg-primary-hover">
                        Abrir Caixa
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Caixa Historico Sessions */}
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold font-heading">Histórico de Caixas Passados</CardTitle>
          <CardDescription>Consulte os turnos anteriores abertos nesta filial.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="text-center py-10">
              <History className="h-10 w-10 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum caixa encerrado anteriormente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px] tracking-wider font-bold border-y">
                  <tr>
                    <th className="px-6 py-3">Abertura</th>
                    <th className="px-6 py-3">Fechamento</th>
                    <th className="px-6 py-3">Fundo Inicial</th>
                    <th className="px-6 py-3">Saldo Fechamento</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((sess) => (
                    <tr key={sess.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-3.5 text-muted-foreground font-medium">
                        {new Date(sess.opened_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground font-medium">
                        {sess.closed_at ? new Date(sess.closed_at).toLocaleString("pt-BR") : "—"}
                      </td>
                      <td className="px-6 py-3.5 font-bold">
                        {(sess.initial_balance / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td className="px-6 py-3.5 font-bold text-amber-600 dark:text-amber-500">
                        {sess.final_balance
                          ? (sess.final_balance / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : "—"}
                      </td>
                      <td className="px-6 py-3.5">
                        {sess.status === "open" ? (
                          <span className="inline-flex bg-green-500/10 text-green-700 dark:text-green-400 font-bold px-2.5 py-0.5 rounded-lg text-xs">
                            Aberto
                          </span>
                        ) : (
                          <span className="inline-flex bg-gray-500/10 text-gray-700 dark:text-gray-400 font-bold px-2.5 py-0.5 rounded-lg text-xs">
                            Encerrado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
