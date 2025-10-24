# Change Password Implementation

This document describes the implementation of the change password functionality for TutorLink tutors.

## Overview

The change password feature allows authenticated tutors to change their password by:
1. Entering their current password
2. Receiving a 6-digit verification code via email
3. Entering the code and setting a new password
4. Being automatically logged out to re-authenticate with the new password

## Backend Implementation

### Service: ChangePasswordService
- **requestChangePassword**: Verifies current password and sends verification code
- **verifyCodeAndChangePassword**: Verifies code and updates password
- **sendChangePasswordEmail**: Sends professional email with verification code

### API Endpoints
- `POST /api/auth/change-password/request`: Request password change
  - Body: `{ currentPassword: string }`
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ message: string }`

- `POST /api/auth/change-password/verify-and-change`: Verify code and change password
  - Body: `{ code: string, newPassword: string }`
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ message: string }`

### Security Features
- JWT authentication required
- Current password verification
- 6-digit verification codes (numeric)
- 15-minute token expiry
- One-time use tokens
- Password hashing with bcrypt
- Automatic logout after password change

## Frontend Implementation

### Components
1. **ChangePasswordModal**: Modal for current password input
2. **ChangePasswordVerification**: Form for code verification and new password
3. **Updated TutorHeader**: Integrated settings dropdown with change password option

### User Flow
1. Tutor clicks Settings icon in header
2. Selects "Change Password" from dropdown
3. Enters current password and clicks "Send Verification Code"
4. System sends 6-digit code to tutor's email
5. Tutor is redirected to verification page
6. Tutor enters code and new password
7. Password is changed and tutor is logged out
8. Tutor must log in again with new password

## Integration Points

### Tutor Dashboard
- **Location**: Settings dropdown in TutorHeader
- **Access**: Click Settings icon → "Change Password"
- **Authentication**: Requires valid JWT token

### Email Template
The system sends a professional email with:
- TutorLink branding
- Clear instructions for password change
- 6-digit verification code prominently displayed
- Security warnings about code expiry and one-time use
- Professional styling with gradients and icons

## Security Considerations

1. **Authentication Required**: Only authenticated tutors can change passwords
2. **Current Password Verification**: Must provide correct current password
3. **Token Expiry**: Codes expire after 15 minutes
4. **One-time Use**: Each code can only be used once
5. **Automatic Logout**: User is logged out after password change
6. **Password Requirements**: Minimum 7 characters (same as registration)

## Error Handling

The system handles various error scenarios:
- Invalid current password
- Expired verification codes
- Already used codes
- Email sending failures
- Password validation errors
- Authentication failures

All errors are displayed to users with clear, actionable messages.

## Testing the Implementation

### Backend Testing
1. Start the backend server: `cd backend && npm run start:dev`
2. Test endpoints using Postman or curl:
   ```bash
   # Request password change (requires JWT token)
   curl -X POST http://localhost:3000/api/auth/change-password/request \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"currentPassword":"currentpass123"}'
   
   # Verify and change password
   curl -X POST http://localhost:3000/api/auth/change-password/verify-and-change \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -d '{"code":"123456","newPassword":"newpass123"}'
   ```

### Frontend Testing
1. Start the frontend: `npm run dev`
2. Log in as a tutor
3. Click the Settings icon in the header
4. Select "Change Password"
5. Enter current password
6. Check email for verification code
7. Enter code and new password
8. Verify logout and re-login requirement

## Configuration Requirements

### Environment Variables
- `GMAIL_USER`: Gmail account for sending emails
- `GMAIL_APP_PASSWORD`: Gmail app password for authentication

### Database
- Uses existing `password_reset_tokens` table
- No additional database changes required

## Differences from Forgot Password

| Feature | Forgot Password | Change Password |
|---------|----------------|-----------------|
| **Authentication** | Not required | JWT required |
| **Current Password** | Not needed | Must be provided |
| **User State** | Logged out | Logged in |
| **Access Point** | Login page | Tutor dashboard |
| **Post-Action** | Login with new password | Logout and re-login |

## Future Enhancements

Potential improvements for production:
1. Rate limiting on password change requests
2. Password history to prevent reuse
3. Stronger password requirements
4. Account lockout after multiple failed attempts
5. Audit logging for security events
6. Two-factor authentication integration

## API Documentation

### Request Change Password
```typescript
POST /api/auth/change-password/request
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "currentPassword": "string"
}
```

### Verify and Change Password
```typescript
POST /api/auth/change-password/verify-and-change
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "code": "string",
  "newPassword": "string"
}
```

## Troubleshooting

### Common Issues:

1. **"Current password is incorrect"**
   - Verify the current password is correct
   - Check for typos or caps lock

2. **"Invalid or expired verification code"**
   - Check if code is correct (6 digits)
   - Verify code hasn't expired (15 minutes)
   - Ensure code hasn't been used already

3. **"Failed to send verification code"**
   - Check email configuration
   - Verify Gmail App Password is set
   - Check email address is correct

4. **Authentication errors**
   - Ensure user is logged in
   - Check JWT token is valid
   - Try logging out and back in

The change password functionality is now fully implemented and ready for use by tutors in the TutorLink platform!
