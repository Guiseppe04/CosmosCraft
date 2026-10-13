-- Database-owned audit history. Apply in a transaction before the new backend.
-- No historical audit rows are changed. Every public application table receives
-- a row trigger; audit_logs itself is excluded to avoid recursion.
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS changes jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS search_text text;

-- Parts receipts previously existed only as audit events. Store business state
-- independently, including the amount of stock that was actually deducted.
CREATE TABLE IF NOT EXISTS public.project_part_receipts (
  receipt_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  part_key text NOT NULL,
  part_name text NOT NULL,
  received_quantity numeric NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
  stock_deducted_quantity numeric NOT NULL DEFAULT 0 CHECK (stock_deducted_quantity >= 0),
  received_at timestamptz,
  received_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  supplier text,
  product_id uuid,
  builder_part_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, part_key)
);

CREATE TABLE IF NOT EXISTS public.project_procurement_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
  requested_by uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  purchase_count integer NOT NULL CHECK (purchase_count > 0),
  requested_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill once, before attaching receipt triggers. ON CONFLICT preserves any
-- receipts already maintained by the new backend when this migration is rerun.
WITH events AS (
  SELECT al.entity_id AS project_id, al.details->>'part_key' AS part_key,
    al.details, al.created_at, al.audit_id
  FROM public.audit_logs al JOIN public.projects p ON p.project_id = al.entity_id
  WHERE al.entity_type = 'project'
    AND al.action IN ('project_part_received', 'project_part_unreceived')
    AND nullif(al.details->>'part_key', '') IS NOT NULL
), totals AS (
  SELECT project_id, part_key,
    greatest(0, sum(CASE WHEN details->>'received_quantity' ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (details->>'received_quantity')::numeric ELSE 0 END)) AS received_quantity,
    greatest(0, sum(CASE WHEN details->>'stock_updated' = 'true'
      AND details->>'received_quantity' ~ '^-?[0-9]+(\.[0-9]+)?$'
      THEN (details->>'received_quantity')::numeric ELSE 0 END)) AS stock_deducted_quantity
  FROM events GROUP BY project_id, part_key
), latest AS (
  SELECT DISTINCT ON (project_id, part_key) * FROM events
  WHERE details->>'received_quantity' ~ '^[0-9]+(\.[0-9]+)?$'
  ORDER BY project_id, part_key, created_at DESC, audit_id DESC
)
INSERT INTO public.project_part_receipts (
  project_id, part_key, part_name, received_quantity, stock_deducted_quantity,
  received_at, received_by, supplier, product_id, builder_part_id
)
SELECT t.project_id, t.part_key, coalesce(l.details->>'part_name', t.part_key),
  t.received_quantity, t.stock_deducted_quantity,
  CASE WHEN t.received_quantity > 0 THEN l.created_at END,
  CASE WHEN t.received_quantity > 0 THEN u.user_id END,
  CASE WHEN t.received_quantity > 0 THEN l.details->>'supplier' END,
  CASE WHEN l.details->>'product_id' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    THEN (l.details->>'product_id')::uuid END,
  CASE WHEN l.details->>'builder_part_id' ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    THEN (l.details->>'builder_part_id')::uuid END
FROM totals t LEFT JOIN latest l USING (project_id, part_key)
LEFT JOIN public.users u ON u.user_id::text = l.details->>'received_by'
ON CONFLICT (project_id, part_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.audit_uuid(value text) RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT CASE WHEN value ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
    THEN value::uuid END
$$;

-- Redaction applies to snapshots, changes and context, including nested JSON.
-- Private refund destinations and file bytes never enter staff-readable logs.
CREATE OR REPLACE FUNCTION public.audit_redact(value jsonb, depth integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE result jsonb; item record; normalized text;
BEGIN
  IF depth > 8 THEN RETURN to_jsonb('[truncated]'::text); END IF;
  IF jsonb_typeof(value) = 'object' THEN
    result := '{}';
    FOR item IN SELECT key, val FROM jsonb_each(value) AS e(key, val) LOOP
      normalized := lower(regexp_replace(item.key, '[^a-zA-Z0-9]', '', 'g'));
      IF normalized ~ '(password|passwd|secret|token|authorization|apikey|accesskey|privatekey|credential|cookie|cardnumber|creditcard|gcashnumber|accountnumber|paymentdestination|filedata|filebytes|imagebase64|proofimage|qrcode|codehash)'
        OR normalized IN ('code','otp','pin','cvv','cvc','jwt','salt','ssn','sessionid')
        OR normalized LIKE '%previewimage%' THEN
        result := result || jsonb_build_object(item.key, '[redacted]');
      ELSE
        result := result || jsonb_build_object(item.key, public.audit_redact(item.val, depth + 1));
      END IF;
    END LOOP;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'array' THEN
    SELECT coalesce(jsonb_agg(public.audit_redact(val, depth + 1) ORDER BY ord), '[]') INTO result
    FROM jsonb_array_elements(value) WITH ORDINALITY AS e(val, ord) WHERE ord <= 50;
    RETURN result;
  ELSIF jsonb_typeof(value) = 'string' THEN
    IF value #>> '{}' ~* '^data:[^;]+;base64,' THEN RETURN to_jsonb('[redacted]'::text); END IF;
    RETURN to_jsonb(left(value #>> '{}', 2000));
  END IF;
  RETURN value;
END
$$;

-- Capture related business references at event time, before they can be renamed
-- or deleted. JSON access allows the same helpers to work across table shapes.
CREATE OR REPLACE FUNCTION public.audit_business_context(source_table text, row_data jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE result jsonb; related jsonb; project_data jsonb; customer_data jsonb;
  v_project_id uuid; v_order_id uuid; v_customer_id uuid; v_product_id uuid;
BEGIN
  result := jsonb_build_object('source_table', source_table);
  v_project_id := public.audit_uuid(row_data->>'project_id');
  v_order_id := public.audit_uuid(row_data->>'order_id');
  v_customer_id := public.audit_uuid(coalesce(row_data->>'customer_id', row_data->>'user_id'));
  v_product_id := public.audit_uuid(row_data->>'product_id');
  IF source_table = 'projects' THEN project_data := row_data;
  ELSIF source_table = 'project_subtasks' THEN
    SELECT to_jsonb(p) INTO project_data FROM public.project_milestones m
      JOIN public.projects p ON p.project_id = m.project_id
      WHERE m.milestone_id = public.audit_uuid(row_data->>'milestone_id');
  ELSIF v_project_id IS NOT NULL THEN
    SELECT to_jsonb(p) INTO project_data FROM public.projects p WHERE p.project_id = v_project_id;
  END IF;
  IF project_data IS NOT NULL THEN
    v_project_id := public.audit_uuid(project_data->>'project_id');
    v_order_id := coalesce(v_order_id, public.audit_uuid(project_data->>'order_id'));
    result := result || jsonb_build_object('project_id', v_project_id,
      'project_number', project_data->>'custom_build_id', 'custom_build_id', project_data->>'custom_build_id',
      'project_title', project_data->>'title');
  END IF;
  IF source_table = 'orders' THEN related := row_data;
  ELSIF v_order_id IS NOT NULL THEN
    SELECT to_jsonb(o) INTO related FROM public.orders o WHERE o.order_id = v_order_id;
  END IF;
  IF related IS NOT NULL THEN
    v_customer_id := coalesce(public.audit_uuid(related->>'user_id'), v_customer_id);
    result := result || jsonb_build_object('order_id', related->>'order_id', 'order_number', related->>'order_number',
      'order_type', related->>'order_type', 'order_total', related->'total_amount',
      'payment_status', related->>'payment_status', 'order_status', related->>'status');
  END IF;
  IF source_table = 'users' THEN customer_data := row_data;
  ELSIF v_customer_id IS NOT NULL THEN
    SELECT to_jsonb(u) INTO customer_data FROM public.users u WHERE u.user_id = v_customer_id;
  END IF;
  IF customer_data IS NOT NULL THEN
    result := result || jsonb_build_object('customer_id', customer_data->>'user_id',
      'customer_name', trim(concat_ws(' ', customer_data->>'first_name', customer_data->>'last_name')),
      'customer_email', customer_data->>'email');
    IF source_table = 'users' THEN
      result := result || jsonb_build_object('full_name', result->>'customer_name',
        'email', customer_data->>'email', 'role', customer_data->>'role');
    END IF;
  END IF;
  IF source_table IN ('products', 'guitar_builder_parts') THEN
    related := row_data;
  ELSIF v_product_id IS NOT NULL THEN
    SELECT to_jsonb(p) INTO related FROM public.products p WHERE p.product_id = v_product_id;
  ELSE related := NULL;
  END IF;
  IF related IS NOT NULL THEN
    result := result || jsonb_build_object('product_id', coalesce(related->>'product_id', related->>'part_id'),
      'product_name', related->>'name', 'sku', related->>'sku', 'price', related->'price',
      'guitar_type', related->>'guitar_type', 'part_type', related->>'part_type');
  END IF;
  IF row_data ? 'refund_request_id' THEN
    result := result || jsonb_build_object('refund_request_id', row_data->>'refund_request_id',
      'refund_number', row_data->>'request_number', 'refund_type', row_data->>'refund_type',
      'refund_amount', coalesce(row_data->'refunded_amount', row_data->'approved_amount', row_data->'amount_requested'));
  END IF;
  IF source_table = 'appointments' THEN
    result := result || jsonb_build_object('appointment_id', row_data->>'appointment_id',
      'reference_code', row_data->>'reference_code', 'appointment_date', row_data->'appointment_date',
      'appointment_time', row_data->'appointment_time', 'appointment_type', row_data->>'appointment_type');
  END IF;
  IF row_data ? 'sale_id' THEN
    IF source_table = 'pos_sales' THEN related := row_data;
    ELSE SELECT to_jsonb(s) INTO related FROM public.pos_sales s WHERE s.sale_id = public.audit_uuid(row_data->>'sale_id');
    END IF;
    result := result || jsonb_build_object('sale_id', row_data->>'sale_id',
      'sale_number', related->>'sale_number', 'total_amount', related->'total_amount');
  END IF;
  IF source_table = 'customizations' THEN
    result := result || jsonb_build_object('build_id', row_data->>'customization_id',
      'build_name', row_data->>'name', 'body_model', row_data->>'body_model',
      'buildId', row_data->>'customization_id', 'buildName', row_data->>'name',
      'customerId', result->>'customer_id', 'customerName', result->>'customer_name');
  END IF;
  RETURN jsonb_strip_nulls(public.audit_redact(result));
END
$$;

CREATE OR REPLACE FUNCTION public.audit_record_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE before_row jsonb := '{}'; after_row jsonb := '{}'; row_data jsonb;
  safe_before jsonb; safe_after jsonb; field_changes jsonb := '{}'; field text;
  context_data jsonb; details_data jsonb; actor_id uuid; actor_data jsonb;
  entity_id uuid; action_name text := TG_OP; previous_status text; new_status text;
  module_name text := TG_ARGV[0]; ip inet; delta numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row := to_jsonb(NEW); END IF;
  row_data := CASE WHEN TG_OP = 'DELETE' THEN before_row ELSE after_row END;
  safe_before := public.audit_redact(before_row);
  safe_after := public.audit_redact(after_row);
  FOR field IN SELECT key FROM jsonb_object_keys(before_row || after_row) AS keys(key) LOOP
    IF field IN ('created_at','updated_at','modified_at','version','row_version') THEN CONTINUE; END IF;
    IF before_row->field IS DISTINCT FROM after_row->field THEN
      field_changes := field_changes || jsonb_build_object(field,
        jsonb_build_object('from', safe_before->field, 'to', safe_after->field));
    END IF;
  END LOOP;
  IF TG_OP = 'UPDATE' AND field_changes = '{}' THEN RETURN NEW; END IF;
  previous_status := coalesce(before_row->>'status', before_row->>'claim_status', before_row->>'payment_status');
  new_status := coalesce(after_row->>'status', after_row->>'claim_status', after_row->>'payment_status');
  IF TG_OP = 'UPDATE' AND NOT (field_changes ? 'status') AND field_changes ? 'payment_status' THEN
    previous_status := before_row->>'payment_status'; new_status := after_row->>'payment_status';
  END IF;
  IF TG_OP = 'UPDATE' AND before_row->>'deleted_at' IS NULL AND after_row->>'deleted_at' IS NOT NULL THEN action_name := 'DELETE'; END IF;
  context_data := public.audit_business_context(TG_TABLE_NAME, row_data)
    || jsonb_build_object('database_operation', TG_OP, 'database_role', session_user,
      'source', coalesce(nullif(current_setting('cosmos.audit_source', true), ''), 'database'),
      'record_id', row_data->>TG_ARGV[1]);
  entity_id := public.audit_uuid(row_data->>TG_ARGV[1]);
  IF module_name = 'project' THEN entity_id := coalesce(public.audit_uuid(context_data->>'project_id'), entity_id); END IF;
  IF module_name = 'order' THEN entity_id := coalesce(public.audit_uuid(context_data->>'order_id'), entity_id); END IF;
  IF module_name = 'refund' THEN entity_id := coalesce(public.audit_uuid(row_data->>'refund_request_id'), entity_id); END IF;
  IF module_name = 'inventory' THEN entity_id := coalesce(public.audit_uuid(row_data->>'product_id'), entity_id); END IF;
  details_data := jsonb_build_object('old', safe_before, 'new', safe_after) || public.audit_redact(row_data);

  IF TG_TABLE_NAME = 'project_subtasks' THEN
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'subtask_created'
      WHEN TG_OP = 'DELETE' OR action_name = 'DELETE' THEN 'subtask_deleted'
      WHEN previous_status IS DISTINCT FROM new_status THEN 'subtask_status_changed' ELSE 'subtask_updated' END;
  ELSIF TG_TABLE_NAME = 'project_milestones' THEN
    action_name := CASE WHEN TG_OP = 'INSERT' THEN 'milestone_created'
      WHEN TG_OP = 'DELETE' OR action_name = 'DELETE' THEN 'milestone_deleted' ELSE 'milestone_updated' END;
  ELSIF TG_TABLE_NAME = 'project_part_receipts' THEN
    delta := coalesce((after_row->>'received_quantity')::numeric, 0) - coalesce((before_row->>'received_quantity')::numeric, 0);
    action_name := CASE WHEN delta < 0 THEN 'project_part_unreceived'
      WHEN delta > 0 THEN 'project_part_received' ELSE 'UPDATE' END;
    details_data := details_data || jsonb_build_object('received_quantity', delta, 'quantity', abs(delta),
      'stock_updated', coalesce((after_row->>'stock_deducted_quantity')::numeric, 0)
        IS DISTINCT FROM coalesce((before_row->>'stock_deducted_quantity')::numeric, 0));
  ELSIF TG_TABLE_NAME = 'project_procurement_requests' THEN action_name := 'procurement_requested';
  ELSIF TG_TABLE_NAME = 'inventory' AND (TG_OP = 'INSERT' OR field_changes ? 'stock') THEN
    action_name := 'STOCK_MOVEMENT';
    context_data := context_data || jsonb_build_object('previous_quantity', before_row->'stock',
      'new_quantity', after_row->'stock', 'quantity_change',
      coalesce((after_row->>'stock')::numeric, 0) - coalesce((before_row->>'stock')::numeric, 0));
    field_changes := field_changes || jsonb_build_object('stock', jsonb_build_object('from', before_row->'stock', 'to', after_row->'stock'));
  ELSIF TG_TABLE_NAME = 'users' THEN
    IF TG_OP = 'INSERT' THEN action_name := 'USER_CREATED';
    ELSIF field_changes ? 'role' THEN action_name := 'USER_ROLE_CHANGED';
    ELSIF field_changes ? 'is_active' THEN
      action_name := CASE WHEN after_row->>'is_active' = 'true' THEN 'USER_ACTIVATED' ELSE 'USER_DEACTIVATED' END;
    ELSIF field_changes ? 'password_hash' THEN action_name := 'PASSWORD_RESET';
    END IF;
  ELSIF TG_TABLE_NAME = 'orders' AND TG_OP = 'UPDATE' AND field_changes ? 'status' THEN
    action_name := CASE new_status WHEN 'shipped' THEN 'ORDER_SHIPPED' WHEN 'out_for_delivery' THEN 'ORDER_OUT_FOR_DELIVERY'
      WHEN 'delivered' THEN 'ORDER_MARKED_DELIVERED' WHEN 'received' THEN 'ORDER_MARKED_RECEIVED'
      WHEN 'cancelled' THEN 'ORDER_CANCELLED' ELSE 'ORDER_STATUS_CHANGED' END;
  ELSIF TG_TABLE_NAME IN ('refund_requests', 'appointment_refunds') AND TG_OP = 'UPDATE' AND field_changes ? 'status' THEN
    action_name := 'refund_' || new_status;
  ELSIF TG_TABLE_NAME = 'payments' AND TG_OP = 'UPDATE' AND field_changes ? 'status' THEN
    action_name := CASE new_status WHEN 'verified' THEN 'VERIFY' WHEN 'rejected' THEN 'REJECT' WHEN 'refunded' THEN 'REFUND' ELSE 'UPDATE' END;
  ELSIF TG_TABLE_NAME = 'appointments' AND TG_OP = 'UPDATE' AND field_changes ? 'status' THEN
    action_name := 'APPOINTMENT_' || upper(new_status);
  ELSIF TG_TABLE_NAME = 'customizations' AND TG_OP = 'INSERT'
    AND after_row->'config_json'->'_walkIn'->>'createdBy' IS NOT NULL THEN
    action_name := 'BUILD_SENT_TO_CUSTOMER';
  END IF;

  actor_id := public.audit_uuid(nullif(current_setting('cosmos.audit_actor_id', true), ''));
  SELECT to_jsonb(u) INTO actor_data FROM public.users u WHERE u.user_id = actor_id;
  IF actor_data IS NULL THEN actor_id := NULL;
  ELSE context_data := context_data || jsonb_build_object('actor_name',
      trim(concat_ws(' ', actor_data->>'first_name', actor_data->>'middle_name', actor_data->>'last_name')),
      'actor_email', actor_data->>'email', 'actor_role', actor_data->>'role');
  END IF;
  BEGIN ip := nullif(current_setting('cosmos.audit_ip', true), '')::inet;
  EXCEPTION WHEN invalid_text_representation THEN ip := NULL; END;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, previous_status, new_status,
    details, context, changes, ip_address, user_agent, search_text)
  VALUES (actor_id, action_name, module_name, entity_id, previous_status, new_status,
    details_data, jsonb_strip_nulls(public.audit_redact(context_data)), field_changes, ip,
    nullif(current_setting('cosmos.audit_user_agent', true), ''),
    public.audit_search_text(action_name, module_name, entity_id, previous_status, new_status,
      context_data, field_changes, details_data));
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE OR REPLACE FUNCTION public.audit_record_truncate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE actor_id uuid; actor_data jsonb; context_data jsonb;
BEGIN
  actor_id := public.audit_uuid(nullif(current_setting('cosmos.audit_actor_id', true), ''));
  SELECT to_jsonb(u) INTO actor_data FROM public.users u WHERE u.user_id = actor_id;
  IF actor_data IS NULL THEN actor_id := NULL; END IF;
  context_data := jsonb_strip_nulls(jsonb_build_object('source_table', TG_TABLE_NAME,
    'database_operation', 'TRUNCATE', 'database_role', session_user,
    'source', coalesce(nullif(current_setting('cosmos.audit_source', true), ''), 'database'),
    'actor_name', CASE WHEN actor_data IS NOT NULL THEN trim(concat_ws(' ', actor_data->>'first_name', actor_data->>'last_name')) END,
    'actor_email', actor_data->>'email', 'actor_role', actor_data->>'role'));
  INSERT INTO public.audit_logs (user_id, action, entity_type, context, details, changes, user_agent)
  VALUES (actor_id, 'TRUNCATE', TG_ARGV[0], context_data,
    jsonb_build_object('description', 'All rows removed from ' || TG_TABLE_NAME), '{}',
    nullif(current_setting('cosmos.audit_user_agent', true), ''));
  RETURN NULL;
END
$$;

-- Database mutation is the sole writer. Old application INSERTs fail instead of
-- silently duplicating history. FK cleanup may only clear a deleted actor ID.
CREATE OR REPLACE FUNCTION public.audit_protect_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' AND pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND pg_trigger_depth() > 1 AND NEW.user_id IS NULL
    AND (to_jsonb(NEW) - 'user_id') = (to_jsonb(OLD) - 'user_id') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Audit history is written only by database triggers and cannot be edited or deleted'
    USING ERRCODE = '42501';
END
$$;

DROP TRIGGER IF EXISTS trg_audit_history_guard ON public.audit_logs;
CREATE TRIGGER trg_audit_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.audit_protect_history();
DROP TRIGGER IF EXISTS trg_audit_history_truncate_guard ON public.audit_logs;
CREATE TRIGGER trg_audit_history_truncate_guard BEFORE TRUNCATE ON public.audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION public.audit_protect_history();

-- Explicit table/module mappings preserve the existing UI's module vocabulary.
-- Record IDs that are integers/text remain in context.record_id (entity_id is UUID).
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('addresses','users','address_id'),
    ('appointment_refunds','refund','refund_request_id'),
    ('appointments','appointments','appointment_id'),
    ('branch_locations','settings','branch_id'),
    ('branch_settings','settings','id'),
    ('builder_guitar_types','guitar_builder_parts','guitar_type_code'),
    ('builder_model_images','guitar_builder_parts','model_image_id'),
    ('builder_part_categories','guitar_builder_parts','part_category_code'),
    ('builder_type_categories','guitar_builder_parts','guitar_type_code'),
    ('cart_items','cart','cart_item_id'),
    ('carts','cart','cart_id'),
    ('categories','products','category_id'),
    ('category_parent_links_backup','products','category_id'),
    ('contact_settings','settings','id'),
    ('current_build_claims','project','claim_id'),
    ('customization_feedback','customizations','feedback_id'),
    ('customization_parts','customizations','part_id'),
    ('customizations','customizations','customization_id'),
    ('default_workflow_steps','project','step_id'),
    ('default_workflow_tasks','project','task_id'),
    ('discount_codes','settings','discount_code_id'),
    ('fulfillment_requests','fulfillment','id'),
    ('guitar_builder_parts','guitar_builder_parts','part_id'),
    ('inventory','inventory','inventory_id'),
    ('inventory_logs','inventory','log_id'),
    ('low_stock_alerts','inventory','alert_id'),
    ('notifications','notifications','notification_id'),
    ('oauth_codes','users','id'),
    ('order_items','order','order_item_id'),
    ('order_number_counters','order','prefix'),
    ('orders','order','order_id'),
    ('otp_attempts','users','attempt_id'),
    ('otp_codes','users','otp_id'),
    ('password_reset_tokens','users','token_id'),
    ('payment_config','settings','config_id'),
    ('payment_settings','settings','id'),
    ('payments','payment','payment_id'),
    ('permissions','rbac','permission_id'),
    ('pos_payments','pos','payment_id'),
    ('pos_returns','pos','return_id'),
    ('pos_sale_items','pos','item_id'),
    ('pos_sales','pos','sale_id'),
    ('product_images','products','image_id'),
    ('product_reviews','products','review_id'),
    ('products','products','product_id'),
    ('project_installment_schedules','payment','schedule_id'),
    ('project_milestones','project','milestone_id'),
    ('project_subtasks','project','subtask_id'),
    ('project_tasks','project','task_id'),
    ('project_team_members','project','project_id'),
    ('project_part_receipts','project','receipt_id'),
    ('project_procurement_requests','project','request_id'),
    ('projects','project','project_id'),
    ('refresh_tokens','users','token_id'),
    ('refund_private_destinations','refund','refund_request_id'),
    ('refund_private_files','refund','refund_request_id'),
    ('refund_request_counters','refund','prefix'),
    ('refund_request_images','refund','refund_request_image_id'),
    ('refund_request_items','refund','refund_request_item_id'),
    ('refund_requests','refund','refund_request_id'),
    ('refund_restock_log','refund','restock_id'),
    ('role_permissions','rbac','role_id'),
    ('roles','rbac','role_id'),
    ('services','services','service_id'),
    ('terms_acknowledgments','users','acknowledgment_id'),
    ('unavailable_dates','appointment_schedule','id'),
    ('user_identities','users','identity_id'),
    ('user_roles','rbac','user_id'),
    ('users','users','user_id')
  ) AS mappings(table_name, module_name, id_column) LOOP
    IF to_regclass(format('public.%I', item.table_name)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS trg_database_audit ON public.%I', item.table_name);
    EXECUTE format('CREATE TRIGGER trg_database_audit AFTER INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.audit_record_change(%L, %L)',
      item.table_name, item.module_name, item.id_column);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_database_audit_truncate ON public.%I', item.table_name);
    EXECUTE format('CREATE TRIGGER trg_database_audit_truncate AFTER TRUNCATE ON public.%I
      FOR EACH STATEMENT EXECUTE FUNCTION public.audit_record_truncate(%L)',
      item.table_name, item.module_name);
  END LOOP;
END
$$;

-- Triggers still execute these functions; callers must not invoke the privileged
-- context lookup directly to inspect private rows outside the audit path.
REVOKE ALL ON FUNCTION public.audit_record_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_record_truncate() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.audit_business_context(text, jsonb) FROM PUBLIC;
