import type { Role, User } from "../types";

export const roleLevel: Record<Role, number> = {
  director: 4,
  manager: 3,
  team_lead: 2,
  employee: 1,
  super_admin: 4,
  admin: 3,
  leader: 2,
};

export const dashboardPath: Record<Role, string> = {
  director: "/director",
  manager: "/manager",
  team_lead: "/team-lead",
  employee: "/employee",
  super_admin: "/director",
  admin: "/manager",
  leader: "/team-lead",
};

export function canAccess(user: User | null, roles: Role[]) {
  return !!user && user.active && roles.includes(user.role);
}

export function manageableRole(role: Role): Role | null {
  return role === "director" || role === "super_admin"
    ? "manager"
    : role === "manager" || role === "admin"
      ? "team_lead"
      : role === "team_lead" || role === "leader"
        ? "employee"
        : null;
}

export function canManage(actor: User, target: Pick<User, "role" | "reports_to" | "team_id">) {
  const expected = manageableRole(actor.role);
  if (target.role !== expected) return false;
  if (actor.role === "director") return true;
  return target.reports_to === actor.id || target.team_id === actor.team_id;
}
