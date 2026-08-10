import * as React from "react";

/**
 * Minimal local re-implementation of Radix's <Slot />, used by asChild
 * button/link patterns without pulling in the full @radix-ui/react-slot
 * dependency.
 */
export const Slot = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }>(
  ({ children, ...props }, ref) => {
    if (React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ...props,
        ...(children as React.ReactElement<any>).props,
        ref,
      });
    }
    return null;
  }
);
Slot.displayName = "Slot";
