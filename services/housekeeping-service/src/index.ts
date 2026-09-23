import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import tasksRouter from "./routes/tasks.js";
import roomsRouter from "./routes/rooms.js";
import { startConsumer } from "./lib/consumer.js";

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "housekeeping-service",
  });
});

// API routes
app.use("/v1/tasks", tasksRouter);
app.use("/v1/rooms", roomsRouter);

// Error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Housekeeping Service running on port ${PORT}`);
  });

  // Consumidor de checkout.completed -> tarea automática (HK-2).
  // (solo con broker configurado; sin RABBITMQ_URL el servicio opera igual).
  if (process.env.RABBITMQ_URL) {
    startConsumer().catch((err) =>
      console.error("[consumer] no se pudo iniciar", err)
    );
    console.log("RabbitMQ consumer started");
  }
}

export default app;
