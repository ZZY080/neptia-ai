import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export function logInfo(message: string): void {
  console.log(`[信息] ${message}`);
}

export function logWarn(message: string): void {
  console.warn(`[警告] ${message}`);
}

export function fail(message: string): never {
  throw new Error(message);
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeText(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, content, "utf-8");
}

interface ExecResult {
  stdout: string;
  stderr: string;
}

export async function execCommand(
  cmd: string,
  args: string[],
  options?: { cwd?: string },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: options?.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      reject(new Error(`命令启动失败: ${cmd} (${error.message})`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `命令执行失败: ${cmd} ${args.join(" ")}\n退出码: ${String(code)}\n${stderr || stdout}`,
        ),
      );
    });
  });
}

export async function checkBinary(binary: string): Promise<void> {
  try {
    await execCommand("which", [binary]);
  } catch {
    fail(`缺少依赖命令: ${binary}。请先安装后再执行。`);
  }
}

export function toSrtTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const totalMs = Math.round(safeSeconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const sec = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const hour = Math.floor(totalMin / 60);
  return `${pad(hour)}:${pad(min)}:${pad(sec)},${pad(ms, 3)}`;
}

function pad(input: number, size = 2): string {
  return String(input).padStart(size, "0");
}

export function formatIndex(index: number): string {
  return String(index).padStart(3, "0");
}
