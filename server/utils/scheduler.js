const schedule = require("node-schedule");
const fs = require("fs");
const path = require("path");
const { MessageMedia } = require("whatsapp-web.js");
const Receipt = require("../models/Receipt");
const Task = require("../models/Task");

async function sendScheduled(taskDoc, client) {
  const number = taskDoc.phone.replace(/\D/g, "") + "@c.us";
  try {
    if (taskDoc.mediaPaths && taskDoc.mediaPaths.length) {
      for (let i = 0; i < taskDoc.mediaPaths.length; i++) {
        const mediaFile = MessageMedia.fromFilePath(taskDoc.mediaPaths[i]);
        const opts = {};
        if (i === 0 && taskDoc.text) {
          opts.caption = taskDoc.text;
          opts.sendMediaAsViewOnce = false;
        }
        const msg = await client.sendMessage(number, mediaFile, opts);
        await Receipt.create({
          messageId: msg.id._serialized,
          task: taskDoc._id,
          ack: msg.ack,
          timestamp: new Date(),
        });
      }
    } else {
      const msg = await client.sendMessage(number, taskDoc.text);
      await Receipt.create({
        messageId: msg.id._serialized,
        task: taskDoc._id,
        ack: msg.ack,
        timestamp: new Date(),
      });
    }
  } catch (err) {
    console.error("Scheduled send failed:", err);
  }
}

function scheduleTask(taskDoc, client) {
  const [hour, minute] = taskDoc.scheduleTime
    ? taskDoc.scheduleTime.split(":").map((n) => parseInt(n, 10))
    : [null, null];
  let job;
  switch (taskDoc.recurrence) {
    case "hourly":
      job = schedule.scheduleJob({ minute }, () =>
        sendScheduled(taskDoc, client)
      );
      break;
    case "daily":
      job = schedule.scheduleJob({ hour, minute }, () =>
        sendScheduled(taskDoc, client)
      );
      break;
    case "weekly":
      if (taskDoc.scheduleDate) {
        const dow = new Date(taskDoc.scheduleDate).getDay();
        job = schedule.scheduleJob({ dayOfWeek: dow, hour, minute }, () =>
          sendScheduled(taskDoc, client)
        );
      }
      break;
    case "monthly":
      if (taskDoc.scheduleDate) {
        const day = new Date(taskDoc.scheduleDate).getDate();
        job = schedule.scheduleJob({ date: day, hour, minute }, () =>
          sendScheduled(taskDoc, client)
        );
      }
      break;
    case "yearly":
      if (taskDoc.scheduleDate) {
        const dt = new Date(taskDoc.scheduleDate);
        job = schedule.scheduleJob(
          { month: dt.getMonth(), date: dt.getDate(), hour, minute },
          () => sendScheduled(taskDoc, client)
        );
      }
      break;
    case "once":
      if (taskDoc.scheduleDate && taskDoc.scheduleTime) {
        const dt = new Date(`${taskDoc.scheduleDate}T${taskDoc.scheduleTime}`);
        job = schedule.scheduleJob(dt, async () => {
          await sendScheduled(taskDoc, client);
          await Task.findByIdAndDelete(taskDoc._id);
          taskDoc.mediaPaths.forEach((filePath) => {
            try {
              fs.unlinkSync(filePath);
            } catch {}
          });
        });
      }
      break;
  }
}

module.exports = { sendScheduled, scheduleTask };
