// Hooks da importação de relatórios: escolher arquivo, pré-visualizar, processar e desfazer.
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { ACCEPTED_IMPORT_MIME_TYPES, importService, type ImportRequest } from '../services/import.service';
import { queryKeys } from '../services/query-keys';
import { useIsAdmin } from './useReports';
import type { PickedFile } from '../types';

export function useImportBatches() {
  const isAdmin = useIsAdmin();

  return useQuery({
    queryKey: queryKeys.imports.batches(),
    queryFn: importService.listBatches,
    enabled: isAdmin,
  });
}

/**
 * Importar cria lançamentos e categorias, então invalida tudo que depende deles.
 * Vale para processar e para desfazer.
 */
function useImportMutationOptions() {
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

/** Pré-visualização: não grava nada, então não invalida cache nenhum. */
export function usePreviewImport() {
  return useMutation({
    mutationFn: (request: ImportRequest) => importService.preview(request),
  });
}

export function useProcessImport() {
  const options = useImportMutationOptions();
  return useMutation({
    mutationFn: (request: ImportRequest) => importService.process(request),
    ...options,
  });
}

export function useRollbackImport() {
  const options = useImportMutationOptions();
  return useMutation({
    mutationFn: (batchId: string) => importService.rollback(batchId),
    ...options,
  });
}

/**
 * Abre o seletor de arquivos do sistema e guarda o escolhido.
 * `copyToCacheDirectory` fica ligado porque o upload precisa ler a URI depois que o
 * seletor fecha; sem a cópia, em Android a URI de content:// pode já ter expirado.
 */
export function useFilePicker() {
  const [file, setFile] = useState<PickedFile | null>(null);

  const pickFile = useCallback(async (): Promise<PickedFile | null> => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ACCEPTED_IMPORT_MIME_TYPES,
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;

    const picked: PickedFile = {
      uri: asset.uri,
      name: asset.name,
      // Alguns provedores (Drive, WhatsApp) não informam o MIME; o backend valida
      // pela extensão e pelo conteúdo, então o genérico passa.
      mimeType: asset.mimeType ?? 'application/octet-stream',
      ...(asset.size !== undefined ? { size: asset.size } : {}),
    };
    setFile(picked);
    return picked;
  }, []);

  const clearFile = useCallback(() => setFile(null), []);

  return { file, pickFile, clearFile };
}
