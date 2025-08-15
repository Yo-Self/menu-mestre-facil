import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MenuRow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export default function EditMenuPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");


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
      const menu = data as MenuRow;
      setName(menu.name);
      setDescription(menu.description || "");

    } catch (error: any) {
      toast({ title: "Erro ao carregar menu", description: error.message, variant: "destructive" });
      navigate("/dashboard/menus");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("menus")
        .update({
          name,
          description: description || null,

        })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Menu atualizado", description: `${name} foi atualizado com sucesso.` });
      navigate(`/dashboard/menus/${id}`);
    } catch (error: any) {
      toast({ title: "Erro ao atualizar menu", description: error.message, variant: "destructive" });
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/dashboard/menus/${id}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Editar Menu</h1>
          <p className="text-muted-foreground">Atualize as informações do menu</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações do Menu</CardTitle>
          <CardDescription>Edite os dados do menu</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>



            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate(`/dashboard/menus/${id}`)}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
