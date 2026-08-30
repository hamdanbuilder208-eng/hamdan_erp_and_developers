import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "./Card";

export function AccessDenied({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
        <ShieldAlert className="h-8 w-8 text-slate-400" />
        <p className="text-sm font-medium text-navy-900 dark:text-slate-100">Access denied</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </CardContent>
    </Card>
  );
}
