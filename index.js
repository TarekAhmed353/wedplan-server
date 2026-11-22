import cors from "cors";
import express from "express";
import { clientUrl } from "./src/config.js";
import { connectDB } from "./src/db.js";
import { errorHandler, notFound } from "./src/middleware/error-handlers.js";
import adminRouter from "./src/routes/admin.js";
import bookingsRouter from "./src/routes/bookings.js";
import meRouter from "./src/routes/me.js";
import servicesRouter from "./src/routes/services.js";
import vendorRouter from "./src/routes/vendor.js";

const app = express();
const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: clientUrl,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "WedPlan server is running" });
});

app.use("/api/me", meRouter);
app.use("/api/admin", adminRouter);
app.use("/api/services", servicesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/vendor", vendorRouter);

app.use(notFound);
app.use(errorHandler);

if (!process.env.VERCEL) {
  try {
    const dbName = await connectDB();
    console.log(`Connected to MongoDB database "${dbName}"`);
  } catch (error) {
    console.error(`Could not connect to MongoDB: ${error.message}`);
    process.exit(1);
  }

  app.listen(port, (error) => {
    if (error) {
      console.error(`Could not start server on port ${port}: ${error.code}`);
      process.exit(1);
    }
    console.log(`WedPlan server running on http://localhost:${port}`);
  });
}

export default app;
