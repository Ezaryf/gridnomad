import { test, expect } from "@playwright/test";

const APP_URL = "http://localhost:3000";

test("exercise OpenCode browser setup flow", async ({ page }) => {
  const key = process.env.OPENCODE_ZEN_KEY ?? "";
  if (!key) {
    test.skip(true, "OPENCODE_ZEN_KEY is required for this browser exercise.");
  }

  const requestLog = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/providers/opencode") && !url.includes("/api/simulations/stream")) {
      return;
    }
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = "<unreadable>";
    }
    requestLog.push({
      url,
      status: response.status(),
      body,
    });
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "Choose model and credential" }).first().click();

  await expect(page.getByText("Simulation setup")).toBeVisible({ timeout: 10000 });
  await page.getByRole("tab", { name: "Groups" }).click();

  const providerTrigger = page.getByRole("combobox", { name: "Provider" }).first();
  await expect(providerTrigger).toBeVisible({ timeout: 10000 });
  await providerTrigger.click();
  await page.getByRole("option", { name: "OpenCode CLI" }).click();

  await expect(page.getByText("Choose an OpenCode model", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Search by model, provider, or runtime").first().fill("minimax");
  await page.getByRole("button", { name: /MiniMax M2\.5 Free/i }).first().click();

  const keyInput = page.locator('input[type="password"]').first();
  await expect(keyInput).toBeVisible();
  await keyInput.fill(key);

  const connectResponse = page.waitForResponse((response) =>
    response.url().includes("/api/providers/opencode/connect") && response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Connect & verify" }).click();
  await connectResponse;

  await expect(page.getByText(/OpenCode model verified|Ready to run/i).first()).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(8000);

  const readyBadge = page.getByText(/Ready to run|OpenCode model verified|Ready/i).first();
  const blockedText = page.getByText(/rate limited|blocked|network|broken|Runtime verification failed|OpenCode key required/i).first();

  await page.screenshot({ path: "tests/artifacts/opencode-setup-result.png", fullPage: true });

  const summary = {
    url: page.url(),
    bodyText: await page.locator("body").innerText(),
    requestLog,
    hasReady: await readyBadge.isVisible().catch(() => false),
    hasBlocked: await blockedText.isVisible().catch(() => false),
  };

  console.log(JSON.stringify(summary, null, 2));
});
