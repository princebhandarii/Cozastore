import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";

// Thin bootstrap: connect to MongoDB, then start listening. Kept separate
// from app.js so the Express app itself can be imported (e.g. by tests)
// without also opening a real database connection.
const start = async () => {
  await connectDB();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on port ${env.port} [${env.nodeEnv}]`);
  });
};

start();
