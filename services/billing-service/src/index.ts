import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import foliosRouter from "./routes/folios.js";
import invoicesRouter from "./routes/invoices.js";
import { startConsumer } from "./lib/consumer.js";
import { startOutboxDispatcher } from "./lib/outbox.js";

const app = express();
const PORT = process.env.PORT || 3007;

app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "billing-service",
  });
});

// API routes
app.use("/v1/folios", foliosRouter);
app.use("/v1/invoices", invoicesRouter);

// Error handler
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Billing Service running on port ${PORT}`);
  });

  // Consumer del folio + dispatcher de billing.invoice.issued
  // (solo con broker configurado; sin RABBITMQ_URL el servicio opera igual).
  if (process.env.RABBITMQ_URL) {
    startConsumer().catch((err) =>
      console.error("[consumer] no se pudo iniciar", err)
    );
    startOutboxDispatcher();
    console.log("RabbitMQ consumer + outbox dispatcher started");
  }
}

export default app;
