import { invoke } from "@tauri-apps/api/core";
import type { PlayerSource } from "./playbackState";

export async function play(source: PlayerSource) {
  await invoke("control_player", { command: "play", source, positionMs: null });
}

export async function pause(source: PlayerSource) {
  await invoke("control_player", { command: "pause", source, positionMs: null });
}

export async function next(source: PlayerSource) {
  await invoke("control_player", { command: "next", source, positionMs: null });
}

export async function prev(source: PlayerSource) {
  await invoke("control_player", { command: "previous", source, positionMs: null });
}

export async function seek(positionMs: number, source: PlayerSource) {
  await invoke("control_player", { command: "seek", source, positionMs });
}
