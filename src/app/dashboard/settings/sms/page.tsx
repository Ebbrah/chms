import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/session";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SmsSection } from "./sms-section";

export default async function SmsSettingsPage() {
  const supabase = await createClient();
  const profile = await getProfile();
  const { data: log } = await supabase
    .from("sms_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SMS</h1>
      </div>
      <SmsSection smsOptIn={Boolean(profile?.sms_opt_in)} />
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>To</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Body</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(log ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No messages yet.
                </TableCell>
              </TableRow>
            ) : (
              (log ?? []).map((m) => (
                <TableRow key={m.id as string}>
                  <TableCell>{String(m.to_phone)}</TableCell>
                  <TableCell>{String(m.status)}</TableCell>
                  <TableCell>
                    {m.sent_at ? new Date(String(m.sent_at)).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{String(m.body)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
