import express from "express";

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "WedPlan server is running" });
});

if (!process.env.VERCEL) {
  app.listen(port, (error) => {
    if (error) {
      console.error(`Could not start server on port ${port}: ${error.code}`);
      process.exit(1);
    }
    console.log(`WedPlan server running on http://localhost:${port}`);
  });
}

export default app;
