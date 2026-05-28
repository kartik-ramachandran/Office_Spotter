import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetDashboard,
  getGetDashboardQueryKey,
  useListEmployees,
  useListSpots,
  getListCheckinsQueryKey,
  useCreateCheckin,
  useDeleteCheckin,
  useUpdateCheckin,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Car, Users, Home, ParkingSquare, Plus, Trash2, ArrowRightLeft } from "lucide-react";

type Checkin = NonNullable<ReturnType<typeof useGetDashboard>["data"]>["checkins"][number];

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: dashboard, isLoading } = useGetDashboard();
  const { data: employees } = useListEmployees();
  const { data: allSpots } = useListSpots();

  // Check-in modal state
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"in_office" | "wfh">("in_office");

  // Reassign spot modal state
  const [reassignCheckin, setReassignCheckin] = useState<Checkin | null>(null);
  const [reassignSpotId, setReassignSpotId] = useState<string>("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListCheckinsQueryKey() });
  };

  const createCheckin = useCreateCheckin({
    mutation: {
      onSuccess: () => {
        invalidate();
        setCheckinOpen(false);
        setSelectedEmployee("");
        toast({ title: "Checked in successfully" });
      },
      onError: (err: unknown) => {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Failed to check in";
        toast({ title: "Error", description: message, variant: "destructive" });
      },
    },
  });

  const deleteCheckin = useDeleteCheckin({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: "Check-in removed" });
      },
    },
  });

  const updateCheckin = useUpdateCheckin({
    mutation: {
      onSuccess: () => {
        invalidate();
        setReassignCheckin(null);
        setReassignSpotId("");
        toast({ title: "Spot reassigned" });
      },
      onError: () =>
        toast({ title: "Error", description: "Failed to reassign spot", variant: "destructive" }),
    },
  });

  const checkedInIds = new Set(dashboard?.checkins.map((c) => c.employeeId) ?? []);
  const availableEmployees = employees?.filter((e) => !checkedInIds.has(e.id)) ?? [];

  // Spot IDs currently occupied today
  const occupiedSpotIds = new Set(
    (dashboard?.checkins ?? [])
      .filter((c) => c.status === "in_office" && c.spotId !== null && c.spotId !== undefined)
      .map((c) => c.spotId as number)
  );

  // All spots not occupied today — available for assignment/reassignment
  // Include a note if the spot is a permanent spot whose owner is currently WFH
  const wfhCheckins = dashboard?.checkins.filter((c) => c.status === "wfh") ?? [];
  const wfhEmployeeIds = new Set(wfhCheckins.map((c) => c.employeeId));

  const availableSpotsForReassign = (allSpots ?? []).filter(
    (s) => !occupiedSpotIds.has(s.id) || s.id === reassignCheckin?.spotId
  );

  function spotLabel(s: (typeof availableSpotsForReassign)[number]) {
    const isOwnerWfh =
      s.type === "permanent" &&
      s.permanentEmployeeId !== null &&
      s.permanentEmployeeId !== undefined &&
      wfhEmployeeIds.has(s.permanentEmployeeId);

    const currentlyAssigned = s.id === reassignCheckin?.spotId;

    if (currentlyAssigned) return `${s.label}${s.zone ? ` (${s.zone})` : ""} — current`;
    if (isOwnerWfh)
      return `${s.label}${s.zone ? ` (${s.zone})` : ""} — ${s.permanentEmployeeName} is WFH`;
    if (s.type === "permanent" && s.permanentEmployeeName)
      return `${s.label}${s.zone ? ` (${s.zone})` : ""} — ${s.permanentEmployeeName}`;
    return `${s.label}${s.zone ? ` (${s.zone})` : ""}`;
  }

  const handleCheckin = () => {
    if (!selectedEmployee) return;
    createCheckin.mutate({
      data: { employeeId: Number(selectedEmployee), date: today, status: selectedStatus },
    });
  };

  const handleReassign = () => {
    if (!reassignCheckin) return;
    updateCheckin.mutate({
      id: reassignCheckin.id,
      data: { spotId: reassignSpotId ? Number(reassignSpotId) : null },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const inOffice = dashboard?.checkins.filter((c) => c.status === "in_office") ?? [];
  const wfh = dashboard?.checkins.filter((c) => c.status === "wfh") ?? [];

  // Permanent spots freed up by absent/WFH owners
  const freedSpots = (allSpots ?? []).filter(
    (s) =>
      s.type === "permanent" &&
      s.permanentEmployeeId !== null &&
      s.permanentEmployeeId !== undefined &&
      wfhEmployeeIds.has(s.permanentEmployeeId) &&
      !occupiedSpotIds.has(s.id)
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Today's Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-checkin-open">
              <Plus className="h-4 w-4 mr-2" />
              Check In
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Check In for Today</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Employee</label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger data-testid="select-employee">
                    <SelectValue placeholder="Select employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEmployees.map((e) => (
                      <SelectItem
                        key={e.id}
                        value={String(e.id)}
                        data-testid={`option-employee-${e.id}`}
                      >
                        {e.name}
                        {e.department ? ` — ${e.department}` : ""}
                      </SelectItem>
                    ))}
                    {availableEmployees.length === 0 && (
                      <SelectItem value="none" disabled>
                        All employees checked in
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={selectedStatus}
                  onValueChange={(v) => setSelectedStatus(v as "in_office" | "wfh")}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_office">In Office</SelectItem>
                    <SelectItem value="wfh">Working From Home</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleCheckin}
                disabled={!selectedEmployee || createCheckin.isPending}
                data-testid="button-checkin-submit"
              >
                {createCheckin.isPending ? "Checking in..." : "Check In"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Freed permanent spots banner */}
      {freedSpots.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
          <ArrowRightLeft className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-medium">
              {freedSpots.length} permanent spot{freedSpots.length > 1 ? "s" : ""} available today
            </span>{" "}
            —{" "}
            {freedSpots
              .map(
                (s) =>
                  `Spot ${s.label} (${s.permanentEmployeeName} is WFH)`
              )
              .join(", ")}
            . You can reassign {freedSpots.length > 1 ? "them" : "it"} to someone else using the
            reassign button below.
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-spots-available">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ParkingSquare className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboard?.spotsAvailable ?? 0}</p>
                <p className="text-xs text-muted-foreground">Spots available</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-spots-occupied">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Car className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboard?.spotsOccupied ?? 0}</p>
                <p className="text-xs text-muted-foreground">Spots occupied</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-in-office">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboard?.inOfficeCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">In office</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-wfh">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Home className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dashboard?.wfhCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Working from home</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reassign spot dialog */}
      <Dialog
        open={!!reassignCheckin}
        onOpenChange={(o) => {
          if (!o) {
            setReassignCheckin(null);
            setReassignSpotId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Spot — {reassignCheckin?.employeeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {reassignCheckin?.spotLabel
                ? `Currently on spot ${reassignCheckin.spotLabel}. Pick a different spot or clear the assignment.`
                : "No spot assigned. Pick an available spot."}
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Spot</label>
              <Select
                value={reassignSpotId || "none"}
                onValueChange={(v) => setReassignSpotId(v === "none" ? "" : v)}
              >
                <SelectTrigger data-testid="select-reassign-spot">
                  <SelectValue placeholder="No spot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No spot (clear assignment)</SelectItem>
                  {availableSpotsForReassign.map((s) => (
                    <SelectItem
                      key={s.id}
                      value={String(s.id)}
                      data-testid={`option-spot-${s.id}`}
                    >
                      {spotLabel(s)}
                    </SelectItem>
                  ))}
                  {availableSpotsForReassign.length === 0 && (
                    <SelectItem value="full" disabled>
                      No spots available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={handleReassign}
              disabled={updateCheckin.isPending}
              data-testid="button-confirm-reassign"
            >
              {updateCheckin.isPending ? "Saving..." : "Confirm Reassignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In Office */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
              In Office ({inOffice.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {inOffice.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No one in office today
              </p>
            ) : (
              <div className="space-y-2">
                {inOffice.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 group"
                    data-testid={`row-inoffice-${c.id}`}
                  >
                    <div>
                      <p className="text-sm font-medium">{c.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.spotLabel ? `Spot ${c.spotLabel}` : "No spot assigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.spotLabel ? (
                        <Badge variant="outline" className="text-xs">
                          {c.spotLabel}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          No spot
                        </Badge>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity p-1"
                        onClick={() => {
                          setReassignCheckin(c);
                          setReassignSpotId(c.spotId ? String(c.spotId) : "");
                        }}
                        title="Reassign spot"
                        data-testid={`button-reassign-${c.id}`}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1"
                        onClick={() => deleteCheckin.mutate({ id: c.id })}
                        data-testid={`button-remove-checkin-${c.id}`}
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

        {/* WFH */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-400 inline-block" />
              Working From Home ({wfh.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wfh.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No WFH today</p>
            ) : (
              <div className="space-y-2">
                {wfh.map((c) => {
                  const emp = employees?.find((e) => e.id === c.employeeId);
                  const freedSpot = emp?.permanentSpotId
                    ? allSpots?.find((s) => s.id === emp.permanentSpotId)
                    : null;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40 group"
                      data-testid={`row-wfh-${c.id}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{c.employeeName}</p>
                        {freedSpot && !occupiedSpotIds.has(freedSpot.id) && (
                          <p className="text-xs text-amber-600">
                            Spot {freedSpot.label} is free today
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {freedSpot && !occupiedSpotIds.has(freedSpot.id) ? (
                          <Badge
                            variant="outline"
                            className="text-xs border-amber-300 text-amber-700 bg-amber-50"
                          >
                            {freedSpot.label} free
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            WFH
                          </Badge>
                        )}
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1"
                          onClick={() => deleteCheckin.mutate({ id: c.id })}
                          data-testid={`button-remove-wfh-${c.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Parking capacity bar */}
      {dashboard && dashboard.totalSpots > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Parking Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {dashboard.spotsOccupied} of {dashboard.totalSpots} spots taken
                </span>
                <span className="font-medium text-primary">
                  {dashboard.spotsAvailable} available
                </span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{
                    width: `${(dashboard.spotsOccupied / dashboard.totalSpots) * 100}%`,
                  }}
                  data-testid="capacity-bar"
                />
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{dashboard.permanentSpots} permanent spots</span>
                <span>{dashboard.flexibleSpots} flexible spots</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
