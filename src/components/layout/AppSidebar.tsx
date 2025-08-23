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
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary font-bold">
            {!isCollapsed && "Restaurante Pro"}
          </SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild
                      tooltip={item.title}
                      isActive={isActive(item.url)}
                    >
                      <NavLink to={item.url}>
                        <IconComponent className="h-4 w-4" />
                        {!isCollapsed && <span>{item.title}</span>}
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