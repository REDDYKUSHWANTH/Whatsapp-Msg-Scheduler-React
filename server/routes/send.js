const express = require("express");
const asyncHandler = require("express-async-handler");
const fs = require("fs");
const path = require("path");
const { MessageMedia } = require("whatsapp-web.js");
const Task = require("../models/Task");
const { scheduleTask } = require("../utils/scheduler");

const router = express.Router();

router.post(
  "/send",
  asyncHandler(async (req, res) => {
    // Persist attachments
    let mediaPaths = [];
    if (req.files && req.files.media) {
      const files = Array.isArray(req.files.media)
        ? req.files.media
        : [req.files.media];
      for (const file of files) {
        const filename = `${Date.now()}_${file.name}`;
        const filePath = path.join(__dirname, "../uploads", filename);
        await file.mv(filePath);
        mediaPaths.push(filePath);
      }
    }

    const { phone, name, text, scheduleDate, scheduleTime, recurrence } =
      req.body;
    const number = phone.replace(/\D/g, "") + "@c.us";
    const creatorEmail = req.session.user?.email;

    if (!phone || !text) {
      return res.status(400).json({ error: "phone and text are required" });
    }

    // Parse time
    let hour, minute;
    if (scheduleTime) {
      const parts = scheduleTime.split(":");
      hour = parseInt(parts[0], 10);
      minute = parseInt(parts[1], 10);
      if (isNaN(hour) || isNaN(minute)) {
        return res.status(400).json({ error: "Invalid scheduleTime format" });
      }
    }

    // Immediate send helper
    const sendMessage = async () => {
      const client = req.app.locals.client;
      if (mediaPaths.length) {
        for (let i = 0; i < mediaPaths.length; i++) {
          const mediaFile = MessageMedia.fromFilePath(mediaPaths[i]);
          const opts = {};
          if (i === 0 && text) {
            opts.caption = text;
            opts.sendMediaAsViewOnce = false;
          }
          await client.sendMessage(number, mediaFile, opts);
          fs.unlinkSync(mediaPaths[i]);
        }
      } else {
        await req.app.locals.client.sendMessage(number, text);
      }
      res.json({ status: "sent", id: Date.now() });
    };

    // Scheduling logic
    if (recurrence === "daily") {
      const task = await Task.create({
        phone: number,
        name,
        text,
        mediaPaths,
        scheduleDate,
        scheduleTime,
        recurrence,
        scheduleAt: scheduleTime,
        userEmail: creatorEmail,
      });
      scheduleTask(task, req.app.locals.client);
      return res.json({ status: "scheduled", recurrence });
    }
    if (recurrence === "weekly") {
      const task = await Task.create({
        phone: number,
        name,
        text,
        mediaPaths,
        scheduleDate,
        scheduleTime,
        recurrence,
        scheduleAt: scheduleTime,
        userEmail: creatorEmail,
      });
      scheduleTask(task, req.app.locals.client);
      return res.json({ status: "scheduled", recurrence });
    }
    if (recurrence === "yearly") {
      const task = await Task.create({
        phone: number,
        name,
        text,
        mediaPaths,
        scheduleDate,
        scheduleTime,
        recurrence,
        scheduleAt: `${scheduleDate} ${scheduleTime}`,
        userEmail: creatorEmail,
      });
      scheduleTask(task, req.app.locals.client);
      return res.json({ status: "scheduled", recurrence });
    }
    if (scheduleDate && scheduleTime) {
      const task = await Task.create({
        phone: number,
        name,
        text,
        mediaPaths,
        scheduleDate,
        scheduleTime,
        recurrence: "once",
        scheduleAt: `${scheduleDate} ${scheduleTime}`,
        userEmail: creatorEmail,
      });
      scheduleTask(task, req.app.locals.client);
      return res.json({ status: "scheduled", scheduleDate, scheduleTime });
    }

    // Immediate send if no schedule
    await sendMessage();
  })
);

module.exports = router;
