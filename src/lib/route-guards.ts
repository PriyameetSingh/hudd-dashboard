"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, createElement } from "react";
import type { ComponentProps, ComponentType } from "react";
import { getCurrentUser, MockUser, UserRole } from "@/lib/auth";

export function useRequireAuth(redirectTo = "/login") {
  const router = useRouter();
  const [user, setUser] = useState<MockUser | null>(null);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    if (!currentUser) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  return useMemo(() => user, [user]);
}

export function useRequireRole(roles: UserRole[] = [], redirectTo = "/dashboard") {
  const router = useRouter();
  const [user, setUser] = useState<MockUser | null>(null);
  const rolesKey = roles.join(",");

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    if (!currentUser) {
      router.replace("/login");
      return;
    }
    const allowedRoles = rolesKey ? (rolesKey.split(",") as UserRole[]) : [];
    if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
      router.replace(redirectTo);
    }
  }, [rolesKey, redirectTo, router]);

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
