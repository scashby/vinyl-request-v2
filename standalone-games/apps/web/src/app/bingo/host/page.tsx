import StandaloneBingoHome from "@/app/StandaloneBingoHome";

type HostPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSingleParam(value: string | string[] | undefined, fallback: string) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  return value ?? fallback;
}

export default async function BingoHostPage({ searchParams }: HostPageProps) {
  const params = searchParams ? await searchParams : {};

  return (
    <StandaloneBingoHome
      tenantId={getSingleParam(params.tenantId, "")}
      userId={getSingleParam(params.userId, "")}
      entitlements={getSingleParam(params.entitlements, "")}
      initialSessionId={getSingleParam(params.sessionId, "")}
    />
  );
}