import { login } from "../actions";
import { AuthForm } from "../auth-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  return (
    <AuthForm
      mode="login"
      action={login}
      next={next}
      notice={expired ? "Your session expired. Sign in again to pick up where you left off." : undefined}
    />
  );
}
