import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Clock3, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useWorkspace, scoped } from "../services/workspace";
import { Badge } from "../components/ui";
import { manageableRole } from "../lib/permissions";
import { roleLabels } from "../types";

export default function RoleDashboard() {
  const { user, data } = useWorkspace();
  if (!user) return null;
  const tasks = scoped(data.tasks || [], user);
  const team = (data.employees || []).filter((person) =>
    user.role === "director" ? person.role !== "director" : person.reports_to === user.id || person.team_id === user.team_id,
  );
  const completed = tasks.filter((task) => task.status === "Completed").length;
  const active = tasks.filter((task) => task.status !== "Completed").length;
  const nextRole = manageableRole(user.role);
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return <div className="role-dashboard">
    <section className="role-hero">
      <div className="role-hero-copy">
        <span className="eyebrow"><Sparkles size={14}/> {roleLabels[user.role].toUpperCase()} COMMAND CENTER</span>
        <h1>{greeting}, {user.name.split(" ")[0]}.</h1>
        <p>Your people, priorities and progress—beautifully connected in one focused workspace.</p>
        <div className="role-hero-actions">
          {nextRole && <Link className="btn" to="/people"><Users size={17}/> Manage {roleLabels[nextRole]}s</Link>}
          <Link className="btn secondary" to="/my-tasks">View my work <ArrowRight size={17}/></Link>
        </div>
      </div>
      <div className="role-orbit" aria-hidden="true"><span><ShieldCheck size={42}/></span><i/><i/><i/></div>
    </section>

    <section className="role-stat-grid">
      {[
        {label:"People in scope", value:team.length, Icon:Users, note:"Your connected reporting line"},
        {label:"Active work", value:active, Icon:BriefcaseBusiness, note:"Items currently moving"},
        {label:"Completed", value:completed, Icon:CheckCircle2, note:"Delivered with your team"},
        {label:"Completion rate", value:`${Math.round(completed / Math.max(tasks.length, 1) * 100)}%`, Icon:Clock3, note:"Across visible assignments"},
      ].map(({label, value, Icon, note}) => <article className="card role-stat" key={label}><span className="role-stat-icon"><Icon size={21}/></span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>)}
    </section>

    <section className="role-content-grid">
      <article className="card role-panel">
        <div className="section-heading"><div><span className="eyebrow">LIVE WORKFLOW</span><h3>Priority work</h3></div><Link to="/tasks">View all <ArrowRight size={15}/></Link></div>
        <div className="role-list">{tasks.filter(x => x.status !== "Completed").slice(0, 6).map(task => <Link to="/tasks" className="role-list-row" key={task.id}><span className="role-list-mark"/><div><strong>{task.name}</strong><small>{task.department || "Creative workspace"} · {task.due || "No deadline"}</small></div><Badge value={task.status}/></Link>)}</div>
      </article>
      <article className="card role-panel">
        <div className="section-heading"><div><span className="eyebrow">PEOPLE</span><h3>Your team pulse</h3></div>{nextRole && <Link to="/people">Manage <ArrowRight size={15}/></Link>}</div>
        <div className="role-list">{team.slice(0, 6).map(person => <Link to="/people" className="role-list-row person" key={person.id}><span className="avatar">{person.name.split(" ").map(x => x[0]).slice(0,2).join("")}</span><div><strong>{person.name}</strong><small>{roleLabels[person.role!]} · {person.department || person.team_id}</small></div><Badge value={person.status}/></Link>)}</div>
      </article>
    </section>
  </div>;
}
