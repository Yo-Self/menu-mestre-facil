import { useLocation, useNavigate } from "react-router-dom";
import { NavLink } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import {
  Store,
  Menu,
  UtensilsCrossed,
  FolderOpen,
  Home,
  Settings,
  Download,
  Plus,
  Calculator,
  ClipboardList,
  BarChart2,
  Boxes,
} from "lucide-react";


import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Restaurant {
  id: string;
  name: string;
}

const staticMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Restaurantes", url: "/dashboard/restaurants", icon: Store },
  { title: "Menus", url: "/dashboard/menus", icon: Menu },
  { title: "Categorias", url: "/dashboard/categories", icon: FolderOpen },
  { title: "Pratos", url: "/dashboard/dishes", icon: UtensilsCrossed },
  { title: "Complementos", url: "/dashboard/complements", icon: Plus },
  { title: "PDV", url: "/dashboard/pos", icon: Calculator },
  // "Pedidos" is injected dynamically below
  { title: "Relatórios", url: "/dashboard/reports", icon: BarChart2 },
  { title: "Estoque", url: "/dashboard/stock", icon: Boxes },
  { title: "Ajustes", url: "/dashboard/settings", icon: Settings },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUserRestaurants = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      setRestaurants(data || []);
    };

    fetchUserRestaurants();
  }, []);

  const handleOrdersClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (restaurants.length === 0) {
      navigate("/dashboard/restaurants");
    } else if (restaurants.length === 1) {
      navigate(`/orders/${restaurants[0].id}`);
    } else {
      setSelectorOpen(true);
    }
  };

  const isActive = (path: string) =>
    currentPath === path || currentPath.startsWith(path + "/");

  const isOrdersActive = currentPath.startsWith("/orders/");

  const menuItems = [
    ...staticMenuItems.slice(0, 7),
    { title: "Pedidos", url: "/orders", icon: ClipboardList, isOrders: true },
    ...staticMenuItems.slice(7),
  ];

  // Handle horizontal scroll with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (scrollContainerRef.current) {
      if (e.deltaY !== 0) {
        scrollContainerRef.current.scrollLeft += e.deltaY;
      }
    }
  };

  return (
    <>
      <div className="flex-1 overflow-hidden relative mx-4 pt-2">
        <div 
          ref={scrollContainerRef}
          onWheel={handleWheel}
          className="flex gap-1 overflow-x-auto hide-scrollbar h-full items-end"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}} />
          
          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const active = (item as any).isOrders
              ? isOrdersActive
              : isActive(item.url);

            const baseClasses = "group relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all duration-200 select-none whitespace-nowrap min-w-max border-t border-x rounded-t-xl shrink-0";
            
            const activeClasses = active 
              ? "bg-background text-primary border-border z-10 before:absolute before:-bottom-[1px] before:left-0 before:right-0 before:h-[2px] before:bg-background"
              : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground z-0 border-b-border border-b";

            if ((item as any).isOrders) {
              return (
                <button
                  key={item.title}
                  onClick={handleOrdersClick}
                  className={`${baseClasses} ${activeClasses}`}
                  title={item.title}
                >
                  <IconComponent className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                  <span className="font-heading">{item.title}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.title}
                to={item.url}
                className={`${baseClasses} ${activeClasses}`}
                title={item.title}
              >
                <IconComponent className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                <span className="font-heading">{item.title}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      <Dialog open={selectorOpen} onOpenChange={setSelectorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">
              Selecionar Restaurante
            </DialogTitle>
            <DialogDescription>
              Escolha qual restaurante deseja gerenciar os pedidos.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-2">
            {restaurants.map((r) => (
              <Button
                key={r.id}
                variant="outline"
                className="justify-start h-12 text-left font-heading font-semibold rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200"
                onClick={() => {
                  setSelectorOpen(false);
                  navigate(`/orders/${r.id}`);
                }}
              >
                <Store className="h-4 w-4 mr-3 text-primary/70" />
                {r.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
