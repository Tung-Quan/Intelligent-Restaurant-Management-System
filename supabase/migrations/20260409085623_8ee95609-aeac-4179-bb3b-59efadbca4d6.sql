
-- Fix overly permissive policies on restaurant_tables
DROP POLICY IF EXISTS "Staff can update tables" ON public.restaurant_tables;
CREATE POLICY "Staff can update tables" ON public.restaurant_tables FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'server') OR public.has_role(auth.uid(), 'host')
);

-- Fix overly permissive policies on reservations
DROP POLICY IF EXISTS "Staff can manage reservations" ON public.reservations;
CREATE POLICY "Staff can create reservations" ON public.reservations FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'server') OR public.has_role(auth.uid(), 'host')
);
CREATE POLICY "Staff can update reservations" ON public.reservations FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'server') OR public.has_role(auth.uid(), 'host')
);
CREATE POLICY "Staff can delete reservations" ON public.reservations FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- Fix overly permissive policies on orders
DROP POLICY IF EXISTS "Staff can manage orders" ON public.orders;
CREATE POLICY "Staff can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'server') OR public.has_role(auth.uid(), 'cashier')
);
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'server') OR public.has_role(auth.uid(), 'cashier') OR
  public.has_role(auth.uid(), 'chef')
);
CREATE POLICY "Staff can delete orders" ON public.orders FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);

-- Fix overly permissive policies on order_items
DROP POLICY IF EXISTS "Staff can manage order items" ON public.order_items;
CREATE POLICY "Staff can create order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'server')
);
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR
  public.has_role(auth.uid(), 'server') OR public.has_role(auth.uid(), 'chef')
);
CREATE POLICY "Staff can delete order items" ON public.order_items FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
);
