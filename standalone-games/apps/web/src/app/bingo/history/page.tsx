import StandaloneBingoHistory from "@/app/StandaloneBingoHistory";

type HistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

export default async function BingoHistoryPage({ searchParams }: HistoryPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <StandaloneBingoHistory
      tenantId={getSingleParam(params.tenantId, "7600b5bc-3d26-4d6d-bc8e-2d189b241a00")}
      userId={getSingleParam(params.userId, "072fba8e-930b-49e1-aff6-e97a6ca0ec82")}
      entitlements={getSingleParam(
        params.entitlements,
        "game:bingo,bundle:core-games,addon:premium-connectors"
      )}
    />
  );
}
