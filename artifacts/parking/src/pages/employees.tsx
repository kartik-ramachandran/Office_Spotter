import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListEmployees,
  getListEmployeesQueryKey,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useListSpots,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Users } from "lucide-react";

type EmployeeForm = { name: string; email: string; phone: string; department: string };

export default function Employees() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useListEmployees();
  const { data: spots } = useListSpots();

  const [createOpen, setCreateOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<{ id: number } & EmployeeForm & { permanentSpotId: string } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<EmployeeForm>({ name: "", email: "", phone: "", department: "" });

  const createEmployee = useCreateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setCreateOpen(false);
        setForm({ name: "", email: "", phone: "", department: "" });
        toast({ title: "Employee added" });
      },
      onError: () => toast({ title: "Error", description: "Failed to add employee", variant: "destructive" }),
    },
  });

  const updateEmployee = useUpdateEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setEditEmployee(null);
        toast({ title: "Employee updated" });
      },
      onError: () => toast({ title: "Error", description: "Failed to update employee", variant: "destructive" }),
    },
  });

  const deleteEmployee = useDeleteEmployee({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        setDeleteId(null);
        toast({ title: "Employee removed" });
      },
    },
  });

  const permanentSpots = spots?.filter((s) => s.type === "permanent") ?? [];

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {employees?.length ?? 0} team members
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee">
              <Plus className="h-4 w-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Employee</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Smith"
                  data-testid="input-employee-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="jane@company.com"
                  type="email"
                  data-testid="input-employee-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone (optional)</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 555 000 0000"
                  type="tel"
                  data-testid="input-employee-phone"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Department (optional)</label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                  placeholder="Engineering"
                  data-testid="input-employee-department"
                />
              </div>
              <Button
                className="w-full"
                onClick={() =>
                  createEmployee.mutate({
                    data: {
                      name: form.name,
                      email: form.email,
                      ...(form.phone ? { phone: form.phone } : {}),
                      ...(form.department ? { department: form.department } : {}),
                    },
                  })
                }
                disabled={!form.name || !form.email || createEmployee.isPending}
                data-testid="button-submit-employee"
              >
                {createEmployee.isPending ? "Adding..." : "Add Employee"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editEmployee} onOpenChange={(o) => !o && setEditEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {editEmployee && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={editEmployee.name}
                  onChange={(e) => setEditEmployee((f) => f && { ...f, name: e.target.value })}
                  data-testid="input-edit-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={editEmployee.email}
                  onChange={(e) => setEditEmployee((f) => f && { ...f, email: e.target.value })}
                  data-testid="input-edit-email"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Phone (optional)</label>
                <Input
                  value={editEmployee.phone}
                  onChange={(e) => setEditEmployee((f) => f && { ...f, phone: e.target.value })}
                  placeholder="+1 555 000 0000"
                  type="tel"
                  data-testid="input-edit-phone"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Input
                  value={editEmployee.department}
                  onChange={(e) => setEditEmployee((f) => f && { ...f, department: e.target.value })}
                  data-testid="input-edit-department"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Permanent Parking Spot</label>
                <Select
                  value={editEmployee.permanentSpotId || "none"}
                  onValueChange={(v) =>
                    setEditEmployee((f) => f && { ...f, permanentSpotId: v === "none" ? "" : v })
                  }
                >
                  <SelectTrigger data-testid="select-permanent-spot">
                    <SelectValue placeholder="No permanent spot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No permanent spot</SelectItem>
                    {permanentSpots.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        Spot {s.label}
                        {s.zone ? ` (${s.zone})` : ""}
                        {s.permanentEmployeeName && s.permanentEmployeeId !== editEmployee.id
                          ? ` — assigned to ${s.permanentEmployeeName}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  updateEmployee.mutate({
                    id: editEmployee.id,
                    data: {
                      name: editEmployee.name,
                      email: editEmployee.email,
                      phone: editEmployee.phone || null,
                      department: editEmployee.department || null,
                      permanentSpotId: editEmployee.permanentSpotId
                        ? Number(editEmployee.permanentSpotId)
                        : null,
                    },
                  });
                }}
                disabled={updateEmployee.isPending}
                data-testid="button-save-employee"
              >
                {updateEmployee.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the employee from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteEmployee.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {employees?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No employees yet. Add your first team member.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {employees?.map((emp) => (
            <Card key={emp.id} data-testid={`card-employee-${emp.id}`}>
              <CardContent className="py-4 px-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.email}</p>
                    {emp.phone && (
                      <p className="text-xs text-muted-foreground">{emp.phone}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {emp.department && (
                    <Badge variant="secondary" className="text-xs">{emp.department}</Badge>
                  )}
                  {emp.permanentSpotLabel ? (
                    <Badge variant="outline" className="text-xs text-primary border-primary/30">
                      Spot {emp.permanentSpotLabel}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Flex</Badge>
                  )}
                  <button
                    onClick={() =>
                      setEditEmployee({
                        id: emp.id,
                        name: emp.name,
                        email: emp.email,
                        phone: emp.phone ?? "",
                        department: emp.department ?? "",
                        permanentSpotId: emp.permanentSpotId ? String(emp.permanentSpotId) : "",
                      })
                    }
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    data-testid={`button-edit-employee-${emp.id}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteId(emp.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    data-testid={`button-delete-employee-${emp.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
