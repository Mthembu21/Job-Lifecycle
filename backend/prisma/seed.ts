import crypto from "crypto";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds only the login accounts — no sample jobs. Safe to re-run; never touches job data and never
 * changes the password of an account that already exists.
 *
 * New accounts get a random password, printed once here. Set your own afterwards with
 * `npm run user:set-password -w backend -- <email>` or "Change password" in the app.
 */
async function main() {
  const usersByRole: Record<Role, { name: string; email: string }> = {
    STOREMAN: { name: "Storeman", email: "storeman@demo.local" },
    PLANNER: { name: "Component Planner", email: "planner@demo.local" },
    SUPERVISOR: { name: "Sam Supervisor", email: "supervisor@demo.local" },
    ADMIN: { name: "Alex Admin", email: "admin@demo.local" },
  };

  for (const [role, info] of Object.entries(usersByRole) as [Role, { name: string; email: string }][]) {
    const existing = await prisma.user.findUnique({ where: { email: info.email }, select: { id: true } });
    if (existing) {
      console.log(`${info.email}: exists, left unchanged`);
      continue;
    }
    const password = crypto.randomBytes(12).toString("base64url");
    await prisma.user.create({
      data: { name: info.name, email: info.email, passwordHash: await bcrypt.hash(password, 12), role },
    });
    console.log(`${info.email}: created — temporary password ${password}`);
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
