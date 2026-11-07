import "dotenv/config";

process.env.JWT_SECRET =
  process.env.JWT_SECRET || "super-secret-marketplace-jwt-key-min-32-chars-long";
process.env.NEXT_PUBLIC_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
