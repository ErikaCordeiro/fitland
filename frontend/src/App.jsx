import React from "react";
import { useEffect, useMemo, useState } from "react";
import PersonalLayout from "./layouts/PersonalLayout.jsx";
import StudentLayout from "./layouts/StudentLayout.jsx";
import OwnerLayout from "./layouts/OwnerLayout.jsx";
import Login from "./pages/Login.jsx";
import StudentDashboard from "./pages/Dashboard.jsx";
import PersonalDashboard from "./pages/PersonalDashboard.jsx";
import Students from "./pages/Students.jsx";
import WorkoutBuilder from "./pages/WorkoutBuilder.jsx";
import ExerciseDetail from "./pages/ExerciseDetail.jsx";
import StudentPortal from "./pages/StudentPortal.jsx";
import WorkoutExecution from "./pages/WorkoutExecution.jsx";
import StudentCalendar from "./pages/StudentCalendar.jsx";
import StudentSettings from "./pages/StudentSettings.jsx";
import PersonalSettings from "./pages/PersonalSettings.jsx";
import Progress from "./pages/Progress.jsx";
import PersonalProgress from "./pages/PersonalProgress.jsx";
import CoachIA from "./pages/CoachIA.jsx";
import AboutPersonal from "./pages/AboutPersonal.jsx";
import OwnerPortal from "./pages/OwnerPortal.jsx";
import UnavailableDataPage from "./pages/UnavailableDataPage.jsx";
import { apiRequest, clearToken, getToken, logoutSession, refreshSession } from "./services/api.js";
import { clearDemoActivityDataOnce } from "./utils/activityData.js";
import { getRecommendedWorkout } from "./utils/workoutSchedule.js";
import { isPageEnabled } from "./utils/tenantBranding.js";
import { createTenantDataState, tenantDataError, tenantDataFromResponses } from "./utils/tenantData.js";
import { buildWorkoutPayload } from "./utils/workoutPayload.js";
import { readPendingStudents, savePendingStudents, studentScope, executionKey } from "./utils/storageScope.js";
import {
  applyRouteBranding,
  getContextLoginPath,
  getRequestedContext,
  isAuthLoginPath,
  isOwnerLoginPath,
  isSessionCompatibleWithContext,
  readPublicAuthContext,
  rememberPublicAuthContext,
  resolveLogoutContext,
} from "./utils/authRouting.js";

const pageMeta = {
  dashboard: ["Dashboard", "Disciplina hoje, liberdade amanhã."],
  students: ["Alunos", "Visualize, encontre e edite seus atletas com rapidez."],
  "workout-builder": ["Treinos", "Monte protocolos personalizados com víVideo, carga e descanso."],
  exercise: ["Exercício", "Execução guiada com parâmetros claros e vídeo incorporado."],
  "student-view": ["Treino", "Treino do dia, check-ins e registro de carga."],
  diet: ["Dieta", "Registre sua alimentação, hidratação e metas do dia."],
  finance: ["Financeiro", "Visão geral da saúde financeira do seu negócio."],
  agenda: ["Agenda", "Organize seus alunos e compromissos."],
  chat: ["Mensagens", "Converse com seus alunos e acompanhe todas as mensagens."],
  reports: ["Relatórios", "Visão geral dos resultados do seu negócio e dos seus alunos."],
  assessments: ["Avaliações", "Registre, acompanhe e analise a evolução física dos seus alunos."],
  payments: ["Pagamentos", "Acompanhe suas cobranças, faturas e histórico."],
  calendar: ["Calendário", "Sua consistência e compromissos."],
  messages: ["Mensagens", "Converse diretamente com seu personal."],
  files: ["Arquivos", "Envie e organize seus arquivos para acompanhamento do seu personal."],
  settings: ["Configurações", "Gerencie sua conta e preferências."],
  progress: ["Progresso", "Histórico, evolução e indicadores de consistência."],
  "student-progress-detail": ["Progresso individual", "Central individual de performance do aluno."],
  coach: ["Coach IA", "Seu assistente inteligente para treino, dieta e evolução."],
  "about-personal": ["Sobre o Personal", "Identidade e informações profissionais cadastradas."]
};

const rolePath = {
  owner: "/fitland/dashboard",
  personal: "/dashboard/personal",
  student: "/dashboard/aluno"
};

function normalizeSessionUser(user) {
  const normalizedRole = user?.role === "owner" || user?.role === "superuser" ? "owner" : user?.role === "student" || user?.role === "aluno" ? "student" : "personal";
  return { ...user, role: normalizedRole };
}

function pageFromPath(pathname, role) {
  const path = (pathname || "").toLowerCase();
  const studentRoutes = {
    "/dashboard/aluno": "dashboard",
    "/aluno/progresso": "progress",
    "/aluno/dieta": "diet",
    "/aluno/avaliacao": "assessments",
    "/aluno/avaliacoes": "assessments",
    "/aluno/pagamentos": "payments",
    "/aluno/calendario": "calendar",
    "/aluno/mensagens": "messages",
    "/aluno/arquivos": "files",
    "/aluno/configuracoes": "settings",
    "/aluno/coach-ia": "coach",
    "/aluno/sobre-o-personal": "about-personal"
  };
  const personalRoutes = {
    "/dashboard/personal": "dashboard",
    "/dashboard/personal/dietas": "diet",
    "/personal/avaliacoes": "assessments",
    "/personal/progresso": "progress",
    "/personal/financeiro": "finance",
    "/personal/agenda": "agenda",
    "/admin/mensagens": "chat",
    "/admin/relatorios": "reports",
    "/admin/configuracoes": "settings",
    "/personal/coach-ia": "coach",
    "/personal/sobre-o-personal": "about-personal"
  };
  const ownerRoutes = {
    "/fitland/login": "dashboard",
    "/fitland/dashboard": "dashboard",
    "/fitland/personals": "personals",
    "/fitland/logs": "logs",
    "/fitland/configuracoes": "settings",
    "/fitland/seguranca": "security",
    "/owner/dashboard": "dashboard",
    "/owner/personals": "personals",
    "/owner/logs": "logs",
    "/owner/configuracoes": "settings",
    "/owner/seguranca": "security"
  };
  if (role === "owner") return ownerRoutes[path] || "dashboard";
  if (role === "student") return studentRoutes[path] || "dashboard";
  return personalRoutes[path] || "dashboard";
}
function pushRoute(role) {
  const path = rolePath[role] || rolePath.personal;
  window.history.replaceState(null, "", path);
}

export default function App() {
  useEffect(() => {
    clearDemoActivityDataOnce();
  }, []);
  const [session, setSession] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("ptf_theme") || "dark");
  const [branding, setBranding] = useState({ display_name: "Fitland", initials: "FT", is_fallback: true });
  const [brandingUserId, setBrandingUserId] = useState(null);
  const [brandingError, setBrandingError] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [tenantData, setTenantData] = useState(() => createTenantDataState());
  const [exerciseLibrary, setExerciseLibrary] = useState([]);
  const [dataReloadKey, setDataReloadKey] = useState(0);
  const students = tenantData.students;
  const workouts = tenantData.workouts;
  const setStudents = (update) => setTenantData((current) => ({
    ...current,
    students: typeof update === "function" ? update(current.students) : update
  }));
  const setWorkouts = (update) => setTenantData((current) => ({
    ...current,
    workouts: typeof update === "function" ? update(current.workouts) : update
  }));
  const [pendingState, setPendingState] = useState({ personalId: null, items: [] });
  const pendingStudents = session?.role === "personal" && pendingState.personalId === String(session.id) ? pendingState.items : [];
  const scope = session?.role === "student" && brandingUserId === session.id ? studentScope(branding?.personal_id, session.id) : null;
  const [completed, setCompleted] = useState(() => new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [executionWorkoutId, setExecutionWorkoutId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [focusedPendingStudentId, setFocusedPendingStudentId] = useState(null);
  const [personalProfile, setPersonalProfile] = useState({
    name: "Seu personal",
    email: session?.email || "",
  });

  const meta = pageMeta[activePage] || pageMeta.dashboard;
  const activeWorkout = useMemo(() => getRecommendedWorkout(workouts, new Date()) || workouts[0] || null, [workouts]);

  useEffect(() => {
    if (!session || session.role === "owner") {
      setTenantData(createTenantDataState());
      setExerciseLibrary([]);
      return undefined;
    }

    let cancelled = false;
    setTenantData(createTenantDataState("loading"));
    const studentsRequest = session.role === "personal" ? apiRequest("/students") : Promise.resolve([]);
    const exercisesRequest = session.role === "personal" ? apiRequest("/exercises") : Promise.resolve([]);

    Promise.allSettled([studentsRequest, apiRequest("/workouts"), exercisesRequest])
      .then(([studentResult, workoutResult, exerciseResult]) => {
        if (cancelled) return;
        const studentRows = studentResult.status === "fulfilled" ? studentResult.value : [];
        const workoutRows = workoutResult.status === "fulfilled" ? workoutResult.value : [];
        const exerciseRows = exerciseResult.status === "fulfilled" ? exerciseResult.value : [];
        setExerciseLibrary(exerciseRows);
        const failures = [studentResult, workoutResult, exerciseResult].filter((result) => result.status === "rejected");
        if (failures.length === 3 || studentResult.status === "rejected") {
          setTenantData(tenantDataError(failures[0]?.reason?.message));
          return;
        }
        const next = tenantDataFromResponses(studentRows, workoutRows, exerciseRows);
        setTenantData({ ...next, status: failures.length ? "partial" : "success", error: failures[0]?.reason?.message || "" });
        setSelectedStudentId(studentRows[0]?.id || null);
      })
      .catch((error) => { if (!cancelled) setTenantData(tenantDataError(error?.message)); });

    return () => { cancelled = true; };
  }, [session?.id, session?.role, dataReloadKey]);

  useEffect(() => {
    if (session?.role === "owner") return;
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme === "dark");
    localStorage.setItem("ptf_theme", theme);
  }, [session?.role, theme]);

  useEffect(() => {
    if (!branding?.display_name) return;
    if (session?.role !== "owner" && branding.display_name === "Fitland" && getRequestedContext(window.location.pathname)?.type !== "owner") return;
    setPersonalProfile((current) => ({ ...current, name: branding.display_name }));
    applyRouteBranding(window.location.pathname, branding);
    if (session) {
      rememberPublicAuthContext(resolveLogoutContext({
        role: session.role,
        pathname: window.location.pathname,
        branding,
        session,
        storedContext: readPublicAuthContext(),
      }));
    }
  }, [branding?.display_name, branding?.icon_url, branding?.logo_url, branding?.slug, session?.id, session?.role]);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const pathname = window.location.pathname;
        const requestedContext = getRequestedContext(pathname);
        let user = null;
        if (getToken()) {
          try {
            user = await apiRequest("/users/me");
          } catch {
            clearToken();
          }
        }

        if (!user) {
          const refreshed = await refreshSession();
          user = refreshed.user || await apiRequest("/users/me");
        }

        if (!mounted) return;
        const normalizedUser = normalizeSessionUser(user);
        if (!isSessionCompatibleWithContext(normalizedUser, requestedContext)) {
          clearToken();
          setSession(null);
          if (!isAuthLoginPath(pathname) && requestedContext) {
            window.history.replaceState(null, "", getContextLoginPath(requestedContext));
          }
          return;
        }
        setSession(normalizedUser);
        const requestedPage = pageFromPath(window.location.pathname, normalizedUser.role);
        setActivePage(requestedPage);
        if (isAuthLoginPath(pathname) || pathname === "/" || pathname === "/fitland/change-password") {
          pushRoute(normalizedUser.role);
        }
      } catch {
        clearToken();
      } finally {
        if (mounted) setAuthReady(true);
      }
    }

    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setPendingState(session?.role === "personal"
      ? { personalId: String(session.id), items: readPendingStudents(session.id) }
      : { personalId: null, items: [] });
  }, [session?.id, session?.role]);

  const setPendingStudents = (update) => {
    const personalId = session?.role === "personal" ? String(session.id) : null;
    if (!personalId) return;
    setPendingState((current) => {
      const items = current.personalId === personalId ? current.items : readPendingStudents(personalId);
      const next = typeof update === "function" ? update(items) : update;
      savePendingStudents(personalId, next);
      return { personalId, items: next };
    });
  };

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    setBrandingError(false);
    apiRequest("/branding/me")
      .then((resolved) => {
        if (cancelled) return;
        setBranding(resolved);
        setBrandingUserId(resolved?.personal_id ? session.id : null);
        setBrandingError(!resolved?.personal_id && session.role !== "owner");
      })
      .catch(() => { if (!cancelled) {
        setBrandingError(true);
        setBranding(session.role === "owner"
        ? { display_name: "Fitland", initials: "FT", is_fallback: false }
        : {
            display_name: session.name?.toLowerCase().startsWith("personal ") ? session.name : `Personal ${session.name || ""}`.trim(),
            initials: (session.name || "PT").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
            is_fallback: true
          });
      } });
    return () => { cancelled = true; };
  }, [session?.id, session?.role]);

  useEffect(() => {
    if (!session || session.role === "owner" || !branding?.modules) return;
    if (!isPageEnabled(activePage, branding.modules)) {
      setActivePage("dashboard");
      window.history.replaceState(null, "", rolePath[session.role]);
    }
  }, [activePage, branding?.modules, session?.role]);

  if (!authReady) {
    return (
      <main className="login-screen login-loading-screen">
        <div className="loading-orb" />
      </main>
    );
  }

  if (!session) {
    const loginPath = window.location.pathname.toLowerCase();
    const personalLoginMatch = loginPath.match(/^\/personal\/([^/]+)(?:\/aluno)?\/login\/?$/);
    const requestedLoginContext = getRequestedContext(loginPath);
    return (
      <Login
        context={isOwnerLoginPath(loginPath) ? "owner" : requestedLoginContext?.type || "personal"}
        brandSlug={personalLoginMatch?.[1] || ""}
        branding={branding}
        onBrandingResolved={setBranding}
        onSignup={(student, personalId) => {
          if (!personalLoginMatch?.[1] || !personalId || String(branding?.personal_id) !== String(personalId)) return false;
          savePendingStudents(personalId, [
            { ...student, id: crypto.randomUUID(), status: "pending", requestedAt: new Date().toISOString() },
            ...readPendingStudents(personalId)
          ]);
          return true;
        }}
        onLogin={(user) => {
          const normalizedUser = normalizeSessionUser(user);
          const requestedContext = getRequestedContext(window.location.pathname);
          if (!isSessionCompatibleWithContext(normalizedUser, requestedContext)) {
            clearToken();
            setSession(null);
            return;
          }
          rememberPublicAuthContext(resolveLogoutContext({
            role: normalizedUser.role,
            pathname: window.location.pathname,
            branding,
            session: normalizedUser,
            storedContext: readPublicAuthContext(),
          }));
          const normalizedRole = normalizedUser.role;
          setSession(normalizedUser);
          const requestedPage = pageFromPath(window.location.pathname, normalizedRole);
          setActivePage(requestedPage);
          if (requestedPage === "dashboard") {
            pushRoute(normalizedRole);
          }
        }}
      />
    );
  }

  if (session && session.role !== "owner" && (branding.display_name === "Fitland" || brandingUserId !== session.id)) {
    if (brandingError) return <main className="login-screen login-loading-screen" role="alert"><p>Não foi possível confirmar o contexto desta conta.</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></main>;
    return <main className="login-screen login-loading-screen" role="status" aria-label="Carregando identidade visual" />;
  }

  const isStudent = session.role === "student";
  const isOwner = session.role === "owner";
  const navigate = (page) => {
    if (!isOwner && !isPageEnabled(page, branding?.modules)) page = "dashboard";
    setActivePage(page);
    setSidebarOpen(false);
    if (page !== "workout-execution") {
      setExecutionWorkoutId(null);
    }
    if (isOwner) {
      const ownerPaths = { dashboard: "/fitland/dashboard", personals: "/fitland/personals", logs: "/fitland/logs", settings: "/fitland/configuracoes", security: "/fitland/seguranca" };
      window.history.replaceState(null, "", ownerPaths[page] || "/fitland/dashboard");
    } else if (page === "coach") {
      window.history.replaceState(null, "", isStudent ? "/aluno/coach-ia" : "/personal/coach-ia");
    } else if (page === "about-personal") {
      window.history.replaceState(null, "", isStudent ? "/aluno/sobre-o-personal" : "/personal/sobre-o-personal");
    } else if (isStudent && page === "progress") {
      window.history.replaceState(null, "", "/aluno/progresso");
    } else if (isStudent && page === "diet") {
      window.history.replaceState(null, "", "/aluno/dieta");
    } else if (isStudent && page === "assessments") {
      window.history.replaceState(null, "", "/aluno/avaliacao");
    } else if (isStudent && page === "payments") {
      window.history.replaceState(null, "", "/aluno/pagamentos");
    } else if (isStudent && page === "calendar") {
      window.history.replaceState(null, "", "/aluno/calendario");
    } else if (isStudent && page === "messages") {
      window.history.replaceState(null, "", "/aluno/mensagens");
    } else if (isStudent && page === "files") {
      window.history.replaceState(null, "", "/aluno/arquivos");
    } else if (isStudent && page === "settings") {
      window.history.replaceState(null, "", "/aluno/configuracoes");
    } else if (!isStudent && page === "diet") {
      window.history.replaceState(null, "", "/dashboard/personal/dietas");
    } else if (!isStudent && page === "assessments") {
      window.history.replaceState(null, "", "/personal/avaliacoes");
    } else if (!isStudent && page === "progress") {
      window.history.replaceState(null, "", "/personal/progresso");
    } else if (!isStudent && page === "finance") {
      window.history.replaceState(null, "", "/personal/financeiro");
    } else if (!isStudent && page === "agenda") {
      window.history.replaceState(null, "", "/personal/agenda");
    } else if (!isStudent && page === "chat") {
      window.history.replaceState(null, "", "/admin/mensagens");
    } else if (!isStudent && page === "reports") {
      window.history.replaceState(null, "", "/admin/relatorios");
    } else if (!isStudent && page === "settings") {
      window.history.replaceState(null, "", "/admin/configuracoes");
    } else if (!isStudent && page === "student-progress-detail") {
      window.history.replaceState(null, "", `/personal/aluno/${selectedStudentId || "aluno"}/progresso`);
    } else {
      pushRoute(isStudent ? "student" : "personal");
    }
  };

  const openWorkoutExecution = (workoutId) => {
    const selectedWorkout = workouts.find((item) => item.id === workoutId);
    if (!isStudent || !executionKey(scope, selectedWorkout)) return;
    setExecutionWorkoutId(workoutId);
    setActivePage("workout-execution");
    setSidebarOpen(false);
    window.history.replaceState(null, "", `/aluno/treino/${workoutId}`);
  };

  const resetWorkoutProgress = (workoutId) => {
    const workout = workouts.find((item) => item.id === workoutId) || activeWorkout;
    const exerciseIds = new Set(workout.exercises.map((exercise) => exercise.id));
    setCompleted((current) => {
      const next = new Set(current);
      exerciseIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const openStudentProgress = (student) => {
    setSelectedStudentId(student.id);
    setActivePage("student-progress-detail");
    setSidebarOpen(false);
    window.history.replaceState(null, "", `/personal/aluno/${student.id}/progresso`);
  };

  const approvePendingStudent = (student) => {
    if (!student) return;
    setStudents((current) => [
      {
        ...student,
        avatar: student.avatar || "",
        adherence: 0,
        workoutIds: student.workoutIds || [],
        workoutId: student.workoutId || null,
        accessApproved: true,
        status: "active"
      },
      ...current
    ]);
    setPendingStudents((current) => current.filter((item) => item.id !== student.id));
    setFocusedPendingStudentId(null);
    setActivePage("students");
    window.history.replaceState(null, "", "/dashboard/personal");
  };

  const deleteStudent = (student) => {
    if (!student) return;
    const confirmed = window.confirm(`Excluir ${student.name}? Essa ação remove o aluno da lista deste ambiente de teste.`);
    if (!confirmed) return;
    setStudents((current) => current.filter((item) => item.id !== student.id));
    if (selectedStudentId === student.id) {
      setSelectedStudentId(students[0]?.id || null);
    }
  };

  const personalNotifications = pendingStudents.map((student) => ({
    id: `pending-${student.id}`,
    type: "student-signup",
    title: "Novo aluno Aguardando aprovação",
    message: `${student.name} solicitou acesso ao app.`,
    student,
    actionLabel: "Ver aluno"
  }));

  const studentNotifications = [
    {
      id: "student-welcome",
      type: "info",
      title: "App liberado",
      message: "Seu acesso está ativo. Você já pode acompanhar treino, dieta, avaliações e progresso."
    }
  ];

  const commonLayoutProps = {
    activePage,
    meta,
    onNavigate: navigate,
    onLogout: () => setLogoutConfirmOpen(true),
    session,
    sidebarOpen,
    setSidebarOpen,
    student: students[0],
    notifications: isStudent ? studentNotifications : personalNotifications,
    onNotificationAction: (notification) => {
      if (notification?.type === "student-signup") {
        setActivePage("students");
        setFocusedPendingStudentId(notification.student?.id || null);
        setSidebarOpen(false);
        window.history.replaceState(null, "", "/dashboard/personal");
      }
    },
    onApproveStudent: approvePendingStudent,
    branding,
    theme,
    setTheme
  };

  const sharedPages = (
    <>
      {activePage === "exercise" && <ExerciseDetail exercise={selectedExercise} />}
      {activePage === "student-view" && (
        <StudentPortal
          workout={activeWorkout}
          workouts={workouts}
          scope={scope}
          completed={completed}
          onStartWorkout={openWorkoutExecution}
          onNavigate={navigate}
          onToggleExercise={(id) => {
            setCompleted((current) => {
              const next = new Set(current);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            });
          }}
        />
      )}
      {activePage === "workout-execution" && (
        <WorkoutExecution
          workout={workouts.find((item) => item.id === executionWorkoutId) || activeWorkout}
          scope={scope}
          completed={completed}
          onBack={() => navigate("student-view")}
          onToggleExercise={(id) => {
            setCompleted((current) => {
              const next = new Set(current);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            });
          }}
          onFinishWorkout={() => resetWorkoutProgress(executionWorkoutId)}
        />
      )}
      {isStudent && activePage === "progress" && (
        <Progress student={students[0]} students={students} branding={branding} scope={scope} />
      )}
      {activePage === "coach" && (
        <CoachIA
          role={isStudent ? "student" : "personal"}
          student={students[0]}
          branding={branding}
          onClose={() => navigate("dashboard")}
        />
      )}
      {activePage === "about-personal" && (
        <AboutPersonal
          profile={{ ...personalProfile, email: session?.email || "" }}
          branding={branding}
        />
      )}
    </>
  );

  const confirmLogout = async () => {
    const logoutRole = session?.role;
    const logoutContext = resolveLogoutContext({
      role: logoutRole,
      pathname: window.location.pathname,
      branding,
      session,
      storedContext: readPublicAuthContext(),
    });
    rememberPublicAuthContext(logoutContext);
    const loginPath = getContextLoginPath(logoutContext);
    try {
      await logoutSession();
    } finally {
      window.history.replaceState(null, "", loginPath);
      setLogoutConfirmOpen(false);
      setSession(null);
      setTenantData(createTenantDataState());
      setActivePage("dashboard");
      setExecutionWorkoutId(null);
    }
  };

  const saveWorkout = async (workout) => {
    const nextLibrary = [...exerciseLibrary];
    const persistedExercises = [];
    for (const exercise of workout.exercises) {
      let record = exercise.exerciseId ? nextLibrary.find((item) => String(item.id) === String(exercise.exerciseId)) : null;
      if (!record) record = nextLibrary.find((item) => item.name.trim().toLowerCase() === exercise.name.trim().toLowerCase());
      if (!record) {
        record = await apiRequest("/exercises", {
          method: "POST",
          body: JSON.stringify({ name: exercise.name, explanation: exercise.explanation || null }),
        });
        nextLibrary.push(record);
      }
      persistedExercises.push({ ...exercise, exerciseId: record.id });
    }
    const payload = buildWorkoutPayload(workout, persistedExercises);
    const saved = await apiRequest(workout.id ? `/workouts/${workout.id}` : "/workouts", {
      method: workout.id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    setExerciseLibrary(nextLibrary);
    const normalized = tenantDataFromResponses(students, [saved], nextLibrary).workouts[0];
    setWorkouts((current) => workout.id
      ? current.map((item) => String(item.id) === String(saved.id) ? normalized : item)
      : [normalized, ...current]);
    return normalized;
  };

  const saveStudent = async (student) => {
    const payload = {
      name: student.name,
      email: student.email,
      age: student.age,
      weight: student.weight,
      height: student.height,
      objective: student.objective,
      notes: student.notes || null,
    };
    const saved = await apiRequest(student.id ? `/students/${student.id}` : "/students", {
      method: student.id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    setStudents((current) => student.id
      ? current.map((item) => String(item.id) === String(saved.id) ? saved : item)
      : [saved, ...current]);
    return saved;
  };

  const logoutModal = logoutConfirmOpen ? (
    <div className="logout-modal-backdrop" role="presentation" onMouseDown={() => setLogoutConfirmOpen(false)}>
      <section className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title" onMouseDown={(event) => event.stopPropagation()}>
        <p className="eyebrow">Sessão segura</p>
        <h2 id="logout-title">Sair da conta?</h2>
        <p>Seu progresso será salvo. Caso exista um treino em andamento, ele continuará disponível quando você entrar novamente.</p>
        <div className="logout-modal-actions">
          <button type="button" onClick={() => setLogoutConfirmOpen(false)}>Cancelar</button>
          <button className="danger" type="button" onClick={confirmLogout}>Sair</button>
        </div>
      </section>
    </div>
  ) : null;

  if (isOwner) {
    return (
      <>
        <OwnerLayout session={session} activePage={activePage} onNavigate={navigate} onLogout={() => setLogoutConfirmOpen(true)}>
          <OwnerPortal activePage={activePage} onNavigate={navigate} session={session} onSession={setSession} />
        </OwnerLayout>
        {logoutModal}
      </>
    );
  }

  if (isStudent) {
    return (
      <>
      <StudentLayout {...commonLayoutProps}>
        {activePage === "dashboard" && <StudentDashboard students={students} workouts={workouts} onNavigate={navigate} onStartWorkout={openWorkoutExecution} branding={branding} scope={scope} theme={theme} setTheme={setTheme} />}
        {activePage === "diet" && <UnavailableDataPage className="student-diet-page" title="Nenhum plano alimentar disponível" message="Um plano prescrito aparecerá aqui quando estiver disponível no sistema." />}
        {activePage === "assessments" && <UnavailableDataPage className="student-assessments-page" title="Nenhuma avaliação disponível" message="Suas avaliações aparecerão quando houver registros persistidos." />}
        {activePage === "payments" && <UnavailableDataPage className="student-payments-page" title="Sem dados de pagamento" message="As cobranças aparecerão quando houver integração financeira real." />}
        {activePage === "calendar" && <StudentCalendar student={students[0]} workouts={workouts} onStartWorkout={openWorkoutExecution} branding={branding} scope={scope} />}
        {activePage === "messages" && <UnavailableDataPage className="student-messages-page" title="Nenhuma mensagem disponível" message="As conversas aparecerão quando houver integração persistida." />}
        {activePage === "files" && <UnavailableDataPage className="student-files-page" title="Nenhum arquivo disponível" message="Os arquivos aparecerão quando houver armazenamento persistido." />}
        {activePage === "settings" && <StudentSettings student={students[0]} branding={branding} theme={theme} setTheme={setTheme} />}
        {sharedPages}
      </StudentLayout>
      {logoutModal}
      </>
    );
  }

  return (
    <>
    <PersonalLayout {...commonLayoutProps}>
      {activePage === "dashboard" && <PersonalDashboard students={students} workouts={workouts} dataStatus={tenantData.status} dataError={tenantData.error} onRetry={() => setDataReloadKey((value) => value + 1)} onNavigate={navigate} branding={branding} theme={theme} setTheme={setTheme} />}
      {activePage === "diet" && <UnavailableDataPage className="nutrition-admin-page" title="Nenhum plano alimentar cadastrado" message="Os planos aparecerão quando houver registros reais disponíveis." />}
      {activePage === "finance" && <UnavailableDataPage className="finance-page" title="Sem dados financeiros" message="As informações financeiras aparecerão quando houver integração persistida." />}
      {activePage === "agenda" && <UnavailableDataPage className="agenda-page" title="Nenhum compromisso cadastrado" message="A agenda ficará disponível quando houver eventos reais." />}
      {activePage === "chat" && <UnavailableDataPage className="messages-admin-page" title="Nenhuma mensagem disponível" message="As conversas aparecerão quando houver integração persistida." />}
      {activePage === "reports" && <UnavailableDataPage className="reports-admin-page" title="Nenhum relatório disponível" message="Os relatórios serão gerados quando houver métricas persistidas." />}
      {activePage === "settings" && <PersonalSettings profile={{ ...personalProfile, email: session?.email || "" }} studentCount={students.length} workoutCount={workouts.length} theme={theme} setTheme={setTheme} />}
      {activePage === "assessments" && <UnavailableDataPage className="assessments-admin-page" title="Nenhuma avaliação disponível" message="As avaliações aparecerão quando houver registros persistidos." />}
      {activePage === "progress" && <PersonalProgress />}
      {activePage === "student-progress-detail" && (
        <UnavailableDataPage className="personal-progress-page" title="Sem dados individuais de progresso" message="As métricas aparecerão quando o aluno registrar avaliações e atividades reais." />
      )}
      {activePage === "students" && (
        <Students
          students={students}
          dataStatus={tenantData.status}
          dataError={tenantData.error}
          onRetry={() => setDataReloadKey((value) => value + 1)}
          pendingStudents={pendingStudents}
          workouts={workouts}
          onOpenProgress={openStudentProgress}
          onApproveStudent={approvePendingStudent}
          onDeleteStudent={deleteStudent}
          focusedPendingStudentId={focusedPendingStudentId}
          onPendingStudentViewed={() => setFocusedPendingStudentId(null)}
          onSaveStudent={saveStudent}
        />
      )}
      {activePage === "workout-builder" && (
        <WorkoutBuilder
          students={students}
          workouts={workouts}
          availableExercises={exerciseLibrary}
          onOpenExercise={(exercise) => {
            setSelectedExercise(exercise);
            navigate("exercise");
          }}
          onSaveWorkout={saveWorkout}
        />
      )}
      {sharedPages}
    </PersonalLayout>
    {logoutModal}
    </>
  );
}
