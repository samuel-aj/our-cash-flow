import { useState } from 'react';
import { motion } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, formatMonth, getUpcomingInstallments } from '@/lib/finance-utils';
import { Settings, ChevronRight, CreditCard, Repeat, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function Sidebar() {
  const { state, getCurrentBudget, updateBudget, getRecurringExpenses, removeRecurringExpense } = useFinance();
  const budget = getCurrentBudget();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [income, setIncome] = useState(budget?.income.toString() || '');

  const recurringExpenses = getRecurringExpenses();
  const recurringTotal = recurringExpenses.reduce((sum, e) => sum + e.amount, 0);

  const upcomingInstallments = getUpcomingInstallments(
    state.installments,
    state.expenses,
    state.currentMonth,
    3
  );

  const handleSaveBudget = () => {
    updateBudget({
      month: state.currentMonth,
      income: parseFloat(income.replace(',', '.')) || 0,
      fixedCommitments: budget?.fixedCommitments || [],
    });
    setSettingsOpen(false);
  };

  return (
    <aside className="w-80 bg-card border-l border-border p-6 overflow-y-auto scrollbar-thin">
      {/* Budget Settings */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Configurações do Mês
          </h3>
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Settings className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Configurar Orçamento</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="income">Receita mensal (R$)</Label>
                  <Input
                    id="income"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    className="input-focus"
                  />
                </div>

                <Button onClick={handleSaveBudget} className="w-full">
                  Salvar
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Receita
            </p>
            <p className="text-xl font-bold text-foreground">
              {budget ? formatCurrency(budget.income) : 'Não configurado'}
            </p>
          </div>

          {recurringExpenses.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    Compromissos fixos ({recurringExpenses.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {formatCurrency(recurringTotal)}
                  </span>
                  <ChevronRight className="h-4 w-4 transform transition-transform ui-open:rotate-90" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {recurringExpenses.map((expense) => {
                  const category = state.categories.find(c => c.id === expense.categoryId);
                  return (
                    <div
                      key={expense.id}
                      className="flex items-center justify-between px-3 py-2 text-sm group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-foreground">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          Dia {expense.recurringDueDay} • {category?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatCurrency(expense.amount)}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-negative"
                          onClick={() => removeRecurringExpense(expense.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>

      {/* Upcoming Installments */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Parcelas Futuras
        </h3>

        {upcomingInstallments.size === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma parcela futura
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(upcomingInstallments.entries()).map(([month, items]) => {
              const total = items.reduce((sum, i) => sum + i.installment.amount, 0);
              const isCurrentMonth = month === state.currentMonth;

              return (
                <Collapsible key={month} defaultOpen={isCurrentMonth}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="text-left">
                      <p className="text-sm font-medium capitalize">
                        {formatMonth(month)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {items.length} parcela{items.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-warning">
                      {formatCurrency(total)}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1">
                    {items.map(({ installment, expense }) => (
                      <motion.div
                        key={installment.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center justify-between px-3 py-2 text-sm rounded-lg hover:bg-muted/30"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-foreground">
                            {expense.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {installment.installmentIndex}/{expense.totalInstallments}
                          </p>
                        </div>
                        <span className="font-medium ml-2">
                          {formatCurrency(installment.amount)}
                        </span>
                      </motion.div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
          Categorias
        </h3>
        <div className="flex flex-wrap gap-2">
          {state.categories.map((category) => (
            <span
              key={category.id}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground"
            >
              {category.name}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
