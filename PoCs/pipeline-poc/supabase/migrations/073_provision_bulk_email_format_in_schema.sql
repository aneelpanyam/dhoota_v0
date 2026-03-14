-- Add format: email to provision_bulk users.items.properties.email for paramSchema validation
UPDATE option_definitions SET
  input_schema = jsonb_set(
    input_schema,
    '{properties,users,items,properties,email}',
    '{"type": "string", "format": "email"}'::jsonb
  )
WHERE id = 'admin.user.provision_bulk';
