# Supabase Schema Setup

This document explains how to apply the database schema using Supabase migrations.

## Apply Schema via Migrations

All table definitions, RLS policies, and indexes live in the migration file:

- [supabase/migrations/20260130041017_digital-cabinet.sql](../supabase/migrations/20260130041017_digital-cabinet.sql)

Run the migration with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Storage Bucket (Manual Step)

Create the `profile-pictures` bucket in the Supabase dashboard and add policies:

```sql
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-pictures');
```

## Notes

- All datetime operations use UTC
- The `scheduled_date` field should be set to the first occurrence date
- For daily/weekly/monthly medicines, the dashboard will generate recurring events automatically
- Profile pictures are stored in Supabase Storage for better performance
