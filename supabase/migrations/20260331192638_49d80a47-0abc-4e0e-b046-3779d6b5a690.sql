
ALTER TABLE public.ixc_connections ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path = public
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;
