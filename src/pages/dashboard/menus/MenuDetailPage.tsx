import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Edit, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MenuRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  restaurant_id: string;
  created_at?: string;
  updated_at?: string;
}

export default function MenuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [menu, setMenu] = useState<MenuRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchMenu(id);
  }, [id]);

  const fetchMenu = async (menuId: string) => {
    try {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("id", menuId)
        .single();
      if (error) throw error;
      setMenu(data as MenuRow);
    } catch (error: any) {
      toast({ title: "Erro ao carregar menu", description: error.message, variant: "destructive" });
      navigate("/dashboard/menus");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async () => {
    if (!menu) return;
    setToggling(true);
    try {
      const { error } = await supabase
        .from("menus")
        .update({ is_active: !menu.is_active })
        .eq("id", menu.id);
      if (error) throw error;
      setMenu({ ...menu, is_active: !menu.is_active });
      toast({ title: "Status atualizado", description: `Menu ${!menu.is_active ? "ativado" : "desativado"}.` });
    } catch (error: any) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!menu) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/menus")}> 
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-primary">{menu.name}</h1>
          <p className="text-muted-foreground">Gerenciamento do menu</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={toggleStatus} disabled={toggling}>
            {menu.is_active ? <ToggleRight className="h-4 w-4 mr-2 text-primary" /> : <ToggleLeft className="h-4 w-4 mr-2" />}
            {menu.is_active ? "Desativar" : "Ativar"}
          </Button>
          <Link to={`/dashboard/menus/${menu.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Editar Menu
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Menu</CardTitle>
          <CardDescription>Dados básicos do menu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant={menu.is_active ? "default" : "secondary"}>
              {menu.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
          {menu.description && (
            <p className="text-sm text-muted-foreground">{menu.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Espaço futuro: listagem de categorias/pratos do menu */}
    </div>
  );
}
