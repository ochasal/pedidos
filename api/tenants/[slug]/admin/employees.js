/**
 * Admin: Gestión de Empleados
 * GET    /api/tenants/:slug/admin/employees - Listar empleados
 * POST   /api/tenants/:slug/admin/employees - Invitar/crear empleado
 * PUT    /api/tenants/:slug/admin/employees?id=xxx - Actualizar rol
 * DELETE /api/tenants/:slug/admin/employees?id=xxx - Desactivar
 */
const { apiHandler, success, error: errorRes } = require('../../../_lib/response');
const { withTenant, withEmployeeAuth } = require('../../../_lib/tenant');
const { getServiceClient } = require('../../../_lib/supabase');

module.exports = apiHandler(async (req, res) => {
  return withTenant(req, res, (req, res) => {
    return withEmployeeAuth(req, res, handler);
  });
});

async function handler(req, res) {
  const supabase = getServiceClient();
  const tenantId = req.tenant.id;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const id = url.searchParams.get('id');

  // Solo owners y admins pueden gestionar empleados
  if (req.method !== 'GET' && !['owner', 'admin'].includes(req.employee.role)) {
    return errorRes(res, 'Solo administradores pueden gestionar empleados', 403);
  }

  switch (req.method) {
    case 'GET': {
      const { data, error } = await supabase
        .from('employees')
        .select('id, name, role, is_active, created_at, user_id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) return res.status(500).json({ error: 'Error cargando empleados' });
      return success(res, { employees: data });
    }

    case 'POST': {
      const body = req.body;
      if (!body.email || !body.name) {
        return errorRes(res, 'email y name son requeridos');
      }

      const validRoles = ['admin', 'operator'];
      const role = body.role && validRoles.includes(body.role) ? body.role : 'operator';

      // Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password || generateTempPassword(),
        email_confirm: true
      });

      if (authError) {
        if (authError.message.includes('already been registered')) {
          // Usuario ya existe, buscar su ID
          const { data: { users } } = await supabase.auth.admin.listUsers();
          const existingUser = users.find(u => u.email === body.email);
          if (!existingUser) return errorRes(res, 'Error encontrando usuario existente');

          // Verificar que no esté ya como empleado de este tenant
          const { data: existing } = await supabase
            .from('employees')
            .select('id')
            .eq('user_id', existingUser.id)
            .eq('tenant_id', tenantId)
            .single();

          if (existing) return errorRes(res, 'Este usuario ya es empleado de este negocio');

          // Crear vínculo
          const { data, error } = await supabase
            .from('employees')
            .insert({
              tenant_id: tenantId,
              user_id: existingUser.id,
              name: body.name,
              role,
              is_active: true
            })
            .select()
            .single();

          if (error) return res.status(500).json({ error: 'Error vinculando empleado' });
          return success(res, { employee: data }, 201);
        }
        return res.status(500).json({ error: authError.message });
      }

      // Crear empleado vinculado al usuario nuevo
      const { data, error } = await supabase
        .from('employees')
        .insert({
          tenant_id: tenantId,
          user_id: authData.user.id,
          name: body.name,
          role,
          is_active: true
        })
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error creando empleado' });
      return success(res, { employee: data }, 201);
    }

    case 'PUT': {
      if (!id) return errorRes(res, 'ID requerido');
      const body = req.body;

      const updateData = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.role !== undefined) {
        if (!['admin', 'operator'].includes(body.role)) {
          return errorRes(res, 'Rol inválido');
        }
        updateData.role = body.role;
      }
      if (body.is_active !== undefined) updateData.is_active = body.is_active;

      const { data, error } = await supabase
        .from('employees')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) return res.status(500).json({ error: 'Error actualizando empleado' });
      return success(res, { employee: data });
    }

    case 'DELETE': {
      if (!id) return errorRes(res, 'ID requerido');

      // No permitir auto-eliminación
      if (id === req.employee.id) {
        return errorRes(res, 'No puedes desactivarte a ti mismo');
      }

      const { error } = await supabase
        .from('employees')
        .update({ is_active: false })
        .eq('id', id)
        .eq('tenant_id', tenantId);

      if (error) return res.status(500).json({ error: 'Error desactivando empleado' });
      return success(res, { message: 'Empleado desactivado' });
    }

    default:
      return res.status(405).json({ error: 'Método no permitido' });
  }
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}
