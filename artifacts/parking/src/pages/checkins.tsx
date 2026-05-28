import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCheckins,
  getListCheckinsQueryKey,
  useDeleteCheckin,
  useUpdateCheckin,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function offsetDate(d: string, days: number) {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().split("T")[0];
}

export default function Checkins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [date, setDate] = useState(today);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: checkins, isLoading } = useListCheckins(
    { date },
    { query: { queryKey: getListCheckinsQueryKey({ date }) } }
  );

  const deleteCheckin = useDeleteCheckin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCheckinsQueryKey({ date }) });
        setDeleteId(null);
        toast({ title: "Check-in removed" });
      },
    },
  });

  const updateCheckin = useUpdateCheckin({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCheckinsQueryKey({ date }) });
        toast({ title: "Status updated" });
      },
    },
  });

  const inOffice = checkins?.filter((c) => c.status === "in_office") ?? [];
  const wfh = checkins?.filter((c) => c.status === "wfh") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Check-in Log</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse daily attendance and parking assignments</p>
      </div>

      {/* Date navigation */}
      <Card>
        <CardContent className="py-4 px-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDate(offsetDate(date, -1))}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
              data-testid="button-prev-day"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 text-center">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-center border-0 bg-transparent text-base font-medium focus-visible:ring-0 p-0 h-auto"
                data-testid="input-date"
              />
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(date)}</p>
            </div>
            <button
              onClick={() => setDate(offsetDate(date, 1))}
              disabled={date >= today}
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-30"
              data-testid="button-next-day"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {date !== today && (
        <Button variant="ghost" size="sm" onClick={() => setDate(today)} className="text-primary">
          Jump to today
        </Button>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove this check-in entry permanently.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteCheckin.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : checkins?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No check-ins for this date.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                In Office ({inOffice.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inOffice.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">None</p>
              ) : (
                <div className="space-y-2">
                  {inOffice.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 group"
                      data-testid={`row-checkin-${c.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{c.employeeName}</p>
                        {c.spotLabel && (
                          <p className="text-xs text-muted-foreground">Spot {c.spotLabel}</p>
                        )}
                        {c.notes && (
                          <p className="text-xs text-muted-foreground italic">{c.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {c.spotLabel ? (
                          <Badge variant="outline" className="text-xs">{c.spotLabel}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">No spot</Badge>
                        )}
                        {date === today && (
                          <button
                            onClick={() =>
                              updateCheckin.mutate({ id: c.id, data: { status: "wfh", spotId: null } })
                            }
                            title="Switch to WFH"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500 transition-opacity text-xs"
                            data-testid={`button-switch-wfh-${c.id}`}
                          >
                            WFH
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          data-testid={`button-delete-checkin-${c.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
                Working From Home ({wfh.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wfh.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">None</p>
              ) : (
                <div className="space-y-2">
                  {wfh.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 group"
                      data-testid={`row-wfh-${c.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{c.employeeName}</p>
                        {c.notes && (
                          <p className="text-xs text-muted-foreground italic">{c.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">WFH</Badge>
                        {date === today && (
                          <button
                            onClick={() =>
                              updateCheckin.mutate({ id: c.id, data: { status: "in_office" } })
                            }
                            title="Switch to In Office"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-green-600 transition-opacity text-xs"
                            data-testid={`button-switch-inoffice-${c.id}`}
                          >
                            In
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteId(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          data-testid={`button-delete-checkin-${c.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
