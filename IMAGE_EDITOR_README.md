# Editor de Imagem - Menu Mestre Fácil

## Visão Geral

O Editor de Imagem é uma funcionalidade avançada que permite aos usuários redimensionar, rotacionar e posicionar suas imagens antes de salvá-las. Isso garante que as fotos sejam exibidas da melhor forma possível no cardápio digital.

## Funcionalidades Principais

### 🎯 **Crop Inteligente**
- **Proporções predefinidas**: 1:1 (quadrado), 4:3 (padrão), 16:9 (widescreen), 3:2 (foto), 5:4 (retrato), 3:1 (banner)
- **Crop livre**: Permite escolher proporções personalizadas
- **Área de seleção**: Interface intuitiva para escolher qual parte da imagem será exibida

### 🔄 **Transformações**
- **Rotação**: Gire a imagem em qualquer ângulo (-180° a +180°)
- **Escala**: Redimensione a imagem mantendo a qualidade
- **Reset**: Volte às configurações originais com um clique

### ⚙️ **Configurações de Exportação**
- **Qualidade ajustável**: De 50% a 100% para otimizar tamanho vs qualidade
- **Dimensões máximas**: Configure limites para largura e altura
- **Formato otimizado**: Exportação em JPEG de alta qualidade

## Como Usar

### 1. **Upload da Imagem**
```tsx
import { ImageUpload } from '@/components/ui/image-upload';

function MyComponent() {
  const [imageUrl, setImageUrl] = useState('');

  return (
    <ImageUpload
      value={imageUrl}
      onChange={setImageUrl}
      label="Imagem do Produto"
      editorSettings={{
        enabled: true,
        defaultAspectRatio: '16:9',
        maxWidth: 1920,
        maxHeight: 1080,
        defaultQuality: 0.9,
        allowRotation: true,
        allowScaling: true,
        allowFreeCrop: true,
      }}
    />
  );
}
```

### 2. **Configurações Básicas**
```tsx
const basicSettings = {
  enabled: true,                    // Ativa o editor
  defaultAspectRatio: '16:9',      // Proporção padrão
  maxWidth: 1920,                  // Largura máxima
  maxHeight: 1080,                 // Altura máxima
  defaultQuality: 0.9,             // Qualidade padrão (90%)
};
```

### 3. **Configurações Avançadas**
```tsx
const advancedSettings = {
  ...basicSettings,
  allowRotation: true,             // Permite rotação
  allowScaling: true,              // Permite redimensionamento
  allowFreeCrop: true,             // Permite proporções livres
};
```

## Presets Recomendados

### 📱 **Cardápio Digital (16:9)**
```tsx
{
  defaultAspectRatio: '16:9',
  maxWidth: 1920,
  maxHeight: 1080,
  defaultQuality: 0.9,
}
```
**Ideal para**: Banners principais, cards de destaque

### 🖼️ **Thumbnail (1:1)**
```tsx
{
  defaultAspectRatio: '1:1',
  maxWidth: 800,
  maxHeight: 800,
  defaultQuality: 0.8,
}
```
**Ideal para**: Miniaturas, avatares, ícones

### 📸 **Foto de Produto (4:3)**
```tsx
{
  defaultAspectRatio: '4:3',
  maxWidth: 1600,
  maxHeight: 1200,
  defaultQuality: 0.9,
}
```
**Ideal para**: Fotos de pratos, produtos

### 🎨 **Banner (3:1)**
```tsx
{
  defaultAspectRatio: '3:1',
  maxWidth: 1200,
  maxHeight: 400,
  defaultQuality: 0.85,
}
```
**Ideal para**: Headers, banners promocionais

## Integração com Componentes Existentes

### **ImageUpload com Editor**
O componente `ImageUpload` agora inclui automaticamente o editor de imagem:

```tsx
<ImageUpload
  value={imageUrl}
  onChange={setImageUrl}
  editorSettings={{
    enabled: true,
    defaultAspectRatio: '16:9',
    maxWidth: 1920,
    maxHeight: 1080,
    defaultQuality: 0.9,
  }}
/>
```

### **Configurações Globais**
Configure o editor para toda a aplicação:

```tsx
// src/config/image-editor-config.ts
export const defaultImageEditorSettings = {
  enabled: true,
  defaultAspectRatio: '16:9',
  maxWidth: 1920,
  maxHeight: 1080,
  defaultQuality: 0.9,
  allowRotation: true,
  allowScaling: true,
  allowFreeCrop: true,
};
```

## Exemplos de Uso

### **Página de Pratos**
```tsx
function NewDishPage() {
  const [imageUrl, setImageUrl] = useState('');

  return (
    <div>
      <ImageUpload
        value={imageUrl}
        onChange={setImageUrl}
        label="Imagem do Prato"
        description="Escolha uma imagem e edite para melhor apresentação"
        editorSettings={{
          enabled: true,
          defaultAspectRatio: '4:3',  // Ideal para fotos de pratos
          maxWidth: 1600,
          maxHeight: 1200,
          defaultQuality: 0.9,
          allowRotation: true,
          allowScaling: true,
          allowFreeCrop: false,        // Força proporção 4:3
        }}
      />
    </div>
  );
}
```

### **Página de Categorias**
```tsx
function CategoryForm() {
  const [imageUrl, setImageUrl] = useState('');

  return (
    <div>
      <ImageUpload
        value={imageUrl}
        onChange={setImageUrl}
        label="Imagem da Categoria"
        editorSettings={{
          enabled: true,
          defaultAspectRatio: '16:9',  // Ideal para banners
          maxWidth: 1200,
          maxHeight: 675,
          defaultQuality: 0.85,
          allowRotation: false,         // Não permite rotação
          allowScaling: true,
          allowFreeCrop: true,
        }}
      />
    </div>
  );
}
```

## Configurações de Performance

### **Otimizações Recomendadas**
- **Qualidade**: 80-90% para web (equilibra qualidade e tamanho)
- **Dimensões**: Máximo 1920×1080 para melhor performance
- **Formato**: JPEG para fotos, PNG para imagens com transparência

### **Limites de Arquivo**
- **Tamanho máximo**: 10MB por upload
- **Formatos suportados**: JPEG, PNG, WebP, AVIF
- **Compressão automática**: Ativada para arquivos > 1MB

## Troubleshooting

### **Problemas Comuns**

#### **Editor não abre**
- Verifique se `editorSettings.enabled` está `true`
- Confirme se a imagem foi carregada corretamente
- Verifique o console do navegador para erros

#### **Imagem não salva**
- Certifique-se de que uma área foi selecionada (crop)
- Verifique as permissões de upload
- Confirme se o Supabase Storage está configurado

#### **Qualidade baixa**
- Aumente o valor de `defaultQuality` (0.8-0.9)
- Verifique se as dimensões máximas não são muito baixas
- Use formatos de alta qualidade (PNG, WebP)

### **Logs e Debug**
```tsx
// Ative logs detalhados
console.log('Editor Settings:', editorSettings);
console.log('Image URL:', imageUrl);
console.log('Crop Data:', completedCrop);
```

## Personalização Avançada

### **Temas Customizados**
```tsx
// src/components/ui/image-editor.tsx
const customTheme = {
  primary: '#your-color',
  background: '#your-bg',
  border: '#your-border',
};
```

### **Funcionalidades Adicionais**
```tsx
// Adicione filtros de imagem
const imageFilters = {
  brightness: 1.0,
  contrast: 1.0,
  saturation: 1.0,
  blur: 0,
};
```

## Suporte e Contribuição

### **Reportar Bugs**
- Use o sistema de issues do GitHub
- Inclua screenshots e logs de erro
- Descreva os passos para reproduzir

### **Sugerir Funcionalidades**
- Abra uma discussão no GitHub
- Descreva o caso de uso
- Inclua exemplos de implementação

### **Contribuir**
- Fork o repositório
- Crie uma branch para sua feature
- Envie um pull request com testes

---

**Desenvolvido com ❤️ para o Menu Mestre Fácil**
