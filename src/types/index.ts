export type Role = "director" | "manager" | "team_lead" | "employee" | "super_admin" | "admin" | "leader";
export type Entity = {
  id: string;
  name: string;
  status: string;
  department?: string;
  email?: string;
  role?: Role;
  assignee?: string;
  project_id?: string;
  client_id?: string;
  due?: string;
  priority?: string;
  hours?: number;
  amount?: number;
  description?: string;
  owner_id?: string;
  team_id?: string;
  created_at?: string;
  [key: string]: unknown;
};
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  team_id: string;
  active: boolean;
  reports_to?: string;
  phone?: string;
  joined_at?: string;
};
export const roleLabels: Record<Role, string> = {
  director: "Director",
  manager: "Manager",
  team_lead: "Team Lead",
  employee: "Employee",
  super_admin: "Director",
  admin: "Manager",
  leader: "Team Lead",
};
export const statuses = [
  "To Do",
  "In Progress",
  "Internal Review",
  "Revision",
  "Completed",
];
export const departments = [
  "Creative",
  "Performance Marketing",
  "Development",
  "Content",
  "Client Servicing",
];
