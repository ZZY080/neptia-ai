import path from "node:path";
import type { TaskPaths } from "./types";

/** 与运行命令时的当前工作目录一致（请在项目根执行 `npm run video`） */
export const PROJECT_ROOT = path.resolve(process.cwd());
export const MEDIA_ROOT = path.join(PROJECT_ROOT, "media");
export const DOTENV_PATH = path.join(PROJECT_ROOT, ".env");

export function buildTaskPaths(taskId: string, outputPath?: string): TaskPaths {
  const root = MEDIA_ROOT;
  const wipDir = path.join(root, "wip", taskId);
  return {
    wipDir,
    outlinePath: path.join(wipDir, "outline.md"),
    slidesHtmlPath: path.join(wipDir, "slides.html"),
    segmentsPath: path.join(wipDir, "segments.json"),
    imagesDir: path.join(wipDir, "images"),
    slidesDir: path.join(wipDir, "slides"),
    audioDir: path.join(wipDir, "audio"),
    subtitlesDir: path.join(wipDir, "subtitles"),
    clipsDir: path.join(wipDir, "clips"),
    concatPath: path.join(wipDir, "concat.txt"),
    outputPath: outputPath ?? path.join(root, "outbound", `${taskId}.mp4`),
  };
}
