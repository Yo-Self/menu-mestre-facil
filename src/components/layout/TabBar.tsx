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
  Printer,
  ChevronDown,
  DollarSign,
  Truck,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Restaurant {
  id: string;
  name: string;
}

function ResponsiveTitle({ title }: { title: string }) {
  if (title === "PDV/Caixa") {
    return (
      <span className="font-heading">
        <span className="inline lg:hidden">PDV</span>
        <span className="hidden lg:inline">PDV/Caixa</span>
      </span>
    );
  }
  if (title === "Menu Físico") {
    return (
      <span className="font-heading">
        <span className="inline lg:hidden">M. Físico</span>
        <span className="hidden lg:inline">Menu Físico</span>
      </span>
    );
  }
  if (title === "Restaurantes") {
    return (
      <span className="font-heading">
        <span className="inline lg:hidden">Lojas</span>
        <span className="hidden lg:inline">Restaurantes</span>
      </span>
    );
  }
  return <span className="font-heading">{title}</span>;
}

const staticMenuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Restaurantes", url: "/dashboard/restaurants", icon: Store },
  { title: "Cardápio", url: "/dashboard/menus", icon: Menu, isCardapio: true },
  { title: "PDV/Caixa", url: "/dashboard/pos", icon: Calculator },
  // "Pedidos" is injected dynamically below
  { title: "Entrega", url: "/dashboard/delivery", icon: Truck },
  { title: "Menu Físico", url: "/dashboard/physical-menu", icon: Printer },
  { title: "Relatórios", url: "/dashboard/reports", icon: BarChart2 },
  { title: "Estoque", url: "/dashboard/stock", icon: Boxes },
  { title: "Financeiro", url: "/dashboard/financial", icon: DollarSign },
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

  const isCardapioActive =
    currentPath.startsWith("/dashboard/menus") ||
    currentPath.startsWith("/dashboard/categories") ||
    currentPath.startsWith("/dashboard/dishes") ||
    currentPath.startsWith("/dashboard/complements");

  const menuItems = [
    ...staticMenuItems.slice(0, 4),
    { title: "Pedidos", url: "/orders", icon: ClipboardList, isOrders: true },
    ...staticMenuItems.slice(4),
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
      <div className="flex-1 w-full overflow-visible relative mx-2 sm:mx-4 py-1">
        <div
          ref={scrollContainerRef}
          onWheel={handleWheel}
          className="flex flex-wrap gap-x-0.5 gap-y-1 sm:gap-x-1 items-end w-full justify-start lg:justify-start"
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
            .hide-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `,
            }}
          />

          {menuItems.map((item, index) => {
            const IconComponent = item.icon;
            const active = (item as any).isOrders
              ? isOrdersActive
              : (item as any).isCardapio
                ? isCardapioActive
                : isActive(item.url);

            const baseClasses =
              "group relative flex items-center gap-1 md:gap-1.5 lg:gap-2 px-1.5 sm:px-2 md:px-3 lg:px-4 py-1.5 sm:py-2 text-[9px] sm:text-xs lg:text-sm font-medium transition-all duration-200 select-none whitespace-nowrap min-w-max border-t border-x rounded-t-xl shrink-1 lg:shrink-0";

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
                  <IconComponent
                    className={`h-3.5 w-3.5 md:h-4 md:w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                  />
                  <ResponsiveTitle title={item.title} />
                </button>
              );
            }

            if ((item as any).isCardapio) {
              return (
                <DropdownMenu key={item.title}>
                  <DropdownMenuTrigger asChild>
                    <button
                      className={`${baseClasses} ${activeClasses} flex items-center gap-1.5 outline-none`}
                      title={item.title}
                    >
                      <IconComponent
                        className={`h-3.5 w-3.5 md:h-4 md:w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                      />
                      <ResponsiveTitle title={item.title} />
                      <ChevronDown className="h-2.5 w-2.5 md:h-3 md:w-3 text-muted-foreground group-hover:text-foreground transition-transform duration-200" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="start"
                    className="w-64 p-2 rounded-xl border-border/60 backdrop-blur-md bg-background/95 shadow-lg"
                  >
                    <DropdownMenuItem asChild>
                      <NavLink
                        to="/dashboard/menus"
                        className={({ isActive }) =>
                          `flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer w-full text-left select-none outline-none ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          }`
                        }
                      >
                        <Menu className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold leading-tight font-heading">
                            Cardápios
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                            Gerencie seus cardápios digitais
                          </div>
                        </div>
                      </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <NavLink
                        to="/dashboard/categories"
                        className={({ isActive }) =>
                          `flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer w-full text-left select-none outline-none ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          }`
                        }
                      >
                        <FolderOpen className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold leading-tight font-heading">
                            Categorias
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                            Organize pratos por categoria
                          </div>
                        </div>
                      </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <NavLink
                        to="/dashboard/dishes"
                        className={({ isActive }) =>
                          `flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer w-full text-left select-none outline-none ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          }`
                        }
                      >
                        <UtensilsCrossed className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold leading-tight font-heading">
                            Pratos
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                            Cadastre e edite seus pratos
                          </div>
                        </div>
                      </NavLink>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <NavLink
                        to="/dashboard/complements"
                        className={({ isActive }) =>
                          `flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer w-full text-left select-none outline-none ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          }`
                        }
                      >
                        <Plus className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold leading-tight font-heading">
                            Complementos
                          </div>
                          <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                            Gerencie opcionais e adicionais
                          </div>
                        </div>
                      </NavLink>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <NavLink
                key={item.title}
                to={item.url}
                className={`${baseClasses} ${activeClasses}`}
                title={item.title}
              >
                <IconComponent
                  className={`h-3.5 w-3.5 md:h-4 md:w-4 ${active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}
                />
                <ResponsiveTitle title={item.title} />
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
