import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Menu {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
  restaurant_id: string;
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("menus")
        .select(`
          *,
          restaurants!inner (
            id,
            name,
            user_id
          )
        `)
        .eq("restaurants.user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMenus(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar menus",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMenuStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("menus")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Status do menu atualizado",
        description: `Menu ${!currentStatus ? "ativado" : "desativado"} com sucesso.`,
      });

      fetchMenus();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar menu",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir o menu "${name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("menus")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Menu excluído",
        description: `${name} foi excluído com sucesso.`,
      });

      fetchMenus();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir menu",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Menus</h1>
          <p className="text-muted-foreground">
            Gerencie os menus dos seus restaurantes
          </p>
        </div>
        <Link to="/dashboard/menus/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Novo Menu
          </Button>
        </Link>
      </div>

      {menus.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhum menu cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando seu primeiro menu
              </p>
              <Link to="/dashboard/menus/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Menu
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {menus.map((menu) => (
            <Card key={menu.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{menu.name}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={menu.is_active ? "default" : "secondary"}>
                        {menu.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleMenuStatus(menu.id, menu.is_active)}
                  >
                    {menu.is_active ? (
                      <ToggleRight className="h-5 w-5 text-primary" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {menu.description && (
                  <CardDescription className="line-clamp-2">
                    {menu.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Link to={`/dashboard/menus/${menu.id}`}>
                    <Button variant="outline" size="sm">
                      Gerenciar
                    </Button>
                  </Link>
                  <Link to={`/dashboard/menus/${menu.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(menu.id, menu.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}