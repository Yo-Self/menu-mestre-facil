import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Edit, ToggleLeft, ToggleRight, Plus, FolderOpen, Eye, ArrowUpDown, UtensilsCrossed, Menu, GripVertical, Save, X, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CategoryImage } from "@/components/ui/category-image";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MenuRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  restaurant_id: string;
  created_at?: string;
  updated_at?: string;
  restaurants: {
    id: string;
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
  image_url: string;
  position: number;
  dishes_count: number;
}

interface SortableCategoryProps {
  category: Category;
  isEditing: boolean;
  onDelete: (categoryId: string, categoryName: string) => void;
}

function SortableCategory({ category, isEditing, onDelete }: SortableCategoryProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`overflow-hidden ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="aspect-square relative">
        <CategoryImage
          categoryId={category.id}
          categoryImageUrl={category.image_url}
          alt={category.name}
          className="w-full h-full object-cover"
        />
        {isEditing && (
          <div className="absolute top-2 left-2">
            <div
              {...attributes}
              {...listeners}
              className="bg-white/90 rounded p-1 cursor-grab active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4 text-gray-600" />
            </div>
          </div>
        )}
      </div>
      <CardHeader>
        <CardTitle className="text-lg">{category.name}</CardTitle>
        <CardDescription>
          {category.dishes_count} prato{(category.dishes_count !== 1 ? "s" : "")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/gestor/dashboard/categories/${category.id}/dishes`}>
            <Button variant="outline" size="sm">
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              Gerenciar Pratos
            </Button>
          </Link>
          <Link to={`/gestor/dashboard/categories/${category.id}/order`}>
            <Button variant="outline" size="sm">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Ordenar
            </Button>
          </Link>
          <Link to={`/gestor/dashboard/categories/${category.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onDelete(category.id, category.name)}
            className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MenuDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [menu, setMenu] = useState<MenuRow | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [orderedCategories, setOrderedCategories] = useState<Category[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!id) return;
    fetchMenuAndCategories(id);
  }, [id]);

  const fetchMenuAndCategories = async (menuId: string) => {
    try {
      // Buscar informações do menu
      const { data: menuData, error: menuError } = await supabase
        .from("menus")
        .select(`
          *,
          restaurants (
            id,
            name
          )
        `)
        .eq("id", menuId)
        .single();
      
      if (menuError) throw menuError;
      setMenu(menuData as MenuRow);

      // Buscar categorias do restaurante específico do menu
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          image_url,
          position,
          restaurant_id
        `)
        .eq("restaurant_id", menuData.restaurant_id)
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
      navigate("/gestor/dashboard/menus");
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

  const startEditingOrder = () => {
    setOrderedCategories([...categories]);
    setIsEditingOrder(true);
  };

  const cancelEditingOrder = () => {
    setIsEditingOrder(false);
    setOrderedCategories([]);
  };

  const saveOrder = async () => {
    if (!menu) return;
    setSavingOrder(true);
    
    try {
      // Atualizar a posição de cada categoria individualmente
      for (let i = 0; i < orderedCategories.length; i++) {
        const category = orderedCategories[i];
        const { error } = await supabase
          .from("categories")
          .update({ position: i + 1 })
          .eq("id", category.id);

        if (error) {
          console.error("Erro ao atualizar categoria:", category.name, error);
          throw error;
        }
      }

      // Atualizar o estado local
      setCategories(orderedCategories.map((cat, index) => ({ ...cat, position: index + 1 })));
      setIsEditingOrder(false);
      setOrderedCategories([]);

      toast({
        title: "Ordem salva",
        description: "A ordem das categorias foi atualizada com sucesso.",
      });
    } catch (error: any) {
      console.error("Erro completo:", error);
      toast({
        title: "Erro ao salvar ordem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setOrderedCategories((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${categoryName}"? Esta ação não pode ser desfeita e todos os pratos desta categoria também serão excluídos.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", categoryId);

      if (error) {
        console.error("Erro ao excluir categoria:", error);
        throw error;
      }

      // Atualizar o estado local removendo a categoria excluída
      setCategories(categories.filter(cat => cat.id !== categoryId));
      setOrderedCategories(orderedCategories.filter(cat => cat.id !== categoryId));

      toast({
        title: "Categoria excluída",
        description: `${categoryName} foi excluída com sucesso.`,
      });
    } catch (error: any) {
      console.error("Erro completo:", error);
      toast({
        title: "Erro ao excluir categoria",
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

  if (!menu) return null;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Menus", href: "/gestor/dashboard/menus", icon: Menu },
          { label: menu.name, icon: Menu }
        ]}
      />
      
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/gestor/dashboard/menus")}> 
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
          <Link to={`/gestor/dashboard/menus/${menu.id}/edit`}>
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
            <span className="text-sm text-muted-foreground">Restaurante:</span>
            <Badge variant="outline">{menu.restaurants.name}</Badge>
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
        <div className="flex items-center gap-2">
          {isEditingOrder ? (
            <>
              <Button onClick={saveOrder} disabled={savingOrder}>
                <Save className="h-4 w-4 mr-2" />
                {savingOrder ? "Salvando..." : "Salvar Ordem"}
              </Button>
              <Button variant="outline" onClick={cancelEditingOrder}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={startEditingOrder}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Reordenar Categorias
              </Button>
              <Link to="/gestor/dashboard/categories/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Categoria
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-center">
              <h3 className="text-lg font-semibold mb-2">Nenhuma categoria cadastrada</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando uma categoria para organizar os pratos
              </p>
              <Link to="/gestor/dashboard/categories/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Categoria
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {isEditingOrder ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedCategories.map(cat => cat.id)}
                strategy={verticalListSortingStrategy}
              >
                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {orderedCategories.map((category) => (
                     <SortableCategory 
                       key={category.id} 
                       category={category} 
                       isEditing={true}
                       onDelete={handleDeleteCategory}
                     />
                   ))}
                 </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <SortableCategory 
                  key={category.id} 
                  category={category} 
                  isEditing={false}
                  onDelete={handleDeleteCategory}
                />
              ))}
            </div>
          )}
        </>
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
