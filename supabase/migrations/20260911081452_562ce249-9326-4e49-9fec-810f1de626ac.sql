alter table public.store_telegram_config add column if not exists chat_ids text[];

update public.store_telegram_config set chat_ids = array[chat_id] where chat_ids is null and chat_id is not null and chat_id <> '';

comment on column public.store_telegram_config.chat_ids is 'All Telegram group/chat IDs that receive order alerts. chat_id is the legacy single value, kept in sync for compatibility.';