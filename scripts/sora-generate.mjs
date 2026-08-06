#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

const API_BASE = "https://api.openai.com/v1";

function parseArgs(argv) {
  const args = {
    model: "sora-2",
    size: "1280x720",
    seconds: "8",
    output: "sora-output.mp4",
    pollIntervalMs: 10_000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      args[key] = value;
      i += 1;
    } else if (!args.prompt) {
      args.prompt = arg;
    } else {
      args.prompt += ` ${arg}`;
    }
  }

  return args;
}

function usage() {
  return `Usage:
  OPENAI_API_KEY=sk-... node scripts/sora-generate.mjs "video prompt"

Options:
  --model sora-2|sora-2-pro   Default: sora-2
  --size 1280x720             Default: 1280x720
  --seconds 8                 Default: 8
  --output output.mp4         Default: sora-output.mp4

Example:
  OPENAI_API_KEY=sk-... node scripts/sora-generate.mjs \\
    "Wide shot of a red paper lantern floating over a quiet lake at dawn, slow camera push in" \\
    --model sora-2 --size 1280x720 --seconds 8 --output lake.mp4`;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text || response.statusText } };
  }
}

async function apiFetch(path, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = await readJson(response);
    const message = payload?.error?.message || response.statusText;
    throw new Error(`OpenAI API error ${response.status}: ${message}`);
  }

  return response;
}

async function createVideo({ model, prompt, size, seconds }) {
  const form = new FormData();
  form.set("model", model);
  form.set("prompt", prompt);
  form.set("size", size);
  form.set("seconds", String(seconds));

  const response = await apiFetch("/videos", {
    method: "POST",
    body: form,
  });

  return readJson(response);
}

async function retrieveVideo(id) {
  const response = await apiFetch(`/videos/${id}`);
  return readJson(response);
}

async function downloadVideo(id, output) {
  const response = await apiFetch(`/videos/${id}/content?variant=video`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(output, buffer);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    return;
  }

  if (!args.prompt) {
    throw new Error(`Missing prompt.\n\n${usage()}`);
  }

  let video = await createVideo(args);
  console.log(`Started video job: ${video.id} (${video.status})`);

  while (video.status === "queued" || video.status === "in_progress") {
    await sleep(Number(args.pollIntervalMs));
    video = await retrieveVideo(video.id);
    const progress = video.progress == null ? "unknown" : `${video.progress}%`;
    console.log(`Status: ${video.status}, progress: ${progress}`);
  }

  if (video.status !== "completed") {
    const message = video?.error?.message || `Video ended with status: ${video.status}`;
    throw new Error(message);
  }

  await downloadVideo(video.id, args.output);
  console.log(`Saved video to ${args.output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
