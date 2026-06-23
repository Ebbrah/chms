import { createClient } from "@/lib/supabase/server";

export type JoinDiocese = { id: string; name: string };
export type JoinDistrict = { id: string; name: string; diocese_id: string };
export type JoinParish = {
  id: string;
  display_name: string;
  slug: string;
  district_id: string;
};

export type ParishJoinOptions = {
  dioceses: JoinDiocese[];
  districts: JoinDistrict[];
  parishes: JoinParish[];
};

const EMPTY: ParishJoinOptions = { dioceses: [], districts: [], parishes: [] };

/** Active parishes with hierarchy — public RPC for the /join picker. */
export async function getParishJoinOptions(): Promise<ParishJoinOptions> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_parish_join_options");

  if (error || !data) return EMPTY;

  const payload = data as ParishJoinOptions;
  return {
    dioceses: payload.dioceses ?? [],
    districts: payload.districts ?? [],
    parishes: payload.parishes ?? [],
  };
}
