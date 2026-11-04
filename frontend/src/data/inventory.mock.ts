// Dados LOCAIS de estoque — não vêm da API.
//
// O controle de insumos está no escopo do produto mas não foi iniciado no backend
// (ver "Limitações conhecidas" em Documents/RELATORIO_BACKEND.md: "Controle de estoque
// — previsto no escopo do produto, não iniciado"). Esta lista mantém a tela de Estoque
// e o alerta do Dashboard funcionando como demonstração, isolada num arquivo com nome
// explícito para que ninguém confunda com dado real do studio.
//
// Quando a API tiver /api/inventory, este arquivo sai e a tela passa a usar um hook
// como os demais (useInventory), sem mexer no layout.

export type StockStatus = 'critical' | 'low' | 'ok';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
}

export const INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: '1',
    name: 'Cola de Cílios Premium',
    category: 'Cílios / Micropigmentação',
    quantity: 2,
    minQuantity: 5,
    unit: 'unidades',
  },
  {
    id: '2',
    name: 'Luvas descartáveis Nitrílica (M)',
    category: 'Biossegurança & Insumos',
    quantity: 1,
    minQuantity: 3,
    unit: 'caixas',
  },
  {
    id: '3',
    name: 'Pigmento Labial Rose Nude',
    category: 'Dermopigmentação',
    quantity: 6,
    minQuantity: 4,
    unit: 'frascos',
  },
  {
    id: '4',
    name: 'Fios para Extensão 0.07 D',
    category: 'Cílios / Lash',
    quantity: 8,
    minQuantity: 4,
    unit: 'bandejas',
  },
  {
    id: '5',
    name: 'Anestésico Tópico Pomada',
    category: 'Procedimentos Estéticos',
    quantity: 4,
    minQuantity: 3,
    unit: 'bisnagas',
  },
];

/**
 * Deriva o status da quantidade em vez de guardá-lo: um campo salvo pode ficar
 * incoerente com a quantidade depois de uma baixa.
 */
export function stockStatus(item: InventoryItem): StockStatus {
  if (item.quantity <= item.minQuantity / 2) return 'critical';
  if (item.quantity < item.minQuantity) return 'low';
  return 'ok';
}

/** Itens abaixo do mínimo, usados no alerta de reposição do Dashboard. */
export const LOW_STOCK_ITEMS = INVENTORY_ITEMS.filter((item) => stockStatus(item) !== 'ok');
