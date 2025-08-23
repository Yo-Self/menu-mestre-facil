# Guia de Compressão de Imagens

## Visão Geral

O sistema de compressão de imagens foi implementado usando a biblioteca [pica](https://www.npmjs.com/package/pica), que oferece compressão de alta qualidade no navegador utilizando WebAssembly, Web Workers e filtros avançados.

## Funcionalidades

### ✅ Compressão Automática
- **Ativada por padrão** para imagens maiores que 1MB
- **Redimensionamento inteligente** mantendo proporções
- **Compressão de alta qualidade** com filtros otimizados
- **Suporte a múltiplos formatos**: JPEG, WebP, PNG

### ✅ Configurações Personalizáveis
- Dimensões máximas (largura/altura)
- Qualidade de compressão (50-100%)
- Formato de saída (JPEG, WebP, PNG)
- Configurações avançadas de nitidez

### ✅ Otimizações Automáticas
- **Sugestões inteligentes** baseadas no tamanho original
- **Fallback robusto** se a compressão falhar
- **Feedback visual** com estatísticas de redução

## Como Usar

### 1. Upload Básico (Compressão Automática)

```tsx
import { ImageUpload } from '@/components/ui/image-upload';

function MyComponent() {
  const [imageUrl, setImageUrl] = useState('');

  return (
    <ImageUpload
      value={imageUrl}
      onChange={setImageUrl}
      label="Imagem do Produto"
    />
  );
}
```

### 2. Configurações Personalizadas

```tsx
import { ImageUpload } from '@/components/ui/image-upload';
import { ImageUploadOptions } from '@/hooks/useImageUpload';

function MyComponent() {
  const [imageUrl, setImageUrl] = useState('');

  const uploadOptions: ImageUploadOptions = {
    enableCompression: true,
    compressionThreshold: 500 * 1024, // 500KB
    compressionOptions: {
      maxWidth: 1200,
      maxHeight: 800,
      quality: 0.80,
      format: 'jpeg'
    }
  };

  return (
    <ImageUpload
      value={imageUrl}
      onChange={setImageUrl}
      uploadOptions={uploadOptions}
    />
  );
}
```

### 3. Usando o Serviço Diretamente

```tsx
import { imageCompressionService } from '@/services/image-compression';

async function compressImage(file: File) {
  try {
    const result = await imageCompressionService.compressImage(file, {
      maxWidth: 1920,
      maxHeight: 1080,
      quality: 0.85,
      format: 'jpeg'
    });

    console.log(`Redução: ${result.compressionRatio.toFixed(1)}%`);
    console.log(`Tamanho original: ${result.originalSize} bytes`);
    console.log(`Tamanho comprimido: ${result.compressedSize} bytes`);

    return result.file;
  } catch (error) {
    console.error('Erro na compressão:', error);
    return file; // Retorna arquivo original em caso de erro
  }
}
```

## Configurações Recomendadas

### 🌐 Para Web (Geral)
```tsx
{
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.85,
  format: 'jpeg'
}
```

### 📱 Para Mobile/Thumbnails
```tsx
{
  maxWidth: 800,
  maxHeight: 600,
  quality: 0.75,
  format: 'jpeg'
}
```

### 🎯 Para Alta Qualidade
```tsx
{
  maxWidth: 2560,
  maxHeight: 1440,
  quality: 0.90,
  format: 'webp'
}
```

### ⚡ Para Máxima Compressão
```tsx
{
  maxWidth: 1200,
  maxHeight: 800,
  quality: 0.70,
  format: 'jpeg'
}
```

## Presets Disponíveis

O sistema inclui presets predefinidos baseados no tamanho do arquivo original:

- **> 10MB**: Compressão agressiva (1200x800, 75% qualidade)
- **> 5MB**: Compressão moderada (1600x1200, 80% qualidade)  
- **> 2MB**: Compressão leve (1920x1080, 85% qualidade)
- **< 2MB**: Apenas otimização (1920x1080, 90% qualidade)

## Formatos Suportados

### 📥 Entrada
- JPEG/JPG
- PNG
- WebP
- AVIF

### 📤 Saída
- **JPEG**: Melhor para fotos, menor tamanho
- **WebP**: Formato moderno, boa compressão
- **PNG**: Suporte a transparência, maior qualidade

## Performance

### ⚡ Otimizações
- **Web Workers**: Processamento não-bloqueante
- **WebAssembly**: Performance nativa quando disponível
- **Cache inteligente**: Reutilização de workers
- **Processamento por tiles**: Controle de memória

### 📊 Resultados Típicos
- **Redução média**: 60-80% do tamanho original
- **Tempo de processamento**: 1-3 segundos para imagens de 5MB
- **Qualidade visual**: Imperceptível para uso web

## Testando a Funcionalidade

Uma página de teste foi criada para demonstrar todas as funcionalidades:

```bash
# Acesse no navegador após iniciar o projeto
/dashboard/compression-test
```

Esta página permite:
- Testar diferentes configurações
- Visualizar resultados em tempo real
- Comparar tamanhos antes/depois
- Experimentar com presets

## Troubleshooting

### ❗ Problemas Comuns

1. **Compressão não ativada**
   - Verifique se `enableCompression: true`
   - Confirme se o arquivo excede `compressionThreshold`

2. **Erro de memória**
   - Reduza `maxWidth/maxHeight`
   - Use qualidade menor
   - Verifique tamanho do arquivo original

3. **Qualidade ruim**
   - Aumente o valor de `quality`
   - Ajuste `unsharpAmount` para mais nitidez
   - Considere usar formato PNG para imagens com poucas cores

### 🔧 Configuração de Debug

```tsx
// Habilitar logs detalhados
const uploadOptions = {
  enableCompression: true,
  compressionOptions: {
    // ... suas configurações
  }
};

// O sistema automaticamente logará:
// - Tamanhos antes/depois
// - Tempo de processamento
// - Configurações aplicadas
```

## Integração com Componentes Existentes

A compressão foi integrada nos seguintes componentes:

- ✅ `ImageUpload` - Upload geral de imagens
- ✅ `NewDishPage` - Imagens de pratos
- ✅ `EditDishPage` - Edição de pratos
- ✅ `NewCategoryPage` - Imagens de categorias
- ✅ `NewRestaurantPage` - Imagens de restaurantes
- ✅ `EditRestaurantPage` - Edição de restaurantes

Todos estes componentes agora aplicam compressão automaticamente por padrão.
