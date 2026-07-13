import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

/** Seeds only the login accounts — no sample jobs. Safe to re-run; never touches job data. */
async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const usersByRole: Record<Role, { name: string; email: string }> = {
    STOREMAN: { name: "Sipho Storeman", email: "storeman@demo.local" },
    PLANNER: { name: "Priya Planner", email: "planner@demo.local" },
    SUPERVISOR: { name: "Sam Supervisor", email: "supervisor@demo.local" },
    ADMIN: { name: "Alex Admin", email: "admin@demo.local" },
  };

  for (const [role, info] of Object.entries(usersByRole) as [Role, { name: string; email: string }][]) {
    await prisma.user.upsert({
      where: { email: info.email },
      update: {},
      create: { name: info.name, email: info.email, passwordHash, role },
    });
  }

  console.log("Seed complete.");
  console.log(`Demo login password for all users: ${DEMO_PASSWORD}`);
  console.log(Object.values(usersByRole).map((u) => u.email).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
