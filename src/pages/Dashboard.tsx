import { useState, useEffect, useCallback } from 'react';
import { FinanceProvider } from '@/contexts/FinanceContext';
import { Header } from '@/components/Header';
import { AvailableCard } from '@/components/AvailableCard';
import { SummaryCards, ExpensesTotalCard } from '@/components/SummaryCards';
import { TransactionList } from '@/components/TransactionList';
import { Sidebar } from '@/components/Sidebar';
import { QuickAddModal } from '@/components/QuickAddModal';
import { EditExpenseModal } from '@/components/EditExpenseModal';
import type { Expense } from '@/types/expense';

function DashboardContent() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Keyboard shortcut for quick add
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'n' || e.key === 'N') {
      // Don't trigger if typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      e.preventDefault();
      setQuickAddOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header onQuickAdd={() => setQuickAddOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Hero: Available Amount */}
            <AvailableCard />

            {/* Summary Cards */}
            <SummaryCards />

            {/* Expenses Total */}
            <ExpensesTotalCard />

            {/* Transactions List */}
            <div className="card-elevated p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Lançamentos do mês
              </h2>
              <TransactionList onEdit={(expense) => setEditingExpense(expense)} />
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* Quick Add Modal */}
      <QuickAddModal
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
      />

      {/* Edit Expense Modal */}
      <EditExpenseModal
        expense={editingExpense}
        open={!!editingExpense}
        onClose={() => setEditingExpense(null)}
      />

      {/* Keyboard Shortcuts Footer */}
      <footer className="border-t border-border px-6 py-3 bg-card">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">N</kbd>
              {' '}Novo gasto
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">⌘</kbd>
              {' '}+{' '}
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">↵</kbd>
              {' '}Salvar
            </span>
          </div>
          <span>Controle Diário de Gastos v1.0</span>
        </div>
      </footer>
    </div>
  );
}

export default function Dashboard() {
  return (
    <FinanceProvider>
      <DashboardContent />
    </FinanceProvider>
  );
}
