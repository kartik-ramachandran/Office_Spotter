import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSpots,
  getListSpotsQueryKey,
  useCreateSpot,
  useUpdateSpot,
  useDeleteSpot,
  useListEmployees,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, Trash2, ParkingSquare } from "lucide-react";

type SpotForm = { label: string; type: "permanent" | "flexible"; zone: string; permanentEmployeeId: string };

const EMPTY_FORM: SpotForm = { label: "", type: "flexible", zone: "", permanentEmployeeId: "" };

export default function Spots() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: spots, isLoading } = useListSpots();
  const { data: employees } = useListEmployees();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<SpotForm>(EMPTY_FORM);
  const [editSpot, setEditSpot] = useState<{ id: number } & SpotForm | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const createSpot = useCreateSpot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSpotsQueryKey() });
        setCreateOpen(false);
        setForm(EMPTY_FORM);
        toast({ title: "Parking spot added" });
      },
      onError: () => toast({ title: "Error", description: "Failed to add spot", variant: "destructive" }),
    },
  });

  const updateSpot = useUpdateSpot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSpotsQueryKey() });
        setEditSpot(null);
        toast({ title: "Spot updated" });
      },
      onError: () => toast({ title: "Error", description: "Failed to update spot", variant: "destructive" }),
    },
  });

  const deleteSpot = useDeleteSpot({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSpotsQueryKey() });
        setDeleteId(null);
        toast({ title: "Spot removed" });
      },
    },
  });

  const SpotForm = ({
    value,
    onChange,
    onSubmit,
    loading,
    submitLabel,
  }: {
    value: SpotForm;
    onChange: (f: SpotForm) => void;
    onSubmit: () => void;
    loading: boolean;
    submitLabel: string;
  }) => (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <label className="text-sm font-medium">Spot Label</label>
        <Input
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder="A1, B-12, Roof-3..."
          data-testid="input-spot-label"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Type</label>
        <Select
          value={value.type}
          onValueChange={(v) =>
            onChange({ ...value, type: v as "permanent" | "flexible", permanentEmployeeId: "" })
          }
        >
          <SelectTrigger data-testid="select-spot-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flexible">Flexible</SelectItem>
            <SelectItem value="permanent">Permanent</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Zone (optional)</label>
        <Input
          value={value.zone}
          onChange={(e) => onChange({ ...value, zone: e.target.value })}
          placeholder="Level 1, North wing..."
          data-testid="input-spot-zone"
        />
      </div>
      {value.type === "permanent" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Assigned Employee</label>
          <Select
            value={value.permanentEmployeeId || "none"}
            onValueChange={(v) =>
              onChange({ ...value, permanentEmployeeId: v === "none" ? "" : v })
            }
          >
            <SelectTrigger data-testid="select-assigned-employee">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {employees?.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Button
        className="w-full"
        onClick={onSubmit}
        disabled={!value.label || loading}
        data-testid="button-submit-spot"
      >
        {loading ? "Saving..." : submitLabel}
      </Button>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const permanentSpots = spots?.filter((s) => s.type === "permanent") ?? [];
  const flexibleSpots = spots?.filter((s) => s.type === "flexible") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parking Spots</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {permanentSpots.length} permanent · {flexibleSpots.length} flexible
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-spot">
              <Plus className="h-4 w-4 mr-2" />
              Add Spot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Parking Spot</DialogTitle>
            </DialogHeader>
            <SpotForm
              value={form}
              onChange={setForm}
              onSubmit={() =>
                createSpot.mutate({
                  data: {
                    label: form.label,
                    type: form.type,
                    ...(form.zone ? { zone: form.zone } : {}),
                    permanentEmployeeId: form.permanentEmployeeId
                      ? Number(form.permanentEmployeeId)
                      : null,
                  },
                })
              }
              loading={createSpot.isPending}
              submitLabel="Add Spot"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editSpot} onOpenChange={(o) => !o && setEditSpot(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Parking Spot</DialogTitle>
          </DialogHeader>
          {editSpot && (
            <SpotForm
              value={editSpot}
              onChange={(f) => setEditSpot({ ...f, id: editSpot.id })}
              onSubmit={() => {
                updateSpot.mutate({
                  id: editSpot.id,
                  data: {
                    label: editSpot.label,
                    type: editSpot.type,
                    zone: editSpot.zone || null,
                    permanentEmployeeId: editSpot.permanentEmployeeId
                      ? Number(editSpot.permanentEmployeeId)
                      : null,
                  },
                });
              }}
              loading={updateSpot.isPending}
              submitLabel="Save Changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Spot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the parking spot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteSpot.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {spots?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ParkingSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No parking spots yet. Add your first spot.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {permanentSpots.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Permanent Spots
              </h2>
              <div className="space-y-2">
                {permanentSpots.map((spot) => (
                  <Card key={spot.id} data-testid={`card-spot-${spot.id}`}>
                    <CardContent className="py-4 px-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <ParkingSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{spot.label}</p>
                            <Badge className="text-xs">Permanent</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {spot.zone ? `${spot.zone} · ` : ""}
                            {spot.permanentEmployeeName
                              ? `Assigned to ${spot.permanentEmployeeName}`
                              : "Unassigned"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setEditSpot({
                              id: spot.id,
                              label: spot.label,
                              type: "permanent",
                              zone: spot.zone ?? "",
                              permanentEmployeeId: spot.permanentEmployeeId
                                ? String(spot.permanentEmployeeId)
                                : "",
                            })
                          }
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          data-testid={`button-edit-spot-${spot.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(spot.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          data-testid={`button-delete-spot-${spot.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
          {flexibleSpots.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Flexible Spots
              </h2>
              <div className="space-y-2">
                {flexibleSpots.map((spot) => (
                  <Card key={spot.id} data-testid={`card-spot-${spot.id}`}>
                    <CardContent className="py-4 px-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                          <ParkingSquare className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{spot.label}</p>
                            <Badge variant="secondary" className="text-xs">Flexible</Badge>
                          </div>
                          {spot.zone && (
                            <p className="text-xs text-muted-foreground">{spot.zone}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setEditSpot({
                              id: spot.id,
                              label: spot.label,
                              type: "flexible",
                              zone: spot.zone ?? "",
                              permanentEmployeeId: "",
                            })
                          }
                          className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          data-testid={`button-edit-spot-${spot.id}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(spot.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1"
                          data-testid={`button-delete-spot-${spot.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
