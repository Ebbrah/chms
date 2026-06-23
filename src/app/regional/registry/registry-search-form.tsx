"use client";

import { useState } from "react";
import { searchMemberRegistry } from "@/lib/actions/regional-officers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type RegistryResult = {
  full_name: string;
  parish_name: string;
  member_status: string;
  offering_number: string;
};

export function RegistrySearchForm({
  scopeType,
  scopeId,
}: {
  scopeType: string;
  scopeId: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegistryResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSearched(true);
    const res = await searchMemberRegistry(scopeType, scopeId, query);
    setLoading(false);
    if ("error" in res && res.error) {
      setError(res.error);
      setResults([]);
      return;
    }
    setResults((res.results ?? []) as RegistryResult[]);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => void onSearch(e)} className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[240px] flex-1 gap-2">
          <Label htmlFor="registry-query">Member name or offering number</Label>
          <Input
            id="registry-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="At least 2 characters"
            minLength={2}
            required
          />
        </div>
        <Button type="submit" disabled={loading || query.trim().length < 2}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </>
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {searched && !error ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Parish</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Offering #</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  No matches in your scope.
                </TableCell>
              </TableRow>
            ) : (
              results.map((row, i) => (
                <TableRow key={`${row.full_name}-${row.parish_name}-${i}`}>
                  <TableCell className="font-medium">{row.full_name}</TableCell>
                  <TableCell>{row.parish_name}</TableCell>
                  <TableCell>{row.member_status}</TableCell>
                  <TableCell>{row.offering_number || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Results show name, parish, and status only. Searches are logged and limited to 20 per minute.
      </p>
    </div>
  );
}
