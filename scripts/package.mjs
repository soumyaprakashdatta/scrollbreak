import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");
const releaseDir = join(rootDir, "release");
const packageJson = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));

function ensureZipInstalled() {
  try {
    execFileSync("zip", ["-v"], { stdio: "ignore" });
  } catch {
    throw new Error("The `zip` command is required to package builds.");
  }
}

function cleanReleaseDir() {
  if (existsSync(releaseDir)) {
    rmSync(releaseDir, { recursive: true, force: true });
  }
  execFileSync("mkdir", ["-p", releaseDir]);
}

function listTargetFiles(targetDir) {
  return readdirSync(targetDir).sort();
}

function packageTarget(target) {
  const targetDir = join(distDir, target);
  if (!existsSync(targetDir)) {
    throw new Error(`Missing build output for ${target}. Run \`npm run build:${target}\` first.`);
  }

  const archiveName = `scrollbrake-${target}-${packageJson.version}.zip`;
  const archivePath = join(releaseDir, archiveName);
  const files = listTargetFiles(targetDir);

  execFileSync("zip", ["-r", archivePath, ...files], {
    cwd: targetDir,
    stdio: "inherit"
  });

  return archivePath;
}

function main() {
  ensureZipInstalled();
  cleanReleaseDir();

  const requestedTarget = process.argv[2] || "all";
  const targets = requestedTarget === "all" ? ["chrome", "firefox"] : [requestedTarget];
  const archivePaths = targets.map(packageTarget);

  for (const archivePath of archivePaths) {
    console.log(archivePath);
  }
}

main();
