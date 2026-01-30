# Quick Start Guide

## 🚀 Getting Started with New Features

### 1. Database Setup (Required)
Before running the application, you must set up the Supabase database:

1. **Open Supabase SQL Editor**:
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor
   - Create a new query

2. **Copy & Execute SQL**:
   - Open [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md)
   - Copy the table creation SQL
   - Paste into SQL Editor and execute

3. **Set up RLS Policies**:
   - Follow the RLS policy creation steps in SUPABASE_SCHEMA.md
   - These secure your data

4. **Create Storage Bucket**:
   - Go to Storage > Buckets
   - Create new bucket: `profile-pictures`
   - Make it public
   - Create policies as documented

### 2. Install Dependencies
```bash
npm install
```

The required packages are already listed in package.json:
- @fullcalendar/react
- @fullcalendar/daygrid
- @fullcalendar/timegrid
- @fullcalendar/list

### 3. Run Development Server
```bash
npm run dev
```

Navigate to `http://localhost:3000`

### 4. Test the Application

**Login/Register**:
- Go to `/login`
- Create a test account or login

**Test Dashboard**:
- Navigate to Dashboard in navbar
- Add some medicines first to see them on calendar

**Test Add Medicine**:
- Go to Digital Cabinet
- Click "+ Add Medicine"
- Fill form with test data:
  - Name: "Dolo 650"
  - Dosage: "650mg"
  - Date: Today or tomorrow
  - Time: 09:00
  - Frequency: Daily
  - Meal Timing: After
- Click "Add Medicine"

**Test Medicine Scanner**:
- In Add Medicine form, click "📷 Scan"
- Use your camera to scan a medicine package
- AI will identify the medicine
- Confirm to auto-fill form

**Test Profile**:
- Click Profile in navbar dropdown
- Fill in Name, Phone, etc.
- Upload a profile picture
- Click "Save Profile"
- Picture appears in navbar

**Test Calendar Views**:
- In Dashboard, use top right buttons
- Switch between Month, Week, Day, List views
- Click on medicine events for details

**Test Digital Cabinet**:
- Go to Digital Cabinet
- See all your medicines
- Click "Edit" to modify
- Click "Delete" to remove (with confirmation)

## 📁 File Structure

New files created:
```
app/
├── components/
│   ├── Navbar.tsx                    (NEW)
│   └── ScannerModal.tsx              (NEW)
├── add-medicine/
│   └── page.tsx                      (NEW)
├── edit-medicine/
│   └── [id]/
│       └── page.tsx                  (NEW)
├── dashboard/
│   └── page.tsx                      (MODIFIED)
├── digital-cabinet/
│   └── page.tsx                      (NEW)
├── profile/
│   └── page.tsx                      (NEW)
└── layout.tsx                        (MODIFIED - added Navbar)

Root:
├── SUPABASE_SCHEMA.md               (NEW - Database setup)
├── FEATURES_IMPLEMENTATION.md       (NEW - Full documentation)
└── QUICKSTART.md                    (THIS FILE)
```

## 🔧 Common Issues & Solutions

### Issue: "user_profiles table doesn't exist"
**Solution**: Run the SQL from SUPABASE_SCHEMA.md to create tables

### Issue: "Cannot upload profile picture"
**Solution**: Create `profile-pictures` bucket in Supabase Storage

### Issue: "Navbar not showing"
**Solution**: Make sure you're not on the /login page (navbar hides there)

### Issue: "Cannot add medicines"
**Solution**: 
- Check Supabase authentication is working
- Verify `user_medicines` table exists
- Check RLS policies are correct

### Issue: "Camera not working in scanner"
**Solution**:
- Allow camera permissions in browser
- Use HTTPS (required for getUserMedia)
- Check browser console for errors

### Issue: "AI identification fails"
**Solution**:
- Ensure `/api/identify` endpoint is working
- Check image quality and lighting
- Verify Google Gemini Vision API is configured

## 🌐 Environment Variables

Ensure these are set in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_key
NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key (for AI API)
```

## 📱 Responsive Design

All new pages are fully responsive:
- **Mobile** (320px+): Full functionality
- **Tablet** (768px+): Optimized layout
- **Desktop** (1024px+): Full feature display

Test on different devices or use Chrome DevTools device emulation.

## 🎨 Customization

### Colors
Edit Tailwind classes in component files:
- Primary: `bg-blue-600` (change to your color)
- Success: `bg-green-50`
- Error: `bg-red-50`
- Warning: `bg-yellow-50`

### Calendar Appearance
Modify FullCalendar styles in dashboard/page.tsx:
```tsx
<style jsx>{`
  .calendar-container :global(.fc-button-primary) {
    background-color: #YOUR_COLOR;
  }
`}</style>
```

### Form Fields
Customize validation in each page component by modifying handleSubmit

## 📚 Documentation Files

- **SUPABASE_SCHEMA.md**: Database setup with SQL
- **FEATURES_IMPLEMENTATION.md**: Complete feature documentation
- **QUICKSTART.md**: This file

## 🆘 Support

### For Database Issues:
- Check Supabase dashboard for table status
- Verify RLS policies are correctly applied
- Check user authentication status

### For Scanner Issues:
- Test camera permissions in browser settings
- Verify image quality
- Check console for detailed error messages

### For Form Issues:
- Check browser console for validation errors
- Verify all required fields are filled
- Check network tab for API calls

## ✅ Verification Checklist

- [ ] Database tables created
- [ ] RLS policies applied
- [ ] Storage bucket created for profile pictures
- [ ] Application starts without errors
- [ ] Can login/register
- [ ] Can add medicines
- [ ] Scanner works with camera
- [ ] Calendar displays events
- [ ] Profile can be updated with picture
- [ ] Digital cabinet shows medicines
- [ ] Can edit/delete medicines

## 🎯 Next Features to Consider

1. **Medicine Reminders**: Notify users when to take medicine
2. **PDF Export**: Generate medicine schedule printout
3. **Doctor Sharing**: Share medicine list with healthcare providers
4. **Interaction Checker**: Warn about drug interactions
5. **Refill Tracking**: Track when to refill medicines
6. **Backup/Restore**: Cloud backup of medicine data

---

For more details, see [FEATURES_IMPLEMENTATION.md](FEATURES_IMPLEMENTATION.md)
