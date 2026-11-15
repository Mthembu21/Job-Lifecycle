/*
 * One-off clean-up: puts every job on an agreed customer name and fills the customer list.
 *
 *   npx ts-node --transpile-only scripts/normalize-customers.ts            → dry run: prints the plan
 *   npx ts-node --transpile-only scripts/normalize-customers.ts --apply    → makes the changes
 *
 * Each job whose name changes gets a history entry ("Customer: IVAN PLATS -> IVANPLATS"), so the
 * change is traceable on the job page. A backup of every job's old name is written first.
 * Jobs whose name isn't in MAPPING are reported and left alone.
 */
import "dotenv/config";
import { writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";
import { normalizeCustomerName } from "../src/lib/customers";

/** Agreed with the workshop, 2026-11-15. Keys: names as found in the app; values: the customer. */
const MAPPING: Record<string, string> = {
  "AFRIMATS": "AFRIMAT",
  "BARBERTON": "BARBERTON",
  "BARBERTON MINE": "BARBERTON",
  "BOKONI MINE": "BOKONI",
  "BOKONI PLATINUM MINES": "BOKONI",
  "BOOYSENDAL": "BOOYSENDAL",
  "BOOYSENDAL MINE": "BOOYSENDAL",
  "BOYSEDAL MINE": "BOOYSENDAL",
  "EPIROC BOTSWANA": "EPIROC BOTSWANA",
  "EVANDER GOL MINE": "EVANDER",
  "EXXARO": "EXXARO",
  "EXXARO GROOTEGELUK": "EXXARO",
  "IVAN PLATS": "IVANPLATS",
  "IVANP PLATS": "IVANPLATS",
  "IVANPLATS": "IVANPLATS",
  "MARC CONTRACT": "MARC CONTRACT",
  "MARULA PLATINUM": "MARULA",
  "MOAB KHOTSONG": "MOAB KHOTSONG",
  "MOGALAKWENA": "MOGALAKWENA",
  "MPONENG MINE": "MPONENG",
  "PLANTCOR": "PLANTCOR",
  "REDPATH MINE": "REDPATH",
  // All Sasol sites are one customer (decided 2026-11-15).
  "SASOL": "SASOL",
  "SASOL THUBELISHA": "SASOL",
  "SASOL IMPUMELELO": "SASOL",
  "SASOL SHONDONI": "SASOL",
  "SASOL-THUBELISHA": "SASOL",
  "SASOL-IMPUMELELO": "SASOL",
  "SASOL-SHONDONI": "SASOL",
  "SOUTH DEEP": "SOUTH DEEP",
  "SOUTH DEEP MINE": "SOUTH DEEP",
  "STUART COAL": "STUART COAL",
  "WESSELS MINE": "WESSELS",
};

const apply = process.argv.includes("--apply");

(async () => {
  // Matched after tidying case and spacing, so "Sasol  thubelisha" finds "SASOL THUBELISHA".
  const target = (name: string) => MAPPING[normalizeCustomerName(name)];
  const jobs = await prisma.job.findMany({ select: { id: true, referenceNumber: true, customer: true } });
  const changes = jobs.filter((j) => target(j.customer) && target(j.customer) !== j.customer);
  const unmapped = jobs.filter((j) => !target(j.customer));
  const customers = [...new Set(Object.values(MAPPING))].sort();

  const plan = new Map<string, number>();
  for (const j of changes) plan.set(`${j.customer} -> ${target(j.customer)}`, (plan.get(`${j.customer} -> ${target(j.customer)}`) ?? 0) + 1);
  console.log(`${jobs.length} jobs · ${changes.length} to rename · ${unmapped.length} not in the mapping · ${customers.length} customers on the list`);
  for (const [change, n] of plan) console.log(`  ${String(n).padStart(3)} × ${change}`);
  if (unmapped.length) console.log("Not in the mapping (left alone):", unmapped.map((j) => `${j.referenceNumber} "${j.customer}"`).join(", "));

  if (!apply) {
    console.log("\nDry run — nothing changed. Run with --apply to make these changes.");
    await prisma.$disconnect();
    return;
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No admin user to record the change against");

  const backup = `customer-names-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.json`;
  writeFileSync(backup, JSON.stringify(jobs.map((j) => ({ id: j.id, referenceNumber: j.referenceNumber, customer: j.customer })), null, 2));
  console.log(`\nBackup of every job's customer name: ${backup}`);

  for (const name of customers) {
    await prisma.customer.upsert({ where: { name }, create: { name, createdById: admin.id }, update: {} });
  }
  for (const [from, to] of new Map(changes.map((j) => [j.customer, target(j.customer)]))) {
    const affected = changes.filter((j) => j.customer === from);
    await prisma.$transaction([
      prisma.job.updateMany({ where: { customer: from }, data: { customer: to } }),
      prisma.forecastSnapshot.updateMany({ where: { customer: from }, data: { customer: to } }),
      prisma.jobAuditLog.createMany({
        data: affected.map((j) => ({
          jobId: j.id,
          stage: "JOB",
          action: "UPDATE",
          summary: `Customer: ${from} -> ${to}`,
          comment: "Customer names standardised to the agreed customer list",
          changedById: admin.id,
        })),
      }),
    ]);
  }
  const after = await prisma.job.groupBy({ by: ["customer"], _count: { _all: true }, orderBy: { customer: "asc" } });
  console.log("\nCustomers on jobs now:");
  for (const g of after) console.log(`  ${g.customer}: ${g._count._all}`);
  await prisma.$disconnect();
})();
