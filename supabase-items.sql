ALTER TABLE public.cases
	ADD COLUMN IF NOT EXISTS section_name TEXT NOT NULL DEFAULT 'Обычные кейсы';
