import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const modules = {
  workouts: true, students: true, progress: true, assessments: true,
  agenda: true, diet: true, finance: true, messages: true, files: true,
  reports: true, coach: true,
};

const branding = {
  personal_id: "personal-qa",
  display_name: "Tenant QA",
  slug: "tenant-qa",
  initials: "TQ",
  primary_color: "#111315",
  accent_color: "#ff5a1f",
  login_subtitle: "Treine com segurança.",
  modules,
  is_fallback: false,
};

const student = {
  id: "student-user-qa",
  name: "Aluno QA",
  email: "aluno@qa.invalid",
  role: "student",
  onboarding_completed_at: "2026-10-19T12:00:00Z",
};

const workout = {
  id: "workout-qa",
  personal_id: "personal-qa",
  student_id: "student-profile-qa",
  name: "Treino Premium QA",
  focus: "Força e técnica",
  duration_minutes: 45,
  exercises: [
    { id: "link-youtube", exercise_id: "exercise-youtube", exercise_name: "Supino QA", sets: 3, repetitions: "8-10", load: 40, rest_seconds: 60, video_url: "https://www.youtube.com/watch?v=rT7DgCr-3pg", video_provider: "youtube" },
    { id: "link-upload", exercise_id: "exercise-upload", exercise_name: "Remada QA", sets: 3, repetitions: "10", load: 30, rest_seconds: 75, video_url: "http://127.0.0.1:4178/qa-video-invalid.mp4", video_provider: "upload" },
    { id: "link-none", exercise_id: "exercise-none", exercise_name: "Prancha QA", sets: 2, repetitions: "30s", load: null, rest_seconds: 45 },
  ],
};

async function mockApi(page, { authenticated = false } = {}) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/branding/platform") return json({ display_name: "Fitland", initials: "FT", is_fallback: false });
    if (path === "/branding/public") return json({ ...branding, slug: url.searchParams.get("slug") || branding.slug });
    if (path === "/auth/refresh") return authenticated
      ? json({ access_token: "synthetic-browser-token", token_type: "bearer", expires_in: 1800, user: student })
      : json({ detail: "No session" }, 401);
    if (path === "/branding/me") return json(branding);
    if (path === "/workouts") return json([workout]);
    if (path === "/students" || path === "/exercises" || path === "/workout-sessions/history") return json([]);
    if (path === "/messages/unread-count") return json({ count: 0 });
    if (path === "/users/me/onboarding") return json({ ...student, onboarding_completed_at: "2026-10-19T12:00:00Z" });
    if (path === "/workout-sessions/active") return json(null);
    return json([]);
  });
}

test.describe("public branding and responsive quality", () => {
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1440]) {
    test(`tenant login is usable without horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
      await mockApi(page);
      await page.setViewportSize({ width, height: width < 600 ? 740 : 900 });
      await page.goto("/personal/tenant-qa/login");
      await expect(page.getByText("Tenant QA", { exact: true }).last()).toBeVisible();
      await expect(page.getByLabel("Tela de login")).toBeVisible();
      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      if ([320, 390, 1440].includes(width)) {
        await page.screenshot({ path: testInfo.outputPath(`login-${width}.png`), fullPage: true });
      }
    });
  }
});

test("student video cards support YouTube, uploads, missing video and state-safe close", async ({ page }, testInfo) => {
  await mockApi(page, { authenticated: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard/aluno");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Treinos" }).click();
  await expect(page.getByText("Treino Premium QA", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Acessar treino/ }).click();
  await expect(page.getByRole("heading", { name: "Treino Premium QA" })).toBeVisible();

  const youtubePreview = page.getByRole("button", { name: "Ver execução de Supino QA" }).first();
  await expect(youtubePreview).toBeVisible();
  await youtubePreview.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTitle("Execução de Supino QA")).toBeVisible();
  await expect(page.getByText("00:00:00", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(youtubePreview).toBeFocused();

  await page.getByRole("button", { name: /Remada QA/ }).click();
  const uploadPreview = page.getByRole("region", { name: "Exercícios do treino" }).getByRole("button", { name: "Vídeo do Personal de Remada QA" });
  await expect(uploadPreview).toBeVisible();
  await uploadPreview.click();
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar este vídeo");
  await page.getByRole("button", { name: "Fechar vídeo" }).click();
  await expect(uploadPreview).toBeFocused();

  await page.getByRole("button", { name: /Prancha QA/ }).click();
  await expect(page.getByRole("button", { name: "Ver execução de Prancha QA" })).toHaveCount(0);
  await expect(page.getByText("Vídeo não disponível")).toHaveCount(0);
  await expect(page.getByText("00:00:00", { exact: true }).first()).toBeVisible();

  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("student-video-cards-390.png"), fullPage: true });
});
