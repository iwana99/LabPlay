import "dotenv/config";

import bcrypt
  from "bcryptjs";

import mongoose
  from "mongoose";

import {
  connectDB,
} from "../config/db.js";

import AdminUser
  from "../models/AdminUser.js";


async function main() {
  const email =
    process.env
      .ADMIN_BOOTSTRAP_EMAIL
      ?.trim()
      .toLowerCase();

  const password =
    process.env
      .ADMIN_BOOTSTRAP_PASSWORD;

  if (!email) {
    throw new Error(
      "ADMIN_BOOTSTRAP_EMAIL is required"
    );
  }

  if (
    !password ||
    password.length < 12
  ) {
    throw new Error(
      "ADMIN_BOOTSTRAP_PASSWORD must contain at least 12 characters"
    );
  }

  await connectDB();

  const existing =
    await AdminUser.findOne({
      email,
    });

  if (existing) {
    console.log(
      "Admin already exists:",
      email
    );

    return;
  }

  const passwordHash =
    await bcrypt.hash(
      password,
      12
    );

  const admin =
    await AdminUser.create({
      name:
        "LabPlay Admin",

      email,

      passwordHash,

      role:
        "superadmin",
    });

  console.log(
    "Admin created:",
    admin.email
  );
}


main()
  .catch((error) => {
    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose
      .disconnect();
  });