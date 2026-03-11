-- Dev seed data: runs automatically on `supabase db reset`
-- Creates two users, two orgs, memberships, and fake Instagram connections.

-- Fixed UUIDs for idempotency
DO $$
DECLARE
  evrhet_id uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  ryan_id   uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  dnd_org   uuid := '11111111-0000-0000-0000-000000000001';
  pizza_org uuid := '22222222-0000-0000-0000-000000000002';
BEGIN

  -- Auth users are created via GoTrue API in dev-entrypoint.sh
  -- (GoTrue handles password hashing and identity records properly)

  -- 1. Profiles
  INSERT INTO profiles (id, phone, brand_name, brand_description, tone, target_audience,
    onboarding_completed, publish_platforms) VALUES
    (evrhet_id, '+15550000001', 'D&D Labs',
     'Tabletop gaming content and custom miniature painting studio',
     'nerdy and enthusiastic', 'D&D players, tabletop gamers, miniature hobbyists',
     true, ARRAY['instagram', 'facebook']),
    (ryan_id, '+15550000002', 'Pizza Planet',
     'Authentic wood-fired pizza with locally sourced ingredients',
     'fun and appetizing', 'pizza lovers, local foodies, families',
     true, ARRAY['instagram'])
  ON CONFLICT (id) DO NOTHING;

  -- 3. Organizations
  INSERT INTO organizations (id, name, creator_user_id, brand_name, brand_description, tone, target_audience) VALUES
    (dnd_org, 'D&D Labs', evrhet_id, 'D&D Labs',
     'Tabletop gaming content and custom miniature painting studio',
     'nerdy and enthusiastic', 'D&D players, tabletop gamers'),
    (pizza_org, 'Pizza Planet', ryan_id, 'Pizza Planet',
     'Authentic wood-fired pizza with locally sourced ingredients',
     'fun and appetizing', 'pizza lovers, local foodies')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Memberships (both users in both orgs)
  INSERT INTO organization_members (organization_id, user_id, role) VALUES
    (dnd_org,   evrhet_id, 'owner'),
    (dnd_org,   ryan_id,   'manager'),
    (pizza_org, ryan_id,   'owner'),
    (pizza_org, evrhet_id, 'manager')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  -- 5. Fake Instagram connections
  INSERT INTO instagram_connections (id, organization_id, connected_by_user_id,
    instagram_user_id, access_token, token_expires_at, instagram_username) VALUES
    ('cccccccc-0000-0000-0000-000000000001'::uuid, dnd_org, evrhet_id,
     'ig_dnd_labs', 'fake_ig_token_dnd',
     now() + interval '55 days', 'dnd.labs'),
    ('cccccccc-0000-0000-0000-000000000002'::uuid, pizza_org, ryan_id,
     'ig_pizza_planet', 'fake_ig_token_pizza',
     now() + interval '45 days', 'pizza.planet')
  ON CONFLICT (id) DO NOTHING;

  -- 6. Sample posts (4 per org, 2 per user per org)

  -- D&D Labs: evrhet's posts
  INSERT INTO posts (id, profile_id, organization_id, image_url, caption, status, published_at, instagram_post_id) VALUES
    ('eeeeeeee-0000-0000-0000-000000000001'::uuid, evrhet_id, dnd_org,
     'https://placehold.co/1080x1080/7c3aed/white?text=D%26D+Labs',
     'Just finished painting this ancient red dragon mini. 40 hours of work but worth every second. #dnd #minipainting #ttrpg',
     'published', now() - interval '2 days', 'ig_post_001'),
    ('eeeeeeee-0000-0000-0000-000000000002'::uuid, evrhet_id, dnd_org,
     'https://placehold.co/1080x1080/7c3aed/white?text=D%26D+Labs',
     'New campaign starting this weekend! Building a homebrew world with some wild plot twists. #dungeonsanddragons',
     'draft', null, null),

  -- D&D Labs: ryan's posts
    ('eeeeeeee-0000-0000-0000-000000000005'::uuid, ryan_id, dnd_org,
     'https://placehold.co/1080x1080/7c3aed/white?text=D%26D+Labs',
     'Our party just hit level 20. Time to face Tiamat. Wish us luck. #dnd5e #ttrpg #epiclevel',
     'published', now() - interval '1 day', 'ig_post_005'),
    ('eeeeeeee-0000-0000-0000-000000000006'::uuid, ryan_id, dnd_org,
     'https://placehold.co/1080x1080/7c3aed/white?text=D%26D+Labs',
     'Sneak peek at the terrain I built for this week''s session. Modular dungeon tiles are a game changer.',
     'draft', null, null),

  -- Pizza Planet: ryan's posts
    ('eeeeeeee-0000-0000-0000-000000000003'::uuid, ryan_id, pizza_org,
     'https://placehold.co/1080x1080/dc2626/white?text=Pizza+Planet',
     'Fresh out of the wood-fired oven. Our new truffle mushroom pizza is here for a limited time. #pizza #woodfired',
     'published', now() - interval '5 days', 'ig_post_002'),
    ('eeeeeeee-0000-0000-0000-000000000004'::uuid, ryan_id, pizza_org,
     'https://placehold.co/1080x1080/dc2626/white?text=Pizza+Planet',
     'Happy hour starts at 4. Half-price slices and $5 craft beers. See you there!',
     'draft', null, null),

  -- Pizza Planet: evrhet's posts
    ('eeeeeeee-0000-0000-0000-000000000007'::uuid, evrhet_id, pizza_org,
     'https://placehold.co/1080x1080/dc2626/white?text=Pizza+Planet',
     'Behind the scenes: our dough ferments for 72 hours before it ever sees the oven. That''s the secret. #pizzacraft',
     'published', now() - interval '3 days', 'ig_post_007'),
    ('eeeeeeee-0000-0000-0000-000000000008'::uuid, evrhet_id, pizza_org,
     'https://placehold.co/1080x1080/dc2626/white?text=Pizza+Planet',
     'New seasonal menu dropping next week. Heirloom tomato + burrata is going to be a hit.',
     'draft', null, null)
  ON CONFLICT (id) DO NOTHING;

END $$;
