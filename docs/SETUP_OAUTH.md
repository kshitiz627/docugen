# Setting Up Google OAuth for DocuGen - Complete Guide

This guide will walk you through creating Google OAuth credentials step-by-step. No technical knowledge required!

## 📋 What You'll Need

- A Google account (personal or workspace)
- 5 minutes of time
- A web browser

## 🎯 What We're Doing

We're creating credentials that allow DocuGen to:
- Create Google Docs in your account
- List and search your documents
- Format and update documents

**Important**: You control access - you can revoke it anytime from your Google account settings.

---

## Step 1: Open Google Cloud Console

1. **Open this link in a new tab**: [https://console.cloud.google.com](https://console.cloud.google.com)

2. **Sign in** with your Google account

3. You'll see the Google Cloud Console dashboard

> 💡 **First time?** Google might ask you to accept terms. Just click "Accept and Continue"

---

## Step 2: Create a New Project

### 2.1 Open Project Selector

Look at the top of the page, next to "Google Cloud". You'll see a dropdown that says either:
- "Select a project" 
- Or shows an existing project name

**Click on this dropdown**

### 2.2 Create New Project

1. In the popup window, click **"NEW PROJECT"** button (top right)

2. Fill in:
   - **Project name**: `DocuGen`
   - **Location**: Leave as "No organization" (unless you have a workspace)

3. Click **"CREATE"**

4. Wait about 10-15 seconds for creation

> ✅ **Success indicator**: You'll see a notification saying "Creating project DocuGen"

### 2.3 Select Your New Project

1. Click the project dropdown again
2. Find and click on **"DocuGen"** in the list
3. Make sure "DocuGen" now shows in the top bar

---

## Step 3: Enable Required Google APIs

We need to enable two APIs that let DocuGen work with Google Docs.

### 3.1 Open the API Library

1. Click the **hamburger menu ☰** (top left corner)
2. Find and click **"APIs & Services"**
3. Click **"Library"**

### 3.2 Enable Google Docs API

1. In the search box, type: `Google Docs`
2. Click on **"Google Docs API"** when it appears
3. Click the blue **"ENABLE"** button
4. Wait for it to enable (about 5 seconds)

### 3.3 Enable Google Drive API

1. Click **"← Library"** to go back
2. In the search box, type: `Google Drive`
3. Click on **"Google Drive API"**
4. Click the blue **"ENABLE"** button
5. Wait for it to enable

> ✅ **Check**: Both APIs should now show "API Enabled" with a green checkmark

---

## Step 4: Configure OAuth Consent Screen

Before creating credentials, Google needs some basic info about your app.

### 4.1 Go to OAuth Consent Screen

1. In the left sidebar, click **"OAuth consent screen"**

### 4.2 Choose User Type

You'll see two options:
- **Internal**: Only if you have Google Workspace
- **External**: For personal Google accounts

**Select "External"** (unless you have Workspace, then choose Internal)

Click **"CREATE"**

### 4.3 Fill in App Information

**Required fields only:**

1. **App name**: `DocuGen MCP`
2. **User support email**: Select your email from dropdown
3. **Developer contact information**: Enter your email again

**Skip everything else** - just scroll down

Click **"SAVE AND CONTINUE"**

### 4.4 Scopes (Permissions)

1. Click **"ADD OR REMOVE SCOPES"**
2. In the filter box, search for `docs`
3. Check the box for:
   - `https://www.googleapis.com/auth/documents`
4. Search for `drive`
5. Check the box for:
   - `https://www.googleapis.com/auth/drive`
6. Click **"UPDATE"** at the bottom
7. Click **"SAVE AND CONTINUE"**

### 4.5 Test Users (Optional)

- For personal use: Click **"SAVE AND CONTINUE"** (skip this)
- For testing with others: Add their email addresses

### 4.6 Summary

Review the summary and click **"BACK TO DASHBOARD"**

---

## Step 5: Create OAuth Credentials

Now we create the actual credentials file.

### 5.1 Go to Credentials Page

1. In the left sidebar, click **"Credentials"**

### 5.2 Create OAuth Client ID

1. Click **"+ CREATE CREDENTIALS"** button at the top
2. Select **"OAuth client ID"**

### 5.3 Configure the OAuth Client

1. **Application type**: Select **"Desktop app"**
2. **Name**: `DocuGen Desktop`
3. Click **"CREATE"**

### 5.4 Download Your Credentials

A popup will appear showing your client ID and secret.

1. Click **"DOWNLOAD JSON"** button
2. Save the file somewhere you'll remember (like Downloads folder)
3. **IMPORTANT**: Rename the file to exactly: `credentials.json`

> 📁 **Tip**: Create a folder called `docugen` in your home directory and put the file there

---

## Step 6: Place the Credentials File

### For Windows Users

1. Open File Explorer
2. Navigate to: `C:\Users\YourUsername\`
3. Create a new folder called `docugen`
4. Move `credentials.json` into this folder

**Final path**: `C:\Users\YourUsername\docugen\credentials.json`

### For Mac Users

1. Open Finder
2. Press `Cmd + Shift + G`
3. Type: `~/` and press Enter
4. Create a new folder called `docugen`
5. Move `credentials.json` into this folder

**Final path**: `/Users/YourUsername/docugen/credentials.json`

### For Linux Users

1. Open Terminal
2. Run: `mkdir ~/docugen`
3. Move the file: `mv ~/Downloads/credentials.json ~/docugen/`

**Final path**: `/home/YourUsername/docugen/credentials.json`

---

## ✅ You're Done!

You now have OAuth credentials set up. The path to use in your configuration is:

- **Windows**: `C:\Users\YourUsername\docugen\credentials.json`
- **Mac**: `/Users/YourUsername/docugen/credentials.json`
- **Linux**: `/home/YourUsername/docugen/credentials.json`

Replace `YourUsername` with your actual username.

---

## 🔒 Security Notes

- **Keep credentials.json private** - Don't share this file with anyone
- **Don't commit to git** - It's already in .gitignore
- **You can revoke access anytime** at [Google Account Permissions](https://myaccount.google.com/permissions)

---

## ❓ Troubleshooting

### "Project not found" error
- Make sure you selected the DocuGen project in the dropdown at the top

### Can't find APIs to enable
- Use the search box in the API Library
- Make sure you're in the right project

### "Unauthorized" error later
- Check that both APIs are enabled
- Verify credentials.json is in the right location
- Try downloading credentials.json again

### Need to start over?
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select the DocuGen project
3. Click Settings → Shut down project
4. Start this guide from the beginning

---

## 📺 Video Version

Prefer watching? See our [5-minute video tutorial](https://youtube.com/docugen-oauth-setup)

---

## Next Steps

Now that you have OAuth set up, return to the main README and continue with:
- [Configuring your AI client](../README.md#step-2-configure-your-ai-client)

---

## 🆘 Still Need Help?

- Ask in [GitHub Discussions](https://github.com/eagleisbatman/docugen/discussions)
- Check our [FAQ](./FAQ.md)
- Email: support@docugen.dev