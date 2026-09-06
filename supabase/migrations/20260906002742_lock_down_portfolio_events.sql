create policy "Portfolio events cannot be read directly"
on private.portfolio_events
for select
to anon, authenticated
using (false);

create policy "Portfolio events cannot be inserted directly"
on private.portfolio_events
for insert
to anon, authenticated
with check (false);

create policy "Portfolio events cannot be updated directly"
on private.portfolio_events
for update
to anon, authenticated
using (false)
with check (false);

create policy "Portfolio events cannot be deleted directly"
on private.portfolio_events
for delete
to anon, authenticated
using (false);
