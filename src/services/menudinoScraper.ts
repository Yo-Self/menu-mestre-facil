import { supabase } from "@/integrations/supabase/client";

export interface ScrapedMenuItem {
  name: string;
  category: string;
  price: number;
  description?: string;
  image_url?: string;
  complement_groups?: ScrapedComplementGroup[];
}

export interface ScrapedComplement {
  name: string;
  price: number;
  description?: string;
  image_url?: string;
  ingredients?: string;
}

export interface ScrapedComplementGroup {
  title: string;
  description?: string;
  required?: boolean;
  max_selections?: number;
  complements: ScrapedComplement[];
}

export interface ScrapedRestaurantData {
  restaurant: {
    name: string;
    cuisine_type: string;
    address: string;
    phone?: string;
    image_url?: string;
  };
  categories: string[];
  menu_items: ScrapedMenuItem[];
}

export interface ScrapingProgress {
  current_step: string;
  progress: number;
  total_items?: number;
  processed_items?: number;
}

/**
 * Extrai dados de um restaurante do MenuDino
 */
export class MenuDinoScraper {
  private baseUrl: string;
  private onProgress?: (progress: ScrapingProgress) => void;

  constructor(url: string, onProgress?: (progress: ScrapingProgress) => void) {
    this.baseUrl = url;
    this.onProgress = onProgress;
  }

  /**
   * Executa o scraping completo do restaurante
   */
  async scrapeRestaurant(): Promise<ScrapedRestaurantData> {
    this.reportProgress("Iniciando scraping...", 0);

    try {
      // Fazer scraping real da página - NUNCA usar dados de exemplo
      const data = await this.realScrapeMenuDino();
      
      this.reportProgress("Scraping concluído!", 100);
      return data;
    } catch (error) {
      console.error('Erro no scraping:', error);
      throw new Error(`Falha ao extrair dados do MenuDino: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Scraping real da página do MenuDino
   */
  private async realScrapeMenuDino(): Promise<ScrapedRestaurantData> {
    this.reportProgress("Conectando ao MenuDino...", 10);
    
    // Fazer requisição para a página
    const response = await fetch(this.baseUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    this.reportProgress("Analisando HTML...", 20);

    // Parse do HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extrair informações do restaurante
    this.reportProgress("Extraindo dados do restaurante...", 30);
    const restaurantName = this.extractRestaurantName(doc);
    const restaurantInfo = this.extractRestaurantInfo(doc, restaurantName);

    // Extrair categorias e itens
    this.reportProgress("Processando menu...", 50);
    const { categories, menuItems } = await this.extractMenuData(doc);

    const restaurantData: ScrapedRestaurantData = {
      restaurant: {
        name: restaurantName,
        cuisine_type: this.inferCuisineType(restaurantName),
        address: restaurantInfo.address,
        phone: restaurantInfo.phone,
        image_url: restaurantInfo.image_url
      },
      categories: categories,
      menu_items: menuItems
    };

    this.reportProgress("Processamento concluído!", 90);
    return restaurantData;
  }

  /**
   * Extrai nome do restaurante do HTML
   */
  private extractRestaurantName(doc: Document): string {
    // Tentar diferentes estratégias para encontrar o nome
    const strategies = [
      () => doc.querySelector('h1')?.textContent?.trim(),
      () => doc.querySelector('.restaurant-name')?.textContent?.trim(),
      () => doc.querySelector('[data-testid="restaurant-name"]')?.textContent?.trim(),
      () => doc.title?.replace(/\s*-\s*MenuDino.*$/i, '').trim(),
      () => {
        // Extrair do URL como último recurso
        const url = new URL(this.baseUrl);
        const subdomain = url.hostname.split('.')[0];
        return subdomain.replace(/[^a-zA-Z0-9]/g, ' ').trim();
      }
    ];

    for (const strategy of strategies) {
      try {
        const name = strategy();
        if (name && name.length > 0) {
          return name;
        }
      } catch (error) {
        // Continue para a próxima estratégia
      }
    }

    return 'Restaurante MenuDino';
  }

  /**
   * Extrai informações adicionais do restaurante
   */
  private extractRestaurantInfo(doc: Document, restaurantName: string): {
    address: string;
    phone?: string;
    image_url?: string;
  } {
    // Buscar endereço
    let address = 'Endereço não informado';
    const addressSelectors = [
      '.restaurant-address',
      '.address',
      '[data-testid="address"]',
      '.location'
    ];

    for (const selector of addressSelectors) {
      const element = doc.querySelector(selector);
      if (element?.textContent?.trim()) {
        address = element.textContent.trim();
        break;
      }
    }

    // Se não encontrou, buscar por padrão de endereço no texto
    if (address === 'Endereço não informado') {
      const bodyText = doc.body.textContent || '';
      const addressMatch = bodyText.match(/([A-Z][^,\n]+,\s*[^,\n]+,\s*[A-Z]{2})/);
      if (addressMatch) {
        address = addressMatch[1];
      }
    }

    // Buscar telefone
    let phone: string | undefined;
    const bodyText = doc.body.textContent || '';
    const phoneRegex = /\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/;
    const phoneMatch = bodyText.match(phoneRegex);
    if (phoneMatch) {
      phone = phoneMatch[0];
    }

    // Buscar imagem
    let image_url: string | undefined;
    const imageSelectors = [
      '.restaurant-logo img',
      '.logo img',
      'img[alt*="logo"]',
      '.header img'
    ];

    for (const selector of imageSelectors) {
      const img = doc.querySelector(selector) as HTMLImageElement;
      if (img?.src && !img.src.includes('placeholder')) {
        image_url = img.src;
        break;
      }
    }

    return { address, phone, image_url };
  }

  /**
   * Extrai dados do menu (categorias e itens)
   */
  private async extractMenuData(doc: Document): Promise<{
    categories: string[];
    menuItems: ScrapedMenuItem[];
  }> {
    const categories: string[] = [];
    const menuItems: ScrapedMenuItem[] = [];

    // Estratégia 1: Tentar encontrar abas de categorias
    const categorySelectors = [
      '.category-tab',
      '.menu-category',
      '.tab-button',
      '[data-category]'
    ];

    for (const selector of categorySelectors) {
      const elements = doc.querySelectorAll(selector);
      for (const element of elements) {
        const categoryName = element.textContent?.trim();
        if (categoryName && !categories.includes(categoryName)) {
          categories.push(categoryName);
        }
      }
      if (categories.length > 0) break;
    }

    // Estratégia 2: Extrair itens e suas categorias
    const itemSelectors = [
      '.menu-item',
      '.product-item',
      '.dish',
      '[data-product]'
    ];

    for (const selector of itemSelectors) {
      const items = doc.querySelectorAll(selector);
      
      for (const itemElement of items) {
        try {
          const item = this.extractMenuItem(itemElement, categories);
          if (item) {
            menuItems.push(item);
            
            // Adicionar categoria se ainda não existe
            if (!categories.includes(item.category)) {
              categories.push(item.category);
            }
          }
        } catch (error) {
          console.warn('Erro ao extrair item:', error);
        }
      }
      
      if (menuItems.length > 0) break;
    }

    // Se não encontrou nada, usar categorias padrão
    if (categories.length === 0) {
      categories.push('Menu Geral');
    }

    return { categories, menuItems };
  }

  /**
   * Extrai um item individual do menu
   */
  private extractMenuItem(element: Element, existingCategories: string[]): ScrapedMenuItem | null {
    // Nome
    const nameSelectors = ['.name', '.product-name', '.item-name', 'h3', 'h4'];
    let name = '';
    
    for (const selector of nameSelectors) {
      const nameEl = element.querySelector(selector);
      if (nameEl?.textContent?.trim()) {
        name = nameEl.textContent.trim();
        break;
      }
    }

    if (!name) return null;

    // Preço
    const priceSelectors = ['.price', '.product-price', '.cost', '[data-price]'];
    let price = 0;
    
    for (const selector of priceSelectors) {
      const priceEl = element.querySelector(selector);
      if (priceEl) {
        const priceText = priceEl.textContent || priceEl.getAttribute('data-price') || '';
        const priceMatch = priceText.match(/\d+[,.]?\d*/);
        if (priceMatch) {
          price = parseFloat(priceMatch[0].replace(',', '.'));
          break;
        }
      }
    }

    // Categoria
    let category = existingCategories[0] || 'Menu Geral';
    const categoryEl = element.querySelector('.category, .product-category');
    if (categoryEl?.textContent?.trim()) {
      const foundCategory = categoryEl.textContent.trim();
      if (existingCategories.includes(foundCategory)) {
        category = foundCategory;
      }
    }

    // Descrição
    const descSelectors = ['.description', '.product-description', 'p'];
    let description: string | undefined;
    
    for (const selector of descSelectors) {
      const descEl = element.querySelector(selector);
      if (descEl?.textContent?.trim() && descEl.textContent.trim() !== name) {
        description = descEl.textContent.trim();
        break;
      }
    }

    // Imagem
    const img = element.querySelector('img') as HTMLImageElement;
    const image_url = img?.src && !img.src.includes('placeholder') ? img.src : undefined;

    return {
      name,
      category,
      price,
      description,
      image_url
    };
  }



  private inferCuisineType(name: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('pizza')) return 'Pizzaria';
    if (lowerName.includes('burger') || lowerName.includes('hambur')) return 'Hamburgueria';
    if (lowerName.includes('sushi') || lowerName.includes('japanese')) return 'Japonesa';
    if (lowerName.includes('sorvete') || lowerName.includes('ice')) return 'Sorveteria';
    if (lowerName.includes('coffee') || lowerName.includes('café')) return 'Cafeteria';
    if (lowerName.includes('bar')) return 'Bar';
    if (lowerName.includes('churrasco')) return 'Churrascaria';
    if (lowerName.includes('pasta') || lowerName.includes('italian')) return 'Italiana';
    
    return 'Geral';
  }



  /**
   * Importa os dados extraídos para o Supabase
   */
  async importToSupabase(data: ScrapedRestaurantData): Promise<void> {
    this.reportProgress("Iniciando importação para o banco de dados...", 0);

    try {
      // Preparar dados
      this.reportProgress("Preparando dados do restaurante...", 10);
      
      // Gerar slug único para o restaurante
      const baseSlug = data.restaurant.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
        .replace(/\s+/g, '-') // Substitui espaços por hífens
        .replace(/-+/g, '-') // Remove hífens duplicados
        .replace(/^-+|-+$/g, ''); // Remove hífens do início e fim

      // Verificar se o restaurante já existe
      this.reportProgress("Verificando se restaurante já existe...", 15);
      
      const { data: existingRestaurant } = await supabase
        .from('restaurants')
        .select('id')
        .eq('name', data.restaurant.name)
        .eq('slug', baseSlug)
        .single();

      let restaurantId: string;

      if (existingRestaurant) {
        // Atualizar restaurante existente
        this.reportProgress("Atualizando restaurante existente...", 20);
        
        const { error: updateError } = await supabase
          .from('restaurants')
          .update({
            image_url: data.restaurant.image_url || null,
            description: `${data.restaurant.name} - ${data.restaurant.address}`,
            cuisine_type: data.restaurant.cuisine_type,
            whatsapp_phone: data.restaurant.phone || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRestaurant.id);

        if (updateError) {
          throw new Error(`Erro ao atualizar restaurante: ${updateError.message}`);
        }

        restaurantId = existingRestaurant.id;
      } else {
        // Criar novo restaurante
        this.reportProgress("Criando novo restaurante...", 20);
        
        const { data: newRestaurant, error: createError } = await supabase
          .from('restaurants')
          .insert({
            name: data.restaurant.name,
            slug: baseSlug,
            image_url: data.restaurant.image_url || '',
            description: `${data.restaurant.name} - ${data.restaurant.address}`,
            cuisine_type: data.restaurant.cuisine_type,
            whatsapp_phone: data.restaurant.phone || null,
          })
          .select('id')
          .single();

        if (createError) {
          throw new Error(`Erro ao criar restaurante: ${createError.message}`);
        }

        restaurantId = newRestaurant.id;
      }

      this.reportProgress("Processando categorias...", 30);
      
      // Criar/atualizar categorias
      const categoryMap = new Map<string, string>();
      
      for (let i = 0; i < data.categories.length; i++) {
        const categoryName = data.categories[i];
        
        // Verificar se categoria já existe
        const { data: existingCategory } = await supabase
          .from('categories')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('name', categoryName)
          .single();

        if (existingCategory) {
          categoryMap.set(categoryName, existingCategory.id);
        } else {
          // Criar nova categoria
          const { data: newCategory, error: categoryError } = await supabase
            .from('categories')
            .insert({
              name: categoryName,
              restaurant_id: restaurantId,
              position: i,
            })
            .select('id')
            .single();

          if (categoryError) {
            console.warn(`Erro ao criar categoria ${categoryName}:`, categoryError.message);
            continue;
          }

          categoryMap.set(categoryName, newCategory.id);
        }
      }

      this.reportProgress("Importando pratos...", 40);
      
      // Importar pratos
      const totalItems = data.menu_items.length;
      let processedItems = 0;

      for (const item of data.menu_items) {
        try {
          const categoryId = categoryMap.get(item.category);
          if (!categoryId) {
            console.warn(`Categoria não encontrada para o prato: ${item.name} (categoria: ${item.category})`);
            processedItems++;
            continue;
          }

          // Verificar se prato já existe
          const { data: existingDish } = await supabase
            .from('dishes')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .eq('name', item.name)
            .eq('category_id', categoryId)
            .single();

          let dishId: string;

          if (existingDish) {
            // Atualizar prato existente
            const { error: updateDishError } = await supabase
              .from('dishes')
              .update({
                description: item.description || null,
                price: item.price,
                image_url: item.image_url || null,
                is_available: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingDish.id);

            if (updateDishError) {
              console.warn(`Erro ao atualizar prato ${item.name}:`, updateDishError.message);
            }

            dishId = existingDish.id;
          } else {
            // Criar novo prato
            const { data: newDish, error: dishError } = await supabase
              .from('dishes')
              .insert({
                name: item.name,
                description: item.description || null,
                price: item.price,
                image_url: item.image_url || null,
                category_id: categoryId,
                restaurant_id: restaurantId,
                is_available: true,
                is_featured: false,
              })
              .select('id')
              .single();

            if (dishError) {
              console.warn(`Erro ao criar prato ${item.name}:`, dishError.message);
              processedItems++;
              continue;
            }

            dishId = newDish.id;
          }

          // Processar grupos de complementos
          if (item.complement_groups && item.complement_groups.length > 0) {
            await this.importComplementGroups(dishId, item.complement_groups);
          }

          processedItems++;
          const progress = 40 + (processedItems / totalItems) * 50;
          this.reportProgress(`Processando pratos... (${processedItems}/${totalItems})`, progress);

        } catch (error) {
          console.warn(`Erro ao processar prato ${item.name}:`, error);
          processedItems++;
        }
      }

      this.reportProgress("Finalizando importação...", 95);

      // Log de sucesso
      console.log("✅ IMPORTAÇÃO COMPLETA - Dados salvos no banco:");
      console.log("📍 Restaurante:", data.restaurant.name);
      console.log("🆔 ID:", restaurantId);
      console.log("🏷️ Categorias:", data.categories.length);
      console.log("🍽️ Pratos:", processedItems, "/", totalItems);
      console.log("➕ Complementos:", data.menu_items.filter(i => i.complement_groups?.length).length, "pratos com adicionais");

      this.reportProgress("✅ Importação concluída com sucesso!", 100);
      
    } catch (error) {
      console.error('Erro na importação:', error);
      throw new Error(`Falha na importação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Importa grupos de complementos para um prato
   */
  private async importComplementGroups(dishId: string, complementGroups: ScrapedComplementGroup[]): Promise<void> {
    // Remover grupos de complementos existentes para esse prato
    await supabase
      .from('complement_groups')
      .delete()
      .eq('dish_id', dishId);

    for (let groupIndex = 0; groupIndex < complementGroups.length; groupIndex++) {
      const group = complementGroups[groupIndex];

      try {
        // Criar grupo de complementos
        const { data: newGroup, error: groupError } = await supabase
          .from('complement_groups')
          .insert({
            dish_id: dishId,
            title: group.title,
            description: group.description || null,
            required: group.required || false,
            max_selections: group.max_selections || 1,
            position: groupIndex,
          })
          .select('id')
          .single();

        if (groupError) {
          console.warn(`Erro ao criar grupo de complementos ${group.title}:`, groupError.message);
          continue;
        }

        // Criar complementos do grupo
        for (let compIndex = 0; compIndex < group.complements.length; compIndex++) {
          const complement = group.complements[compIndex];

          const { error: complementError } = await supabase
            .from('complements')
            .insert({
              group_id: newGroup.id,
              name: complement.name,
              description: complement.description || null,
              price: complement.price,
              image_url: complement.image_url || null,
              ingredients: complement.ingredients || null,
              position: compIndex,
            });

          if (complementError) {
            console.warn(`Erro ao criar complemento ${complement.name}:`, complementError.message);
          }
        }
      } catch (error) {
        console.warn(`Erro ao processar grupo de complementos ${group.title}:`, error);
      }
    }
  }

  /**
   * Reporta progresso para o callback
   */
  private reportProgress(step: string, progress: number, processed?: number, total?: number) {
    if (this.onProgress) {
      this.onProgress({
        current_step: step,
        progress,
        processed_items: processed,
        total_items: total
      });
    }
  }
}

/**
 * Função utilitária para extrair dados de uma URL do MenuDino
 */
export async function scrapeMenuDinoUrl(
  url: string, 
  onProgress?: (progress: ScrapingProgress) => void
): Promise<ScrapedRestaurantData> {
  const scraper = new MenuDinoScraper(url, onProgress);
  return await scraper.scrapeRestaurant();
}

/**
 * Função completa para extrair e importar dados do MenuDino
 */
export async function importFromMenuDino(
  url: string,
  onProgress?: (progress: ScrapingProgress) => void
): Promise<void> {
  const scraper = new MenuDinoScraper(url, onProgress);
  
  // Extrair dados
  const data = await scraper.scrapeRestaurant();
  
  // Importar para o banco
  await scraper.importToSupabase(data);
}
