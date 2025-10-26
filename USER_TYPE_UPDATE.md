# User Type Update Implementation

## Overview
Updated the users table to properly store hashed passwords and user types (tutor/tutee/admin) when submitting applications.

## Changes Made

### 1. User Entity Update (`backend/src/database/entities/user.entity.ts`)
- Added `user_type` field as an enum with values: 'tutor', 'tutee', 'admin'
- Field is nullable to handle existing users

### 2. Service Updates

#### Tutors Service (`backend/src/tutors/tutors.service.ts`)
- Updated `applyTutor()` method to set `user_type: 'tutor'` when creating new users
- Password hashing was already implemented correctly

#### Users Service (`backend/src/users/users.service.ts`)
- Updated `createStudent()` method to set `user_type: 'tutee'` when creating new users
- Updated `createAdmin()` method to set `user_type: 'admin'` when creating new users
- Password hashing was already implemented correctly

### 3. Database Migration
- Since `synchronize: true` is enabled in the database configuration, the new `user_type` field will be automatically added to the database when the backend starts

### 4. Existing User Update Script
- Created `backend/src/scripts/update-user-types.ts` to update existing users with appropriate user types
- Added npm script `update-user-types` to run the update script

## How to Apply Changes

1. **Start the backend** - The database schema will be automatically updated with the new `user_type` field
2. **Update existing users** (optional) - Run the update script to set user types for existing users:
   ```bash
   cd backend
   npm run update-user-types
   ```

## Verification

The following registration flows now properly store:
- **Tutor Registration**: `user_type: 'tutor'` + hashed password
- **Tutee Registration**: `user_type: 'tutee'` + hashed password  
- **Admin Registration**: `user_type: 'admin'` + hashed password

All passwords are hashed using bcrypt with a salt rounds of 10 before being stored in the database.
