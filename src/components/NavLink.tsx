import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef, useTransition, useCallback, MouseEvent } from "react";
import { cn } from "@/lib/utils";

interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, onClick, ...props }, ref) => {
    const [, startTransition] = useTransition();

    const handleClick = useCallback(
      (e: MouseEvent<HTMLAnchorElement>) => {
        // Let the router handle it inside a transition so the old UI stays visible
        e.preventDefault();
        startTransition(() => {
          // Trigger navigation by clicking the underlying link programmatically
          // We use onClick passthrough + manual history push via the router
          onClick?.(e);
        });
        // Use window.history for the actual navigation inside the transition
        // But RouterNavLink handles this — we just need to wrap in startTransition
      },
      [onClick]
    );

    return (
      <RouterNavLink
        ref={ref}
        to={to}
        className={({ isActive, isPending }) =>
          cn(className, isActive && activeClassName, isPending && pendingClassName)
        }
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
