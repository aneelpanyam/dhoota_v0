-- Gate all bookmark.* options behind the 'bookmarks_enabled' feature flag.
-- Tenants must have this flag enabled to see bookmark options.

UPDATE option_definitions
SET required_toggles = ARRAY['bookmarks_enabled']
WHERE id IN (
  'bookmark.add',
  'bookmark.list',
  'bookmark.remove'
);
