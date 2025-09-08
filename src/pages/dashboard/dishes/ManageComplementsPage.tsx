import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, ExternalLink, Edit, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Dish = {
  id: string;
  name: string;
  restaurant_id: string;
  description: string | null;
  price: number;
  image_url: string | null;
  ingredients: string | null;
};

type ComplementGroup = {
  id: string;
  title: string;
  description: string | null;
  required: boolean;
  max_selections: number;
  restaurant_id: string;
  position?: number | null;
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
  is_active: boolean;
};

export default function ManageComplementsPage() {
  const { id: dishId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingComplementByGroup, setSavingComplementByGroup] = useState<Record<string, boolean>>({});

  const [dish, setDish] = useState<Dish | null>(null);
  const [groups, setGroups] = useState<ComplementGroup[]>([]);
  const [availableGroups, setAvailableGroups] = useState<ComplementGroup[]>([]);
  const [complementsByGroup, setComplementsByGroup] = useState<Record<string, Complement[]>>({});
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  
  // Estado para edição de complementos
  const [editingComplement, setEditingComplement] = useState<Complement | null>(null);

  const hasDishAndId = useMemo(() => Boolean(dishId), [dishId]);

  useEffect(() => {
    if (!hasDishAndId) return;
    (async () => {
      setLoading(true);
      try {
        await ensureOwnershipAndLoadDish();
      } catch (error: any) {
        toast({ title: "Erro", description: error.message || "Falha ao carregar complementos", variant: "destructive" });
        navigate("/dashboard/dishes");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishId]);

  // Carregar complementos após dish ser carregado
  useEffect(() => {
    if (!dish) return;
    (async () => {
      try {
        await loadGroupsAndComplements();
        await loadAvailableGroups();
      } catch (error: any) {
        toast({ title: "Erro", description: error.message || "Falha ao carregar complementos", variant: "destructive" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish]);

  const ensureOwnershipAndLoadDish = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");
    const { data, error } = await supabase
      .from("dishes")
      .select(`id, name, restaurant_id, restaurants!inner(id, user_id)`) // verify ownership
      .eq("id", dishId)
      .eq("restaurants.user_id", user.id)
      .single();
    if (error || !data) throw error || new Error("Prato não encontrado");
    setDish({ id: data.id, name: (data as any).name, restaurant_id: (data as any).restaurant_id });
  };

  const loadGroupsAndComplements = async () => {
    console.log("🔍 Loading complements for dishId:", dishId, "dish:", dish);
    if (!dishId || !dish) {
      console.log("❌ Missing dishId or dish data");
      return;
    }
    
    // Buscar grupos de complemento através da tabela de relacionamento
    const { data: groupsData, error: groupsError } = await supabase
      .from("dish_complement_groups")
      .select(`
        complement_groups (
          id,
          title,
          description,
          required,
          max_selections,
          restaurant_id,
          created_at
        ),
        position
      `)
      .eq("dish_id", dishId)
      .order("position", { ascending: true, nullsFirst: true });
    
    console.log("🔍 Groups query result:", { groupsData, groupsError });
    
    if (groupsError) throw groupsError;
    
    // Transformar os dados para o formato esperado
    const list: ComplementGroup[] = (groupsData || []).map((item: any) => ({
      ...item.complement_groups,
      position: item.position
    }));
    console.log("🔍 Processed groups:", list);
    setGroups(list);

    // Load complements for these groups
    const groupIds = list.map((g) => g.id);
    console.log("🔍 Group IDs:", groupIds);
    if (groupIds.length === 0) {
      setComplementsByGroup({});
      return;
    }
    const { data: compsData, error: compsError } = await supabase
      .from("complements")
      .select("*")
      .in("group_id", groupIds)
      .order("position", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true });
    console.log("🔍 Complements query result:", { compsData, compsError });
    if (compsError) throw compsError;
    const byGroup: Record<string, Complement[]> = {};
    (compsData || []).forEach((c) => {
      const key = (c as any).group_id as string;
      if (!byGroup[key]) byGroup[key] = [];
      byGroup[key].push(c as any as Complement);
    });
    console.log("🔍 Complements by group:", byGroup);
    setComplementsByGroup(byGroup);
  };

  const loadAvailableGroups = async () => {
    if (!dish) return;
    try {
      // Buscar todos os grupos do restaurante
      const { data: allGroups, error } = await supabase
        .from("complement_groups")
        .select("*")
        .eq("restaurant_id", dish.restaurant_id);
        
      if (error) throw error;
      
      // Filtrar grupos que não estão já associados ao prato
      const currentGroupIds = groups.map(g => g.id);
      const available = (allGroups || []).filter(group => !currentGroupIds.includes(group.id));
      setAvailableGroups(available);
    } catch (error: any) {
      console.error("Erro ao carregar grupos disponíveis:", error);
    }
  };

  const handleAddExistingGroup = async () => {
    if (!selectedGroupId || !dishId) return;
    setSavingGroup(true);
    try {
      const { error } = await supabase
        .from("dish_complement_groups")
        .insert({
          dish_id: dishId,
          complement_group_id: selectedGroupId,
        });
      
      if (error) throw error;
      
      toast({ title: "Grupo adicionado", description: "Grupo de complementos associado ao prato." });
      setSelectedGroupId("");
      await loadGroupsAndComplements();
      await loadAvailableGroups();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar grupo", description: error.message, variant: "destructive" });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Tem certeza que deseja excluir este grupo e todos os seus complementos?")) return;
    try {
      // 1. Delete complements first
      const { error: delCompErr } = await supabase.from("complements").delete().eq("group_id", groupId);
      if (delCompErr) throw delCompErr;
      
      // 2. Delete relationship from dish_complement_groups
      const { error: delRelErr } = await supabase
        .from("dish_complement_groups")
        .delete()
        .eq("complement_group_id", groupId)
        .eq("dish_id", dishId);
      if (delRelErr) throw delRelErr;
      
      // 3. Delete the group itself
      const { error } = await supabase.from("complement_groups").delete().eq("id", groupId);
      if (error) throw error;
      
      toast({ title: "Grupo excluído", description: "O grupo e seus complementos foram removidos." });
      await loadGroupsAndComplements();
    } catch (error: any) {
      toast({ title: "Erro ao excluir grupo", description: error.message, variant: "destructive" });
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
        is_active: true,
      });
      if (error) throw error;
      toast({ title: "Complemento criado", description: "Novo complemento adicionado ao grupo." });
      await loadGroupsAndComplements();
    } catch (error: any) {
      toast({ title: "Erro ao criar complemento", description: error.message, variant: "destructive" });
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
      await loadGroupsAndComplements();
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
      const { error } = await supabase.from("complements").delete().eq("id", complementId);
      if (error) throw error;
      toast({ title: "Complemento excluído" });
      await loadGroupsAndComplements();
    } catch (error: any) {
      toast({ title: "Erro ao excluir complemento", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleComplementStatus = async (complementId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("complements")
        .update({ is_active: !currentStatus })
        .eq("id", complementId);
      
      if (error) throw error;
      
      toast({ 
        title: currentStatus ? "Complemento desativado" : "Complemento ativado",
        description: currentStatus 
          ? "O complemento foi desativado e não aparecerá para os clientes." 
          : "O complemento foi ativado e estará disponível para os clientes."
      });
      
      await loadGroupsAndComplements();
    } catch (error: any) {
      toast({ 
        title: "Erro ao alterar status do complemento", 
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/dishes")} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Complementos do Prato</h1>
          <p className="text-muted-foreground">Gerencie grupos de complementos e adicionais do prato{dish ? ` "${dish.name}"` : ""}</p>
        </div>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Adicionar Grupo de Complementos</CardTitle>
          <CardDescription>Selecione um grupo existente ou crie um novo na página de complementos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-select">Selecionar Grupo Existente</Label>
            <div className="flex gap-2">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Escolha um grupo de complementos" />
                </SelectTrigger>
                <SelectContent>
                  {availableGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.title} ({group.required ? "Obrigatório" : "Opcional"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAddExistingGroup} 
                disabled={!selectedGroupId || savingGroup}
              >
                {savingGroup ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => navigate("/dashboard/complements")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Criar Novo Grupo
            </Button>
            <span className="text-sm text-muted-foreground">
              Crie e gerencie grupos na página de complementos
            </span>
          </div>
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
            <Card key={group.id} className="">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{group.title}</CardTitle>
                  <CardDescription>
                    {group.description || "Sem descrição"} • {group.required ? "Obrigatório" : "Opcional"} • Máximo de {group.max_selections}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleDeleteGroup(group.id)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir grupo
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-medium">Complementos</h3>
                  {(complementsByGroup[group.id] || []).length === 0 ? (
                    <div className="text-sm text-muted-foreground">Nenhum complemento neste grupo</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(complementsByGroup[group.id] || []).map((comp) => (
                        <div key={comp.id} className="rounded-md border p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-medium">{comp.name}</div>
                              <div className="text-sm text-muted-foreground">
                                {comp.description || "Sem descrição"}
                              </div>
                              <div className="text-sm mt-1">
                                Preço: {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(comp.price || 0)}
                              </div>
                              {comp.ingredients && (
                                <div className="text-xs text-muted-foreground mt-1">Ingredientes: {comp.ingredients}</div>
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
                              <Button variant="outline" size="sm" onClick={() => handleDeleteComplement(comp.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id={`active-${comp.id}`}
                                checked={comp.is_active}
                                onCheckedChange={() => handleToggleComplementStatus(comp.id, comp.is_active)}
                              />
                              <Label htmlFor={`active-${comp.id}`} className="text-sm">
                                {comp.is_active ? "Ativo" : "Inativo"}
                              </Label>
                            </div>
                            {!comp.is_active && (
                              <Badge variant="secondary" className="text-xs">
                                Oculto dos clientes
                              </Badge>
                            )}
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
  onSubmit: (fields: { name: string; description: string; price: string; imageUrl: string; ingredients: string }) => void;
  editingComplement?: Complement | null;
  onUpdate?: (fields: { name: string; description: string; price: string; imageUrl: string; ingredients: string }) => void;
  onCancelEdit?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [selectedDishId, setSelectedDishId] = useState("");
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [loadingDishes, setLoadingDishes] = useState(false);

  // Carregar pratos do restaurante
  useEffect(() => {
    const loadDishes = async () => {
      if (editingComplement) return; // Não carregar pratos quando editando
      
      setLoadingDishes(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("dishes")
          .select(`
            id,
            name,
            description,
            price,
            image_url,
            ingredients,
            restaurant_id,
            restaurants!inner (
              user_id
            )
          `)
          .eq("restaurants.user_id", user.id)
          .eq("is_available", true)
          .order("name", { ascending: true });

        if (error) throw error;
        setDishes(data || []);
      } catch (error) {
        console.error("Erro ao carregar pratos:", error);
      } finally {
        setLoadingDishes(false);
      }
    };

    loadDishes();
  }, [editingComplement]);

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
      setSelectedDishId("");
    }
  }, [editingComplement]);

  const handleImportFromDish = (dishId: string) => {
    const dish = dishes.find(d => d.id === dishId);
    if (dish) {
      setName(dish.name);
      setDescription(dish.description || "");
      setPrice(dish.price.toString());
      setImageUrl(dish.image_url || "");
      setIngredients(dish.ingredients || "");
      setSelectedDishId(dishId);
    }
  };

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
      setSelectedDishId("");
    }
  };

  const isEditing = Boolean(editingComplement);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditing && (
        <div className="space-y-2">
          <Label htmlFor="import-dish">Importar dados de um prato (opcional)</Label>
          <div className="flex gap-2">
            <Select value={selectedDishId} onValueChange={handleImportFromDish} disabled={loadingDishes}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={loadingDishes ? "Carregando pratos..." : "Selecione um prato para importar dados"} />
              </SelectTrigger>
              <SelectContent>
                {dishes.map((dish) => (
                  <SelectItem key={dish.id} value={dish.id}>
                    {dish.name} - {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(dish.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedDishId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDishId("");
                  setName("");
                  setDescription("");
                  setPrice("");
                  setImageUrl("");
                  setIngredients("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {selectedDishId && (
            <p className="text-sm text-muted-foreground">
              Dados importados do prato: {dishes.find(d => d.id === selectedDishId)?.name}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="comp-name">Nome</Label>
          <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Bacon" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-price">Preço (R$)</Label>
          <Input id="comp-price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="comp-description">Descrição (opcional)</Label>
        <Textarea id="comp-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Detalhes do adicional/complemento" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="comp-image">URL da imagem (opcional)</Label>
          <Input id="comp-image" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comp-ingredients">Ingredientes (opcional)</Label>
          <Input id="comp-ingredients" value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="Ex: bacon, pimenta" />
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


