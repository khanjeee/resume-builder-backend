# Resume Builder Backend

This repository contains the backend API for the Resume Builder application.

## Setup Instructions

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/khanjeee/resume-builder-backend.git
    cd resume-builder-backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Environment Variables:**
    Create a `.env` file in the root directory based on `.env.example` and fill in the necessary values.
    ```
    PORT=5001
    NODE_ENV=development
    # Add other environment variables as needed (e.g., database connection string, JWT secret)
    ```
4.  **Run the application:**
    ```bash
    npm start
    # or for development with nodemon:
    # npm run dev
    ```

The API will be running on `http://localhost:5001` (or your specified PORT).
