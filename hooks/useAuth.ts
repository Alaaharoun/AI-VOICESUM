import { useState, useEffect } from 'react';
import { useAuth as useAuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface UserPermissions {
  isSuperadmin: boolean;
  permissions: string[];
  roles: string[];
}

export function useUserPermissions() {
  const { user } = useAuthContext();
  const [permissions, setPermissions] = useState<UserPermissions>({
    isSuperadmin: false,
    permissions: [],
    roles: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user) {
        setPermissions({ isSuperadmin: false, permissions: [], roles: [] });
        setLoading(false);
        return;
      }

      try {
        // Check superadmin status using the RPC function
        const { data: isSuperadmin, error: superadminError } = await supabase
          .rpc('is_superadmin');

        if (superadminError) {
          console.error('Error checking superadmin status:', superadminError);
          // Fallback to false on error
          setPermissions({ isSuperadmin: false, permissions: [], roles: [] });
          setLoading(false);
          return;
        }

        // Get user roles using the view
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles_view')
          .select('role_name')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
        }

        // Get user permissions
        let permissionsList: string[] = [];
        
        if (isSuperadmin) {
          // Superadmins have all permissions
          const { data: allPermissions, error: permissionsError } = await supabase
            .from('permissions')
            .select('name');
          
          if (!permissionsError && allPermissions) {
            permissionsList = (allPermissions as { name: string }[]).map(p => p.name);
          }
        } else {
          // Regular users - get their specific permissions via joins
          const { data: userPermissions, error: permissionsError } = await supabase
            .from('role_permissions')
            .select(`
              permissions(name),
              roles!inner(
                user_roles!inner(user_id)
              )
            `)
            .eq('roles.user_roles.user_id', user.id);

          if (!permissionsError && userPermissions) {
            permissionsList = (userPermissions as any[])
              .filter(rp => rp.permissions && rp.permissions.name)
              .map(rp => rp.permissions.name);
          }
        }

        const roles = userRoles?.map(role => role.role_name) || [];

        setPermissions({
          isSuperadmin: isSuperadmin || false,
          permissions: [...new Set(permissionsList)], // Remove duplicates
          roles
        });
        console.log('useUserPermissions: setPermissions', { isSuperadmin: isSuperadmin || false, roles });

      } catch (error) {
        console.error('Error checking user permissions:', error);
        setPermissions({ isSuperadmin: false, permissions: [], roles: [] });
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [user]);

  const hasPermission = (permissionName: string) => {
    return permissions.isSuperadmin || permissions.permissions.includes(permissionName);
  };

  const hasRole = (roleName: string) => {
    return permissions.roles.includes(roleName);
  };

  return {
    ...permissions,
    loading,
    hasPermission,
    hasRole
  };
}