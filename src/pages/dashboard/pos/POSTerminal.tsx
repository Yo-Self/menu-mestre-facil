import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/components/providers/RestaurantProvider";
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Calculator,
  ArrowLeft,
  Check,
  Receipt,
  Printer,
  ChevronRight,
  User,
  Tags,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getCurrentPOSSession,
  createPOSOrder,
  POSSession,
  POSOrderItemInput,
  POSOrderPaymentInput,
} from "@/services/posService";

interface CartItem {
  id: string; // unique cart item id (timestamp + dish_id)
  dish: any;
  quantity: number;
  selected_complements: {
    complement_id: string;
    name: string;
    price: number;
    group_title?: string;
  }[];
  notes?: string;
}

export default function POSTerminal() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentRestaurantId } = useRestaurant();
  
  const [activeSession, setActiveSession] = useState<POSSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [dishes, setDishes] = useState<any[]>([]);
  const [filteredDishes, setFilteredDishes] = useState<any[]>([]);
  
  // States for search and categories
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receiveAllTogether, setReceiveAllTogether] = useState(true);
  const [tableName, setTableName] = useState("Balcão");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isTakeaway, setIsTakeaway] = useState(false);
  const [orderObservation, setOrderObservation] = useState("");
  const [observationModalOpen, setObservationModalOpen] = useState(false);

  // Item observation states
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [editingCartItemNotes, setEditingCartItemNotes] = useState("");
  const [itemNotesModalOpen, setItemNotesModalOpen] = useState(false);

  const handleOpenItemNotes = (itemId: string, currentNotes?: string) => {
    setEditingCartItemId(itemId);
    setEditingCartItemNotes(currentNotes || "");
    setItemNotesModalOpen(true);
  };

  const handleSaveItemNotes = () => {
    if (!editingCartItemId) return;
    setCart(prev => 
      prev.map(item => 
        item.id === editingCartItemId 
          ? { ...item, notes: editingCartItemNotes.trim() } 
          : item
      )
    );
    setItemNotesModalOpen(false);
    setEditingCartItemId(null);
    setEditingCartItemNotes("");
  };

  // Complements dialog state
  const [complementsModalOpen, setComplementsModalOpen] = useState(false);
  const [selectedDishForComplements, setSelectedDishForComplements] = useState<any>(null);
  const [complementGroups, setComplementGroups] = useState<any[]>([]);
  const [selectedComplementsTemp, setSelectedComplementsTemp] = useState<{[groupId: string]: any[]}>({});

  // Checkout dialog states
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [payments, setPayments] = useState<POSOrderPaymentInput[]>([]);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<any>("cash");
  const [currentPaymentAmount, setCurrentPaymentAmount] = useState("");
  const [receivedCashAmount, setReceivedCashAmount] = useState("");

  // Order success / print state
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [restaurantName, setRestaurantName] = useState("Gestor Menu");
  const [restaurantLogo, setRestaurantLogo] = useState("");
  const [receiptSnapshot, setReceiptSnapshot] = useState<{
    items: CartItem[];
    subtotal: number;
    tableName: string;
    customerName: string;
  } | null>(null);

  const [viewMode, setViewMode] = useState<"grid" | "tables">("grid");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [tablesConfig, setTablesConfig] = useState<any[]>([
    { name: "Balcão", zone: "Balcão" },
    { name: "Mesa 01", zone: "Salão Principal" },
    { name: "Mesa 02", zone: "Salão Principal" },
    { name: "Mesa 03", zone: "Salão Principal" },
    { name: "Mesa 04", zone: "Salão Principal" },
    { name: "Mesa 05", zone: "Salão Principal" },
    { name: "Mesa 06", zone: "Salão Principal" },
    { name: "Mesa 07", zone: "Varanda" },
    { name: "Mesa 08", zone: "Varanda" },
    { name: "Mesa 09", zone: "Varanda" },
    { name: "Mesa 10", zone: "Varanda" },
    { name: "Mesa 11", zone: "Varanda" },
    { name: "Mesa 12", zone: "Varanda" }
  ]);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // States for Table Details Dialog
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<any>(null);
  const [tableDetailsModalOpen, setTableDetailsModalOpen] = useState(false);
  const [tableActiveOrders, setTableActiveOrders] = useState<any[]>([]);
  const [loadingTableDetails, setLoadingTableDetails] = useState(false);
  const [activeOrderIdsBeingClosed, setActiveOrderIdsBeingClosed] = useState<string[]>([]);

  useEffect(() => {
    if (!currentRestaurantId) {
      navigate("/dashboard/pos");
      return;
    }
    verifySessionAndLoadData();
  }, [currentRestaurantId]);

  useEffect(() => {
    // Entrar em tela cheia no Electron ao abrir o caixa do PDV
    if (typeof window !== "undefined" && (window as any).api?.setFullscreen) {
      (window as any).api.setFullscreen(true);
    }

    // Sair da tela cheia automaticamente ao fechar o caixa ou voltar para outra página
    return () => {
      if (typeof window !== "undefined" && (window as any).api?.setFullscreen) {
        (window as any).api.setFullscreen(false);
      }
    };
  }, []);

  useEffect(() => {
    filterProducts();
  }, [searchQuery, selectedCategoryId, dishes]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName);
      
      if (e.key === "F2") {
        e.preventDefault();
        openCheckout();
      } else if (e.key === "F4") {
        e.preventDefault();
        const searchInput = document.querySelector("input[placeholder*='Buscar']") as HTMLInputElement;
        if (searchInput) searchInput.focus();
      } else if (e.key === "F7" && !isInput) {
        e.preventDefault();
        if (cart.length > 0 && window.confirm("Deseja realmente limpar todos os itens da comanda atual?")) {
          setCart([]);
          setTableName("Balcão");
          setCustomerName("");
          setCustomerPhone("");
          setIsTakeaway(false);
          setOrderObservation("");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [cart, payments, tableName, customerName, customerPhone, isTakeaway, orderObservation]);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      toast({
        title: online ? "Conexão Restabelecida" : "Modo Offline Ativado",
        description: online 
          ? "O caixa está sincronizado em tempo real com a nuvem." 
          : "Suas vendas locais serão guardadas em cache e sincronizadas posteriormente.",
        variant: online ? "default" : "destructive"
      });
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const verifySessionAndLoadData = async () => {
    setLoading(true);
    try {
      const session = await getCurrentPOSSession(currentRestaurantId!);
      if (!session) {
        toast({
          title: "Caixa Fechado",
          description: "Você precisa abrir o caixa antes de acessar o terminal.",
          variant: "destructive",
        });
        navigate("/dashboard/pos");
        return;
      }
      setActiveSession(session);
      await loadPOSData();
    } catch (err) {
      console.error(err);
      navigate("/dashboard/pos");
    } finally {
      setLoading(false);
    }
  };

  const loadPOSData = async () => {
    try {
      // 0. Fetch restaurant details
      const { data: rest, error: restErr } = await supabase
        .from("restaurants")
        .select("name, has_tables, tables_count, table_categories, image_url")
        .eq("id", currentRestaurantId!)
        .single();

      if (!restErr && rest) {
        setRestaurantName(rest.name);
        setRestaurantLogo(rest.image_url || "");
        
        const hasTbls = rest.has_tables ?? true;
        if (hasTbls) {
          const count = rest.tables_count ?? 12;
          const categoriesRaw = rest.table_categories || "Balcão, Salão Principal, Varanda";
          const categoriesList = categoriesRaw.split(",").map(c => c.trim()).filter(Boolean);
          
          const newTablesConfig: any[] = [];
          
          // Always add Balcão first if "Balcão" is in the categories or as a default zone
          const hasBalcaoZone = categoriesList.some(c => c.toLowerCase() === "balcão");
          if (hasBalcaoZone) {
            newTablesConfig.push({ name: "Balcão", zone: "Balcão" });
          }
          
          // Distribute the table numbers among the rest of the categories
          const restCategories = categoriesList.filter(c => c.toLowerCase() !== "balcão");
          if (restCategories.length > 0) {
            let tableIndex = 1;
            for (let i = 0; i < count; i++) {
              const zoneName = restCategories[i % restCategories.length];
              const tableNumStr = String(tableIndex).padStart(2, "0");
              newTablesConfig.push({
                name: `Mesa ${tableNumStr}`,
                zone: zoneName
              });
              tableIndex++;
            }
          } else {
            // Fallback if only Balcão or empty
            for (let i = 1; i <= count; i++) {
              newTablesConfig.push({
                name: `Mesa ${String(i).padStart(2, "0")}`,
                zone: "Salão Principal"
              });
            }
          }
          setTablesConfig(newTablesConfig);
        } else {
          // If has_tables is false, only Balcão exists
          setTablesConfig([{ name: "Balcão", zone: "Balcão" }]);
        }
      }

      // 1. Fetch categories
      const { data: cats, error: catsErr } = await supabase
        .from("categories")
        .select("*")
        .eq("restaurant_id", currentRestaurantId!)
        .order("position", { ascending: true });

      if (catsErr) throw catsErr;
      setCategories(cats || []);

      // 2. Fetch dishes
      const { data: items, error: itemsErr } = await supabase
        .from("dishes")
        .select("*")
        .eq("restaurant_id", currentRestaurantId!)
        .eq("is_available", true)
        .order("name", { ascending: true });

      if (itemsErr) throw itemsErr;

      const dishesInCents = (items || []).map(dish => ({
        ...dish,
        price: Math.round((dish.price || 0) * 100)
      }));
      setDishes(dishesInCents);

      // 3. Fetch active orders to determine table occupancy dynamically
      const { data: activeOrds, error: ordsErr } = await supabase
        .from("orders")
        .select("id, table_name, status, total_price, created_at")
        .eq("restaurant_id", currentRestaurantId!)
        .in("status", ["new", "in_preparation", "ready"]);

      if (!ordsErr) {
        setActiveOrders(activeOrds || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do PDV:", err);
      toast({
        title: "Erro",
        description: "Falha ao carregar cardápio.",
        variant: "destructive",
      });
    }
  };

  const filterProducts = () => {
    let result = [...dishes];
    
    if (selectedCategoryId) {
      result = result.filter(d => d.category_id === selectedCategoryId);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        d => d.name.toLowerCase().includes(query) || (d.description && d.description.toLowerCase().includes(query))
      );
    }

    setFilteredDishes(result);
  };

  const getComplementsForDish = async (dishId: string) => {
    try {
      const { data, error } = await supabase
        .from("dish_complement_groups")
        .select(`
          complement_group_id,
          position,
          complement_group:complement_groups (
            id,
            title,
            description,
            required,
            max_selections
          )
        `)
        .eq("dish_id", dishId)
        .order("position", { ascending: true, nullsFirst: true });

      if (error) throw error;

      if (data) {
        // Now fetch active complements for each group
        const groupsWithComplements = await Promise.all(
          data.map(async (item: any) => {
            const group = item.complement_group;
            if (!group) return null;

            const { data: comps, error: compsErr } = await supabase
              .from("complements")
              .select("id, name, price, is_active")
              .eq("group_id", group.id)
              .eq("is_active", true)
              .order("position", { ascending: true });

            if (compsErr) throw compsErr;

            const compsInCents = (comps || []).map(c => ({
              ...c,
              price: Math.round((c.price || 0) * 100)
            }));

            return {
              ...group,
              complements: compsInCents,
            };
          })
        );

        return groupsWithComplements.filter(g => g !== null);
      }
      return [];
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleProductClick = async (dish: any) => {
    // Check if product has complements
    const groups = await getComplementsForDish(dish.id);
    
    if (groups && groups.length > 0) {
      setSelectedDishForComplements(dish);
      setComplementGroups(groups);
      
      // Initialize temp complements selections
      const initial: {[key: string]: any[]} = {};
      groups.forEach(g => {
        initial[g.id] = [];
      });
      setSelectedComplementsTemp(initial);
      
      setComplementsModalOpen(true);
    } else {
      // Just add to cart directly
      addToCart(dish, []);
    }
  };

  const handleComplementSelect = (groupId: string, comp: any, maxSelections: number) => {
    setSelectedComplementsTemp(prev => {
      const selected = prev[groupId] || [];
      const exists = selected.find(s => s.id === comp.id);
      
      let newSelected = [];
      if (exists) {
        // Toggle off
        newSelected = selected.filter(s => s.id !== comp.id);
      } else {
        // Add
        if (maxSelections === 1) {
          newSelected = [comp];
        } else if (selected.length < maxSelections) {
          newSelected = [...selected, comp];
        } else {
          newSelected = [...selected];
        }
      }
      
      return { ...prev, [groupId]: newSelected };
    });
  };

  const handleConfirmComplements = () => {
    if (!selectedDishForComplements) return;

    // Check required complement groups
    for (const group of complementGroups) {
      if (group.required) {
        const selections = selectedComplementsTemp[group.id] || [];
        if (selections.length === 0) {
          toast({
            title: "Seleção obrigatória",
            description: `Selecione pelo menos uma opção em "${group.title}".`,
            variant: "destructive",
          });
          return;
        }
      }
    }

    const flatComplements = Object.entries(selectedComplementsTemp).flatMap(([groupId, arr]) => {
      const group = complementGroups.find(g => g.id === groupId);
      const groupTitle = group ? group.title : "Complementos";
      return arr.map(c => ({
        complement_id: c.id,
        name: c.name,
        price: c.price,
        group_title: groupTitle,
      }));
    });

    addToCart(selectedDishForComplements, flatComplements);
    setComplementsModalOpen(false);
    setSelectedDishForComplements(null);
    setComplementGroups([]);
  };

  const addToCart = (dish: any, complements: any[]) => {
    setCart(prev => {
      // Check if item with same complements already exists in cart
      const existingItem = prev.find(item => {
        if (item.dish.id !== dish.id) return false;
        if (item.selected_complements.length !== complements.length) return false;
        
        // Match exact complements
        const currentIds = item.selected_complements.map(c => c.complement_id).sort();
        const incomingIds = complements.map(c => c.complement_id).sort();
        return currentIds.every((val, index) => val === incomingIds[index]);
      });

      if (existingItem) {
        // Increment quantity
        return prev.map(item => 
          item.id === existingItem.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        // Add new cart item
        return [
          ...prev,
          {
            id: `${Date.now()}-${dish.id}`,
            dish,
            quantity: 1,
            selected_complements: complements,
          }
        ];
      }
    });
  };

  const updateQuantity = (itemId: string, diff: number) => {
    setCart(prev => 
      prev.map(item => {
        if (item.id === itemId) {
          const newQty = item.quantity + diff;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      }).filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const getCartSubtotal = () => {
    return cart.reduce((acc, item) => {
      const dishPrice = item.dish.price || 0;
      const complementsPrice = item.selected_complements.reduce((sum, c) => sum + (c.price || 0), 0);
      return acc + (dishPrice + complementsPrice) * item.quantity;
    }, 0);
  };

  // Checkout functions
  const openCheckout = () => {
    if (cart.length === 0) {
      toast({
        title: "Carrinho Vazio",
        description: "Adicione itens antes de finalizar a venda.",
        variant: "destructive",
      });
      return;
    }
    const subtotal = getCartSubtotal();
    setPayments([]);
    setCurrentPaymentAmount((subtotal / 100).toFixed(2));
    setReceivedCashAmount("");
    setCheckoutModalOpen(true);
  };

  const addPayment = () => {
    const amountInCents = Math.round(parseFloat(currentPaymentAmount) * 100);
    const subtotal = getCartSubtotal();
    const alreadyPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = subtotal - alreadyPaid;

    if (isNaN(amountInCents) || amountInCents <= 0) {
      toast({
        title: "Valor inválido",
        description: "O valor deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (amountInCents > remaining) {
      if (currentPaymentMethod === "cash") {
        // Se for dinheiro e o valor for maior que o restante, aceitamos o pagamento de valor 'remaining'
        // e definimos o 'receivedCashAmount' como o valor total digitado para que o troco seja calculado.
        setReceivedCashAmount(currentPaymentAmount);
        
        setPayments(prev => [
          ...prev,
          { method: "cash", amount: remaining }
        ]);

        setCurrentPaymentAmount("0.00");
        return;
      } else {
        toast({
          title: "Valor inválido",
          description: `O valor deve ser menor ou igual a R$ ${(remaining / 100).toFixed(2)}`,
          variant: "destructive",
        });
        return;
      }
    }

    setPayments(prev => [
      ...prev,
      { method: currentPaymentMethod, amount: amountInCents }
    ]);

    // Recalculate remaining
    const nextPaid = alreadyPaid + amountInCents;
    const nextRemaining = subtotal - nextPaid;
    setCurrentPaymentAmount((nextRemaining / 100).toFixed(2));
    if (currentPaymentMethod === "cash") {
      setReceivedCashAmount((nextRemaining / 100).toFixed(2));
    }
  };

  const removePayment = (index: number) => {
    setPayments(prev => prev.filter((_, i) => i !== index));
    // Reset amount input
    const subtotal = getCartSubtotal();
    const remaining = subtotal - payments.filter((_, i) => i !== index).reduce((sum, p) => sum + p.amount, 0);
    setCurrentPaymentAmount((remaining / 100).toFixed(2));
  };

  const handleFinishSale = async () => {
    if (!activeSession) return;
    const subtotal = getCartSubtotal();
    const paidSum = payments.reduce((sum, p) => sum + p.amount, 0);

    if (paidSum < subtotal) {
      toast({
        title: "Pagamento incompleto",
        description: `Faltam R$ ${((subtotal - paidSum) / 100).toFixed(2)} para completar o pagamento.`,
        variant: "destructive",
      });
      return;
    }

    setSavingOrder(true);
    try {
      const orderItemsInput: POSOrderItemInput[] = cart.map(item => ({
        dish_id: item.dish.id,
        quantity: item.quantity,
        price_at_time_of_order: item.dish.price + item.selected_complements.reduce((sum, c) => sum + c.price, 0),
        selected_complements: item.selected_complements.length > 0 ? item.selected_complements : null,
        notes: item.notes || null,
        needs_preparation: item.dish.needs_preparation !== false
      }));

      // Gerar senha da fila se a configuração estiver ativa
      let queuePassword = null;
      if (localStorage.getItem("thermal_print_password") === "true") {
        const today = new Date().toLocaleDateString('pt-BR');
        const lastDate = localStorage.getItem("queue_date") || "";
        let currentCounter = parseInt(localStorage.getItem("queue_counter") || "0", 10);
        if (lastDate !== today) {
          currentCounter = 0;
          localStorage.setItem("queue_date", today);
        }
        currentCounter += 1;
        localStorage.setItem("queue_counter", currentCounter.toString());
        queuePassword = currentCounter.toString().padStart(3, '0');
      }

      if (!isOnline) {
        // Save local queue
        const offlineQueue = JSON.parse(localStorage.getItem("pos_offline_orders") || "[]");
        offlineQueue.push({
          id: `OFF-${Date.now()}`,
          restaurant_id: currentRestaurantId,
          pos_session_id: activeSession.id,
          table_name: tableName,
          items: orderItemsInput,
          payments: payments,
          created_at: new Date().toISOString(),
          customer_info: {
            name: customerName || "",
            phone: customerPhone || "",
            queue_password: queuePassword,
            is_takeaway: isTakeaway,
            observation: orderObservation || null
          }
        });
        localStorage.setItem("pos_offline_orders", JSON.stringify(offlineQueue));

        toast({
          title: "Venda Salva Offline!",
          description: "O caixa está offline. O pedido foi guardado localmente e será sincronizado depois.",
        });

        const offlineOrder = {
          id: `OFF-${Date.now()}`,
          created_at: new Date().toISOString(),
          customer_info: {
            name: customerName || "",
            phone: customerPhone || "",
            queue_password: queuePassword,
            is_takeaway: isTakeaway,
            observation: orderObservation || null
          }
        };
        setCreatedOrder(offlineOrder);
        const snapshot = {
          items: [...cart],
          subtotal: subtotal,
          tableName: tableName,
          customerName: customerName,
          receiveAllTogether: receiveAllTogether
        };
        setReceiptSnapshot(snapshot);
        setCheckoutModalOpen(false);
        setSuccessModalOpen(true);
        setCart([]);
        setTableName("Balcão");
        setCustomerName("");
        setCustomerPhone("");
        setPayments([]);
        setIsTakeaway(false);
        setOrderObservation("");

        // Impressão automática no fechamento offline se ativada nas configurações
        if (localStorage.getItem("thermal_print_automatic") === "true") {
          setTimeout(() => {
            printReceipt(offlineOrder, snapshot);
          }, 150);
        }
        return;
      }

      const finalOrder = await createPOSOrder(
        currentRestaurantId!,
        activeSession.id,
        tableName,
        customerName || null,
        customerPhone || null,
        orderItemsInput,
        payments,
        queuePassword,
        isTakeaway,
        orderObservation || null,
        receiveAllTogether
      );

      setCreatedOrder(finalOrder);
      const snapshot = {
        items: [...cart],
        subtotal: subtotal,
        tableName: tableName,
        customerName: customerName,
        receiveAllTogether: receiveAllTogether
      };
      setReceiptSnapshot(snapshot);
      toast({
        title: "Venda Concluída!",
        description: "O pedido foi registrado com sucesso.",
      });
      setCheckoutModalOpen(false);
      setSuccessModalOpen(true);
      setCart([]);
      setTableName("Balcão");
      setCustomerName("");
      setCustomerPhone("");
      setPayments([]);
      setIsTakeaway(false);
      setOrderObservation("");

      // Impressão automática no fechamento online se ativada nas configurações
      if (localStorage.getItem("thermal_print_automatic") === "true") {
        setTimeout(() => {
          printReceipt(finalOrder, snapshot);
        }, 150);
      }

      // If we are closing table orders, update their status to "finished" in Supabase
      if (activeOrderIdsBeingClosed.length > 0) {
        await supabase
          .from("orders")
          .update({ status: "finished" })
          .in("id", activeOrderIdsBeingClosed);
        setActiveOrderIdsBeingClosed([]);
      }
      
      // Reload active orders to update table occupancy dynamically
      await loadPOSData();
    } catch (err: any) {
      toast({
        title: "Erro ao registrar venda",
        description: err.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleSendToKitchen = async () => {
    if (!activeSession) return;
    if (cart.length === 0) return;

    setSavingOrder(true);
    try {
      const orderItemsInput: POSOrderItemInput[] = cart.map(item => ({
        dish_id: item.dish.id,
        quantity: item.quantity,
        price_at_time_of_order: item.dish.price + item.selected_complements.reduce((sum, c) => sum + c.price, 0),
        selected_complements: item.selected_complements.length > 0 ? item.selected_complements : null,
        notes: item.notes || null,
        needs_preparation: item.dish.needs_preparation !== false
      }));

      // Gerar senha da fila se a configuração estiver ativa
      let queuePassword = null;
      if (localStorage.getItem("thermal_print_password") === "true") {
        const today = new Date().toLocaleDateString('pt-BR');
        const lastDate = localStorage.getItem("queue_date") || "";
        let currentCounter = parseInt(localStorage.getItem("queue_counter") || "0", 10);
        if (lastDate !== today) {
          currentCounter = 0;
          localStorage.setItem("queue_date", today);
        }
        currentCounter += 1;
        localStorage.setItem("queue_counter", currentCounter.toString());
        queuePassword = currentCounter.toString().padStart(3, '0');
      }

      if (!isOnline) {
        const offlineQueue = JSON.parse(localStorage.getItem("pos_offline_orders") || "[]");
        offlineQueue.push({
          id: `OFF-${Date.now()}`,
          restaurant_id: currentRestaurantId,
          pos_session_id: activeSession.id,
          table_name: tableName,
          items: orderItemsInput,
          payments: [],
          created_at: new Date().toISOString(),
          customer_info: {
            name: customerName || "",
            phone: customerPhone || "",
            queue_password: queuePassword,
            is_takeaway: isTakeaway,
            observation: orderObservation || null
          }
        });
        localStorage.setItem("pos_offline_orders", JSON.stringify(offlineQueue));

        toast({
          title: "Pedido Offline Salvo!",
          description: "O caixa está offline. O pedido foi salvo localmente.",
        });

        setCart([]);
        setTableName("Balcão");
        setCustomerName("");
        setCustomerPhone("");
        setIsTakeaway(false);
        setOrderObservation("");
        return;
      }

      await createPOSOrder(
        currentRestaurantId!,
        activeSession.id,
        tableName,
        customerName || null,
        customerPhone || null,
        orderItemsInput,
        [],
        queuePassword,
        isTakeaway,
        orderObservation || null,
        receiveAllTogether
      );

      toast({
        title: "Pedido Enviado!",
        description: `Os itens foram enviados para preparação da cozinha na ${tableName}.`,
      });

      setCart([]);
      setTableName("Balcão");
      setCustomerName("");
      setCustomerPhone("");
      setIsTakeaway(false);
      setOrderObservation("");

      // Reload active orders to update table occupancy dynamically
      await loadPOSData();
    } catch (err: any) {
      toast({
        title: "Erro ao enviar pedido",
        description: err.message || "Ocorreu um erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const printReceipt = (orderToPrint?: any, snapshotToPrint?: any) => {
    // Se o argumento for um evento do React ou indefinido, usamos createdOrder
    const finalOrder = (orderToPrint && typeof orderToPrint === 'object' && 'created_at' in orderToPrint)
      ? orderToPrint
      : createdOrder;

    if (!finalOrder) {
      console.warn("Impressão de recibo ignorada: nenhum pedido disponível.");
      return;
    }

    const finalSnapshot = (snapshotToPrint && typeof snapshotToPrint === 'object' && 'items' in snapshotToPrint)
      ? snapshotToPrint
      : receiptSnapshot;
    
    const items = finalSnapshot?.items || cart;
    const subtotalVal = finalSnapshot?.subtotal || getCartSubtotal();
    const orderId = finalOrder?.id || "";
    const formattedDate = new Date(finalOrder?.created_at || Date.now()).toLocaleString("pt-BR");
    const tblName = finalSnapshot?.tableName || tableName;
    const custName = finalSnapshot?.customerName || customerName;
    const queuePassword = finalOrder?.customer_info && typeof finalOrder.customer_info === 'object'
      ? (finalOrder.customer_info as any).queue_password
      : null;

    // Create a hidden iframe for isolated print
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!iframeDoc) return;

    // Construct the items HTML using simple flex elements styled with inline CSS
    const itemsHtml = items.map((item: any) => {
      const dishPrice = item.dish.price || 0;
      const compsPrice = item.selected_complements.reduce((sum: number, c: any) => sum + (c.price || 0), 0);
      const unitTotal = dishPrice + compsPrice;
      const totalItemPrice = ((unitTotal * item.quantity) / 100).toFixed(2);
      
      let compsText = "";
      if (item.selected_complements && item.selected_complements.length > 0) {
        const groups: Record<string, any[]> = {};
        item.selected_complements.forEach((c: any) => {
          const title = c.group_title || "Complementos";
          if (!groups[title]) groups[title] = [];
          groups[title].push(c);
        });
        
        compsText = Object.entries(groups)
          .map(([title, comps]) => `<div style="font-size: 8px; color: #555; padding-left: 5px; margin-top: 1px;"><strong>${title}:</strong> ${comps.map(c => c.name).join(", ")}</div>`)
          .join("");
      }
      
      let notesText = "";
      if (item.notes) {
        notesText = `<div style="font-size: 8px; color: red; padding-left: 5px; margin-top: 1px;"><strong>Obs:</strong> ${item.notes}</div>`;
      }
      
      return `
        <div style="margin-bottom: 6px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-weight: bold; max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.dish.name}</span>
            <span style="white-space: nowrap;">${item.quantity} x R$ ${((unitTotal) / 100).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 10px;">
            <span>&nbsp;</span>
            <span style="font-weight: bold;">R$ ${totalItemPrice}</span>
          </div>
          ${compsText}
          ${notesText}
        </div>
      `;
    }).join("");

    const orderObs = finalOrder?.customer_info && typeof finalOrder.customer_info === 'object'
      ? (finalOrder.customer_info as any).observation || (finalOrder.customer_info as any).notes
      : null;

    const customerHtml = custName ? `<p style="margin: 2px 0;">Cliente: ${custName}</p>` : "";
    const observationHtml = orderObs ? `<p style="margin: 2px 0; font-weight: bold; color: #ff0000;">⚠️ OBS PEDIDO: ${orderObs}</p>` : "";

    const paperWidth = localStorage.getItem("thermal_paper_width") || "80mm";
    const htmlContent = `
      <html>
        <head>
          <title>Comprovante - ${restaurantName}</title>
          <style>
            @page {
              size: ${paperWidth === "58mm" ? "58mm" : "80mm"} auto;
              margin: 0;
            }
            body { 
              background: white; 
              color: black;
              padding: 6mm 4mm;
              margin: 0;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: ${paperWidth === "58mm" ? "50mm" : "72mm"};
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .border-t-dashed { border-top: 1px dashed black; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="text-center">
            ${restaurantLogo ? `<div style="margin-bottom: 6px;"><img src="${restaurantLogo}" style="max-width: 60px; max-height: 60px; object-fit: contain;" /></div>` : ''}
            <h3 style="margin: 0 0 4px 0; font-size: 14px; text-transform: uppercase;">${restaurantName}</h3>
            <p style="margin: 0 0 2px 0; font-size: 10px; font-weight: bold;">Comprovante de Venda</p>
            <p style="margin: 0; font-size: 9px; color: #555;">ID: ${orderId.substring(0, 8)}...</p>
          </div>

          ${queuePassword ? `
            <div class="border-t-dashed my-2"></div>
            <div class="text-center" style="padding: 6px 0;">
              <span style="font-size: 24px; font-weight: 900; font-family: sans-serif;">SENHA: ${queuePassword}</span>
            </div>
          ` : ''}

          <div class="border-t-dashed my-2"></div>

          <div style="font-size: 11px; line-height: 1.4;">
            <p style="margin: 2px 0;">Data: ${formattedDate}</p>
            <p style="margin: 2px 0;">Mesa/Comanda: ${tblName}</p>
            ${customerHtml}
            ${observationHtml}
          </div>

          <div class="border-t-dashed my-2"></div>

          <div style="font-size: 11px;">
            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 6px; font-size: 10px; color: #555;">
              <span>ITEM</span>
              <span>TOTAL</span>
            </div>
            ${itemsHtml}
          </div>

          <div class="border-t-dashed my-2"></div>

          <div class="text-right" style="font-size: 12px; line-height: 1.5;">
            <p style="margin: 2px 0;">SUBTOTAL: R$ ${(subtotalVal / 100).toFixed(2)}</p>
            <p style="margin: 2px 0; font-weight: bold; font-size: 13px;">TOTAL PAGO: R$ ${(subtotalVal / 100).toFixed(2)}</p>
          </div>

          <div class="border-t-dashed my-2" style="margin-top: 15px;"></div>
          <div class="text-center" style="font-size: 9px; color: #555; margin-top: 8px;">
            <p style="margin: 0;">Obrigado pela preferência!</p>
            <p style="margin: 2px 0 0 0;">Gestor Menu</p>
          </div>
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    const isDesktop = typeof window !== 'undefined' && !!(window as any).api;
    if (isDesktop) {
      const printerName = localStorage.getItem("thermal_printer") || "";
      (window as any).api.print(htmlContent, { printerName, silent: true })
        .then(() => {
          if (localStorage.getItem("thermal_print_kitchen") === "true") {
            setTimeout(() => {
              printKitchenReceipt(finalOrder, finalSnapshot);
            }, 500);
          }
        })
        .catch((err: any) => {
          console.error("Erro na impressão silenciosa do PDV:", err);
        });
    } else {
      // Trigger print in browser fallback
      setTimeout(() => {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();

          // Print kitchen receipt if active
          if (localStorage.getItem("thermal_print_kitchen") === "true") {
            setTimeout(() => {
              printKitchenReceipt(finalOrder, finalSnapshot);
            }, 1000);
          }
        }
      }, 250);
    }
  };

  const printKitchenReceipt = (orderToPrint?: any, snapshotToPrint?: any) => {
    // Se o argumento for um evento do React ou indefinido, usamos createdOrder
    const finalOrder = (orderToPrint && typeof orderToPrint === 'object' && 'created_at' in orderToPrint)
      ? orderToPrint
      : createdOrder;

    if (!finalOrder) return;

    const finalSnapshot = (snapshotToPrint && typeof snapshotToPrint === 'object' && 'items' in snapshotToPrint)
      ? snapshotToPrint
      : receiptSnapshot;

    const items = finalSnapshot?.items || cart;
    const finalReceiveAllTogether = finalSnapshot?.receiveAllTogether !== undefined
      ? finalSnapshot.receiveAllTogether
      : receiveAllTogether;

    const filteredItems = items.filter((item: any) => {
      if (finalReceiveAllTogether) return true;
      return item.sent_to_kitchen !== false && item.dish?.needs_preparation !== false && item.needs_preparation !== false;
    });

    if (filteredItems.length === 0) return;

    const orderId = finalOrder?.id || "";
    const formattedDate = new Date(finalOrder?.created_at || Date.now()).toLocaleString("pt-BR");
    const tblName = finalSnapshot?.tableName || tableName;
    const custName = finalSnapshot?.customerName || customerName;
    const queuePassword = finalOrder?.customer_info && typeof finalOrder.customer_info === 'object'
      ? (finalOrder.customer_info as any).queue_password
      : null;
    const isTakeawayOrder = finalOrder?.customer_info && typeof finalOrder.customer_info === 'object'
      ? !!(finalOrder.customer_info as any).is_takeaway
      : false;

    let kitchenIframe = document.getElementById('print-kitchen-iframe') as HTMLIFrameElement;
    if (!kitchenIframe) {
      kitchenIframe = document.createElement('iframe');
      kitchenIframe.id = 'print-kitchen-iframe';
      kitchenIframe.style.position = 'fixed';
      kitchenIframe.style.right = '0';
      kitchenIframe.style.bottom = '0';
      kitchenIframe.style.width = '0';
      kitchenIframe.style.height = '0';
      kitchenIframe.style.border = '0';
      document.body.appendChild(kitchenIframe);
    }

    const iframeDoc = kitchenIframe.contentWindow?.document || kitchenIframe.contentDocument;
    if (!iframeDoc) return;

    const itemsHtml = filteredItems.map((item: any) => {
      let compsText = "";
      if (item.selected_complements && item.selected_complements.length > 0) {
        const groups: Record<string, any[]> = {};
        item.selected_complements.forEach((c: any) => {
          const title = c.group_title || "Complementos";
          if (!groups[title]) groups[title] = [];
          groups[title].push(c);
        });
        
        compsText = Object.entries(groups)
          .map(([title, comps]) => `<div style="font-size: 11px; font-weight: bold; color: #111; padding-left: 5px; margin-top: 2px;"><strong>${title}:</strong> ${comps.map(c => c.name).join(", ")}</div>`)
          .join("");
      }
      
      let notesText = "";
      if (item.notes) {
        notesText = `<div style="font-size: 12px; font-weight: bold; color: red; margin-top: 3px; padding-left: 5px;">⚠️ OBS: ${item.notes}</div>`;
      }

      return `
        <div style="margin-bottom: 8px; border-bottom: 1px solid #ccc; padding-bottom: 6px;">
          <div style="font-size: 14px; font-weight: bold;">
            ${item.quantity} x [ ${item.dish?.name || item.dish_name} ]
          </div>
          ${compsText}
          ${notesText}
        </div>
      `;
    }).join("");

    const paperWidth = localStorage.getItem("thermal_paper_width") || "80mm";
    const htmlContent = `
      <html>
        <head>
          <title>Cozinha - ${restaurantName}</title>
          <style>
            @page {
              size: ${paperWidth === "58mm" ? "58mm" : "80mm"} auto;
              margin: 0;
            }
            body { 
              background: white; 
              color: black;
              padding: 6mm 4mm;
              margin: 0;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: ${paperWidth === "58mm" ? "50mm" : "72mm"};
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .border-t-dashed { border-top: 1px dashed black; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: bold;">--- VIA COZINHA ---</h3>
            <p style="margin: 0; font-size: 10px;">ID: ${orderId.substring(0, 8)}...</p>
          </div>

          <div class="border-t-dashed my-2"></div>

          ${isTakeawayOrder ? `
            <div style="background-color: #000; color: #fff; padding: 6px; font-weight: bold; font-size: 14px; text-align: center; margin: 6px 0;">
              *** PEDIDO PARA VIAGEM ***
            </div>
            <div class="border-t-dashed my-2"></div>
          ` : ''}

          ${queuePassword ? `
            <div class="text-center" style="padding: 4px 0;">
              <span style="font-size: 24px; font-weight: bold;">SENHA: ${queuePassword}</span>
            </div>
            <div class="border-t-dashed my-2"></div>
          ` : ''}

          <div style="font-size: 11px; line-height: 1.4;">
            <p style="margin: 2px 0; font-weight: bold; font-size: 13px;">Mesa/Comanda: ${tblName}</p>
            <p style="margin: 2px 0;">Cliente: ${custName || "Consumidor"}</p>
            <p style="margin: 2px 0;">Hora: ${formattedDate}</p>
            ${(() => {
              const orderObs = finalOrder?.customer_info && typeof finalOrder.customer_info === 'object'
                ? (finalOrder.customer_info as any).observation || (finalOrder.customer_info as any).notes
                : null;
              return orderObs ? `<p style="margin: 4px 0; font-weight: bold; color: red; font-size: 13px; background-color: #eee; padding: 4px; border: 1px solid #ccc;">⚠️ OBS PEDIDO: ${orderObs}</p>` : "";
            })()}
          </div>

          <div class="border-t-dashed my-2"></div>

          <div style="font-size: 11px;">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 11px; text-transform: uppercase;">
              ITENS PARA PREPARAÇÃO
            </div>
            ${itemsHtml}
          </div>

          <div class="border-t-dashed my-2"></div>
          <div class="text-center" style="font-size: 10px; font-weight: bold; margin-top: 8px;">
            <p style="margin: 0;">--- FIM VIA COZINHA ---</p>
          </div>
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    const isDesktop = typeof window !== 'undefined' && !!(window as any).api;
    if (isDesktop) {
      const printerName = localStorage.getItem("thermal_printer") || "";
      (window as any).api.print(htmlContent, { printerName, silent: true })
        .catch((err: any) => {
          console.error("Erro na impressão silenciosa da cozinha:", err);
        });
    } else {
      setTimeout(() => {
        if (kitchenIframe.contentWindow) {
          kitchenIframe.contentWindow.focus();
          kitchenIframe.contentWindow.print();
        }
      }, 250);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: {[key: string]: string} = {
      cash: "Dinheiro",
      credit_card: "Cartão de Crédito",
      debit_card: "Cartão de Débito",
      pix: "PIX",
      stripe: "Online (Stripe)"
    };
    return labels[method] || method;
  };

  const getTableStatus = (tableNameToCheck: string) => {
    const tableOrds = activeOrders.filter(
      o => o.table_name === tableNameToCheck && ["new", "in_preparation", "ready"].includes(o.status)
    );
    // Sort oldest first
    const sorted = [...tableOrds].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return {
      isBusy: sorted.length > 0,
      activeOrdersCount: sorted.length,
      orders: sorted
    };
  };

  const fetchTableDetails = async (tableNameToFetch: string) => {
    setLoadingTableDetails(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          total_price,
          status,
          customer_info,
          order_items (
            id,
            quantity,
            price_at_time_of_order,
            selected_complements,
            dish:dishes (
              id,
              name,
              price,
              image_url
            )
          )
        `)
        .eq("restaurant_id", currentRestaurantId!)
        .eq("table_name", tableNameToFetch)
        .in("status", ["new", "in_preparation", "ready"]);

      if (error) throw error;
      setTableActiveOrders(data || []);
    } catch (err: any) {
      console.error("Erro ao buscar detalhes da mesa:", err);
      toast({
        title: "Erro ao buscar consumo",
        description: err.message || "Não foi possível carregar os pedidos ativos da mesa.",
        variant: "destructive"
      });
    } finally {
      setLoadingTableDetails(false);
    }
  };

  const handleImportTableConsumption = (tableNameToImport: string, ordersToImport: any[]) => {
    try {
      if (ordersToImport.length === 0) {
        toast({
          title: "Aviso",
          description: "Não há consumo ativo nesta mesa para importar.",
          variant: "destructive"
        });
        return;
      }

      const importedCartItems: CartItem[] = [];
      
      ordersToImport.forEach(order => {
        (order.order_items || []).forEach((item: any) => {
          const complements = (item.selected_complements as any[]) || [];
          const complementsSum = complements.reduce((sum: number, c: any) => sum + (c.price || 0), 0);
          const baseDishPrice = item.price_at_time_of_order - complementsSum;
          
          const dishObj = {
            id: item.dish_id,
            name: item.dish?.name || "Produto",
            price: baseDishPrice,
            image_url: item.dish?.image_url
          };
          
          const cartItem: CartItem = {
            id: `${Date.now()}-${item.id}-${Math.random()}`,
            dish: dishObj,
            quantity: item.quantity,
            selected_complements: complements.map((c: any) => ({
              complement_id: c.complement_id || c.id,
              name: c.name,
              price: c.price,
              group_title: c.group_title || "Complementos"
            }))
          };
          
          importedCartItems.push(cartItem);
        });
      });

      setCart(importedCartItems);
      setTableName(tableNameToImport);
      
      // Track which orders are being closed so we finalize them on checkout
      setActiveOrderIdsBeingClosed(ordersToImport.map(o => o.id));
      
      setTableDetailsModalOpen(false);
      setViewMode("grid");

      toast({
        title: "Consumo Importado!",
        description: `Carregamos os itens da ${tableNameToImport} no carrinho. Finalize a venda para fechar a conta.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao importar",
        description: "Falha ao processar itens da mesa.",
        variant: "destructive"
      });
    }
  };

  const handleReleaseTable = async (tableNameToRelease: string, ordersToRelease: any[]) => {
    if (ordersToRelease.length === 0) return;
    
    if (!window.confirm(`Tem certeza que deseja liberar a ${tableNameToRelease} manualmente?\nIsso marcará todos os ${ordersToRelease.length} pedidos ativos dela como concluídos sem registrar pagamento no caixa.`)) {
      return;
    }

    try {
      const orderIds = ordersToRelease.map(o => o.id);
      const { error } = await supabase
        .from("orders")
        .update({ status: "finished" })
        .in("id", orderIds);

      if (error) throw error;

      toast({
        title: "Mesa Liberada!",
        description: `A ${tableNameToRelease} foi liberada e seus pedidos foram finalizados.`,
      });

      setTableDetailsModalOpen(false);
      await loadPOSData(); // Reload table map occupancy dynamically
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao liberar mesa",
        description: err.message || "Ocorreu um erro ao liberar a mesa.",
        variant: "destructive"
      });
    }
  };

  const renderTableMap = () => {
    const stats = (() => {
      let total = tablesConfig.length;
      let occupied = 0;
      let free = 0;
      let totalActiveRevenue = 0;
      
      tablesConfig.forEach(t => {
        const { isBusy, orders } = getTableStatus(t.name);
        if (isBusy) {
          occupied++;
          totalActiveRevenue += orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
        } else {
          free++;
        }
      });
      
      return { total, occupied, free, totalActiveRevenue };
    })();

    return (
      <div className="flex-1 flex flex-col space-y-6">
        {/* Stats Header */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-white/40 dark:bg-zinc-900/40 border-border/50 backdrop-blur-md p-4 flex flex-col justify-between rounded-2xl shadow-sm border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Total de Mesas</span>
            <span className="text-xl font-black font-heading mt-1 text-foreground">{stats.total}</span>
          </Card>
          <Card className="bg-emerald-500/5 border-emerald-500/20 backdrop-blur-md p-4 flex flex-col justify-between rounded-2xl shadow-sm border">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Mesas Livres</span>
            <span className="text-xl font-black font-heading text-emerald-600 dark:text-emerald-400 mt-1">{stats.free}</span>
          </Card>
          <Card className="bg-amber-500/5 border-amber-500/20 backdrop-blur-md p-4 flex flex-col justify-between rounded-2xl shadow-sm border">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Mesas Ocupadas</span>
            <span className="text-xl font-black font-heading text-amber-600 dark:text-amber-400 mt-1">{stats.occupied}</span>
          </Card>
          <Card className="bg-primary/5 border-primary/20 backdrop-blur-md p-4 flex flex-col justify-between rounded-2xl shadow-sm border">
            <span className="text-[10px] font-bold text-primary uppercase">Consumo Ativo</span>
            <span className="text-xl font-black font-heading text-primary mt-1">
              {(stats.totalActiveRevenue / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </Card>
        </div>

        {/* Zones & Tables Grid */}
        <div className="flex-1 overflow-y-auto max-h-[500px] md:max-h-[calc(100vh-21rem)] pr-1 space-y-6">
          {Array.from(new Set(tablesConfig.map(t => t.zone))).map((zone) => {
            const zoneTables = tablesConfig.filter(t => t.zone === zone);
            const zoneIcon = zone === "Balcão" ? "🏪" : zone === "Salão Principal" ? "🛋️" : "🌅";
            
            return (
              <div key={zone} className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border/40 pb-1.5">
                  <span className="text-base">{zoneIcon}</span>
                  <h3 className="font-heading font-black text-xs uppercase tracking-wider text-muted-foreground">{zone}</h3>
                  <Badge variant="secondary" className="text-[9px] font-bold rounded-lg px-2 py-0.5 ml-1">
                    {zoneTables.length} {zoneTables.length === 1 ? "mesa" : "mesas"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {zoneTables.map((table) => {
                    const { isBusy, activeOrdersCount, orders } = getTableStatus(table.name);
                    const isCurrentTable = tableName === table.name;
                    
                    let elapsedMinutes = 0;
                    let totalConsumption = 0;
                    if (isBusy && orders.length > 0) {
                      const oldestOrderTime = new Date(orders[0].created_at).getTime();
                      elapsedMinutes = Math.max(0, Math.floor((Date.now() - oldestOrderTime) / 60000));
                      totalConsumption = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
                    }

                    return (
                      <Card
                        key={table.name}
                        className={`cursor-pointer border-2 transition-all duration-300 flex flex-col justify-between p-4 rounded-2xl relative overflow-hidden h-32 hover:-translate-y-1 hover:shadow-lg ${
                          isCurrentTable
                            ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                            : isBusy
                            ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 hover:bg-amber-500/10 shadow-sm"
                            : "border-border/50 bg-white/40 dark:bg-zinc-900/40 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                        }`}
                        onClick={() => {
                          if (isBusy) {
                            setSelectedTableForDetails(table);
                            fetchTableDetails(table.name);
                            setTableDetailsModalOpen(true);
                          } else {
                            setTableName(table.name);
                            setViewMode("grid");
                            toast({
                              title: `Mesa Selecionada`,
                              description: `Você está lançando para: ${table.name}`,
                            });
                          }
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="font-heading font-black text-sm text-foreground">{table.name}</h4>
                          <span className={`h-2 w-2 rounded-full inline-block ${isBusy ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                        </div>
                        
                        {isBusy ? (
                          <div className="space-y-1 mt-1.5">
                            <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                              <span>⏳ Consumindo:</span>
                              <span>{elapsedMinutes} min</span>
                            </div>
                            <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/30">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase">{activeOrdersCount} {activeOrdersCount === 1 ? 'ped.' : 'peds.'}</span>
                              <span className="font-heading font-black text-xs text-amber-600 dark:text-amber-400">
                                {(totalConsumption / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col mt-auto">
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Livre</span>
                            <span className="text-[8px] text-muted-foreground">Toque para abrir</span>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Iniciando terminal de vendas...</span>
      </div>
    );
  }

  const subtotal = getCartSubtotal();
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingToPay = subtotal - totalPaid;
  const cashReceivedAmount = parseFloat(receivedCashAmount) || 0;
  const cashPaymentAmount = payments.find(p => p.method === "cash")?.amount 
    || (currentPaymentMethod === "cash" ? Math.round((parseFloat(currentPaymentAmount) || 0) * 100) : 0);
  const cashChange = Math.max(0, (cashReceivedAmount * 100) - cashPaymentAmount);

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-8.5rem)]">
      {/* LEFT COLUMN: PRODUCTS GRID & CATEGORIES */}
      <div className="flex-1 space-y-6 flex flex-col min-w-0">
        {/* Header Terminal */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/pos")} className="hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-2xl font-black font-heading text-primary">Terminal de Vendas</h2>
          </div>
          
          {/* Quick status bar */}
          <div className="hidden sm:flex items-center gap-3 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/40 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Caixa Aberto
            </div>
            <span className="text-muted-foreground">|</span>
            <div className="text-muted-foreground">
              Operador: {activeSession?.user_id ? "Ativo" : "Master"}
            </div>
          </div>
        </div>

        {/* Tab Segmented Control */}
        <div className="flex bg-muted/60 p-1 rounded-xl w-fit border border-border/40 gap-1">
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className={`font-heading font-black text-xs px-5 h-8 rounded-lg transition-all duration-300 ${
              viewMode === "grid" 
                ? "bg-white dark:bg-zinc-900 shadow-sm text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🍔 Cardápio / Pratos
          </Button>
          <Button
            variant={viewMode === "tables" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("tables")}
            className={`font-heading font-black text-xs px-5 h-8 rounded-lg transition-all duration-300 ${
              viewMode === "tables" 
                ? "bg-white dark:bg-zinc-900 shadow-sm text-primary" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🗺️ Mapa de Mesas
          </Button>
        </div>

        {viewMode === "grid" && (
          <>
            {/* Filter Toolbar (Search & Category tags) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou descrição do prato..."
                  className="pl-10 focus-visible:ring-primary h-11"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Category Horizontal Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
              <Button
                variant={selectedCategoryId === null ? "default" : "outline"}
                className="rounded-full font-semibold text-xs h-9 px-4 flex-shrink-0"
                onClick={() => setSelectedCategoryId(null)}
              >
                Todos os Itens
              </Button>
              {categories.map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategoryId === cat.id ? "default" : "outline"}
                  className="rounded-full font-semibold text-xs h-9 px-4 flex-shrink-0"
                  onClick={() => setSelectedCategoryId(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
            </div>
          </>
        )}

        {/* Products Grid / Table Map Branch */}
        {viewMode === "tables" ? (
          renderTableMap()
        ) : filteredDishes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 text-center">
            <Tags className="h-12 w-12 text-muted-foreground/60 mb-2" />
            <p className="font-heading font-semibold text-muted-foreground">Nenhum produto disponível.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Crie categorias e pratos no menu de gestão do painel.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[500px] md:max-h-[calc(100vh-21rem)] pr-1">
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDishes.map((dish) => {
                const isOutOfStock = dish.stock_quantity !== null && dish.stock_quantity !== undefined && dish.stock_quantity <= 0;
                
                return (
                  <Card
                    key={dish.id}
                    className={`cursor-pointer hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden flex flex-col border border-border/50 bg-white/40 dark:bg-zinc-900/40 relative group ${isOutOfStock ? 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none' : ''}`}
                    onClick={() => !isOutOfStock && handleProductClick(dish)}
                  >
                    {dish.stock_quantity !== null && dish.stock_quantity !== undefined && (
                      <div className="absolute top-2 right-2 z-10">
                        {isOutOfStock ? (
                          <Badge className="bg-red-600 text-white font-extrabold text-[9px] rounded-lg border-0 shadow-sm">Esgotado</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-zinc-950/80 text-white font-mono text-[9px] border-0 rounded-lg shadow-sm">Estoque: {dish.stock_quantity}</Badge>
                        )}
                      </div>
                    )}

                    {dish.image_url ? (
                      <div className="h-32 w-full overflow-hidden bg-muted relative">
                        <img
                          src={dish.image_url}
                          alt={dish.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLImageElement).parentElement;
                            if (parent) {
                              const fallback = document.createElement('div');
                              fallback.className = "w-full h-full flex items-center justify-center font-heading font-black text-2xl text-muted-foreground/40 bg-muted";
                              fallback.innerText = dish.name ? dish.name[0] : '?';
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-32 w-full bg-muted flex items-center justify-center font-heading font-black text-2xl text-muted-foreground/40">
                        {dish.name ? dish.name[0] : '?'}
                      </div>
                    )}
                    
                    <CardContent className="p-3 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h4 className="font-heading font-bold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {dish.name}
                        </h4>
                        {dish.description && (
                          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {dish.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="font-heading font-black text-sm text-primary">
                          {(dish.price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: CART SIDEBAR */}
      <Card className="w-full md:w-[350px] lg:w-[420px] flex-shrink-0 shadow-lg border border-border/60 bg-white dark:bg-zinc-950 flex flex-col h-[calc(100vh-8.5rem)]">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold font-heading flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Comanda Atual
            </CardTitle>
            <Badge variant="outline" className="font-bold rounded-lg border-primary/20 bg-primary/5 text-primary px-2 py-0.5">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} itens
            </Badge>
          </div>
        </CardHeader>
        
        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/60 mb-2 animate-pulse" />
              <p className="font-heading font-semibold text-muted-foreground text-sm">Seu carrinho está vazio.</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Toque nos pratos do cardápio para adicioná-los.</p>
            </div>
          ) : (
            cart.map((item) => {
              const dishPrice = item.dish.price || 0;
              const complementsPrice = item.selected_complements.reduce((sum, c) => sum + (c.price || 0), 0);
              const unitTotal = dishPrice + complementsPrice;

              return (
                <div key={item.id} className="flex gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-heading font-bold text-xs text-foreground truncate">{item.dish.name}</h5>
                    
                    {/* Complements listed underneath */}
                    {item.selected_complements.length > 0 && (() => {
                      const groups: Record<string, typeof item.selected_complements> = {};
                      item.selected_complements.forEach(c => {
                        const title = c.group_title || "Complementos";
                        if (!groups[title]) groups[title] = [];
                        groups[title].push(c);
                      });
                      
                      return (
                        <div className="mt-1 space-y-1 bg-black/5 dark:bg-white/5 p-1.5 rounded-lg border border-border/30 max-w-[220px]">
                          {Object.entries(groups).map(([title, comps]) => (
                            <div key={title} className="text-[9px] leading-tight flex flex-wrap gap-x-1">
                              <span className="font-bold text-foreground/85 uppercase tracking-wider text-[8px]">{title}:</span>
                              <span className="text-muted-foreground">
                                {comps.map(c => c.name).join(", ")}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    <div className="mt-2 flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center border rounded-lg overflow-hidden bg-background h-7">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <span className="text-[10px] text-muted-foreground/80 font-bold">
                          x {(unitTotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        className={`h-8 px-2.5 text-xs font-bold rounded-lg gap-1 border border-border/20 ${
                          item.notes
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-600 hover:bg-rose-500/15 dark:bg-rose-500/20 dark:text-rose-400"
                            : "bg-background text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => handleOpenItemNotes(item.id, item.notes)}
                      >
                        <span>📝 {item.notes ? "Obs. Ativa" : "Obs"}</span>
                      </Button>
                    </div>

                    {item.notes && (
                      <div className="mt-2 p-1.5 bg-rose-500/5 dark:bg-rose-500/10 rounded-lg border border-rose-500/10 text-[10px] text-rose-600 dark:text-rose-400 font-medium flex items-center justify-between gap-1.5 animate-fade-in max-w-[240px]">
                        <span className="truncate flex-1"><strong>Obs:</strong> {item.notes}</span>
                        <button
                          onClick={() => {
                            setCart(prev => prev.map(i => i.id === item.id ? { ...i, notes: "" } : i));
                          }}
                          className="text-[9px] text-rose-500 hover:text-rose-700 font-black cursor-pointer px-1"
                          title="Remover Observação"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <span className="font-heading font-black text-xs text-primary">
                      {((unitTotal * item.quantity) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Customer Info Form */}
        <div className="p-4 border-t space-y-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="table" className="text-[10px] font-bold text-muted-foreground uppercase">Mesa / Comanda</Label>
              <Input
                id="table"
                className="h-8 text-xs focus-visible:ring-primary"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="customer-name" className="text-[10px] font-bold text-muted-foreground uppercase">Cliente (Nome)</Label>
              <Input
                id="customer-name"
                className="h-8 text-xs focus-visible:ring-primary"
                placeholder="Opcional"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="col-span-2 pt-2 border-t border-border/20 mt-1 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="takeaway"
                  checked={isTakeaway}
                  onCheckedChange={setIsTakeaway}
                />
                <Label htmlFor="takeaway" className="text-xs font-bold text-foreground cursor-pointer flex items-center gap-1">
                  💼 Pedido para Viagem
                </Label>
              </div>

              <Button
                variant="outline"
                size="sm"
                className={`h-8 px-3 text-xs font-bold rounded-lg gap-1 border border-border/40 transition-all duration-200 ${
                  orderObservation 
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-600 hover:bg-rose-500/15 dark:bg-rose-500/20 dark:text-rose-400" 
                    : "bg-background text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setObservationModalOpen(true)}
              >
                <span>📝 {orderObservation ? "Obs. Ativa" : "Observação"}</span>
              </Button>
            </div>

            {orderObservation && (
              <div className="col-span-2 mt-1.5 p-2 bg-rose-500/5 dark:bg-rose-500/10 rounded-lg border border-rose-500/10 text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center justify-between gap-2 animate-fade-in">
                <span className="truncate flex-1"><strong>Obs:</strong> {orderObservation}</span>
                <button
                  onClick={() => setOrderObservation("")}
                  className="text-[10px] text-rose-500 hover:text-rose-700 font-black cursor-pointer px-1"
                  title="Remover Observação"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Subtotal & Action Button */}
        <div className="p-4 border-t space-y-4">
          {(() => {
            const hasPrep = cart.some(i => i.dish.needs_preparation !== false);
            const hasNonPrep = cart.some(i => i.dish.needs_preparation === false);
            const isMixedCart = hasPrep && hasNonPrep;
            
            if (isMixedCart) {
              return (
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border/40 mb-2">
                  <div className="space-y-0.5 text-left">
                    <Label className="text-xs font-bold text-foreground">Receber tudo junto</Label>
                    <p className="text-[10px] text-muted-foreground leading-normal">
                      Enviar itens sem preparo para a cozinha
                    </p>
                  </div>
                  <Switch
                    checked={receiveAllTogether}
                    onCheckedChange={setReceiveAllTogether}
                  />
                </div>
              );
            }
            return null;
          })()}

          <div className="flex items-center justify-between font-heading font-black">
            <span className="text-sm text-muted-foreground">Valor Total:</span>
            <span className="text-2xl text-primary">
              {(subtotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 font-bold font-heading rounded-xl h-12 flex items-center justify-center gap-2 group transition-all duration-300"
              onClick={handleSendToKitchen}
              disabled={cart.length === 0 || savingOrder}
            >
              <span>🍳 Mandar p/ Cozinha</span>
            </Button>

            <Button
              className="bg-primary hover:bg-primary-hover text-primary-foreground font-black font-heading rounded-xl shadow-lg h-12 flex items-center justify-center gap-2 group transition-all duration-300 hover:scale-[1.02]"
              onClick={openCheckout}
              disabled={cart.length === 0 || savingOrder}
            >
              <Calculator className="h-5 w-5" />
              Cobrar Venda (F2)
            </Button>
          </div>
        </div>
      </Card>

      {/* TABLE DETAILS DIALOG */}
      <Dialog open={tableDetailsModalOpen} onOpenChange={setTableDetailsModalOpen}>
        <DialogContent className="sm:max-w-[550px] rounded-2xl overflow-hidden p-0 border border-border/60 shadow-2xl bg-white dark:bg-zinc-950">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="font-heading font-black text-xl text-foreground flex items-center gap-2">
                  <span>🛋️</span> {selectedTableForDetails?.name}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Resumo do consumo ativo e comandas registradas
                </DialogDescription>
              </div>
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs font-black rounded-lg px-2.5 py-1">
                ⏳ Ocupada
              </Badge>
            </div>
          </DialogHeader>

          {loadingTableDetails ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground mt-2">Carregando consumo da mesa...</span>
            </div>
          ) : tableActiveOrders.length === 0 ? (
            <div className="p-8 flex flex-col items-center justify-center text-center">
              <p className="text-sm font-semibold text-muted-foreground">Nenhum pedido ativo encontrado para esta mesa.</p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => setTableDetailsModalOpen(false)}>
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <div className="p-6 space-y-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
                {tableActiveOrders.map((order, orderIdx) => {
                  const orderDate = new Date(order.created_at).toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <Card key={order.id} className="border border-border/50 bg-muted/10 overflow-hidden rounded-xl">
                      <div className="p-3 bg-muted/20 border-b border-border/30 flex items-center justify-between text-xs">
                        <span className="font-bold text-muted-foreground">Pedido #{orderIdx + 1} - {orderDate}</span>
                        <Badge variant="outline" className="font-semibold rounded-lg bg-background text-[10px] text-primary uppercase">
                          {order.status === "new" ? "Novo" : order.status === "in_preparation" ? "Na Cozinha" : "Pronto"}
                        </Badge>
                      </div>
                      
                      <div className="p-3 divide-y divide-border/20">
                        {(order.order_items || []).map((item: any) => {
                          const itemComplements = (item.selected_complements as any[]) || [];
                          const itemTotal = (item.price_at_time_of_order * item.quantity);

                          return (
                            <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex justify-between gap-4 text-xs font-semibold">
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-foreground">{item.quantity}x {item.dish?.name || "Produto"}</span>
                                {itemComplements.length > 0 && (() => {
                                  const groups: Record<string, any[]> = {};
                                  itemComplements.forEach(c => {
                                    const title = c.group_title || "Complementos";
                                    if (!groups[title]) groups[title] = [];
                                    groups[title].push(c);
                                  });
                                  
                                  return (
                                    <div className="text-[9px] text-muted-foreground/80 font-medium mt-0.5 space-y-0.5">
                                      {Object.entries(groups).map(([title, comps]) => (
                                        <div key={title} className="flex flex-wrap gap-x-1">
                                          <strong className="text-foreground/70">{title}:</strong>
                                          <span>{comps.map(c => c.name).join(", ")}</span>
                                        </div>
                                      ))}
                                    </div>
                                  );
                                })()}
                              </div>
                              <span className="font-bold text-primary text-right">
                                {(itemTotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="p-3 bg-muted/5 border-t border-border/20 flex items-center justify-between text-xs">
                        <span className="font-bold text-muted-foreground">Total do Pedido:</span>
                        <span className="font-heading font-black text-sm text-foreground">
                          {(order.total_price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Accumulator Summary */}
              <div className="px-6 py-4 bg-muted/20 border-t border-b flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Valor Total Acumulado:</span>
                <span className="text-xl font-heading font-black text-primary">
                  {(tableActiveOrders.reduce((sum, o) => sum + (o.total_price || 0), 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>

              <DialogFooter className="p-6 bg-muted/10 gap-2 sm:gap-0">
                <div className="flex flex-wrap w-full gap-2 justify-between">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="font-bold rounded-xl px-4 h-9"
                    onClick={() => handleReleaseTable(selectedTableForDetails?.name, tableActiveOrders)}
                  >
                    Liberar Mesa
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-bold rounded-xl px-4 h-9"
                      onClick={() => {
                        setTableName(selectedTableForDetails.name);
                        setTableDetailsModalOpen(false);
                        setViewMode("grid");
                        toast({
                          title: `Mesa Ativa`,
                          description: `Lançando novos itens para a ${selectedTableForDetails.name}`,
                        });
                      }}
                    >
                      Lançar Mais Itens
                    </Button>
                    
                    <Button
                      variant="default"
                      size="sm"
                      className="font-black font-heading rounded-xl px-4 h-9 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                      onClick={() => handleImportTableConsumption(selectedTableForDetails?.name, tableActiveOrders)}
                    >
                      Fechar Conta (Importar)
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 1. COMPLEMENTS MODAL */}
      <Dialog open={complementsModalOpen} onOpenChange={setComplementsModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-lg">Personalizar Item</DialogTitle>
            <DialogDescription className="text-xs">
              Adicione complementos ao prato {selectedDishForComplements?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {complementGroups.map((group) => (
              <div key={group.id} className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-heading font-bold text-sm text-foreground">{group.title}</h5>
                    {group.description && <p className="text-[10px] text-muted-foreground">{group.description}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {group.required && <Badge className="bg-red-500/10 text-red-600 border-red-500/20 text-[9px] font-bold rounded-lg px-2">Obrigatório</Badge>}
                    <Badge variant="secondary" className="text-[9px] font-semibold rounded-lg px-2">Até {group.max_selections}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {group.complements.map((comp: any) => {
                    const selected = selectedComplementsTemp[group.id] || [];
                    const isSelected = selected.some(s => s.id === comp.id);

                    return (
                      <div
                        key={comp.id}
                        onClick={() => handleComplementSelect(group.id, comp, group.max_selections)}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/5 border-primary/50 text-primary"
                            : "bg-white hover:bg-muted/10 border-border text-muted-foreground"
                        }`}
                      >
                        <span>{comp.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold">
                            {comp.price > 0 ? `+ ${(comp.price / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "Grátis"}
                          </span>
                          <div className={`h-4 w-4 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border bg-white"
                          }`}>
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setComplementsModalOpen(false)}>
              Voltar
            </Button>
            <Button className="bg-primary hover:bg-primary-hover font-bold font-heading rounded-lg" onClick={handleConfirmComplements}>
              Adicionar ao Carrinho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. PAYMENT / CHECKOUT MODAL */}
      <Dialog open={checkoutModalOpen} onOpenChange={setCheckoutModalOpen}>
        <DialogContent className="sm:max-w-[620px] rounded-3xl p-6 md:p-8 border border-border/60 shadow-2xl bg-white dark:bg-zinc-950">
          <DialogHeader className="pb-4">
            <DialogTitle className="font-heading font-black text-xl md:text-2xl text-foreground flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Fechar Pagamento
            </DialogTitle>
          </DialogHeader>

          {/* Prominent Balance Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 gap-2 mb-4">
            <div className="text-sm text-muted-foreground font-semibold">
              Mesa / Comanda: <strong className="text-foreground text-base font-bold">{tableName}</strong>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider block">Total a Pagar</span>
              <span className="text-2xl md:text-3xl font-black text-primary font-heading">
                {(subtotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
            {/* Left side: Payment formulation */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pay-method" className="text-xs md:text-sm font-black text-muted-foreground uppercase tracking-wider">Forma de Pagamento</Label>
                <select
                  id="pay-method"
                  className="w-full h-11 px-3.5 rounded-xl border border-border bg-white dark:bg-zinc-950 font-bold text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200"
                  value={currentPaymentMethod}
                  onChange={(e) => setCurrentPaymentMethod(e.target.value)}
                >
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="pix">PIX</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-amount" className="text-xs md:text-sm font-black text-muted-foreground uppercase tracking-wider">Valor do Lançamento</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">R$</span>
                    <Input
                      id="pay-amount"
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      className="h-11 pl-9 text-base font-black focus-visible:ring-primary rounded-xl"
                      value={currentPaymentAmount}
                      onChange={(e) => setCurrentPaymentAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addPayment();
                        }
                      }}
                    />
                  </div>
                  <Button 
                    type="button" 
                    className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-black hover:bg-primary-hover shadow-md transition-all hover:scale-[1.02]" 
                    onClick={addPayment}
                  >
                    Lançar
                  </Button>
                </div>
              </div>

              {currentPaymentMethod === "cash" && (
                <div className="space-y-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-border/80">
                  <Label htmlFor="cash-received" className="text-xs font-black text-muted-foreground uppercase tracking-wider block">Dinheiro Recebido</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">R$</span>
                    <Input
                      id="cash-received"
                      type="number"
                      step="0.01"
                      className="h-11 pl-9 text-base font-black focus-visible:ring-primary bg-background rounded-xl"
                      placeholder="0,00"
                      value={receivedCashAmount}
                      onChange={(e) => setReceivedCashAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col items-end gap-1 border-t border-dashed pt-3 mt-2">
                    <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Troco Estimado</span>
                    <span className="text-2xl md:text-3xl font-heading font-black text-green-600 dark:text-green-400 bg-green-500/10 dark:bg-green-500/20 px-3 py-1.5 rounded-xl border border-green-500/20 w-full text-right shadow-inner">
                      {(cashChange / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Payments registered */}
            <div className="border rounded-2xl p-4 bg-muted/20 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h5 className="text-xs font-black text-muted-foreground uppercase tracking-wider">Lançamentos efetuados</h5>
                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic py-8 text-center bg-background/50 rounded-xl border border-dashed">Nenhum lançamento efetuado.</p>
                ) : (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {payments.map((pay, index) => (
                      <div key={index} className="flex justify-between items-center text-xs p-2.5 bg-background rounded-xl border border-border/80 shadow-sm">
                        <span className="font-bold text-foreground truncate max-w-[120px]">{getPaymentMethodLabel(pay.method)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-primary">{(pay.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            onClick={() => removePayment(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status summary */}
              <div className="border-t border-border/80 pt-3 space-y-2 bg-background p-3 rounded-xl border shadow-sm">
                <div className="flex justify-between text-xs md:text-sm font-bold text-muted-foreground">
                  <span>Total Geral:</span>
                  <span>{(subtotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm font-extrabold text-green-600">
                  <span>Total Pago:</span>
                  <span>{(totalPaid / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-black border-t border-dashed pt-2 mt-2">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-wider font-black">Saldo Restante</span>
                  <span className={`text-base md:text-lg px-2.5 py-1 rounded-lg ${
                    remainingToPay > 0 
                      ? "text-red-500 bg-red-500/10 border border-red-500/20" 
                      : "text-green-600 bg-green-500/10 border border-green-500/20 font-black animate-pulse"
                  }`}>
                    {remainingToPay > 0 ? (remainingToPay / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "PAGO"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="ghost" className="rounded-xl font-bold h-11 px-6 text-muted-foreground" onClick={() => setCheckoutModalOpen(false)}>
              Voltar
            </Button>
            <Button
              className="bg-primary hover:bg-primary-hover font-black font-heading rounded-xl h-11 px-6 flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02]"
              onClick={handleFinishSale}
              disabled={remainingToPay > 0 || savingOrder}
            >
              {savingOrder ? "Registrando..." : "Confirmar e Finalizar"}
              <Check className="h-5 w-5 stroke-[3]" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1.5 OBSERVATION DIALOG */}
      <Dialog open={observationModalOpen} onOpenChange={setObservationModalOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-6 border border-border/60 shadow-2xl bg-white dark:bg-zinc-950">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="font-heading font-black text-lg text-foreground flex items-center gap-2">
              <span>📝 Observação do Pedido</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Insira detalhes adicionais para a comanda e preparação na cozinha.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label htmlFor="order-obs-textarea" className="text-xs font-bold text-muted-foreground uppercase">Texto da Observação</Label>
            <textarea
              id="order-obs-textarea"
              rows={4}
              className="flex w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/60 resize-none text-foreground font-medium"
              placeholder="Ex: Sem cebola, ponto da carne mal passado, talheres descartáveis..."
              value={orderObservation}
              onChange={(e) => setOrderObservation(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3 mt-1">
            <Button
              variant="ghost"
              className="rounded-xl text-xs font-bold"
              onClick={() => {
                setOrderObservation("");
                setObservationModalOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl text-xs shadow-md"
              onClick={() => setObservationModalOpen(false)}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1.6 ITEM OBSERVATION DIALOG */}
      <Dialog open={itemNotesModalOpen} onOpenChange={setItemNotesModalOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl p-6 border border-border/60 shadow-2xl bg-white dark:bg-zinc-950">
          <DialogHeader className="pb-3 border-b">
            <DialogTitle className="font-heading font-black text-lg text-foreground flex items-center gap-2">
              <span>📝 Observação do Item</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Insira detalhes adicionais para a preparação deste item específico na cozinha.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label htmlFor="item-obs-textarea" className="text-xs font-bold text-muted-foreground uppercase">Texto da Observação</Label>
            <textarea
              id="item-obs-textarea"
              rows={4}
              className="flex w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary placeholder:text-muted-foreground/60 resize-none text-foreground font-medium"
              placeholder="Ex: Sem cebola, ponto ao ponto, molho separado..."
              value={editingCartItemNotes}
              onChange={(e) => setEditingCartItemNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 border-t pt-3 mt-1">
            <Button
              variant="ghost"
              className="rounded-xl text-xs font-bold"
              onClick={() => {
                setEditingCartItemNotes("");
                setItemNotesModalOpen(false);
              }}
            >
              Limpar
            </Button>
            <Button
              className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold rounded-xl text-xs shadow-md"
              onClick={handleSaveItemNotes}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. ORDER SUCCESS / RECEIPT GENERATOR */}
      <Dialog open={successModalOpen} onOpenChange={(open) => {
        setSuccessModalOpen(open);
        if (!open) {
          setCreatedOrder(null);
          setReceiptSnapshot(null);
        }
      }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader className="items-center text-center">
            <div className="p-3 rounded-full bg-green-500/10 text-green-500 mb-2">
              <Check className="h-10 w-10 stroke-[3]" />
            </div>
            <DialogTitle className="font-heading font-black text-xl text-green-700 dark:text-green-500">Venda Concluída!</DialogTitle>
            <DialogDescription className="text-xs max-w-[280px]">
              O pedido foi salvo e registrado com sucesso no fluxo do caixa atual.
            </DialogDescription>
          </DialogHeader>

          {/* Receipt template to view / print */}
          <div className="border border-border/80 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900/60 font-mono text-[11px] space-y-4 max-h-[250px] overflow-y-auto scrollbar-thin">
            <div ref={printAreaRef} className="space-y-4">
              <div className="text-center space-y-1">
                <h4 className="font-bold text-xs uppercase tracking-wide">{restaurantName}</h4>
                <p className="text-[9px] text-muted-foreground">Comprovante de Venda</p>
                <p className="text-[8px] text-muted-foreground">ID: {createdOrder?.id.substring(0, 8)}...</p>
              </div>

              <div className="border-t border-dashed my-2" />

              <div className="space-y-1 text-[10px]">
                <p>Data: {new Date(createdOrder?.created_at || Date.now()).toLocaleString("pt-BR")}</p>
                <p>Mesa/Comanda: {receiptSnapshot?.tableName || tableName}</p>
                {(receiptSnapshot?.customerName || customerName) && <p>Cliente: {receiptSnapshot?.customerName || customerName}</p>}
              </div>

              <div className="border-t border-dashed my-2" />

              {/* Items detail list */}
              <div className="space-y-2">
                <div className="flex justify-between font-bold text-[10px] text-muted-foreground uppercase">
                  <span>Item</span>
                  <div className="flex gap-4">
                    <span>Qtd</span>
                    <span>Total</span>
                  </div>
                </div>
                
                {(receiptSnapshot?.items || cart).map((item, index) => {
                  const dishPrice = item.dish.price || 0;
                  const compsPrice = item.selected_complements.reduce((sum, c) => sum + (c.price || 0), 0);
                  const unitTotal = dishPrice + compsPrice;
                  
                  return (
                    <div key={index} className="space-y-0.5 text-[10px]">
                      <div className="flex justify-between">
                        <span className="truncate max-w-[150px]">{item.dish.name}</span>
                        <div className="flex gap-4">
                          <span>{item.quantity}</span>
                          <span>{((unitTotal * item.quantity) / 100).toFixed(2)}</span>
                        </div>
                      </div>
                      {item.selected_complements.length > 0 && (() => {
                        const groups: Record<string, typeof item.selected_complements> = {};
                        item.selected_complements.forEach(c => {
                          const title = c.group_title || "Complementos";
                          if (!groups[title]) groups[title] = [];
                          groups[title].push(c);
                        });
                        
                        return (
                          <div className="text-[8px] text-muted-foreground ml-1 font-semibold space-y-0.5">
                            {Object.entries(groups).map(([title, comps]) => (
                              <div key={title} className="flex flex-wrap gap-x-1">
                                <strong className="text-foreground/75">{title}:</strong>
                                <span>{comps.map(c => c.name).join(", ")}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-dashed my-2" />

              <div className="space-y-1 text-right font-bold text-[10px]">
                <p>SUBTOTAL: R$ {((receiptSnapshot?.subtotal || subtotal) / 100).toFixed(2)}</p>
                <p className="text-primary font-black text-xs mt-1">TOTAL PAGO: R$ {((receiptSnapshot?.subtotal || subtotal) / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-3 mt-2 sm:justify-start">
            <Button
              variant="outline"
              className="border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary font-bold font-heading rounded-lg h-10"
              onClick={printReceipt}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button
              className="bg-primary hover:bg-primary-hover font-bold font-heading rounded-lg h-10"
              onClick={() => {
                setSuccessModalOpen(false);
                setCreatedOrder(null);
                setReceiptSnapshot(null);
              }}
            >
              Nova Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
