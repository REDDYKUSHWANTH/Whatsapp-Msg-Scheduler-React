# WhatsApp Message Scheduler (React)

A React-based web application for scheduling and sending WhatsApp messages (with optional media attachments) via a backend API. Users authenticate by scanning a QR code and can then compose messages, schedule them for later, and view sent receipts and tasks.

## Features

- QR code authentication with WhatsApp session
- Send plain text messages or include media (images, audio, video, PDF)
- Schedule messages at a future date/time, with recurrence options (hourly, daily, etc.)
- View scheduled tasks dashboard
- View sent message receipts
- User login and signup flow

## Prerequisites

- **Node.js** (>= 14)
- **npm** or **yarn**

## Project Structure

```plaintext
Whatsapp Msg Scheduler React/
├── client/                # React front-end
│   ├── public/            # Static files and index.html
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-based pages (Home, Login, Signup, MyTasks, Receipts)
│       ├── App.js         # Main router setup
│       └── index.js       # React entry point
├── server/                # (Optional) Backend API for QR, send, logout, receipts, etc.
└── README.md              # This file
```

> Note: If there's no `server/` folder, the client expects an external API at the same origin (`/qr`, `/send`, etc.)

## Installation

1. **Clone the repo**

   ```bash
   git clone <repository-url>
   cd "Whatsapp Msg Scheduler React"
   ```

2. **Install dependencies**

   - Front-end:

     ```bash
     cd client
     npm install
     ```

   - Back-end (if included):
     ```bash
     cd ../server
     npm install
     ```

3. **Environment Variables**

   Create a `.env` file in the `server/` directory (if applicable) with the following keys:

   ```ini
   PORT=5000
   WHATSAPP_API_URL=<your-whatsapp-api-endpoint>
   SESSION_SECRET=<your-session-secret>
   ```

## Available Scripts (Front-end)

In the `client/` directory, run:

- `npm start` &mdash; Runs the app in development mode at `http://localhost:3000`
- `npm test` &mdash; Launches the test runner
- `npm run build` &mdash; Builds the app for production to `client/build`
- `npm run lint` &mdash; Runs linter checks (if configured)

## Running the App Locally

1. Start the backend API (if present):
   ```bash
   cd server
   npm start
   ```
2. Start the React front-end:
   ```bash
   cd client
   npm start
   ```
3. Open `http://localhost:3000` in your browser.
4. Sign up or log in, scan the displayed QR code with WhatsApp, and begin scheduling messages.

## Usage

1. **Sign Up / Login** &mdash; Create an account or log in.
2. **Scan QR Code** &mdash; Authenticate your WhatsApp session.
3. **Compose Message** &mdash; Enter a phone number, optional recipient name, message text, and attachments.
4. **Schedule** &mdash; Set a date/time and optional recurrence.
5. **Send / Schedule** &mdash; Click **Send**. View status messages in the UI.
6. **My Tasks** &mdash; Manage scheduled messages.
7. **Receipts** &mdash; View history of sent messages.

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests with improvements.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
