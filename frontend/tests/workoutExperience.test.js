import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/pages/WorkoutExecution.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");

test("exercise cards expose real prescription, status actions and optional video", () => {
  assert.match(source, /source\?\.sets/);
  assert.match(source, /source\?\.reps/);
  assert.match(source, /source\?\.load/);
  assert.match(source, /source\?\.rest/);
  assert.match(source, /Vídeo não disponível/);
  assert.match(source, /exerciseExecution\.status === "em_andamento"/);
});

test("video player is deferred until interaction and supports youtube and uploads", () => {
  assert.match(source, /videoExercise &&/);
  assert.match(source, /youtubeThumbnail\(videoExercise\.videoUrl\)/);
  assert.match(source, /<video src=\{videoExercise\.videoUrl\} controls preload="metadata" playsInline/);
  assert.doesNotMatch(source, /\sautoPlay(?:=|\s|>)/);
});

test("series modal and workout actions keep accessible touch targets", () => {
  assert.match(styles, /\.workout-set-modal \.workout-number-control button[^}]*min-height: 48px/s);
  assert.match(styles, /\.exercise-start-button[^}]*min-height: 44px/s);
  assert.match(styles, /\.exercise-video-play[^}]*width: 44px; height: 44px/s);
});

test("workout layout has explicit tablet, mobile and 320px protections", () => {
  assert.match(styles, /@media \(max-width: 980px\)/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /@media \(max-width: 340px\)/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /overflow-x: hidden/);
});
