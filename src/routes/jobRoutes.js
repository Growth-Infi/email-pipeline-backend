import express from "express";
import { Router } from "express";
const router = Router();

import { createJob, updateJob, getJob, allJobs } from "../store/jobStore.js";
import { startVerification } from "../services/brandnavService.js";

router.post("/start-job", async (req, res) => {
  try {
    const { emails } = req.body;
    if (!emails || !emails.length) {
      return res.status(400).json({ error: "Emails required" });
    }
    const job = createJob(emails);
    const response = await startVerification(
      emails,
      `${process.env.BASE_URL}/webhook/brandnav`,
    );

    // 3. store request id
    updateJob(job.id, {
      brandnavRequestId: response.verificationRequestId,
      status: "processing",
    });

    return res.json({
      jobId: job.id,
      brandnavRequestId: response.verificationRequestId,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to start job" });
  }
});

router.get("/job-status/:id", (req, res) => {
  const job = getJob(req.params.id);

  if (!job) return res.status(404).json({ error: "Job not found" });

  return res.json(job);
});

router.post("/webhook/brandnav", (req, res) => {
  try {
    const data = req.body;
    const verificationRequestId = data.verificationRequestId;
    let foundJob = null;
    let allJob = allJobs();
    for (let job of allJob?.values?.() || []) {
      if (job.brandnavRequestId === verificationRequestId) {
        foundJob = true;
        break;
      }
    }
    if (!foundJob) {
      console.log("No job found for webhook");
      return res.sendStatus(200);
    }
    updateJob(foundJob.id, {
      status: "brandnav_completed",
      results: data.results,
    });
    console.log("Webhook received for job:", foundJob.id);
    return res.sendStatus(200);
  } catch (error) {
    console.error(err.message);
    return res.sendStatus(500);
  }
});
export default router;
