import { usersCol } from "@/lib/db/collections";

export interface UserOption {
  id: string;
  name: string;
}

export async function listUsers(tenantId: string): Promise<UserOption[]> {
  const users = await usersCol();
  const docs = await users
    .find({ tenantId, active: true }, { projection: { name: 1 } })
    .sort({ name: 1 })
    .toArray();
  return docs.map((u) => ({ id: u._id.toHexString(), name: u.name }));
}
