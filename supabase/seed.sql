INSERT INTO permissions (code, name, description, category) VALUES
  -- Carer permissions
  ('carers.view', 'View Carers', 'Can view carer profiles and details', 'Carers'),
  ('carers.create', 'Create Carers', 'Can add new carers to the system', 'Carers'),
  ('carers.edit', 'Edit Carers', 'Can modify carer information', 'Carers'),
  ('carers.delete', 'Delete Carers', 'Can remove carers from the system', 'Carers'),
  
  -- Document permissions
  ('documents.view', 'View Documents', 'Can view uploaded documents', 'Documents'),
  ('documents.upload', 'Upload Documents', 'Can upload documents for carers', 'Documents'),
  ('documents.review', 'Review Documents', 'Can approve or reject documents', 'Documents'),
  ('documents.delete', 'Delete Documents', 'Can delete documents', 'Documents'),
  
  -- Automation permissions
  ('automations.view', 'View Automations', 'Can view reminder rules', 'Automations'),
  ('automations.manage', 'Manage Automations', 'Can create and edit reminder rules', 'Automations'),
  
  -- Team permissions
  ('team.view', 'View Team', 'Can view team members', 'Team'),
  ('team.invite', 'Invite Members', 'Can invite new team members', 'Team'),
  ('team.manage', 'Manage Team', 'Can edit roles and remove members', 'Team'),
  
  -- Settings permissions
  ('settings.view', 'View Settings', 'Can view organization settings', 'Settings'),
  ('settings.manage', 'Manage Settings', 'Can modify organization settings', 'Settings'),

  -- Billing permissions
  ('billing.view', 'View Billing', 'Can view subscription and billing information', 'Billing'),
  ('billing.manage', 'Manage Billing', 'Can change plans and manage billing portal access', 'Billing'),
  
  -- Audit permissions
  ('audit.view', 'View Audit Logs', 'Can view audit logs', 'Audit')
ON CONFLICT (code) DO NOTHING;


INSERT INTO roles (organization_id, name, scope, is_system_role, description)
VALUES
(NULL, 'platform_super_admin', 'PLATFORM', true, 'Full platform control. Can manage all tenants, billing, and system settings.'),
(NULL, 'platform_admin', 'PLATFORM', true, 'Can manage tenants and system operations but limited access to critical settings.'),
(NULL, 'support', 'PLATFORM', true, 'Support role with read access and limited operational capabilities.')
ON CONFLICT (name) WHERE organization_id IS NULL AND scope = 'PLATFORM'
DO UPDATE SET
  description = EXCLUDED.description,
  scope = EXCLUDED.scope,
  is_system_role = EXCLUDED.is_system_role;
