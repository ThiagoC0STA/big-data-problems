-- Run this once in the Supabase SQL Editor

create table if not exists products (
  id text primary key,
  sku text not null,
  name text not null,
  brand text not null default '',
  category text not null,
  subcategory text,
  description text,
  price_cents integer not null,
  currency text not null default 'USD',
  inventory integer not null default 0,
  barcode text,
  image_url text,
  weight_g integer,
  tags jsonb not null default '[]',
  enrichment_status text not null default 'pending',
  validation_status text not null default 'unreviewed',
  validation_issues jsonb not null default '[]',
  review_status text not null default 'unreviewed',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create index if not exists ix_products_sku on products(sku);
create index if not exists ix_products_category on products(category);
create index if not exists ix_products_brand on products(brand);
create index if not exists ix_products_validation_status on products(validation_status);
create index if not exists ix_products_enrichment_status on products(enrichment_status);
create index if not exists ix_products_review_status on products(review_status);
create index if not exists ix_products_price_cents on products(price_cents);
create index if not exists ix_products_updated_at on products(updated_at);

create table if not exists enrichment_jobs (
  id text primary key,
  product_ids jsonb not null default '[]',
  fields jsonb not null default '["description","tags","category"]',
  status text not null default 'queued',
  total integer not null default 0,
  processed integer not null default 0,
  succeeded integer not null default 0,
  failed integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

-- Single-query stats used by /api/stats
create or replace function get_catalog_stats()
returns jsonb language plpgsql as $$
declare result jsonb;
begin
  with
    totals as (
      select
        count(*) as total,
        count(*) filter (where validation_status = 'ok') as vs_ok,
        count(*) filter (where validation_status = 'warning') as vs_warn,
        count(*) filter (where validation_status = 'error') as vs_err,
        count(*) filter (where validation_status = 'unreviewed') as vs_unrev,
        count(*) filter (where review_status = 'unreviewed') as rs_unrev,
        count(*) filter (where review_status = 'approved') as rs_app,
        count(*) filter (where review_status = 'rejected') as rs_rej,
        count(*) filter (where review_status = 'needs_changes') as rs_nc,
        count(*) filter (where inventory >= 5) as inv_healthy,
        count(*) filter (where inventory > 0 and inventory < 5) as inv_low,
        count(*) filter (where inventory = 0) as inv_out
      from products
    ),
    cats as (
      select coalesce(jsonb_agg(jsonb_build_object('category', category, 'count', cnt) order by cnt desc), '[]') as v
      from (select category, count(*) as cnt from products group by category) x
    ),
    brands as (
      select coalesce(jsonb_agg(jsonb_build_object('brand', brand, 'count', cnt) order by cnt desc), '[]') as v
      from (select brand, count(*) as cnt from products where brand != '' group by brand order by cnt desc limit 10) x
    ),
    issues as (
      select coalesce(jsonb_agg(jsonb_build_object('code', code, 'count', n) order by n desc), '[]') as v
      from (
        select issue->>'code' as code, count(*) as n
        from products, jsonb_array_elements(validation_issues) as issue
        group by code
      ) x
    ),
    pbuckets as (
      select jsonb_agg(jsonb_build_object('bucket', bucket, 'count', cnt, 'min', mn, 'max', mx)) as v
      from (
        select b.bucket, count(p.id) as cnt, coalesce(min(p.price_cents), 0) as mn, coalesce(max(p.price_cents), 0) as mx
        from (values
          ('Under $5', 0, 500),
          ('$5-$10', 500, 1000),
          ('$10-$20', 1000, 2000),
          ('$20-$50', 2000, 5000),
          ('$50+', 5000, 1000000000)
        ) as b(bucket, lo, hi)
        left join products p on p.price_cents > 0 and p.price_cents >= b.lo and p.price_cents < b.hi
        group by b.bucket, b.lo
        order by b.lo
      ) x
    )
  select jsonb_build_object(
    'total', t.total,
    'byCategory', c.v,
    'byValidation', jsonb_build_object('ok', t.vs_ok, 'warning', t.vs_warn, 'error', t.vs_err, 'unreviewed', t.vs_unrev),
    'byReview', jsonb_build_object('unreviewed', t.rs_unrev, 'approved', t.rs_app, 'rejected', t.rs_rej, 'needs_changes', t.rs_nc),
    'priceBuckets', pb.v,
    'topBrands', b.v,
    'validationIssueBreakdown', i.v,
    'inventoryHealth', jsonb_build_object('healthy', t.inv_healthy, 'low', t.inv_low, 'out', t.inv_out)
  ) into result
  from totals t, cats c, brands b, issues i, pbuckets pb;

  return result;
end;
$$;

-- Used by /api/lab/reset
create or replace function truncate_products()
returns void language sql as $$
  truncate products;
$$;
