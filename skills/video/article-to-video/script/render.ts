import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectNarrationLanguage } from "./language";
import { Segment } from "./types";
import { execCommand, fail, formatIndex, logInfo } from "./utils";

interface RenderInput {
  segments: Segment[];
  slidesDir: string;
  subtitlesDir: string;
  clipsDir: string;
  concatPath: string;
  outputPath: string;
}

export async function renderSegmentsAndConcat(input: RenderInput): Promise<string[]> {
  const slideFiles = (await readdir(input.slidesDir))
    .filter((name) => /^slide-\d{3}\.(jpg|png)$/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  if (slideFiles.length === 0) {
    fail("未找到可渲染的幻灯片图片。");
  }

  const clipPaths: string[] = [];
  for (const segment of input.segments) {
    const slideIndex = clamp(segment.slideIndex, 1, slideFiles.length);
    const slideName = slideFiles[slideIndex - 1];
    if (!slideName) {
      fail(`Missing slide image for index ${String(slideIndex)}.`);
    }
    const slidePath = path.join(input.slidesDir, slideName);
    const audioPath = segment.audioPath;
    if (!audioPath) {
      fail(`第 ${String(segment.index)} 段缺少音频路径。`);
    }

    const segmentSrtPath = path.join(
      input.subtitlesDir,
      `segment-${formatIndex(segment.index)}.srt`,
    );
    const clipPath = path.join(input.clipsDir, `clip-${formatIndex(segment.index)}.mp4`);
    const duration = Math.max(segment.durationSeconds ?? 0, 0.3);
    const subtitleFilter = buildSubtitleFilter(segmentSrtPath, segment.narration);
    const fadeOutStart = Math.max(0, duration - 0.35).toFixed(3);
    const videoFilter = [
      "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=28:14[bg]",
      "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease[fg]",
      `[bg][fg]overlay=(W-w)/2:(H-h)/2,${subtitleFilter},fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutStart}:d=0.35[v]`,
    ].join(";");

    logInfo(`正在渲染第 ${String(segment.index)} 段视频...`);
    await execCommand("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-framerate",
      "30",
      "-i",
      slidePath,
      "-i",
      audioPath,
      "-filter_complex",
      videoFilter,
      "-map",
      "[v]",
      "-map",
      "1:a:0",
      "-t",
      duration.toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "19",
      "-r",
      "30",
      "-g",
      "60",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      "-shortest",
      clipPath,
    ]);
    clipPaths.push(clipPath);
  }

  const concatBody = clipPaths
    .map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(input.concatPath, `${concatBody}\n`, "utf-8");

  logInfo("正在拼接最终视频...");
  await execCommand("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    input.concatPath,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-r",
    "30",
    "-g",
    "60",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    input.outputPath,
  ]);

  return clipPaths;
}

function normalizeForFilter(filePath: string): string {
  return filePath
    .replace(/\\/g, "/")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\\'");
}

function buildSubtitleFilter(segmentSrtPath: string, narration: string): string {
  const language = detectNarrationLanguage(narration);
  const fontName = language === "zh" ? "PingFang SC" : "Arial";
  const fontSize = language === "zh" ? 22 : 21;
  const forceStyle = [
    `FontName=${fontName}`,
    `FontSize=${String(fontSize)}`,
    "Outline=2",
    "Shadow=0",
    "Alignment=2",
    "MarginV=30",
  ].join(",");
  return `subtitles='${normalizeForFilter(segmentSrtPath)}':force_style='${forceStyle}'`;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}
