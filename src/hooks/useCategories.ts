import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_CATEGORIES, Category } from '@/types/expense';

interface DbCategory {
  id: string;
  name: string;
  color_index: number;
}

export function useCategories() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at');

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        // Create default categories for new user
        const defaultCategoriesToInsert = DEFAULT_CATEGORIES.map(cat => ({
          user_id: user.id,
          name: cat.name,
          color_index: cat.colorIndex,
        }));

        const { data: insertedData, error: insertError } = await supabase
          .from('categories')
          .insert(defaultCategoriesToInsert)
          .select();

        if (insertError) throw insertError;

        const mappedCategories: Category[] = (insertedData || []).map((cat: DbCategory) => ({
          id: cat.id,
          name: cat.name,
          colorIndex: cat.color_index,
        }));
        setCategories(mappedCategories);
      } else {
        const mappedCategories: Category[] = data.map((cat: DbCategory) => ({
          id: cat.id,
          name: cat.name,
          colorIndex: cat.color_index,
        }));
        setCategories(mappedCategories);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Erro ao carregar categorias');
      // Fallback to default categories
      setCategories(DEFAULT_CATEGORIES);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const updateCategories = useCallback(async (newCategories: Category[]) => {
    if (!user) return;

    try {
      // For simplicity, we'll update individual categories
      for (const cat of newCategories) {
        await supabase
          .from('categories')
          .update({ name: cat.name, color_index: cat.colorIndex })
          .eq('id', cat.id)
          .eq('user_id', user.id);
      }
      setCategories(newCategories);
    } catch (err) {
      console.error('Error updating categories:', err);
    }
  }, [user]);

  return {
    categories,
    loading,
    error,
    refetch: fetchCategories,
    updateCategories,
  };
}
