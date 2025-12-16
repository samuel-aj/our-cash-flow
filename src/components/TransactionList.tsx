import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { getExpensesByDate, formatCurrency, formatShortDate } from '@/lib/finance-utils';
import { Pencil, Trash2, CreditCard, Banknote, Smartphone, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
import type { Expense } from '@/types/expense';

const paymentIcons = {
  card: CreditCard,
  cash: Banknote,
  pix: Smartphone,
  transfer: ArrowLeftRight,
};

const categoryColors: Record<number, string> = {
  1: 'bg-category-1/15 text-category-1 border-category-1/30',
  2: 'bg-category-2/15 text-category-2 border-category-2/30',
  3: 'bg-category-3/15 text-category-3 border-category-3/30',
  4: 'bg-category-4/15 text-category-4 border-category-4/30',
  5: 'bg-category-5/15 text-category-5 border-category-5/30',
  6: 'bg-category-6/15 text-category-6 border-category-6/30',
  7: 'bg-category-7/15 text-category-7 border-category-7/30',
  8: 'bg-category-8/15 text-category-8 border-category-8/30',
};

interface TransactionListProps {
  onEdit?: (expense: Expense) => void;
}

export function TransactionList({ onEdit }: TransactionListProps) {
  const { state, deleteExpense } = useFinance();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const expensesByDate = getExpensesByDate(state.expenses, state.currentMonth);
  const dates = Array.from(expensesByDate.keys()).sort((a, b) => b.localeCompare(a));

  const getCategoryById = (id: string) => {
    return state.categories.find((c) => c.id === id);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteExpense(deleteId);
      setDeleteId(null);
    }
  };

  if (dates.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Banknote className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Nenhum gasto registrado neste mês</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Use o botão + ou pressione N para adicionar
        </p>
      </motion.div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {dates.map((date) => {
          const expenses = expensesByDate.get(date) || [];
          const dayTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

          return (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {formatShortDate(date)}
                </h3>
                <span className="text-sm font-medium text-negative">
                  -{formatCurrency(dayTotal)}
                </span>
              </div>

              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {expenses.map((expense) => {
                    const category = getCategoryById(expense.categoryId);
                    const PaymentIcon = paymentIcons[expense.paymentMethod];
                    const colorClass = category
                      ? categoryColors[category.colorIndex] || categoryColors[8]
                      : categoryColors[8];

                    return (
                      <motion.div
                        key={expense.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="transaction-item group"
                      >
                        <div
                          className={cn(
                            'category-chip border',
                            colorClass
                          )}
                        >
                          {category?.name || 'Outros'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">
                            {expense.description}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <PaymentIcon className="h-3 w-3" />
                            {expense.isInstallment && expense.totalInstallments && (
                              <span className="text-primary">
                                {expense.installmentNumber || 1}/{expense.totalInstallments}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-foreground">
                            {formatCurrency(expense.amount)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => onEdit(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-negative hover:text-negative hover:bg-negative-light"
                            onClick={() => setDeleteId(expense.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O lançamento será removido permanentemente.
              {state.expenses.find((e) => e.id === deleteId)?.isInstallment && (
                <span className="block mt-2 text-warning">
                  Atenção: todas as parcelas futuras também serão removidas.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-negative hover:bg-negative/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
