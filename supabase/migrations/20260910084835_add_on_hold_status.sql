-- Additive change: existing items keep their status, progress, and notes.
-- Apply before deploying the UI that offers On hold.
alter type public.item_status add value if not exists 'on_hold' after 'in_progress';
