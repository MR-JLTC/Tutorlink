# TutorLink NestJS Backend

This is the backend server for the TutorLink Admin Dashboard, built with NestJS, TypeORM, and MySQL.

## Prerequisites

- Node.js (v16 or later)
- npm
- XAMPP (or any other MySQL server)

## 1. Database Setup

1.  Start your MySQL server (e.g., using the XAMPP Control Panel).
2.  Navigate to your database management tool (e.g., `http://localhost/phpmyadmin`).
3.  Create a new, empty database named `tutorlink`. Use `utf8mb4_general_ci` for the collation if prompted.

The application uses TypeORM's `synchronize: true` feature for development, which will automatically create all the necessary tables in the `tutorlink` database the first time the server starts.

## 2. Installation

1.  Navigate to the `backend` directory in your terminal:
    ```bash
    cd backend
    ```
2.  Install the required npm packages:
    ```bash
    npm install
    ```

## 3. Running the Application

1.  To start the application in development mode (with hot-reloading), run:
    ```bash
    npm run start:dev
    ```
2.  The server will start and listen on `http://localhost:3000`.

## API Endpoints

The API is protected using JWT authentication. You must first register or log in via the `/api/auth/register` or `/api/auth/login` endpoints to receive a token.

- **Authentication**: `POST /api/auth/login`, `POST /api/auth/register`
- **Universities**: `GET, POST, PATCH /api/universities`
- **Users**: `GET /api/users`
- **Tutors**: `GET, PATCH /api/tutors`
- **Courses**: `GET /api/courses`
- **Payments**: `GET /api/payments`
- **Dashboard**: `GET /api/dashboard/stats`
