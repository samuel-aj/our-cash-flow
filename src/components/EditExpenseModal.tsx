import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { formatCurrency } from '@/lib/finance-utils';
import { PAYMENT_METHODS, type PaymentMethod, type Expense } from '@/types/expense';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

interface EditExpenseModalProps {
  expense: Expense | null;
  open: boolean;
  onClose: () => void;
}

export function EditExpenseModal({ expense, open, onClose }: EditExpenseModalProps) {
  const { state, updateExpense } = useFinance();
  
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  // Load expense data when modal opens
  useEffect(() => {
    if (open && expense) {
      setDate(expense.date);
      setDescription(expense.description);
      setAmount(expense.amount.toString().replace('.', ','));
      setCategoryId(expense.categoryId);
      setPaymentMethod(expense.paymentMethod);
    }
  }, [open, expense]);

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!expense || !description.trim() || parsedAmount <= 0) {
      return;
    }

    const updatedExpense: Expense = {
      ...expense,
      date,
      description: description.trim(),
      amount: parsedAmount,
      categoryId,
      paymentMethod,
    };

    updateExpense(updatedExpense);
    toast({
      title: 'Gasto atualizado',
      description: `${description} foi atualizado com sucesso.`,
    });
    onClose();
  }, [expense, date, description, parsedAmount, categoryId, paymentMethod, updateExpense, onClose]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey && open) {
        handleSubmit(e as unknown as React.FormEvent);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, open]);

  if (!expense) return null;

  const isRecurringChild = !!expense.recurringParentId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Gasto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRecurringChild && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
              Este é um lançamento de compromisso fixo. Edições afetam apenas este mês.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date">Data</Label>
              <Input
                id="edit-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-focus"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Valor (R$)</Label>
              <Input
                id="edit-amount"
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-focus text-lg font-semibold"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input
              id="edit-description"
              placeholder="Ex: Supermercado, Almoço..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-focus"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="input-focus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {state.categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger className="input-focus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {expense.isInstallment && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <p>Compra parcelada: {expense.installmentNumber || 1}/{expense.totalInstallments}</p>
              <p className="text-xs mt-1">Para editar todas as parcelas, exclua e recrie o lançamento.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-primary hover:bg-primary/90"
              disabled={!description.trim() || parsedAmount <= 0}
            >
              Salvar
              <span className="ml-2 text-xs opacity-70">⌘↵</span>
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
