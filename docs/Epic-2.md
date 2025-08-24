### **PRD Brownfield: Sistema de Importação MenuDino**

#### **1\. Análise Introdutória do Projeto e Contexto**

* **Fonte da Análise**: MENUDINO\_IMPORT\_SYSTEM.md.  
* **Estado Atual do Projeto**: Sistema de importação de menus via *scraping* com Supabase Edge Functions, projetado para resolver problemas de CORS e otimizar o processo com cache e atualizações em tempo real.  
* **Escopo da Melhoria**: Formalizar e implementar o fluxo de importação assíncrona, incluindo a extração de complementos e a gestão detalhada de estados.  
* **Metas**: Eliminar bloqueios de CORS, melhorar a UX com feedback imediato, aumentar a eficiência e criar um sistema auditável.

#### **2\. Requisitos**

##### **Requisitos Funcionais (FR)**

1. **FR1**: O sistema deve aceitar uma URL do MenuDino enviada pelo frontend para a Edge Function.  
2. **FR2**: Ao receber uma URL, a Edge Function deve criar imediatamente um registo na tabela import\_logs com o estado inicial scraping.  
3. **FR3**: A Edge Function deve responder imediatamente ao frontend com o id do registo de importação criado.  
4. **FR4**: O processo de scraping da URL deve ser executado como uma tarefa em background (EdgeRuntime.waitUntil).  
5. **FR5**: O sistema deve extrair os dados estruturados do menu, incluindo informações do restaurante, categorias, pratos, descrições, preços e **complementos**.  
6. **FR6**: Após a extração, o sistema deve atualizar o registo em import\_logs com os dados extraídos (scraped\_data) e alterar o estado para preview\_ready.  
7. **FR7**: O frontend deve subscrever às alterações no registo de importação em tempo real usando o id recebido.  
8. **FR8**: O sistema deve expor um endpoint para que o frontend possa solicitar a importação final dos dados, usando o id do registo.  
9. **FR9**: Ao receber a confirmação de importação, o sistema deve ler os dados de scraped\_data e inseri-los nas tabelas de destino.  
   * **FR9.1**: A importação dos dados deve ser uma operação atómica (transacional), utilizando **Drizzle ORM**. Se qualquer parte da inserção falhar, todas as alterações devem ser revertidas (rollback).  
10. **FR10**: O estado do registo deve ser atualizado para import\_success ou para um estado de falha (import\_failed, scraping\_failed, etc.) em caso de erro.  
11. **FR11**: Antes de guardar em preview\_ready, a Edge Function deve validar e limpar (*sanitize*) os dados extraídos.  
    * **FR11.1**: Regras de validação: preços devem ser numéricos, nomes não podem ser vazios, e tags de script devem ser removidas.  
12. **FR12**: O sistema deve ter uma estratégia para lidar com reimportações.  
    * **FR12.1**: Para preview\_ready, deve retornar o registo existente. Para import\_success, deve retornar o registo existente se tiver sido criado há menos de 2 minutos.  
13. **FR13**: A interface do utilizador deve exibir um indicador de progresso claro enquanto o estado for scraping ou processing.  
14. **FR14**: O sistema deve gerir os estados do processo de forma estrita, conforme a seção 3\.

##### **Requisitos Não Funcionais (NFR)**

1. **NFR1**: A interface do utilizador deve permanecer responsiva.  
   * **NFR1.1**: A resposta inicial da API deve ocorrer em menos de 500ms (p95).  
2. **NFR2**: O sistema deve ser auditável através da tabela import\_logs.  
3. **NFR3**: A solução deve ser escalável.  
4. **NFR4**: O tratamento de erros deve ser robusto.  
   * **NFR4.1**: Deve implementar retentativas automáticas (*Exponential Backoff*) para falhas de rede transitórias.  
5. **NFR5**: A segurança deve ser garantida através de Row Level Security (RLS).

##### **Requisitos de Compatibilidade (CR)**

1. **CR1**: Integração com o frontend React existente via Supabase Client.  
2. **CR2**: Compatibilidade com o esquema de banco de dados existente.  
3. **CR3**: Não introduzir alterações que quebrem a funcionalidade existente.  
4. **CR4**: Compatibilidade com o sistema de autenticação e a tabela public.profiles.

#### **3\. Estados e Transições**

| Estado | Descrição | Transições Válidas Para |
| :---- | :---- | :---- |
| scraping | A extração de dados está em andamento. | processing, scraping\_failed |
| processing | Os dados estão a ser validados. | preview\_ready, processing\_failed |
| preview\_ready | Os dados estão prontos para visualização. | importing, cancelled |
| importing | A importação final está a decorrer. | import\_success, import\_failed |
| import\_success | Importação concluída com sucesso. | (Estado final) |
| import\_failed | Erro durante a importação final. | preview\_ready (permite retentativa) |
| scraping\_failed | Erro durante a extração de dados. | (Estado final de falha) |
| processing\_failed | Erro durante a validação dos dados. | (Estado final de falha) |
| cancelled | O utilizador cancelou o processo. | (Estado final) |

#### **4\. Estrutura de Épicos e Histórias de Utilizador**

##### **Épico 1: Backend Core \- Processamento Assíncrono da Importação**

**Objetivo do Épico**: Construir o serviço de backend completo que gere o ciclo de vida de uma importação de menu. A conclusão deste épico resultará num serviço robusto e testável, pronto para ser consumido pelo frontend.

* **História 1.1**: Configuração da Infraestrutura da Base de Dados  
* **História 1.2**: Implementação do Endpoint de Início de Importação (/scrape)  
* **História 1.3**: Implementação da Lógica de Scraping em Background  
* **História 1.4**: Processamento e Validação dos Dados Extraídos  
* **História 1.5**: Implementação do Endpoint de Confirmação de Importação (/import)  
* **História 1.6**: Gestão de Reimportações Duplicadas  
* **História 1.7**: Garantir Notificações de Estado em Tempo Real

##### **Épico 2: Frontend \- Interface de Importação e Visualização**

**Objetivo do Épico**: Desenvolver os componentes de frontend necessários para que o utilizador possa iniciar, acompanhar e confirmar a importação de um menu. A interface deve ser reativa, respondendo em tempo real às atualizações de estado enviadas pelo backend.

**História 2.1: Criação do Componente de Início de Importação**

Como um utilizador,  
Eu quero um campo de texto e um botão para submeter uma URL do MenuDino,  
Para que eu possa iniciar o processo de importação do menu.

* **Critérios de Aceitação**:  
  1. Existe um componente React que contém um campo de entrada de texto (\<input type="text"\>) e um botão (\<button\>).  
  2. O utilizador pode inserir uma URL no campo de texto.  
  3. Clicar no botão "Importar" (enquanto o campo não está vazio) invoca a função que chama o endpoint /scrape do backend. (FR1)  
  4. Enquanto a chamada à API está em andamento, o botão deve ser desativado para evitar submissões múltiplas.  
  5. Após receber uma resposta bem-sucedida da API (com o importLogId), o estado da aplicação é atualizado para indicar que um processo de importação foi iniciado.  
  6. Se a chamada à API falhar, uma mensagem de erro deve ser exibida ao utilizador.

**História 2.2: Acompanhamento do Progresso da Importação em Tempo Real**

Como um utilizador,  
Eu quero ver o estado atual do processo de importação em tempo real,  
Para que eu saiba o que está a acontecer sem precisar de atualizar a página.

* **Critérios de Aceitação**:  
  1. Após iniciar uma importação (História 2.1), o frontend utiliza o importLogId recebido para subscrever ao canal de Realtime do Supabase para esse registo específico. (FR7)  
  2. O componente escuta por atualizações (eventos UPDATE) nesse canal.  
  3. Quando o estado do log é scraping ou processing, um indicador de progresso claro (ex: um *spinner* com o texto "A extrair dados...") é exibido na UI. (FR13)  
  4. Quando uma atualização de estado é recebida, a UI reflete imediatamente a nova informação sem necessidade de uma atualização manual da página.  
  5. Se a subscrição ao canal de Realtime falhar, uma mensagem de erro apropriada é mostrada.  
  6. Quando o componente é desmontado (ex: o utilizador navega para outra página), a subscrição ao canal de Realtime é terminada para evitar fugas de memória.

**História 2.3: Visualização do Preview do Menu Importado**

Como um utilizador,  
Eu quero ver os dados do menu que foram extraídos,  
Para que eu possa verificar se estão corretos antes de confirmar a importação final.

* **Critérios de Aceitação**:  
  1. Quando o frontend recebe uma atualização de estado para 'preview\_ready', o indicador de progresso é substituído pela visualização dos dados do menu.  
  2. A UI lê os dados do campo scraped\_data do registo recebido via Realtime.  
  3. O nome do restaurante, as categorias e os pratos (com nome, descrição e preço) são exibidos de forma clara e legível.  
  4. Os complementos de cada prato, se existirem, também são exibidos.  
  5. Dois botões de ação são mostrados: "Confirmar Importação" e "Cancelar".  
  6. Se os dados em scraped\_data estiverem vazios ou malformados, uma mensagem de erro informativa é exibida em vez do preview.