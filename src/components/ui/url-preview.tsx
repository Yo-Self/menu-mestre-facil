import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface UrlPreviewProps {
  title: string;
  description: string;
  url: string;
  type: "organization" | "restaurant" | "menu";
}

export function UrlPreview({ title, description, url, type }: UrlPreviewProps) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "URL copiada!",
        description: "A URL foi copiada para a área de transferência.",
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar a URL.",
        variant: "destructive",
      });
    }
  };

  const handleOpen = () => {
    window.open(url, "_blank");
  };

  const getTypeColor = () => {
    switch (type) {
      case "organization":
        return "bg-blue-100 text-blue-800";
      case "restaurant":
        return "bg-green-100 text-green-800";
      case "menu":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeLabel = () => {
    switch (type) {
      case "organization":
        return "Organização";
      case "restaurant":
        return "Restaurante";
      case "menu":
        return "Menu Público";
      default:
        return "URL";
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge className={getTypeColor()}>{getTypeLabel()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
          <code className="text-sm flex-1 break-all">{url}</code>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 w-8 p-0"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpen}
              className="h-8 w-8 p-0"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
