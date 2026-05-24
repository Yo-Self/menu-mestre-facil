import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  }[];
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
  const [tableName, setTableName] = useState("Balcão");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

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
  const [restaurantName, setRestaurantName] = useState("Menu Mestre Fácil");
  const [receiptSnapshot, setReceiptSnapshot] = useState<{
    items: CartItem[];
    subtotal: number;
    tableName: string;
    customerName: string;
  } | null>(null);

  const [viewMode, setViewMode] = useState<"grid" | "tables">("grid");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [tablesList, setTablesList] = useState<any[]>([
    { name: "Balcão", status: "free" },
    { name: "Mesa 01", status: "busy" },
    { name: "Mesa 02", status: "free" },
    { name: "Mesa 03", status: "busy" },
    { name: "Mesa 04", status: "free" },
    { name: "Mesa 05", status: "free" },
    { name: "Mesa 06", status: "free" },
    { name: "Mesa 07", status: "busy" },
    { name: "Mesa 08", status: "free" },
    { name: "Mesa 09", status: "free" },
    { name: "Mesa 10", status: "free" }
  ]);

  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentRestaurantId) {
      navigate("/dashboard/pos");
      return;
    }
    verifySessionAndLoadData();
  }, [currentRestaurantId]);

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
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [cart, payments, tableName, customerName]);

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
        .select("name")
        .eq("id", currentRestaurantId!)
        .single();

      if (!restErr && rest) {
        setRestaurantName(rest.name);
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
          complement_group:complement_groups (
            id,
            title,
            description,
            required,
            max_selections
          )
        `)
        .eq("dish_id", dishId);

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

    const flatComplements = Object.values(selectedComplementsTemp).flatMap(arr => 
      arr.map(c => ({
        complement_id: c.id,
        name: c.name,
        price: c.price,
      }))
    );

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

    if (isNaN(amountInCents) || amountInCents <= 0 || amountInCents > remaining) {
      toast({
        title: "Valor inválido",
        description: `O valor deve ser maior que zero e menor ou igual a R$ ${(remaining / 100).toFixed(2)}`,
        variant: "destructive",
      });
      return;
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
        selected_complements: item.selected_complements.length > 0 ? item.selected_complements : null
      }));

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
          created_at: new Date().toISOString()
        });
        localStorage.setItem("pos_offline_orders", JSON.stringify(offlineQueue));

        toast({
          title: "Venda Salva Offline!",
          description: "O caixa está offline. O pedido foi guardado localmente e será sincronizado depois.",
        });

        setCreatedOrder({
          id: `OFF-${Date.now()}`,
          created_at: new Date().toISOString()
        });
        setReceiptSnapshot({
          items: [...cart],
          subtotal: subtotal,
          tableName: tableName,
          customerName: customerName
        });
        setCheckoutModalOpen(false);
        setSuccessModalOpen(true);
        setCart([]);
        setTableName("Balcão");
        setCustomerName("");
        setCustomerPhone("");
        setPayments([]);
        return;
      }

      const finalOrder = await createPOSOrder(
        currentRestaurantId!,
        activeSession.id,
        tableName,
        customerName || null,
        customerPhone || null,
        orderItemsInput,
        payments
      );

      setCreatedOrder(finalOrder);
      setReceiptSnapshot({
        items: [...cart],
        subtotal: subtotal,
        tableName: tableName,
        customerName: customerName
      });
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

  const printReceipt = () => {
    if (!createdOrder) return;
    
    const items = receiptSnapshot?.items || cart;
    const subtotalVal = receiptSnapshot?.subtotal || getCartSubtotal();
    const orderId = createdOrder?.id || "";
    const formattedDate = new Date(createdOrder?.created_at || Date.now()).toLocaleString("pt-BR");
    const tblName = receiptSnapshot?.tableName || tableName;
    const custName = receiptSnapshot?.customerName || customerName;

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
        compsText = `<div style="font-size: 9px; color: #555; padding-left: 5px; font-style: italic;">+ ${item.selected_complements.map((c: any) => c.name).join(", ")}</div>`;
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
        </div>
      `;
    }).join("");

    const customerHtml = custName ? `<p style="margin: 2px 0;">Cliente: ${custName}</p>` : "";

    iframeDoc.open();
    iframeDoc.write(`
      <html>
        <head>
          <title>Comprovante - ${restaurantName}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body { 
              background: white; 
              color: black;
              padding: 6mm 4mm;
              margin: 0;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: 72mm; /* 80mm - 8mm padding */
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
            <h3 style="margin: 0 0 4px 0; font-size: 14px; text-transform: uppercase;">${restaurantName}</h3>
            <p style="margin: 0 0 2px 0; font-size: 10px; font-weight: bold;">Comprovante de Venda</p>
            <p style="margin: 0; font-size: 9px; color: #555;">ID: ${orderId.substring(0, 8)}...</p>
          </div>

          <div class="border-t-dashed my-2"></div>

          <div style="font-size: 11px; line-height: 1.4;">
            <p style="margin: 2px 0;">Data: ${formattedDate}</p>
            <p style="margin: 2px 0;">Mesa/Comanda: ${tblName}</p>
            ${customerHtml}
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
            <p style="margin: 2px 0 0 0;">Menu Mestre Fácil</p>
          </div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // Trigger print
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }, 250);
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
    <div className="flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-8.5rem)]">
      {/* LEFT COLUMN: PRODUCTS GRID & CATEGORIES */}
      <div className="flex-1 space-y-6 flex flex-col">
        {/* Header Terminal */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/pos")} className="hover:bg-primary/10 transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-2xl font-black font-heading text-primary">Terminal de Vendas</h2>
          </div>

          <Button
            variant={viewMode === "tables" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode(prev => prev === "grid" ? "tables" : "grid")}
            className="rounded-xl font-bold text-xs h-9 transition-all duration-300 gap-1.5 flex items-center shrink-0 border border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
          >
            <span>{viewMode === "tables" ? "Menu de Pratos 🍔" : "Mapa de Mesas 🗺️"}</span>
          </Button>
          
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

        {/* Products Grid / Table Map Branch */}
        {viewMode === "tables" ? (
          <div className="flex-1 overflow-y-auto max-h-[500px] xl:max-h-[calc(100vh-21rem)] pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4">
              {tablesList.map((table) => {
                const isTableBusy = table.status === "busy";
                const isCurrentTable = tableName === table.name;
                
                return (
                  <Card
                    key={table.name}
                    className={`cursor-pointer border-2 transition-all duration-300 flex flex-col items-center justify-center p-6 text-center rounded-2xl relative overflow-hidden h-32 hover:-translate-y-1 hover:shadow-lg ${
                      isCurrentTable
                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                        : isTableBusy
                        ? "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                        : "border-border/50 bg-white/40 dark:bg-zinc-900/40 hover:border-emerald-500/40"
                    }`}
                    onClick={() => {
                      setTableName(table.name);
                      setViewMode("grid");
                      toast({
                        title: `Comanda Selecionada`,
                        description: `Você está lançando para: ${table.name}`,
                      });
                    }}
                  >
                    <div className="absolute top-2 right-2">
                      <span className={`h-2.5 w-2.5 rounded-full inline-block ${isTableBusy ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    </div>
                    
                    <h3 className="font-heading font-black text-lg text-foreground mb-1">{table.name}</h3>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isTableBusy ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {isTableBusy ? 'Ocupada / Consumindo' : 'Livre'}
                    </p>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : filteredDishes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 text-center">
            <Tags className="h-12 w-12 text-muted-foreground/60 mb-2" />
            <p className="font-heading font-semibold text-muted-foreground">Nenhum produto disponível.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Crie categorias e pratos no menu de gestão do painel.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[500px] xl:max-h-[calc(100vh-21rem)] pr-1">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4">
              {filteredDishes.map((dish) => {
                const isOutOfStock = dish.stock_quantity !== null && dish.stock_quantity <= 0;
                
                return (
                  <Card
                    key={dish.id}
                    className={`cursor-pointer hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden flex flex-col border border-border/50 bg-white/40 dark:bg-zinc-900/40 relative group ${isOutOfStock ? 'opacity-50 cursor-not-allowed hover:translate-y-0 hover:shadow-none' : ''}`}
                    onClick={() => !isOutOfStock && handleProductClick(dish)}
                  >
                    {dish.stock_quantity !== null && (
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
      <Card className="w-full xl:w-[420px] shadow-lg border border-border/60 bg-white dark:bg-zinc-950 flex flex-col h-[calc(100vh-8.5rem)]">
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
                    {item.selected_complements.length > 0 && (
                      <p className="text-[10px] text-muted-foreground/90 mt-0.5 max-w-[200px] leading-tight">
                        + {item.selected_complements.map(c => c.name).join(", ")}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2.5">
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
          </div>
        </div>

        {/* Subtotal & Action Button */}
        <div className="p-4 border-t space-y-4">
          <div className="flex items-center justify-between font-heading font-black">
            <span className="text-sm text-muted-foreground">Valor Total:</span>
            <span className="text-2xl text-primary">
              {(subtotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary-hover text-primary-foreground font-black font-heading rounded-xl shadow-lg h-12 flex items-center justify-center gap-2 group transition-all duration-300 hover:scale-[1.02]"
            onClick={openCheckout}
            disabled={cart.length === 0}
          >
            <Calculator className="h-5 w-5" />
            Finalizar Venda (F2)
          </Button>
        </div>
      </Card>

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-lg flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Fechar Pagamento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mesa/Comanda: <strong>{tableName}</strong> | Total a Pagar: R$ {(subtotal / 100).toFixed(2)}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            {/* Left side: Payment formulation */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pay-method" className="text-xs font-bold text-muted-foreground uppercase">Forma de Pagamento</Label>
                <select
                  id="pay-method"
                  className="w-full h-9 px-3 rounded-lg border border-border bg-white dark:bg-zinc-950 font-medium text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all duration-200"
                  value={currentPaymentMethod}
                  onChange={(e) => setCurrentPaymentMethod(e.target.value)}
                >
                  <option value="cash">Dinheiro</option>
                  <option value="credit_card">Cartão de Crédito</option>
                  <option value="debit_card">Cartão de Débito</option>
                  <option value="pix">PIX</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pay-amount" className="text-xs font-bold text-muted-foreground uppercase">Valor do Lançamento (R$)</Label>
                <div className="flex gap-2">
                  <Input
                    id="pay-amount"
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    className="h-9 text-xs focus-visible:ring-primary"
                    value={currentPaymentAmount}
                    onChange={(e) => setCurrentPaymentAmount(e.target.value)}
                  />
                  <Button type="button" size="sm" className="h-9 px-3 rounded-lg bg-primary font-bold" onClick={addPayment}>
                    Lançar
                  </Button>
                </div>
              </div>

              {currentPaymentMethod === "cash" && (
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border space-y-2">
                  <Label htmlFor="cash-received" className="text-[10px] font-bold text-muted-foreground uppercase">Dinheiro Recebido (R$)</Label>
                  <Input
                    id="cash-received"
                    type="number"
                    step="0.01"
                    className="h-8 text-xs focus-visible:ring-primary bg-background"
                    value={receivedCashAmount}
                    onChange={(e) => setReceivedCashAmount(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-xs font-bold mt-1">
                    <span className="text-muted-foreground">Troco Estimado:</span>
                    <span className="text-primary font-heading font-black text-sm">
                      {(cashChange / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right side: Payments registered */}
            <div className="border rounded-xl p-3 bg-muted/10 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lançamentos efetuados</h5>
                {payments.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60 italic py-6 text-center">Nenhum lançamento efetuado.</p>
                ) : (
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                    {payments.map((pay, index) => (
                      <div key={index} className="flex justify-between items-center text-[11px] p-2 bg-background rounded-lg border">
                        <span className="font-semibold text-foreground truncate max-w-[100px]">{getPaymentMethodLabel(pay.method)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{(pay.amount / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                            onClick={() => removePayment(index)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status summary */}
              <div className="border-t pt-2 space-y-1 bg-background p-2 rounded-lg">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-muted-foreground">Total:</span>
                  <span>{(subtotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-green-600">
                  <span>Pago:</span>
                  <span>{(totalPaid / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                </div>
                <div className="flex justify-between text-xs font-black text-red-500 border-t pt-1 mt-1">
                  <span>Restante:</span>
                  <span>{remainingToPay > 0 ? (remainingToPay / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "PAGO"}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setCheckoutModalOpen(false)}>
              Voltar
            </Button>
            <Button
              className="bg-primary hover:bg-primary-hover font-bold font-heading rounded-lg h-10 px-5 flex items-center justify-center gap-1.5"
              onClick={handleFinishSale}
              disabled={remainingToPay > 0 || savingOrder}
            >
              {savingOrder ? "Registrando..." : "Confirmar e Finalizar"}
              <Check className="h-4 w-4 stroke-[3]" />
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
                      {item.selected_complements.length > 0 && (
                        <p className="text-[8px] text-muted-foreground ml-1">
                          + {item.selected_complements.map(c => c.name).join(", ")}
                        </p>
                      )}
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
