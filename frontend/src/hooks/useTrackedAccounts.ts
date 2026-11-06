import { useCallback, useSyncExternalStore } from "react";
import { useSession } from "@/contexts/AuthContext";
import { accountRegistry } from "@/services/accountRegistry";

export function useTrackedAccounts() {
  const { userId } = useSession();
  const getSnapshot = useCallback(() => accountRegistry.list(userId), [userId]);
  return useSyncExternalStore(accountRegistry.subscribe, getSnapshot);
}
