import { useState } from 'react';
import { motion } from 'framer-motion';
import { useFinance } from '@/contexts/FinanceContext';
import { useAuth } from '@/hooks/useAuth';
import { formatMonth, getCurrentMonth } from '@/lib/finance-utils';
import { addMonths, subMonths, parse, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Undo2, LogOut, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface HeaderProps {
  onQuickAdd: () => void;
  onUpload: () => void;
}

export function Header({ onQuickAdd, onUpload }: HeaderProps) {
  const { state, setCurrentMonth, closeDay, undo, canUndo } = useFinance();
  const { user, signOut } = useAuth();
  const [closeDayOpen, setCloseDayOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.slice(0, 2).toUpperCase() || 'U';

  const isCurrentMonth = state.currentMonth === getCurrentMonth();

  const handlePrevMonth = () => {
    const date = parse(state.currentMonth, 'yyyy-MM', new Date());
    setCurrentMonth(format(subMonths(date, 1), 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const date = parse(state.currentMonth, 'yyyy-MM', new Date());
    setCurrentMonth(format(addMonths(date, 1), 'yyyy-MM'));
  };

  const handleCloseDay = () => {
    closeDay(notes || undefined);
    setCloseDayOpen(false);
    setNotes('');
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <motion.h1 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xl font-bold text-foreground"
            >
              Controle Diário
            </motion.h1>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <motion.span
                key={state.currentMonth}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm font-medium capitalize min-w-[140px] text-center"
              >
                {formatMonth(state.currentMonth)}
              </motion.span>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              {!isCurrentMonth && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(getCurrentMonth())}
                  className="ml-2 text-xs"
                >
                  Voltar ao mês atual
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canUndo && (
              <Button
                variant="outline"
                size="sm"
                onClick={undo}
                className="gap-2"
              >
                <Undo2 className="h-4 w-4" />
                Desfazer
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setCloseDayOpen(true)}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Encerrar o dia
            </Button>

            <Button
              variant="outline"
              onClick={onUpload}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>

            <Button
              onClick={onQuickAdd}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Novo gasto
              <kbd className="hidden sm:inline-flex ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-primary-foreground/20 rounded">
                N
              </kbd>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive cursor-pointer">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Dialog open={closeDayOpen} onOpenChange={setCloseDayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-positive" />
              Encerrar o dia
            </DialogTitle>
            <DialogDescription>
              Registre que você completou a rotina de lançamentos de hoje.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Textarea
              placeholder="Notas do dia (opcional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-focus resize-none"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDayOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCloseDay} className="bg-positive hover:bg-positive/90">
              Confirmar encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
