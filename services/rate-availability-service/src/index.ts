import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import availabilityRouter from "./routes/availability.js";
import ratesRouter from "./routes/rates.js";
import rateRulesRouter from "./routes/rate-rules.js";
import blocksRouter from "./routes/blocks.js";

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "rate-availability-service",
  });
});

// API routes
app.use("/v1/availability", availabilityRouter);
app.use("/v1/rates", ratesRouter);
app.use("/v1/rate-rules", rateRulesRouter);
app.use("/v1/blocks", blocksRouter);

// Error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Rate & Availability Service running on port ${PORT}`);
  });
}

export default app;
