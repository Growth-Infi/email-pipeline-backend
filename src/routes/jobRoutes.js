import express from "express";
import { Router } from "express";
const router = Router();
import jobStore from "../store/jobStore.js";
const { createJob, updateJob, getJob, jobs } = jobStore;
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

export default router;
