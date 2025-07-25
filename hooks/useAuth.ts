import { useAuth as useAuthContext } from '@/contexts/AuthContext';

export function useUserPermissions() {
  const { userPermissions, loading: authLoading } = useAuthContext();

  // إذا لم يوجد userPermissions (لم يتم تحميلها بعد)
  if (!userPermissions) {
    return {
      isSuperadmin: false,
      permissions: [],
      roles: [],
      loading: authLoading,
      hasPermission: (_: string) => false,
      hasRole: (_: string) => false,
    };
  }

  const hasPermission = (permissionName: string): boolean => {
    return userPermissions.isSuperadmin || userPermissions.permissions.includes(permissionName);
  };

  const hasRole = (roleName: string): boolean => {
    return userPermissions.roles.includes(roleName);
  };

  return {
    ...userPermissions,
    loading: false,
    hasPermission,
    hasRole,
  };
}