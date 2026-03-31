import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import jobRoutes from "./routes/jobRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
dotenv.config();

const app = express();

// const corsOptions = {
//   origin: "https://pipeline-tools.vercel.app/",
//   optionsSuccessStatus: 200,
// };
// app.use(cors(corsOptions));
app.use(cors());

app.use(express.json());

const verifyApiKey = (req, res, next) => {
  const APIKey = req.headers["x-api-key"];
  console.log("API Key attached by frontend ", APIKey);

  const serverKey = process.env.BACKEND_SECRET_KEY;
  if (!APIKey || APIKey !== serverKey) {
    return res.status(401).json({ message: "Unauthorized: Invalid API Key" });
  }
  next();
};

app.use("/api/webhook", webhookRoutes); // no auth
app.use("/api", verifyApiKey, jobRoutes); // protected

app.get("/", (req, res) => {
  res.send("Pipeline backend running");
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
