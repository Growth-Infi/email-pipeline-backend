import { Router } from "express";
const router = Router();
import { supabase } from "../lib/supabase.js";
import { startVerification } from "../services/brandnavService.js";
import { getReoonResult } from "../services/reoonService.js";

router.post("/start-job", async (req, res) => {
  try {
    const { emails, userId } = req.body;
    if (!emails || !emails.length) {
      return res.status(400).json({ error: "Emails required" });
    }
    const jobId = "job_" + Date.now();

    await supabase
      .from("jobs")
      .insert({ id: jobId, user_id: userId, status: "pending", emails });

    const response = await startVerification(
      emails,
      `${process.env.BASE_URL}/webhook/brandnav`,
    );
    const verificationId = response.data.verification_request_id;
    console.log("Started job and got verification_request_id ", verificationId);

    await supabase
      .from("jobs")
      .update({ brandnav_request_id: verificationId, status: "processing" })
      .eq("id", jobId);

    return res.json({ jobId });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to start job" });
  }
});

router.get("/job-status/:id", async (req, res) => {
  try {
    const { data: job, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !job) {
      return res.status(404).json({ error: "Job not found" });
    }

    if (
      job.status === "reoon_processing" &&
      (!job.last_checked_at ||
        Date.now() - new Date(job.last_checked_at).getTime() > 5000)
    ) {
      await supabase
        .from("jobs")
        .update({
          last_checked_at: new Date(),
        })
        .eq("id", job.id);
      const reoonData = await getReoonResult(job.reoon_task_id);

      if (reoonData.status === "completed") {
        const reoonResults = transformReoonResults(reoonData.results);
        const finalResults = mergeResults(job.results, reoonResults);

        await supabase
          .from("jobs")
          .update({
            status: "completed",
            final_results: finalResults,
          })
          .eq("id", job.id);

        return res.json({
          ...job,
          status: "completed",
          results: finalResults,
        });
      }
    }

    return res.json({
      ...job,
      results: job.final_results || job.results,
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ error: "Failed to fetch job" });
  }
});

export default router;

function transformReoonResults(resultsObj) {
  const arr = [];
  for (const email in resultsObj) {
    const r = resultsObj[email];
    arr.push({
      email,
      status: normalizeStatus(r.status),
      message: r.status,
    });
  }
  console.log("Array formed after transforming response fromm Reoon ", arr);

  return arr;
}
function normalizeStatus(status) {
  if (status === "safe") return "valid";
  if (status === "invalid") return "invalid";
  return "catch_all";
}

function mergeResults(brandnavResults, reoonResults) {
  const map = new Map();
  brandnavResults.forEach((r) => {
    map.set(r.email, r);
  });
  reoonResults.forEach((r) => {
    //overwrite results from reoon
    map.set(r.email, r);
  });

  return Array.from(map.values());
}
