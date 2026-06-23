-- ============================================
-- Seed Data for Wedding Website
-- ============================================

-- Insert sample professional photos
insert into photos (url, thumbnail, caption, category, is_professional, photographer, tags)
values 
  (
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200',
    'https://images.unsplash.com/photo-1519741497674-611481863552?w=400',
    'The perfect day',
    'Ceremony',
    true,
    'Professional Photographer',
    array['ceremony', 'couple', 'love']
  ),
  (
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200',
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=400',
    'Our first dance',
    'Reception',
    true,
    'Professional Photographer',
    array['dance', 'reception', 'romance']
  ),
  (
    'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=1200',
    'https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=400',
    'The ceremony venue',
    'Ceremony',
    true,
    'Professional Photographer',
    array['venue', 'ceremony', 'flowers']
  ),
  (
    'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200',
    'https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=400',
    'Beautiful decorations',
    'Details',
    true,
    'Professional Photographer',
    array['decor', 'details', 'flowers']
  )
on conflict do nothing;

-- Insert sample guestbook messages
-- `type` column was dropped in 20260410001200_drop_guestbook_type_and_anniversary.sql
insert into guestbook_messages (name, email, content, reactions)
values 
  (
    'Sarah & Mike', 
    'sarah@example.com', 
    'Congratulations you two! Wishing you a lifetime of love and happiness. The wedding was absolutely beautiful!', 
    '{"heart": 5, "clap": 2}'
  ),
  (
    'The Johnson Family', 
    'johnson@example.com', 
    'Thank you for letting us be part of your special day. May your love continue to grow stronger with each passing year.',
    '{"heart": 3}'
  ),
  (
    'Aunt Patricia',
    'patricia@example.com',
    'I have known Jordyn since she was a baby. Seeing her so happy brought tears to my eyes. Austin, welcome to the family!',
    '{"heart": 8, "cry": 3}'
  )
on conflict do nothing;
