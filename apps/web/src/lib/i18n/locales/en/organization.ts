import type { LocaleTranslations } from '../../types';

const organization: Pick<LocaleTranslations, 'organization'> = {
    organization: {
        companyNotFound: 'Company not found.',
        branchNotFound: 'Branch not found.',
        administrationNotFound: 'Administration not found.',
        departmentNotFound: 'Department not found.',
        organizationalUnitNotFound: 'Organizational unit not found.',
        roleNotFound: 'Role not found.',
        permissionNotFound: 'Permission not found.',
        userNotFound: 'User not found.',
        systemRoleProtected: 'System roles cannot be modified or deleted.',
        cannotDeleteRoleWithUsers: 'Cannot delete a role assigned to users. Remove the users first.',
        cannotRemoveLastSuperAdmin: 'Cannot remove the last SUPER_ADMIN user.',
        cannotDeleteAdministrationWithDepartments: 'Cannot delete an administration with active departments. Deactivate the departments first.',
        companyNotAllowed: 'Company not allowed.',
        branchNotAllowed: 'Branch not allowed.',
    },
};

export default organization;
