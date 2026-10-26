// Vercel Hobby checks the commit author, even when the owner's token uploads the build.
// Run before production migrations so an undeployable commit cannot advance the database.
import { execFileSync } from "node:child_process";

const expected = process.env.DEPLOY_AUTHOR_EMAIL;
if (!expected) {
  console.error("DEPLOY_AUTHOR_EMAIL must name the verified Vercel owner's Git email.");
  process.exit(2);
}

let author;
try {
  author = execFileSync("git", ["show", "--no-show-signature", "-s", "--format=%ae", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  console.error("Cannot verify the deployment author: the checked-out commit is unavailable.");
  process.exit(1);
}

if (author !== expected) {
  console.error("::error title=Vercel commit author::The checked-out commit is not authored by the Vercel owner. Configure the committing automation to use the verified owner identity and send a new commit through CI.");
  console.error(`Expected email: ${JSON.stringify(expected)}; commit author email: ${JSON.stringify(author)}`);
  process.exit(1);
}
console.log(`Deployment author verified: ${expected}`);
