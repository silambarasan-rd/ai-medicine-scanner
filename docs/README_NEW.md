# MathirAI - AI Medicine Scanner & Manager

An AI-powered PWA that identifies medicines via camera using Google Gemini Vision with comprehensive medicine management features including scheduling, profile management, and digital medicine cabinet.

## 🎯 Features

### Core Features
- 🔍 **AI Medicine Scanner**: Identify medicines using camera with Google Gemini Vision
- 📅 **Medicine Calendar**: View medicine schedules with Month, Week, Day, and List views
- 💊 **Digital Cabinet**: Manage your medicine collection
- 👤 **User Profile**: Store personal and medical information
- 🚨 **Safety Alerts**: Drive and alcohol safety warnings
- 📱 **Progressive Web App**: Works offline with service worker

### Recent Additions (v2.0)

#### Navigation & Dashboard
- **Navbar**: Top navigation with Dashboard, Digital Cabinet, and Profile menus
- **Dashboard Calendar**: Full-featured calendar showing all medicines:
  - Multiple view modes (Month, Week, Day, List)
  - Color-coded events
  - Automatic event generation based on frequency
  - Event detail modals

#### User Management
- **Profile Page**: Manage user information:
  - Full Name
  - Phone Number
  - Emergency Contact
  - Medical Conditions
  - Profile Picture Upload
- **Profile Picture**: Display in navbar with fallback to user initials

#### Medicine Management
- **Digital Cabinet**: Complete medicine inventory:
  - List all medicines with details
  - Edit functionality
  - Delete with confirmation
  - Quick add button
- **Add Medicine**: Comprehensive form with:
  - Medicine name (with scanner integration)
  - Dosage tracking
  - Frequency options (Daily, Weekly, Monthly, Once, Custom)
  - Time scheduling
  - Meal timing (Before, With, After)
  - Notes/warnings
- **Edit Medicine**: Modify existing medicine details

#### Medicine Scanner Modal
- Full-screen camera interface
- Auto-capture and manual modes
- AI identification with confirmation
- Integrated with Add Medicine form
- Result preview with warnings and safety info

## 🚀 Quick Start

### Prerequisites
- Node.js 16+
- Supabase project
- Google Gemini Vision API key

### Installation

1. **Clone and Install**:
```bash
git clone <repository>
cd ai-medicine-scanner
npm install
```

2. **Set up Database**: See [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md)

3. **Configure Environment**:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_key
NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY=your_api_key
```

4. **Run Development Server**:
```bash
npm run dev
```

5. **Open Browser**:
Navigate to `http://localhost:3000`

## 📖 Documentation

- **[QUICKSTART.md](QUICKSTART.md)**: Quick setup and testing guide
- **[SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md)**: Database setup with SQL
- **[FEATURES_IMPLEMENTATION.md](FEATURES_IMPLEMENTATION.md)**: Complete feature documentation

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: Google Gemini Vision API
- **Calendar**: FullCalendar
- **Auth**: Supabase Auth
- **PWA**: next-pwa

### File Structure
```
app/
├── api/
│   └── identify/              # AI medicine identification
├── auth/
│   └── callback/              # OAuth callback
├── components/
│   ├── Navbar.tsx             # Navigation bar
│   ├── ScannerModal.tsx       # Medicine scanner
│   └── ServiceWorkerRegistrar.tsx
├── add-medicine/
│   └── page.tsx               # Add medicine form
├── dashboard/
│   └── page.tsx               # Calendar dashboard
├── digital-cabinet/
│   └── page.tsx               # Medicine list
├── edit-medicine/
│   └── [id]/page.tsx          # Edit medicine
├── login/
│   └── page.tsx               # Authentication
├── profile/
│   └── page.tsx               # User profile
├── utils/
│   └── supabase/              # Supabase clients
└── layout.tsx                 # Root layout with navbar
```

## 📱 Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Home page |
| `/login` | Authentication |
| `/dashboard` | Calendar with medicine schedule |
| `/profile` | User profile management |
| `/digital-cabinet` | Medicine inventory |
| `/add-medicine` | Add new medicine |
| `/edit-medicine/[id]` | Edit medicine details |
| `/api/identify` | AI medicine identification |

## 🎮 Usage Examples

### Adding a Medicine
1. Navigate to **Digital Cabinet**
2. Click **"+ Add Medicine"**
3. Option A: Type medicine name or click **"📷 Scan"**
   - Point camera at medicine
   - AI identifies automatically
   - Confirm details
4. Set frequency (Daily, Weekly, etc.)
5. Set time and meal timing
6. Click **"Add Medicine"**

### Viewing Schedule
1. Go to **Dashboard**
2. Calendar shows all medicines
3. Click **view buttons** to switch between:
   - Month view
   - Week view
   - Day view
   - List view
4. Click medicine event for details

### Managing Profile
1. Click **Profile** in navbar
2. Edit fields:
   - Name
   - Phone
   - Emergency Contact
   - Medical Conditions
3. Upload profile picture
4. Click **"Save Profile"**

### Managing Medicines
1. Go to **Digital Cabinet**
2. Find medicine in list
3. Click **"✏️ Edit"** to modify
4. Click **"🗑️ Delete"** to remove

## 🔐 Security

- **Row Level Security**: Database policies ensure users only access their data
- **Authentication**: Supabase Auth with session management
- **Profile Pictures**: Secure storage in Supabase bucket
- **Input Validation**: Form validation on all inputs
- **Auto-redirect**: Unauthenticated users redirected to login

## 🎨 Customization

### Change Primary Color
Edit color classes throughout components:
```tsx
// Change from blue-600 to your color
className="bg-blue-600 hover:bg-blue-700"
```

### Modify Calendar Views
Edit FullCalendar config in dashboard:
```tsx
headerToolbar={{
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
}}
```

### Add Custom Medicine Fields
Update `user_medicines` table schema and form components

## 📊 Database Schema

### user_profiles
- User information and preferences
- Profile picture URL
- Medical conditions and emergency contact

### user_medicines
- Medicine name, dosage, timing
- Frequency (daily, weekly, monthly, once, custom)
- Meal timing (before, with, after)
- Notes and warnings

See [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md) for complete SQL.

## 🧪 Testing

### Manual Testing Checklist
- [ ] Create account and login
- [ ] Update profile with all fields
- [ ] Upload profile picture
- [ ] Add medicine with manual form
- [ ] Scan medicine with camera
- [ ] View calendar in different modes
- [ ] Edit medicine details
- [ ] Delete medicine
- [ ] Verify responsive design on mobile

### Camera/Scanner Testing
- Test in good lighting
- Test with clear medicine packaging
- Test manual capture mode
- Test auto-capture toggle
- Verify zoom and focus

## 🚀 Performance

- **Lazy Loading**: Components and images load on demand
- **Code Splitting**: Next.js automatic route-based splitting
- **Caching**: Service worker caches critical assets
- **Optimization**: Image optimization and CSS minification
- **Database**: Indexed queries for fast lookups

## 📋 Responsive Design

Tested and optimized for:
- **Mobile**: 320px+ (phones and small tablets)
- **Tablet**: 768px+ (tablets and landscape)
- **Desktop**: 1024px+ (full feature set)

## ⚠️ Limitations

- AI identification works best with clear medicine labels
- Requires camera permissions for scanner
- Internet required for AI identification
- Medicine frequency patterns auto-generated for 90 days
- Custom patterns require manual descriptions

## 🔄 Updates & Maintenance

### Recent Changes (v2.0)
- Added Navbar with user navigation
- Implemented Dashboard with FullCalendar
- Created Profile management page
- Built Digital Cabinet for medicine inventory
- Added Add/Edit medicine pages
- Integrated Scanner Modal
- All pages responsive and authenticated

### Future Enhancements
- Medicine reminder notifications
- PDF export of schedule
- Doctor sharing functionality
- Drug interaction checker
- Offline sync improvements
- Refill tracking
- Voice notes for medicines

## 🐛 Troubleshooting

### Common Issues

**"Cannot find table user_profiles"**
- Create tables from SUPABASE_SCHEMA.md

**"Camera permission denied"**
- Allow camera in browser settings
- Use HTTPS (required by browsers)

**"Profile picture won't upload"**
- Create `profile-pictures` bucket in Supabase Storage
- Check storage policies

**"Medicines not appearing on calendar"**
- Verify medicines are in database
- Check user_id matches
- Ensure scheduled_date is set

**"Scanner not working"**
- Check browser console for errors
- Ensure camera is available
- Test with good lighting
- Verify API key is valid

See [QUICKSTART.md](QUICKSTART.md) for detailed solutions.

## 📞 Support

For issues:
1. Check browser console for errors
2. Review [QUICKSTART.md](QUICKSTART.md) troubleshooting
3. Verify database setup in [SUPABASE_SCHEMA.md](SUPABASE_SCHEMA.md)
4. Check Supabase dashboard for service status

## 📄 License

MIT - See LICENSE file

## 👤 Author

Silambarasan R <silambu1821944@gmail.com>

---

## Latest Updates

### v2.0 - Medicine Management System
- ✅ Complete navigation system with Navbar
- ✅ Calendar dashboard with multiple views
- ✅ User profile management with picture upload
- ✅ Digital medicine cabinet
- ✅ Add/Edit medicine pages
- ✅ Integrated scanner modal
- ✅ Responsive design
- ✅ Full Supabase integration

**See [FEATURES_IMPLEMENTATION.md](FEATURES_IMPLEMENTATION.md) for complete documentation.**

---

Made with ❤️ for better medicine management
