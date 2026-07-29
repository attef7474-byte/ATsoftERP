export interface CurrentUserType {
  id: string;
  sub: string;
  email: string;
  name: string;
  companyId?: string | null;
  branchId?: string | null;
  departmentId?: string | null;
}
