const express = require("express");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");
const schedule = require("node-schedule");
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const asyncHandler = require("express-async-handler");
const { sendScheduled, scheduleTask } = require("./utils/scheduler");
const User = require("./models/User");
const Task = require("./models/Task");
const Receipt = require("./models/Receipt");

// Route modules
const authRoutes = require("./routes/auth");
const tasksRoutes = require("./routes/tasks");
const sendRoutes = require("./routes/send");
const receiptsRoutes = require("./routes/receipts");

const app = express();
const port = 3001;

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Enable file uploads
app.use(fileUpload());
// Serve static UI files
app.use(express.static("public"));

// Add session management and passport initialization
app.use(
  session({
    secret: process.env.SESSION_SECRET || "secret",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Configure passport for Google OAuth
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      // In a real app, you'd save/find the user in a database here
      return done(null, profile);
    }
  )
);

// Routes for Google authentication
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    res.redirect("/home");
  }
);

// Serve signup page
app.get(
  "/signup",
  asyncHandler(async (req, res) => {
    // If any user exists, send them to login first
    const count = await User.countDocuments();
    if (count > 0) return res.redirect("/login");
    res.sendFile(path.join(__dirname, "public", "signup.html"));
  })
);

// Handle local signup
app.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).send("Email and password required");
    // Check existing user
    if (await User.findOne({ email })) return res.redirect("/login");
    // Create new user
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email, password: hashed });
    res.redirect("/login");
  })
);

// GET login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Handle local login
app.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).send("Email and password required");
    const user = await User.findOne({ email });
    if (!user) return res.redirect("/signup");
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.redirect("/signup");
    req.session.user = { email };
    res.redirect("/home");
  })
);

// Handle user logout (session)
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.redirect("/login");
  });
});

// WhatsApp Client Initialization (no persistent auth to force QR scan each time)
const client = new Client({
  puppeteer: {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

let currentQR = null;
let isReady = false;

// Generate QR Code for Web
client.on("qr", async (qr) => {
  currentQR = await qrcode.toString(qr, { type: "svg" });
  isReady = false;
});

// Ready state
client.on("ready", () => {
  console.log("WhatsApp is ready!");
  currentQR = null;
  isReady = true;
});

client.on("auth_failure", () => {
  console.log("Auth failure. Please scan QR again.");
  currentQR = null;
  isReady = false;
});

client.initialize();

// Expose WhatsApp client to routes
app.locals.client = client;

// Route: Get QR Code SVG
app.get("/qr", (req, res) => {
  if (currentQR) {
    res.json({ svg: currentQR });
  } else if (isReady) {
    res.json({ svg: null, ready: true });
  } else {
    res.status(503).json({ error: "QR not ready" });
  }
});

// Route: Logout and regenerate QR
app.post(
  "/logout",
  asyncHandler(async (req, res) => {
    try {
      await client.logout();
      await client.initialize();
      res.json({ message: "Logged out and regenerating QR" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  })
);

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT, 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper to send notification emails
async function sendEmail(to, subject, text) {
  if (!to) return;
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    });
  } catch (err) {
    console.error("Error sending email:", err);
  }
}

// Ensure uploads directory exists for persistent storage
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Automated pruning: remove media files not referenced by any task every midnight
schedule.scheduleJob({ hour: 0, minute: 0 }, async () => {
  try {
    const files = fs.readdirSync(uploadsDir);
    for (const file of files) {
      const filePath = path.join(uploadsDir, file);
      // If no active task references this file, delete it
      const taskExists = await Task.findOne({ mediaPaths: filePath });
      if (!taskExists) {
        fs.unlinkSync(filePath);
        console.log("🗑 Pruned orphaned media file:", filePath);
      }
    }
  } catch (err) {
    console.error("Error during media pruning:", err);
  }
});

// Listen for delivery/read acknowledgments
client.on("message_ack", async (msg, ack) => {
  try {
    const messageId = msg.id._serialized;
    await Receipt.findOneAndUpdate(
      { messageId },
      { ack, timestamp: new Date() },
      { upsert: true }
    );
  } catch (err) {
    console.error("Error saving receipt:", err);
  }
});

// Serve My Tasks dashboard
app.get("/mytasks", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "mytasks.html"));
});

// Update an existing task (reschedule)
app.patch(
  "/api/tasks/:id",
  asyncHandler(async (req, res) => {
    const { scheduleDate, scheduleTime, recurrence } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    // cancel existing job
    schedule.cancelJob(task._id.toString());
    // update fields
    if (scheduleDate) task.scheduleDate = scheduleDate;
    if (scheduleTime) task.scheduleTime = scheduleTime;
    if (recurrence) task.recurrence = recurrence;
    task.scheduleAt =
      recurrence === "once"
        ? `${task.scheduleDate} ${task.scheduleTime}`
        : task.scheduleTime;
    await task.save();
    scheduleTask(task, client);
    res.json(task);
  })
);

// Pause a task
app.post(
  "/api/tasks/:id/pause",
  asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    schedule.cancelJob(task._id.toString());
    task.paused = true;
    await task.save();
    res.json(task);
  })
);

// Resume a task
app.post(
  "/api/tasks/:id/resume",
  asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    task.paused = false;
    await task.save();
    scheduleTask(task, client);
    res.json(task);
  })
);

// Mount routes
app.use(authRoutes);
app.use("/api/tasks", tasksRoutes);
app.use(sendRoutes);
app.use(receiptsRoutes);

// MongoDB connection and User model
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("✅ Connected to MongoDB");
    // Schedule existing tasks at startup
    try {
      const existing = await Task.find({ paused: false });
      existing.forEach((t) => scheduleTask(t, client));
      console.log(`⏰ Scheduled ${existing.length} existing jobs`);
    } catch (err) {
      console.error("Error scheduling existing tasks:", err);
    }
  })
  .catch((err) => console.error("MongoDB connection error:", err));

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}/signup.jsx`);
});

// Global error-handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message });
  }
});
