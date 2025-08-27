-- Seed data para o Menu Mestre Fácil
-- Este arquivo será executado automaticamente após as migrações

-- Inserir usuário de teste
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'teste@exemplo.com',
  crypt('123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "Usuário Teste"}',
  false,
  '',
  '',
  '',
  ''
);

-- Inserir perfil do usuário
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  avatar_url,
  slug,
  created_at,
  updated_at
) VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'teste@exemplo.com',
  'Usuário Teste',
  null,
  'usuario-teste',
  now(),
  now()
);

-- Inserir restaurante de exemplo
INSERT INTO public.restaurants (
  id,
  name,
  slug,
  cuisine_type,
  description,
  image_url,
  welcome_message,
  whatsapp_enabled,
  whatsapp_phone,
  user_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Restaurante Exemplo',
  'restaurante-exemplo',
  'Brasileira',
  'Um restaurante delicioso para testar o sistema',
  'https://via.placeholder.com/400x300',
  'Bem-vindo ao nosso restaurante!',
  true,
  '+5511999999999',
  '550e8400-e29b-41d4-a716-446655440000',
  now(),
  now()
);

-- Inserir categoria de exemplo
INSERT INTO public.categories (
  id,
  name,
  image_url,
  position,
  restaurant_id,
  created_at
) VALUES (
  gen_random_uuid(),
  'Pratos Principais',
  null,
  1,
  (SELECT id FROM public.restaurants LIMIT 1),
  now()
);

-- Inserir prato de exemplo
INSERT INTO public.dishes (
  id,
  name,
  description,
  price,
  image_url,
  is_available,
  category_id,
  restaurant_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Feijoada Completa',
  'Feijoada tradicional com todos os acompanhamentos',
  45.90,
  'https://via.placeholder.com/400x300',
  true,
  (SELECT id FROM public.categories LIMIT 1),
  (SELECT id FROM public.restaurants LIMIT 1),
  now(),
  now()
);

-- Inserir grupo de complementos
INSERT INTO public.complement_groups (
  id,
  title,
  description,
  required,
  max_selections,
  restaurant_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Acompanhamentos',
  'Escolha seus acompanhamentos favoritos',
  false,
  3,
  (SELECT id FROM public.restaurants LIMIT 1),
  now(),
  now()
);

-- Inserir complementos
INSERT INTO public.complements (
  id,
  name,
  description,
  price,
  group_id,
  created_at,
  updated_at
) VALUES 
  (gen_random_uuid(), 'Arroz', 'Arroz branco soltinho', 0.00, (SELECT id FROM public.complement_groups LIMIT 1), now(), now()),
  (gen_random_uuid(), 'Farofa', 'Farofa de bacon crocante', 3.50, (SELECT id FROM public.complement_groups LIMIT 1), now(), now()),
  (gen_random_uuid(), 'Couve', 'Couve refogada', 2.50, (SELECT id FROM public.complement_groups LIMIT 1), now(), now());

-- Associar grupo de complementos ao prato
INSERT INTO public.dish_complement_groups (
  id,
  dish_id,
  complement_group_id,
  position,
  created_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM public.dishes LIMIT 1),
  (SELECT id FROM public.complement_groups LIMIT 1),
  1,
  now()
);

-- Inserir menu de exemplo
INSERT INTO public.menus (
  id,
  name,
  description,
  is_active,
  restaurant_id,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Menu Principal',
  'Nosso menu principal com os melhores pratos',
  true,
  (SELECT id FROM public.restaurants LIMIT 1),
  now(),
  now()
);

-- Associar prato ao menu
INSERT INTO public.dish_categories (
  id,
  dish_id,
  category_id,
  position,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  (SELECT id FROM public.dishes LIMIT 1),
  (SELECT id FROM public.categories LIMIT 1),
  1,
  now(),
  now()
);
