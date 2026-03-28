import { getReoonResult } from "../services/reoonService";
import jobStore from "../store/jobStore.js";

const { updateJob, getJob } = jobStore;

export function pollReoon(jobId, taskId) {
  const interval = setInterval(async () => {
    try {
      const data = await getReoonResult(taskId);

      console.log("Reoon status:", data.status);
      if (data.status === "completed") {
        clearInterval(interval);

        const job = getJob(jobId);

        const reoonResults = transformReoonResults(data.results);

        const finalResults = mergeResults(job.results, reoonResults);

        updateJob(jobId, {
          status: "completed",
          finalResults,
        });

        console.log("Reoon completed for job:", jobId);
      }
    } catch (err) {
      console.error("Reoon polling error:", err.message);
    }
  }, 5000);
}

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
