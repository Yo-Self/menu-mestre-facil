import { useEffect, useState } from "react";
import { Plus, Trash2, Edit, Save, X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ui/image-upload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ComplementGroup = {
  id: string;
  title: string;
  description: string | null;
  required: boolean;
  max_selections: number;
  restaurant_id: string;
  created_at: string;
  linked_dishes?: { id: string; name: string }[];
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

export default function ComplementsPage() {
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState(false);
  const [savingComplementByGroup, setSavingComplementByGroup] = useState<Record<string, boolean>>({});
  
  const [groups, setGroups] = useState<ComplementGroup[]>([]);
  const [complementsByGroup, setComplementsByGroup] = useState<Record<string, Complement[]>>({});
  
  // New group form state
  const [newGroupTitle, setNewGroupTitle] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupRequired, setNewGroupRequired] = useState(false);
  const [newGroupMaxSelections, setNewGroupMaxSelections] = useState<number | "">(1);
  
  // Estado para edição de complementos
  const [editingComplement, setEditingComplement] = useState<Complement | null>(null);
  
  // Estados para edição de grupos
  const [editingGroup, setEditingGroup] = useState<ComplementGroup | null>(null);
  const [editGroupTitle, setEditGroupTitle] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [editGroupRequired, setEditGroupRequired] = useState(false);
  const [editGroupMaxSelections, setEditGroupMaxSelections] = useState<number | "">(1);
  
  // Estados para formulário de complemento
  const [showComplementForm, setShowComplementForm] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadGroupsAndComplements();
  }, []);

  const loadGroupsAndComplements = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar restaurantes do usuário para filtrar grupos
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id")
        .eq("user_id", user.id);

      if (!restaurants || restaurants.length === 0) {
        setGroups([]);
        setComplementsByGroup({});
        return;
      }

      const restaurantIds = restaurants.map(r => r.id);

      // Buscar grupos de complemento do usuário
      const { data: groupsData, error: groupsError } = await supabase
        .from("complement_groups")
        .select("*")
        .in("restaurant_id", restaurantIds)
        .order("created_at", { ascending: false });

      if (groupsError) throw groupsError;

      const groupsList = (groupsData || []) as ComplementGroup[];
      
      // Buscar pratos vinculados para cada grupo
      if (groupsList.length > 0) {
        const groupIds = groupsList.map(g => g.id);
        const { data: linkedDishesData, error: linkedError } = await supabase
          .from("dish_complement_groups")
          .select(`
            complement_group_id,
            dishes!inner(id, name)
          `)
          .in("complement_group_id", groupIds);

        if (linkedError) {
          console.error("Erro ao buscar pratos vinculados:", linkedError);
        } else {
          // Organizar pratos por grupo
          const dishesByGroup: Record<string, { id: string; name: string }[]> = {};
          
          // Verificar se linkedDishesData é um array antes de usar forEach
          if (Array.isArray(linkedDishesData)) {
            linkedDishesData.forEach((item: any) => {
              const groupId = item.complement_group_id;
              if (!dishesByGroup[groupId]) {
                dishesByGroup[groupId] = [];
              }
              dishesByGroup[groupId].push({
                id: item.dishes.id,
                name: item.dishes.name
              });
            });
          } else {
            console.warn("linkedDishesData não é um array:", linkedDishesData);
          }

          // Adicionar pratos vinculados aos grupos
          if (Array.isArray(groupsList)) {
            groupsList.forEach(group => {
              group.linked_dishes = dishesByGroup[group.id] || [];
            });
          } else {
            console.warn("groupsList não é um array:", groupsList);
          }
        }
      }
      
      setGroups(groupsList);

      // Load complements for these groups
      const groupIds = groupsList.map((g) => g.id);
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

      if (compsError) throw compsError;

      

      const byGroup: Record<string, Complement[]> = {};
      
      // Verificar se compsData é um array antes de usar forEach
      if (Array.isArray(compsData)) {
        compsData.forEach((c) => {
          const key = (c as any).group_id as string;
          if (!byGroup[key]) byGroup[key] = [];
          byGroup[key].push(c as any as Complement);
          
          // noop
        });
      } else {
        console.warn("compsData não é um array:", compsData);
      }
      
      setComplementsByGroup(byGroup);
    } catch (error: any) {
      toast({ title: "Erro ao carregar complementos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGroup(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Pegar o primeiro restaurante do usuário como padrão
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      if (!restaurants || restaurants.length === 0) {
        throw new Error("Você precisa ter pelo menos um restaurante cadastrado");
      }

      const maxSel = newGroupMaxSelections === "" ? 1 : Number(newGroupMaxSelections);
      
      const { error: groupError } = await supabase
        .from("complement_groups")
        .insert({
          title: newGroupTitle.trim(),
          description: newGroupDescription.trim() || null,
          required: newGroupRequired,
          max_selections: Number.isFinite(maxSel) && maxSel > 0 ? maxSel : 1,
          restaurant_id: restaurants[0].id,
        });
      
      if (groupError) throw groupError;
      
      toast({ title: "Grupo criado", description: "Novo grupo de complementos adicionado." });
      setNewGroupTitle("");
      setNewGroupDescription("");  
      setNewGroupRequired(false);
      setNewGroupMaxSelections(1);
      await loadGroupsAndComplements();
    } catch (error: any) {
      toast({ title: "Erro ao criar grupo", description: error.message, variant: "destructive" });
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
      
      // 2. Delete relationships from dish_complement_groups
      const { error: delRelErr } = await supabase
        .from("dish_complement_groups")
        .delete()
        .eq("complement_group_id", groupId);
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

  const handleDuplicateGroup = async (groupId: string) => {
    try {
      // 1. Get the original group data
      const { data: originalGroup, error: groupError } = await supabase
        .from("complement_groups")
        .select("*")
        .eq("id", groupId)
        .single();
      
      if (groupError || !originalGroup) throw groupError || new Error("Grupo não encontrado");

      // 2. Get the original group's complements
      const { data: originalComplements, error: complementsError } = await supabase
        .from("complements")
        .select("*")
        .eq("group_id", groupId);
      
      if (complementsError) throw complementsError;

      // 3. Create the duplicated group with "Cópia" suffix
      const { data: newGroup, error: newGroupError } = await supabase
        .from("complement_groups")
        .insert({
          title: `${originalGroup.title} - Cópia`,
          description: originalGroup.description,
          required: originalGroup.required,
          max_selections: originalGroup.max_selections,
          restaurant_id: originalGroup.restaurant_id,
        })
        .select()
        .single();
      
      if (newGroupError || !newGroup) throw newGroupError || new Error("Erro ao criar grupo duplicado");

      // 4. Duplicate all complements from the original group
      if (originalComplements && originalComplements.length > 0) {
        const complementsToInsert = originalComplements.map(complement => ({
          group_id: newGroup.id,
          name: complement.name,
          description: complement.description,
          price: complement.price,
          image_url: complement.image_url,
          ingredients: complement.ingredients,
          position: complement.position,
        }));

        const { error: insertComplementsError } = await supabase
          .from("complements")
          .insert(complementsToInsert);
        
        if (insertComplementsError) throw insertComplementsError;
      }

      toast({ 
        title: "Grupo duplicado", 
        description: `O grupo "${originalGroup.title}" foi duplicado com sucesso.` 
      });
      
      await loadGroupsAndComplements();
    } catch (error: any) {
      toast({ 
        title: "Erro ao duplicar grupo", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  const handleStartEditGroup = (group: ComplementGroup) => {
    setEditingGroup(group);
    setEditGroupTitle(group.title);
    setEditGroupDescription(group.description || "");
    setEditGroupRequired(group.required);
    setEditGroupMaxSelections(group.max_selections);
  };

  const handleSaveEditGroup = async () => {
    if (!editingGroup) return;
    
    try {
      const maxSel = Number(editGroupMaxSelections);
      if (!Number.isFinite(maxSel) || maxSel < 1) {
        toast({ title: "Erro", description: "Máximo de seleções deve ser um número maior que 0", variant: "destructive" });
        return;
      }

      const { error } = await supabase
        .from("complement_groups")
        .update({
          title: editGroupTitle.trim(),
          description: editGroupDescription.trim() || null,
          required: editGroupRequired,
          max_selections: maxSel,
        })
        .eq("id", editingGroup.id);
      
      if (error) throw error;
      
      toast({ title: "Grupo atualizado", description: "As alterações foram salvas com sucesso." });
      setEditingGroup(null);
      await loadGroupsAndComplements();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar grupo", description: error.message, variant: "destructive" });
    }
  };

  const handleCancelEditGroup = () => {
    setEditingGroup(null);
    setEditGroupTitle("");
    setEditGroupDescription("");
    setEditGroupRequired(false);
    setEditGroupMaxSelections(1);
  };

  const handleShowComplementForm = (groupId: string) => {
    setShowComplementForm(prev => ({ ...prev, [groupId]: true }));
    setEditingComplement(null); // Limpar edição se estiver editando
  };

  const handleHideComplementForm = (groupId: string) => {
    setShowComplementForm(prev => ({ ...prev, [groupId]: false }));
    setEditingComplement(null); // Limpar edição
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
      
      toast({ title: "Complemento criado", description: "Novo complemento adicionado ao grupo." });
      await loadGroupsAndComplements();
      handleHideComplementForm(groupId); // Esconder formulário após criar
      
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
      // Verificar se o usuário está autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      
      // Tratar o image_url corretamente
      let imageUrlValue = null;
      if (fields.imageUrl && fields.imageUrl.trim() !== '') {
        imageUrlValue = fields.imageUrl.trim();
      }
      
      const updateData = {
        name: fields.name.trim(),
        description: fields.description.trim() || null,
        price: Number(parseFloat(fields.price || "0")) || 0,
        image_url: imageUrlValue,
        ingredients: fields.ingredients.trim() || null,
      };
      
      // Primeiro, verificar se o complemento existe e pertence ao usuário
      const { data: existingComplement, error: selectError } = await supabase
        .from("complements")
        .select("*, complement_groups!inner(restaurant_id, restaurants!inner(user_id))")
        .eq("id", complementId)
        .single();
      
      if (selectError) {
        throw selectError;
      }
      
      // Verificar se o usuário tem permissão para atualizar
      if (existingComplement.complement_groups.restaurants.user_id !== user.id) {
        throw new Error("Usuário não tem permissão para atualizar este complemento");
      }
      
      // Verificar se o usuário tem acesso à tabela complements
      const { data: tableAccess, error: tableError } = await supabase
        .from("complements")
        .select("id")
        .limit(1);
      
      if (tableError) {
        throw tableError;
      }
      
      // Tentar update apenas com o campo image_url primeiro
      const { data: updatedRow1, error: updateError } = await supabase
        .from("complements")
        .update({ image_url: imageUrlValue })
        .eq("id", complementId)
        .select("id, image_url")
        .single();

      if (updateError) {
        // Tentar com todos os campos
        const { data: updatedRow2, error: fullUpdateError } = await supabase
          .from("complements")
          .update(updateData)
          .eq("id", complementId)
          .select("id, image_url")
          .single();

        if (fullUpdateError) {
          throw fullUpdateError;
        }

        if (!updatedRow2) {
          throw new Error("Nenhuma linha atualizada. Pode ser RLS bloqueando a atualização.");
        }
        if (updatedRow2.image_url !== imageUrlValue) {
          throw new Error("A imagem não foi atualizada. Verifique as políticas de acesso (RLS).");
        }
      } else {
        if (!updatedRow1) {
          throw new Error("Nenhuma linha atualizada. Pode ser RLS bloqueando a atualização.");
        }
        if (updatedRow1.image_url !== imageUrlValue) {
          throw new Error("A imagem não foi atualizada. Verifique as políticas de acesso (RLS).");
        }
      }
      
      toast({ title: "Complemento atualizado", description: "Complemento foi atualizado com sucesso." });
      setEditingComplement(null);
      await loadGroupsAndComplements();
      handleHideComplementForm(groupId); // Esconder formulário após atualizar
      
    } catch (error: any) {
      toast({ title: "Erro ao atualizar complemento", description: error.message, variant: "destructive" });
    } finally {
      setSavingComplementByGroup((prev) => ({ ...prev, [groupId]: false }));
    }
  };

  const handleEditComplement = (complement: Complement) => {
    setEditingComplement(complement);
    setShowComplementForm(prev => ({ ...prev, [complement.group_id]: true }));
  };

  const handleCancelEdit = (groupId: string) => {
    setEditingComplement(null);
    handleHideComplementForm(groupId);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Complementos</h1>
        <p className="text-muted-foreground">
          Gerencie grupos de complementos que podem ser reutilizados em múltiplos pratos
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Novo Grupo de Complementos</CardTitle>
          <CardDescription>Crie grupos como "Molhos", "Adicionais", "Pontos da carne" etc.</CardDescription>
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
                  <span className="text-sm text-muted-foreground">Usuário deve selecionar pelo menos 1</span>
                  <Switch checked={newGroupRequired} onCheckedChange={setNewGroupRequired} />
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
            <Card key={group.id} className="">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                {editingGroup?.id === group.id ? (
                  // Interface de edição
                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-title-${group.id}`}>Título do Grupo</Label>
                      <Input 
                        id={`edit-title-${group.id}`}
                        value={editGroupTitle} 
                        onChange={(e) => setEditGroupTitle(e.target.value)} 
                        placeholder="Ex: Adicionais" 
                        required 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-description-${group.id}`}>Descrição (opcional)</Label>
                      <Textarea 
                        id={`edit-description-${group.id}`}
                        value={editGroupDescription} 
                        onChange={(e) => setEditGroupDescription(e.target.value)} 
                        rows={2} 
                        placeholder="Ex: Escolha até 2 adicionais" 
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Obrigatório</Label>
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <span className="text-sm text-muted-foreground">Usuário deve selecionar pelo menos 1</span>
                          <Switch checked={editGroupRequired} onCheckedChange={setEditGroupRequired} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`edit-max-${group.id}`}>Máximo de seleções</Label>
                        <Input
                          id={`edit-max-${group.id}`}
                          type="number"
                          min={1}
                          value={editGroupMaxSelections}
                          onChange={(e) => setEditGroupMaxSelections(e.target.value === "" ? "" : Number(e.target.value))}
                          placeholder="1"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  // Interface normal
                  <div>
                    <CardTitle className="text-xl">{group.title}</CardTitle>
                    <CardDescription>
                      {group.description || "Sem descrição"} • {group.required ? "Obrigatório" : "Opcional"} • Máximo de {group.max_selections}
                    </CardDescription>
                    {group.linked_dishes && group.linked_dishes.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-muted-foreground">Vinculado aos pratos: </span>
                        <span className="font-medium text-primary">
                          {group.linked_dishes.map(dish => dish.name).join(", ")}
                        </span>
                      </div>
                    )}
                    {(!group.linked_dishes || group.linked_dishes.length === 0) && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Não vinculado a nenhum prato
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {editingGroup?.id === group.id ? (
                    // Botões de edição
                    <>
                      <Button variant="outline" size="sm" onClick={handleSaveEditGroup}>
                        <Check className="h-4 w-4 mr-2" />
                        Salvar
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancelEditGroup}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    // Botões normais
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleStartEditGroup(group)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDuplicateGroup(group.id)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Duplicar
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteGroup(group.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir grupo
                      </Button>
                    </>
                  )}
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botão Adicionar Complemento */}
                {!showComplementForm[group.id] && (
                  <div className="flex justify-center pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => handleShowComplementForm(group.id)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar Complemento
                    </Button>
                  </div>
                )}

                {/* Formulário de Complemento */}
                {showComplementForm[group.id] && (
                  <NewComplementForm
                    saving={Boolean(savingComplementByGroup[group.id])}
                    onSubmit={(fields) => handleCreateComplement(group.id, fields)}
                    editingComplement={editingComplement}
                    onUpdate={(fields) => handleUpdateComplement(group.id, editingComplement!.id, fields)}
                    onCancelEdit={() => handleCancelEdit(group.id)}
                  />
                )}
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
      // setImageUrl(""); // Comentado para preservar a imagem editada
      setIngredients("");
    }
  }, [editingComplement?.id]); // Usar apenas o ID para evitar re-renders desnecessários

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
      // setImageUrl(""); // Comentado para preservar a imagem editada
      setIngredients("");
    }
  };

  const isEditing = Boolean(editingComplement);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
          <ImageUpload
            label="Imagem do complemento (opcional)"
            description="Adicione uma foto do complemento"
            value={imageUrl}
            onChange={(url) => {
              setImageUrl(url);
            }}
            placeholder="https://exemplo.com/imagem.jpg"
            uploadOptions={{
              maxSize: 5 * 1024 * 1024, // 5MB
              compressionThreshold: 500 * 1024, // 500KB
              compressionOptions: {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.85,
                format: 'jpeg'
              }
            }}
          />
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
