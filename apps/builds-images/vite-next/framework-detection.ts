import fs from "fs/promises";
import path from "path";

export type Framework = "nextjs" | "vite" | "unknown";

type DetectionResult = {
  framework: Framework;
  rootDir: string;
  confidence: number;
  reason: string[];
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

function hasDep(pkg: PackageJson, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

export async function detectFramework(
  repoRoot: string,
): Promise<DetectionResult> {
  const candidates = await findCandidateAppDirs(repoRoot);
  let best: DetectionResult = {
    framework: "unknown",
    rootDir: ".",
    confidence: 0,
    reason: [],
  };

  for (const dir of candidates) {
    const pkg = await readPackageJsonIfExists(repoRoot, dir);
    const files = await listTopFiles(repoRoot, dir);

    let scoreNext = 0;
    let scoreVite = 0;
    const reason: string[] = [];

    if (pkg && hasDep(pkg, "next")) {
      scoreNext += 60;
      reason.push("found next dependency");
    }
    if (files.some((f) => f.startsWith("next.config."))) {
      scoreNext += 30;
      reason.push("found next.config");
    }
    if (
      (await exists(repoRoot, `${dir}/app`)) ||
      (await exists(repoRoot, `${dir}/pages`))
    ) {
      scoreNext += 10;
      reason.push("found app/ or pages/");
    }

    if (pkg && hasDep(pkg, "vite")) {
      scoreVite += 60;
      reason.push("found vite dependency");
    }
    if (files.some((f) => f.startsWith("vite.config."))) {
      scoreVite += 30;
      reason.push("found vite.config");
    }
    if (pkg?.scripts?.dev?.includes("vite")) {
      scoreVite += 10;
      reason.push("dev script uses vite");
    }

    const framework: Framework =
      scoreNext > scoreVite
        ? "nextjs"
        : scoreVite > scoreNext
          ? "vite"
          : "unknown";

    const confidence = Math.max(scoreNext, scoreVite);

    if (confidence > best.confidence) {
      best = { framework, rootDir: dir, confidence, reason };
    }
  }

  return best;
}

async function findCandidateAppDirs(repoRoot: string): Promise<string[]> {
  const dirs = await fs.readdir(repoRoot);

  const filteredDirs = await Promise.all(
    dirs.filter(async (dir) =>
      (await fs.stat(path.join(repoRoot, dir))).isDirectory(),
    ),
  );

  return filteredDirs;
}

const readPackageJsonIfExists = async (
  repoRoot: string,
  dir: string,
): Promise<PackageJson | undefined> => {
  const packageJsonPath = path.join(repoRoot, dir, "package.json");
  try {
    const content = await fs.readFile(packageJsonPath, "utf8");
    return JSON.parse(content) as PackageJson;
  } catch (error) {
    return undefined;
  }
};

const listTopFiles = async (
  repoRoot: string,
  dir: string,
): Promise<string[]> => {
  const files = await fs.readdir(path.join(repoRoot, dir));
  return files.filter((file) => file.endsWith(".js") || file.endsWith(".ts"));
};

const exists = async (
  repoRoot: string,
  targetPath: string,
): Promise<boolean> => {
  try {
    await fs.access(path.join(repoRoot, targetPath));
    return true;
  } catch {
    return false;
  }
};
