const express = require("express");
const path = require("path");
const asyncHandler = require("express-async-handler");
const Receipt = require("../models/Receipt");

const router = express.Router();

// Serve the Receipts dashboard page
router.get("/receipts", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/receipts.html"));
});

// API endpoint to fetch all receipts with associated task info
router.get(
  "/api/receipts",
  asyncHandler(async (req, res) => {
    const receipts = await Receipt.find().populate("task").exec();
    res.json(receipts);
  })
);

module.exports = router;
