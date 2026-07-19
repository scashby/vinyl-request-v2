import StandaloneBingoPrep from "@/app/StandaloneBingoPrep";

type PrepPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

export default async function BingoPrepPage({ searchParams }: PrepPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <StandaloneBingoPrep
      tenantId={getSingleParam(params.tenantId, "")}
      userId={getSingleParam(params.userId, "")}
      entitlements={getSingleParam(params.entitlements, "")}
      sessionId={getSingleParam(params.sessionId, "")}
    />
  );
}
