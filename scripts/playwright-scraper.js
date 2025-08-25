#!/usr/bin/env node

import { chromium } from 'playwright';

async function scrapeIfoodWithPlaywright(url) {
  let browser;
  
  try {
    // Lançar o navegador
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    // Criar uma nova página
    const page = await browser.newPage();
    
    // Configurar viewport e user agent
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });

    console.log(`Navegando para: ${url}`);
    
    // Navegar para a página
    await page.goto(url, { 
      waitUntil: 'networkidle', 
      timeout: 30000 
    });

    // Aguardar um pouco para o JavaScript carregar
    await page.waitForTimeout(5000);

    // Tentar clicar em elementos que podem carregar o menu
    try {
      // Procurar por botões que podem expandir o menu
      const expandSelectors = [
        '[class*="expand"]',
        '[class*="more"]',
        '[class*="show"]',
        'button:has-text("Ver mais")',
        'button:has-text("Expandir")',
        'button:has-text("Mostrar")',
        '[data-testid*="expand"]',
        '[aria-label*="expand"]'
      ];

      for (const selector of expandSelectors) {
        try {
          const elements = await page.$$(selector);
          for (const element of elements) {
            try {
              await element.click();
              await page.waitForTimeout(1000);
            } catch (e) {
              // Ignora erros de clique
            }
          }
        } catch (e) {
          // Ignora erros de seletores
        }
      }

      // Aguardar mais um pouco para o conteúdo carregar
      await page.waitForTimeout(3000);
    } catch (e) {
      console.log('Erro ao tentar expandir elementos:', e.message);
    }

    // Tentar rolar a página para carregar mais conteúdo
    try {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(2000);
      
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1000);
    } catch (e) {
      console.log('Erro ao rolar a página:', e.message);
    }

    // Extrair dados da página
    const scrapedData = await page.evaluate(() => {
      // Funções auxiliares para extração de dados
      function extractDishName(element) {
        const nameSelectors = [
          '[class*="title"]',
          '[class*="name"]',
          'h3',
          'h4',
          '.title',
          '.name'
        ];
        
        for (const selector of nameSelectors) {
          const el = element.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            if (text) return text;
          }
        }
        
        return '';
      }

      function extractDishDescription(element) {
        const descSelectors = [
          '[class*="description"]',
          '[class*="text"]',
          '.description',
          '.text'
        ];
        
        for (const selector of descSelectors) {
          const el = element.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            if (text) return text;
          }
        }
        
        return '';
      }

      function extractDishPrice(element) {
        const priceSelectors = [
          '[class*="price"]',
          '[data-price]',
          '.price'
        ];
        
        for (const selector of priceSelectors) {
          const el = element.querySelector(selector);
          if (el) {
            const text = el.textContent.trim();
            if (text && (text.includes('R$') || text.includes('$') || /\d/.test(text))) {
              return text;
            }
          }
        }
        
        return '';
      }

      function extractDishImage(element) {
        const img = element.querySelector('img');
        return img ? img.src : '';
      }

      function isLikelyDishName(text) {
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
          /^[A-Z][a-z]+(\s+[a-z]+)*\s+[A-Z][a-z]+$/ // Outro padrão comum
        ];
        
        for (const pattern of includePatterns) {
          if (pattern.test(text)) return true;
        }
        
        // Se não passou pelos filtros, verifica se tem características de prato
        const hasFoodWords = /(prato|marmita|combo|refeição|sobremesa|bebida|lanche|jantar|almoço|café|arroz|feijão|carne|frango|peixe|salada|sopa|pizza|hambúrguer|sanduíche|torta|bolo|doce|suco|refrigerante|cerveja|vinho)/i.test(text);
        const hasReasonableLength = text.length >= 5 && text.length <= 80;
        
        return hasFoodWords || hasReasonableLength;
      }

      const data = {
        restaurant_name: '',
        restaurant_image: '',
        menu_items: [],
        menu_categories: [],
        is_closed: false,
        next_opening: null,
        extraction_method: 'playwright_real_browser'
      };

      // Extrair nome do restaurante
      const nameSelectors = [
        'h1.merchant-info__title',
        'h1[class*="restaurant-name"]',
        'h1[class*="merchant-title"]',
        '[class*="restaurant-header"] h1',
        '[class*="merchant-header"] h1',
        'title'
      ];

      for (const selector of nameSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          data.restaurant_name = element.textContent.trim();
          if (data.restaurant_name && data.restaurant_name !== 'iFood') {
            break;
          }
        }
      }

      // Extrair imagem do restaurante
      const imageSelectors = [
        'img.merchant-info__logo',
        'img[class*="restaurant-header__image"]',
        'img[class*="merchant-logo"]',
        'meta[property="og:image"]'
      ];

      for (const selector of imageSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          if (element.tagName === 'META') {
            data.restaurant_image = element.getAttribute('content') || '';
          } else {
            data.restaurant_image = element.src || '';
          }
          if (data.restaurant_image) break;
        }
      }

      // Verificar se está fechado
      const closedSelectors = [
        '.merchant-banner__status-title',
        '[class*="status-title"]',
        '[class*="closed"]',
        '[class*="status"]'
      ];

      for (const selector of closedSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.toLowerCase().includes('fechada')) {
          data.is_closed = true;
          break;
        }
      }

      // Extrair horário de abertura
      const openingSelectors = [
        '.merchant-banner__status-message',
        '[class*="status-message"]',
        '[class*="opening-time"]',
        '[class*="next-opening"]'
      ];

      for (const selector of openingSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text.includes('Abre às') || text.includes('abre às')) {
            data.next_opening = text;
            break;
          }
        }
      }

      // Extrair menu usando múltiplas estratégias
      const menuSelectors = [
        // Categorias
        '[class*="category-header"]',
        '[class*="dish-category"]',
        '[class*="menu-category"]',
        'h2[class*="category"]',
        'h3[class*="category"]',
        '[data-testid*="category"]'
      ];

      const dishSelectors = [
        // Pratos
        '[class*="dish-card"]',
        '[class*="product-card"]',
        '[class*="menu-item"]',
        '[class*="dish-item"]',
        '[data-testid*="dish"]',
        '[data-testid*="product"]'
      ];

      const categories = [];
      const allDishes = [];

      // Estratégia 1: Buscar por categorias organizadas
      for (const selector of menuSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const categoryName = element.textContent.trim();
          if (!categoryName || categoryName.length < 2) continue;

          const dishes = [];
          
          // Encontrar o container da categoria
          let categoryContainer = element.closest('[class*="category"], [class*="menu-section"]');
          if (!categoryContainer) {
            categoryContainer = element.parentElement;
          }

          if (categoryContainer) {
            // Buscar pratos dentro da categoria
            const dishElements = categoryContainer.querySelectorAll(dishSelectors.join(', '));
            dishElements.forEach(dishEl => {
              const dishName = extractDishName(dishEl);
              const dishDescription = extractDishDescription(dishEl);
              const dishPrice = extractDishPrice(dishEl);
              const dishImage = extractDishImage(dishEl);

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
          }

          if (dishes.length > 0) {
            categories.push({
              name: categoryName,
              dishes: dishes
            });
            allDishes.push(...dishes);
          }
        }
      }

      // Estratégia 2: Buscar por pratos individuais se não encontrou categorias
      if (allDishes.length === 0) {
        for (const selector of dishSelectors) {
          const elements = document.querySelectorAll(selector);
          elements.forEach(dishEl => {
            const dishName = extractDishName(dishEl);
            const dishDescription = extractDishDescription(dishEl);
            const dishPrice = extractDishPrice(dishEl);
            const dishImage = extractDishImage(dishEl);

            if (dishName && isLikelyDishName(dishName)) {
              allDishes.push({
                name: dishName,
                description: dishDescription,
                price: dishPrice,
                image: dishImage,
                category: 'Cardápio'
              });
            }
          });
        }
      }

      // Atualizar dados finais
      if (allDishes.length > 0) {
        data.menu_items = allDishes;
        data.menu_categories = categories.map(c => c.name);
        if (data.menu_categories.length === 0) {
          data.menu_categories = ['Cardápio'];
        }
      }

      return data;
    });

    console.log('Dados extraídos com sucesso:', scrapedData);
    return scrapedData;

  } catch (error) {
    console.error('Erro durante o scraping:', error);
    return {
      restaurant_name: '',
      restaurant_image: '',
      menu_items: [],
      menu_categories: [],
      is_closed: false,
      next_opening: null,
      extraction_method: 'playwright_error',
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Executar o script se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.argv[2];
  if (!url) {
    console.error('URL não fornecida');
    process.exit(1);
  }

  scrapeIfoodWithPlaywright(url)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Erro:', error);
      process.exit(1);
    });
}

export { scrapeIfoodWithPlaywright };
