# Cron-job.org Setup for Medicine Notifications

## Why cron-job.org instead of GitHub Actions?

- ✅ **Reliable**: Runs exactly every minute
- ✅ **No delays**: Unlike GitHub Actions (5-15 min delays)
- ✅ **Free**: Up to 2 cron jobs on free plan
- ✅ **Easy monitoring**: Web dashboard to see execution logs

## Setup Steps

### 1. Sign Up for cron-job.org

Go to: https://cron-job.org/en/signup/

- Create free account
- Verify email

### 2. Create New Cron Job

1. After login, click **"Create cronjob"**

2. Fill in details:
   - **Title**: `Medicine Notifications`
   - **URL**: `https://nzdjcjkrcjgihyfdlsus.supabase.co/functions/v1/send-medicine-notifications`
   - **Schedule**: 
     - Pattern: `* * * * *` (every minute)
     - Or use: `*/2 * * * *` (every 2 minutes for less load)
   - **Request method**: `POST`
   - **Request timeout**: `30 seconds`

3. **Add Headers** (click "Advanced" or "Headers"):
   ```
   Authorization: Bearer YOUR_SUPABASE_SERVICE_ROLE_KEY
   Content-Type: application/json
   ```

   Replace `YOUR_SUPABASE_SERVICE_ROLE_KEY` with your actual service role key from:
   Supabase Dashboard → Project Settings → API → service_role key (secret)

4. Click **"Create cronjob"**

### 3. Verify It's Working

1. Wait 1-2 minutes
2. Check **"Execution history"** on cron-job.org dashboard
3. Should see HTTP 200 responses
4. Check Supabase logs: `supabase functions logs send-medicine-notifications`

### 4. Monitor

- **Dashboard**: See all executions, failures, response times
- **Email alerts**: Configure notifications for failures (optional)
- **Pause/Resume**: Easy toggle if needed

## Troubleshooting

**502/503 errors?**
- Edge function might be cold-starting
- Increase timeout to 60 seconds

**401 Unauthorized?**
- Check Authorization header is correct
- Verify service role key

**No notifications sent?**
- Check if medicines are scheduled in future (considering timezone)
- Verify push subscriptions exist in database
- Check edge function logs

## Alternative: EasyCron

If you prefer, use **EasyCron** instead:
- https://www.easycron.com/
- Free tier: 1 cron job, runs every minute
- Similar setup process

## Disable GitHub Actions Workflow

Once cron-job.org is working, you can disable the GitHub Actions workflow:

1. Go to GitHub repo → `.github/workflows/medicine-notifications.yml`
2. Comment out or delete the file
3. Or add at top: `# disabled - using cron-job.org instead`
