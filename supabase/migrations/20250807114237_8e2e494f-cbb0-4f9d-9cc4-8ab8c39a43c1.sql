-- Atualizar as políticas RLS para usar user_id corretamente
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.restaurants;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON public.restaurants;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON public.restaurants;

CREATE POLICY "Users can manage their own restaurants" 
ON public.restaurants 
FOR ALL 
USING (auth.uid() = user_id);

-- Atualizar políticas das categorias para usar restaurant ownership
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.categories;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON public.categories;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON public.categories;

CREATE POLICY "Users can manage categories of their restaurants" 
ON public.categories 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = categories.restaurant_id 
  AND r.user_id = auth.uid()
));

-- Atualizar políticas dos pratos para usar restaurant ownership  
DROP POLICY IF EXISTS "Permitir inserção para usuários autenticados" ON public.dishes;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados" ON public.dishes;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados" ON public.dishes;

CREATE POLICY "Users can manage dishes of their restaurants" 
ON public.dishes 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.restaurants r 
  WHERE r.id = dishes.restaurant_id 
  AND r.user_id = auth.uid()
));