import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Settings, Trash2, Users, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Restaurant = {
  id: string;
  name: string;
};

type ComplementGroup = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  required: boolean;
  max_selections: number;
  created_at: string;
  updated_at: string;
};

type Complement = {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  ingredients: string | null;
  position: number | null;
};

type DishCount = {
  group_id: string;
  dish_count: number;
};

export default function ComplementGroupsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingComplementByGroup, setSavingComplementByGroup] = useState<Record<string, boolean>>({});

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [groups, setGroups] = useState<ComplementGroup[]>([]);
  const [complementsByGroup, setComplementsByGroup] = useState<Record<string, Complement[]>>({});
  const [dishCountsByGroup, setDishCountsByGroup] = useState<Record<string, number>>({});

  // New group form state
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMaxSelections, setNewGroupMaxSelections] = useState<number | "">(1);
  
  // Estado para edição de complementos
  const [editingComplement, setEditingComplement] = useState<Complement | null>(null);

  useEffect(() => {
    loadRestaurantAndGroups();
  }, []);

  const loadRestaurantAndGroups = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get user's restaurant
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("user_id", user.id)
        .single();

      if (restaurantError || !restaurantData) {
        throw new Error("Restaurante não encontrado");
      }

      setRestaurant(restaurantData);

      // Load complement groups for this restaurant
      const { data: groupsData, error: groupsError } = await supabase
        .from("complement_groups")
        .select("*")
        .eq("restaurant_id", restaurantData.id)
        .order("created_at", { ascending: true });

      if (groupsError) throw groupsError;

      const groupsList = (groupsData || []) as ComplementGroup[];
      setGroups(groupsList);

      // Load complements for these groups
      await loadComplementsAndDishCounts(groupsList);

    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao carregar grupos de complementos",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadComplementsAndDishCounts = async (groupsList: ComplementGroup[]) => {
    const groupIds = groupsList.map(g => g.id);
    if (groupIds.length === 0) {
      setComplementsByGroup({});
      setDishCountsByGroup({});
      return;
    }

    // Load complements
    const { data: compsData, error: compsError } = await supabase
      .from("complements")
      .select("*")
      .in("group_id", groupIds)
      .order("position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });

    if (compsError) throw compsError;

    const byGroup: Record<string, Complement[]> = {};
    (compsData || []).forEach((c) => {
      const key = c.group_id;
      if (!byGroup[key]) byGroup[key] = [];
      byGroup[key].push(c as Complement);
    });
    setComplementsByGroup(byGroup);

    // Load dish counts for each group
    const { data: dishCountsData, error: dishCountsError } = await supabase
      .from("dish_complement_groups")
      .select("complement_group_id")
      .in("complement_group_id", groupIds);

    if (dishCountsError) throw dishCountsError;

    const countsByGroup: Record<string, number> = {};
    groupIds.forEach(id => countsByGroup[id] = 0);
    
    (dishCountsData || []).forEach((item) => {
      countsByGroup[item.complement_group_id] = (countsByGroup[item.complement_group_id] || 0) + 1;
    });

    setDishCountsByGroup(countsByGroup);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;

    setSavingGroup(true);
    try {
      const maxSel = newGroupMaxSelections === "" ? 1 : Number(newGroupMaxSelections);
      const { error } = await supabase.from("complement_groups").insert({
        restaurant_id: restaurant.id,
        title: newGroupTitle.trim(),
        description: newGroupDescription.trim() || null,
        required: newGroupRequired,
        max_selections: Number.isFinite(maxSel) && maxSel > 0 ? maxSel : 1,
      });

      if (error) throw error;

      toast({
        title: "Grupo criado",
        description: "Novo grupo de complementos adicionado."
      });

      setNewGroupTitle("");
      setNewGroupDescription("");
      setNewGroupRequired(false);
      setNewGroupMaxSelections(1);
      await loadRestaurantAndGroups();

    } catch (error: any) {
      toast({
        title: "Erro ao criar grupo",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const dishCount = dishCountsByGroup[groupId] || 0;
    const message = dishCount > 0 
      ? `Este grupo está sendo usado por ${dishCount} prato(s). Tem certeza que deseja excluí-lo? Isso removerá o grupo de todos os pratos.`
      : "Tem certeza que deseja excluir este grupo e todos os seus complementos?";

    if (!confirm(message)) return;

    try {
      // Delete relationships first
      const { error: relError } = await supabase
        .from("dish_complement_groups")
        .delete()
        .eq("complement_group_id", groupId);
      if (relError) throw relError;

      // Delete complements
      const { error: delCompErr } = await supabase
        .from("complements")
        .delete()
        .eq("group_id", groupId);
      if (delCompErr) throw delCompErr;

      // Delete group
      const { error } = await supabase
        .from("complement_groups")
        .delete()
        .eq("id", groupId);
      if (error) throw error;

      toast({
        title: "Grupo excluído",
        description: "O grupo e seus complementos foram removidos."
      });

      await loadRestaurantAndGroups();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir grupo",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCreateComplement = async (
    groupId: string,
    fields: { name: string; description: string; price: string; imageUrl: string; ingredients: string }
  ) => {
    setSavingComplementByGroup((prev) => ({ ...prev, [groupId]: true }));
    try {
      const { error } = await supabase.from("complements").insert({
        group_id: groupId,
        name: fields.name.trim(),
        description: fields.description.trim() || null,
        price: Number(parseFloat(fields.price || "0")) || 0,
        image_url: fields.imageUrl.trim() || null,
        ingredients: fields.ingredients.trim() || null,
      });

      if (error) throw error;

      toast({
        title: "Complemento criado",
        description: "Novo complemento adicionado ao grupo."
      });

      await loadRestaurantAndGroups();
    } catch (error: any) {
      toast({
        title: "Erro ao criar complemento",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSavingComplementByGroup((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleUpdateComplement = async (
    groupId: string,
    complementId: string,
    fields: { name: string; description: string; price: string; imageUrl: string; ingredients: string }
  ) => {
    setSavingComplementByGroup((prev) => ({ ...prev, [groupId]: true }));
    try {
      const { error } = await supabase
        .from("complements")
        .update({
          name: fields.name.trim(),
          description: fields.description.trim() || null,
          price: Number(parseFloat(fields.price || "0")) || 0,
          image_url: fields.imageUrl.trim() || null,
          ingredients: fields.ingredients.trim() || null,
        })
        .eq("id", complementId);
      
      if (error) throw error;
      
      toast({ title: "Complemento atualizado", description: "Complemento foi atualizado com sucesso." });
      setEditingComplement(null);
      await loadRestaurantAndGroups();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar complemento", description: error.message, variant: "destructive" });
    } finally {
      setSavingComplementByGroup((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleEditComplement = (complement: Complement) => {
    setEditingComplement(complement);
  };

  const handleCancelEdit = () => {
    setEditingComplement(null);
  };

  const handleDeleteComplement = async (complementId: string) => {
    if (!confirm("Tem certeza que deseja excluir este complemento?")) return;
    try {
      const { error } = await supabase
        .from("complements")
        .delete()
        .eq("id", complementId);
      if (error) throw error;

      toast({ title: "Complemento excluído" });
      await loadRestaurantAndGroups();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir complemento",
        description: error.message,
        variant: "destructive"
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
          <h1 className="text-3xl font-bold text-primary">Grupos de Complementos</h1>
          <p className="text-muted-foreground">
            Gerencie grupos de adicionais e complementos que podem ser compartilhados entre vários pratos
            {restaurant && ` do ${restaurant.name}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard/dishes")}>
          <Settings className="h-4 w-4 mr-2" />
          Gerenciar Pratos
        </Button>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Novo Grupo de Complementos</CardTitle>
          <CardDescription>
            Crie grupos como "Molhos", "Adicionais", "Pontos da carne" etc. que podem ser reutilizados em vários pratos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-title">Título do Grupo</Label>
              <Input
                id="group-title"
                value={newGroupTitle}
                onChange={(e) => setNewGroupTitle(e.target.value)}
                placeholder="Ex: Adicionais"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">Descrição (opcional)</Label>
              <Textarea
                id="group-description"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
                rows={2}
                placeholder="Ex: Escolha até 2 adicionais"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Obrigatório</Label>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm text-muted-foreground">
                    Usuário deve selecionar pelo menos 1
                  </span>
                  <Switch
                    checked={newGroupRequired}
                    onCheckedChange={setNewGroupRequired}
                  />
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="group-max">Máximo de seleções</Label>
                <Input
                  id="group-max"
                  type="number"
                  min={1}
                  value={newGroupMaxSelections}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNewGroupMaxSelections(v === "" ? "" : Number(v));
                  }}
                  placeholder="1"
                  required
                />
              </div>
            </div>
            <div className="pt-2">
              <Button type="submit" disabled={savingGroup}>
                {savingGroup ? "Criando..." : "Criar Grupo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Separator />

      <div className="space-y-6">
        {groups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum grupo criado. Utilize o formulário acima para criar o primeiro.
            </CardContent>
          </Card>
        ) : (
          groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-xl">{group.title}</CardTitle>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {dishCountsByGroup[group.id] || 0} prato(s)
                    </Badge>
                  </div>
                  <CardDescription>
                    {group.description || "Sem descrição"} •{" "}
                    {group.required ? "Obrigatório" : "Opcional"} •{" "}
                    Máximo de {group.max_selections}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteGroup(group.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir grupo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-medium">Complementos</h3>
                  {(complementsByGroup[group.id] || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Nenhum complemento neste grupo
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(complementsByGroup[group.id] || []).map((comp) => (
                        <div key={comp.id} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="font-medium">{comp.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {comp.description || "Sem descrição"}
                              </div>
                              <div className="text-sm mt-1">
                                Preço:{" "}
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(comp.price || 0)}
                              </div>
                              {comp.ingredients && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Ingredientes: {comp.ingredients}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditComplement(comp)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteComplement(comp.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <NewComplementForm
                  saving={Boolean(savingComplementByGroup[group.id])}
                  onSubmit={(fields) => handleCreateComplement(group.id, fields)}
                  editingComplement={editingComplement}
                  onUpdate={(fields) => handleUpdateComplement(group.id, editingComplement!.id, fields)}
                  onCancelEdit={handleCancelEdit}
                />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function NewComplementForm({
  saving,
  onSubmit,
  editingComplement,
  onUpdate,
  onCancelEdit,
}: {
  saving: boolean;
  onSubmit: (fields: {
    name: string;
    description: string;
    price: string;
    imageUrl: string;
    ingredients: string;
  }) => void;
  editingComplement?: Complement | null;
  onUpdate?: (fields: {
    name: string;
    description: string;
    price: string;
    imageUrl: string;
    ingredients: string;
  }) => void;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ingredients, setIngredients] = useState("");

  // Preencher campos quando estiver editando
  useEffect(() => {
    if (editingComplement) {
      setName(editingComplement.name);
      setDescription(editingComplement.description || "");
      setPrice(editingComplement.price.toString());
      setImageUrl(editingComplement.image_url || "");
      setIngredients(editingComplement.ingredients || "");
    } else {
      // Limpar campos quando não estiver editando
      setName("");
      setDescription("");
      setPrice("");
      setImageUrl("");
      setIngredients("");
    }
  }, [editingComplement]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingComplement && onUpdate) {
      onUpdate({ name, description, price, imageUrl, ingredients });
    } else {
      onSubmit({ name, description, price, imageUrl, ingredients });
      // Limpar campos apenas após criar novo complemento
      setName("");
      setDescription("");
      setPrice("");
      setImageUrl("");
      setIngredients("");
    }
  };

  const isEditing = Boolean(editingComplement);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="comp-name">Nome</Label>
          <Input
            id="comp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Bacon"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-price">Preço (R$)</Label>
          <Input
            id="comp-price"
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="comp-description">Descrição (opcional)</Label>
        <Textarea
          id="comp-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Detalhes do adicional/complemento"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="comp-image">URL da imagem (opcional)</Label>
          <Input
            id="comp-image"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-ingredients">Ingredientes (opcional)</Label>
          <Input
            id="comp-ingredients"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="Ex: bacon, pimenta"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancelEdit}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </>
        ) : (
          <Button type="submit" disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Adicionando..." : "Adicionar Complemento"}
          </Button>
        )}
      </div>
    </form>
  );
}
