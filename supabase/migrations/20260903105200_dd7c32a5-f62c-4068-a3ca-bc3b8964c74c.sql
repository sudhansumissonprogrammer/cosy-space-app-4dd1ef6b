CREATE TABLE public.assistant_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistant_conversations TO authenticated;
GRANT ALL ON public.assistant_conversations TO service_role;
ALTER TABLE public.assistant_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own assistant conversations" ON public.assistant_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid());

CREATE TABLE public.assistant_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.assistant_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assistant_messages_conv_idx ON public.assistant_messages (conversation_id, created_at);

GRANT SELECT, INSERT ON public.assistant_messages TO authenticated;
GRANT ALL ON public.assistant_messages TO service_role;
ALTER TABLE public.assistant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own assistant messages" ON public.assistant_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.assistant_conversations c
    WHERE c.id = conversation_id
      AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

CREATE POLICY "insert own assistant messages" ON public.assistant_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.assistant_conversations c
    WHERE c.id = conversation_id AND c.user_id = auth.uid()
  ));

CREATE TABLE public.assistant_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.assistant_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  helpful boolean NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.assistant_feedback TO authenticated;
GRANT ALL ON public.assistant_feedback TO service_role;
ALTER TABLE public.assistant_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own assistant feedback" ON public.assistant_feedback
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "insert own assistant feedback" ON public.assistant_feedback
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());