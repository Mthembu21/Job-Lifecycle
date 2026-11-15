/**
 * Sets an account's password and signs it out everywhere.
 *
 *   npm run user:set-password -w backend -- planner@demo.local
 *
 * The password is typed in hidden (not echoed, not saved in shell history).
 */
import readline from "readline";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { passwordProblem } from "../src/modules/auth/auth.service";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    output._writeToOutput = (s: string) => {
      // Echo only the prompt and line breaks, never the typed characters.
      if (s.includes(question) || s === "\r\n" || s === "\n") output.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npm run user:set-password -w backend -- <email>");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No account with email ${email}`);

    const password = await askHidden(`New password for ${user.name} (${email}): `);
    const problem = passwordProblem(password, email);
    if (problem) throw new Error(problem);
    if ((await askHidden("Type it again: ")) !== password) throw new Error("The passwords don't match");

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(password, 12), tokenVersion: { increment: 1 } },
    });
    console.log(`Password updated for ${email}. Existing sessions for this account are signed out.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
