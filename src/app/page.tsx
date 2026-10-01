import { redirect } from "next/navigation";

// La raíz lleva al login; el login redirige al inicio del perfil si ya hay sesión.
export default function Home() {
  redirect("/login");
}
