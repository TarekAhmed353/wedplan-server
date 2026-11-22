import { closeDB, collections, connectDB } from "../src/db.js";

const email = process.argv[2]?.trim().toLowerCase();

if (!email || !email.includes("@")) {
  console.error("Please give an email address, for example:");
  console.error("  npm run make-admin -- admin@example.com");
  process.exit(1);
}

let exitCode = 0;

try {
  await connectDB();

  const user = await collections.users.findOne({ email });

  if (!user) {
    console.error(`No user found with the email ${email}.`);
    console.error("Sign up with this email on the website first, then run this again.");
    exitCode = 1;
  } else if (user.role === "admin") {
    console.log(`${email} is already an admin. Nothing changed.`);
  } else {
    await collections.users.updateOne(
      { _id: user._id },
      { $set: { role: "admin", roleChosen: true, updatedAt: new Date() } },
    );
    console.log(`${email} is now an admin (was ${user.role ?? "no role"}).`);
  }
} catch (error) {
  console.error(`Could not update the user: ${error.message}`);
  exitCode = 1;
} finally {
  await closeDB();
}

process.exit(exitCode);
