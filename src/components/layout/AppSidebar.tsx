import { useLocation } from "react-router-dom";
import { NavLink } from "react-router-dom";
import {
  Store,
  Menu,
  UtensilsCrossed,
  FolderOpen,
  Home,
  Settings,
  Download,
  Plus,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Restaurantes", url: "/dashboard/restaurants", icon: Store },
  { title: "Menus", url: "/dashboard/menus", icon: Menu },
  { title: "Categorias", url: "/dashboard/categories", icon: FolderOpen },
  { title: "Pratos", url: "/dashboard/dishes", icon: UtensilsCrossed },
  { title: "Complementos", url: "/dashboard/complements", icon: Plus },
  { title: "Importar Menu", url: "/dashboard/import-menu", icon: Download },
  { title: "Configurações", url: "/dashboard/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + "/");

  return (
    <Sidebar className={`border-r border-border/40 transition-all duration-300 ${isCollapsed ? "w-14" : "w-64"}`} collapsible="icon">
      <SidebarContent className="py-2">
        <SidebarGroup>
          <div className={`h-14 px-4 flex items-center justify-between font-heading font-extrabold text-base mb-4 ${!isCollapsed ? "border-b border-border/30 pb-3" : ""}`}>
            {!isCollapsed ? (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent tracking-wide">
                  MENU MESTRE
                </span>
              </div>
            ) : (
              <span className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-xs text-primary mx-auto">
                M
              </span>
            )}
          </div>
          
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      tooltip={item.title}
                      isActive={active}
                      className={`transition-all duration-200 h-10 ${
                        active
                          ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary font-semibold"
                          : "hover:bg-primary/5 hover:text-primary text-muted-foreground hover:scale-[1.02]"
                      }`}
                    >
                      <NavLink to={item.url} className="flex items-center gap-3 w-full px-3">
                        <IconComponent className={`h-4.5 w-4.5 transition-transform duration-300 ${active ? 'scale-110 text-primary' : 'text-muted-foreground group-hover:text-primary'}`} />
                        {!isCollapsed && <span className="font-heading text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}