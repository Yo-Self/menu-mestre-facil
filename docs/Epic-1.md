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

**Objetivo do Épico**: Construir o serviço de backend completo que gere o ciclo de vida de uma importação de menu. Isto inclui a criação da infraestrutura da base de dados, a implementação dos endpoints da API, a lógica de *scraping* e validação em background, e a gestão de estados e erros. A conclusão deste épico resultará num serviço robusto e testável, pronto para ser consumido pelo frontend.

**História 1.1: Configuração da Infraestrutura da Base de Dados**

Como um desenvolvedor,

Eu quero criar e configurar a tabela import\_logs e o tipo import\_status na base de dados,

Para que o sistema tenha uma base sólida para armazenar o estado e os dados de cada processo de importação.

* **Critérios de Aceitação**:  
  1. Um novo *script* de migração do Supabase é criado.  
  2. O *script* define o ENUM public.import\_status com todos os estados especificados na Seção 3\.  
  3. O *script* cria a tabela public.import\_logs com todas as colunas, tipos e restrições corretas, utilizando o novo ENUM para a coluna status.  
  4. A política de Row Level Security (RLS) é aplicada à tabela, garantindo que um utilizador só pode aceder aos seus próprios registos.  
  5. A migração é aplicada com sucesso ao ambiente de desenvolvimento local.

**História 1.2: Implementação do Endpoint de Início de Importação (/scrape)**

Como um desenvolvedor,

Eu quero implementar o endpoint /scrape na Edge Function,

Para que o frontend possa iniciar um novo processo de importação de forma assíncrona.

* **Critérios de Aceitação**:
  0. Usar DrizzleORM para manipular o banco de dados, criando o arquivo de
     schema do banco.
  1. A Edge Function expõe um endpoint POST /scrape que aceita um JSON com uma url.  
  2. Ao ser chamado, o endpoint insere um novo registo na tabela import\_logs com o user\_id do utilizador autenticado, a url fornecida e o status inicial 'scraping'. (FR2)  
  3. O endpoint responde imediatamente com um JSON contendo o id do registo recém-criado. (FR3)  
  4. A resposta do endpoint tem uma latência inferior a 500ms (p95). (NFR1.1)  
  5. A lógica de *scraping* (a ser implementada na próxima história) é invocada numa tarefa em background (EdgeRuntime.waitUntil). (FR4)  
  6. Se a criação do registo na base de dados falhar, o endpoint deve retornar
     um erro HTTP 500\.

**História 1.3: Implementação da Lógica de Scraping em Background**

Como um desenvolvedor,

Eu quero implementar a lógica de extração de dados da página do MenuDino,

Para que o sistema possa obter as informações do menu de forma estruturada.

* **Critérios de Aceitação**:  
  1. A tarefa em background faz um pedido HTTP GET para a URL fornecida.  
  2. O sistema extrai com sucesso as informações do restaurante, categorias, pratos e complementos do HTML. (FR5)  
  3. A lógica de extração é resiliente a variações menores no HTML (ex: espaços em branco extras).  
  4. Em caso de falha de rede, a política de retentativas (NFR4.1) é acionada.  
  5. Se o *scraping* falhar após todas as tentativas (ex: a página não existe ou a estrutura mudou drasticamente), o registo em import\_logs é atualizado para o estado 'scraping\_failed' com uma mensagem de erro descritiva.  
  6. Após a extração bem-sucedida, o estado do registo é atualizado para 'processing'.

**História 1.4: Processamento e Validação dos Dados Extraídos**

*Como um desenvolvedor,* *Eu quero validar e limpar os dados extraídos do scraping,* *Para garantir a integridade e a qualidade dos dados antes de os apresentar ao utilizador.*

* **Critérios de Aceitação**:  
  1. O sistema aplica as regras de validação definidas no requisito FR11.1 (preços numéricos, nomes não vazios, remoção de scripts).  
  2. A lógica de limpeza (*sanitization*) remove com sucesso tags HTML e de script de todos os campos de texto.  
  3. Se a validação falhar (ex: um menu sem pratos), o estado do registo em `import_logs` é atualizado para `'processing_failed'` com uma mensagem de erro clara.  
  4. Após a validação e limpeza bem-sucedidas, os dados estruturados são guardados na coluna `scraped_data` (formato JSONB).  
  5. O estado do registo é atualizado para `'preview_ready'`, sinalizando que os dados estão prontos para serem visualizados. (FR6)

**História 1.5: Implementação do Endpoint de Confirmação de Importação (`/import`)**

*Como um desenvolvedor,* *Eu quero implementar o endpoint `/import` e a lógica de importação final,* *Para que os dados pré-visualizados pelo utilizador possam ser guardados de forma permanente e segura nas tabelas de destino.*

* **Critérios de Aceitação**:  
  1. A Edge Function expõe um endpoint `POST /import` que aceita um JSON com o `importLogId`. (FR8)  
  2. O endpoint verifica se o log correspondente existe e está no estado `'preview_ready'`. Caso contrário, retorna um erro.  
  3. O estado do log é imediatamente atualizado para `'importing'`.  
  4. A função lê os dados da coluna `scraped_data` do log.  
  5. Toda a lógica de inserção nas tabelas de destino (`restaurants`, `categories`, `dishes`, etc.) é executada dentro de uma única transação utilizando Drizzle ORM. (FR9, FR9.1)  
  6. Se a transação for bem-sucedida, o estado do log é atualizado para `'import_success'`. (FR10)  
  7. Se a transação falhar por qualquer motivo, todas as alterações são revertidas (*rollback*), e o estado do log é atualizado para `'import_failed'` com uma mensagem de erro detalhada. (FR10)

**História 1.6: Gestão de Reimportações Duplicadas**

*Como um desenvolvedor,* *Eu quero implementar a lógica de cache para evitar reimportações desnecessárias,* *Para que o sistema poupe recursos e forneça uma resposta mais rápida para URLs já processadas.*

* **Critérios de Aceitação**:  
  1. Antes de criar um novo `import_log` no endpoint `/scrape`, o sistema verifica se já existe um registo para a mesma URL e o mesmo `user_id`.  
  2. Se existir um registo no estado `'preview_ready'`, o `id` desse registo é retornado imediatamente, e nenhum novo processo de *scraping* é iniciado. (FR12.1)  
  3. Se existir um registo no estado `'import_success'` criado há menos de 2 minutos, o `id` desse registo é retornado, e nenhum novo processo é iniciado. (FR12.1)  
  4. Em todos os outros casos (ex: registo antigo, ou com estado de falha), um novo processo de importação é iniciado normalmente.

**História 1.7: Garantir Notificações de Estado em Tempo Real**

*Como um desenvolvedor,* *Eu quero garantir que cada atualização de estado na tabela `import_logs` gera uma notificação em tempo real,* *Para que o frontend possa reagir instantaneamente e fornecer uma experiência de utilizador fluida e informativa.*

* **Critérios de Aceitação**:  
  1. A funcionalidade de "Realtime" do Supabase está ativada para a tabela `import_logs`.  
  2. Qualquer alteração na coluna `status` de um registo em `import_logs` (ex: de `scraping` para `processing`) desencadeia um evento.  
  3. O frontend (a ser implementado no próximo épico) é capaz de subscrever a estes eventos e receber a atualização completa do registo (`payload`). (FR7)  
  4. A implementação do backend não requer código adicional para "enviar" notificações; a funcionalidade depende apenas das atualizações `UPDATE` na base de dados.

