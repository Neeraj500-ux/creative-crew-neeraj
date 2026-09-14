import type { User } from "../types";

export function profileFromDocument(uid: string, email: string | null, data: Record<string, unknown>): User {
  const roles = {
    director: "director", manager: "manager", employee: "employee",
    team_lead: "team_lead", team_leader: "team_lead",
  } as const;
  const role = typeof data.role === "string" && Object.prototype.hasOwnProperty.call(roles, data.role)
    ? roles[data.role as keyof typeof roles] : null;
  if (!role) throw new Error("Your assigned role is invalid. Contact your administrator.");
  if (data.active === false) throw new Error("Your workspace access has been disabled.");
  return {
    id: uid, email: email ?? "",
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Workspace member",
    role, active: true,
    team_id: typeof data.team_id === "string" ? data.team_id : "",
    reports_to: typeof data.reports_to === "string" ? data.reports_to : undefined,
  };
}
