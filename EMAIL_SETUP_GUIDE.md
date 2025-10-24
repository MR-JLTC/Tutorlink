# Email Setup Guide for TutorLink

The forgot password functionality requires Gmail configuration to send verification codes. Follow these steps to set up email sending:

## Step 1: Enable Gmail App Password

1. **Go to your Google Account**: https://myaccount.google.com/
2. **Navigate to Security**: Click on "Security" in the left sidebar
3. **Enable 2-Factor Authentication**: If not already enabled, turn on 2-Step Verification
4. **Generate App Password**:
   - Go to Security > 2-Step Verification > App passwords
   - Select "Mail" as the app
   - Click "Generate"
   - Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

## Step 2: Set Environment Variables

Create a `.env` file in the `backend` directory with the following content:

```env
# Gmail Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password

# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=
DB_DATABASE=tutorlink

# JWT Secret
JWT_SECRET=SECRET_KEY_REPLACE_IN_PROD

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Step 3: Test Email Configuration

Run the test script to verify email configuration:

```bash
cd backend
node test-email.js
```

If successful, you should see:
```
✅ Transporter created successfully
✅ Test email sent successfully!
```

## Step 4: Start the Backend Server

```bash
cd backend
npm run start:dev
```

## Troubleshooting

### Common Issues:

1. **"GMAIL_APP_PASSWORD is not set"**
   - Make sure you created the `.env` file in the `backend` directory
   - Verify the environment variable name is exactly `GMAIL_APP_PASSWORD`

2. **"Invalid login" error**
   - Make sure you're using the App Password, not your regular Gmail password
   - Verify 2-Factor Authentication is enabled on your Google account

3. **"Less secure app access" error**
   - This shouldn't happen with App Passwords, but if it does, make sure you're using the App Password correctly

4. **Email not received**
   - Check spam/junk folder
   - Verify the email address is correct
   - Make sure the Gmail account has sufficient sending limits

### Testing the Forgot Password Flow:

1. Start both frontend and backend servers
2. Go to the login page
3. Click "Forgot password?"
4. Enter a valid email address
5. Check the email for the verification code
6. Enter the code and new password

## Security Notes:

- Never commit the `.env` file to version control
- Use a dedicated Gmail account for production
- Consider using a professional email service (SendGrid, Mailgun) for production
- The App Password should be kept secure and not shared

## Production Considerations:

For production deployment, consider:
- Using environment variables from your hosting platform
- Setting up a dedicated email service
- Implementing rate limiting for password reset requests
- Adding email templates for different languages
