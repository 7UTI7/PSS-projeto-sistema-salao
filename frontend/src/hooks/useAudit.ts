// Hooks da auditoria: ler o estado do mês, enviar os dois relatórios e lançar o ajuste.
//
// O servidor é a fonte da verdade. A diferença e o desfecho não são guardados em estado
// local nem recalculados aqui: a tela lê `outcome` e decide o que mostrar. Duplicar a
// conta no app foi o que produziu o Painel com R$ 180,00 e Lançamentos com R$ 220,00
// para o mesmo mês.
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { auditService, type AuditSubmitRequest } from '../services/audit.service';
import { ACCEPTED_MIME_TYPES_BY_SOURCE } from '../services/import.service';
import { queryKeys } from '../services/query-keys';
import { usePeriodStore } from '../store/periodStore';
import { useIsAdmin } from './useReports';
import type { AuditEntryInput, ImportSource, PickedFile } from '../types';
import type { PeriodKey } from '../utils/period';

/** Auditoria do mês selecionado no cabeçalho. */
export function useAudit() {
  const period = usePeriodStore((state) => state.period);
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.reports.audit(period),
    queryFn: () => auditService.getSummary(period),
    enabled: isAdmin,
  });
}

/**
 * A submissão e o ajuste criam lançamentos e categorias, então invalidam tudo que
 * depende deles. `reports.all` cobre a auditoria, o DRE, a meta e os três saldos de uma
 * vez, porque a chave da auditoria vive sob 'reports' de propósito.
 */
function useAuditMutationOptions() {
  const queryClient = useQueryClient();
  return {
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.imports.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
      ]);
    },
  };
}

export function useSubmitAudit() {
  const options = useAuditMutationOptions();
  return useMutation({
    mutationFn: (request: AuditSubmitRequest) => auditService.submit(request),
    ...options,
  });
}

export function useAddAuditEntry() {
  const options = useAuditMutationOptions();
  return useMutation({
    mutationFn: ({ period, entry }: { period: PeriodKey; entry: AuditEntryInput }) =>
      auditService.addEntry(period, entry),
    ...options,
  });
}

/**
 * Os dois arquivos da submissão, cada um no seu campo.
 *
 * O seletor é filtrado pela origem porque os formatos são diferentes: o Booksy exporta
 * planilha e o extrato da InfinitePay sai em PDF pelo app. Oferecer PDF no campo do
 * Booksy só levaria o arquivo a um 400 depois do upload.
 */
export function useAuditFilePicker() {
  const [files, setFiles] = useState<Partial<Record<ImportSource, PickedFile>>>({});

  const pickFile = useCallback(async (source: ImportSource): Promise<PickedFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_MIME_TYPES_BY_SOURCE[source],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;

    const picked: PickedFile = {
      uri: asset.uri,
      // O seletor entrega o acento percent-encoded ("relato%CC%81rio.pdf") e em NFD; sem
      // normalizar, é esse nome cru que aparece na tela e vai para o histórico.
      name: normalizeFileName(asset.name),
      // Alguns provedores (Drive, WhatsApp) não informam o MIME; o backend valida pela
      // extensão e pelo conteúdo, então o genérico passa.
      mimeType: asset.mimeType ?? 'application/octet-stream',
      ...(asset.size !== undefined ? { size: asset.size } : {}),
    };
    setFiles((current) => ({ ...current, [source]: picked }));
    return picked;
  }, []);

  const clearFiles = useCallback(() => setFiles({}), []);

  /** Tira um arquivo só, para quando ela escolhe o errado. */
  const clearFile = useCallback((source: ImportSource) => {
    setFiles((current) => {
      const next = { ...current };
      delete next[source];
      return next;
    });
  }, []);

  return {
    files,
    pickFile,
    clearFile,
    clearFiles,
    ready: Boolean(files.booksy && files.infinitepay),
  };
}

/** Desfaz o percent-encoding do seletor e junta os acentos combinantes (NFD -> NFC). */
function normalizeFileName(name: string): string {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    // Nome com '%' literal não é URI válida; nesse caso vale o original.
  }
  return decoded.normalize('NFC');
}
