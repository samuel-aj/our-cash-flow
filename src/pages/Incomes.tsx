import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatMonth, getCurrentMonth } from '@/lib/finance-utils';
import {
  Plus,
  ArrowLeft,
  Wallet,
  Tag,
  Pencil,
  Trash2,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface IncomeCategory {
  id: string;
  name: string;
  color_index: number;
}

interface Income {
  id: string;
  month: string;
  description: string;
  amount: number;
  category_id: string | null;
  date: string;
  notes: string | null;
}

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salário', color_index: 1 },
  { name: 'Aluguel', color_index: 2 },
  { name: 'Rendimentos', color_index: 3 },
  { name: 'Freelance', color_index: 4 },
  { name: 'Outros', color_index: 5 },
];

const categoryColors: Record<number, string> = {
  1: 'bg-primary/20 text-primary',
  2: 'bg-positive/20 text-positive',
  3: 'bg-warning/20 text-warning-foreground',
  4: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  5: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  6: 'bg-pink-500/20 text-pink-600 dark:text-pink-400',
  7: 'bg-orange-500/20 text-orange-600 dark:text-orange-400',
  8: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
};

export default function Incomes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [addIncomeOpen, setAddIncomeOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [editingCategory, setEditingCategory] = useState<IncomeCategory | null>(null);
  const [deleteIncomeId, setDeleteIncomeId] = useState<string | null>(null);
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);

  // Form states
  const [incomeForm, setIncomeForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    color_index: 1,
  });

  // Fetch data
  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user, currentMonth]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch categories
      const { data: catData, error: catError } = await supabase
        .from('income_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (catError) throw catError;

      // If no categories exist, create defaults
      if (!catData || catData.length === 0) {
        const { data: newCats, error: insertError } = await supabase
          .from('income_categories')
          .insert(
            DEFAULT_INCOME_CATEGORIES.map(cat => ({
              ...cat,
              user_id: user.id,
            }))
          )
          .select();

        if (insertError) throw insertError;
        setCategories(newCats || []);
      } else {
        setCategories(catData);
      }

      // Fetch incomes for current month
      const { data: incomeData, error: incomeError } = await supabase
        .from('incomes')
        .select('*')
        .eq('user_id', user.id)
        .eq('month', currentMonth)
        .order('date', { ascending: false });

      if (incomeError) throw incomeError;
      setIncomes(incomeData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  // Month navigation
  const changeMonth = (delta: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    setCurrentMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    );
  };

  // Income CRUD
  const handleSaveIncome = async () => {
    if (!user || !incomeForm.description || !incomeForm.amount) {
      toast.error('Preencha descrição e valor');
      return;
    }

    const amount = parseFloat(incomeForm.amount.replace(',', '.'));
    if (isNaN(amount) || amount <= 0) {
      toast.error('Valor inválido');
      return;
    }

    const incomeData = {
      user_id: user.id,
      month: currentMonth,
      description: incomeForm.description,
      amount,
      category_id: incomeForm.category_id || null,
      date: incomeForm.date,
      notes: incomeForm.notes || null,
    };

    try {
      if (editingIncome) {
        const { error } = await supabase
          .from('incomes')
          .update(incomeData)
          .eq('id', editingIncome.id);
        if (error) throw error;
        toast.success('Receita atualizada');
      } else {
        const { error } = await supabase.from('incomes').insert(incomeData);
        if (error) throw error;
        toast.success('Receita adicionada');
      }

      setAddIncomeOpen(false);
      setEditingIncome(null);
      resetIncomeForm();
      fetchData();
    } catch (error) {
      console.error('Error saving income:', error);
      toast.error('Erro ao salvar receita');
    }
  };

  const handleDeleteIncome = async () => {
    if (!deleteIncomeId) return;

    try {
      const { error } = await supabase
        .from('incomes')
        .delete()
        .eq('id', deleteIncomeId);
      if (error) throw error;
      toast.success('Receita removida');
      setDeleteIncomeId(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting income:', error);
      toast.error('Erro ao remover receita');
    }
  };

  const resetIncomeForm = () => {
    setIncomeForm({
      description: '',
      amount: '',
      category_id: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const openEditIncome = (income: Income) => {
    setIncomeForm({
      description: income.description,
      amount: income.amount.toString(),
      category_id: income.category_id || '',
      date: income.date,
      notes: income.notes || '',
    });
    setEditingIncome(income);
    setAddIncomeOpen(true);
  };

  // Category CRUD
  const handleSaveCategory = async () => {
    if (!user || !categoryForm.name) {
      toast.error('Preencha o nome da categoria');
      return;
    }

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('income_categories')
          .update({
            name: categoryForm.name,
            color_index: categoryForm.color_index,
          })
          .eq('id', editingCategory.id);
        if (error) throw error;
        toast.success('Categoria atualizada');
      } else {
        const { error } = await supabase.from('income_categories').insert({
          user_id: user.id,
          name: categoryForm.name,
          color_index: categoryForm.color_index,
        });
        if (error) throw error;
        toast.success('Categoria criada');
      }

      setAddCategoryOpen(false);
      setEditingCategory(null);
      setCategoryForm({ name: '', color_index: 1 });
      fetchData();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Erro ao salvar categoria');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryId) return;

    try {
      const { error } = await supabase
        .from('income_categories')
        .delete()
        .eq('id', deleteCategoryId);
      if (error) throw error;
      toast.success('Categoria removida');
      setDeleteCategoryId(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Erro ao remover categoria');
    }
  };

  const openEditCategory = (category: IncomeCategory) => {
    setCategoryForm({
      name: category.name,
      color_index: category.color_index,
    });
    setEditingCategory(category);
    setAddCategoryOpen(true);
  };

  // Calculate totals
  const totalIncome = incomes.reduce((sum, inc) => sum + inc.amount, 0);
  const incomesByCategory = categories.map(cat => ({
    category: cat,
    total: incomes
      .filter(inc => inc.category_id === cat.id)
      .reduce((sum, inc) => sum + inc.amount, 0),
  }));

  const getCategoryById = (id: string | null) =>
    categories.find(c => c.id === id);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Receitas</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie suas fontes de renda
              </p>
            </div>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium capitalize min-w-[120px] text-center">
              {formatMonth(currentMonth)}
            </span>
            <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Total Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-hero positive p-6 text-center"
          >
            <p className="text-sm text-muted-foreground mb-1">
              Total de receitas em {formatMonth(currentMonth)}
            </p>
            <p className="hero-number positive">{formatCurrency(totalIncome)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {incomes.length} entrada{incomes.length !== 1 ? 's' : ''} registrada
              {incomes.length !== 1 ? 's' : ''}
            </p>
          </motion.div>

          {/* Categories Section */}
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Categorias de Receita
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCategoryForm({ name: '', color_index: 1 });
                  setEditingCategory(null);
                  setAddCategoryOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map(cat => {
                const catTotal = incomesByCategory.find(
                  ic => ic.category.id === cat.id
                )?.total || 0;
                return (
                  <div
                    key={cat.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg ${
                      categoryColors[cat.color_index] || categoryColors[1]
                    }`}
                  >
                    <span className="text-sm font-medium">{cat.name}</span>
                    <span className="text-xs opacity-75">
                      {formatCurrency(catTotal)}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="p-1 hover:bg-background/20 rounded"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => setDeleteCategoryId(cat.id)}
                        className="p-1 hover:bg-background/20 rounded text-negative"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Incomes List */}
          <div className="card-elevated p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Wallet className="h-5 w-5 text-positive" />
                Entradas do mês
              </h2>
              <Button
                onClick={() => {
                  resetIncomeForm();
                  setEditingIncome(null);
                  setAddIncomeOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova receita
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : incomes.length === 0 ? (
              <div className="text-center py-12">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">
                  Nenhuma receita registrada neste mês
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    resetIncomeForm();
                    setEditingIncome(null);
                    setAddIncomeOpen(true);
                  }}
                >
                  Adicionar primeira receita
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {incomes.map(income => {
                    const category = getCategoryById(income.category_id);
                    return (
                      <motion.div
                        key={income.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="transaction-item group"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            category
                              ? categoryColors[category.color_index] ||
                                categoryColors[1]
                              : 'bg-muted'
                          }`}
                        >
                          <Wallet className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {income.description}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {category?.name || 'Sem categoria'} •{' '}
                            {new Date(income.date + 'T00:00:00').toLocaleDateString(
                              'pt-BR',
                              { day: '2-digit', month: 'short' }
                            )}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-positive">
                            +{formatCurrency(income.amount)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditIncome(income)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-negative"
                            onClick={() => setDeleteIncomeId(income.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Add/Edit Income Dialog */}
      <Dialog
        open={addIncomeOpen}
        onOpenChange={open => {
          setAddIncomeOpen(open);
          if (!open) {
            setEditingIncome(null);
            resetIncomeForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingIncome ? 'Editar receita' : 'Nova receita'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="income-desc">Descrição</Label>
              <Input
                id="income-desc"
                placeholder="Ex: Salário mensal"
                value={incomeForm.description}
                onChange={e =>
                  setIncomeForm(prev => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="income-amount">Valor (R$)</Label>
              <Input
                id="income-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={incomeForm.amount}
                onChange={e =>
                  setIncomeForm(prev => ({ ...prev, amount: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="income-category">Categoria</Label>
              <Select
                value={incomeForm.category_id}
                onValueChange={value =>
                  setIncomeForm(prev => ({ ...prev, category_id: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="income-date">Data</Label>
              <Input
                id="income-date"
                type="date"
                value={incomeForm.date}
                onChange={e =>
                  setIncomeForm(prev => ({ ...prev, date: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="income-notes">Observações (opcional)</Label>
              <Input
                id="income-notes"
                placeholder="Notas adicionais"
                value={incomeForm.notes}
                onChange={e =>
                  setIncomeForm(prev => ({ ...prev, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setAddIncomeOpen(false);
                setEditingIncome(null);
                resetIncomeForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveIncome}>
              <Check className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Category Dialog */}
      <Dialog
        open={addCategoryOpen}
        onOpenChange={open => {
          setAddCategoryOpen(open);
          if (!open) {
            setEditingCategory(null);
            setCategoryForm({ name: '', color_index: 1 });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar categoria' : 'Nova categoria'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                placeholder="Ex: Investimentos"
                value={categoryForm.name}
                onChange={e =>
                  setCategoryForm(prev => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(colorIndex => (
                  <button
                    key={colorIndex}
                    type="button"
                    onClick={() =>
                      setCategoryForm(prev => ({
                        ...prev,
                        color_index: colorIndex,
                      }))
                    }
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
                      categoryColors[colorIndex]
                    } ${
                      categoryForm.color_index === colorIndex
                        ? 'ring-2 ring-primary ring-offset-2 scale-110'
                        : 'hover:scale-105'
                    }`}
                  >
                    {categoryForm.color_index === colorIndex && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setAddCategoryOpen(false);
                setEditingCategory(null);
                setCategoryForm({ name: '', color_index: 1 });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveCategory}>
              <Check className="h-4 w-4 mr-1" />
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Income Confirmation */}
      <AlertDialog
        open={!!deleteIncomeId}
        onOpenChange={() => setDeleteIncomeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover receita?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteIncome}
              className="bg-negative hover:bg-negative/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Confirmation */}
      <AlertDialog
        open={!!deleteCategoryId}
        onOpenChange={() => setDeleteCategoryId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              As receitas desta categoria ficarão sem categoria. Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCategory}
              className="bg-negative hover:bg-negative/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
