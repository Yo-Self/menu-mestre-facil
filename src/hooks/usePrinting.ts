import { useCallback } from 'react'

export interface Printer {
  name: string
  displayName: string
  isDefault: boolean
  description?: string
}

export function usePrinting() {
  // Detecta se a API exposta pelo Preload do Electron está disponível no objeto window
  const isDesktop = typeof window !== 'undefined' && !!window.api

  // Função para listar impressoras
  const getPrinters = useCallback(async (): Promise<Printer[]> => {
    if (isDesktop) {
      try {
        const printers = await window.api.getPrinters()
        return printers.map((p) => ({
          name: p.name,
          displayName: p.displayName || p.name,
          isDefault: p.isDefault,
          description: p.description
        }))
      } catch (error) {
        console.error('Erro ao listar impressoras no desktop:', error)
        return []
      }
    }
    
    // Fallback para navegador web comum
    console.warn('A listagem de impressoras só está disponível na versão desktop nativa.')
    return [{ name: 'browser-default', displayName: 'Impressora Padrão do Navegador', isDefault: true }]
  }, [isDesktop])

  // Função para imprimir conteúdo HTML
  const printHtml = useCallback(async (html: string, options?: { printerName?: string; silent?: boolean }) => {
    if (isDesktop) {
      try {
        return await window.api.print(html, {
          printerName: options?.printerName,
          silent: options?.silent ?? false,
          printBackground: true
        })
      } catch (error: any) {
        console.error('Erro ao realizar impressão no desktop:', error)
        return { success: false, error: error.message }
      }
    }

    // Fallback para navegador web (abre janela de impressão do browser)
    try {
      const printWindow = window.open('', '_blank', 'width=800,height=600')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        printWindow.focus()
        // Dá um pequeno delay para carregar assets/CSS se houver
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
        }, 250)
        return { success: true }
      }
      return { success: false, error: 'Bloqueador de popups impediu a janela de impressão' }
    } catch (error: any) {
      console.error('Erro ao abrir popup de impressão no browser:', error)
      return { success: false, error: error.message }
    }
  }, [isDesktop])

  // Função para impressão térmica estruturada
  const printThermalCupom = useCallback(async (
    order: any, 
    options?: { printerName: string; width?: string }
  ) => {
    if (isDesktop) {
      try {
        if (!options?.printerName) {
          return { success: false, error: 'Selecione uma impressora térmica nas configurações' }
        }

        // Montar a estrutura de itens para a biblioteca electron-pos-printer
        const items: any[] = []

        // Cabeçalho - Logo do Restaurante
        if (order.restaurant_logo) {
          items.push({
            type: 'image',
            path: order.restaurant_logo,
            position: 'center',
            style: 'width: 60px; height: 60px; margin-bottom: 5px; object-fit: contain;'
          })
        }

        // Cabeçalho - Nome do Restaurante
        items.push({
          type: 'text',
          value: '--- GESTOR MENU ---',
          style: 'font-weight: bold; font-size: 16px; margin-bottom: 3px;',
          position: 'center'
        })

        if (order.restaurant_name) {
          items.push({
            type: 'text',
            value: order.restaurant_name.toUpperCase(),
            style: 'font-weight: bold; font-size: 14px; margin-bottom: 10px;',
            position: 'center'
          })
        }

        // Detalhes do Pedido
        items.push({
          type: 'text',
          value: `PEDIDO: #${order.display_id || order.id.slice(0, 8)}`,
          style: 'font-weight: bold; font-size: 14px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0;',
          position: 'center'
        })

        // Senha Sequencial de Fila
        if (order.queue_password) {
          items.push({
            type: 'text',
            value: `SENHA: ${order.queue_password}`,
            style: 'font-weight: 900; font-size: 22px; padding: 8px 0; border-bottom: 1px dashed #000; margin-bottom: 10px;',
            position: 'center'
          })
        }

        const dateStr = order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
        items.push({
          type: 'text',
          value: `Data: ${dateStr}`,
          style: 'font-size: 11px; margin-top: 5px; margin-bottom: 5px;',
          position: 'left'
        })

        // Cliente
        items.push({
          type: 'text',
          value: `Cliente: ${order.customer_name || 'Consumidor'}`,
          style: 'font-weight: bold; font-size: 12px;',
          position: 'left'
        })

        if (order.customer_phone) {
          items.push({
            type: 'text',
            value: `Tel: ${order.customer_phone}`,
            style: 'font-size: 11px;',
            position: 'left'
          })
        }

        // Tipo de Entrega
        const deliveryTypeMap: { [key: string]: string } = {
          delivery: 'DELIVERY',
          takeout: 'RETIRADA',
          dine_in: 'MESA/LOCAL'
        }
        items.push({
          type: 'text',
          value: `Tipo: ${deliveryTypeMap[order.delivery_type] || order.delivery_type || 'MESA'}`,
          style: 'font-weight: bold; font-size: 12px; margin-bottom: 10px;',
          position: 'left'
        })

        // Itens do Pedido (Tabela)
        items.push({
          type: 'text',
          value: 'PRODUTOS',
          style: 'font-weight: bold; font-size: 12px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px;',
          position: 'left'
        })

        if (order.items && order.items.length > 0) {
          order.items.forEach((item: any) => {
            const priceUnit = (item.unit_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            const priceTotal = ((item.unit_price || 0) * (item.quantity || 1)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            
            // Linha principal do item
            items.push({
              type: 'text',
              value: `${item.quantity}x ${item.dish_name || item.name}`,
              style: 'font-weight: bold; font-size: 12px;',
              position: 'left'
            })
            
            items.push({
              type: 'text',
              value: `${priceUnit} un. | Total: ${priceTotal}`,
              style: 'font-size: 11px; margin-bottom: 3px; padding-left: 10px;',
              position: 'left'
            })

            // Complementos
            if (item.complements && item.complements.length > 0) {
              item.complements.forEach((comp: any) => {
                const compPrice = comp.price > 0 ? ` (+ ${(comp.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : ''
                items.push({
                  type: 'text',
                  value: `  - ${comp.name}${compPrice}`,
                  style: 'font-size: 10px; font-style: italic; color: #555;',
                  position: 'left'
                })
              })
            }

            // Observação do item
            if (item.notes) {
              items.push({
                type: 'text',
                value: `  Obs: ${item.notes}`,
                style: 'font-size: 10px; color: #cc0000; padding-left: 10px; margin-bottom: 5px;',
                position: 'left'
              })
            }
          })
        } else {
          items.push({
            type: 'text',
            value: 'Nenhum produto cadastrado no pedido.',
            style: 'font-size: 11px; font-style: italic;',
            position: 'left'
          })
        }

        // Totais
        items.push({
          type: 'text',
          value: '--------------------------------',
          style: 'font-size: 11px;',
          position: 'center'
        })

        const totalFormatted = (order.total_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        items.push({
          type: 'text',
          value: `VALOR TOTAL: ${totalFormatted}`,
          style: 'font-weight: bold; font-size: 14px; margin-top: 5px; margin-bottom: 5px;',
          position: 'right'
        })

        // Forma de pagamento
        if (order.payment_method) {
          const paymentMap: { [key: string]: string } = {
            card: 'Cartão (Débito/Crédito)',
            cash: 'Dinheiro',
            pix: 'PIX',
            online: 'Pago pelo App'
          }
          items.push({
            type: 'text',
            value: `Pagamento: ${paymentMap[order.payment_method] || order.payment_method}`,
            style: 'font-size: 11px;',
            position: 'left'
          })
        }

        // Endereço de entrega se for delivery
        if (order.delivery_type === 'delivery' && order.address) {
          items.push({
            type: 'text',
            value: 'ENDEREÇO DE ENTREGA',
            style: 'font-weight: bold; font-size: 12px; border-top: 1px solid #000; margin-top: 10px; padding-top: 5px;',
            position: 'left'
          })
          items.push({
            type: 'text',
            value: order.address,
            style: 'font-size: 11px; margin-bottom: 5px;',
            position: 'left'
          })
        }

        // Rodapé de Agradecimento
        items.push({
          type: 'text',
          value: 'Obrigado pela preferência!',
          style: 'font-style: italic; font-size: 11px; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px;',
          position: 'center'
        })

        // Enviar os dados formatados para o processo principal imprimir na impressora térmica
        return await window.api.printThermal({
          printerName: options.printerName,
          items
        }, {
          width: options.width ?? '300px'
        })

      } catch (error: any) {
        console.error('Erro na impressão térmica do pedido:', error)
        return { success: false, error: error.message }
      }
    }

    // Fallback para navegador web (mostra um alerta informando que a impressão térmica direta só existe no desktop)
    console.warn('A impressão direta para impressora térmica (silenciosa) só é suportada no aplicativo desktop.')
    // Mas fornecemos o fallback de abrir a janela de impressão web tradicional com uma versão simplificada em texto
    try {
      const simplifiedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 14px; width: 300px; padding: 10px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .border { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin: 10px 0; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          ${order.restaurant_logo ? `<div class="center" style="margin-bottom: 8px;"><img src="${order.restaurant_logo}" style="max-width: 60px; max-height: 60px; object-fit: contain;" /></div>` : ''}
          <div class="center bold">--- GESTOR MENU ---</div>
          <div class="center">${(order.restaurant_name || '').toUpperCase()}</div>
          <div class="border center bold">PEDIDO: #${order.display_id || order.id.slice(0, 8)}</div>
          ${order.queue_password ? `<div class="center bold" style="font-size: 26px; padding: 10px 0; border-bottom: 1px dashed #000; margin-bottom: 10px;">SENHA: ${order.queue_password}</div>` : ''}
          <div>Cliente: ${order.customer_name || 'Consumidor'}</div>
          <div>Data: ${order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
          <div class="bold" style="margin-top: 10px;">PRODUTOS:</div>
          ${order.items?.map((item: any) => `
            <div>${item.quantity}x ${item.dish_name || item.name}</div>
            <div style="font-size: 12px; padding-left: 10px;">${(item.unit_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un.</div>
          `).join('')}
          <div class="border"></div>
          <div class="right bold">TOTAL: ${(order.total_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div class="center" style="margin-top: 20px;">Impresso via navegador web.</div>
        </body>
        </html>
      `
      return await printHtml(simplifiedHtml)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }, [isDesktop, printHtml])

  // Função para impressão térmica da cozinha
  const printKitchenThermalCupom = useCallback(async (
    order: any, 
    options?: { printerName: string; width?: string }
  ) => {
    if (isDesktop) {
      try {
        if (!options?.printerName) {
          return { success: false, error: 'Selecione uma impressora térmica nas configurações' }
        }

        const items: any[] = []

        // Cabeçalho da Cozinha
        items.push({
          type: 'text',
          value: '--- VIA COZINHA ---',
          style: 'font-weight: bold; font-size: 16px; margin-bottom: 5px;',
          position: 'center'
        })

        if (order.restaurant_name) {
          items.push({
            type: 'text',
            value: order.restaurant_name.toUpperCase(),
            style: 'font-weight: bold; font-size: 12px; margin-bottom: 10px;',
            position: 'center'
          })
        }

        items.push({
          type: 'text',
          value: `PEDIDO: #${order.display_id || order.id.slice(0, 8)}`,
          style: 'font-weight: bold; font-size: 14px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0;',
          position: 'center'
        })

        if (order.queue_password) {
          items.push({
            type: 'text',
            value: `SENHA: ${order.queue_password}`,
            style: 'font-weight: 900; font-size: 20px; padding: 6px 0; border-bottom: 1px dashed #000; margin-bottom: 10px;',
            position: 'center'
          })
        }

        const dateStr = order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
        items.push({
          type: 'text',
          value: `Hora: ${dateStr}`,
          style: 'font-size: 11px; margin-top: 5px; margin-bottom: 5px;',
          position: 'left'
        })

        items.push({
          type: 'text',
          value: `Mesa/Local: ${order.table_name || 'Balcão'}`,
          style: 'font-weight: bold; font-size: 13px;',
          position: 'left'
        })

        items.push({
          type: 'text',
          value: `Cliente: ${order.customer_name || 'Consumidor'}`,
          style: 'font-size: 12px; margin-bottom: 10px;',
          position: 'left'
        })

        items.push({
          type: 'text',
          value: 'ITENS PARA PREPARAÇÃO',
          style: 'font-weight: bold; font-size: 12px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 8px;',
          position: 'left'
        })

        if (order.items && order.items.length > 0) {
          order.items.forEach((item: any) => {
            items.push({
              type: 'text',
              value: `${item.quantity}x [ ${item.dish_name || item.name} ]`,
              style: 'font-weight: bold; font-size: 14px; margin-bottom: 2px;',
              position: 'left'
            })

            // Complementos
            if (item.complements && item.complements.length > 0) {
              item.complements.forEach((comp: any) => {
                items.push({
                  type: 'text',
                  value: `  + ${comp.name}`,
                  style: 'font-size: 11px; font-weight: bold; padding-left: 10px;',
                  position: 'left'
                })
              })
            }

            // Observação do item
            if (item.notes) {
              items.push({
                type: 'text',
                value: `  ⚠️ OBS: ${item.notes}`,
                style: 'font-weight: bold; font-size: 12px; color: #ff0000; padding-left: 10px; margin-top: 2px; margin-bottom: 5px;',
                position: 'left'
              })
            }
            
            // Separador sutil de item
            items.push({
              type: 'text',
              value: '--------------------------------',
              style: 'font-size: 10px; color: #888;',
              position: 'center'
            })
          })
        }

        // Rodapé de Controle
        items.push({
          type: 'text',
          value: '--- FIM VIA COZINHA ---',
          style: 'font-style: italic; font-size: 11px; margin-top: 15px; border-top: 1px dashed #000; padding-top: 10px;',
          position: 'center'
        })

        return await window.api.printThermal({
          printerName: options.printerName,
          items
        }, {
          width: options.width ?? '300px'
        })

      } catch (error: any) {
        console.error('Erro na impressão térmica da cozinha:', error)
        return { success: false, error: error.message }
      }
    }

    // Fallback de navegador para impressão de cozinha
    try {
      const kitchenHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: monospace; font-size: 14px; width: 300px; padding: 10px; }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .border { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 5px 0; margin: 10px 0; }
            .item-title { font-size: 16px; font-weight: bold; margin-top: 8px; }
            .obs { font-weight: bold; color: red; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="center bold" style="font-size: 16px;">--- VIA COZINHA ---</div>
          <div class="center">${(order.restaurant_name || '').toUpperCase()}</div>
          <div class="border center bold">PEDIDO: #${order.display_id || order.id.slice(0, 8)}</div>
          ${order.queue_password ? `<div class="center bold" style="font-size: 24px; padding: 5px 0;">SENHA: ${order.queue_password}</div><div class="border"></div>` : ''}
          <div>Mesa/Local: <strong>${order.table_name || 'Balcão'}</strong></div>
          <div>Cliente: ${order.customer_name || 'Consumidor'}</div>
          <div>Hora: ${order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
          
          <div class="border" style="font-weight: bold;">ITENS PARA PREPARAÇÃO:</div>
          ${order.items?.map((item: any) => `
            <div class="item-title">${item.quantity}x [ ${item.dish_name || item.name} ]</div>
            ${item.complements?.map((c: any) => `<div style="padding-left: 15px; font-weight: bold;">+ ${c.name}</div>`).join('') || ''}
            ${item.notes ? `<div class="obs" style="padding-left: 15px; margin-top: 5px;">⚠️ OBS: ${item.notes}</div>` : ''}
            <div style="border-top: 1px solid #ccc; margin: 5px 0;"></div>
          `).join('')}
          <div class="center" style="margin-top: 20px; font-style: italic;">--- FIM VIA COZINHA ---</div>
        </body>
        </html>
      `
      return await printHtml(kitchenHtml)
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }, [isDesktop, printHtml])

  return {
    isDesktop,
    getPrinters,
    printHtml,
    printThermalCupom,
    printKitchenThermalCupom
  }
}
