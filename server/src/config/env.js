import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
}

const env = {
  host: process.env.HOST || '0.0.0.0',
  port: parseInt(process.env.PORT, 10) || 4200,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI,
  publicUrl: process.env.PUBLIC_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@shubrajewels.in',
    password: process.env.ADMIN_PASSWORD || 'shubra@admin',
  },
};

export default env;
