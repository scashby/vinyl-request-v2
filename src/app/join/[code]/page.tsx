import { Container } from "components/ui/Container";

type PageProps = {
  params: { code: string };
};

export default function Page({ params }: PageProps) {
  return (
    <Container size="md" className="py-12 min-h-screen">
      <div className="max-w-md mx-auto border border-gray-200 rounded-2xl p-6 bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Join Music Bingo</h1>
        <p className="text-sm text-gray-500 mt-2">
          Entered code: <span className="font-semibold">{params.code}</span>
        </p>
        <p className="text-sm text-gray-600 mt-4">
          Player cards are printed for this session. Use this screen to follow along if needed.
        </p>
      </div>
    </Container>
  );
}
