-- Create subscriptions table (plans)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    subscription_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (name IN ('Basic', 'SUP PRO', 'Unlimited')),
    price_monthly numeric(10,2) NOT NULL,
    price_yearly numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc', now())
);

-- Create or update user_subscriptions table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id uuid NOT NULL REFERENCES public.subscriptions(subscription_id) ON DELETE CASCADE,
    subscription_type text NOT NULL CHECK (subscription_type IN ('basic', 'sup_pro', 'unlimited')),
    subscription_status text NOT NULL CHECK (subscription_status IN ('active', 'canceled', 'trial')),
    subscription_end_date date,
    payment_method text,
    created_at timestamp with time zone DEFAULT timezone('utc', now()),
    updated_at timestamp with time zone DEFAULT timezone('utc', now())
);

-- Optional: Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id); 