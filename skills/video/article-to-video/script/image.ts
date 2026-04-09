/**
 * Generate JPEG assets via Google Imagen for placement inside HTML slides.
 * One API call per image. Does not modify slides.html — callers insert files via <img>.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { ensureDir, fail } from "./utils";

loadDotenv();
loadDotenv({ path: path.resolve(__dirname, "../../../.env") });

const DEFAULT_GUIDANCE = 1.5;
const DEFAULT_ASPECT = "16:9";
const FIXED_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

export interface GenerateImageInput {
  prompt: string;
  /** Where to write the JPEG (e.g. wip/<task-id>/images/cover.jpg). */
  outputPath: string;
  imageSize?: "1K" | "2K";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "3:4" | "4:3";
  guidanceScale?: number;
}

type Aspect = NonNullable<GenerateImageInput["aspectRatio"]>;

/** Predictable helper path for HTML slide image assets. */
export function taskImagePath(imagesDir: string, fileName = "image.jpg"): string {
  return path.join(imagesDir, fileName);
}

export async function generateImage(input: GenerateImageInput): Promise<string> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    fail("generateImage: prompt 不能为空。");
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    fail("缺少 GEMINI_API_KEY，无法生成图片。");
  }

  const out = path.resolve(input.outputPath);
  await ensureDir(path.dirname(out));

  const ai = new GoogleGenAI({ apiKey });
  const aspectRatio = (input.aspectRatio ?? DEFAULT_ASPECT) as Aspect;
  const imageSize = input.imageSize ?? "2K";
  const guidanceScale = input.guidanceScale ?? DEFAULT_GUIDANCE;

  const response = await ai.models.generateImages({
    model: FIXED_IMAGE_MODEL,
    prompt,
    config: {
      numberOfImages: 1,
      aspectRatio,
      imageSize,
      outputMimeType: "image/jpeg",
      guidanceScale,
    },
  });

  const imageBytes = response?.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) {
    fail("图片生成失败：未返回 imageBytes。");
  }

  await writeFile(out, Buffer.from(imageBytes, "base64"));
  return out;
}
