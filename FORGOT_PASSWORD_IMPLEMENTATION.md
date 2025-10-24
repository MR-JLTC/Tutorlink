# Forgot Password Implementation

This document describes the implementation of the forgot password functionality for TutorLink.

## Overview

The forgot password feature allows users to reset their password by:

1. Entering their email address
2. Receiving a 6-digit verification code via email
3. Entering the code and setting a new password

## Backend Implementation

### Database Entity

- **PasswordResetToken**: Stores reset tokens with 15-minute expiry
  - `id`: Primary key
  - `user_id`: Foreign key to User table
  - `changepasscode`: 6-digit verification code
  - `expiry_date`: Token expiration (15 minutes from creation)
  - `is_used`: Boolean flag to prevent reuse
  - `created_at`: Timestamp

### API Endpoints

- `POST /api/auth/password-reset/request`: Request password reset

  - Body: `{ email: string }`
  - Response: `{ message: string }`

- `POST /api/auth/password-reset/verify-and-reset`: Verify code and reset password
  - Body: `{ email: string, code: string, newPassword: string }`
  - Response: `{ message: string }`

### Security Features

- 6-digit verification codes (numeric)
- 15-minute token expiry
- One-time use tokens
- Password hashing with bcrypt
- Email validation

## Frontend Implementation

### Components

1. **ForgotPasswordModal**: Modal for email input
2. **PasswordResetVerification**: Form for code verification and new password
3. **Updated UnifiedLoginPage**: Integrated forgot password link

### User Flow

1. User clicks "Forgot password?" on login page
2. Modal opens asking for email address
3. User enters email and clicks "Send Verification Code"
4. System sends 6-digit code to user's email
5. User is redirected to verification page
6. User enters code and new password
7. Password is reset and user can login

## Email Template

The system sends a professional email with:

- TutorLink branding
- Clear instructions
- 6-digit verification code prominently displayed
- Security warnings about code expiry and one-time use
- Professional styling with gradients and icons

## Testing the Implementation

### Backend Testing

1. Start the backend server: `cd backend && npm run start:dev`
2. Test endpoints using Postman or curl:

   ```bash
   # Request password reset
   curl -X POST http://localhost:3000/api/auth/password-reset/request \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'

   # Verify and reset password
   curl -X POST http://localhost:3000/api/auth/password-reset/verify-and-reset \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","code":"123456","newPassword":"newpass123"}'
   ```

### Frontend Testing

1. Start the frontend: `npm run dev`
2. Navigate to the login page
3. Click "Forgot password?"
4. Enter a valid email address
5. Check email for verification code
6. Enter code and new password
7. Verify login works with new password

## Configuration Requirements

### Environment Variables

- `GMAIL_USER`: Gmail account for sending emails
- `GMAIL_APP_PASSWORD`: Gmail app password for authentication

### Database

- Ensure the `password_reset_tokens` table is created
- The table will be automatically created due to `synchronize: true` in TypeORM config

## Security Considerations

1. **Token Expiry**: Codes expire after 15 minutes
2. **One-time Use**: Each code can only be used once
3. **Rate Limiting**: Consider implementing rate limiting for production
4. **Email Validation**: Only registered users can request password reset
5. **Password Requirements**: Minimum 7 characters (same as registration)

## Error Handling

The system handles various error scenarios:

- Invalid email addresses
- Expired verification codes
- Already used codes
- Email sending failures
- Password validation errors

All errors are displayed to users with clear, actionable messages.

## Future Enhancements

Potential improvements for production:

1. Rate limiting on password reset requests
2. CAPTCHA integration
3. SMS backup verification
4. Password strength requirements
5. Account lockout after multiple failed attempts
6. Audit logging for security events
