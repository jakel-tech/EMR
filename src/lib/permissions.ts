
export const ROLE_RANK: Record<string, number> = {
  "Super Admin": 100,
  "Admin": 90,
  "Hospital Admin": 85,
  "Pharmacy Admin": 85,
  "Laboratory Admin": 85,
  "Manager": 70,
  "Doctor": 60,
  "Pharmacist": 60,
  "Lab Technician": 60,
  "Nurse": 50,
  "Technician": 40,
  "Staff": 30,
  "Requester": 20,
  "Patient": 10,
  "Guest": 0
};

export type PermissionId = 
  | "can_manage_users" 
  | "can_edit_settings" 
  | "can_view_analytics" 
  | "can_manage_hospitals"
  | "can_view_emr"
  | "can_edit_emr"
  | "can_manage_pharmacy"
  | "can_manage_lab"
  | "can_manage_finance"
  | "can_manage_hr"
  | "can_manage_maintenance"
  | "can_verify_results"
  | "can_manage_reagents"
  | "can_calibrate_devices"
  | "can_dispense_meds"
  | "can_manage_inventory"
  | "can_view_prescriptions"
  | "can_perform_triage"
  | "can_manage_appointments"
  | "can_export_data"
  | "can_audit_logs"
  | "can_view_forensics"
  | "can_access_research"
  | "can_manage_telehealth"
  | "can_bypass_privacy"
  | "can_manage_departments"
  | "can_view_departments"
  | "can_view_billing";

export const BASE_PERMISSIONS: Record<string, PermissionId[]> = {
  "Patient": ["can_view_prescriptions", "can_manage_appointments"],
  "Requester": ["can_view_prescriptions"],
  "Staff": ["can_manage_appointments", "can_view_departments"],
  "Technician": ["can_manage_maintenance", "can_calibrate_devices"],
  "Nurse": ["can_perform_triage", "can_view_emr", "can_view_departments"],
  "Doctor": ["can_edit_emr", "can_view_emr", "can_view_departments"],
  "Lab Technician": ["can_manage_lab", "can_verify_results", "can_manage_reagents", "can_view_departments"],
  "Pharmacist": ["can_manage_pharmacy", "can_dispense_meds", "can_manage_inventory", "can_view_departments"],
  "Manager": ["can_manage_hr", "can_view_analytics", "can_view_departments", "can_manage_departments"],
  "Hospital Admin": ["can_manage_users", "can_edit_settings", "can_manage_finance", "can_manage_departments", "can_view_departments"],
  "Admin": ["can_manage_hospitals", "can_audit_logs", "can_export_data", "can_manage_departments", "can_view_departments"],
  "Super Admin": ["can_manage_hospitals", "can_audit_logs", "can_export_data", "can_manage_users", "can_edit_settings", "can_manage_departments", "can_view_departments"]
};

/**
 * Gets all permissions inherited from lower ranks plus the role's own base permissions.
 */
export function getInheritedPermissions(role: string, customBasePermissions?: Record<string, PermissionId[]>): PermissionId[] {
  const currentRank = ROLE_RANK[role] || 0;
  const allPerms = new Set<PermissionId>();
  const basePerms = customBasePermissions || BASE_PERMISSIONS;

  Object.entries(ROLE_RANK).forEach(([r, rank]) => {
    if (rank <= currentRank) {
      (basePerms[r] || []).forEach(p => allPerms.add(p));
    }
  });

  return Array.from(allPerms);
}

export function isPermissionInherited(role: string, permissionId: PermissionId, customBasePermissions?: Record<string, PermissionId[]>): boolean {
  const currentRank = ROLE_RANK[role] || 0;
  const basePerms = customBasePermissions || BASE_PERMISSIONS;
  
  // A permission is inherited if it belongs to ANY role with a lower rank
  return Object.entries(ROLE_RANK).some(([r, rank]) => {
    return rank <= currentRank && (basePerms[r] || []).includes(permissionId);
  });
}
