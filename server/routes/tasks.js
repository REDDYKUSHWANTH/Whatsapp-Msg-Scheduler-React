const express = require("express");
const asyncHandler = require("express-async-handler");
const schedule = require("node-schedule");
const Task = require("../models/Task");
const { scheduleTask } = require("../utils/scheduler");

const router = express.Router();

// List tasks
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const tasks = await Task.find();
    res.json(tasks);
  })
);

// Delete tasks
router.post(
  "/delete",
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: "ids array is required" });
    }
    await Task.deleteMany({ _id: { $in: ids } });
    const tasks = await Task.find();
    res.json(tasks);
  })
);

// Update/reschedule a task
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { scheduleDate, scheduleTime, recurrence } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    schedule.cancelJob(task._id.toString());
    if (scheduleDate) task.scheduleDate = scheduleDate;
    if (scheduleTime) task.scheduleTime = scheduleTime;
    if (recurrence) task.recurrence = recurrence;
    task.scheduleAt =
      recurrence === "once"
        ? `${task.scheduleDate} ${task.scheduleTime}`
        : task.scheduleTime;
    await task.save();
    scheduleTask(task, req.app.locals.client);
    res.json(task);
  })
);

// Pause a task
router.post(
  "/:id/pause",
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
router.post(
  "/:id/resume",
  asyncHandler(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    task.paused = false;
    await task.save();
    scheduleTask(task, req.app.locals.client);
    res.json(task);
  })
);

module.exports = router;
