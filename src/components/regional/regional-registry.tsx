import type { RegionalScope } from "@/lib/auth/regional-guard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RegistrySearchForm } from "@/app/regional/registry/registry-search-form";

export function RegionalRegistry({ scope }: { scope: RegionalScope }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Member registry search</h1>
        <p className="text-sm text-muted-foreground">
          Search by name across parishes in {scope.name}. Limited fields only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search</CardTitle>
        </CardHeader>
        <CardContent>
          <RegistrySearchForm scopeType={scope.type} scopeId={scope.id} />
        </CardContent>
      </Card>
    </div>
  );
}
