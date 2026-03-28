import express from "express";
import { Router } from "express";
const router = Router();
import jobStore from "../store/jobStore.js";
const { createJob, updateJob, getJob, jobs } = jobStore;
import { startVerification } from "../services/brandnavService.js";
import { startReoonVerification } from "../services/reoonService.js";
import { pollReoon } from "../utils/reoonPoller.js";

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
    const verificationId = response.data.verification_request_id;
    console.log("Started job and got verification_request_id ", verificationId);

    // 3. store request id
    updateJob(job.id, {
      brandnavRequestId: verificationId,
      status: "processing",
    });

    return res.json({
      jobId: job.id,
      brandnavRequestId: verificationId,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to start job" });
  }
});

router.get("/job-status/:id", (req, res) => {
  const job = getJob(req.params.id);

  if (!job) return res.status(404).json({ error: "Job not found" });

  return res.json({ ...job, results: job.finalResults || job.results });
});

router.post("/webhook/brandnav", async (req, res) => {
  try {
    const data = req.body;

    console.log("Webhook payload from brandnav:", data);

    const requestId = data.request_id;

    let foundJob = null;

    for (let job of jobs.values()) {
      if (job.brandnavRequestId === requestId) {
        foundJob = job;
        break;
      }
    }

    if (!foundJob) {
      console.log("No job found for webhook, request_id:", requestId);
      return res.sendStatus(200);
    }

    updateJob(foundJob.id, {
      status: "brandnav_completed",
      results: data.results,
    });
    console.log("Brandnav completed for job:", foundJob.id);

    const nonValidEmails = data.results
      .filter((r) => r.status !== "valid")
      .map((r) => r.email);

    if (nonValidEmails.length === 0) {
      updateJob(foundJob.id, {
        status: "completed",
        finalResults: data.results,
      });
      return res.sendStatus(200);
    }

    const reoonResponse = await startReoonVerification(nonValidEmails);

    updateJob(foundJob.id, {
      status: "reoon_processing",
      reoonTaskId: reoonResponse.task_id,
    });

    console.log("Reoon started:", reoonResponse.task_id);

    pollReoon(foundJob.id, reoonResponse.task_id);
    return res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    return res.sendStatus(500);
  }
});
export default router;
