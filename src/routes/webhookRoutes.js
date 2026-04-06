import { Router } from "express";
import supabase from "../lib/supabase.js";
import { startReoonVerification } from "../services/reoonService.js";

const router = Router();

router.post("/brandnav", async (req, res) => {
  try {
    console.log("Webhook route hit");
    const data = req.body;

    console.log("Webhook payload from brandnav:", data);

    const requestId = data.request_id;

    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("brandnav_request_id", requestId)
      .single();
    if (!job) return res.sendStatus(200);

    await supabase
      .from("jobs")
      .update({ status: "brandav_completed", results: data.results })
      .eq("id", job.id);

    console.log("Brandnav completed for job:", job.id);

    const nonValidEmails = data.results
      .filter((r) => r.status !== "valid")
      .map((r) => r.email);

    if (nonValidEmails.length === 0) {
      await supabase
        .from("jobs")
        .update({ status: "completed", final_results: data.results })
        .eq("id", jobId);
      return res.sendStatus(200);
    }

    const reoonResponse = await startReoonVerification(nonValidEmails);
    await supabase
      .from("jobs")
      .update({
        status: "reoon_processing",
        reoon_task_id: reoonResponse.task_id,
      })
      .eq("id", job.id);
    return res.sendStatus(200);
  } catch (err) {
    console.error(err.message);
    return res.sendStatus(500);
  }
});

export default router;
