-- Parameterized exec_sql function used by the pipeline executor.
-- Accepts query_text with $1,$2,... placeholders and a jsonb array of params.
-- Substitution uses quote_literal server-side for proper escaping.
CREATE OR REPLACE FUNCTION exec_sql(query_text text, query_params jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  is_write boolean;
  processed_sql text;
  i integer;
  param_count integer;
  elem jsonb;
BEGIN
  processed_sql := query_text;
  param_count := jsonb_array_length(query_params);

  FOR i IN REVERSE param_count..1 LOOP
    elem := query_params->(i - 1);
    IF elem IS NULL OR jsonb_typeof(elem) = 'null' THEN
      processed_sql := replace(processed_sql, '$' || i, 'NULL');
    ELSIF jsonb_typeof(elem) = 'number' THEN
      processed_sql := replace(processed_sql, '$' || i, elem #>> '{}');
    ELSE
      processed_sql := replace(processed_sql, '$' || i, quote_literal(elem #>> '{}'));
    END IF;
  END LOOP;

  is_write := processed_sql ~* '^\s*(INSERT|UPDATE|DELETE)';

  IF is_write THEN
    EXECUTE 'WITH t AS (' || processed_sql || ') SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM t'
    INTO result;
  ELSE
    EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || processed_sql || ') t'
    INTO result;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION exec_sql(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION exec_sql(text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION exec_sql(text, jsonb) FROM authenticated;
