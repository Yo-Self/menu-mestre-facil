import { useCallback } from 'react'

const getPaymentLabel = (method: string) => {
  const paymentMap: { [key: string]: string } = {
    cash: 'Dinheiro',
    credit_card: 'Cartão de Crédito',
    debit_card: 'Cartão de Débito',
    pix: 'PIX',
    stripe: 'Online (Stripe)',
    card: 'Cartão (Débito/Crédito)',
    online: 'Pago pelo App'
  }
  return paymentMap[method] || method;
}

export interface Printer {
  name: string
  displayName: string
  isDefault: boolean
  description?: string
}

const convertItemsToHtml = (items: any[], title: string = 'Cupom') => {
  const paperWidth = localStorage.getItem("thermal_paper_width") || "80mm";
  const itemsHtml = items.map((item) => {
    if (item.type === 'image' && item.path) {
      const positionClass = item.position === 'center' ? 'text-align: center;' : item.position === 'right' ? 'text-align: right;' : 'text-align: left;';
      return `<div style="${positionClass} margin-bottom: 8px;"><img src="${item.path}" style="max-width: 90px; max-height: 90px; object-fit: contain; ${item.style || ''}" /></div>`;
    }
    if (item.type === 'text') {
      const positionClass = item.position === 'center' ? 'text-align: center;' : item.position === 'right' ? 'text-align: right;' : 'text-align: left;';
      const customStyle = typeof item.style === 'string' ? item.style : '';
      return `<div style="${positionClass} margin-bottom: 4px; ${customStyle}">${item.value}</div>`;
    }
    return '';
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${paperWidth === "58mm" ? "58mm" : "80mm"} auto;
            margin: 0;
          }
          body { 
            background: white; 
            color: black;
            padding: 4mm 3mm;
            margin: 0;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            width: ${paperWidth === "58mm" ? "52mm" : "74mm"};
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        ${itemsHtml}
      </body>
    </html>
  `;
};

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
            style: 'width: 90px; height: 90px; margin-bottom: 5px; object-fit: contain;'
          })
        }

        // Cabeçalho - Nome do Restaurante
        items.push({
          type: 'text',
          value: '--- GESTOR MENU ---',
          style: 'font-weight: bold; font-size: 18px; margin-bottom: 3px;',
          position: 'center'
        })

        if (order.restaurant_name) {
          items.push({
            type: 'text',
            value: order.restaurant_name.toUpperCase(),
            style: 'font-weight: bold; font-size: 16px; margin-bottom: 10px;',
            position: 'center'
          })
        }

        // Detalhes do Pedido
        items.push({
          type: 'text',
          value: `PEDIDO: #${order.display_id || order.id.slice(0, 8)}`,
          style: 'font-weight: bold; font-size: 15px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 3px 0;',
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

        // Cabeçalho de Viagem
        if (order.is_takeaway) {
          items.push({
            type: 'text',
            value: '*** PEDIDO PARA VIAGEM ***',
            style: 'font-weight: bold; font-size: 16px; background-color: #000; color: #fff; padding: 6px 0; margin-bottom: 10px;',
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
          style: 'font-weight: bold; font-size: 13px;',
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
        const tipoEntrega = order.is_takeaway ? 'VIAGEM' : (deliveryTypeMap[order.delivery_type] || order.delivery_type || 'MESA')
        items.push({
          type: 'text',
          value: `Tipo: ${tipoEntrega}`,
          style: 'font-weight: bold; font-size: 13px; margin-bottom: 10px;',
          position: 'left'
        })

        const orderObs = order.observation || (order.customer_info && typeof order.customer_info === 'object'
          ? (order.customer_info as any).observation || (order.customer_info as any).notes
          : null);
        if (orderObs) {
          items.push({
            type: 'text',
            value: `Obs do Pedido: ${orderObs}`,
            style: 'font-weight: bold; font-size: 13px; color: #cc0000; margin-top: 2px; margin-bottom: 8px;',
            position: 'left'
          })
        }

        // Itens do Pedido (Tabela)
        items.push({
          type: 'text',
          value: 'PRODUTOS',
          style: 'font-weight: bold; font-size: 13px; border-bottom: 1px solid #000; padding-bottom: 2px; margin-bottom: 5px;',
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

            // Composição do preço caso tenha adicionais pagos
            const compsPrice = item.complements?.reduce((sum: number, c: any) => sum + (c.price || 0), 0) || 0;
            if (compsPrice > 0) {
              const basePrice = (item.unit_price || 0) - compsPrice;
              const baseFormatted = basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              const compsFormatted = compsPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              const sumFormatted = (item.unit_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
              items.push({
                type: 'text',
                value: `Composição: ${baseFormatted} base + ${compsFormatted} adicional = ${sumFormatted}`,
                style: 'font-size: 9px; font-style: italic; color: #555; padding-left: 10px; margin-bottom: 3px;',
                position: 'left'
              });
            }

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
          style: 'font-weight: bold; font-size: 15px; margin-top: 5px; margin-bottom: 5px;',
          position: 'right'
        })

        // Múltiplos meios de pagamento e troco
        if (order.payments && order.payments.length > 0) {
          order.payments.forEach((p: any) => {
            const methodLabel = getPaymentLabel(p.method);
            const amountFormatted = p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            items.push({
              type: 'text',
              value: `${methodLabel}: ${amountFormatted}`,
              style: 'font-size: 11px;',
              position: 'left'
            });
          });

          // Se for dinheiro e tiver troco
          const cashPayment = order.payments.find((p: any) => p.method === 'cash');
          if (cashPayment && order.customer_info && typeof order.customer_info === 'object') {
            const info = order.customer_info as any;
            if (info.received_cash !== undefined && info.received_cash !== null) {
              const recCash = info.received_cash / 100;
              const chgVal = (info.change !== undefined && info.change !== null) ? info.change / 100 : 0;
              items.push({
                type: 'text',
                value: `Dinheiro Recebido: ${recCash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                style: 'font-size: 10px; color: #555; padding-left: 10px;',
                position: 'left'
              });
              items.push({
                type: 'text',
                value: `Troco: ${chgVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                style: 'font-size: 10px; font-weight: bold; color: #555; padding-left: 10px;',
                position: 'left'
              });
            }
          }
        } else if (order.payment_method) {
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

          // Se for dinheiro e tiver troco
          if (order.payment_method === 'cash' && order.customer_info && typeof order.customer_info === 'object') {
            const info = order.customer_info as any;
            if (info.received_cash !== undefined && info.received_cash !== null) {
              const recCash = info.received_cash / 100;
              const chgVal = (info.change !== undefined && info.change !== null) ? info.change / 100 : 0;
              items.push({
                type: 'text',
                value: `Dinheiro Recebido: ${recCash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                style: 'font-size: 10px; color: #555; padding-left: 10px;',
                position: 'left'
              });
              items.push({
                type: 'text',
                value: `Troco: ${chgVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                style: 'font-size: 10px; font-weight: bold; color: #555; padding-left: 10px;',
                position: 'left'
              });
            }
          }
        }

        // Endereço de entrega se for delivery
        if (order.delivery_type === 'delivery' && order.address) {
          items.push({
            type: 'text',
            value: 'ENDEREÇO DE ENTREGA',
            style: 'font-weight: bold; font-size: 13px; border-top: 1px solid #000; margin-top: 10px; padding-top: 5px;',
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

        // Enviar os dados formatados usando o renderizador HTML nativo e silencioso do Electron (altamente estável)
        const htmlContent = convertItemsToHtml(items, `Cupom - #${order.display_id || order.id.slice(0, 8)}`);
        return await printHtml(htmlContent, {
          printerName: options.printerName,
          silent: true
        });

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
          ${order.restaurant_logo ? `<div class="center" style="margin-bottom: 8px;"><img src="${order.restaurant_logo}" style="max-width: 90px; max-height: 90px; object-fit: contain;" /></div>` : ''}
          <div class="center bold" style="font-size: 18px;">--- GESTOR MENU ---</div>
          <div class="center" style="font-size: 16px;">${(order.restaurant_name || '').toUpperCase()}</div>
          <div class="border center bold" style="font-size: 15px;">PEDIDO: #${order.display_id || order.id.slice(0, 8)}</div>
          ${order.queue_password ? `<div class="center bold" style="font-size: 26px; padding: 10px 0; border-bottom: 1px dashed #000; margin-bottom: 10px;">SENHA: ${order.queue_password}</div>` : ''}
          ${order.is_takeaway ? `<div class="center bold" style="font-size: 18px; background-color: black; color: white; padding: 6px; margin: 5px 0;">*** PEDIDO PARA VIAGEM ***</div><div class="border"></div>` : ''}
          <div style="font-size: 13px; font-weight: bold;">Cliente: ${order.customer_name || 'Consumidor'}</div>
          <div style="font-size: 12px;">Data: ${order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
          ${(() => {
            const orderObs = order.observation || (order.customer_info && typeof order.customer_info === 'object'
              ? (order.customer_info as any).observation || (order.customer_info as any).notes
              : null);
            return orderObs ? `<div style="font-weight: bold; color: red; font-size: 13px; margin-top: 5px; margin-bottom: 5px;">OBS PEDIDO: ${orderObs}</div>` : '';
          })()}
          <div class="bold" style="margin-top: 10px; font-size: 13px; border-bottom: 1px solid #000; padding-bottom: 2px;">PRODUTOS:</div>
          ${order.items?.map((item: any) => {
            const compsPrice = item.complements?.reduce((sum: number, c: any) => sum + (c.price || 0), 0) || 0;
            const basePrice = (item.unit_price || 0) - compsPrice;
            const baseFormatted = basePrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const compsFormatted = compsPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const sumFormatted = (item.unit_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const compositionHtml = compsPrice > 0 
              ? `<div style="font-size: 10px; font-style: italic; color: #555; padding-left: 10px;">Composição: ${baseFormatted} base + ${compsFormatted} adicional = ${sumFormatted}</div>`
              : '';
            const complementsHtml = item.complements?.map((comp: any) => {
              const compPrice = comp.price > 0 ? ` (+ ${(comp.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : '';
              return `<div style="font-size: 11px; font-style: italic; color: #555; padding-left: 10px;">- ${comp.name}${compPrice}</div>`;
            }).join('') || '';
            
            return `
              <div style="margin-top: 5px; font-size: 12px; font-weight: bold;">${item.quantity}x ${item.dish_name || item.name}</div>
              <div style="font-size: 11px; padding-left: 10px;">${(item.unit_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} un. | Total: ${((item.unit_price || 0) * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
              ${complementsHtml}
              ${compositionHtml}
            `;
          }).join('')}
          <div class="border"></div>
          <div class="right bold" style="font-size: 15px;">TOTAL: ${(order.total_price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div style="margin-top: 10px;">
            ${(() => {
              if (order.payments && order.payments.length > 0) {
                let html = order.payments.map((p: any) => {
                  const methodLabel = getPaymentLabel(p.method);
                  const amountFormatted = p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                  return `<div style="font-size: 11px;">${methodLabel}: ${amountFormatted}</div>`;
                }).join("");
                
                const cashPayment = order.payments.find((p: any) => p.method === 'cash');
                if (cashPayment && order.customer_info && typeof order.customer_info === 'object') {
                  const info = order.customer_info as any;
                  if (info.received_cash !== undefined && info.received_cash !== null) {
                    const recCash = info.received_cash / 100;
                    const chgVal = (info.change !== undefined && info.change !== null) ? info.change / 100 : 0;
                    html += `
                      <div style="font-size: 10px; color: #555; padding-left: 10px;">Dinheiro Recebido: ${recCash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      <div style="font-size: 10px; font-weight: bold; color: #555; padding-left: 10px;">Troco: ${chgVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    `;
                  }
                }
                return html;
              } else if (order.payment_method) {
                const paymentMap: { [key: string]: string } = {
                  card: 'Cartão (Débito/Crédito)',
                  cash: 'Dinheiro',
                  pix: 'PIX',
                  online: 'Pago pelo App'
                };
                let html = `<div style="font-size: 11px;">Pagamento: ${paymentMap[order.payment_method] || order.payment_method}</div>`;
                if (order.payment_method === 'cash' && order.customer_info && typeof order.customer_info === 'object') {
                  const info = order.customer_info as any;
                  if (info.received_cash !== undefined && info.received_cash !== null) {
                    const recCash = info.received_cash / 100;
                    const chgVal = (info.change !== undefined && info.change !== null) ? info.change / 100 : 0;
                    html += `
                      <div style="font-size: 10px; color: #555; padding-left: 10px;">Dinheiro Recebido: ${recCash.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      <div style="font-size: 10px; font-weight: bold; color: #555; padding-left: 10px;">Troco: ${chgVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    `;
                  }
                }
                return html;
              }
              return '';
            })()}
          </div>
          <div class="center" style="margin-top: 20px; font-size: 11px;">Impresso via navegador web.</div>
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

        // Cabeçalho de Viagem
        if (order.is_takeaway) {
          items.push({
            type: 'text',
            value: '*** PEDIDO PARA VIAGEM ***',
            style: 'font-weight: bold; font-size: 16px; background-color: #000; color: #fff; padding: 6px 0; margin-bottom: 8px;',
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

        const orderObs = order.observation || (order.customer_info && typeof order.customer_info === 'object'
          ? (order.customer_info as any).observation || (order.customer_info as any).notes
          : null);
        if (orderObs) {
          items.push({
            type: 'text',
            value: `⚠️ OBS PEDIDO: ${orderObs}`,
            style: 'font-weight: bold; font-size: 13px; color: #ff0000; margin-bottom: 10px; background-color: #eee; padding: 4px; border: 1px solid #ccc;',
            position: 'left'
          })
        }

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

        // Enviar os dados formatados da cozinha usando o renderizador HTML silencioso
        const htmlContent = convertItemsToHtml(items, `Cozinha - #${order.display_id || order.id.slice(0, 8)}`);
        return await printHtml(htmlContent, {
          printerName: options.printerName,
          silent: true
        });

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
          ${order.is_takeaway ? `<div class="center bold" style="font-size: 18px; background-color: black; color: white; padding: 6px; margin: 5px 0;">*** PEDIDO PARA VIAGEM ***</div><div class="border"></div>` : ''}
          <div>Mesa/Local: <strong>${order.table_name || 'Balcão'}</strong></div>
          <div>Cliente: ${order.customer_name || 'Consumidor'}</div>
          <div>Hora: ${order.created_at ? new Date(order.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}</div>
          ${(() => {
            const orderObs = order.observation || (order.customer_info && typeof order.customer_info === 'object'
              ? (order.customer_info as any).observation || (order.customer_info as any).notes
              : null);
            return orderObs ? `<div class="obs" style="font-size: 16px; margin: 8px 0; background-color: #eee; padding: 4px; border: 1px solid #ccc;">⚠️ OBS PEDIDO: ${orderObs}</div>` : '';
          })()}
          
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
