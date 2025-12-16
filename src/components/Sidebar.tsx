import { useState } from 'react';
import { motion } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency, formatMonth, getUpcomingInstallments } from '@/lib/finance-utils';
import { Settings, ChevronRight, Plus, X, CreditCard } from 'lucide-react';
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
import type { FixedCommitment } from '@/types/expense';

export function Sidebar() {
  const { state, getCurrentBudget, updateBudget, addFixedCommitment, removeFixedCommitment } = useFinance();
  const budget = getCurrentBudget();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [income, setIncome] = useState(budget?.income.toString() || '');
  const [newCommitmentName, setNewCommitmentName] = useState('');
  const [newCommitmentAmount, setNewCommitmentAmount] = useState('');

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

  const handleAddCommitment = () => {
    if (newCommitmentName && newCommitmentAmount) {
      addFixedCommitment({
        name: newCommitmentName,
        amount: parseFloat(newCommitmentAmount.replace(',', '.')) || 0,
      });
      setNewCommitmentName('');
      setNewCommitmentAmount('');
    }
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

                <div className="space-y-3">
                  <Label>Compromissos fixos</Label>
                  {budget?.fixedCommitments.map((commitment) => (
                    <div
                      key={commitment.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-sm">{commitment.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(commitment.amount)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-negative"
                        onClick={() => removeFixedCommitment(commitment.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome"
                      value={newCommitmentName}
                      onChange={(e) => setNewCommitmentName(e.target.value)}
                      className="input-focus flex-1"
                    />
                    <Input
                      placeholder="Valor"
                      type="text"
                      inputMode="decimal"
                      value={newCommitmentAmount}
                      onChange={(e) => setNewCommitmentAmount(e.target.value)}
                      className="input-focus w-24"
                    />
                    <Button
                      type="button"
                      size="icon"
                      onClick={handleAddCommitment}
                      disabled={!newCommitmentName || !newCommitmentAmount}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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

          {budget && budget.fixedCommitments.length > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <span className="text-sm font-medium">
                  Compromissos fixos ({budget.fixedCommitments.length})
                </span>
                <ChevronRight className="h-4 w-4 transform transition-transform ui-open:rotate-90" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 mt-1">
                {budget.fixedCommitments.map((commitment) => (
                  <div
                    key={commitment.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{commitment.name}</span>
                    <span className="font-medium">{formatCurrency(commitment.amount)}</span>
                  </div>
                ))}
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
