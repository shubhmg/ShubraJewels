import mongoose from 'mongoose';
import env from './config/env.js';
import { connectDB } from './config/db.js';
import app from './app.js';

async function start() {
  await connectDB();
  const server = app.listen(env.port, env.host, () => {
    console.log(`Shubra API running on http://${env.host}:${env.port} [${env.nodeEnv}]`);
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(async () => {
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
