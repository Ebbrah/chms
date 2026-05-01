import { createClient } from "@/lib/supabase/server";
import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AccountCreateForm } from "./account-create-form";
import { AccountsTable, type AccountRow } from "./accounts-table";

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, type, is_active")
    .order("code");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Chart of accounts</h1>
      </div>
      <AccountCreateForm />
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <AccountsTable accounts={(accounts ?? []) as AccountRow[]} />
        </Table>
      </div>
    </div>
  );
}
