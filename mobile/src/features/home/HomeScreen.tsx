import { useAuthStore } from "@/src/stores/auth";
import { AdminHome } from "./AdminHome";
import { UserHome } from "./UserHome";

export default function HomeScreen() {
  const role = useAuthStore((s) => s.profile?.role);
  return role === "ADMIN" ? <AdminHome /> : <UserHome />;
}
