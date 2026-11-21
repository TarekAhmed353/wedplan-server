import cors from "cors";
import express from "express";
import { connectDB } from "./src/db.js";
import { errorHandler, notFound } from "./src/middleware/error-handlers.js";

const app = express();
const port = process.env.PORT || 8000;
const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

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
