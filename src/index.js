import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import jobRoutes from "./routes/jobRoutes.js";
import tasksRoutes from "./routes/meetingTaskRoutes.js"

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api", jobRoutes);
app.use("/api/tasks", tasksRoutes);
app.get("/", (req, res) => {
  res.send("Pipeline backend running");
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
