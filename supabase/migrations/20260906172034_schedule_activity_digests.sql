create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'brilla-activity-digests'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;

  perform cron.schedule(
    'brilla-activity-digests',
    '0 13 * * *',
    $command$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'brilla_project_url'
        ) || '/functions/v1/send-activity-digests',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'brilla_function_anon_key'
          ),
          'apikey', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'brilla_function_anon_key'
          ),
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object('scheduled_at', now()),
        timeout_milliseconds := 15000
      );
    $command$
  );
end
$$;

comment on extension pg_cron is
  'Runs the Brilla activity digest dispatcher every day at 08:00 America/Bogota (13:00 UTC).';
