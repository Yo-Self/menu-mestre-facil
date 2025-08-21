import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Dish {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string;
  is_available: boolean;
  position: number;
}

interface Category {
  id: string;
  name: string;
  image_url: string;
}

function SortableDishItem({ dish }: { dish: Dish }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: dish.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`mb-3 cursor-move transition-opacity ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div
            {...attributes}
            {...listeners}
            className="flex-shrink-0 cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="flex-shrink-0">
            <img
              src={dish.image_url}
              alt={dish.name}
              className="w-16 h-16 object-cover rounded-md"
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">{dish.name}</h3>
            {dish.description && (
              <p className="text-sm text-muted-foreground truncate">
                {dish.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="font-medium text-primary">
                {formatPrice(dish.price)}
              </span>
              {!dish.is_available && (
                <Badge variant="secondary">Indisponível</Badge>
              )}
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <Badge variant="outline" className="text-xs">
              Posição {dish.position + 1}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CategoryDishesOrderPage() {
  const { id: categoryId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [category, setCategory] = useState<Category | null>(null);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (categoryId) {
      fetchCategoryAndDishes();
    }
  }, [categoryId]);

  const fetchCategoryAndDishes = async () => {
    try {
      // Buscar informações da categoria
      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .single();

      if (categoryError) throw categoryError;
      setCategory(categoryData);

      // Buscar pratos da categoria ordenados por posição
      const { data: dishesData, error: dishesError } = await supabase
        .from("dish_categories")
        .select(`
          position,
          dishes (
            id,
            name,
            description,
            price,
            image_url,
            is_available
          )
        `)
        .eq("category_id", categoryId)
        .order("position", { ascending: true });

      if (dishesError) throw dishesError;

      const processedDishes = (dishesData || [])
        .map((dc: any) => ({
          ...dc.dishes,
          position: dc.position,
        }))
        .sort((a, b) => a.position - b.position);

      setDishes(processedDishes);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
      navigate("/dashboard/categories");
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setDishes((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex).map((dish, index) => ({
          ...dish,
          position: index,
        }));
      });
    }
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      // Atualizar as posições no banco de dados
      const updates = dishes.map((dish) => ({
        dish_id: dish.id,
        category_id: categoryId,
        position: dish.position,
      }));

      // Usar upsert para atualizar as posições
      const { error } = await supabase
        .from("dish_categories")
        .upsert(updates, { onConflict: "dish_id,category_id" });

      if (error) throw error;

      toast({
        title: "Ordem salva",
        description: "A ordem dos pratos foi atualizada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar ordem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold mb-2">Categoria não encontrada</h2>
        <Button variant="outline" onClick={() => navigate("/dashboard/categories")}>
          Voltar às Categorias
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/categories")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">Ordenar Pratos</h1>
            <p className="text-muted-foreground">
              Arraste e solte para reordenar os pratos da categoria "{category.name}"
            </p>
          </div>
        </div>
        
        <Button onClick={handleSaveOrder} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Ordem"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <CategoryImage
              categoryId={category.id}
              categoryImageUrl={category.image_url}
              alt={category.name}
              className="w-12 h-12 object-cover rounded-md"
            />
            {category.name}
          </CardTitle>
          <CardDescription>
            {dishes.length} prato{dishes.length !== 1 ? "s" : ""} nesta categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dishes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Nenhum prato cadastrado nesta categoria.
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={dishes.map((dish) => dish.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0">
                  {dishes.map((dish) => (
                    <SortableDishItem key={dish.id} dish={dish} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <div className="bg-muted/50 p-4 rounded-lg">
        <h3 className="font-semibold mb-2">Como usar:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Clique e arraste o ícone de grip (⋮⋮) para mover um prato</li>
          <li>• Use as setas do teclado para navegar e reordenar</li>
          <li>• Clique em "Salvar Ordem" para aplicar as mudanças</li>
          <li>• A ordem será refletida no cardápio público</li>
        </ul>
      </div>
    </div>
  );
}
