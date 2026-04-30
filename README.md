# 📧 Gmail BCC Sender, Chrome Extension

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg) ![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-yellow.svg)

A Chrome extension to send one email to all your Gmail inbox senders at once via BCC. No one sees each other's address.

---

## 💡 Why I Built This

One day I opened my inbox and had **180 unread emails** that all needed the same reply. I wanted to send one message to everyone at once, but without them seeing each other's addresses. Gmail has no built-in way to do this. Copy-pasting 180 email addresses into BCC manually wasn't an option.

So I built this extension. One click fetches everyone from your inbox automatically, one message goes to all of them, privately.

---

## ✅ What It Does

- Scans your Gmail inbox and extracts all unique sender addresses automatically
- Shows a searchable, checkable list of everyone who emailed you
- Sends your message to all selected people via BCC (they can't see each other)
- Works entirely in your browser, no server, no Python, no terminal

---

## 🔑 Step 1, Get Google OAuth Credentials (~5 minutes)

1. Go to → **https://console.cloud.google.com/**
2. Click **Select a project → New Project** → give it any name → **Create**
3. Left menu → **APIs & Services → Library** → search **"Gmail API"** → **Enable**
4. Left menu → **APIs & Services → OAuth consent screen**
   - Choose **External** → **Create**
   - Fill in App name (e.g. "BCC Sender") and your email → **Save and Continue** through all steps
   - ⚠️ **Do NOT skip adding a Test User**, see Step 4 below
5. Left menu → **APIs & Services → Credentials**
   - Click **+ Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: anything
   - Under **Authorised redirect URIs**, you'll add the URL shown in the extension (Step 3 below)
   - Click **Create** → copy the **Client ID**

---

## 🧩 Step 2, Load the Extension in Chrome

1. Open Chrome and go to → `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select this folder (`gmail-bcc-extension/`)
5. The extension icon will appear in your toolbar

---

## 🔗 Step 3, Add Redirect URI to Google

1. Click the extension icon in Chrome toolbar → the popup opens
2. You'll see a **yellow URL** like `https://xxxx.chromiumapp.org/`, click **Copy**
3. Go back to **Google Cloud Console → Credentials → your OAuth client**
4. Click the pencil (edit) icon → under **Authorised redirect URIs** → **Add URI** → paste it → **Save**

---

## 👤 Step 4, Add Yourself as a Test User

> ⚠️ This step is required, without it you will get `Error 403: access_denied` even with your own app.

Google's console was recently redesigned. The Test Users section has **moved**:

1. Go to → **https://console.cloud.google.com/**
2. In the left menu find **Google Auth Platform** (previously called "OAuth consent screen")
3. Click **Audience** in the submenu
4. Scroll down to **"Test users"**
5. Click **"+ Add users"**
6. Enter your Gmail address → click **Add** → click **Save**

The left menu structure looks like this:
```
Google Auth Platform
├── OAuth Overview
├── Clients
├── Audience          ← Test Users are here
├── Branding
└── Data Access
```

Or go directly to: **https://console.cloud.google.com/auth/audience**

---

## 🚀 Step 5, Connect & Use

1. Click the extension icon
2. Paste your **Client ID** into the field
3. Click **Connect Gmail** → log in with your Google account → Allow
4. Click **Fetch Senders from Inbox**, it scans your inbox automatically
5. Search, select/deselect who you want to email
6. Write your **Subject** and **Message**
7. Click **Send BCC to Selected**, done ✅

---

## 🔒 Privacy & Security

- Your credentials are stored locally in Chrome's extension storage only
- Nothing is sent to any external server
- The extension only reads From headers (not email bodies) and sends mail
- Token data never leaves your browser

---

## ❓ Troubleshooting, Real Issues & Fixes

These are issues encountered during real setup, with exact fixes.

### `Error 403: access_denied`, "app has not completed Google verification"
Your Gmail is not added as a Test User. Go to **Google Auth Platform → Audience → Test users → Add users** and add your Gmail. See Step 4 above, the UI was recently redesigned and the old "OAuth consent screen" path no longer shows this section in the same place.

### `Error 400: policy_enforced`, "not approved by Advanced Protection"
Your Google account has **Advanced Protection** enabled (a high-security mode that blocks all third-party OAuth apps). Two options:
- **Option A (recommended):** Use a different regular Gmail account as your test account
- **Option B:** Unenroll from Advanced Protection at `myaccount.google.com/advanced-protection/enrolled`

### `redirect_uri_mismatch` error
The yellow URL shown in the extension popup was not added to Google Cloud Console. Go to **Credentials → your OAuth client (pencil icon) → Authorised redirect URIs**, paste it exactly, then Save.

### Copy button not working / Connect Gmail does nothing
This is caused by Chrome Manifest V3 blocking inline `onclick=` handlers in HTML. Make sure you're using the latest version of this extension (v3+).

### "Test users" section not visible in Google Cloud Console
Google recently renamed and reorganised the OAuth section. It is now under **Google Auth Platform → Audience**, not under **APIs & Services → OAuth consent screen**. Go directly to: `https://console.cloud.google.com/auth/audience`

### Extension not showing in toolbar
Click the puzzle piece 🧩 icon in Chrome's toolbar → find Gmail BCC Sender → click the pin icon.

### Senders list is empty after fetching
Make sure the Gmail API is enabled: **APIs & Services → Library → Gmail API → Enable**.

---

## 📁 File Structure

```
gmail-bcc-extension/
├── manifest.json      # Extension configuration (Manifest V3)
├── popup.html         # UI layout and styles
├── popup.js           # All logic (OAuth, Gmail API, send)
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

---

## 🐙 How to Put This on GitHub

### 1. Create the Repo

1. Go to → **https://github.com/new**
2. Repository name: `gmail-bcc-extension`
3. Set to **Private** (recommended)
4. Click **Create repository**

### 2. Push from Terminal

Make sure [Git is installed](https://git-scm.com/downloads), then:

```bash
# Go into the folder
cd path/to/gmail-bcc-extension

# Initialise git
git init

# Stage all files
git add .

# First commit
git commit -m "Initial commit: Gmail BCC Chrome Extension"

# Connect to GitHub (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/gmail-bcc-extension.git

# Push
git branch -M main
git push -u origin main
```

> ⚠️ GitHub no longer accepts your account password when pushing. Use a **Personal Access Token** instead, create one at `github.com/settings/tokens` with the `repo` scope checked.

### 3. Future Updates

```bash
git add .
git commit -m "Describe your change"
git push
```

---

## 🛑 Never Upload

Your OAuth Client ID is entered at runtime in the extension and stored in Chrome only, it is **not** in any project file and will never be pushed to GitHub.
