import { trpc } from "@/lib/trpc";
import { useCallback } from "react";

export type EmailCredentials = { email: string; password: string };
export type RegisterCredentials = EmailCredentials & { name: string };

export function useAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: user => utils.auth.me.setData(undefined, user),
  });
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: user => utils.auth.me.setData(undefined, user),
  });
  const logoutMutation = trpc.auth.logout.useMutation();

  const login = useCallback(
    (credentials: EmailCredentials) => loginMutation.mutateAsync(credentials),
    [loginMutation.mutateAsync],
  );
  const register = useCallback(
    (credentials: RegisterCredentials) => registerMutation.mutateAsync(credentials),
    [registerMutation.mutateAsync],
  );
  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation.mutateAsync, utils]);

  return {
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || logoutMutation.isPending,
    error: meQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    refresh: () => meQuery.refetch(),
    login,
    register,
    logout,
  };
}
