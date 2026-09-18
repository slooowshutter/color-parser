import { test, expect } from "@playwright/test";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("https://scripts.simpleanalyticscdn.com/**", (route) =>
    route.abort(),
  );
  await page.goto("/photo");
  await expect(page.locator(".photo-stage")).toHaveAttribute(
    "aria-busy",
    "false",
  );
});

test("samples uploaded source pixels, drags, preserves transparency, and retains the image across tabs", async ({
  page,
}) => {
  await page
    .getByLabel("Upload image")
    .setInputFiles(path.resolve("tests/fixtures/quadrants.png"));
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#FF0000",
  );
  const canvas = page.getByRole("group", { name: "Image color sampling area" });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Image canvas is missing");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.25, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#0000FF",
  );
  await canvas.press("ArrowDown");
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#0000FF",
  );
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.75);
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#00000000",
  );
  await expect(page.locator(".opacity-value")).toHaveText("0% opacity");
  await page.getByRole("tab", { name: "From text" }).click();
  await page.getByRole("tab", { name: "From a photo" }).click();
  await expect(page.locator(".file-name")).toContainText("quadrants.png");
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#00000000",
  );
});

test("parses modern colors, exposes formats, saves and reloads a palette", async ({
  page,
  context,
  browserName,
}) => {
  await page.getByRole("tab", { name: "From text" }).click();
  await page
    .getByLabel("Colors, CSS, or a whole messy snippet")
    .fill(
      "bad beef cafe rgb(255 0 0 / 0) hsl(.5turn 100% 50%) oklch(0.7 0.1 45) #12345",
    );
  await expect(
    page.getByRole("status").filter({ hasText: "3 colors found" }),
  ).toBeVisible();
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#FF000000",
  );
  await expect(page.locator(".format-row")).toHaveCount(9);
  await page.getByRole("button", { name: "Save to palette" }).click();
  await expect(
    page.getByRole("button", { name: "Inspect #ff000000" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Inspect #ff000000" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inspect #ff000000" }).click();
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#FF000000",
  );
  if (browserName === "chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy RGB", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "RGB copied" }),
  ).toBeVisible();
  if (browserName === "chromium")
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("rgb(255 0 0 / 0)");
  await page.getByRole("button", { name: "Copy JSON" }).click();
  if (browserName === "chromium")
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe('[\n  "#ff000000"\n]');
  await page.getByRole("button", { name: "Remove #ff000000" }).click();
  await expect(
    page.getByRole("button", { name: "Inspect #ff000000" }),
  ).toHaveCount(0);
});

test("invalid uploads recover and narrow layouts remain within the viewport", async ({
  page,
}, testInfo) => {
  await page.screenshot({
    path: `.context/studio-initial-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByLabel("Upload image")
    .setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
  await expect(
    page.getByRole("region", { name: "Photo color picker" }).getByRole("alert"),
  ).toContainText("Could not read this image");
  await page
    .getByLabel("Upload image")
    .setInputFiles(path.resolve("tests/fixtures/quadrants.png"));
  await expect(page.locator(".selected-color-heading h2")).toHaveText(
    "#FF0000",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `.context/studio-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("empty text clears stale inspector values", async ({ page }) => {
  await page.getByRole("tab", { name: "From text" }).click();
  await page
    .getByLabel("Colors, CSS, or a whole messy snippet")
    .fill("rgb(1x 2 3) #12345");
  await expect(
    page.getByText("No colors found yet", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your next color goes here", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save to palette" }),
  ).toHaveCount(0);
});
