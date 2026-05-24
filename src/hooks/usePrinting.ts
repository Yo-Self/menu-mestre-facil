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

        // Cabeçalho
        items.push({
          type: 'text',
          value: '--- MENU MESTRE FÁCIL ---',
          style: 'font-weight: bold; font-size: 16px; margin-bottom: 5px;',
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
          <div class="center bold">--- MENU MESTRE FÁCIL ---</div>
          <div class="center">${(order.restaurant_name || '').toUpperCase()}</div>
          <div class="border center bold">PEDIDO: #${order.display_id || order.id.slice(0, 8)}</div>
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

  return {
    isDesktop,
    getPrinters,
    printHtml,
    printThermalCupom
  }
}
