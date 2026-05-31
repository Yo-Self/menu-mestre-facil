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
  ArrowLeft,
  Check,
  Tags,
  RefreshCw,
  User,
  LogOut,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getCurrentPOSSession,
  createPOSOrder,
  POSSession,
  POSOrderItemInput,
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

export default function POSWaiterTerminal() {
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

  // Complements dialog state
  const [complementsModalOpen, setComplementsModalOpen] = useState(false);
  const [selectedDishForComplements, setSelectedDishForComplements] = useState<any>(null);
  const [complementGroups, setComplementGroups] = useState<any[]>([]);
  const [selectedComplementsTemp, setSelectedComplementsTemp] = useState<{[groupId: string]: any[]}>({});

  const [savingOrder, setSavingOrder] = useState(false);
  const [viewMode, setViewMode] = useState<"tables" | "grid">("tables");
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

  // States for Table Details Dialog
  const [selectedTableForDetails, setSelectedTableForDetails] = useState<any>(null);
  const [tableDetailsModalOpen, setTableDetailsModalOpen] = useState(false);
  const [tableActiveOrders, setTableActiveOrders] = useState<any[]>([]);
  const [loadingTableDetails, setLoadingTableDetails] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);

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

  const verifySessionAndLoadData = async () => {
    setLoading(true);
    try {
      const session = await getCurrentPOSSession(currentRestaurantId!);
      if (!session) {
        toast({
          title: "Caixa Fechado",
          description: "O gerente precisa abrir o caixa para que seja possível lançar pedidos de mesas.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      setActiveSession(session);
      await loadPOSData();
    } catch (err) {
      console.error(err);
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadPOSData = async () => {
    try {
      // 0. Fetch restaurant details
      const { data: rest, error: restErr } = await supabase
        .from("restaurants")
        .select("name, has_tables, tables_count, table_categories")
        .eq("id", currentRestaurantId!)
        .single();

      if (!restErr && rest) {
        const hasTbls = rest.has_tables ?? true;
        if (hasTbls) {
          const count = rest.tables_count ?? 12;
          const categoriesRaw = rest.table_categories || "Balcão, Salão Principal, Varanda";
          const categoriesList = categoriesRaw.split(",").map(c => c.trim()).filter(Boolean);
          
          const newTablesConfig: any[] = [];
          
          const hasBalcaoZone = categoriesList.some(c => c.toLowerCase() === "balcão");
          if (hasBalcaoZone) {
            newTablesConfig.push({ name: "Balcão", zone: "Balcão" });
          }
          
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
            for (let i = 1; i <= count; i++) {
              newTablesConfig.push({
                name: `Mesa ${String(i).padStart(2, "0")}`,
                zone: "Salão Principal"
              });
            }
          }
          setTablesConfig(newTablesConfig);
        } else {
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
      console.error("Erro ao carregar dados do PDV Garçom:", err);
      toast({
        title: "Erro",
        description: "Falha ao carregar cardápio e mesas.",
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
    const groups = await getComplementsForDish(dish.id);
    
    if (groups && groups.length > 0) {
      setSelectedDishForComplements(dish);
      setComplementGroups(groups);
      
      const initial: {[key: string]: any[]} = {};
      groups.forEach(g => {
        initial[g.id] = [];
      });
      setSelectedComplementsTemp(initial);
      
      setComplementsModalOpen(true);
    } else {
      addToCart(dish, []);
    }
  };

  const handleComplementSelect = (groupId: string, comp: any, maxSelections: number) => {
    setSelectedComplementsTemp(prev => {
      const selected = prev[groupId] || [];
      const exists = selected.find(s => s.id === comp.id);
      
      let newSelected = [];
      if (exists) {
        newSelected = selected.filter(s => s.id !== comp.id);
      } else {
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
  };

  const addToCart = (dish: any, complements: any[]) => {
    const cartId = `${Date.now()}-${dish.id}`;
    const newItem: CartItem = {
      id: cartId,
      dish,
      quantity: 1,
      selected_complements: complements,
    };
    
    setCart(prev => [...prev, newItem]);
    
    toast({
      title: "Adicionado!",
      description: `${dish.name} adicionado à comanda de ${tableName}.`,
    });
  };

  const updateQuantity = (cartId: string, val: number) => {
    setCart(prev => 
      prev.map(item => {
        if (item.id === cartId) {
          const nextQ = item.quantity + val;
          return { ...item, quantity: Math.max(1, nextQ) };
        }
        return item;
      })
    );
  };

  const removeFromCart = (cartId: string) => {
    setCart(prev => prev.filter(i => i.id !== cartId));
  };

  const getCartSubtotal = () => {
    return cart.reduce((total, item) => {
      const dishPrice = item.dish.price || 0;
      const complementsPrice = item.selected_complements.reduce((sum, c) => sum + (c.price || 0), 0);
      return total + (dishPrice + complementsPrice) * item.quantity;
    }, 0);
  };

  const getTableStatus = (tableNameToCheck: string) => {
    const tableOrds = activeOrders.filter(
      o => o.table_name === tableNameToCheck && ["new", "in_preparation", "ready"].includes(o.status)
    );
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
      if (ordersToImport.length === 0) return;
      
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
      setTableDetailsModalOpen(false);
      setViewMode("grid");

      toast({
        title: "Consumo Carregado",
        description: `Importamos os itens da ${tableNameToImport} para edição e novos lançamentos no carrinho.`,
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
    
    if (!window.confirm(`Tem certeza que deseja liberar a ${tableNameToRelease} manualmente?\nIsso finalizará todos os pedidos ativos dela.`)) {
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
        description: `A ${tableNameToRelease} foi liberada.`,
      });

      setTableDetailsModalOpen(false);
      await loadPOSData();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Erro ao liberar mesa",
        description: err.message || "Ocorreu um erro ao liberar a mesa.",
        variant: "destructive"
      });
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

      await createPOSOrder(
        currentRestaurantId!,
        activeSession.id,
        tableName,
        customerName || null,
        customerPhone || null,
        orderItemsInput,
        [], // empty payments -> sets status: "new"
        null,
        false,
        null,
        receiveAllTogether
      );

      toast({
        title: "Pedido Enviado!",
        description: `Os itens foram enviados para a cozinha na ${tableName}.`,
      });

      setCart([]);
      setCustomerName("");
      setCustomerPhone("");

      // Reload active orders to update table occupancy dynamically
      await loadPOSData();
      setViewMode("tables");
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
        <div className="flex-1 overflow-y-auto max-h-[500px] xl:max-h-[calc(100vh-21rem)] pr-1 space-y-6">
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
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4">
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
        <span className="ml-2 text-sm text-muted-foreground">Iniciando terminal de garçom...</span>
      </div>
    );
  }

  const handleLogout = async () => {
    if (window.confirm("Deseja realmente sair da sua conta?")) {
      await supabase.auth.signOut();
      navigate("/auth");
    }
  };

  const renderComandaContent = (isMobile = false) => {
    return (
      <div className="flex flex-col h-full min-h-0 bg-background text-foreground">
        {/* Top Header of Comanda if needed */}
        {!isMobile && (
          <CardHeader className="pb-3 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold font-heading flex items-center gap-2 text-foreground">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Comanda Atual
              </CardTitle>
              <Badge variant="outline" className="font-bold rounded-lg border-primary/20 bg-primary/5 text-primary px-2 py-0.5">
                {cart.reduce((sum, i) => sum + i.quantity, 0)} itens
              </Badge>
            </div>
          </CardHeader>
        )}

        {/* Cart items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 scrollbar-thin">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingCart className="h-12 w-12 text-muted-foreground/60 mb-2 animate-pulse" />
              <p className="font-heading font-semibold text-muted-foreground text-sm">Comanda vazia.</p>
              <p className="text-xs text-muted-foreground/80 mt-1">Escolha uma mesa e adicione pratos.</p>
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

        {/* Table Selector block */}
        <div className="p-4 border-t space-y-3 bg-muted/10 flex-shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor={isMobile ? "mobile-table" : "table"} className="text-[10px] font-bold text-muted-foreground uppercase">Mesa Selecionada</Label>
              <select
                id={isMobile ? "mobile-table" : "table"}
                className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-black shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus:border-primary focus:ring-primary focus-visible:ring-primary cursor-pointer text-foreground"
                value={tableName}
                onChange={(e) => {
                  setTableName(e.target.value);
                  toast({
                    title: `Mesa Selecionada`,
                    description: `Você está lançando itens para: ${e.target.value}`,
                  });
                }}
              >
                {tablesConfig.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.zone})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Subtotal & Preparation Dispatch */}
        <div className="p-4 pb-8 xl:pb-4 border-t space-y-4 flex-shrink-0">
          {(() => {
            const hasPrep = cart.some(i => i.dish.needs_preparation !== false);
            const hasNonPrep = cart.some(i => i.dish.needs_preparation === false);
            const isMixedCart = hasPrep && hasNonPrep;
            
            if (isMixedCart) {
              return (
                <div className="flex items-center justify-between p-2.5 bg-muted/40 rounded-xl mb-3 border border-border/40">
                  <div className="space-y-0.5 text-left">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Receber tudo junto</Label>
                    <p className="text-[9px] text-muted-foreground leading-normal">Mandar bebidas/itens sem preparo para a cozinha</p>
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
            <span className="text-sm text-muted-foreground">Subtotal Lançamento:</span>
            <span className="text-2xl text-primary">
              {(subtotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>

          <Button
            className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-black font-heading rounded-xl shadow-lg h-12 flex items-center justify-center gap-2 group transition-all duration-300 hover:scale-[1.02]"
            onClick={async () => {
              await handleSendToKitchen();
              if (isMobile) {
                setMobileCartOpen(false);
              }
            }}
            disabled={cart.length === 0 || savingOrder}
          >
            <span>🍳 Lançar e Mandar p/ Cozinha</span>
          </Button>
        </div>
      </div>
    );
  };

  const subtotal = getCartSubtotal();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col antialiased">
      {/* Premium Standalone Waiter Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-border/40 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-heading font-black text-xl shadow-inner">
            🧑‍🍳
          </div>
          <div>
            <h1 className="font-heading font-black text-sm md:text-base text-foreground tracking-tight leading-none">
              Gestor Menu
            </h1>
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
              Terminal do Garçom
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Operação Ativa
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.close()} 
            className="text-xs font-bold text-muted-foreground hover:text-foreground gap-1.5 border border-border/40 rounded-xl px-3.5 h-9 bg-background"
            title="Fechar Janela"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Sair / Fechar
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleLogout} 
            className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full h-9 w-9 text-muted-foreground"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Main Full-Screen Layout Wrapper */}
      <main className="flex-1 p-6 pb-24 xl:pb-6 max-w-[1600px] w-full mx-auto flex flex-col justify-stretch">
        <div className="flex flex-col xl:flex-row gap-6 min-h-[calc(100vh-10rem)]">
          {/* LEFT COLUMN: PRODUCTS GRID & CATEGORIES */}
          <div className="flex-1 space-y-6 flex flex-col">
            {/* Header Terminal */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-3.5">
              <div className="flex-1 flex flex-col justify-start">
                <h2 className="text-2xl font-black font-heading text-primary leading-none">Atendimento de Garçom</h2>
                {viewMode === "grid" && (
                  <p className="text-xs text-muted-foreground font-semibold mt-1.5 flex items-center gap-1.5">
                    Mesa selecionada:{" "}
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-black bg-primary/10 text-primary border border-primary/20">
                      🛋️ {tableName}
                    </span>
                  </p>
                )}
              </div>
              
              <div className="hidden sm:flex items-center gap-3 bg-muted/50 px-3 py-1.5 rounded-lg border border-border/40 text-xs font-semibold h-fit">
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  Modo Garçom
                </div>
                <span className="text-muted-foreground">|</span>
                <div className="text-muted-foreground">
                  Operador: Garçom
                </div>
              </div>
            </div>

        {/* Tab Segmented Control */}
        <div className="flex bg-muted/60 p-1 rounded-xl w-fit border border-border/40 gap-1">
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
            🗺️ Salão / Mesas
          </Button>
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
            🍔 Adicionar Itens
          </Button>
        </div>

        {viewMode === "grid" && (
          <>
            {/* Filter Toolbar */}
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

            {/* Category Filter */}
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

        {/* Dynamic Branch */}
        {viewMode === "tables" ? (
          renderTableMap()
        ) : filteredDishes.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-12 text-center">
            <Tags className="h-12 w-12 text-muted-foreground/60 mb-2" />
            <p className="font-heading font-semibold text-muted-foreground">Nenhum produto disponível.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Nenhum produto cadastrado nesta categoria.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto max-h-[500px] xl:max-h-[calc(100vh-21rem)] pr-1">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-4">
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

      {/* RIGHT COLUMN: CART SIDEBAR (DESKTOP) */}
      <Card className="hidden xl:flex w-full xl:w-[420px] shadow-lg border border-border/60 bg-white dark:bg-zinc-950 flex-col h-[calc(100vh-8.5rem)] overflow-hidden">
        {renderComandaContent(false)}
      </Card>

      {/* FLOATING MOBILE BOTTOM BAR & DRAWER (MOBILE ONLY: xl:hidden) */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-border/40 p-4 shadow-[0_-8px_30px_rgb(0,0,0,0.06)] flex items-center justify-between pb-6">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Comanda: {tableName}</span>
          <span className="text-lg font-black text-primary font-heading">
            {(subtotal / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>

        <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
          <SheetTrigger asChild>
            <Button className="bg-primary hover:bg-primary/95 text-primary-foreground font-black font-heading rounded-xl px-5 h-11 flex items-center gap-2 shadow-md">
              <ShoppingCart className="h-4 w-4" />
              <span>Ver Comanda ({cart.reduce((sum, i) => sum + i.quantity, 0)})</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0 border-t border-border/60 rounded-t-3xl bg-white dark:bg-zinc-950 overflow-hidden">
            <SheetHeader className="p-4 border-b flex-shrink-0">
              <SheetTitle className="text-lg font-bold font-heading flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Comanda Atual (Mesa: {tableName})
              </SheetTitle>
              <SheetDescription className="text-xs">
                Visualize os itens adicionados e lance o pedido para a cozinha.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderComandaContent(true)}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* COMPLEMENTS MODAL */}
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
            <Button variant="outline" size="sm" onClick={() => setComplementsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="default" size="sm" onClick={handleConfirmComplements} className="bg-primary text-primary-foreground">
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                  Resumo do consumo ativo registrado
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
                          const complementsSum = itemComplements.reduce((sum: number, c: any) => sum + (c.price || 0), 0);
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
                          title: `Mesa Selecionada`,
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
                      Editar / Adicionar
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      </div>
      </main>
    </div>
  );
}
