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
      tenantId={getSingleParam(params.tenantId, "")}
      userId={getSingleParam(params.userId, "")}
      entitlements={getSingleParam(params.entitlements, "")}
      sessionId={getSingleParam(params.sessionId, "")}
    />
  );
}