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
import {
  Car,
  Users,
  Home,
  ParkingSquare,
  Plus,
  Trash2,
  ArrowRightLeft,
  X,
  Check,
  Sparkles,
} from "lucide-react";

type Checkin = NonNullable<ReturnType<typeof useGetDashboard>["data"]>["checkins"][number];
type Spot = NonNullable<ReturnType<typeof useListSpots>["data"]>[number];

function SpotCard({
  spot,
  selected,
  current,
  freed,
  onClick,
}: {
  spot: Spot;
  selected: boolean;
  current: boolean;
  freed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full text-left rounded-xl border-2 p-4 transition-all duration-150
        ${selected
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
          : current
          ? "border-border bg-muted/30"
          : freed
          ? "border-amber-300 bg-amber-50 hover:border-amber-400 hover:bg-amber-100"
          : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
        }
      `}
      data-testid={`spot-card-${spot.id}`}
    >
      {selected && (
        <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
          <Check className="h-3 w-3 text-primary-foreground" />
        </span>
      )}
      {current && !selected && (
        <span className="absolute top-2 right-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Current
        </span>
      )}
      {freed && !selected && (
        <span className="absolute top-2 right-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        </span>
      )}
      <div className="flex items-center gap-3">
        <div
          className={`
          h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg
          ${selected ? "bg-primary text-primary-foreground" : freed ? "bg-amber-200 text-amber-800" : "bg-muted text-muted-foreground"}
        `}
        >
          {spot.label}
        </div>
        <div>
          <p className={`text-sm font-semibold ${selected ? "text-primary" : "text-foreground"}`}>
            {spot.type === "permanent" ? "Permanent" : "Flexible"}
          </p>
          <p className="text-xs text-muted-foreground">
            {freed
              ? `${spot.permanentEmployeeName} is WFH`
              : spot.zone
              ? spot.zone
              : "No zone"}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: dashboard, isLoading } = useGetDashboard();
  const { data: employees } = useListEmployees();
  const { data: allSpots } = useListSpots();

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<"in_office" | "wfh">("in_office");

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

  const occupiedSpotIds = new Set(
    (dashboard?.checkins ?? [])
      .filter((c) => c.status === "in_office" && c.spotId != null)
      .map((c) => c.spotId as number)
  );

  const wfhEmployeeIds = new Set(
    (dashboard?.checkins ?? []).filter((c) => c.status === "wfh").map((c) => c.employeeId)
  );

  // Spots available for reassignment: unoccupied today (or the current one)
  const availableSpotsForReassign = (allSpots ?? []).filter(
    (s) => !occupiedSpotIds.has(s.id) || s.id === reassignCheckin?.spotId
  );

  // Permanent spots freed today (owner is WFH and spot not yet reassigned)
  const freedSpots = (allSpots ?? []).filter(
    (s) =>
      s.type === "permanent" &&
      s.permanentEmployeeId != null &&
      wfhEmployeeIds.has(s.permanentEmployeeId!) &&
      !occupiedSpotIds.has(s.id)
  );

  const handleCheckin = () => {
    if (!selectedEmployee) return;
    createCheckin.mutate({
      data: { employeeId: Number(selectedEmployee), date: today, status: selectedStatus },
    });
  };

  const openReassign = (c: Checkin) => {
    setReassignCheckin(c);
    setReassignSpotId(c.spotId ? String(c.spotId) : "");
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
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const inOffice = dashboard?.checkins.filter((c) => c.status === "in_office") ?? [];
  const wfh = dashboard?.checkins.filter((c) => c.status === "wfh") ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
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
                      <SelectItem key={e.id} value={String(e.id)} data-testid={`option-employee-${e.id}`}>
                        {e.name}{e.department ? ` — ${e.department}` : ""}
                      </SelectItem>
                    ))}
                    {availableEmployees.length === 0 && (
                      <SelectItem value="none" disabled>All employees checked in</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as "in_office" | "wfh")}>
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

      {/* Stats */}
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

      {/* Freed permanent spots — visual cards */}
      {freedSpots.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold text-amber-800">
              {freedSpots.length} permanent spot{freedSpots.length > 1 ? "s" : ""} available today
            </h2>
            <span className="text-xs text-amber-600">— click a spot below to reassign it</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {freedSpots.map((spot) => {
              // Find an in-office person with no spot to suggest
              const unassignedInOffice = inOffice.find((c) => !c.spotId);
              return (
                <div
                  key={spot.id}
                  className="rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-4 cursor-default"
                  data-testid={`freed-spot-${spot.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="h-12 w-12 rounded-xl bg-amber-200 flex items-center justify-center font-bold text-xl text-amber-800">
                      {spot.label}
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                      Free today
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-700 font-medium">{spot.permanentEmployeeName} is WFH</p>
                  {spot.zone && <p className="text-xs text-amber-600 mt-0.5">{spot.zone}</p>}
                  {unassignedInOffice && (
                    <button
                      className="mt-3 w-full text-xs font-medium text-amber-800 bg-amber-200 hover:bg-amber-300 rounded-lg py-1.5 transition-colors"
                      onClick={() => {
                        setReassignCheckin(unassignedInOffice);
                        setReassignSpotId(String(spot.id));
                      }}
                      data-testid={`button-quick-assign-${spot.id}`}
                    >
                      Assign to {unassignedInOffice.employeeName.split(" ")[0]}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reassign dialog — visual spot picker */}
      <Dialog
        open={!!reassignCheckin}
        onOpenChange={(o) => {
          if (!o) { setReassignCheckin(null); setReassignSpotId(""); }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {reassignCheckin?.employeeName.charAt(0)}
              </div>
              <div>
                <DialogTitle className="text-base">Reassign Spot</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reassignCheckin?.employeeName}
                  {reassignCheckin?.spotLabel
                    ? ` — currently on spot ${reassignCheckin.spotLabel}`
                    : " — no spot assigned"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Clear option */}
            <button
              onClick={() => setReassignSpotId("")}
              className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all duration-150 flex items-center gap-3 ${
                reassignSpotId === ""
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              data-testid="spot-card-none"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${reassignSpotId === "" ? "bg-destructive/10" : "bg-muted"}`}>
                <X className={`h-4 w-4 ${reassignSpotId === "" ? "text-destructive" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className={`text-sm font-medium ${reassignSpotId === "" ? "text-destructive" : "text-foreground"}`}>
                  No spot
                </p>
                <p className="text-xs text-muted-foreground">Clear the parking assignment</p>
              </div>
              {reassignSpotId === "" && (
                <span className="ml-auto h-5 w-5 rounded-full bg-destructive/20 flex items-center justify-center">
                  <Check className="h-3 w-3 text-destructive" />
                </span>
              )}
            </button>

            {/* Spot grid */}
            {availableSpotsForReassign.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Available spots
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {availableSpotsForReassign.map((spot) => {
                    const isFreed =
                      spot.type === "permanent" &&
                      spot.permanentEmployeeId != null &&
                      wfhEmployeeIds.has(spot.permanentEmployeeId!);
                    return (
                      <SpotCard
                        key={spot.id}
                        spot={spot}
                        selected={reassignSpotId === String(spot.id)}
                        current={spot.id === reassignCheckin?.spotId}
                        freed={isFreed}
                        onClick={() => setReassignSpotId(String(spot.id))}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {availableSpotsForReassign.length === 0 && (
              <div className="rounded-xl bg-muted/50 py-8 text-center">
                <ParkingSquare className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No spots available right now</p>
              </div>
            )}

            <Button
              className="w-full h-11 text-sm font-semibold"
              onClick={handleReassign}
              disabled={
                updateCheckin.isPending ||
                (reassignSpotId === String(reassignCheckin?.spotId ?? "") && reassignSpotId !== "")
              }
              data-testid="button-confirm-reassign"
            >
              {updateCheckin.isPending ? (
                "Saving..."
              ) : reassignSpotId ? (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Assign Spot {availableSpotsForReassign.find((s) => String(s.id) === reassignSpotId)?.label}
                </>
              ) : (
                "Clear Assignment"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* In Office / WFH panels */}
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
              <p className="text-sm text-muted-foreground py-4 text-center">No one in office today</p>
            ) : (
              <div className="space-y-1.5">
                {inOffice.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group"
                    data-testid={`row-inoffice-${c.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-xs">
                        {c.employeeName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium leading-tight">{c.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.spotLabel ? `Spot ${c.spotLabel}` : "No spot"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {c.spotLabel ? (
                        <Badge variant="outline" className="text-xs font-mono">{c.spotLabel}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">No spot</Badge>
                      )}
                      <button
                        className="ml-1 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 hover:bg-primary/20 rounded-lg px-2 py-1 transition-all"
                        onClick={() => openReassign(c)}
                        data-testid={`button-reassign-${c.id}`}
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        Move
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
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
              <div className="space-y-1.5">
                {wfh.map((c) => {
                  const emp = employees?.find((e) => e.id === c.employeeId);
                  const freed = emp?.permanentSpotId
                    ? allSpots?.find(
                        (s) => s.id === emp.permanentSpotId && !occupiedSpotIds.has(s.id)
                      )
                    : null;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group"
                      data-testid={`row-wfh-${c.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
                          {c.employeeName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">{c.employeeName}</p>
                          {freed ? (
                            <p className="text-xs text-amber-600 font-medium">
                              Spot {freed.label} is free today
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Working from home</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {freed ? (
                          <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300">
                            {freed.label} free
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">WFH</Badge>
                        )}
                        <button
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
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

      {/* Capacity bar */}
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
                <span className="font-medium text-primary">{dashboard.spotsAvailable} available</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(dashboard.spotsOccupied / dashboard.totalSpots) * 100}%` }}
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
