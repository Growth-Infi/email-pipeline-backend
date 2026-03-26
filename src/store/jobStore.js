const jobs = new Map();

function createJob(emails) {
  const job_id = "job_" + Date.now();
  jobs.set(jobId, {
    id: jobId,
    status: "pending",
    emails,
    brandnavRequestId: null,
    results: null,
    createdAt: new Date(),
  });

  return jobs.get(jobId);
}
function updateJob(jobId, data) {
  const job = jobs.get(jobId);
  if (!job) return null;
  Object.assign(job, data);
  return job;
}
function getJob(jobId) {
  return jobs.get(jobId);
}

export default {
  createJob,
  updateJob,
  getJob,
  jobs,
};
