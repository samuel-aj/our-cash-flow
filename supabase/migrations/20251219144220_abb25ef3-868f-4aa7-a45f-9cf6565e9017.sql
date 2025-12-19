-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'card',
  is_installment BOOLEAN DEFAULT false,
  total_installments INTEGER,
  installment_number INTEGER,
  parent_expense_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  notes TEXT,
  is_recurring BOOLEAN DEFAULT false,
  recurring_due_day INTEGER,
  recurring_parent_id UUID REFERENCES public.expenses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own expenses" ON public.expenses
  FOR ALL USING (auth.uid() = user_id);

-- Create budgets table
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM format
  income DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own budgets" ON public.budgets
  FOR ALL USING (auth.uid() = user_id);

-- Create fixed_commitments table
CREATE TABLE public.fixed_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_day INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fixed_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage commitments via budget" ON public.fixed_commitments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.budgets 
      WHERE budgets.id = fixed_commitments.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );

-- Create category_budgets table
CREATE TABLE public.category_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  planned_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(budget_id, category_id)
);

ALTER TABLE public.category_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage category budgets via budget" ON public.category_budgets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.budgets 
      WHERE budgets.id = category_budgets.budget_id 
      AND budgets.user_id = auth.uid()
    )
  );

-- Create installments table
CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  due_month TEXT NOT NULL, -- YYYY-MM format
  installment_index INTEGER NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage installments via expense" ON public.installments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.expenses 
      WHERE expenses.id = installments.expense_id 
      AND expenses.user_id = auth.uid()
    )
  );

-- Create storage bucket for receipts/invoices
INSERT INTO storage.buckets (id, name, public) VALUES ('receipts', 'receipts', false);

CREATE POLICY "Users can upload their own receipts" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own receipts" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own receipts" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]
  );