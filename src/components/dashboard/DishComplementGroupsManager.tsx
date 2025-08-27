import { useEffect, useState } from "react";
import { Plus, X, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type ComplementGroup = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  required: boolean;
  max_selections: number;
  complement_count: number;
};

type DishComplementGroup = {
  id: string;
  dish_id: string;
  complement_group_id: string;
  position: number;
  created_at: string;
};

interface DishComplementGroupsManagerProps {
  dishId: string;
  restaurantId: string;
  onUpdate?: () => void;
}

export function DishComplementGroupsManager({
  dishId,
  restaurantId,
  onUpdate
}: DishComplementGroupsManagerProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<ComplementGroup[]>([]);
  const [assignedGroups, setAssignedGroups] = useState<(ComplementGroup & { position: number; relation_id: string })[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    loadGroups();
  }, [dishId, restaurantId]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      // Load all available complement groups for this restaurant
      const { data: allGroupsData, error: allGroupsError } = await supabase
        .from("complement_groups")
        .select(`
          id,
          restaurant_id,
          title,
          description,
          required,
          max_selections,
          complements!inner(id)
        `)
        .eq("restaurant_id", restaurantId);

      if (allGroupsError) throw allGroupsError;

      // Count complements for each group
      const groupsWithCounts = (allGroupsData || []).map(group => ({
        ...group,
        complement_count: group.complements?.length || 0
      })) as ComplementGroup[];

      // Load currently assigned groups for this dish
      const { data: assignedData, error: assignedError } = await supabase
        .from("dish_complement_groups")
        .select(`
          id,
          dish_id,
          complement_group_id,
          position,
          created_at,
          complement_groups!inner(
            id,
            restaurant_id,
            title,
            description,
            required,
            max_selections
          )
        `)
        .eq("dish_id", dishId)
        .order("position", { ascending: true });

      if (assignedError) throw assignedError;

      const assigned = (assignedData || []).map(item => ({
        ...(item.complement_groups as any),
        position: item.position,
        relation_id: item.id,
        complement_count: 0 // Will be filled from available groups
      }));

      // Fill complement counts for assigned groups
      const assignedWithCounts = assigned.map(assignedGroup => {
        const fullGroup = groupsWithCounts.find(g => g.id === assignedGroup.id);
        return {
          ...assignedGroup,
          complement_count: fullGroup?.complement_count || 0
        };
      });

      // Filter available groups to exclude already assigned ones
      const assignedIds = assigned.map(g => g.id);
      const available = groupsWithCounts.filter(g => !assignedIds.includes(g.id));

      setAvailableGroups(available);
      setAssignedGroups(assignedWithCounts);

    } catch (error: any) {
      toast({
        title: "Erro ao carregar grupos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignGroups = async () => {
    if (selectedGroupIds.length === 0) return;

    setSaving(true);
    try {
      // Get the next position
      const maxPosition = Math.max(0, ...assignedGroups.map(g => g.position));
      
      // Create relationships for selected groups
      const insertData = selectedGroupIds.map((groupId, index) => ({
        dish_id: dishId,
        complement_group_id: groupId,
        position: maxPosition + index + 1
      }));

      const { error } = await supabase
        .from("dish_complement_groups")
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Grupos atribuídos",
        description: `${selectedGroupIds.length} grupo(s) adicionado(s) ao prato.`
      });

      setSelectedGroupIds([]);
      await loadGroups();
      onUpdate?.();

    } catch (error: any) {
      toast({
        title: "Erro ao atribuir grupos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUnassignGroup = async (relationId: string, groupTitle: string) => {
    if (!confirm(`Remover o grupo "${groupTitle}" deste prato?`)) return;

    try {
      const { error } = await supabase
        .from("dish_complement_groups")
        .delete()
        .eq("id", relationId);

      if (error) throw error;

      toast({
        title: "Grupo removido",
        description: `Grupo "${groupTitle}" removido do prato.`
      });

      await loadGroups();
      onUpdate?.();

    } catch (error: any) {
      toast({
        title: "Erro ao remover grupo",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleUpdatePosition = async (relationId: string, newPosition: number) => {
    try {
      const { error } = await supabase
        .from("dish_complement_groups")
        .update({ position: newPosition })
        .eq("id", relationId);

      if (error) throw error;

      await loadGroups();
      onUpdate?.();

    } catch (error: any) {
      toast({
        title: "Erro ao atualizar posição",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Grupos de Complementos Atribuídos
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("/dashboard/complements", "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Gerenciar Grupos
            </Button>
          </CardTitle>
          <CardDescription>
            Grupos de complementos e adicionais associados a este prato
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assignedGroups.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhum grupo de complementos atribuído a este prato
            </div>
          ) : (
            <div className="space-y-4">
              {assignedGroups.map((group, index) => (
                <div
                  key={group.id}
                  className="flex items-start justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{group.title}</h4>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {group.complement_count}
                      </Badge>
                      <Badge variant={group.required ? "default" : "secondary"}>
                        {group.required ? "Obrigatório" : "Opcional"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {group.description || "Sem descrição"} • Máximo de {group.max_selections}
                    </p>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`position-${group.id}`} className="text-xs">
                        Posição:
                      </Label>
                      <Input
                        id={`position-${group.id}`}
                        type="number"
                        min="1"
                        value={group.position}
                        onChange={(e) => {
                          const newPos = parseInt(e.target.value) || 1;
                          handleUpdatePosition(group.relation_id, newPos);
                        }}
                        className="w-20 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnassignGroup(group.relation_id, group.title)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {availableGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Atribuir Novos Grupos</CardTitle>
            <CardDescription>
              Selecione grupos de complementos disponíveis para adicionar ao prato
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {availableGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border"
                >
                  <Checkbox
                    id={`group-${group.id}`}
                    checked={selectedGroupIds.includes(group.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedGroupIds([...selectedGroupIds, group.id]);
                      } else {
                        setSelectedGroupIds(selectedGroupIds.filter(id => id !== group.id));
                      }
                    }}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={`group-${group.id}`}
                      className="flex items-center gap-2 font-medium cursor-pointer"
                    >
                      {group.title}
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {group.complement_count}
                      </Badge>
                      <Badge variant={group.required ? "default" : "secondary"}>
                        {group.required ? "Obrigatório" : "Opcional"}
                      </Badge>
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {group.description || "Sem descrição"} • Máximo de {group.max_selections}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {selectedGroupIds.length > 0 && (
              <>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedGroupIds.length} grupo(s) selecionado(s)
                  </div>
                  <Button
                    onClick={handleAssignGroups}
                    disabled={saving}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {saving ? "Atribuindo..." : "Atribuir Grupos"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {availableGroups.length === 0 && assignedGroups.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <div className="text-muted-foreground mb-4">
              Nenhum grupo de complementos disponível
            </div>
            <Button
              variant="outline"
              onClick={() => window.open("/dashboard/complements", "_blank")}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeiro Grupo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
