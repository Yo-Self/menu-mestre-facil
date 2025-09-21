# Funcionalidade de Endereço do Restaurante

Esta funcionalidade permite que os restaurantes tenham um endereço completo com integração ao Google Maps Platform API para autocompletar endereços e obter coordenadas geográficas.

## Configuração

### 1. Google Maps API Key

Para usar esta funcionalidade, você precisa de uma chave da API do Google Maps:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Navegue até "APIs e serviços" > "Biblioteca"
4. Ative as seguintes APIs:
   - Maps JavaScript API
   - Places API
5. Vá para "APIs e serviços" > "Credenciais"
6. Clique em "Criar credenciais" > "Chave de API"
7. Configure as restrições de aplicativo conforme necessário

### 2. Variáveis de Ambiente

Adicione a chave da API no seu arquivo `.env.local`:

```env
VITE_GOOGLE_MAPS_API_KEY=sua-chave-da-api-aqui
```

## Funcionalidades

### Componente AddressSelector

O componente `AddressSelector` fornece:

- **Autocompletar de endereços**: Sugestões automáticas baseadas no Google Places API
- **Validação de endereços**: Restrito ao Brasil por padrão
- **Coordenadas geográficas**: Latitude e longitude automaticamente capturadas
- **Interface intuitiva**: Campo de entrada com ícone e feedback visual

### Campos do Banco de Dados

A tabela `restaurants` agora inclui:

- `address`: Endereço completo formatado
- `latitude`: Coordenada de latitude (DECIMAL(10, 8))
- `longitude`: Coordenada de longitude (DECIMAL(11, 8))

### Formulários Atualizados

- **Novo Restaurante**: Campo de endereço obrigatório com autocompletar
- **Editar Restaurante**: Campo de endereço editável com dados existentes

## Uso

### No Cadastro de Restaurante

1. Preencha os dados básicos do restaurante
2. No campo "Endereço do Restaurante", digite o endereço
3. Selecione uma das sugestões do Google Maps
4. As coordenadas serão automaticamente capturadas
5. Salve o restaurante

### Na Edição de Restaurante

1. O endereço atual será exibido no campo
2. Você pode editar digitando um novo endereço
3. Selecione uma nova sugestão se necessário
4. As coordenadas serão atualizadas automaticamente

## Benefícios

- **Precisão**: Endereços validados pelo Google Maps
- **Coordenadas**: Latitude e longitude para futuras funcionalidades de localização
- **UX**: Interface intuitiva com autocompletar
- **Consistência**: Endereços formatados de forma padronizada

## Próximos Passos

Com as coordenadas armazenadas, você pode implementar:

- Mapa interativo mostrando a localização do restaurante
- Busca de restaurantes por proximidade
- Integração com serviços de entrega
- Análise de dados geográficos

## Troubleshooting

### API Key não configurada
Se você ver o aviso "Chave da API do Google Maps não configurada", certifique-se de:
1. Adicionar `VITE_GOOGLE_MAPS_API_KEY` no arquivo `.env.local`
2. Reiniciar o servidor de desenvolvimento

### Erro de carregamento da API
Se a API do Google Maps não carregar:
1. Verifique se a chave da API está correta
2. Confirme se as APIs necessárias estão ativadas
3. Verifique as restrições de aplicativo na chave da API

### Endereços não aparecem
Se as sugestões de endereço não aparecem:
1. Verifique se a Places API está ativada
2. Confirme se não há restrições muito restritivas na chave da API
3. Teste com endereços brasileiros (funcionalidade restrita ao Brasil)
