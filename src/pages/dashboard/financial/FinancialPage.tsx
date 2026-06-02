import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Check, 
  Calendar, 
  Users, 
  Briefcase, 
  AlertTriangle, 
  TrendingUp as ProfitIcon,
  Percent,
  Calculator,
  UserPlus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { PeriodSelector } from "@/components/reports/PeriodSelector";
import { getPresetRange, type ReportPreset } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  Legend 
} from "recharts";

interface Restaurant {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  restaurant_id: string;
  description: string;
  amount: number;
  category: string;
  due_date: string;
  status: string;
  is_recurring: boolean;
  recurrence_period: string | null;
  parent_id: string | null;
  employee_id: string | null;
  created_at: string;
}

interface Employee {
  id: string;
  restaurant_id: string;
  name: string;
  role: string | null;
  salary: number;
  hire_date: string;
  status: string;
}

interface OrderItemInfo {
  quantity: number;
  price_at_time_of_order: number;
  dish_id: string | null;
  dishes: {
    id: string;
    name: string;
    cost_price: number | null;
    price: number;
  } | null;
}

interface OrderInfo {
  id: string;
  created_at: string;
  total_price: number;
  status: string;
  order_items: OrderItemInfo[];
}

const EXPENSE_CATEGORIES = [
  "Ingredientes",
  "Aluguel",
  "Pessoal",
  "Serviços",
  "Marketing",
  "Impostos",
  "Outros"
];

export default function FinancialPage() {
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | "all">("all");
  const [loading, setLoading] = useState(true);

  // Period management
  const [preset, setPreset] = useState<ReportPreset>("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Data states
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [orders, setOrders] = useState<OrderInfo[]>([]);

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false);
  const [isDeleteRecModalOpen, setIsDeleteRecModalOpen] = useState(false);

  // Form states - Expense
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("Ingredientes");
  const [expenseDueDate, setExpenseDueDate] = useState("");
  const [expenseStatus, setExpenseStatus] = useState("pending");
  const [expenseIsRec, setExpenseIsRec] = useState(false);
  const [expenseRecPeriod, setExpenseRecPeriod] = useState("monthly");
  const [expenseInstallments, setExpenseInstallments] = useState("6");
  const [savingExpense, setSavingExpense] = useState(false);

  // Form states - Employee
  const [empName, setEmpName] = useState("");
  const [empRole, setEmpRole] = useState("");
  const [empSalary, setEmpSalary] = useState("");
  const [empHireDate, setEmpHireDate] = useState("");
  const [savingEmployee, setSavingEmployee] = useState(false);

  // Form states - Payroll payment
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [payrollMonth, setPayrollMonth] = useState("");
  const [payrollAmount, setPayrollAmount] = useState("");
  const [payrollStatus, setPayrollStatus] = useState("paid");
  const [savingPayroll, setSavingPayroll] = useState(false);

  // Recurrent Delete State
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);

  // Computed Date Range
  const { startDate, endDate } = useMemo(() => {
    if (preset === "custom" && customStart && customEnd) {
      const s = new Date(customStart);
      s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);
      e.setHours(23, 59, 59, 999);
      return { startDate: s, endDate: e };
    }
    const range = getPresetRange(preset);
    return { startDate: range.start, endDate: range.end };
  }, [preset, customStart, customEnd]);

  // Restaurant IDs to query
  const targetRestaurantIds = useMemo(() => {
    if (selectedRestaurantId === "all") return restaurants.map(r => r.id);
    return [selectedRestaurantId];
  }, [selectedRestaurantId, restaurants]);

  // Load basic data: Restaurants
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name")
          .eq("user_id", user.id)
          .order("name");

        if (error) throw error;
        setRestaurants(data || []);
        if (data && data.length > 0) {
          setSelectedRestaurantId(data[0].id);
        }
      } catch (error: any) {
        console.error("Erro ao carregar restaurantes:", error);
      }
    };
    fetchRestaurants();
  }, []);

  // Extract primitive dependency values for fetchData hook
  const targetRestaurantIdsStr = targetRestaurantIds.join(",");
  const startDateStr = startDate.toISOString();
  const endDateStr = endDate.toISOString();

  // Main fetch function for selected filters
  const fetchData = useCallback(async () => {
    const ids = targetRestaurantIdsStr.split(",").filter(Boolean);
    if (ids.length === 0) return;
    setLoading(true);

    try {
      // 1. Fetch General & Recurring Expenses
      const { data: expensesData, error: expError } = await supabase
        .from("expenses")
        .select("*")
        .in("restaurant_id", ids)
        .gte("due_date", startDateStr.split("T")[0])
        .lte("due_date", endDateStr.split("T")[0])
        .order("due_date", { ascending: true });

      if (expError) throw expError;
      setExpenses(expensesData || []);

      // 2. Fetch Employees
      const { data: employeesData, error: empError } = await supabase
        .from("employees")
        .select("*")
        .in("restaurant_id", ids)
        .eq("status", "active")
        .order("name");

      if (empError) throw empError;
      setEmployees(employeesData || []);

      // 3. Fetch Dishes (to get cost prices)
      const { data: dishesData, error: dishError } = await supabase
        .from("dishes")
        .select("id, name, price, cost_price, category_id")
        .in("restaurant_id", ids);

      if (dishError) throw dishError;
      setDishes(dishesData || []);

      // 4. Fetch Orders (Vendas)
      const { data: ordersData, error: ordError } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_price,
          status,
          order_items (
            quantity,
            price_at_time_of_order,
            dish_id,
            dishes (
              id,
              name,
              cost_price,
              price
            )
          )
        `)
        .in("restaurant_id", ids)
        .gte("created_at", startDateStr)
        .lte("created_at", endDateStr)
        .order("created_at", { ascending: true });

      if (ordError) throw ordError;
      
      // Adapt structure
      const formattedOrders: OrderInfo[] = (ordersData || []).map((o: any) => ({
        id: o.id,
        created_at: o.created_at,
        total_price: o.total_price,
        status: o.status,
        order_items: (o.order_items || []).map((item: any) => ({
          quantity: item.quantity,
          price_at_time_of_order: item.price_at_time_of_order,
          dish_id: item.dish_id,
          dishes: item.dishes ? {
            id: item.dishes.id,
            name: item.dishes.name,
            cost_price: item.dishes.cost_price,
            price: item.dishes.price
          } : null
        }))
      }));

      setOrders(formattedOrders);

    } catch (error: any) {
      toast({
        title: "Erro ao atualizar dados",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [targetRestaurantIdsStr, startDateStr, endDateStr, toast]);

  // Refresh when params change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPI Calculations
  const metrics = useMemo(() => {
    // 1. Entradas: Completed/finished orders (total price in cents -> reals)
    // Note: total_price is in cents, so we divide by 100.
    const completedOrders = orders.filter(o => o.status === "finished");
    const totalInflows = completedOrders.reduce((sum, o) => sum + (o.total_price / 100), 0);

    // 2. Saídas: Expenses registered in the period
    const totalOutflows = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const paidOutflows = expenses.filter(e => e.status === "paid").reduce((sum, e) => sum + Number(e.amount), 0);
    const pendingOutflows = expenses.filter(e => e.status === "pending").reduce((sum, e) => sum + Number(e.amount), 0);

    // 3. Saldo Líquido
    const netBalance = totalInflows - totalOutflows;
    const profitMargin = totalInflows > 0 ? (netBalance / totalInflows) * 100 : 0;

    // 4. Product Profit & Cost Estimation based on sales
    let totalSalesCost = 0;
    let productsWithCostCount = 0;
    let totalProductsSold = 0;

    completedOrders.forEach(o => {
      o.order_items.forEach(item => {
        totalProductsSold += item.quantity;
        if (item.dishes) {
          const cost = item.dishes.cost_price || 0;
          totalSalesCost += cost * item.quantity;
          if (item.dishes.cost_price !== null) {
            productsWithCostCount += 1;
          }
        }
      });
    });

    const estimatedProductProfit = totalInflows - totalSalesCost;

    return {
      totalInflows,
      totalOutflows,
      paidOutflows,
      pendingOutflows,
      netBalance,
      profitMargin,
      totalSalesCost,
      estimatedProductProfit,
      totalProductsSold
    };
  }, [orders, expenses]);

  // Chart Data compilation (Group Inflows vs Outflows by Day)
  const chartData = useMemo(() => {
    const dailyMap = new Map<string, { date: string; entradas: number; saidas: number }>();

    // Init dates between startDate and endDate
    const tempDate = new Date(startDate);
    while (tempDate <= endDate) {
      const dateStr = tempDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      dailyMap.set(dateStr, { date: dateStr, entradas: 0, saidas: 0 });
      tempDate.setDate(tempDate.getDate() + 1);
    }

    // Accumulate finished orders revenue (Inflows)
    orders
      .filter(o => o.status === "finished")
      .forEach(o => {
        const dateStr = new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        const existing = dailyMap.get(dateStr) || { date: dateStr, entradas: 0, saidas: 0 };
        existing.entradas += (o.total_price / 100);
        dailyMap.set(dateStr, existing);
      });

    // Accumulate expenses (Outflows)
    expenses.forEach(e => {
      // due_date is in "YYYY-MM-DD" local format, convert carefully
      const parts = e.due_date.split("-");
      const localDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      const dateStr = localDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      
      const existing = dailyMap.get(dateStr);
      if (existing) {
        existing.saidas += Number(e.amount);
        dailyMap.set(dateStr, existing);
      }
    });

    return Array.from(dailyMap.values());
  }, [orders, expenses, startDate, endDate]);

  // Product profitability summary table computation
  const productProfitability = useMemo(() => {
    const summaryMap = new Map<string, {
      id: string;
      name: string;
      category: string;
      price: number;
      cost_price: number | null;
      quantitySold: number;
      revenue: number;
      productionCost: number;
      profit: number;
    }>();

    // Loop through completed orders items
    orders
      .filter(o => o.status === "finished")
      .forEach(order => {
        order.order_items.forEach(item => {
          if (!item.dish_id) return;
          const dishId = item.dish_id;
          const existing = summaryMap.get(dishId) || {
            id: dishId,
            name: item.dishes?.name || "Produto Removido",
            category: "Geral",
            price: (item.price_at_time_of_order / 100),
            cost_price: item.dishes?.cost_price ?? null,
            quantitySold: 0,
            revenue: 0,
            productionCost: 0,
            profit: 0
          };

          const unitCost = item.dishes?.cost_price || 0;
          existing.quantitySold += item.quantity;
          existing.revenue += (item.price_at_time_of_order / 100) * item.quantity;
          existing.productionCost += unitCost * item.quantity;
          existing.profit = existing.revenue - existing.productionCost;

          summaryMap.set(dishId, existing);
        });
      });

    return Array.from(summaryMap.values()).sort((a, b) => b.quantitySold - a.quantitySold);
  }, [orders]);

  // Category breakdown for expenses
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    EXPENSE_CATEGORIES.forEach(c => map.set(c, 0));
    
    expenses.forEach(e => {
      const existing = map.get(e.category) || 0;
      map.set(e.category, existing + Number(e.amount));
    });

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Form handler: General Expense Submission
  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDesc || !expenseAmount || !expenseDueDate) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    if (selectedRestaurantId === "all") {
      toast({ title: "Selecione um restaurante específico para cadastrar despesas", variant: "destructive" });
      return;
    }

    setSavingExpense(true);

    try {
      const amountFloat = parseFloat(expenseAmount);
      const isRecurring = expenseIsRec;
      const installmentsCount = parseInt(expenseInstallments) || 1;

      if (isRecurring && installmentsCount > 1) {
        // Recurring: create batch records
        const firstExpenseData = {
          restaurant_id: selectedRestaurantId,
          description: `${expenseDesc} (1/${installmentsCount})`,
          amount: amountFloat,
          category: expenseCategory,
          due_date: expenseDueDate,
          status: expenseStatus,
          is_recurring: true,
          recurrence_period: expenseRecPeriod,
        };

        // Insert first record
        const { data: firstExp, error: firstError } = await supabase
          .from("expenses")
          .insert(firstExpenseData)
          .select()
          .single();

        if (firstError) throw firstError;

        // Generate installments
        const recurringList = [];
        const baseDate = new Date(expenseDueDate);

        for (let i = 2; i <= installmentsCount; i++) {
          const nextDate = new Date(baseDate);
          if (expenseRecPeriod === "weekly") {
            nextDate.setDate(baseDate.getDate() + (i - 1) * 7);
          } else {
            nextDate.setMonth(baseDate.getMonth() + (i - 1));
          }

          recurringList.push({
            restaurant_id: selectedRestaurantId,
            description: `${expenseDesc} (${i}/${installmentsCount})`,
            amount: amountFloat,
            category: expenseCategory,
            due_date: nextDate.toISOString().split("T")[0],
            status: "pending",
            is_recurring: true,
            recurrence_period: expenseRecPeriod,
            parent_id: firstExp.id
          });
        }

        if (recurringList.length > 0) {
          const { error: batchError } = await supabase
            .from("expenses")
            .insert(recurringList);

          if (batchError) throw batchError;
        }

        toast({ title: "Despesas recorrentes lançadas com sucesso!" });

      } else {
        // Single Expense
        const { error } = await supabase
          .from("expenses")
          .insert({
            restaurant_id: selectedRestaurantId,
            description: expenseDesc,
            amount: amountFloat,
            category: expenseCategory,
            due_date: expenseDueDate,
            status: expenseStatus,
            is_recurring: false
          });

        if (error) throw error;
        toast({ title: "Despesa cadastrada com sucesso!" });
      }

      // Reset & Reload
      setExpenseDesc("");
      setExpenseAmount("");
      setExpenseIsRec(false);
      setIsExpenseModalOpen(false);
      fetchData();

    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar despesa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSavingExpense(false);
    }
  };

  // Toggle paid status on expense
  const toggleExpenseStatus = async (expense: Expense) => {
    const newStatus = expense.status === "paid" ? "pending" : "paid";
    try {
      const { error } = await supabase
        .from("expenses")
        .update({ status: newStatus })
        .eq("id", expense.id);

      if (error) throw error;
      
      toast({
        title: `Despesa marcada como ${newStatus === "paid" ? "paga" : "pendente"}`
      });

      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Handle Expense Deletion (Checks if recurring)
  const handleDeleteClick = (expense: Expense) => {
    if (expense.is_recurring) {
      setExpenseToDelete(expense);
      setIsDeleteRecModalOpen(true);
    } else {
      executeDelete(expense.id, false);
    }
  };

  const executeDelete = async (id: string, deleteAllRecurrent: boolean) => {
    setDeletingExpense(true);
    try {
      if (deleteAllRecurrent && expenseToDelete) {
        // Delete parent and all siblings/children
        const parentId = expenseToDelete.parent_id || expenseToDelete.id;
        const { error } = await supabase
          .from("expenses")
          .delete()
          .or(`id.eq.${parentId},parent_id.eq.${parentId}`);

        if (error) throw error;
        toast({ title: "Todas as parcelas recorrentes foram excluídas!" });
      } else {
        // Delete only this installment
        const { error } = await supabase
          .from("expenses")
          .delete()
          .eq("id", id);

        if (error) throw error;
        toast({ title: "Despesa excluída com sucesso!" });
      }

      setIsDeleteRecModalOpen(false);
      setExpenseToDelete(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir despesa",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDeletingExpense(false);
    }
  };

  // Form handler: Add Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName || !empSalary || !empHireDate) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    if (selectedRestaurantId === "all") {
      toast({ title: "Selecione um restaurante específico para cadastrar funcionário", variant: "destructive" });
      return;
    }

    setSavingEmployee(true);
    try {
      const { error } = await supabase
        .from("employees")
        .insert({
          restaurant_id: selectedRestaurantId,
          name: empName,
          role: empRole || null,
          salary: parseFloat(empSalary),
          hire_date: empHireDate,
          status: "active"
        });

      if (error) throw error;

      toast({ title: "Funcionário cadastrado com sucesso!" });
      setEmpName("");
      setEmpRole("");
      setEmpSalary("");
      setEmpHireDate("");
      setIsEmployeeModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao cadastrar funcionário",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSavingEmployee(false);
    }
  };

  // Open payroll payout modal
  const handleLancarFolhaClick = (employee: Employee) => {
    setSelectedEmp(employee);
    // Set default month text (e.g. Reference is current Month/Year)
    const currentMonth = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    setPayrollMonth(currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1));
    setPayrollAmount(String(employee.salary));
    setPayrollStatus("paid");
    setIsPayrollModalOpen(true);
  };

  // Form handler: Submit payroll payment as expense
  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp || !payrollAmount) return;

    setSavingPayroll(true);
    try {
      const amountFloat = parseFloat(payrollAmount);
      const todayStr = new Date().toISOString().split("T")[0];

      // Insert salary payout into expenses table
      const { error } = await supabase
        .from("expenses")
        .insert({
          restaurant_id: selectedEmp.restaurant_id,
          description: `Salário - ${selectedEmp.name} - Ref. ${payrollMonth}`,
          amount: amountFloat,
          category: "Pessoal",
          due_date: todayStr,
          status: payrollStatus,
          is_recurring: false,
          employee_id: selectedEmp.id
        });

      if (error) throw error;

      toast({
        title: "Pagamento de folha lançado com sucesso!",
        description: `Lançado R$ ${amountFloat.toFixed(2)} para ${selectedEmp.name}`
      });

      setIsPayrollModalOpen(false);
      setSelectedEmp(null);
      fetchData();
    } catch (error: any) {
      toast({
        title: "Erro ao lançar pagamento",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSavingPayroll(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3.5xl font-extrabold font-heading bg-gradient-to-r from-primary to-amber-600 bg-clip-text text-transparent">
            Painel Financeiro
          </h1>
          <p className="text-muted-foreground font-medium text-sm">
            Balanço completo, controle de despesas gerais/recorrentes, folha de pagamento e lucratividade de pratos.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-center mt-2 md:mt-0">
          <Button 
            onClick={() => setIsExpenseModalOpen(true)}
            className="rounded-xl font-heading font-semibold hover:shadow-md hover:shadow-primary/10 transition-all duration-300"
            disabled={selectedRestaurantId === "all"}
          >
            <Plus className="w-4 h-4 mr-1.5" /> Adicionar Despesa
          </Button>
        </div>
      </div>

      {/* ── Top Selectors ── */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
        {/* Restaurant selector */}
        <div className="flex items-center gap-2">
          <Label className="text-sm font-bold font-heading text-muted-foreground">Loja:</Label>
          <Select 
            value={selectedRestaurantId} 
            onValueChange={(val: any) => setSelectedRestaurantId(val)}
          >
            <SelectTrigger className="w-[200px] rounded-xl bg-card border-border/50 text-sm font-semibold">
              <SelectValue placeholder="Selecione o restaurante" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/50">
              <SelectItem value="all">Consolidado (Geral)</SelectItem>
              {restaurants.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period Selector Card */}
        <div className="flex-1 rounded-2xl border border-border/40 bg-card/70 backdrop-blur-sm p-4 shadow-sm">
          <PeriodSelector
            preset={preset}
            customStart={customStart}
            customEnd={customEnd}
            onPresetChange={setPreset}
            onCustomChange={(start, end) => {
              setCustomStart(start);
              setCustomEnd(end);
            }}
          />
        </div>
      </div>

      {/* ── KPIs Dashboard ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Inflows */}
        <Card className="glass-card overflow-hidden relative group hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-green-500/5 to-transparent rounded-bl-full pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Entradas (Vendas)
              </CardDescription>
              <div className="p-2 rounded-xl bg-green-500/10 text-green-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-heading text-foreground">
              {metrics.totalInflows.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">
              Receita de pedidos finalizados
            </p>
          </CardContent>
        </Card>

        {/* Total Outflows */}
        <Card className="glass-card overflow-hidden relative group hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-red-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saídas (Custos)
              </CardDescription>
              <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-heading text-foreground">
              {metrics.totalOutflows.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] font-bold text-muted-foreground/80">
              <span className="text-green-600 dark:text-green-400">Pagas: R$ {metrics.paidOutflows.toFixed(0)}</span>
              <span>•</span>
              <span className="text-amber-500">Pend: R$ {metrics.pendingOutflows.toFixed(0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Net Balance / Profitability */}
        <Card className="glass-card overflow-hidden relative group hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Balanço Geral
              </CardDescription>
              <div className={`p-2 rounded-xl ${metrics.netBalance >= 0 ? "bg-primary/10 text-primary" : "bg-red-500/10 text-red-500"}`}>
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-black font-heading ${metrics.netBalance >= 0 ? "text-primary" : "text-red-500"}`}>
              {metrics.netBalance.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">
              Margem Líquida Geral: <span className="text-primary font-bold">{metrics.profitMargin.toFixed(1)}%</span>
            </p>
          </CardContent>
        </Card>

        {/* Estimated Profit Margin per Products */}
        <Card className="glass-card overflow-hidden relative group hover:shadow-xl hover:shadow-primary/5 hover:border-primary/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/5 to-transparent pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lucro Operacional (Itens)
              </CardDescription>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Percent className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black font-heading text-foreground">
              {metrics.estimatedProductProfit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-semibold">
              Total de itens vendidos: <span className="font-bold text-foreground">{metrics.totalProductsSold}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tab Panels ── */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl w-full sm:w-auto flex flex-wrap gap-1">
          <TabsTrigger value="overview" className="rounded-lg text-xs font-bold font-heading">Visão Geral</TabsTrigger>
          <TabsTrigger value="expenses" className="rounded-lg text-xs font-bold font-heading">Despesas ({expenses.length})</TabsTrigger>
          <TabsTrigger value="employees" className="rounded-lg text-xs font-bold font-heading">Funcionários & Folha</TabsTrigger>
          <TabsTrigger value="products" className="rounded-lg text-xs font-bold font-heading">Lucro por Produto</TabsTrigger>
        </TabsList>

        {/* ── TABS CONTENT: OVERVIEW ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cash Flow Graph */}
            <Card className="lg:col-span-2 glass-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-heading">Fluxo de Caixa</CardTitle>
                <CardDescription>Entradas vs Saídas diárias no período selecionado</CardDescription>
              </CardHeader>
              <CardContent className="h-[320px] w-full pr-4">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#888888" opacity={0.1} />
                    <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} />
                    <RechartsTooltip formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, ""]} labelClassName="font-bold rounded-lg" contentStyle={{ backgroundColor: "rgba(255,255,255,0.9)", border: "1px solid #e2e8f0", borderRadius: "12px", color: "#1e293b" }} />
                    <Legend />
                    <Area type="monotone" name="Entradas (Vendas)" dataKey="entradas" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorEntradas)" />
                    <Area type="monotone" name="Saídas (Despesas)" dataKey="saidas" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSaidas)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Expenses categories breakdown card */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-heading">Distribuição de Custos</CardTitle>
                <CardDescription>Distribuição de gastos por categoria no período</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {expensesByCategory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <DollarSign className="w-10 h-10 opacity-30 mb-2" />
                    <p className="text-xs font-semibold">Sem saídas neste período</p>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {expensesByCategory.map(cat => {
                      const percentage = metrics.totalOutflows > 0 ? (cat.value / metrics.totalOutflows) * 100 : 0;
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-semibold">{cat.name}</span>
                            <span className="text-muted-foreground font-bold">
                              R$ {cat.value.toFixed(2)} ({percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TABS CONTENT: GENERAL EXPENSES ── */}
        <TabsContent value="expenses" className="space-y-6">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg font-bold font-heading">Lista de Despesas</CardTitle>
                <CardDescription>Controle e status de vencimentos</CardDescription>
              </div>
              <Button 
                onClick={() => setIsExpenseModalOpen(true)}
                disabled={selectedRestaurantId === "all"}
                size="sm"
                className="rounded-xl text-xs font-bold"
              >
                <Plus className="w-4 h-4 mr-1" /> Nova Despesa
              </Button>
            </CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto opacity-35 mb-2" />
                  <p className="text-sm font-semibold">Nenhuma despesa cadastrada para este período.</p>
                  <p className="text-xs opacity-80 mt-0.5">Selecione um restaurante específico para adicionar custos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Descrição</th>
                        <th className="py-3 px-4">Categoria</th>
                        <th className="py-3 px-4">Vencimento</th>
                        <th className="py-3 px-4">Recorrência</th>
                        <th className="py-3 px-4">Valor</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((expense) => (
                        <tr 
                          key={expense.id} 
                          className="border-b border-border/30 hover:bg-muted/20 transition-all duration-150"
                        >
                          <td className="py-3.5 px-4 font-semibold text-foreground">
                            {expense.description}
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge variant="outline" className="rounded-lg font-semibold bg-background border-border/50 text-xs px-2 py-0.5">
                              {expense.category}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-muted-foreground/80">
                            {new Date(expense.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="py-3.5 px-4">
                            {expense.is_recurring ? (
                              <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 font-bold rounded-lg text-[10px] px-2 py-0.5">
                                Recorrente ({expense.recurrence_period === "monthly" ? "Mensal" : "Semanal"})
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground/75 font-medium">Única</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-foreground">
                            R$ {Number(expense.amount).toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => toggleExpenseStatus(expense)}
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                expense.status === "paid"
                                  ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/15"
                                  : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15"
                              }`}
                            >
                              <Check className={`w-3.5 h-3.5 ${expense.status === "paid" ? "opacity-100" : "opacity-40"}`} />
                              {expense.status === "paid" ? "Paga" : "Pendente"}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteClick(expense)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-8 w-8 rounded-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TABS CONTENT: EMPLOYEES & PAYROLL ── */}
        <TabsContent value="employees" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Active Employees List */}
            <Card className="lg:col-span-2 glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-lg font-bold font-heading">Equipe de Funcionários</CardTitle>
                  <CardDescription>Gerencie o pessoal ativo e a folha salarial</CardDescription>
                </div>
                <Button 
                  onClick={() => setIsEmployeeModalOpen(true)}
                  disabled={selectedRestaurantId === "all"}
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs font-bold border-border/60 hover:bg-accent/10"
                >
                  <UserPlus className="w-4 h-4 mr-1" /> Novo Funcionário
                </Button>
              </CardHeader>
              <CardContent>
                {employees.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto opacity-35 mb-2" />
                    <p className="text-sm font-semibold">Nenhum funcionário cadastrado.</p>
                    <p className="text-xs opacity-80 mt-0.5">Selecione um restaurante para cadastrar sua equipe.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border/60 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                          <th className="py-3 px-4">Nome</th>
                          <th className="py-3 px-4">Função/Cargo</th>
                          <th className="py-3 px-4">Admissão</th>
                          <th className="py-3 px-4">Salário Base</th>
                          <th className="py-3 px-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((emp) => (
                          <tr 
                            key={emp.id} 
                            className="border-b border-border/30 hover:bg-muted/20 transition-all duration-150"
                          >
                            <td className="py-3.5 px-4 font-semibold text-foreground">{emp.name}</td>
                            <td className="py-3.5 px-4 font-medium text-muted-foreground">{emp.role || "Não especificado"}</td>
                            <td className="py-3.5 px-4 text-muted-foreground/80">
                              {new Date(emp.hire_date + "T00:00:00").toLocaleDateString("pt-BR")}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-foreground">
                              R$ {Number(emp.salary).toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <Button 
                                size="sm"
                                variant="outline"
                                className="rounded-lg text-xs font-bold border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
                                onClick={() => handleLancarFolhaClick(emp)}
                              >
                                Lançar Pagamento
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: Payroll Cost summary card */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-heading">Folha Salarial Estimada</CardTitle>
                <CardDescription>Custos fixos estimados com a equipe ativa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl border border-border/50 bg-muted/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 text-muted-foreground opacity-10">
                    <Briefcase className="h-12 w-12" />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Custo Fixo Mensal</p>
                  <p className="text-3xl font-black font-heading text-foreground mt-1">
                    {employees.reduce((sum, emp) => sum + Number(emp.salary), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ações Recomendadas</h4>
                  <Alert className="rounded-xl bg-primary/5 border-primary/10">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    <AlertTitle className="text-xs font-bold text-primary font-heading">Folha Mensal</AlertTitle>
                    <AlertDescription className="text-[11px] text-muted-foreground mt-0.5">
                      Utilize o botão "Lançar Pagamento" ao lado de cada funcionário ao pagar ou provisionar seu salário mensal para integrá-lo ao balanço.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── TABS CONTENT: PRODUCT PROFITABILITY ── */}
        <TabsContent value="products" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg font-bold font-heading">Desempenho de Lucratividade por Produto</CardTitle>
              <CardDescription>Cálculo de margem e lucro líquido por item vendido no período</CardDescription>
            </CardHeader>
            <CardContent>
              {productProfitability.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Calculator className="w-12 h-12 mx-auto opacity-35 mb-2" />
                  <p className="text-sm font-semibold">Sem dados de vendas para calcular lucro neste período.</p>
                  <p className="text-xs opacity-80 mt-0.5">Conclua pedidos no PDV ou Delivery para visualizar a lucratividade.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border/60 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Item/Prato</th>
                        <th className="py-3 px-4">Preço Venda</th>
                        <th className="py-3 px-4">Custo Produção</th>
                        <th className="py-3 px-4">Lucro Unitário</th>
                        <th className="py-3 px-4">Margem</th>
                        <th className="py-3 px-4">Qtd. Vendida</th>
                        <th className="py-3 px-4">Receita Total</th>
                        <th className="py-3 px-4">Custo Total</th>
                        <th className="py-3 px-4 text-right">Lucro Total Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productProfitability.map((item) => {
                        const hasCost = item.cost_price !== null;
                        const unitProfit = item.price - (item.cost_price || 0);
                        const marginPercent = item.price > 0 ? (unitProfit / item.price) * 100 : 0;
                        
                        return (
                          <tr 
                            key={item.id} 
                            className="border-b border-border/30 hover:bg-muted/20 transition-all duration-150"
                          >
                            <td className="py-3.5 px-4 font-semibold text-foreground">{item.name}</td>
                            <td className="py-3.5 px-4 font-medium">R$ {item.price.toFixed(2)}</td>
                            <td className="py-3.5 px-4">
                              {hasCost ? (
                                <span className="font-medium text-muted-foreground">R$ {item.cost_price?.toFixed(2)}</span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1 w-max">
                                  <AlertTriangle className="w-3 h-3" /> Sem Custo
                                </span>
                              )}
                            </td>
                            <td className={`py-3.5 px-4 font-bold ${unitProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                              R$ {unitProfit.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge className={`font-bold rounded-lg text-[10px] px-2 py-0.5 ${
                                marginPercent >= 50 
                                  ? "bg-green-500/10 text-green-600 border-green-500/20" 
                                  : marginPercent >= 20 
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : "bg-red-500/10 text-red-500 border-red-500/20"
                              }`} variant="outline">
                                {marginPercent.toFixed(0)}%
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-foreground">{item.quantitySold} un</td>
                            <td className="py-3.5 px-4 font-medium">R$ {item.revenue.toFixed(2)}</td>
                            <td className="py-3.5 px-4 text-muted-foreground/80">R$ {item.productionCost.toFixed(2)}</td>
                            <td className={`py-3.5 px-4 text-right font-black ${item.profit >= 0 ? "text-primary" : "text-red-500"}`}>
                              R$ {item.profit.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── MODAL: ADD EXPENSE (WITH RECURRENCE) ── */}
      <Dialog open={isExpenseModalOpen} onOpenChange={setIsExpenseModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-extrabold text-lg">Nova Despesa / Custo</DialogTitle>
            <DialogDescription>Cadastre as informações da saída do caixa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveExpense} className="space-y-4">
            
            <div className="space-y-1.5">
              <Label htmlFor="exp-desc">Descrição / Nome da Despesa</Label>
              <Input 
                id="exp-desc" 
                value={expenseDesc} 
                onChange={(e) => setExpenseDesc(e.target.value)}
                placeholder="Ex: Conta de Luz, Fornecedor X" 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="exp-amount">Valor (R$)</Label>
                <Input 
                  id="exp-amount" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={expenseAmount} 
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder="0.00" 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-cat">Categoria</Label>
                <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                  <SelectTrigger id="exp-cat" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="exp-date">Vencimento</Label>
                <Input 
                  id="exp-date" 
                  type="date" 
                  value={expenseDueDate} 
                  onChange={(e) => setExpenseDueDate(e.target.value)}
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp-status">Status Inicial</Label>
                <Select value={expenseStatus} onValueChange={setExpenseStatus}>
                  <SelectTrigger id="exp-status" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="pending">Pendente (A Pagar)</SelectItem>
                    <SelectItem value="paid">Paga (Concluída)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Recurrence Fields */}
            <div className="pt-2 border-t border-border/50 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold">Despesa Recorrente</Label>
                  <p className="text-[11px] text-muted-foreground">Esta despesa se repete regularmente em parcelas</p>
                </div>
                <input 
                  type="checkbox" 
                  checked={expenseIsRec} 
                  onChange={(e) => setExpenseIsRec(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                />
              </div>

              {expenseIsRec && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <Label htmlFor="exp-rec-period">Frequência</Label>
                    <Select value={expenseRecPeriod} onValueChange={setExpenseRecPeriod}>
                      <SelectTrigger id="exp-rec-period" className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="exp-rec-inst">Parcelas / Ocorrências</Label>
                    <Input 
                      id="exp-rec-inst" 
                      type="number" 
                      min="2" 
                      max="24"
                      value={expenseInstallments} 
                      onChange={(e) => setExpenseInstallments(e.target.value)}
                      required={expenseIsRec} 
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setIsExpenseModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingExpense} className="rounded-xl text-xs font-bold">
                {savingExpense ? "Salvando..." : "Salvar Despesa"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: ADD EMPLOYEE ── */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-extrabold text-lg">Novo Funcionário</DialogTitle>
            <DialogDescription>Cadastre um funcionário na sua equipe do restaurante.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEmployee} className="space-y-4">
            
            <div className="space-y-1.5">
              <Label htmlFor="emp-name">Nome Completo</Label>
              <Input 
                id="emp-name" 
                value={empName} 
                onChange={(e) => setEmpName(e.target.value)}
                placeholder="Ex: João da Silva" 
                required 
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="emp-role">Cargo / Função</Label>
              <Input 
                id="emp-role" 
                value={empRole} 
                onChange={(e) => setEmpRole(e.target.value)}
                placeholder="Ex: Garçom, Cozinheiro, Auxiliar" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="emp-salary">Salário Mensal Base (R$)</Label>
                <Input 
                  id="emp-salary" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={empSalary} 
                  onChange={(e) => setEmpSalary(e.target.value)}
                  placeholder="0.00" 
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="emp-hire">Data de Admissão</Label>
                <Input 
                  id="emp-hire" 
                  type="date" 
                  value={empHireDate} 
                  onChange={(e) => setEmpHireDate(e.target.value)}
                  required 
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setIsEmployeeModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingEmployee} className="rounded-xl text-xs font-bold">
                {savingEmployee ? "Cadastrando..." : "Cadastrar Funcionário"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: PAYROLL PAYOUT LAUNCH ── */}
      <Dialog open={isPayrollModalOpen} onOpenChange={setIsPayrollModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-extrabold text-lg">Lançar Pagamento de Folha</DialogTitle>
            <DialogDescription>Lançar a remuneração ou adiantamento como despesa de Pessoal.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSavePayroll} className="space-y-4">
            
            <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-xs font-semibold text-muted-foreground">
              <p>Funcionário: <span className="text-foreground font-bold">{selectedEmp?.name}</span></p>
              <p className="mt-1">Cargo: <span className="text-foreground font-bold">{selectedEmp?.role || "Garçom"}</span></p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-month">Mês de Referência</Label>
              <Input 
                id="pay-month" 
                value={payrollMonth} 
                onChange={(e) => setPayrollMonth(e.target.value)}
                placeholder="Ex: Junho/2026" 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pay-amount">Valor Pago (R$)</Label>
                <Input 
                  id="pay-amount" 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={payrollAmount} 
                  onChange={(e) => setPayrollAmount(e.target.value)}
                  required 
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-status">Status</Label>
                <Select value={payrollStatus} onValueChange={setPayrollStatus}>
                  <SelectTrigger id="pay-status" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="paid">Pago (Saída Realizada)</SelectItem>
                    <SelectItem value="pending">Pendente (A pagar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setIsPayrollModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingPayroll} className="rounded-xl text-xs font-bold">
                {savingPayroll ? "Lançando..." : "Confirmar Pagamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL: DELETE RECURRENT OPTIONS ── */}
      <Dialog open={isDeleteRecModalOpen} onOpenChange={setIsDeleteRecModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading font-extrabold text-lg flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" /> Excluir Despesa Recorrente
            </DialogTitle>
            <DialogDescription>
              Esta despesa faz parte de uma série de lançamentos recorrentes. Como deseja prosseguir?
            </DialogDescription>
          </DialogHeader>
          <div className="p-3.5 bg-red-500/5 border border-red-500/10 rounded-xl text-xs font-semibold text-muted-foreground">
            Despesa: <span className="text-foreground font-bold">{expenseToDelete?.description}</span>
            <span className="block mt-1">Valor: R$ {Number(expenseToDelete?.amount).toFixed(2)}</span>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-3">
            <Button 
              type="button" 
              variant="outline" 
              className="rounded-xl text-xs font-bold w-full sm:w-auto" 
              onClick={() => setIsDeleteRecModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              className="rounded-xl text-xs font-bold w-full sm:w-auto"
              disabled={deletingExpense}
              onClick={() => expenseToDelete && executeDelete(expenseToDelete.id, false)}
            >
              Apenas esta parcela
            </Button>
            <Button 
              type="button" 
              variant="destructive" 
              className="rounded-xl text-xs font-bold w-full sm:w-auto"
              disabled={deletingExpense}
              onClick={() => expenseToDelete && executeDelete(expenseToDelete.id, true)}
            >
              Excluir série completa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
