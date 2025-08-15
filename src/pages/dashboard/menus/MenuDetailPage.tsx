import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Edit, ToggleLeft, ToggleRight, Plus, FolderOpen, Eye, ArrowUpDown, UtensilsCrossed, Menu, Bell } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MenuRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  waiter_call_enabled: boolean;
  restaurant_id: string;
  created_at?: string;
  updated_at?: string;
}

interface Category {
  id: string;
  name: string;
  image_url: string;
  position: number;
  dishes_count: number;
}

export default function MenuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [menu, setMenu] = useState<MenuRow | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchMenuAndCategories(id);
  }, [id]);

  const fetchMenuAndCategories = async (menuId: string) => {
    try {
      // Buscar informações do menu
      const { data: menuData, error: menuError } = await supabase
        .from("menus")
        .select("*")
        .eq("id", menuId)
        .single();
      
      if (menuError) throw menuError;
      setMenu(menuData as MenuRow);

      // Buscar categorias do restaurante (todas as categorias estão disponíveis para o menu)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          image_url,
          position,
          restaurants!inner (
            id,
            user_id
          )
        `)
        .eq("restaurants.user_id", user.id)
        .order("position", { ascending: true })
        .order("name", { ascending: true });

      if (categoriesError) throw categoriesError;

      // Buscar contagem de pratos para cada categoria
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count } = await supabase
            .from("dish_categories")
            .select("*", { count: "exact", head: true })
            .eq("category_id", category.id);
          
          return {
            ...category,
            dishes_count: count || 0,
          };
        })
      );
      
      setCategories(categoriesWithCounts);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
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
      <Breadcrumb
        items={[
          { label: "Menus", href: "/dashboard/menus", icon: Menu },
          { label: menu.name, icon: Menu }
        ]}
      />
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/menus")}> 
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-primary">{menu.name}</h1>
          <p className="text-muted-foreground">Gerenciamento do menu e suas categorias</p>
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
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Chamada de Garçom:</span>
            <Badge variant={menu.waiter_call_enabled ? "default" : "secondary"} className="flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {menu.waiter_call_enabled ? "Habilitada" : "Desabilitada"}
            </Badge>
          </div>
          
          {menu.description && (
            <p className="text-sm text-muted-foreground">{menu.description}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Categorias</h2>
          <p className="text-muted-foreground">
            Gerencie as categorias e pratos do menu
          </p>
        </div>
        <Link to="/dashboard/categories/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nova Categoria
          </Button>
        </Link>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhuma categoria cadastrada</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando uma categoria para organizar os pratos
              </p>
              <Link to="/dashboard/categories/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Categoria
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <Card key={category.id} className="overflow-hidden">
              <div className="aspect-square relative">
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <CardDescription>
                  {category.dishes_count} prato{(category.dishes_count !== 1 ? "s" : "")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/dashboard/categories/${category.id}/dishes`}>
                    <Button variant="outline" size="sm">
                      <UtensilsCrossed className="h-4 w-4 mr-2" />
                      Gerenciar Pratos
                    </Button>
                  </Link>
                  <Link to={`/dashboard/categories/${category.id}/order`}>
                    <Button variant="outline" size="sm">
                      <ArrowUpDown className="h-4 w-4 mr-2" />
                      Ordenar
                    </Button>
                  </Link>
                  <Link to={`/dashboard/categories/${category.id}/edit`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Fluxo de Gerenciamento:</h3>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>1. <strong>Menu</strong> → Gerencie informações básicas do menu</p>
          <p>2. <strong>Categorias</strong> → Organize os pratos em categorias</p>
          <p>3. <strong>Pratos</strong> → Adicione e configure os pratos</p>
          <p>4. <strong>Complementos</strong> → Configure opções e variações</p>
        </div>
      </div>
    </div>
  );
}
