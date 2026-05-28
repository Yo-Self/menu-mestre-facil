import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "@/components/layout/TabBar";
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

  const restaurantId = currentRestaurantId || getRestaurantIdFromUrl();

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
    <div className="min-h-screen flex flex-col w-full bg-muted/20">
      <header className="glass-header sticky top-0 z-40 h-16 flex items-center justify-between px-4 transition-all duration-300">
        <div className="flex items-center shrink-0">
          <div className="flex items-center gap-2 mr-2">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse hidden sm:block" />
            <span className="bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent font-heading font-extrabold tracking-wide hidden sm:block">
              GESTOR MENU
            </span>
            <span className="h-6 w-6 rounded-lg bg-primary/10 flex sm:hidden items-center justify-center font-bold text-xs text-primary">
              G
            </span>
          </div>
        </div>
        
        <TabBar />
        
        <div className="flex items-center gap-2 shrink-0">
          {restaurantId && (
            <WaiterCallNotifications 
              restaurantId={restaurantId}
              onCallAttended={(call) => {
                toast({
                  title: "Chamada atendida!",
                  description: `Mesa ${call.table_number} foi atendida com sucesso.`,
                });
              }}
            />
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => window.open("/dashboard/pos/waiter", "_blank")} 
            title="Modo Garçom"
            className="hover:bg-primary/10 hover:text-primary transition-colors rounded-full h-8 w-8"
          >
            <User className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="hover:bg-destructive/10 hover:text-destructive transition-colors rounded-full h-8 w-8">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      
      <main className="flex-1 p-6 animate-fade-in-up w-full">
        <Outlet />
      </main>
    </div>
  );
}