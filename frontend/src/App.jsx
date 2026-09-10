import React from "react";
import { useEffect, useMemo, useState } from "react";
import PersonalLayout from "./layouts/PersonalLayout.jsx";
import StudentLayout from "./layouts/StudentLayout.jsx";
import OwnerLayout from "./layouts/OwnerLayout.jsx";
import Login from "./pages/Login.jsx";
import RequiredPasswordChange from "./pages/RequiredPasswordChange.jsx";
import StudentDashboard from "./pages/Dashboard.jsx";
import PersonalDashboard from "./pages/PersonalDashboard.jsx";
import Students from "./pages/Students.jsx";
import WorkoutBuilder from "./pages/WorkoutBuilder.jsx";
import ExerciseDetail from "./pages/ExerciseDetail.jsx";
import StudentPortal from "./pages/StudentPortal.jsx";
import WorkoutExecution from "./pages/WorkoutExecution.jsx";
import Progress from "./pages/Progress.jsx";
import StudentDiet from "./pages/StudentDiet.jsx";
import StudentAssessments from "./pages/StudentAssessments.jsx";
import StudentPayments from "./pages/StudentPayments.jsx";
import StudentCalendar from "./pages/StudentCalendar.jsx";
import StudentMessages from "./pages/StudentMessages.jsx";
import StudentFiles from "./pages/StudentFiles.jsx";
import StudentSettings from "./pages/StudentSettings.jsx";
import PersonalDiet from "./pages/PersonalDiet.jsx";
import PersonalAssessments from "./pages/PersonalAssessments.jsx";
import PersonalFinance from "./pages/PersonalFinance.jsx";
import PersonalAgenda from "./pages/PersonalAgenda.jsx";
import PersonalMessages from "./pages/PersonalMessages.jsx";
import PersonalReports from "./pages/PersonalReports.jsx";
import PersonalSettings from "./pages/PersonalSettings.jsx";
import PersonalProgress from "./pages/PersonalProgress.jsx";
import PersonalStudentProgress from "./pages/PersonalStudentProgress.jsx";
import CoachIA from "./pages/CoachIA.jsx";
import AboutPersonal from "./pages/AboutPersonal.jsx";
import OwnerPortal from "./pages/OwnerPortal.jsx";
import { students as mockStudents, workouts as mockWorkouts } from "./data/mockData.js";
import { apiRequest, clearToken, getToken, logoutSession, refreshSession } from "./services/api.js";
import { clearDemoActivityDataOnce } from "./utils/activityData.js";
import { getRecommendedWorkout } from "./utils/workoutSchedule.js";
import { isPageEnabled } from "./utils/tenantBranding.js";
import {
  applyRouteBranding,
  getContextLoginPath,
  getRequestedContext,
  isAuthLoginPath,
  isOwnerLoginPath,
  isSessionCompatibleWithContext,
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
  "about-personal": ["Sobre o Personal", "Conheça a metodologia, a experiência e a filosofia do seu personal."]
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
  const [branding, setBranding] = useState({ display_name: "Fitland", initials: "FT", is_fallback: true });
  const [authReady, setAuthReady] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedExercise, setSelectedExercise] = useState(mockWorkouts[0].exercises[0]);
  const [students, setStudents] = useState(mockStudents);
  const [pendingStudents, setPendingStudents] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ptf_pending_students") || "[]");
    } catch {
      return [];
    }
  });
  const [workouts, setWorkouts] = useState(mockWorkouts);
  const [completed, setCompleted] = useState(() => new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [executionWorkoutId, setExecutionWorkoutId] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(mockStudents[0]?.id);
  const [focusedPendingStudentId, setFocusedPendingStudentId] = useState(null);
  const [personalProfile, setPersonalProfile] = useState({
    name: "Seu personal",
    bio: "Personal trainer focado em força, disciplina, performance e transformação real. Une estratégia, técnica e acompanhamento próximo para cada aluno evoluir com segurança.",
    specialty: "Hipertrofia, emagrecimento e performance",
    experience: "10+ anos de atuação",
    method: "Disciplina, foco e propósito",
    philosophy: "Treinar não é apenas cumprir exercícios. É construir uma versão mais forte, constante e confiante todos os dias.",
    highlights: ["Treinos personalizados", "Acompanhamento de evolução", "Ajustes por performance", "Feedback inteligente", "Estratégia individual por objetivo"],
    email: session?.email || "",
    instagram: ""
  });

  const meta = pageMeta[activePage] || pageMeta.dashboard;
  const activeWorkout = useMemo(() => getRecommendedWorkout(workouts, new Date()) || workouts[0], [workouts]);

  useEffect(() => {
    if (!branding?.display_name) return;
    setPersonalProfile((current) => ({ ...current, name: branding.display_name }));
    applyRouteBranding(window.location.pathname, branding);
  }, [branding?.display_name, session?.role]);

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
        const requestedPage = normalizedUser.role === "owner" && normalizedUser.must_change_password
          ? "security"
          : pageFromPath(window.location.pathname, normalizedUser.role);
        setActivePage(requestedPage);
        if (normalizedUser.role === "owner" && normalizedUser.must_change_password) {
          window.history.replaceState(null, "", "/fitland/change-password");
        } else if (isAuthLoginPath(pathname) || pathname === "/") {
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
    localStorage.setItem("ptf_pending_students", JSON.stringify(pendingStudents));
  }, [pendingStudents]);

  useEffect(() => {
    if (!session) return;
    apiRequest("/branding/me")
      .then(setBranding)
      .catch(() => setBranding(session.role === "owner"
        ? { display_name: "Fitland", initials: "FT", is_fallback: false }
        : {
            display_name: session.name?.toLowerCase().startsWith("personal ") ? session.name : `Personal ${session.name || ""}`.trim(),
            initials: (session.name || "PT").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(),
            is_fallback: true
          }));
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
    const personalLoginMatch = loginPath.match(/^\/personal\/([^/]+)\/login\/?$/);
    return (
      <Login
        context={isOwnerLoginPath(loginPath) ? "owner" : "personal"}
        brandSlug={personalLoginMatch?.[1] || ""}
        branding={branding}
        onSignup={(student) => {
          setPendingStudents((current) => [
            { ...student, id: crypto.randomUUID(), status: "pending", requestedAt: new Date().toISOString() },
            ...current
          ]);
        }}
        onLogin={(user) => {
          const normalizedUser = normalizeSessionUser(user);
          const requestedContext = getRequestedContext(window.location.pathname);
          if (!isSessionCompatibleWithContext(normalizedUser, requestedContext)) {
            clearToken();
            setSession(null);
            return;
          }
          const normalizedRole = normalizedUser.role;
          setSession(normalizedUser);
          const requestedPage = normalizedRole === "owner" && normalizedUser.must_change_password
            ? "security"
            : pageFromPath(window.location.pathname, normalizedRole);
          setActivePage(requestedPage);
          if (normalizedRole === "owner" && normalizedUser.must_change_password) {
            window.history.replaceState(null, "", "/fitland/change-password");
          } else if (requestedPage === "dashboard") {
            pushRoute(normalizedRole);
          }
        }}
      />
    );
  }

  if (session.role === "owner" && session.must_change_password) {
    return (
      <RequiredPasswordChange
        onComplete={(user) => {
          setSession(normalizeSessionUser(user));
          setActivePage("dashboard");
          window.history.replaceState(null, "", "/fitland/dashboard");
        }}
        onLogout={async () => {
          await logoutSession();
          setSession(null);
          window.history.replaceState(null, "", "/fitland/login");
        }}
      />
    );
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
        avatar: mockStudents[0].avatar,
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
      setSelectedStudentId(mockStudents[0]?.id);
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
    branding
  };

  const sharedPages = (
    <>
      {activePage === "exercise" && <ExerciseDetail exercise={selectedExercise} />}
      {activePage === "student-view" && (
        <StudentPortal
          workout={activeWorkout}
          workouts={workouts}
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
      {isStudent && activePage === "progress" && <Progress student={students[0]} students={students} workouts={workouts} completed={completed} branding={branding} />}
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
          profile={personalProfile}
          branding={branding}
          editable={!isStudent}
          onSave={setPersonalProfile}
        />
      )}
    </>
  );

  const confirmLogout = async () => {
    await logoutSession();
    setLogoutConfirmOpen(false);
    setSession(null);
    setActivePage("dashboard");
    setExecutionWorkoutId(null);
    window.history.replaceState(null, "", "/");
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
        {activePage === "dashboard" && <StudentDashboard students={students} workouts={workouts} onNavigate={navigate} onStartWorkout={openWorkoutExecution} branding={branding} />}
        {activePage === "diet" && <StudentDiet student={students[0]} branding={branding} />}
        {activePage === "assessments" && <StudentAssessments student={students[0]} branding={branding} />}
        {activePage === "payments" && <StudentPayments student={students[0]} branding={branding} />}
        {activePage === "calendar" && <StudentCalendar student={students[0]} workouts={workouts} onStartWorkout={openWorkoutExecution} branding={branding} />}
        {activePage === "messages" && <StudentMessages student={students[0]} branding={branding} />}
        {activePage === "files" && <StudentFiles student={students[0]} branding={branding} />}
        {activePage === "settings" && <StudentSettings student={students[0]} branding={branding} />}
        {sharedPages}
      </StudentLayout>
      {logoutModal}
      </>
    );
  }

  return (
    <>
    <PersonalLayout {...commonLayoutProps}>
      {activePage === "dashboard" && <PersonalDashboard students={students} workouts={workouts} onNavigate={navigate} branding={branding} />}
      {activePage === "diet" && <PersonalDiet students={students} />}
      {activePage === "finance" && <PersonalFinance students={students} branding={branding} />}
      {activePage === "agenda" && <PersonalAgenda students={students} />}
      {activePage === "chat" && <PersonalMessages students={students} branding={branding} />}
      {activePage === "reports" && <PersonalReports students={students} branding={branding} />}
      {activePage === "settings" && <PersonalSettings profile={personalProfile} />}
      {activePage === "assessments" && <PersonalAssessments students={students} />}
      {activePage === "progress" && <PersonalProgress students={students} onOpenStudentProgress={openStudentProgress} />}
      {activePage === "student-progress-detail" && (
        <PersonalStudentProgress
          student={students.find((student) => student.id === selectedStudentId) || students[0]}
          branding={branding}
          onBack={() => navigate("students")}
        />
      )}
      {activePage === "students" && (
        <Students
          students={students}
          pendingStudents={pendingStudents}
          workouts={workouts}
          onOpenProgress={openStudentProgress}
          onApproveStudent={approvePendingStudent}
          onDeleteStudent={deleteStudent}
          focusedPendingStudentId={focusedPendingStudentId}
          onPendingStudentViewed={() => setFocusedPendingStudentId(null)}
          onSaveStudent={(student) => {
            setStudents((current) => {
              if (student.id) {
                return current.map((item) => item.id === student.id ? { ...item, ...student } : item);
              }
              return [
                { ...student, id: crypto.randomUUID(), avatar: mockStudents[0].avatar, adherence: 0, workoutIds: student.workoutIds || [], accessApproved: student.accessApproved === true },
                ...current
              ];
            });
          }}
        />
      )}
      {activePage === "workout-builder" && (
        <WorkoutBuilder
          students={students}
          workouts={workouts}
          onOpenExercise={(exercise) => {
            setSelectedExercise(exercise);
            navigate("exercise");
          }}
          onSaveWorkout={(workout) => {
            setWorkouts((current) => {
              const exists = current.some((item) => item.id === workout.id);
              return exists
                ? current.map((item) => item.id === workout.id ? workout : item)
                : [workout, ...current];
            });
          }}
        />
      )}
      {sharedPages}
    </PersonalLayout>
    {logoutModal}
    </>
  );
}
