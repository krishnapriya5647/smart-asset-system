import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";

export type Me = {
  id: number;
  username: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await api.get("/api/me/");
      return res.data as Me;
    },
    staleTime: 60_000,
  });
}
