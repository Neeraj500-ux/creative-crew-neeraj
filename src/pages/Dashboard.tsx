import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Plus,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { scoped, useWorkspace } from "../services/workspace";

const STAGES = ["To Do", "In Progress", "Internal Review", "Revision", "Completed"];

const STAGE_COLORS = ["#bfdbfe", "#3b82f6", "#9b8afb", "#f5b942", "#2fc896"];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Executive workspace",
  admin: "Operations workspace",
  director: "Director workspace",
  manager: "Manager workspace",
  leader: "Team workspace",
  team_lead: "Team workspace",
  employee: "Personal workspace",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  internal_review: "border-violet-200 bg-violet-50 text-violet-700",
  revision: "border-amber-200 bg-amber-50 text-amber-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  to_do: "border-slate-200 bg-slate-50 text-slate-600",
  active: "border-slate-200 bg-slate-50 text-slate-600",
};

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatDueDate(value?: string) {
  if (!value) return { month: "—", day: "—", full: "No deadline" };

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { month: "—", day: "—", full: value };
  }

  return {
    month: date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
    day: String(date.getDate()).padStart(2, "0"),
    full: date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

function statusKey(value?: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_") || "neutral";
}

function StatusPill({ value }: { value?: string }) {
  const tone = STATUS_STYLES[statusKey(value)] || "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex min-h-6 items-center justify-center whitespace-nowrap rounded-full border px-2.5 text-[10px] font-extrabold leading-none ${tone}`}
    >
      {value || "Unassigned"}
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex min-h-[190px] flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 ring-8 ring-blue-50/50">
        <Icon size={20} />
      </span>
      <strong className="text-sm font-extrabold text-slate-700">{title}</strong>
      <p className="mt-2 max-w-[250px] text-xs leading-5 text-slate-400">{description}</p>
      {action ? (
        <Link
          to={action.to}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-blue-600 transition hover:text-blue-800"
        >
          {action.label} <ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  );
}

export default function Dashboard() {
  const { user, data } = useWorkspace();

  const tasks = useMemo(() => scoped(data.tasks || [], user), [data.tasks, user]);

  const projects = useMemo(() => {
    const allProjects = data.projects || [];

    if (user?.role === "employee") {
      return allProjects.filter((project) =>
        tasks.some((task) => task.project_id === project.id),
      );
    }

    return scoped(allProjects, user);
  }, [data.projects, tasks, user]);

  const today = localDateKey();
  const firstName = (user?.name || "there").trim().split(" ")[0];
  const admin = ["admin", "super_admin"].includes(user?.role || "");
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const activeTasks = tasks.filter((task) => task.status !== "Completed");
  const activeProjects = projects.filter((project) => project.status !== "Completed");
  const overdueTasks = activeTasks.filter((task) => Boolean(task.due) && task.due < today);
  const dueToday = activeTasks.filter((task) => task.due === today);
  const completionRate = Math.round(
    (completedTasks.length / Math.max(tasks.length, 1)) * 100,
  );

  const stageData = useMemo(
    () =>
      STAGES.map((name) => ({
        name,
        value: tasks.filter((task) => task.status === name).length,
      })),
    [tasks],
  );

  const monthlyData = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) => {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - 5 + index);

        return {
          name: date.toLocaleString("en-IN", { month: "short" }),
          completed: completedTasks.filter(
            (task) => task.due && String(task.due).slice(0, 7) === monthKey(date),
          ).length,
        };
      }),
    [completedTasks],
  );

  const upcomingTasks = useMemo(
    () =>
      activeTasks
        .slice()
        .sort((a, b) => {
          if (!a.due) return 1;
          if (!b.due) return -1;
          return String(a.due).localeCompare(String(b.due));
        })
        .slice(0, 5),
    [activeTasks],
  );

  const focusProjects = projects.slice(0, 5);
  const workspaceLabel = ROLE_LABELS[user?.role || ""] || "Creative workspace";

  const metrics: Array<{
    label: string;
    value: number;
    note: string;
    trend: string;
    icon: LucideIcon;
    accent: string;
    iconBg: string;
  }> = [
    {
      label: "Active projects",
      value: activeProjects.length,
      note: "Across your workspace",
      trend: activeProjects.length ? "Active now" : "Clear",
      icon: FolderKanban,
      accent: "text-blue-600",
      iconBg: "bg-blue-600 shadow-blue-200",
    },
    {
      label: "Tasks completed",
      value: completedTasks.length,
      note: "Small wins build momentum",
      trend: `${completionRate}% complete`,
      icon: CheckCircle2,
      accent: "text-emerald-600",
      iconBg: "bg-emerald-600 shadow-emerald-200",
    },
    {
      label: "Overdue tasks",
      value: overdueTasks.length,
      note: overdueTasks.length ? "Bring these back into focus" : "Nothing is falling behind",
      trend: overdueTasks.length ? "Action needed" : "On track",
      icon: Clock3,
      accent: "text-amber-600",
      iconBg: "bg-amber-500 shadow-amber-200",
    },
    {
      label: admin ? "Team members" : "Assigned tasks",
      value: admin ? (data.employees || []).length : tasks.length,
      note: admin ? "People making it happen" : "Your connected workload",
      trend: admin ? "Workspace" : "Personal",
      icon: Users,
      accent: "text-violet-600",
      iconBg: "bg-violet-600 shadow-violet-200",
    },
  ];

  return (
    <main className="relative isolate mx-auto w-full max-w-[1500px] overflow-hidden px-0 pb-10 text-slate-800 sm:pb-14">
      <div className="pointer-events-none absolute -right-40 top-0 -z-10 h-80 w-80 rounded-full bg-blue-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-40 -z-10 h-96 w-96 rounded-full bg-violet-200/15 blur-3xl" />

      <header className="mb-5 flex flex-col items-start justify-between gap-5 lg:mb-7 lg:flex-row lg:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-400 sm:text-[11px]">
            <span className="inline-flex items-center gap-2 text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.12)]" />
              Live workspace
            </span>
            <span className="h-3.5 w-px bg-slate-200" />
            <span>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <h1 className="mt-2.5 text-[31px] font-black tracking-[-.055em] text-slate-900 sm:text-4xl lg:text-[43px]">
            Good to see you, <span className="text-blue-600">{firstName}.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Keep the important work visible, focused, and moving forward.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
          <span className="inline-flex min-h-10 max-w-full items-center gap-2 overflow-hidden rounded-full border border-slate-200 bg-white/80 px-3.5 text-[11px] font-bold text-slate-500 shadow-sm backdrop-blur-xl">
            <Sparkles size={15} className="shrink-0 text-violet-500" />
            <span className="truncate">{workspaceLabel}</span>
          </span>
          <Link
            to="/tasks"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 text-xs font-extrabold text-white shadow-[0_12px_24px_rgba(37,99,235,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(37,99,235,.28)]"
          >
            <Plus size={17} /> Plan your work
          </Link>
        </div>
      </header>

      <section className="relative isolate mb-4 overflow-hidden rounded-[28px] border border-sky-200/20 bg-gradient-to-br from-[#061536] via-[#0d2d68] to-[#002323] shadow-[0_24px_60px_rgba(24,68,139,.18)]">
        <div className="pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(186,230,253,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(186,230,253,.12)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:radial-gradient(circle_at_70%_45%,#000,transparent_68%)]" />

        <div className="relative grid min-h-[360px] grid-cols-1 lg:grid-cols-[minmax(0,.95fr)_minmax(360px,1.05fr)]">
          <div className="relative z-10 self-center p-6 sm:p-9 lg:p-11">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[.16em] text-sky-200 sm:text-[11px]">
              <span className="grid h-6 w-6 place-items-center rounded-lg border border-sky-200/30 text-xs text-sky-100">✦</span>
              Creative work. Clear direction.
            </span>
            <h2 className="mt-4 max-w-xl text-[38px] font-black leading-[.98] tracking-[-.06em] text-white sm:text-5xl lg:text-[55px]">
              A little clarity.
              <br />
              <span className="text-sky-200">A lot of momentum.</span>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-7 text-sky-100/70">
              Your next big idea deserves a workspace that keeps every person,
              project, and deadline connected.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-4">
              <Link
                to="/projects"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-extrabold text-[#123263] shadow-[0_12px_24px_rgba(1,18,56,.2)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_rgba(1,18,56,.28)]"
              >
                Explore projects <ArrowUpRight size={16} />
              </Link>
              <Link
                to="/tasks"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-sky-200 transition hover:text-white"
              >
                See my workload <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="relative min-h-[245px] overflow-hidden lg:min-h-[360px]" aria-hidden="true">
            <div className="absolute left-1/2 top-1/2 h-[205px] w-[330px] -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] rounded-[50%] border border-sky-200/20 sm:h-[235px] sm:w-[390px]" />
            <div className="absolute left-1/2 top-1/2 h-[285px] w-[245px] -translate-x-1/2 -translate-y-1/2 rotate-[42deg] rounded-[50%] border border-sky-200/20 sm:h-[330px] sm:w-[285px]" />

            <div className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-full border border-sky-100/20 bg-blue-900/50 px-3 py-2 text-[10px] font-bold text-sky-100 shadow-xl backdrop-blur-xl sm:right-10 sm:top-10">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.13)]" />
              {projects.length} connected project{projects.length === 1 ? "" : "s"}
            </div>

            <div className="absolute left-[8%] top-[19%] flex w-[min(273px,80%)] items-center gap-3 rounded-2xl border border-sky-100/20 bg-blue-900/55 p-3.5 shadow-[0_18px_35px_rgba(1,18,57,.25)] backdrop-blur-xl sm:left-[13%] sm:top-[24%]">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-sky-300/15 text-sky-200">
                <Target size={18} />
              </span>
              <span className="min-w-0">
                <small className="block text-[10px] text-sky-100/55">Today&apos;s focus</small>
                <strong className="mt-1 block truncate text-xs font-extrabold text-white">
                  {dueToday.length
                    ? `${dueToday.length} priority task${dueToday.length > 1 ? "s" : ""}`
                    : "Make meaningful progress"}
                </strong>
              </span>
              <span className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-300 text-emerald-950">
                <Check size={14} />
              </span>
            </div>

            <div className="absolute bottom-[11%] right-[8%] flex items-center gap-3 rounded-2xl border border-sky-100/20 bg-blue-900/55 p-3 shadow-[0_18px_35px_rgba(1,18,57,.25)] backdrop-blur-xl sm:right-[15%]">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full"
                style={{ background: `conic-gradient(#7dd3fc ${completionRate * 3.6}deg, rgba(255,255,255,.16) 0deg)` }}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[#123a79] text-[11px] font-black text-white">
                  {completionRate}%
                </span>
              </span>
              <span>
                <strong className="block text-xs font-extrabold text-white">Delivery rhythm</strong>
                <small className="mt-1 block text-[10px] text-sky-100/55">{completedTasks.length} tasks completed</small>
              </span>
            </div>

            <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-sky-200/40 sm:block">
              <Sparkles size={76} strokeWidth={1} />
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-2.5 xl:grid-cols-4" aria-label="Workspace summary">
        {metrics.map(({ icon: Icon, ...metric }) => (
          <article
            key={metric.label}
            className="group relative min-h-[143px] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-[0_12px_30px_rgba(34,55,89,.05)] backdrop-blur-xl transition hover:-translate-y-1 hover:shadow-[0_18px_35px_rgba(34,55,89,.1)] sm:min-h-[154px] sm:p-5"
          >
            <span className={`pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full opacity-[.07] blur-sm ${metric.accent.replace("text-", "bg-")}`} />
            <div className="relative flex items-center justify-between gap-2">
              <span className={`grid h-9 w-9 place-items-center rounded-xl text-white shadow-lg ${metric.iconBg}`}>
                <Icon size={19} />
              </span>
              <span className="truncate text-[9px] font-extrabold text-slate-400 sm:text-[10px]">{metric.trend}</span>
            </div>
            <strong className="relative mt-3 block text-[26px] font-black tracking-[-.06em] text-slate-800 sm:text-3xl">{metric.value}</strong>
            <span className="relative mt-1 block text-[11px] font-extrabold text-slate-600 sm:text-xs">{metric.label}</span>
            <small className="relative mt-1.5 block text-[9px] leading-4 text-slate-400 sm:text-[10px]">{metric.note}</small>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(350px,.95fr)]">
        <article className="min-w-0 rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-[0_12px_30px_rgba(34,55,89,.05)] backdrop-blur-xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[.17em] text-slate-400">Performance overview</span>
              <h3 className="mt-2 text-base font-black tracking-[-.025em] text-slate-800 sm:text-lg">Delivery momentum</h3>
              <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">Completed tasks by deadline month</p>
            </div>
            <span className="hidden min-h-8 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-[10px] font-extrabold text-slate-500 sm:inline-flex">Last 6 months</span>
          </div>

          <div className="mt-3 h-[250px] w-full sm:h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 15, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="tailwindBlueArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e8eef7" strokeDasharray="4 5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#8793a8", fontSize: 12 }} dy={10} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#8793a8", fontSize: 11 }} />
                <Tooltip
                  cursor={{ stroke: "#d8e4f7", strokeWidth: 1 }}
                  contentStyle={{ border: "1px solid #e4ebf5", borderRadius: 14, boxShadow: "0 14px 34px rgba(31,52,86,.12)", fontSize: 12 }}
                  labelStyle={{ color: "#17243d", fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#2563eb" strokeWidth={3} fill="url(#tailwindBlueArea)" activeDot={{ r: 5, fill: "#2563eb", stroke: "#fff", strokeWidth: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="min-w-0 rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-[0_12px_30px_rgba(34,55,89,.05)] backdrop-blur-xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[.17em] text-slate-400">Workload snapshot</span>
              <h3 className="mt-2 text-base font-black tracking-[-.025em] text-slate-800 sm:text-lg">Work at a glance</h3>
              <p className="mt-1 text-[11px] text-slate-400 sm:text-xs">Every stage, in one place</p>
            </div>
            <span className="inline-flex min-h-8 items-center rounded-full bg-blue-50 px-3 text-[10px] font-extrabold text-blue-700">{tasks.length} total</span>
          </div>

          <div className="grid min-h-[235px] grid-cols-[145px_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[175px_minmax(0,1fr)] sm:gap-3">
            <div className="relative min-w-0">
              <div className="h-[175px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stageData} dataKey="value" innerRadius={53} outerRadius={75} paddingAngle={4} stroke="none">
                      {stageData.map((stage, index) => (
                        <Cell key={stage.name} fill={STAGE_COLORS[index]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ border: "1px solid #e4ebf5", borderRadius: 14, boxShadow: "0 14px 34px rgba(31,52,86,.12)", fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                <strong className="text-2xl font-black tracking-[-.06em] text-slate-800">{tasks.length}</strong>
                <span className="mt-1 text-[10px] text-slate-400">tasks</span>
              </div>
            </div>

            <div className="grid gap-2.5 sm:gap-3">
              {stageData.map((stage, index) => (
                <div key={stage.name} className="flex items-center justify-between gap-2 text-[10px] text-slate-500 sm:text-[11px]">
                  <span className="flex min-w-0 items-center gap-2 truncate">
                    <i className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: STAGE_COLORS[index] }} />
                    <span className="truncate">{stage.name}</span>
                  </span>
                  <strong className="text-xs font-black text-slate-700">{stage.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(350px,.95fr)]">
        <article className="min-w-0 rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-[0_12px_30px_rgba(34,55,89,.05)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[.17em] text-slate-400">Keep things moving</span>
              <h3 className="mt-2 text-base font-black tracking-[-.025em] text-slate-800 sm:text-lg">Projects in focus</h3>
            </div>
            <Link to="/projects" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold text-blue-600 transition hover:text-blue-800 sm:text-xs">
              View all <ArrowUpRight size={15} />
            </Link>
          </div>

          {focusProjects.length ? (
            <div className="grid gap-2">
              {focusProjects.map((project) => {
                const projectTasks = tasks.filter((task) => task.project_id === project.id);
                const completed = projectTasks.filter((task) => task.status === "Completed").length;
                const percent = Math.round((completed / Math.max(1, projectTasks.length)) * 100);
                const client = (data.clients || []).find((item) => item.id === project.client_id);

                return (
                  <Link
                    className="group grid min-w-0 grid-cols-[36px_minmax(0,1fr)_16px] items-center gap-2 rounded-2xl border border-transparent p-2.5 transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 sm:grid-cols-[38px_minmax(0,1fr)_minmax(90px,130px)_auto_16px] sm:gap-3"
                    to="/projects"
                    key={project.id}
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                      <FolderKanban size={18} />
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-xs font-extrabold text-slate-700">{project.name}</strong>
                      <small className="mt-1 block truncate text-[10px] text-slate-400">
                        {client?.name || "Internal project"}{project.due ? ` · Due ${formatDueDate(project.due).full}` : ""}
                      </small>
                    </span>
                    <span className="hidden min-w-0 sm:block">
                      <span className="mb-1 block text-right text-[10px] font-extrabold text-slate-500">{percent}%</span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <i className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" style={{ width: `${percent}%` }} />
                      </span>
                    </span>
                    <span className="hidden sm:inline-flex"><StatusPill value={project.status} /></span>
                    <ArrowUpRight className="text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-600" size={16} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={FolderKanban} title="No projects in focus" description="Create your first project to give the team a clear direction." action={{ label: "Open projects", to: "/projects" }} />
          )}
        </article>

        <article className="min-w-0 rounded-3xl border border-slate-200/90 bg-white/90 p-4 shadow-[0_12px_30px_rgba(34,55,89,.05)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <span className="text-[9px] font-black uppercase tracking-[.17em] text-slate-400">Your next moves</span>
              <h3 className="mt-2 text-base font-black tracking-[-.025em] text-slate-800 sm:text-lg">Coming up next</h3>
            </div>
            <Link to="/my-tasks" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-extrabold text-blue-600 transition hover:text-blue-800 sm:text-xs">
              My work <ArrowUpRight size={15} />
            </Link>
          </div>

          {upcomingTasks.length ? (
            <div className="grid gap-2">
              {upcomingTasks.map((task) => {
                const due = formatDueDate(task.due);
                const assignee = (data.employees || []).find((employee) => employee.id === task.assignee);
                const isOverdue = Boolean(task.due) && task.due < today;

                return (
                  <Link
                    to="/tasks"
                    className="group grid min-w-0 grid-cols-[40px_minmax(0,1fr)_16px] items-center gap-2 rounded-2xl border border-transparent p-2.5 transition hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 sm:grid-cols-[43px_minmax(0,1fr)_auto_16px] sm:gap-3"
                    key={task.id}
                  >
                    <span className={`flex h-11 w-10 flex-col items-center justify-center rounded-xl border ${isOverdue ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                      <small className={`text-[8px] font-black tracking-[.1em] ${isOverdue ? "text-rose-500" : "text-slate-400"}`}>{due.month}</small>
                      <strong className={`mt-1 text-base font-black leading-none ${isOverdue ? "text-rose-600" : "text-slate-700"}`}>{due.day}</strong>
                    </span>
                    <span className="min-w-0">
                      <strong className="block truncate text-xs font-extrabold text-slate-700">{task.name}</strong>
                      <small className="mt-1 block truncate text-[10px] text-slate-400">{isOverdue ? "Needs attention" : assignee?.name || "Assigned to you"}</small>
                    </span>
                    <span className="hidden sm:inline-flex"><StatusPill value={isOverdue ? "Overdue" : task.status} /></span>
                    <ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" size={16} />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="You are all caught up" description="There are no upcoming tasks waiting for your attention." action={{ label: "Browse tasks", to: "/tasks" }} />
          )}
        </article>
      </section>
    </main>
  );
}
