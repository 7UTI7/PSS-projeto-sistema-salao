// Catálogo de categorias (/api/categories). Escrita só para admin.
//
// Importa mais do que parece: o backend recusa um lançamento cuja categoria não esteja
// no catálogo e ativa (erro INVALID_CATEGORY). A importação do Booksy cria aqui as
// categorias que vêm no arquivo ("Unhas", "Sobrancelhas"), e é nesta tela que a dona
// renomeia, muda o tipo ou desativa o que não quer mais oferecer.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, borderRadius, shadows } from '../../theme/theme';
import { AdminOnlyState, EmptyState, ErrorState, LoadingState } from '../../components/ui/QueryState';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '../../hooks/useCategories';
import { useIsAdmin } from '../../hooks/useReports';
import { getApiErrorMessage } from '../../services/api';
import { categoryKindLabels } from '../../utils/labels';
import type { Category, CategoryKind } from '../../types';

const KINDS: CategoryKind[] = ['receita', 'despesa', 'ambos'];

export default function CategoriesScreen() {
  const isAdmin = useIsAdmin();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<CategoryKind>('receita');

  const categoriesQuery = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  function handleCreate() {
    const name = newName.trim();
    if (!name) {
      Alert.alert('Confira os dados', 'Informe o nome da categoria.');
      return;
    }

    createMutation.mutate(
      { name, kind: newKind, active: true },
      {
        onSuccess: () => {
          setNewName('');
          setNewKind('receita');
        },
        onError: (error) => Alert.alert('Não foi possível criar', getApiErrorMessage(error)),
      }
    );
  }

  /** Ativar/desativar reusa o PUT: o backend exige o objeto completo, não um patch. */
  function handleToggleActive(category: Category) {
    updateMutation.mutate(
      {
        id: category._id,
        input: { name: category.name, kind: category.kind, active: !category.active },
      },
      { onError: (error) => Alert.alert('Erro', getApiErrorMessage(error)) }
    );
  }

  function handleChangeKind(category: Category, kind: CategoryKind) {
    if (category.kind === kind) return;
    updateMutation.mutate(
      { id: category._id, input: { name: category.name, kind, active: category.active } },
      { onError: (error) => Alert.alert('Erro', getApiErrorMessage(error)) }
    );
  }

  function handleDelete(category: Category) {
    Alert.alert(
      'Remover categoria',
      `"${category.name}" sai do catálogo. Os lançamentos já registrados nela continuam intactos. Confirma?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () =>
            deleteMutation.mutate(category._id, {
              onError: (error) => Alert.alert('Erro', getApiErrorMessage(error)),
            }),
        },
      ]
    );
  }

  if (!isAdmin) return <AdminOnlyState style={styles.fill} />;
  if (categoriesQuery.isPending) {
    return <LoadingState label="Carregando o catálogo..." style={styles.fill} />;
  }
  if (categoriesQuery.isError) {
    return (
      <ErrorState error={categoriesQuery.error} onRetry={categoriesQuery.refetch} style={styles.fill} />
    );
  }

  const categories = categoriesQuery.data ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={categoriesQuery.isRefetching}
          onRefresh={() => void categoriesQuery.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Catálogo de Categorias</Text>
        <Text style={styles.subtitle}>
          Um lançamento só é aceito em categoria ativa do catálogo. As importações do
          Booksy cadastram aqui o que vem no arquivo.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nova categoria</Text>

        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Ex: Micropigmentação"
          placeholderTextColor={colors.graphiteMuted}
          maxLength={100}
        />

        <Text style={styles.label}>Vale para</Text>
        <View style={styles.kindRow}>
          {KINDS.map((kind) => {
            const isSelected = newKind === kind;
            return (
              <TouchableOpacity
                key={kind}
                style={[styles.kindPill, isSelected && styles.kindPillSelected]}
                activeOpacity={0.8}
                onPress={() => setNewKind(kind)}
              >
                <Text style={[styles.kindPillText, isSelected && styles.kindPillTextSelected]}>
                  {categoryKindLabels[kind]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, createMutation.isPending && styles.btnDisabled]}
          activeOpacity={0.85}
          disabled={createMutation.isPending}
          onPress={handleCreate}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={17} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Adicionar ao catálogo</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {categories.length === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title="Catálogo vazio"
          description="Cadastre as categorias que o studio oferece, ou importe o relatório do Booksy para criá-las de uma vez."
        />
      ) : (
        categories.map((category) => (
          <View key={category._id} style={[styles.itemCard, !category.active && styles.itemInactive]}>
            <View style={styles.itemHeader}>
              <View style={styles.itemTitleCol}>
                <Text style={styles.itemName}>{category.name}</Text>
                <Text style={styles.itemMeta}>
                  {category.active ? 'Ativa' : 'Inativa'} · {categoryKindLabels[category.kind]}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.toggle, category.active && styles.toggleOn]}
                activeOpacity={0.7}
                disabled={updateMutation.isPending}
                onPress={() => handleToggleActive(category)}
              >
                <Ionicons
                  name={category.active ? 'checkmark' : 'close'}
                  size={14}
                  color={category.active ? '#FFFFFF' : colors.graphiteMuted}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.kindRow}>
              {KINDS.map((kind) => {
                const isSelected = category.kind === kind;
                return (
                  <TouchableOpacity
                    key={kind}
                    style={[styles.kindPillSmall, isSelected && styles.kindPillSelected]}
                    activeOpacity={0.8}
                    disabled={updateMutation.isPending}
                    onPress={() => handleChangeKind(category, kind)}
                  >
                    <Text
                      style={[styles.kindPillSmallText, isSelected && styles.kindPillTextSelected]}
                    >
                      {categoryKindLabels[kind]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.removeBtn}
              activeOpacity={0.7}
              disabled={deleteMutation.isPending}
              onPress={() => handleDelete(category)}
            >
              <Ionicons name="trash-outline" size={14} color={colors.statusError} />
              <Text style={styles.removeText}>Remover do catálogo</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontFamily: typography.fonts.headline,
    fontSize: 22,
    color: colors.graphiteText,
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: 12,
    color: colors.graphiteMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 16,
    marginBottom: 16,
    ...shadows.card,
  },
  cardTitle: {
    fontFamily: typography.fonts.headline,
    fontSize: 16,
    color: colors.graphiteText,
    marginBottom: 10,
  },
  label: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.graphiteMuted,
    marginTop: 12,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surfaceCanvas,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    color: colors.graphiteText,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontFamily: typography.fonts.body,
    fontSize: 13,
  },
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kindPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceCanvas,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  kindPillSmall: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceCanvas,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
  },
  kindPillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  kindPillText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 12,
    color: colors.graphiteText,
  },
  kindPillSmallText: {
    fontFamily: typography.fonts.bodyMedium,
    fontSize: 10,
    color: colors.graphiteText,
  },
  kindPillTextSelected: {
    color: '#FFFFFF',
  },
  primaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.violetRoyal,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    marginTop: 14,
  },
  primaryBtnText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    padding: 13,
    marginBottom: 9,
  },
  itemInactive: {
    opacity: 0.6,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 14,
    color: colors.graphiteText,
  },
  itemMeta: {
    fontFamily: typography.fonts.body,
    fontSize: 10,
    color: colors.graphiteMuted,
    marginTop: 1,
  },
  toggle: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderWhisper,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleOn: {
    backgroundColor: colors.statusSuccess,
    borderColor: colors.statusSuccess,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: colors.borderWhisper,
  },
  removeText: {
    fontFamily: typography.fonts.bodySemiBold,
    fontSize: 11,
    color: colors.statusError,
  },
});
