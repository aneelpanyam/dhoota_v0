-- ============================================
-- 059: Public site welcome message and title "Yours Truly"
-- For tenant 849fe865, representative 5d4ba89b
-- BJP-aligned political worker: accountability, visibility, people-first
-- ============================================

INSERT INTO public_site_configs (tenant_id, user_id, welcome_message, enabled_option_ids, site_title)
VALUES (
  '849fe865-848e-4447-9bae-5d6a4301ddf5'::uuid,
  '5d4ba89b-3365-4625-a846-d9f13d9e2ba7'::uuid,
  '**Welcome to Yours Truly**

I am a dedicated political worker aligned with the Bharatiya Janata Party, committed to bringing transparency and accountability to public service. This space is your window into the work I do—the activities, initiatives, and efforts that connect our party''s values with the people we serve.

I believe in being **people-oriented** and **action-oriented**: always in the midst of the community, listening, helping, and acting. As your voice and as a dedicated worker for the party, my mission is to take the values and results of the BJP to every doorstep—ensuring that the work we do is visible, accountable, and truly serves the people.

Explore my activities, stay informed, and reach out anytime. I am here for you.',
  ARRAY['public.activities', 'public.stats', 'public.announcements', 'public.info_cards', 'public.about'],
  'Yours Truly'
)
ON CONFLICT (tenant_id, user_id) DO UPDATE SET
  welcome_message = EXCLUDED.welcome_message,
  site_title = EXCLUDED.site_title,
  updated_at = now();
