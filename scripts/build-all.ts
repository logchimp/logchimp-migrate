#!/usr/bin/env bun

const platforms = [
  { os: "darwin", arch: "x64", suffix: "" },
  { os: "darwin", arch: "arm64", suffix: "" },
  { os: "linux", arch: "x64", suffix: "" },
  { os: "linux", arch: "arm64", suffix: "" },
  { os: "win32", arch: "x64", suffix: ".exe" },
];

const binDir = "./bin";
const distDir = "./dist";

await Bun.$`mkdir -p ${binDir} ${distDir}`;

for (const { os, arch, suffix } of platforms) {
  const target = `${os}-${arch}`;
  const outfile = `${distDir}/logchimp-migrate-${target}${suffix}`;
  
  console.log(`Building for ${target}...`);
  
  const result = Bun.spawn([
    "bun",
    "build",
    "--compile",
    "--target",
    `bun-${target}`,
    "src/index.ts",
    "--outfile",
    outfile,
  ]);

  const exitCode = await result.exited;
  if (exitCode !== 0) {
    console.error(`Failed to build for ${target}`);
    process.exit(1);
  }
}

console.log("Building for current platform...");
const currentResult = Bun.spawn([
  "bun",
  "build",
  "--compile",
  "src/index.ts",
  "--outfile",
  `${binDir}/logchimp-migrate${process.platform === "win32" ? ".exe" : ""}`,
]);

const currentExitCode = await currentResult.exited;
if (currentExitCode !== 0) {
  console.error("Failed to build for current platform");
  process.exit(1);
}

console.log("All builds complete!");
