-- Function to execute raw SQL (used by the pipeline executor)
-- Only callable by service role
CREATE OR REPLACE FUNCTION exec_raw_sql(query_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  is_write boolean;
BEGIN
  is_write := query_text ~* '^\s*(INSERT|UPDATE|DELETE)';

  IF is_write THEN
    EXECUTE 'WITH t AS (' || query_text || ') SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM t'
    INTO result;
  ELSE
    EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || query_text || ') t'
    INTO result;
  END IF;

  RETURN result;
END;
$$;

-- Restrict to service role only
REVOKE ALL ON FUNCTION exec_raw_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION exec_raw_sql(text) FROM anon;
REVOKE ALL ON FUNCTION exec_raw_sql(text) FROM authenticated;
