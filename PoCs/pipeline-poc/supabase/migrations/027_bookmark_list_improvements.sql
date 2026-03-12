-- ============================================
-- 027: Bookmark list improvements
-- Updates bookmark.list SQL to include entity_id
-- and conversation_id (for message bookmarks)
-- so the UI can navigate to bookmarked items.
-- ============================================

UPDATE sql_templates
SET sql = $$
SELECT b.id, b.entity_type, b.entity_id, b.label, b.created_at,
       m.conversation_id
FROM bookmarks b
LEFT JOIN messages m ON b.entity_type = 'message' AND m.id = b.entity_id
WHERE b.tenant_id = $1 AND b.user_id = $2
  AND ($3::text IS NULL OR b.entity_type = $3)
ORDER BY b.created_at DESC
LIMIT $4 OFFSET $5
$$
WHERE option_id = 'bookmark.list' AND name = 'list_bookmarks';

-- Also add bookmark.remove to the bookmark.list follow-ups
UPDATE option_definitions
SET follow_up_option_ids = ARRAY['bookmark.add', 'bookmark.remove']
WHERE id = 'bookmark.list'
  AND NOT follow_up_option_ids @> ARRAY['bookmark.remove'];
