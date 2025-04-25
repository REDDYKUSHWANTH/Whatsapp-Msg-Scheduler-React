const express = require("express");
const path = require("path");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const router = express.Router();

// Google OAuth
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    res.redirect("/");
  }
);

// Sign up
router.get(
  "/signup",
  asyncHandler(async (req, res) => {
    const count = await User.countDocuments();
    if (count > 0) return res.redirect("/login");
    res.sendFile(path.join(__dirname, "../public/signup.html"));
  })
);
router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).send("Email and password required");
    if (await User.findOne({ email })) return res.redirect("/login");
    const hashed = await bcrypt.hash(password, 10);
    await User.create({ email, password: hashed });
    res.redirect("/");
  })
);

// Login
router.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/login.html"));
});
router.post(
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
    res.redirect("/");
  })
);

// Session logout
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Session destroy error:", err);
    res.redirect("/signup");
  });
});

module.exports = router;
