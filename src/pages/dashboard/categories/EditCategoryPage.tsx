import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CategoryRow {
  id: string;
  name: string;
  image_url: string;
}

export default function EditCategoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!id) return;
    fetchCategory(id);
  }, [id]);

  const fetchCategory = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("id", categoryId)
        .single();
      if (error) throw error;
      const cat = data as CategoryRow;
      setName(cat.name);
      setImageUrl(cat.image_url);
    } catch (error: any) {
      toast({ title: "Erro ao carregar categoria", description: error.message, variant: "destructive" });
      navigate("/gestor/dashboard/categories");
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
        .from("categories")
        .update({ name, image_url: imageUrl })
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Categoria atualizada", description: `${name} foi atualizada com sucesso.` });
      navigate("/gestor/dashboard/categories");
    } catch (error: any) {
      toast({ title: "Erro ao atualizar categoria", description: error.message, variant: "destructive" });
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/gestor/dashboard/categories")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">Editar Categoria</h1>
          <p className="text-muted-foreground">Atualize as informações da categoria</p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Informações da Categoria</CardTitle>
          <CardDescription>Edite os dados da categoria</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="image">URL da Imagem</Label>
              <Input id="image" type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar Alterações"}</Button>
              <Button type="button" variant="outline" onClick={() => navigate("/gestor/dashboard/categories")}>Cancelar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
