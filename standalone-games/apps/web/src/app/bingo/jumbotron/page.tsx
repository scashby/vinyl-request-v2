import StandaloneBingoJumbotron from "@/app/StandaloneBingoJumbotron";

type JumbotronPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

export default async function BingoJumbotronPage({ searchParams }: JumbotronPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <StandaloneBingoJumbotron
      tenantId={getSingleParam(params.tenantId, "7600b5bc-3d26-4d6d-bc8e-2d189b241a00")}
      userId={getSingleParam(params.userId, "072fba8e-930b-49e1-aff6-e97a6ca0ec82")}
      entitlements={getSingleParam(
        params.entitlements,
        "game:bingo,bundle:core-games,addon:premium-connectors"
      )}
      sessionId={getSingleParam(params.sessionId, "")}
    />
  );
}