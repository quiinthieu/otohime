import { Doodle } from "@/components/doodles";
import { requirePermission } from "@/lib/dal";
import { can, roles, statements, type Permissions, type RoleName } from "@/lib/permissions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Roles" };

const names = Object.keys(roles) as RoleName[];

export default async function RolesPage() {
  await requirePermission("/admin/roles", { user: ["list"] });

  return (
    <div className="rise">
      <h1 className="text-[2rem]">Roles</h1>
      <p className="mt-2 text-muted">
        What each role can do. Roles are defined in code, so this page is read-only.
      </p>
      <p className="mt-2 text-muted">
        Ranks run owner › admin › user. You can only manage people ranked below you, and only
        give out roles below your own.
      </p>
      <div className="card table-wrap mt-6">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Permission</th>
              {names.map((role) => (
                <th key={role} scope="col">
                  <span className="badge" data-role={role}>
                    {role}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          {Object.entries(statements).map(([resource, actions]) => (
            <tbody key={resource}>
              <tr>
                <th scope="rowgroup" colSpan={names.length + 1} className="font-display text-base">
                  {resource}
                </th>
              </tr>
              {actions.map((action) => (
                <tr key={action}>
                  <th scope="row" className="font-normal">
                    {action}
                  </th>
                  {names.map((role) => (
                    <td key={role}>
                      {can(role, { [resource]: [action] } as Permissions) ? (
                        <>
                          <Doodle name="check" className="size-5 text-sea" />
                          <span className="sr-only">Allowed</span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true" className="text-muted">
                            –
                          </span>
                          <span className="sr-only">Not allowed</span>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
