import { runWizard } from "./src/index.mjs";

async function main() {
  console.log("--- BEFORE WIZARD (This should be restored) ---");
  console.log("Line 1");
  console.log("Line 2");
  console.log("Line 3");
  console.log("-----------------------------------------------");

  const state = await runWizard({
    intro: "Test Alternate Screen Buffer",
    steps: [
      {
        id: "name",
        type: "text",
        prompt: "What is your name?",
        initialValue: "Tester",
      },
      {
        id: "confirm",
        type: "confirm",
        prompt: "Is this working?",
        initialValue: true,
      },
    ],
    outro: "Test Complete!",
  });

  console.log("\n--- AFTER WIZARD (History should be above) ---");
  console.log("Result State:", JSON.stringify(state, null, 2));
}

main().catch(console.error);
