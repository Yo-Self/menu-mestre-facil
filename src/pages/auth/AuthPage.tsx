import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateSlug, generateUniqueSlug } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "organization">("individual");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { user }, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!user) throw new Error("Erro ao criar usuário");

      // Criar perfil com slug
      let slug = "";
      if (accountType === "organization") {
        if (!organizationSlug.trim()) {
          throw new Error("Slug da organização é obrigatório");
        }
        slug = await generateUniqueSlug(generateSlug(organizationSlug), 'profiles');
      } else {
        slug = await generateUniqueSlug(generateSlug(fullName), 'profiles');
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .insert([
          {
            id: user.id,
            email,
            full_name: fullName,
            slug,
            is_organization: accountType === "organization",
          },
        ]);

      if (profileError) throw profileError;

      toast({
        title: "Conta criada com sucesso!",
        description: "Verifique seu email para confirmar a conta.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao criar conta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAccountTypeChange = (value: string) => {
    setAccountType(value as "individual" | "organization");
    if (value === "individual") {
      setOrganizationSlug("");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Restaurante Pro
          </CardTitle>
          <CardDescription>
            Sistema de gestão para restaurantes
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">
                    {accountType === "organization" ? "Nome da Organização" : "Nome Completo"}
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="accountType">Tipo de Conta</Label>
                  <Select value={accountType} onValueChange={handleAccountTypeChange} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de conta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Pessoa Física</SelectItem>
                      <SelectItem value="organization">Organização</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {accountType === "organization" && (
                  <div>
                    <Label htmlFor="organizationSlug">Identificador da Organização (Slug)</Label>
                    <Input
                      id="organizationSlug"
                      type="text"
                      value={organizationSlug}
                      onChange={(e) => setOrganizationSlug(e.target.value)}
                      placeholder="ex: minha-empresa"
                      required
                    />
                    <p className="text-sm text-muted-foreground">
                      Este será o identificador único da sua organização na URL
                    </p>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Criando conta..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}