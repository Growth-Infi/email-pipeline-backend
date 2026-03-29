import { Router } from "express";
const router = Router();
import jobStore from "../store/jobStore.js";
const { updateJob, jobs } = jobStore;
import { startReoonVerification } from "../services/reoonService.js";
import { pollReoon } from "../utils/reoonPoller.js";

router.post("/brandnav", async (req, res) => {
  try {
    console.log("Webhook route hit");
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
