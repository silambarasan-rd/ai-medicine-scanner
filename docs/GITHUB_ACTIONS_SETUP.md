# GitHub Actions Setup - Quick Guide

## 3 Simple Steps

### Step 1: Get Your Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project Reference** (e.g., `abcdef123456`)
   - **Service Role Key** (under "SERVICE_ROLE SECRET")

⚠️ **Keep the Service Role Key secret - never share it!**

---

### Step 2: Add GitHub Secrets

1. Go to your **GitHub Repository**
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

**Add Secret #1:**
```
Name: SUPABASE_PROJECT_REF
Value: abcdef123456  (your project reference from step 1)
```

**Add Secret #2:**
```
Name: SUPABASE_SERVICE_ROLE_KEY
Value: eyJhbGciOiJIUzI1NiIs...  (your service role key from step 1)
```

Click **Add secret** for each one.

---

### Step 3: Done! ✅

The workflow file is already created and ready to go.

**The workflow will:**
- Run automatically every minute
- Call your Supabase Edge Function
- Send pending notifications
- Log all details

---

## Testing It

### Immediate Test (No Waiting)

1. Go to **GitHub** → **Actions** tab
2. Click **🔔 Send Medicine Notifications** workflow
3. Click **Run workflow** → **Run workflow**
4. Wait 30 seconds and check the logs

### Verify in Supabase

After testing, run this query in Supabase SQL:

```sql
-- Check if notifications were sent in the last 5 minutes
SELECT COUNT(*) as notifications_sent
FROM notification_queue
WHERE sent_at IS NOT NULL
AND sent_at >= NOW() - INTERVAL '5 minutes';
```

If you see a count > 0 → **It's working!** 🎉

---

## Monitor Ongoing Executions

### GitHub Actions Logs

1. Go to **GitHub** → **Actions**
2. Click on the workflow run
3. View all execution details and logs

### Supabase Database

Check pending notifications:
```sql
SELECT COUNT(*) FROM notification_queue WHERE sent_at IS NULL;
```

Check processed notifications:
```sql
SELECT COUNT(*) FROM notification_queue WHERE sent_at IS NOT NULL;
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Workflow not running | Check that secrets are added correctly |
| HTTP 401 error | Service Role Key is wrong or expired |
| HTTP 404 error | Project reference is wrong or function not deployed |
| No logs in GitHub | Check if workflow is enabled in Actions settings |

### Debug Command

To test the edge function manually:

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-medicine-notifications \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

---

## Next Steps

1. ✅ Add the GitHub secrets (from Step 2)
2. ⏭️ Wait for the workflow to run OR manually trigger it
3. 🎉 Your notifications are now scheduled!

For full setup details, see [PUSH_NOTIFICATIONS_SETUP.md](./PUSH_NOTIFICATIONS_SETUP.md)
