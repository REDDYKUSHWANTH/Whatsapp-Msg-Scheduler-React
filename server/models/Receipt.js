const mongoose = require("mongoose");

const receiptSchema = new mongoose.Schema({
  messageId: { type: String, unique: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  ack: Number,
  timestamp: Date,
});

module.exports = mongoose.model("Receipt", receiptSchema);
