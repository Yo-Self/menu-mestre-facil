import { useState } from 'react';
import { Download, FileText, Table, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { ReportOrder, ReportSummary } from '@/hooks/useReportData';

interface ExportButtonsProps {
  orders: ReportOrder[];
  summary: ReportSummary;
  periodLabel: string;
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    finished: 'Finalizado',
    cancelled: 'Cancelado',
    in_preparation: 'Em preparação',
    ready: 'Pronto',
    new: 'Novo',
    pending_payment: 'Aguardando pagamento',
  };
  return map[status] ?? status;
}

function buildCsvRows(orders: ReportOrder[]): string[][] {
  const headers = [
    'ID do Pedido',
    'Data/Hora',
    'Restaurante',
    'Mesa',
    'Status',
    'Origem',
    'Item',
    'Quantidade',
    'Preço Unit. (R$)',
    'Total Item (R$)',
    'Total Pedido (R$)',
  ];

  const rows: string[][] = orders.flatMap(order => {
    const date = new Date(order.created_at).toLocaleString('pt-BR');
    const status = getStatusText(order.status);
    const total = (order.total_price / 100).toFixed(2);

    if (order.order_items.length === 0) {
      return [[order.id.slice(0, 8), date, '', order.table_name ?? '', status, order.origin ?? '', '', '', '', '', total]];
    }

    return order.order_items.map((item, idx) => [
      idx === 0 ? order.id.slice(0, 8) : '',
      idx === 0 ? date : '',
      '',
      idx === 0 ? (order.table_name ?? '') : '',
      idx === 0 ? status : '',
      idx === 0 ? (order.origin ?? '') : '',
      item.dishes?.name ?? 'Item removido',
      String(item.quantity),
      (item.price_at_time_of_order / 100).toFixed(2),
      ((item.price_at_time_of_order * item.quantity) / 100).toFixed(2),
      idx === 0 ? total : '',
    ]);
  });

  return [headers, ...rows];
}

export function ExportButtons({ orders, summary, periodLabel }: ExportButtonsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState<'csv' | 'xlsx' | 'pdf' | null>(null);

  const handleCsv = () => {
    if (orders.length === 0) {
      toast({ title: 'Sem dados', description: 'Nenhum pedido no período.', variant: 'destructive' });
      return;
    }
    const rows = buildCsvRows(orders);
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${periodLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: 'Arquivo baixado com sucesso.' });
  };

  const handleXlsx = async () => {
    if (orders.length === 0) {
      toast({ title: 'Sem dados', description: 'Nenhum pedido no período.', variant: 'destructive' });
      return;
    }
    setLoading('xlsx');
    try {
      const XLSX = await import('xlsx');
      const rows = buildCsvRows(orders);
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Auto column widths
      ws['!cols'] = rows[0].map((_, i) => ({
        wch: Math.max(...rows.map(r => String(r[i] ?? '').length), 10),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
      XLSX.writeFile(wb, `relatorio-${periodLabel}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast({ title: 'Excel exportado', description: 'Arquivo .xlsx baixado com sucesso.' });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível exportar o Excel.', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handlePdf = async () => {
    if (orders.length === 0) {
      toast({ title: 'Sem dados', description: 'Nenhum pedido no período.', variant: 'destructive' });
      return;
    }
    setLoading('pdf');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // Header
      doc.setFontSize(18);
      doc.setTextColor(40, 40, 40);
      doc.text('Relatório de Pedidos', 14, 18);
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Período: ${periodLabel}   |   Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 26);

      // KPI summary row
      doc.setFontSize(10);
      doc.setTextColor(40);
      const kpis = [
        `Receita Total: ${(summary.totalRevenueCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        `Ticket Médio: ${(summary.averageTicketCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        `Total de Pedidos: ${summary.totalOrders}`,
        `Cancelamentos: ${summary.cancelledOrders} (${summary.cancellationRate.toFixed(1)}%)`,
      ];
      kpis.forEach((kpi, i) => doc.text(kpi, 14 + i * 68, 34));

      // Orders table
      const rows = buildCsvRows(orders);
      autoTable(doc, {
        head: [rows[0]],
        body: rows.slice(1),
        startY: 40,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        alternateRowStyles: { fillColor: [248, 248, 252] },
        margin: { left: 14, right: 14 },
      });

      doc.save(`relatorio-${periodLabel}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: 'PDF exportado', description: 'Arquivo PDF baixado com sucesso.' });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={!!loading}>
          <Download className="w-4 h-4" />
          {loading ? 'Exportando…' : 'Exportar'}
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handleCsv} className="gap-2 cursor-pointer">
          <Table className="w-4 h-4" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleXlsx} className="gap-2 cursor-pointer">
          <Table className="w-4 h-4 text-emerald-600" />
          Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-500" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
