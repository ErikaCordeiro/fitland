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

test.describe("premium Fitland owner login", () => {
  for (const width of [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1740, 1920]) {
    test(`owner login is accessible and responsive at ${width}px`, async ({ page }, testInfo) => {
      await mockApi(page);
      await page.setViewportSize({ width, height: width === 1740 ? 864 : width === 1920 ? 1080 : width < 600 ? 780 : 900 });
      await page.goto("/fitland/login");

      await expect(page.locator(".owner-login-brand-lockup")).toBeVisible();
      await expect(page.getByLabel("E-mail")).toBeVisible();
      await expect(page.getByLabel("Senha", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /^ENTRAR$/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Instalar app" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Google|Apple/ })).toHaveCount(0);

      if (width > 820) await expect(page.locator(".owner-login-visual")).toBeVisible();
      else await expect(page.locator(".owner-login-visual")).toBeHidden();

      const dimensions = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.viewport);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);

      if ([390, 1740].includes(width)) {
        await page.screenshot({ path: testInfo.outputPath(`owner-login-${width}.png`), fullPage: true });
      }
    });
  }

  test("owner login supports keyboard focus and reduced motion", async ({ page }) => {
    await mockApi(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/fitland/login");
    for (let step = 0; step < 5; step += 1) {
      if (await page.getByLabel("E-mail").evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press("Tab");
    }
    await expect(page.getByLabel("E-mail")).toBeFocused();
    const transitionDuration = await page.getByRole("button", { name: /^ENTRAR$/i }).evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(["0s", "0.00001s", "1e-05s"]).toContain(transitionDuration);
  });

  test("owner login controls work without console errors", async ({ page }) => {
    const pageErrors = [];
    const serverErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => { if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`); });
    await mockApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/fitland/login");

    const password = page.getByLabel("Senha", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(password).toHaveAttribute("type", "text");

    await page.getByRole("button", { name: "Esqueci minha senha" }).click();
    await expect(page.getByRole("dialog", { name: "Redefinir senha por e-mail" })).toBeVisible();
    await page.getByRole("button", { name: "Fechar" }).click();

    await page.getByRole("button", { name: "Instalar app" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  });

  for (const viewport of [{ width: 1366, height: 650 }, { width: 1024, height: 600 }, { width: 390, height: 640 }]) {
    test(`owner card remains complete at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await mockApi(page);
      await page.setViewportSize(viewport);
      await page.goto("/fitland/login");
      const geometry = await page.locator(".owner-login-card").evaluate((card) => ({
        top: card.getBoundingClientRect().top,
        bottom: card.getBoundingClientRect().bottom,
        viewportHeight: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      }));
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      if (viewport.width > 820) expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      await expect(page.getByRole("button", { name: "INSTALAR APP" })).toBeVisible();
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
