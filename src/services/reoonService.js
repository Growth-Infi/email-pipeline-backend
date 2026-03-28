import axios from "axios";

const REOON_API_KEY = process.env.REOON_API_KEY;

export async function startReoonVerification(emails) {
  const taskName = "pipelineTask" + Date.now();
  const res = await axios.post(
    "https://emailverifier.reoon.com/api/v1/create-bulk-verification-task/",
    {
      name: taskName,
      emails,
      key: REOON_API_KEY,
    },
  );
  console.log("Got response from reoon initial ", res.data);

  if (res.status !== 201 || res.data.status !== "success") {
    throw new Error("Failed to create Reoon task");
  }

  return res.data;
}
export async function getReoonResult(taskId) {
  const res = await axios.get(
    `https://emailverifier.reoon.com/api/v1/get-result-bulk-verification-task/`,
    {
      params: {
        key: REOON_API_KEY,
        task_id: taskId,
      },
    },
  );
  console.log("Response for Results status from Reoon ", res.data);

  return res.data;
}
