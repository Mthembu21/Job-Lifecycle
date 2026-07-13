import { Role } from "../types";
import { StageKey as ApiStageKey } from "../api/jobs";

const STAGE_ROLES: Record<ApiStageKey, Role[]> = {
  quotation: ["PLANNER"],
  repair: ["PLANNER"],
  dispatch: ["STOREMAN", "PLANNER"],
  invoice: ["PLANNER"],
};

export function canEditStage(role: Role | undefined, stage: ApiStageKey): boolean {
  if (!role) return false;
  if (role === "ADMIN") return true;
  return STAGE_ROLES[stage].includes(role);
}

export function canCreateJob(role: Role | undefined): boolean {
  return role === "STOREMAN" || role === "ADMIN";
}

export function canEditJobFields(role: Role | undefined): boolean {
  return role === "STOREMAN" || role === "ADMIN";
}

export function canDeleteJob(role: Role | undefined): boolean {
  return role === "STOREMAN" || role === "ADMIN";
}
