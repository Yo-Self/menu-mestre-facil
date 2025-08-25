import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { cheerio } from 'https://deno.land/x/cheerio@1.0.7/mod.ts';

// Definindo os headers do CORS diretamente aqui
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Interface para os dados extraídos
interface MenuItem {
  name: string;
  description: string;
  price: string;
  image: string;
  category: string;
}

interface MenuCategory {
  name: string;
  dishes: MenuItem[];
}

interface ScrapedData {
  restaurant_name: string;
  restaurant_image: string;
  menu_items: MenuItem[];
  menu_categories: string[];
  is_closed: boolean;
  next_opening: string | null;
  warning?: string;
  extraction_method: string;
}

// Headers de navegador real para simular um usuário legítimo
const browserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
  'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"'
};

// Múltiplos User-Agents para rotação
const userAgents = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
];

// Função para obter headers com User-Agent rotativo
function getRotatingHeaders(): Record<string, string> {
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  return {
    ...browserHeaders,
    'User-Agent': randomUserAgent
  };
}

// Função para detectar se está em desenvolvimento
function isDevelopment(): boolean {
  return Deno.env.get('ENVIRONMENT') === 'development' || 
         Deno.env.get('NODE_ENV') === 'development' ||
         Deno.env.get('SUPABASE_ENV') === 'local';
}

// Função para executar Playwright localmente (apenas em desenvolvimento)
async function executePlaywrightLocally(url: string): Promise<ScrapedData | null> {
  if (!isDevelopment()) {
    return null;
  }

  try {
    // Em desenvolvimento, executa um comando local que usa Playwright
    const command = new Deno.Command('node', {
      args: ['scripts/playwright-scraper.js', url],
      cwd: Deno.cwd(),
      stdout: 'piped',
      stderr: 'piped'
    });

    const { stdout, stderr, success } = await command.output();
    
    if (!success) {
      console.log('Erro ao executar Playwright localmente:', new TextDecoder().decode(stderr));
      return null;
    }

    const result = new TextDecoder().decode(stdout);
    try {
      return JSON.parse(result);
    } catch (e) {
      console.log('Erro ao parsear resultado do Playwright:', e);
      return null;
    }
  } catch (e) {
    console.log('Erro ao executar comando Playwright:', e);
    return null;
  }
}

serve(async (req) => {
  // Trata a requisição OPTIONS para o CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()
    if (!url) {
      throw new Error("URL não fornecida.");
    }

    // Inicializa dados básicos
    const menuData: ScrapedData = {
      restaurant_name: '',
      restaurant_image: '',
      menu_items: [],
      menu_categories: [],
      is_closed: false,
      next_opening: null,
      extraction_method: 'advanced_multi_strategy'
    }

    // MÉTODO 0: Tentar Playwright localmente se estiver em desenvolvimento
    if (isDevelopment()) {
      console.log('Modo de desenvolvimento detectado, tentando Playwright local...');
      const playwrightResult = await executePlaywrightLocally(url);
      if (playwrightResult && playwrightResult.menu_items.length > 0) {
        console.log('Playwright local executado com sucesso!');
        return new Response(JSON.stringify(playwrightResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // MÉTODO 1: Tentar múltiplas URLs para encontrar o menu
    const urlsToTry = [
      url,
      url.replace('/delivery/', '/restaurant/'),
      url + '/menu',
      url.replace(/\?.*$/, '') + '?tab=menu',
      // URLs específicas do iFood para menu
      url.replace('/delivery/', '/restaurant/') + '/cardapio',
      url.replace('/delivery/', '/restaurant/') + '/menu',
      url.replace('/delivery/', '/restaurant/') + '/pratos',
      // Tentar com diferentes parâmetros
      url + '&tab=menu',
      url + '?tab=menu',
      url.replace(/\?.*$/, '') + '&tab=menu',
      // URLs alternativas do iFood
      url.replace('/delivery/', '/restaurant/') + '/cardapio',
      url.replace('/delivery/', '/restaurant/') + '/menu',
      url.replace('/delivery/', '/restaurant/') + '/pratos',
      // Tentar com diferentes parâmetros
      url + '&tab=menu',
      url + '?tab=menu',
      url.replace(/\?.*$/, '') + '&tab=menu',
      // URLs específicas do menu do iFood
      url.replace('/delivery/', '/restaurant/') + '/cardapio',
      url.replace('/delivery/', '/restaurant/') + '/menu',
      url.replace('/delivery/', '/restaurant/') + '/pratos',
      // Tentar com diferentes parâmetros
      url + '&tab=menu',
      url + '?tab=menu',
      url.replace(/\?.*$/, '') + '&tab=menu'
    ];

    // MÉTODO 2: Tentar acessar APIs específicas do iFood
    const restaurantId = url.match(/\/([a-f0-9-]{36})\/?$/)?.[1];
    if (restaurantId) {
      const apiUrls = [
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/menu`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/categories`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/products`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/dishes`,
        // APIs alternativas
        `https://www.ifood.com.br/api/v1/restaurants/${restaurantId}/menu`,
        `https://www.ifood.com.br/api/v2/restaurants/${restaurantId}/menu`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/catalog`,
        // Endpoints específicos do menu
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/menu/categories`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/menu/items`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/menu/products`,
        // Endpoints alternativos
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/catalog/categories`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/catalog/products`,
        `https://www.ifood.com.br/api/restaurants/${restaurantId}/catalog/items`
      ];
      
      urlsToTry.push(...apiUrls);
    }

    // MÉTODO 3: Tentar URLs específicas do menu baseadas em padrões conhecidos
    const baseUrl = url.replace(/\?.*$/, '').replace(/\/$/, '');
    const menuUrls = [
      `${baseUrl}/cardapio`,
      `${baseUrl}/menu`,
      `${baseUrl}/pratos`,
      `${baseUrl}/catalogo`,
      `${baseUrl}/produtos`,
      `${baseUrl}/itens`,
      `${baseUrl}/dishes`,
      `${baseUrl}/products`,
      `${baseUrl}/categories`,
      `${baseUrl}/menu/cardapio`,
      `${baseUrl}/menu/pratos`,
      `${baseUrl}/menu/produtos`,
      `${baseUrl}/cardapio/pratos`,
      `${baseUrl}/cardapio/produtos`,
      `${baseUrl}/pratos/cardapio`,
      `${baseUrl}/produtos/cardapio`
    ];
    
    urlsToTry.push(...menuUrls);

    let bestResult: ScrapedData | null = null;
    
    // MÉTODO 4: Tentar com diferentes estratégias de navegação
    for (const tryUrl of urlsToTry) {
      try {
        // Primeira tentativa: com headers de navegador real
        let response = await fetch(tryUrl, { headers: getRotatingHeaders() });
        
        if (!response.ok) {
          // Segunda tentativa: com headers mais simples
          response = await fetch(tryUrl, {
            headers: {
              'User-Agent': getRotatingHeaders()['User-Agent'],
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
          });
        }
        
        if (!response.ok) {
          // Terceira tentativa: com headers mínimos
          response = await fetch(tryUrl, {
            headers: {
              'User-Agent': getRotatingHeaders()['User-Agent']
            }
          });
        }
        
        if (!response.ok) continue;
        
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          // É uma API JSON - processar diretamente
          const jsonData = await response.json();
          const result = await extractDataFromJSON(jsonData, tryUrl);
          
          if (result.menu_items.length > (bestResult?.menu_items.length || 0)) {
            bestResult = result;
          }
          
          // Se encontrou um resultado bom, para de tentar
          if (result.menu_items.length > 5) break;
        } else {
          // É HTML - processar com Cheerio
          const html = await response.text();
          const $ = cheerio.load(html);
          
          const result = await extractDataFromHTML($, tryUrl);
          
          if (result.menu_items.length > (bestResult?.menu_items.length || 0)) {
            bestResult = result;
          }
          
          // Se encontrou um resultado bom, para de tentar
          if (result.menu_items.length > 5) break;
        }
        
      } catch (e) {
        // Continua para a próxima URL
        continue;
      }
    }

    // MÉTODO 5: Tentar com diferentes estratégias de parsing se não encontrou nada
    if (!bestResult || bestResult.menu_items.length === 0) {
      try {
        const response = await fetch(url, { headers: getRotatingHeaders() });
        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);
          
          // Estratégia avançada: buscar por padrões específicos do iFood
          const advancedResult = await extractDataAdvanced($, url);
          if (advancedResult.menu_items.length > 0) {
            bestResult = advancedResult;
          }
        }
      } catch (e) {
        // Ignora erros
      }
    }

    // MÉTODO 6: Tentar com parâmetros de query específicos se não encontrou nada
    if (!bestResult || bestResult.menu_items.length === 0) {
      const queryParams = [
        '?tab=menu',
        '?tab=cardapio',
        '?tab=pratos',
        '?tab=produtos',
        '?tab=catalogo',
        '?view=menu',
        '?view=cardapio',
        '?view=pratos',
        '?section=menu',
        '?section=cardapio',
        '?section=pratos',
        '&tab=menu',
        '&tab=cardapio',
        '&tab=pratos',
        '&tab=produtos',
        '&tab=catalogo'
      ];

      for (const param of queryParams) {
        try {
          const queryUrl = url.includes('?') ? url + param.replace('?', '&') : url + param;
          const response = await fetch(queryUrl, { headers: getRotatingHeaders() });
          
          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            const result = await extractDataFromHTML($, queryUrl);
            if (result.menu_items.length > 0) {
              bestResult = result;
              break;
            }
          }
        } catch (e) {
          // Continua para o próximo parâmetro
          continue;
        }
      }
    }

    // MÉTODO 7: Tentar acessar URLs específicas do menu que podem estar disponíveis
    if (!bestResult || bestResult.menu_items.length === 0) {
      // Tentar acessar URLs específicas do menu do iFood
      const specificMenuUrls = [
        'https://www.ifood.com.br/cardapio',
        'https://www.ifood.com.br/menu',
        'https://www.ifood.com.br/restaurantes',
        'https://www.ifood.com.br/delivery'
      ];

      for (const menuUrl of specificMenuUrls) {
        try {
          const response = await fetch(menuUrl, { headers: getRotatingHeaders() });
          if (response.ok) {
            const html = await response.text();
            const $ = cheerio.load(html);
            
            // Buscar por restaurantes na página de menu
            const restaurants = $('[class*="restaurant"], [class*="merchant"], [class*="store"]');
            if (restaurants.length > 0) {
              // Encontrar o restaurante específico
              for (let i = 0; i < restaurants.length; i++) {
                const restaurant = $(restaurants[i]);
                const name = restaurant.find('[class*="name"], [class*="title"]').text().trim();
                
                if (name.toLowerCase().includes('manaira') || name.toLowerCase().includes('restaurante')) {
                  // Encontrar o menu deste restaurante
                  const menuContainer = restaurant.find('[class*="menu"], [class*="cardapio"], [class*="dishes"]');
                  if (menuContainer.length > 0) {
                    const result = await extractDataFromHTML($, menuUrl);
                    if (result.menu_items.length > 0) {
                      bestResult = result;
                      break;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          // Continua para a próxima URL
          continue;
        }
      }
    }

    // Usar o melhor resultado encontrado
    if (bestResult) {
      Object.assign(menuData, bestResult);
    } else {
      // Fallback: tentar a URL original
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Falha ao buscar a URL: ${response.statusText}`);
      }
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      const fallbackResult = await extractDataFromHTML($, url);
      Object.assign(menuData, fallbackResult);
    }

    // Validações e fallbacks finais
    if (!menuData.restaurant_name) {
      menuData.restaurant_name = 'Restaurante não identificado';
    }

    if (!menuData.restaurant_image) {
      menuData.restaurant_image = 'https://via.placeholder.com/150x150?text=Sem+Imagem';
    }

    // Adicionar avisos baseados no resultado
    if (menuData.is_closed) {
      menuData.warning = `Restaurante fechado. ${menuData.next_opening ? `Abre às ${menuData.next_opening}` : 'Horário de funcionamento não disponível'}`;
    }

    if (menuData.menu_items.length === 0) {
      menuData.warning = (menuData.warning || '') + ' Não foi possível extrair o cardápio. O iFood pode estar protegendo o conteúdo ou o menu pode ser carregado dinamicamente.';
    }

    return new Response(JSON.stringify(menuData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

// Função principal para extrair dados do HTML
async function extractDataFromHTML($: cheerio.CheerioAPI, url: string): Promise<ScrapedData> {
  const menuData: ScrapedData = {
    restaurant_name: '',
    restaurant_image: '',
    menu_items: [],
    menu_categories: [],
    is_closed: false,
    next_opening: null,
    extraction_method: 'html_parsing'
  };

  // Extrair dados básicos do restaurante
  const nextDataScript = $('script#__NEXT_DATA__').html();
  if (nextDataScript) {
    try {
      const nextData = JSON.parse(nextDataScript);
      const restaurant = nextData?.props?.initialState?.restaurant;
      
      if (restaurant) {
        menuData.restaurant_name = restaurant.name || restaurant.details?.name || '';
        menuData.restaurant_image = restaurant.details?.resources?.find((r: { type: string; fileName: string }) => r.type === 'LOGO')?.fileName 
          ? `https://static.ifood-static.com.br/image/upload/t_thumbnail/logosgde/${restaurant.details.resources.find((r: { type: string; fileName: string }) => r.type === 'LOGO')?.fileName}`
          : '';
        menuData.is_closed = restaurant.closed || false;
        menuData.next_opening = restaurant.nextOpeningHour ? new Date(restaurant.nextOpeningHour.openingTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
        menuData.extraction_method = 'json_embedded';
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Erro desconhecido';
      console.log('Erro ao parsear JSON embutido:', errorMessage);
    }
  }

  // Fallback para extração HTML se JSON falhar
  if (!menuData.restaurant_name) {
    menuData.restaurant_name = $('h1.merchant-info__title').text().trim() || 
                             $('h1[class*="restaurant-name"]').text().trim() ||
                             $('title').text().split('|')[0].trim();
    
    menuData.restaurant_image = $('img.merchant-info__logo').attr('src') ||
                              $('img[class*="restaurant-header__image"]').attr('src') ||
                              $('meta[property="og:image"]').attr('content') || '';
    
    const isClosed = $('.merchant-banner__status-title').text().toLowerCase().includes('loja fechada') ||
                    $('.merchant-banner__status-title').text().toLowerCase().includes('fechada');
    
    menuData.is_closed = isClosed;
    menuData.next_opening = $('.merchant-banner__status-message').text().trim() || null;
  }

  // Extrair menu usando múltiplas estratégias
  const categories: MenuCategory[] = [];
  
  // ESTRATÉGIA 1: Buscar por categorias organizadas
  const categorySelectors = [
    '.dish-category-header__title',
    '.category-header__title',
    '[class*="category-title"]',
    '.menu-category__title',
    '.restaurant-menu-category__title',
    '.dish-category__title',
    'h2[class*="category"]',
    'h3[class*="category"]',
    '[data-testid*="category"]',
    '[class*="menu-section"]'
  ];
  
  const dishSelectors = [
    '.dish-card',
    '.product-card',
    '[class*="dish"]',
    '[class*="product"]',
    '.menu-item',
    '.restaurant-menu-item',
    '[class*="menu-item"]',
    '[class*="dish-item"]',
    '[data-testid*="dish"]',
    '[data-testid*="product"]'
  ];

  // Buscar por categorias com seletores múltiplos
  for (const selector of categorySelectors) {
    $(selector).each((_i, el) => {
      const categoryName = $(el).text().trim();
      if (!categoryName || categoryName.length < 2) return;
      
      const dishes: MenuItem[] = [];
      
      // Encontrar o container da categoria
      const categoryContainer = $(el).closest([
        '.dish-category',
        '.category',
        '[class*="category"]',
        '.menu-category',
        '.restaurant-menu-category',
        '[class*="menu-section"]'
      ].join(', '));
      
      // Buscar pratos dentro da categoria
      const dishElements = categoryContainer.length > 0 
        ? categoryContainer.find(dishSelectors.join(', '))
        : $(el).nextAll(dishSelectors.join(', ')).slice(0, 15);
      
      dishElements.each((_i, dishEl) => {
        const dishName = extractDishName($, dishEl);
        const dishDescription = extractDishDescription($, dishEl);
        const dishPrice = extractDishPrice($, dishEl);
        const dishImage = extractDishImage($, dishEl);
        
        if (dishName && isLikelyDishName(dishName)) {
          dishes.push({
            name: dishName,
            description: dishDescription,
            price: dishPrice,
            image: dishImage,
            category: categoryName
          });
        }
      });
      
      if (dishes.length > 0) {
        categories.push({
          name: categoryName,
          dishes: dishes
        });
      }
    });
  }

  // ESTRATÉGIA 2: Buscar por pratos individuais se não encontrou categorias
  if (categories.length === 0) {
    const dishes: MenuItem[] = [];
    
    for (const selector of dishSelectors) {
      $(selector).each((_i, dishEl) => {
        const dishName = extractDishName($, dishEl);
        const dishDescription = extractDishDescription($, dishEl);
        const dishPrice = extractDishPrice($, dishEl);
        const dishImage = extractDishImage($, dishEl);
        
        if (dishName && isLikelyDishName(dishName)) {
          dishes.push({
            name: dishName,
            description: dishDescription,
            price: dishPrice,
            image: dishImage,
            category: 'Cardápio'
          });
        }
      });
    }
    
    if (dishes.length > 0) {
      categories.push({
        name: 'Cardápio',
        dishes: dishes
      });
    }
  }

  // ESTRATÉGIA 3: Buscar por dados em atributos data-* e aria-*
  if (categories.length === 0) {
    const dishes: MenuItem[] = [];
    
    // Buscar por elementos com atributos de dados
    $('[data-name], [data-title], [aria-label]').each((_i, el) => {
      const dishName = $(el).attr('data-name') || 
                      $(el).attr('data-title') || 
                      $(el).attr('aria-label') || '';
      
      if (dishName && dishName.length > 3 && !dishName.includes('R$') && isLikelyDishName(dishName)) {
        const parent = $(el).closest('[class*="card"], [class*="item"], [class*="dish"]');
        const dishDescription = parent.find('[data-description], [class*="description"]').text().trim();
        const dishPrice = parent.find('[data-price], [class*="price"]').text().trim();
        const dishImage = parent.find('img').attr('src') || '';

        dishes.push({
          name: dishName,
          description: dishDescription,
          price: dishPrice,
          image: dishImage,
          category: 'Cardápio'
        });
      }
    });
    
    if (dishes.length > 0) {
      categories.push({
        name: 'Cardápio',
        dishes: dishes
      });
    }
  }

  // ESTRATÉGIA 4: Buscar por texto que parece ser nome de prato
  if (categories.length === 0) {
    const dishes: MenuItem[] = [];
    
    // Buscar por elementos que podem conter nomes de pratos
    $('h3, h4, .title, .name, [class*="title"], [class*="name"]').each((_i, el) => {
      const text = $(el).text().trim();
      
      // Filtra textos que parecem ser nomes de pratos
      if (isLikelyDishName(text)) {
        const parent = $(el).closest('[class*="card"], [class*="item"], [class*="dish"], [class*="product"]');
        const dishDescription = parent.find('[class*="description"], [class*="text"]').text().trim();
        const dishPrice = parent.find('[class*="price"], [class*="value"]').text().trim();
        const dishImage = parent.find('img').attr('src') || '';

        dishes.push({
          name: text,
          description: dishDescription,
          price: dishPrice,
          image: dishImage,
          category: 'Cardápio'
        });
      }
    });
    
    if (dishes.length > 0) {
      categories.push({
        name: 'Cardápio',
        dishes: dishes
      });
    }
  }

  // Atualizar dados finais
  if (categories.length > 0) {
    menuData.menu_items = categories.flatMap(c => c.dishes.map(d => ({ ...d, category: c.name })));
    menuData.menu_categories = categories.map(c => c.name);
    menuData.extraction_method = `menu_extracted_${categories.length}_categories`;
  } else {
    menuData.extraction_method = 'menu_not_found';
  }

  return menuData;
}

// Função principal para extrair dados de APIs JSON
async function extractDataFromJSON(jsonData: unknown, url: string): Promise<ScrapedData> {
  const menuData: ScrapedData = {
    restaurant_name: '',
    restaurant_image: '',
    menu_items: [],
    menu_categories: [],
    is_closed: false,
    next_opening: null,
    extraction_method: 'json_api_extraction'
  };

  // Extrair dados básicos do restaurante da API
  const data = jsonData as {
    restaurant?: {
      name?: string;
      details?: {
        name?: string;
        resources?: Array<{ type: string; fileName: string }>;
      };
      closed?: boolean;
      nextOpeningHour?: { openingTime: string };
    };
    menu?: {
      categories?: Array<{
        name?: string;
        dishes?: Array<{
          name?: string;
          description?: string;
          price?: string;
          image?: string;
        }>;
      }>;
      products?: Array<{
        name?: string;
        description?: string;
        price?: string;
        image?: string;
      }>;
      dishes?: Array<{
        name?: string;
        description?: string;
        price?: string;
        image?: string;
      }>;
    };
  };

  if (data?.restaurant) {
    menuData.restaurant_name = data.restaurant.name || data.restaurant.details?.name || '';
    menuData.restaurant_image = data.restaurant.details?.resources?.find((r: { type: string; fileName: string }) => r.type === 'LOGO')?.fileName 
      ? `https://static.ifood-static.com.br/image/upload/t_thumbnail/logosgde/${data.restaurant.details.resources.find((r: { type: string; fileName: string }) => r.type === 'LOGO')?.fileName}`
      : '';
    menuData.is_closed = data.restaurant.closed || false;
    menuData.next_opening = data.restaurant.nextOpeningHour ? new Date(data.restaurant.nextOpeningHour.openingTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  }

  // Extrair menu da API
  if (data?.menu) {
    const categories: MenuCategory[] = [];
    const menuItems: MenuItem[] = [];

    if (data.menu.categories) {
      for (const category of data.menu.categories) {
        const dishes: MenuItem[] = [];
        if (category.dishes) {
          for (const dish of category.dishes) {
            dishes.push({
              name: dish.name || '',
              description: dish.description || '',
              price: dish.price || '',
              image: dish.image || '',
              category: category.name || ''
            });
          }
        }
        categories.push({ name: category.name || '', dishes: dishes });
      }
      menuItems.push(...categories.flatMap(c => c.dishes));
    } else if (data.menu.products) {
      for (const product of data.menu.products) {
        menuItems.push({
          name: product.name || '',
          description: product.description || '',
          price: product.price || '',
          image: product.image || '',
          category: 'Cardápio'
        });
      }
    } else if (data.menu.dishes) {
      for (const dish of data.menu.dishes) {
        menuItems.push({
          name: dish.name || '',
          description: dish.description || '',
          price: dish.price || '',
          image: dish.image || '',
          category: 'Cardápio'
        });
      }
    }

    if (menuItems.length > 0) {
      menuData.menu_items = menuItems;
      menuData.menu_categories = categories.map(c => c.name);
    }
  }

  // Fallback para extração HTML se JSON falhar
  if (menuData.menu_items.length === 0) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao buscar a URL: ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const fallbackResult = await extractDataFromHTML($, url);
    Object.assign(menuData, fallbackResult);
  }

  // Validações e fallbacks finais
  if (!menuData.restaurant_name) {
    menuData.restaurant_name = 'Restaurante não identificado';
  }

  if (!menuData.restaurant_image) {
    menuData.restaurant_image = 'https://via.placeholder.com/150x150?text=Sem+Imagem';
  }

  if (menuData.is_closed) {
    menuData.warning = `Restaurante fechado. ${menuData.next_opening ? `Abre às ${menuData.next_opening}` : 'Horário de funcionamento não disponível'}`;
  }

  if (menuData.menu_items.length === 0) {
    menuData.warning = (menuData.warning || '') + ' Não foi possível extrair o cardápio. O iFood pode estar protegendo o conteúdo ou o menu pode ser carregado dinamicamente.';
  }

  return menuData;
}

// Função avançada para extração de dados com padrões específicos do iFood
async function extractDataAdvanced($: cheerio.CheerioAPI, url: string): Promise<ScrapedData> {
  const menuData: ScrapedData = {
    restaurant_name: '',
    restaurant_image: '',
    menu_items: [],
    menu_categories: [],
    is_closed: false,
    next_opening: null,
    extraction_method: 'advanced_pattern_extraction'
  };

  // Buscar por padrões específicos do iFood
  const patterns = [
    // Padrão 1: Cards de pratos com estrutura específica
    {
      container: '[class*="dish-card"], [class*="product-card"], [class*="menu-item"]',
      name: '[class*="title"], [class*="name"], h3, h4',
      description: '[class*="description"], [class*="text"]',
      price: '[class*="price"], [data-price]',
      image: 'img'
    },
    // Padrão 2: Lista de pratos
    {
      container: '[class*="dish-list"], [class*="product-list"], [class*="menu-list"]',
      name: '[class*="dish-name"], [class*="product-name"]',
      description: '[class*="dish-desc"], [class*="product-desc"]',
      price: '[class*="dish-price"], [class*="product-price"]',
      image: 'img'
    },
    // Padrão 3: Grid de produtos
    {
      container: '[class*="grid"], [class*="products-grid"], [class*="dishes-grid"]',
      name: '[class*="title"], [class*="name"]',
      description: '[class*="description"]',
      price: '[class*="price"]',
      image: 'img'
    }
  ];

  for (const pattern of patterns) {
    const dishes: MenuItem[] = [];
    
    $(pattern.container).each((_i, el) => {
      const dishName = $(el).find(pattern.name).text().trim();
      const dishDescription = $(el).find(pattern.description).text().trim();
      const dishPrice = $(el).find(pattern.price).text().trim();
      const dishImage = $(el).find(pattern.image).attr('src') || '';
      
      if (dishName && isLikelyDishName(dishName)) {
        dishes.push({
          name: dishName,
          description: dishDescription,
          price: dishPrice,
          image: dishImage,
          category: 'Cardápio'
        });
      }
    });
    
    if (dishes.length > 0) {
      menuData.menu_items = dishes;
      menuData.menu_categories = ['Cardápio'];
      break;
    }
  }

  return menuData;
}

// Funções auxiliares para extração de dados
function extractDishName($: cheerio.CheerioAPI, element: cheerio.Element): string {
  const nameSelectors = [
    '.dish-card__description-title',
    '.product-name',
    '[class*="dish-title"]',
    '[class*="product-title"]',
    '.menu-item__title',
    '.restaurant-menu-item__title',
    '.dish-name',
    '.product-title',
    '.item-name',
    'h3',
    'h4',
    '.title',
    '.name'
  ];
  
  for (const selector of nameSelectors) {
    const text = $(element).find(selector).text().trim();
    if (text) return text;
  }
  
  return '';
}

function extractDishDescription($: cheerio.CheerioAPI, element: cheerio.Element): string {
  const descSelectors = [
    '.dish-card__description-text',
    '.product-description',
    '[class*="dish-description"]',
    '[class*="product-description"]',
    '.menu-item__description',
    '.restaurant-menu-item__description',
    '.dish-description',
    '.product-description',
    '.item-description',
    '.description',
    '.text'
  ];
  
  for (const selector of descSelectors) {
    const text = $(element).find(selector).text().trim();
    if (text) return text;
  }
  
  return '';
}

function extractDishPrice($: cheerio.CheerioAPI, element: cheerio.Element): string {
  const priceSelectors = [
    '.dish-card__price',
    '.product-price',
    '[class*="dish-price"]',
    '[class*="product-price"]',
    '.menu-item__price',
    '.restaurant-menu-item__price',
    '.dish-price',
    '.product-price',
    '.item-price',
    '.price',
    '[data-price]'
  ];
  
  for (const selector of priceSelectors) {
    const text = $(element).find(selector).text().trim();
    if (text && (text.includes('R$') || text.includes('$') || /\d/.test(text))) {
      return text;
    }
  }
  
  return '';
}

function extractDishImage($: cheerio.CheerioAPI, element: cheerio.Element): string {
  const imageSelectors = [
    'img.dish-card__image',
    'img.product-image',
    'img[class*="dish-image"]',
    'img[class*="product-image"]',
    'img.menu-item__image',
    'img.restaurant-menu-item__image',
    'img.dish-image',
    'img.product-image',
    'img.item-image',
    'img'
  ];
  
  for (const selector of imageSelectors) {
    const src = $(element).find(selector).attr('src');
    if (src) return src;
  }
  
  return '';
}

function isLikelyDishName(text: string): boolean {
  if (!text || text.length < 3 || text.length > 100) return false;
  
  // Filtra textos que não parecem ser nomes de pratos
  const excludePatterns = [
    /^R\$\s*\d+/, // Preços
    /^\d+/, // Números
    /^(Ver mais|Fechar|Adicionar|Remover|Editar|Excluir)$/i, // Botões
    /^(Nome|Preço|Descrição|Categoria|Quantidade)$/i, // Labels
    /^(iFood|Restaurante|Cardápio|Menu|Pedido|Entrega)$/i, // Palavras do sistema
    /^(Facebook|Twitter|Instagram|YouTube)$/i, // Redes sociais
    /^(Termos|Privacidade|Ajuda|Contato)$/i, // Links do footer
    /^(©|Copyright|Todos os direitos reservados)$/i, // Copyright
    /^Avaliação:\s*\d+\.\d+/, // Avaliações
    /^Pedido mínimo/, // Informações de pedido
    /^Abre às/, // Horários
    /^Loja fechada/, // Status
    /^Ver mais$/, // Botões genéricos
    /^Voltar para a home$/, // Navegação
    /^Site Institucional$/, // Links institucionais
    /^Fale Conosco$/, // Links de contato
    /^Carreiras$/, // Links de carreira
    /^Entregadores$/, // Links de entregadores
    /^Cadastre seu Restaurante$/, // Links de cadastro
    /^iFood Shop$/, // Links do iFood
    /^iFood Empresas$/, // Links empresariais
    /^Blog iFood Empresas$/ // Links de blog
  ];
  
  for (const pattern of excludePatterns) {
    if (pattern.test(text)) return false;
  }
  
  // Inclui textos que parecem ser nomes de pratos
  const includePatterns = [
    /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/, // Primeira letra maiúscula
    /^[A-Z][a-z]+(\s+[a-z]+)*$/, // Primeira palavra maiúscula
    /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*\s+[a-z]+$/, // Padrão comum de pratos
    /^[A-Z][a-z]+(\s+[a-z]+)*\s+[A-Z][a-z]+$/, // Outro padrão comum
  ];
  
  for (const pattern of includePatterns) {
    if (pattern.test(text)) return true;
  }
  
  // Se não passou pelos filtros, verifica se tem características de prato
  const hasFoodWords = /(prato|marmita|combo|refeição|sobremesa|bebida|lanche|jantar|almoço|café|arroz|feijão|carne|frango|peixe|salada|sopa|pizza|hambúrguer|sanduíche|torta|bolo|doce|suco|refrigerante|cerveja|vinho)/i.test(text);
  const hasReasonableLength = text.length >= 5 && text.length <= 80;
  
  return hasFoodWords || hasReasonableLength;
}