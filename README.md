<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/10cZ6fMmCH1DAwYOOVdDemsOACyuZi4tK

## Run Locally

**Prerequisites:** Node.js

1. **Create `tutor_documents` directory (if it doesn't exist) and ensure write permissions:**
   In the root of the `TutorLink_Final` project, create a directory named `tutor_documents`.
   For file uploads to work correctly, ensure that the Node.js process has write permissions to this directory.
   On Windows, you might need to run your terminal/IDE as an administrator or explicitly grant write permissions to the `tutor_documents` folder for your user account.
   Example for Windows (right-click folder -> Properties -> Security -> Edit permissions).
   On Linux/macOS, you can use `chmod 777 tutor_documents` (use with caution as 777 grants full permissions to everyone, consider more restrictive permissions like 755 or specific user/group permissions if deployed to production).
2. Install dependencies:
   `npm install`
3. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
4. Run the app:
   `npm run dev`
