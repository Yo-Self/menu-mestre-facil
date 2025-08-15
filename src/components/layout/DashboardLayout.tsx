import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WaiterCallNotifications } from "@/components/WaiterCallNotifications";
import { useRestaurant } from "@/components/providers/RestaurantProvider";

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { currentRestaurantId } = useRestaurant();

  // Extrair o ID do restaurante da URL quando estiver em uma página de restaurante
  const getRestaurantIdFromUrl = () => {
    const match = location.pathname.match(/\/restaurants\/([^\/]+)/);
    return match ? match[1] : null;
  };

  // Extrair o ID do menu da URL quando estiver em uma página de menu
  const getMenuIdFromUrl = () => {
    const match = location.pathname.match(/\/menus\/([^\/]+)/);
    return match ? match[1] : null;
  };

  const restaurantId = currentRestaurantId || getRestaurantIdFromUrl();
  const menuId = getMenuIdFromUrl();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate("/auth");
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b bg-background flex items-center justify-between px-6">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold">Gestão de Restaurantes</h1>
            </div>
            
            <div className="flex items-center gap-2">
              {restaurantId && (
                <WaiterCallNotifications 
                  restaurantId={restaurantId}
                  menuId={menuId}
                  onCallAttended={(call) => {
                    toast({
                      title: "Chamada atendida!",
                      description: `Mesa ${call.table_number} foi atendida com sucesso.`,
                    });
                  }}
                />
              )}
              <Button variant="ghost" size="icon">
                <User className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}