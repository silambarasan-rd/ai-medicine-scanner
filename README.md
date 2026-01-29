# 💊 MathirAI

> **An intelligent medicine identifier powered by Next.js and Google Gemini / Open AI.**

MathirAI transforms your device into a smart medical assistant. By simply pointing your camera at a medicine box or pill bottle, the application uses multimodal AI to identify the drug, explain its purpose, and provide critical safety warnings.

[![Netlify Status](https://api.netlify.com/api/v1/badges/dd3cc645-e19d-4dca-afe1-d89accaea709/deploy-status)](https://app.netlify.com/projects/mathirai/deploys)
![Tech Stack](https://img.shields.io/badge/Stack-Next.js_16_|_Gemini_AI_|_Open_AI_|_Tailwind-blue)

## 🌟 Key Features

- **🔐 Secure Authentication:** OAuth2 login with Google, GitHub, and Email via Supabase.
- **👁️ AI Vision-to-Text:** Uses Google Gemini 2.5 Flash / GPT 4O Mini to "see" and identify medicines from images, handling blurry text and complex packaging better than traditional OCR.
- **⚡ Auto-Capture:** Smart detection automatically captures the medicine when the camera is steady.
- **🛡️ Safety & Interaction Checks:**
  - 🚗 **Driving Safety:** Instantly warns if the medicine causes drowsiness.
  - 🍷 **Alcohol Warning:** Flags interactions with alcohol.
  - 🕒 **Usage Timing:** Suggests when to take the medication (e.g., "After meals").
- **🔊 Accessibility Mode:** Built-in Text-to-Speech (TTS) to read results aloud for visually impaired users.
- **📱 PWA Ready:** Designed to work seamlessly on mobile browsers.

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Authentication:** [Supabase](https://supabase.com/) (OAuth2)
- **AI Model:** `gemini-2.5-flash` or `gpt-4o-mini`
- **Styling:** Tailwind CSS
- **HTTP Client:** Axios

## 🚀 Getting Started

### Prerequisites
- Node.js 22+ installed.
- A Google Cloud API Key or Open AI API key with access.
- A Supabase account with OAuth2 providers configured.

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/mediscan-ai.git
   cd mediscan-ai

2. **Install dependencies**:
    ```bash
    npm install
    ```
3. **Configure Environment Variables:**

    Create a .env.local file in the root directory:

    ```Env
    # Add Google API Key
    GOOGLE_API_KEY=your_google_api_key_here

    # Add OpenAI Key
    OPENAI_API_KEY=your_openai_api_key_here

    # The Master Switch (options: 'google' or 'openai')
    AI_PROVIDER=openai

    # Supabase Configuration
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
    ```

    **Setting up Supabase:**
    
    1. Create a project at [supabase.com](https://supabase.com)
    2. Go to **Settings** → **API** and copy your project URL and publishable key
    3. Enable authentication providers:
       - Go to **Authentication** → **Providers**
       - Enable Email, Google, and/or GitHub
       - Configure OAuth credentials for each provider
       - Set the redirect URL to: `https://your-domain.com/auth/callback`

4. **Run the development server**:
    ```bash
    npm run dev # without SSL
    npm run dev:ssl # with SSL
    ```

5. **Open locally:**

    Navigate to http://localhost:3000.
    
    **Note on Mobile Testing:** Camera access requires HTTPS. To test on your phone, use `npm run dev -- --experimental-https` or tunnel via [Ngrok](https://www.google.com/url?sa=E&q=https%3A%2F%2Fngrok.com%2F).

## 📱 How It Works

### Authentication Flow
1. **Login:** User visits the app and is redirected to `/login` if not authenticated.
2. **OAuth:** User selects a provider (Google, GitHub, or Email) and authorizes.
3. **Callback:** After authorization, user is redirected back to `/auth/callback`.
4. **Session:** Supabase exchanges the code for a session and redirects to `/dashboard`.
5. **Protected Routes:** Middleware ensures only authenticated users can access `/dashboard`.

### Medicine Scanning
1. **Capture:** The app captures a frame from the video feed (Auto or Manual).
2. **Process:** The image is converted to Base64 and sent to the secure API route.
3. **Analyze:** Google Gemini Vision analyzes the image context, text, and packaging.
4. **Response:** The AI returns a structured JSON containing the name, purpose, and specific safety flags.
5. **Display:** The UI renders the information and reads it aloud if audio mode is on.

## 🛣️ Roadmap

- [x] Vision-based identification
- [x] Safety Badges (Driving/Alcohol)
- [x] Auto-Capture Toggle
- [x] **PWA Ready**: Configure metadata and icons to install on mobile as an application.
- [x] **Secure Authentication**: OAuth2 login with Supabase.
- [ ] **Drug Interaction Checker**: Scan multiple meds to check for conflicts.
- [ ] **Scan History**: Save and view past scans.
- [ ] **React Native Mobile App**: Porting to native iOS/Android.

## ⚠️ Medical Disclaimer

**IMPORTANT:** This application is for **educational and demonstration purposes only**.

- **Do not** rely on this app for medical advice, diagnosis, or treatment.
- The AI may produce inaccurate or incomplete information (hallucinations).
- Always verify medicine details with a certified pharmacist or doctor.
- Always read the official label and leaflet provided with the medicine.

-------------------------------------------------------------------------------
Made with ❤️ using Next.js and Open AI, Google Gemini.