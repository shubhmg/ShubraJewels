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
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  // Comma-separated allowed origins in production (falls back to reflecting any
  // origin only if unset — set this to the real domain(s) in prod).
  corsOrigin: process.env.CORS_ORIGIN || '',

  // Brevo (Sendinblue) SMTP — used for order confirmation emails.
  brevoSmtpHost: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
  brevoSmtpPort: process.env.BREVO_SMTP_PORT || '587',
  brevoSmtpUser: process.env.BREVO_SMTP_USER || '',
  brevoSmtpPass: process.env.BREVO_SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || '',
  emailFromName: process.env.EMAIL_FROM_NAME || 'Shubra Jewels',
};

export default env;
