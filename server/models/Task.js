const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema({
  phone: String,
  name: { type: String, default: null },
  text: String,
  mediaPaths: { type: [String], default: [] },
  scheduleDate: String,
  scheduleTime: String,
  recurrence: {
    type: String,
    enum: ["once", "hourly", "daily", "weekly", "monthly", "yearly"],
    default: "once",
  },
  scheduleAt: String,
  createdAt: { type: Date, default: Date.now },
  userEmail: String,
  paused: { type: Boolean, default: false },
});

module.exports = mongoose.model("Task", taskSchema);
