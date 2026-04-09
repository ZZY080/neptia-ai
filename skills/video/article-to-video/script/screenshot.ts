import path from "node:path";
import { ensureDir, fail, formatIndex, logInfo } from "./utils";

export interface ScreenshotResult {
  count: number;
  paths: string[];
}

export async function screenshotSlides(
  htmlPath: string,
  outputDir: string,
): Promise<ScreenshotResult> {
  await ensureDir(outputDir);

  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    fail(
      "playwright is not installed. Run: npm install playwright",
    );
  }

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome" });
  } catch {
    logInfo("未检测到系统 Chrome，改用 Playwright 自带 Chromium…");
    browser = await chromium.launch();
  }
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    const resolvedPath = path.resolve(htmlPath);
    await page.goto(`file://${resolvedPath}`, { waitUntil: "networkidle" });
    await page.waitForFunction("document.fonts.ready.then(() => true)", {
      timeout: 15_000,
    });

    const slides = page.locator(".slide");
    const count = await slides.count();
    if (count === 0) {
      fail("slides.html contains no .slide elements.");
    }

    const screenshotPaths: string[] = [];
    for (let i = 0; i < count; i++) {
      const outPath = path.join(outputDir, `slide-${formatIndex(i + 1)}.png`);
      await slides.nth(i).screenshot({ path: outPath });
      screenshotPaths.push(outPath);
      logInfo(`Screenshot ${String(i + 1)}/${String(count)}: slide-${formatIndex(i + 1)}.png`);
    }

    return { count, paths: screenshotPaths };
  } finally {
    await browser.close();
  }
}
