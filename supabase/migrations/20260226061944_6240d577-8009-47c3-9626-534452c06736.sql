
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'retainer',
  ADD COLUMN IF NOT EXISTS monthly_retainer numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS one_time_cost numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarded_at date DEFAULT CURRENT_DATE;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_contract_type_check 
  CHECK (contract_type IN ('retainer', 'one_time', 'project'));
