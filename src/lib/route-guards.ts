"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, createElement } from "react";
import type { ComponentProps, ComponentType } from "react";
import { getCurrentUser, MockUser, UserRole } from "@/lib/auth";

export function useRequireAuth(redirectTo = "/login") {
  const router = useRouter();
  const [user, setUser] = useState<MockUser | null>(() => getCurrentUser());

  useEffect(() => {
    if (!user) {
      router.replace(redirectTo);
    }
  }, [user, router, redirectTo]);

  return useMemo(() => user, [user]);
}

export function useRequireRole(roles: UserRole[] = [], redirectTo = "/dashboard") {
  const router = useRouter();
  const [user, setUser] = useState<MockUser | null>(() => getCurrentUser());

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (roles.length > 0 && !roles.includes(user.role)) {
      router.replace(redirectTo);
    }
  }, [user, roles, router, redirectTo]);

  return useMemo(() => user, [user]);
}

export function withRoleGuard(
  Component: ComponentType<any>,
  roles: UserRole[] = [],
  redirectTo = "/dashboard"
) {
  return function GuardedComponent(props: ComponentProps<ComponentType<any>>) {
    useRequireRole(roles, redirectTo);
    return createElement(Component, props);
  };
}
